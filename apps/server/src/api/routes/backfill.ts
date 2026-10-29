/**
 * routes/backfill.ts
 *
 * Backfill status and control API endpoints.
 * Follows the existing API conventions in this project (Express router, JSON responses).
 *
 * Endpoints:
 *   GET  /api/backfill/status         — all ticker statuses
 *   GET  /api/backfill/status/:ticker — single ticker status
 *   POST /api/backfill/trigger        — manually trigger backfill for a ticker
 *   POST /api/backfill/pause, /resume, /cancel — the download card's buttons
 *   POST /api/backfill/restore        — "Download now" for cancelled symbols (Symbol Setup)
 */

import { Router } from 'express'
import { backfillQueue, backfillStatusMap, MAX_HISTORY_DAYS } from '../../market/BackfillQueue'
import { stmts, getAllSettings } from '../../db'
import { backfilledTickers } from '../../market/state/backfillState'
import { clearVerifiedThrough } from '../../market/state/coverageState'
import { autoRefresh } from '../../market/AutoRefresh'
import { refreshToday, refreshTodayFor, midnightIstMs } from '../../market/refreshToday'
import { queueCatchUp } from '../../brokers/BrokerLifecycle'

const router = Router()

/**
 * GET /api/backfill/status
 * Returns backfill status for all known tickers.
 */
router.get('/status', (_req, res) => {
  const statuses = backfillQueue.getAllStatuses()
  res.json({
    queueLength: backfillQueue.getQueueLength(),
    paused: backfillQueue.isPaused(),
    // Symbols whose history the user cancelled (Symbol Setup offers "Download now")
    cancelled: backfillQueue.skippedTickers().length,
    // Tracked symbols the broker said it doesn't have (Symbol Setup offers to remove them)
    unknown: backfillQueue.unknownSymbols(),
    // Time to finish what's queued, from the last few minutes' real speed (null until known)
    etaMs: backfillQueue.isPaused() ? null : backfillQueue.estimateRemainingMs(),
    statuses,
  })
})

/**
 * POST /api/backfill/pause | /resume | /cancel
 * Pause keeps the queue (and stays paused across restarts); cancel drops every queued download.
 * Chunks already being fetched finish either way.
 */
router.post('/pause', (_req, res) => {
  backfillQueue.pause()
  res.json({ ok: true, paused: true, queueLength: backfillQueue.getQueueLength() })
})

router.post('/resume', (_req, res) => {
  backfillQueue.resume()
  res.json({ ok: true, paused: false, queueLength: backfillQueue.getQueueLength() })
})

router.post('/cancel', (_req, res) => {
  const dropped = backfillQueue.getQueueLength()
  backfillQueue.cancelAll(true)
  res.json({ ok: true, cancelled: dropped, symbols: backfillQueue.skippedTickers().length, paused: backfillQueue.isPaused() })
})

/**
 * POST /api/backfill/restore — "Download now" for symbols whose history was cancelled:
 * allows them again and queues what's missing (the same check as at startup)
 */
router.post('/restore', (_req, res) => {
  const allowed = backfillQueue.allowHistory()
  for (const id of new Set((stmts.getSymbols.all() as any[]).map(s => s.brokerId || s.broker_id))) {
    if (id && id !== 'orphaned') queueCatchUp(id).catch(err => console.error(`[BackfillAPI] Restore for ${id} failed:`, err))
  }
  res.json({ ok: true, symbols: allowed.length })
})

/**
 * GET /api/backfill/status/:ticker
 * Returns backfill status for a single ticker.
 */
router.get('/status/:ticker', (req, res) => {
  const ticker = req.params.ticker?.toUpperCase()
  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' })
  }

  const status = backfillStatusMap.get(ticker)
  if (!status) {
    // Not in the map yet — check if it's already backfilled
    if (backfilledTickers.has(ticker)) {
      return res.json({
        ticker,
        status: 'completed',
        progress: 100,
        candlesFetched: 0,
        message: 'Already fully backfilled (loaded from disk)',
      })
    }
    return res.status(404).json({ error: `No backfill status found for ${ticker}` })
  }

  return res.json(status)
})

/**
 * POST /api/backfill/trigger
 * Body: { ticker: string, depthDays?: number }
 * Manually triggers a backfill for a given ticker.
 */
router.post('/trigger', (req, res) => {
  const { ticker, depthDays } = req.body as { ticker?: string; depthDays?: number }

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' })
  }

  const upperTicker = ticker.toUpperCase()

  // Find the symbol record
  const symbols = stmts.getSymbols.all() as any[]
  const sym = symbols.find(
    s => (s.amiBrokerTicker || s.amibroker_ticker) === upperTicker
  )

  if (!sym) {
    return res.status(404).json({ error: `Symbol ${upperTicker} not found. Add it via the UI first.` })
  }

  const brokerId = sym.brokerId || sym.broker_id
  if (!brokerId || brokerId === 'orphaned') {
    return res.status(400).json({ error: `Symbol ${upperTicker} has no active broker. Re-add the broker.` })
  }

  // Asked for by hand: also undoes an earlier Cancel for this symbol
  backfillQueue.allowHistory([upperTicker])
  // Remove from backfilled set so it is eligible for re-download
  backfilledTickers.delete(upperTicker)
  clearVerifiedThrough(upperTicker)
  backfillStatusMap.delete(upperTicker)

  const depth = Math.max(1, Math.min(Number(depthDays) || Number((getAllSettings() as any).backfillDepthDays) || 365, MAX_HISTORY_DAYS))
  backfillQueue.enqueue(upperTicker, brokerId, sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || upperTicker, depth)

  console.log(`[BackfillAPI] Manual trigger for ${upperTicker} (depth=${depth}d)`)
  return res.json({
    ok: true,
    message: `Backfill triggered for ${upperTicker}`,
    ticker: upperTicker,
    depthDays: depth,
  })
})

/**
 * GET  /api/backfill/auto — automatic today-refresh status
 * POST /api/backfill/auto — { enabled?: boolean, intervalMin?: number }
 */
router.get('/auto', (_req, res) => res.json(autoRefresh.getStatus()))

router.post('/auto', (req, res) => {
  const { enabled, intervalMin } = req.body as { enabled?: boolean; intervalMin?: number }
  try {
    autoRefresh.configure({
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      intervalMin: intervalMin !== undefined ? Number(intervalMin) : undefined,
    })
    res.json(autoRefresh.getStatus())
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

/**
 * POST /api/backfill/today
 * Body: { ticker: string } | { tickers: string[] } | { all: true }
 * Force-fetches today's bars, even during live market. Used by the "Today" buttons in the UI.
 */
router.post('/today', async (req, res) => {
  const { ticker, tickers, all } = (req.body || {}) as { ticker?: string; tickers?: string[]; all?: boolean }

  const symbols = stmts.getSymbols.all() as any[]
  const nowMs = Date.now()
  const midnightIST = midnightIstMs(nowMs)
  const range = { fromDate: new Date(midnightIST).toISOString().slice(0, 10), toDate: new Date(nowMs).toISOString().slice(0, 10) }

  // Many symbols in one call: Refresh All Today, or a selection in Symbol Setup
  if (all === true || Array.isArray(tickers)) {
    const { queued, skipped } = refreshToday(all === true ? null : tickers!, nowMs)
    console.log(`[BackfillAPI] Force today-backfill for ${queued} symbols${skipped ? ` (${skipped} without a broker)` : ''}`)
    return res.json({ ok: true, queued, skipped, ...range })
  }

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' })
  }

  const upperTicker = ticker.toUpperCase()
  const sym = symbols.find(s => (s.amiBrokerTicker || s.amibroker_ticker) === upperTicker)
  if (!sym) {
    return res.status(404).json({ error: `Symbol ${upperTicker} not found.` })
  }

  const problem = refreshTodayFor(sym, midnightIST, nowMs)
  if (problem) return res.status(400).json({ error: problem })

  console.log(`[BackfillAPI] Force today-backfill for ${upperTicker} from ${new Date(midnightIST).toISOString().slice(0, 16)} IST`)
  return res.json({
    ok: true,
    message: `Force today-backfill triggered for ${upperTicker}`,
    ticker: upperTicker,
    ...range,
  })
})

export default router

