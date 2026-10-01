/**
 * DataBridge Pro — Local API Server
 * Express app + WebSocket server, bound to localhost:7890 only (§41, §57)
 * WebSocket pushes: feed_update, log_entry, broker_status, health_update,
 *                   backfill_progress, backfill_completed, backfill_failed
 */
import express = require('express')
import cors = require('cors')
import http = require('http')
import net = require('net')
import { exec } from 'child_process'
import { WebSocketServer, WebSocket } from 'ws'
import brokersRouter from './routes/brokers'
import statusRouter from './routes/status'
import settingsRouter from './routes/settings'
import logsRouter from './routes/logs'
import systemRouter from './routes/system'
import backfillRouter from './routes/backfill'
import { feedSimulator } from './services/feedSimulator'
import { getAllSettings, rotateOldLogs, stmts, flushPendingBars, getLastBarTimestampSec, getOldestBarTimestampSec, syncCachesPromise, loadBarsFromDisk } from './db'
import { backfillQueue } from './services/BackfillQueue'
import { backfilledTickers } from './shared/backfillState'
import { detectGaps, formatGapSummary } from './services/GapDetector'
import type { WsMessage, AppSettings } from './types'

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception (recovered):', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection (recovered):', reason)
})

const PORT = Number(process.env.PORT) || 7890
const HOST = '127.0.0.1' // localhost-only per §41

const app = express()

// ===== Middleware =====
// CORS: Allow localhost and ngrok for dev
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('ngrok-free.dev') || origin.includes('tauri.localhost') || origin.startsWith('tauri://')) {
      callback(null, true)
    } else {
      console.error(`[Server Error] CORS blocked origin: ${origin}`);
      callback(new Error('CORS: Only localhost/tauri origins allowed'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Convert JSON parse errors to 400
app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  next(err)
})

// Structured request logger (filters high-frequency feed polling from flooding stdout)
app.use((req, _res, next) => {
  if (req.path !== '/api/feed/bars') {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
    }))
  }
  next()
})

// ===== Routes =====
// Alias for OAuth callbacks (redirects to the correct route)
app.use('/api/callback', (req, res) => {
  res.redirect(req.originalUrl.replace('/api/callback', '/api/brokers/callback'))
})

app.use('/api/brokers', brokersRouter)
app.use('/api/status', statusRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/logs', logsRouter)
app.use('/api/diagnostics', logsRouter) // export endpoint also on this prefix
app.use('/api/system', systemRouter)
app.use('/api/backfill', backfillRouter)

// /api/symbols endpoint to prevent UI crash
app.get('/api/symbols', (_req, res) => {
  const rows = stmts.getSymbols.all()
  res.json(rows)
})

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
}, 10000) // Runs every 10 seconds

// ===== AmiBroker DLL Data Endpoint =====
// GET /api/feed/bars?ticker=NIFTY%2050&limit=5000
// Returns CSV: timestamp_unix_sec,open,high,low,close,volume
// This endpoint is called directly by the DataBridgePro.dll C++ plugin
app.get('/api/feed/bars', async (req, res) => {
  let ticker = String(req.query.ticker || '')
  const limit = Math.min(Number(req.query.limit) || 5000, 150000)

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

  let brokerId = ''
  const existing = stmts.getSymbols.all() as any[]
  const symRecord = existing.find(s => {
    const t = s.amiBrokerTicker || s.amibroker_ticker
    if (t !== ticker) return false
    const bId = s.brokerId || s.broker_id
    return brokerManager.getAdapter(bId) !== undefined
  }) || existing.find(s => s.amiBrokerTicker === ticker || s.amibroker_ticker === ticker)
  
  if (!symRecord) {
    console.log(`[API] AmiBroker requested unknown symbol ${ticker}, ignoring. Please add it via the UI.`)
    return res.type('text/plain').send('END\n')
  }
  brokerId = symRecord.brokerId || symRecord.broker_id

  let csv = await stmts.getBarsCsvByTickerAsync.get(ticker, limit)

  if (!backfilledTickers.has(ticker) && brokerId) {
    // Enqueue to the centralized rate-limited 1-year backfill queue
    const settings = getAllSettings() as any
    const backfillDepth = Number(settings?.backfillDepthDays) || 365
    backfillQueue.enqueue(ticker, brokerId, symRecord.rawSymbol || symRecord.raw_symbol || symRecord.instrumentId || symRecord.instrument_id || ticker, backfillDepth)
  }

  // Append in-progress live bar if available and has a valid price
  const liveBar = feedSimulator.getLiveBar(ticker, brokerId)
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

// Health check (used by GUI to detect API availability)
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', ts: Date.now() })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message)
  res.status(500).json({ error: err.message })
})

// ===== HTTP + WebSocket Server =====
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/api/status/stream' })

const wsClients = new Set<WebSocket>()

import { encode } from '@msgpack/msgpack'

function broadcast<T>(type: WsMessage['type'], payload: T) {
  if (wsClients.size === 0) return
  const msgObj = { type, payload, ts: Date.now() }
  const buffer = encode(msgObj)
  wsClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(buffer)
    }
  })
}

wss.on('connection', (ws, req) => {
  // Security: reject non-localhost connections
  const ip = req.socket.remoteAddress
  if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    ws.close(1008, 'Non-localhost connection rejected')
    return
  }

  ws.binaryType = 'arraybuffer'
  wsClients.add(ws)
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'ws_connected', clients: wsClients.size }))

  // Send initial snapshot
  const snapshot = feedSimulator.getFeedStatuses()
  if (snapshot.length > 0) {
    const snapshotMsg = {
      type: 'feed_update',
      payload: { symbols: snapshot, coreEngine: feedSimulator._getCoreStats(), timestamp: Date.now() },
      ts: Date.now(),
    }
    ws.send(encode(snapshotMsg))
  }

  // Immediately send market_status so the new client knows without waiting 60s
  {
    const now = new Date()
    const istMs = now.getTime() + 5.5 * 3600 * 1000
    const ist = new Date(istMs)
    const day = ist.getUTCDay()
    const totalMin = ist.getUTCHours() * 60 + ist.getUTCMinutes()
    const open = day !== 0 && day !== 6 && totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30
    ws.send(encode({ type: 'market_status', payload: { open, ts: Date.now() }, ts: Date.now() }))
  }

  // Ping every 30s to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encode({ type: 'ping', payload: null, ts: Date.now() }))
    }
  }, 30000)

  ws.on('close', () => {
    wsClients.delete(ws)
    clearInterval(pingInterval)
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'ws_disconnected', clients: wsClients.size }))
  })

  ws.on('error', (err) => {
    console.error('[WS Error]', err.message)
    wsClients.delete(ws)
    clearInterval(pingInterval)
  })
})

// ===== Wire up feed simulator events to WebSocket =====
feedSimulator.on('feed_update', (payload) => {
  broadcast('feed_update', payload)
})

feedSimulator.on('log_entry', (entry) => {
  broadcast('log_entry', entry)
})

feedSimulator.on('broker_status', (status) => {
  broadcast('broker_status', status)
})

import { brokerManager } from './services/BrokerManager'
import { pendingLogins } from './routes/brokers'

brokerManager.on('tick', (tick: any) => {
  feedSimulator.processRealTick(tick, tick.brokerId)
})

brokerManager.on('broker_status', (status) => {
  broadcast('broker_status', status)
})

brokerManager.on('log_entry', (entry) => {
  broadcast('log_entry', entry)
})

brokerManager.on('master_sync_progress', (data) => broadcast('master_sync_progress', data))
brokerManager.on('master_sync_complete', (data) => broadcast('master_sync_complete', data))
brokerManager.on('master_sync_error', (data) => broadcast('master_sync_error', data))
brokerManager.on('symbol_resolved', (data: any) => {
  const existing = stmts.getSymbols.all() as any[]
  const symRecord = existing.find(s => (s.rawSymbol || s.raw_symbol) === data.raw && (s.brokerId || s.broker_id) === data.brokerId)
  if (symRecord) {
    const ticker = symRecord.amiBrokerTicker || symRecord.amibroker_ticker
    feedSimulator.updateResolvedToken(data.brokerId, ticker, data.resolved)
  }
})

// ===== Wire up BackfillQueue events to WebSocket =====
backfillQueue.on('backfill_progress', (payload) => broadcast('backfill_progress', payload))
backfillQueue.on('backfill_completed', (payload) => broadcast('backfill_completed', payload))
backfillQueue.on('backfill_failed', (payload) => broadcast('backfill_failed', payload))

// Fix 3: Auto-open browser when WebSocket JWT expires during streaming
brokerManager.on('auth_required', (brokerId: string) => {
  stmts.updateBrokerStatus.run('auth_required', null, brokerId)
  broadcast('broker_status', { id: brokerId, status: 'auth_required' })
  const broker = stmts.getBrokerById.get(brokerId) as any
  const creds = stmts.getCredentials.get(brokerId) as any
  if (broker?.broker_type === 'fyers' && creds?.apiKey) {
    if (!creds.apiSecret) {
      console.log(`[Auth] Fyers token expired but API Secret is missing in DB for ${brokerId}. Cannot auto-reauth. Please re-add the broker.`)
      return
    }
    pendingLogins.set(broker.broker_type, { apiKey: creds.apiKey, apiSecret: creds.apiSecret })
    const redirectUrl = encodeURIComponent('http://127.0.0.1:7890/api/callback/fyers')
    const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${creds.apiKey}&redirect_uri=${redirectUrl}&response_type=code&state=fyers`
    console.log(`[Auth] WebSocket token expired for ${brokerId}. Auto-opening Fyers login in browser...`)
    exec(`start "" "${loginUrl}"`, (err) => {
      if (err) console.error('[Auth] Failed to open browser:', err.message)
    })
  }
})

// Helper: get today's date string in IST (Asia/Kolkata = UTC+5:30)
function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0]
}

// Helper: fetch just today's bars for a ticker (incremental update)
async function fetchTodayBars(adapter: any, ticker: string) {
  try {
    const symRecord = (stmts.getSymbols.all() as any[]).find((s: any) => (s.amiBrokerTicker || s.amibroker_ticker) === ticker);
    const brokerToken = adapter.resolveSymbol ? await adapter.resolveSymbol(ticker, symRecord?.exchange) : ticker
    
    // Instead of doing timezone shifts manually which can fail depending on system timezone,
    // let's pass exact Date objects and let FyersAdapter handle formatting.
    const to = new Date()
    // Make from midnight IST today
    const from = new Date(to)
    from.setHours(0, 0, 0, 0)
    
    broadcast('log_entry', { level: 'info', component: 'Backfill', message: `Fetching today's bars for ${ticker} (${brokerToken})...` })
    
    const bars = await adapter.getHistoricalBars(brokerToken, '1m', from, to)
    if (bars && bars.length > 0) {
      const barsToInsert = bars.map((b: any) => ({
        amibroker_ticker: ticker, ts_utc_ms: b.ts,
        open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
        open_interest: null
      }))
      stmts.insertBarsToDiskOnly.run(barsToInsert)
      stmts.insertBarsToRamOnly.run(barsToInsert)
      console.log(`[Init] Incremental update: added ${bars.length} bars for ${ticker} (today)`)
      broadcast('log_entry', { level: 'success', component: 'Backfill', message: `Added ${bars.length} bars for ${ticker} (today)` })
    } else {
      broadcast('log_entry', { level: 'warn', component: 'Backfill', message: `No bars returned for ${ticker} today.` })
    }
  } catch (e: any) {
    console.error(`[Init] Failed incremental update for ${ticker}:`, e)
    broadcast('log_entry', { level: 'error', component: 'Backfill', message: `Failed backfill for ${ticker}: ${e.message}` })
  }
}

// ===== Start feed simulator if brokers exist =====
async function initSimulator() {
  try {
    const settings = getAllSettings() as unknown as AppSettings
    console.log(`[Init] Log level: ${settings.logLevel}`)
    
    // Re-hydrate feedSimulator with existing symbols from DB (skip orphaned)
    const symbols = stmts.getSymbols.all() as any[]
    symbols.forEach(sym => {
      const brokerId = sym.brokerId || sym.broker_id
      const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
      const brokerToken = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
      if (brokerId !== 'orphaned') {
        feedSimulator.addSymbolByTicker(ticker, brokerId, sym.exchange, sym.instrumentType, brokerToken)
      }
    })

    // Auto-connect real brokers using saved credentials FIRST
    const brokers = stmts.getBrokers.all() as any[]
    for (const b of brokers) {
      const creds = stmts.getCredentials.get(b.id)
      if (creds && creds.accessToken) {
        console.log(`[Init] Auto-connecting broker ${b.id}...`)
        try {
          await brokerManager.connectBroker(b.id, b.broker_type, {
            apiKey: creds.apiKey,
            apiSecret: creds.apiSecret || '',
            accessToken: creds.accessToken
          })
          const adapter = brokerManager.getAdapter(b.id) as any
          const brokerSymbols = symbols
            .filter(s => (s.brokerId || s.broker_id) === b.id)
            .map(s => s.rawSymbol || s.raw_symbol)

          if (brokerSymbols.length > 0) {
            try {
              await brokerManager.subscribe(b.id, brokerSymbols)
            } catch (subErr) {
              console.error(`[Init] Failed to subscribe symbols for ${b.id}:`, subErr)
            }
          }
        } catch (err: any) {
          console.error(`[Init] Failed to auto-connect broker ${b.id}:`, err?.message || err)
          stmts.updateBrokerStatus.run('auth_required', null, b.id)
          broadcast('broker_status', { id: b.id, status: 'auth_required' })
          if (b.broker_type === 'fyers' && creds?.apiKey) {
            if (!creds.apiSecret) {
              console.log(`[Init] Token expired but API Secret is missing in DB for ${b.id}. Cannot auto-reauth. Please re-add the broker.`)
              continue
            }
            pendingLogins.set(b.broker_type, { apiKey: creds.apiKey, apiSecret: creds.apiSecret })
            const redirectUrl = encodeURIComponent('http://127.0.0.1:7890/api/callback/fyers')
            const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${creds.apiKey}&redirect_uri=${redirectUrl}&response_type=code&state=fyers`
            console.log(`[Init] Token expired. Auto-opening Fyers login in browser...`)
            exec(`start "" "${loginUrl}"`, (e) => {
              if (e) console.error('[Init] Failed to open browser:', e.message)
            })
          }
        }
      }
    }

    // Smart incremental backfill on startup:

    /**
     * For Futures contracts (e.g. INDHOTEL26SEPFUT), parse the expiry month/year
     * from the ticker name and return an approximate listing start date (expiry - 95 days).
     * This prevents gap-fills from going back 1 year for contracts that were only
     * listed ~3 months before expiry.
     */
    function getFuturesListingStartMs(ticker: string): number | null {
      const match = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.exec(ticker)
      if (!match) return null
      const fullMatch = /^.*?(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.exec(ticker)
      if (!fullMatch) return null
      const yearShort = parseInt(fullMatch[1], 10)
      const monthStr = fullMatch[2].toUpperCase()
      const monthMap: Record<string, number> = {
        JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
        JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
      }
      const month = monthMap[monthStr]
      const year = 2000 + yearShort
      // Approximate expiry = last day of expiry month
      const expiryDate = new Date(year, month - 1, 28)
      // Futures are listed ~3 months (90 days) before expiry. Give 5 days buffer.
      const listingMs = expiryDate.getTime() - 95 * 24 * 60 * 60 * 1000
      return listingMs
    }

    for (const sym of symbols) {
      if (sym.brokerId === 'orphaned') continue
      const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
      const brokerId = sym.brokerId || sym.broker_id
      if (!brokerId) continue
      const safeTicker = ticker.replace(/[^a-zA-Z0-9_-]/g, '_')

      const backfillDepth = Number(settings?.backfillDepthDays) || 365
      const nowMs = Date.now()
      let targetFromMs = nowMs - (backfillDepth * 24 * 60 * 60 * 1000)

      // For futures contracts, don't backfill before the contract was listed
      const futuresListingMs = getFuturesListingStartMs(ticker)
      if (futuresListingMs !== null) {
        targetFromMs = Math.max(targetFromMs, futuresListingMs)
      } else {
        // For non-futures: also cap by oldest existing bar (prevents useless gap-fills)
        const oldestSec = await getOldestBarTimestampSec(safeTicker)
        if (oldestSec > 0) {
          targetFromMs = Math.max(targetFromMs, oldestSec * 1000)
        }
      }

      const gaps = await detectGaps(ticker, sym.exchange || 'NSE', '1m', safeTicker, targetFromMs, nowMs)
      
      if (gaps.length > 0) {
        console.log(`[Init] Enqueueing ${gaps.length} missing gap(s) for ${ticker} (${brokerId})`)
        const brokerToken = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
        for (const gap of gaps) {
          backfillQueue.enqueueGapFill(ticker, brokerId, brokerToken, gap.fromMs, gap.toMs)
        }
      } else {
        const lastTsSec = await getLastBarTimestampSec(safeTicker)
        const lastDateStr = lastTsSec ? new Date(lastTsSec * 1000).toISOString().slice(0, 16) : 'N/A'
        console.log(`[Init] Ticker ${ticker} is up to date on disk (last bar: ${lastDateStr}).`)
        backfilledTickers.add(ticker)
      }
      
      await new Promise(r => setTimeout(r, 100))
    }

    // === Startup today-bar fetch ===
    // After gap detection, always fetch today's bars for every symbol.
    // This ensures that if the app was closed during or after market hours,
    // all candles for today are loaded into RAM (the DB backfill queue handles DB storage).
    const todayFetchDelay = 5000  // wait 5s for broker connection to be ready
    setTimeout(async () => {
      const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000)
      const istHHMM = nowIST.getUTCHours() * 100 + nowIST.getUTCMinutes()
      // Only run after market open (9:15 IST) — before that, no today bars exist
      if (istHHMM < 915) return

      const allSyms = stmts.getSymbols.all() as any[]
      for (const sym of allSyms) {
        if ((sym.brokerId || sym.broker_id) === 'orphaned') continue
        const brokerId = sym.brokerId || sym.broker_id
        const adapter = brokerManager.getAdapter(brokerId)
        if (!adapter) continue
        const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
        try {
          await fetchTodayBars(adapter, ticker)
        } catch (e) { /* ignore per-ticker errors */ }
        await new Promise(r => setTimeout(r, 200)) // rate-limit
      }
      console.log('[Init] Startup today-bar fetch complete.')
    }, todayFetchDelay)


    // Auto-start with mock data for demonstration (only runs if no real ticks)
    feedSimulator.start()
  } catch (e) {
    console.error('[Init] Error starting simulator:', e)
  }
}

// ===== Market Status Broadcast =====
// Broadcasts market_status (open/closed) to all WS clients every 60 seconds
// NSE/BSE hours: 09:15–15:30 IST on weekdays
function isMarketOpen(): boolean {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffset)
  const dayOfWeek = ist.getUTCDay() // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return false // Weekend
  const hours = ist.getUTCHours()
  const minutes = ist.getUTCMinutes()
  const totalMin = hours * 60 + minutes
  return totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30
}

let _lastMarketStatus: boolean | null = null
setInterval(() => {
  const open = isMarketOpen()
  broadcast('market_status', { open, ts: Date.now() })
  // Log transition
  if (_lastMarketStatus !== null && _lastMarketStatus !== open) {
    console.log(`[Market] Status changed: ${open ? 'OPEN' : 'CLOSED'}`)
  }
  _lastMarketStatus = open
}, 60 * 1000)
// Also broadcast immediately when first WS client connects (handled in wss.on('connection') above)
// The first wss.on connection already sends a snapshot — market_status will follow within 60s

// ===== Cron Jobs =====
let isDailyCronRunning = false
let isGapDetectionRunning = false
setInterval(() => {
  try {
    const settings = getAllSettings() as unknown as AppSettings
    // Log Rotation
    rotateOldLogs(settings.logRetentionDays || 14)
    
    // Check if it's 08:30 AM IST (UTC+5:30)
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
    if (ist.getUTCHours() === 8 && ist.getUTCMinutes() === 30) {
      console.log('[Cron] Triggering daily master symbol sync at 08:30 AM IST...')
      const brokers = stmts.getBrokers.all() as any[]
      for (const b of brokers) {
        const adapter = brokerManager.getAdapter(b.id) as any
        if (adapter && typeof adapter.downloadMasterContracts === 'function') {
          adapter.downloadMasterContracts()
        }
      }

      console.log('[Cron] Triggering daily historical backfill maintenance for ALL configured symbols...')
      const symbols = stmts.getSymbols.all() as any[]
      const nowMs = Date.now()
      const backfillDepth = Number(settings?.backfillDepthDays) || 365
      const targetFromMs = nowMs - (backfillDepth * 24 * 60 * 60 * 1000)
      
      if (isGapDetectionRunning) {
        console.log('[Cron] Gap detection is already running, skipping this minute.')
        return
      }
      isGapDetectionRunning = true

      // Using async IIFE so we don't block the setInterval callback
      ;(async () => {
        try {
          for (const sym of symbols) {
            const brokerId = sym.brokerId || sym.broker_id
            if (brokerId === 'orphaned' || !brokerId) continue
            
            const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
            if (!ticker) continue
            
            const safeTicker = ticker.replace(/[^a-zA-Z0-9_-]/g, '_')
            const brokerToken = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
            
            // Detect gaps — respect futures listing date
            let activeTargetFromMs = targetFromMs
            const futMatchCron = /^.*?(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.exec(ticker)
            if (futMatchCron) {
              const yearShort = parseInt(futMatchCron[1], 10)
              const monthMap: Record<string, number> = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 }
              const month = monthMap[futMatchCron[2].toUpperCase()]
              const expiryDate = new Date(2000 + yearShort, month - 1, 28)
              const listingMs = expiryDate.getTime() - 95 * 24 * 60 * 60 * 1000
              activeTargetFromMs = Math.max(activeTargetFromMs, listingMs)
            } else {
              const oldestSec = await getOldestBarTimestampSec(safeTicker)
              if (oldestSec > 0) {
                activeTargetFromMs = Math.max(activeTargetFromMs, oldestSec * 1000)
              }
            }
            
            const gaps = await detectGaps(ticker, sym.exchange || 'NSE', '1m', safeTicker, activeTargetFromMs, nowMs)
            
            if (gaps.length > 0) {
              console.log(`[Cron] Enqueueing ${gaps.length} missing gap(s) for ${ticker} (${brokerId})`)
              for (const gap of gaps) {
                backfillQueue.enqueueGapFill(ticker, brokerId, brokerToken, gap.fromMs, gap.toMs)
              }
            } else {
              backfilledTickers.add(ticker)
            }
            
            // Yield the event loop and allow GC to breathe so UI/API remains responsive
            await new Promise(r => setTimeout(r, 100))
          }
        } finally {
          isGapDetectionRunning = false
        }
      })()
    }
  } catch { /* ignore */ }
}, 60 * 1000) // Check every minute

// ===== Start =====
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[API] Port ${PORT} is already in use. Assuming another instance is running and exiting gracefully.`)
    process.exit(0)
  } else {
    console.error('[Server Error]', err)
    process.exit(1)
  }
})

server.listen(PORT, HOST, async () => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event: 'server_started',
    host: HOST,
    port: PORT,
    endpoints: [
      `http://${HOST}:${PORT}/api/brokers`,
      `http://${HOST}:${PORT}/api/status/feed`,
      `http://${HOST}:${PORT}/api/status/health`,
      `http://${HOST}:${PORT}/api/settings`,
      `http://${HOST}:${PORT}/api/logs`,
      `ws://${HOST}:${PORT}/api/status/stream`,
    ],
  }))
  await syncCachesPromise
  // BUG #2 FIX: Load last 3 days of bars from PostgreSQL into RAM cache
  // so AmiBroker can read historical data immediately on startup
  loadBarsFromDisk()
  initSimulator()
})

// ===== AmiBroker IPC TCP Server =====

declare global {
  var bdlLastIpcLog: number | undefined;
}

const ipcClients = new Set<net.Socket>()

feedSimulator.on('live_bar_updated', (data: { ticker: string, bar: any }) => {
  const { ticker, bar } = data;
  if (!bar || bar.close === 0) return;

  const ts = Math.floor(bar.bucketMs / 1000);
  const msg = `LIVE_BAR|${ticker}|${ts}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume}\n`;
  
  if (!global.bdlLastIpcLog || Date.now() - global.bdlLastIpcLog > 2000) {
    global.bdlLastIpcLog = Date.now();
    console.log(`[IPC_LIVE_BAR] Broadcasted: ${msg.trim()}`);
  }

  ipcClients.forEach(client => {
    try {
      client.write(msg);
    } catch (e) {}
  });
});

const ipcServer = net.createServer((socket) => {
  ipcClients.add(socket);

  socket.setNoDelay(true) // Disable Nagle's algorithm for sub-millisecond tick latency
  socket.setKeepAlive(true, 15000)
  let socketBuffer = ''
  
  socket.on('error', (err) => {
    console.error('[IPC Error]', err.message)
  })
  
  socket.on('close', () => {
    // BUG #12 FIX: Remove socket from set to prevent memory leak and write errors on dead sockets
    ipcClients.delete(socket)
  })

  socket.on('data', async (data) => {
    try {
      socketBuffer += data.toString()
      const lines = socketBuffer.split('\n')
      socketBuffer = lines.pop() || ''

      for (const line of lines) {
        const msg = line.trim()
        if (msg.startsWith('GET_QUOTES')) {
          const parts = msg.split(' ')
          const ticker = parts[1]

          // Mark this symbol as STREAMING so the UI shows live status
          if (ticker) feedSimulator.setStreaming(ticker)


          let brokerId = ''
          const existing = stmts.getSymbols.all() as any[]
          const symRecord = existing.find(s => {
            const t = s.amiBrokerTicker || s.amibroker_ticker
            if (t !== ticker) return false
            const bId = s.brokerId || s.broker_id
            return brokerManager.getAdapter(bId) !== undefined
          }) || existing.find(s => s.amiBrokerTicker === ticker || s.amibroker_ticker === ticker)
          
          if (!symRecord) {
            socket.write('END\n')
            continue
          }
          brokerId = symRecord.brokerId || symRecord.broker_id

          // Fetch real historical data from memory/disk (zero parse CSV)
          let response = await stmts.getBarsCsvByTickerAsync.get(ticker, 100000)
          if (response.length > 0 && !response.endsWith('\n')) {
            response += '\n'
          }
          
          if (!backfilledTickers.has(ticker) && brokerId) {
            const settings = getAllSettings() as any
            const backfillDepth = Number(settings?.backfillDepthDays) || 365
            backfillQueue.enqueue(ticker, brokerId, symRecord.rawSymbol || symRecord.raw_symbol || symRecord.instrumentId || symRecord.instrument_id || ticker, backfillDepth)
          }

          // Append in-progress live bar if available and has a valid price
          const liveBar = feedSimulator.getLiveBar(ticker, brokerId)
          if (liveBar && liveBar.close > 0) {
            const ts = Math.floor(liveBar.bucketMs / 1000)
            response += `${ts},${liveBar.open},${liveBar.high},${liveBar.low},${liveBar.close},${liveBar.volume}\n`
          }

          if (response.length === 0) {
            socket.write('END\n')
            continue
          }


          socket.write(response + 'END\n')
        }
      }
    } catch (err) {
      console.error('[IPC Data Error]', err)
    }
  })
})
ipcServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[IPC] Port 7891 is already in use. Assuming another instance is running and exiting gracefully.`)
    process.exit(0)
  } else {
    console.error('[IPC Server Error]', err)
  }
})
ipcServer.listen(7891, '127.0.0.1', () => {
  console.log('[IPC] AmiBroker TCP Server listening on 127.0.0.1:7891')
})



// Hourly automatic log & memory rotation cron
setInterval(() => {
  try {
    const settings = getAllSettings() as any
    const retentionDays = Number(settings?.logRetentionDays) || 14
    rotateOldLogs(retentionDays)
  } catch (err) {
    console.error('[Cron Error] Failed to rotate old logs:', err)
  }
}, 60 * 60 * 1000)

export { app, server, wss, ipcServer }





