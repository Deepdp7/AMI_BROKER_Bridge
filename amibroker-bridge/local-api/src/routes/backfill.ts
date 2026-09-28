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
 */

import { Router } from 'express'
import { backfillQueue, backfillStatusMap } from '../services/BackfillQueue'
import { stmts } from '../db'
import { backfilledTickers } from '../shared/backfillState'

const router = Router()

/**
 * GET /api/backfill/status
 * Returns backfill status for all known tickers.
 */
router.get('/status', (_req, res) => {
  const statuses = backfillQueue.getAllStatuses()
  res.json({
    queueLength: backfillQueue.getQueueLength(),
    statuses,
  })
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

  // Remove from backfilled set so it is eligible for re-download
  backfilledTickers.delete(upperTicker)
  backfillStatusMap.delete(upperTicker)

  const depth = Math.max(1, Math.min(Number(depthDays) || 365, 365))
  backfillQueue.enqueue(upperTicker, brokerId, sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || upperTicker, depth)

  console.log(`[BackfillAPI] Manual trigger for ${upperTicker} (depth=${depth}d)`)
  return res.json({
    ok: true,
    message: `Backfill triggered for ${upperTicker}`,
    ticker: upperTicker,
    depthDays: depth,
  })
})

export default router
