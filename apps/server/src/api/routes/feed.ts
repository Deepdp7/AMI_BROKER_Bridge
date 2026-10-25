/**
 * History for the AmiBroker plugin (DataBridgePro.dll). Mounted at /api/feed.
 */
import { Router } from 'express'
import { getAllSettings, stmts, syncCachesPromise } from '../../db'
import { brokerManager } from '../../brokers/BrokerManager'
import { backfillQueue } from '../../market/BackfillQueue'
import { backfilledTickers } from '../../market/state/backfillState'
import { liveFeed } from '../../market/liveFeed'

const router = Router()

const feedResponseCache = new Map<string, { ts: number, data: string }>()

// BUG FIX: Prevent infinite RAM growth (Memory Leak) by clearing stale cache entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of feedResponseCache.entries()) {
    // If cache entry is older than 5 seconds, delete it (the cache is only meant for 50ms throttling)
    if (now - value.ts > 5000) {
      feedResponseCache.delete(key)
    }
  }
}, 10000).unref() // Runs every 10 seconds

// ===== AmiBroker DLL Data Endpoint =====
// GET /api/feed/bars?ticker=NIFTY%2050&limit=5000
// Returns CSV: timestamp_unix_sec,open,high,low,close,volume
// This endpoint is called directly by the DataBridgePro.dll C++ plugin
router.get('/bars', async (req, res) => {
  // Never serve a half-imported database (first start after the PostgreSQL → SQLite move)
  await syncCachesPromise
  let ticker = String(req.query.ticker || '')
  // Up to ~16 years of 1-minute bars (AmiBroker's own database size setting is the real cap)
  const limit = Math.min(Number(req.query.limit) || 5000, 1_500_000)

  // Defensive fix for unencoded '&' in symbol names (e.g. M&M -> ?ticker=M&M&limit=5000)
  if (req.url && req.url.includes('ticker=')) {
    try {
      const queryPart = req.url.split('?')[1] || ''
      const match = queryPart.match(/ticker=(.+?)(?:&(?:limit|interval|broker|from|to)=\w+)?$/)
      if (match && match[1]) {
        const candidate = decodeURIComponent(match[1].replace(/&(?:limit|interval|broker|from|to)=\w+/g, ''))
        const allSyms = stmts.getSymbols.all() as any[]
        if (allSyms.some(s => (s.amiBrokerTicker || s.amibroker_ticker) === candidate)) {
          ticker = candidate
        }
      }
    } catch {}
  }

  if (!ticker) {
    return res.status(400).send('ticker is required')
  }

  const since = Number(req.query.since) || 0

  // 50ms Throttling Cache (Ultra-low CPU overhead)
  const cacheKey = `${ticker}:${limit}:${since}`
  const cached = feedResponseCache.get(cacheKey)
  if (cached && (Date.now() - cached.ts < 50)) {
    return res.type('text/plain').send(cached.data)
  }

  // Strip comma suffix (e.g. RELIANCE,NSE,EQ -> RELIANCE) if user mistakenly imported CSV directly in AmiBroker
  if (ticker.includes(',')) {
    ticker = ticker.split(',')[0].trim();
  }

  let brokerId = ''
  const existing = stmts.getSymbols.all() as any[]
  const symRecord = existing.find(s => {
    const t = s.amiBrokerTicker || s.amibroker_ticker
    if (t !== ticker) return false
    const bId = s.brokerId || s.broker_id
    return brokerManager.getAdapter(bId) !== undefined
  }) || existing.find(s => s.amiBrokerTicker === ticker || s.amibroker_ticker === ticker)

  // Catch-up requests from the plugin pass `since`: filter in SQL instead of loading `limit` rows
  let csv = since > 0
    ? await stmts.getBarsCsvSinceAsync.get(ticker, since, limit)
    : await stmts.getBarsCsvByTickerAsync.get(ticker, limit)

  if (!symRecord) {
    // Not mapped to a broker (no live ticks / backfill), but stored history is still served:
    // a lost symbol mapping must never blank a chart that has years of bars in the database.
    if (!csv) console.log(`[API] AmiBroker requested unknown symbol ${ticker}, ignoring. Please add it via the UI.`)
    csv = csv ? csv + '\nEND' : 'END\n'
    feedResponseCache.set(cacheKey, { ts: Date.now(), data: csv })
    return res.type('text/plain').send(csv)
  }
  brokerId = symRecord.brokerId || symRecord.broker_id
  // AmiBroker is loading this symbol: its pending downloads go first
  backfillQueue.prioritize(ticker)

  if (!backfilledTickers.has(ticker) && brokerId && brokerId !== 'orphaned') {
    // Enqueue to the centralized rate-limited 1-year backfill queue
    const settings = getAllSettings() as any
    const backfillDepth = Number(settings?.backfillDepthDays) || 365
    backfillQueue.enqueue(ticker, brokerId, symRecord.rawSymbol || symRecord.raw_symbol || symRecord.instrumentId || symRecord.instrument_id || ticker, backfillDepth)
  }

  // Append in-progress live bar if available and has a valid price
  const liveBar = liveFeed.getLiveBar(ticker, brokerId)
  if (liveBar && liveBar.close > 0) {
    const ts = Math.floor(liveBar.bucketMs / 1000)
    const liveCsvLine = `${ts},${liveBar.open},${liveBar.high},${liveBar.low},${liveBar.close},${liveBar.volume}`
    csv = csv ? csv + '\n' + liveCsvLine : liveCsvLine
  }

  // Filter by 'since' if provided
  if (since > 0 && csv) {
    csv = csv.split('\n').filter(line => {
      if (!line) return false
      const ts = parseInt(line.split(',')[0])
      return ts > since
    }).join('\n')
  }

  if (!csv) {
    csv = 'END\n'
  } else {
    csv = csv + '\nEND'
  }

    feedResponseCache.set(cacheKey, { ts: Date.now(), data: csv })
  return res.type('text/plain').send(csv)
})

export default router
