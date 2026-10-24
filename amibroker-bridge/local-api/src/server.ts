/**
 * DataBridge Pro — Local API Server
 * Express app + WebSocket server, bound to localhost:7890 only (§41, §57)
 * WebSocket pushes: feed_update, log_entry, broker_status, health_update,
 *                   backfill_progress, backfill_completed, backfill_failed, console_lines
 */
// MUST stay first: captures console output for the in-app Live Console (and the AI assistant)
import { consoleEvents, type ConsoleLine } from './services/ConsoleCapture'
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
import aiRouter from './routes/ai'
import { setRuntimeProbe } from './services/ai/AiAssistant'
import { autoRefresh } from './services/AutoRefresh'
import { morningBrief } from './services/ai/MorningBrief'
import { feedSimulator } from './services/feedSimulator'
import { getAllSettings, rotateOldLogs, stmts, flushPendingBars, upsertBarsToHistory, getLastBarTimestampSec, getOldestBarTimestampSec, syncCachesPromise } from './db'
import { backfillQueue } from './services/BackfillQueue'
import { backfilledTickers } from './shared/backfillState'
import { getVerifiedThroughMs } from './shared/coverageState'
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
app.use('/api/ai', aiRouter)

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

// ===== Live engine console → WebSocket (batched, the Live Console page renders these) =====
let pendingConsoleLines: ConsoleLine[] = []
let consoleFlushTimer: NodeJS.Timeout | null = null
consoleEvents.on('line', (line: ConsoleLine) => {
  if (wsClients.size === 0) return
  pendingConsoleLines.push(line)
  if (!consoleFlushTimer) {
    consoleFlushTimer = setTimeout(() => {
      consoleFlushTimer = null
      const lines = pendingConsoleLines
      pendingConsoleLines = []
      broadcast('console_lines', { lines })
    }, 250)
  }
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
import { activateBroker, openBrokerLogin, startPeriodicCatchUp } from './services/BrokerLifecycle'

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
autoRefresh.on('status', (payload) => broadcast('auto_refresh', payload))
morningBrief.on('status', (payload) => broadcast('morning_brief', payload))

// Auto-open the login page when the token dies while streaming (deduped per broker)
brokerManager.on('auth_required', (brokerId: string) => {
  openBrokerLogin(brokerId, 'Live stream token expired')
  broadcast('broker_status', { id: brokerId, status: 'auth_required' })
})

/** Runs `fn` over `items` with at most `limit` in flight. */
async function forEachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => { while (next < items.length) await fn(items[next++]) }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

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
      await upsertBarsToHistory(ticker, bars.map((b: any) => `${Math.floor(b.ts / 1000)},${b.open},${b.high},${b.low},${b.close},${b.volume}`))
      console.log(`[Init] Incremental update: added ${bars.length} bars for ${ticker} (today)`)
      notifyAmiBrokerHistoryChanged(ticker, Math.floor(bars[0].ts / 1000))
      broadcast('log_entry', { level: 'success', component: 'Backfill', message: `Added ${bars.length} bars for ${ticker} (today)` })
    } else {
      broadcast('log_entry', { level: 'warn', component: 'Backfill', message: `No bars returned for ${ticker} today.` })
    }
  } catch (e: any) {
    if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
      throw e // rethrow for rate limiting
    }
    if (e?.code === -300 || e?.message?.includes('Invalid symbol')) {
      console.error(`[Init] Invalid symbol (expired?): ${ticker}`)
      throw e
    }
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

    // Auto-connect real brokers using saved credentials. A working connection takes over the
    // symbol list, subscribes live ticks and queues the catch-up (missed days) — see
    // BrokerLifecycle. An expired token opens the login page once; the OAuth callback then
    // does the same activation, so the catch-up runs as soon as the user has logged in.
    const brokers = [...(stmts.getBrokers.all() as any[])]
    const needLogin: any[] = []
    for (const b of brokers) {
      if (!stmts.getBrokerById.get(b.id)) continue // merged into an account activated above
      const creds = stmts.getCredentials.get(b.id)
      if (!creds?.accessToken) continue
      console.log(`[Init] Auto-connecting broker ${b.id}...`)
      try {
        await brokerManager.connectBroker(b.id, b.broker_type, {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret || '',
          clientId: b.account_id || undefined,
          accessToken: creds.accessToken
        })
      } catch (err: any) {
        console.error(`[Init] Failed to auto-connect broker ${b.id}:`, err?.message || err)
        needLogin.push(b)
        continue
      }
      await activateBroker(b.id, b.broker_type)
    }
    // Only accounts still needed: one merged into a connected account needs no login
    for (const b of needLogin) {
      if (!stmts.getBrokerById.get(b.id)) continue
      openBrokerLogin(b.id, 'Saved token expired')
      broadcast('broker_status', { id: b.id, status: 'auth_required' })
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
      const started = Date.now()
      // Parallel; the broker adapter's shared rate limiter keeps requests within its limits
      await forEachLimit(allSyms, 6, async (sym: any) => {
        if ((sym.brokerId || sym.broker_id) === 'orphaned') return
        const brokerId = sym.brokerId || sym.broker_id
        const adapter = brokerManager.getAdapter(brokerId)
        if (!adapter) return
        const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
        try {
          await fetchTodayBars(adapter, ticker)
        } catch (e: any) {
          // 429s already pause the shared limiter; -300 already logged in fetchTodayBars — just skip
          if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
            console.warn(`[Init] Rate limit 429 hit during startup fetch for ${ticker}.`)
          }
        }
      })
      console.log(`[Init] Startup today-bar fetch complete in ${((Date.now() - started) / 1000).toFixed(1)}s.`)
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

      // Missing-bar checks run every 30 min and after sleep (startPeriodicCatchUp)
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
  initSimulator()
  startPeriodicCatchUp()
  // Automatic "Refresh All Today" while the market is open (settings are loaded by now)
  autoRefresh.start(notifyAmiBrokerHistoryChanged)
  morningBrief.start()
})

// ===== AmiBroker IPC TCP Server =====

declare global {
  var bdlLastIpcLog: number | undefined;
}

const ipcClients = new Set<net.Socket>()
setRuntimeProbe(() => ({ amibrokerConnections: ipcClients.size }))

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

// After gap-fill saves bars, trigger a debounced AmiBroker RefreshAll().
// This forces AmiBroker to pull the historical data correctly via the HTTP plugin 
// rather than pushing them as LIVE_BARs (which causes chart gaps).
let abRefreshTimeout: NodeJS.Timeout | null = null;

/**
 * Tell the AmiBroker plugin that new historical bars were stored for `ticker`, from `fromSec`
 * on when known ("SYNC|TICKER|fromSec"). The plugin re-fetches from there and merges the bars
 * in, also into the middle of its chart (a downtime hole), immediately for open charts,
 * otherwise the next time the symbol is viewed. Notices are coalesced per ticker for 1 s, so a
 * multi-chunk download sends one notice with the oldest start instead of one per chunk.
 */
const pendingSyncFrom = new Map<string, number>() // ticker -> oldest fromSec (0 = none given)
let syncFlushTimer: NodeJS.Timeout | null = null
function notifyAmiBrokerHistoryChanged(ticker: string, fromSec = 0) {
  // Keep the oldest start that was given: a notice without one ("recent bars changed") is
  // already covered by the plugin's default re-read of the last 24 h
  const prev = pendingSyncFrom.get(ticker) ?? 0
  pendingSyncFrom.set(ticker, prev && fromSec ? Math.min(prev, fromSec) : prev || fromSec)
  if (syncFlushTimer) return
  syncFlushTimer = setTimeout(() => {
    syncFlushTimer = null
    const batch = [...pendingSyncFrom]
    pendingSyncFrom.clear()
    const msg = batch.map(([t, from]) => (from > 0 ? `SYNC|${t}|${from}\n` : `SYNC|${t}\n`)).join('')
    ipcClients.forEach(client => {
      try { client.write(msg) } catch {}
    })
  }, 1000)
}

backfillQueue.on('bars_gap_filled', ({ ticker, fromSec }: { ticker: string, fromSec: number }) => {
  notifyAmiBrokerHistoryChanged(ticker, fromSec)
})

backfillQueue.on('backfill_completed', ({ ticker }: { ticker: string }) => {
  notifyAmiBrokerHistoryChanged(ticker)
  // Only refresh via COM when AmiBroker is running with our plugin connected —
  // COM activation would otherwise LAUNCH a hidden AmiBroker instance.
  if (ipcClients.size === 0) return
  console.log(`[IPC_GAP_PUSH] Backfill completed for ${ticker}. Scheduling AmiBroker refresh...`);

  if (abRefreshTimeout) clearTimeout(abRefreshTimeout);
  abRefreshTimeout = setTimeout(() => {
    if (ipcClients.size === 0) return
    console.log('[IPC_GAP_PUSH] Executing debounced AmiBroker RefreshAll()...');
    const psScript = `
      try {
        $ab = New-Object -ComObject Broker.Application
        $ab.RefreshAll()
      } catch { }
    `;
    require('child_process').exec(`powershell -Command "${psScript.replace(/\n/g, ';')}"`, () => {});
  }, 3000); // 3-second debounce
})


// Track last time we fired a connect-refresh so we don't spam it
let lastABConnectRefreshAt = 0

const ipcServer = net.createServer((socket) => {
  ipcClients.add(socket);

  socket.setNoDelay(true) // Disable Nagle's algorithm for sub-millisecond tick latency
  socket.setKeepAlive(true, 15000)
  let socketBuffer = ''

  // When AmiBroker (re)connects, trigger a RefreshAll() after a short delay.
  // This ensures AmiBroker pulls any bars that were backfilled while it was closed.
  const nowMs = Date.now()
  if (nowMs - lastABConnectRefreshAt > 30_000) { // at most once every 30 seconds
    lastABConnectRefreshAt = nowMs
    console.log('[IPC_CONNECT] AmiBroker connected — scheduling RefreshAll() in 5 seconds to sync backfilled data...')
    setTimeout(() => {
      if (ipcClients.size === 0) return // AmiBroker closed again; don't COM-launch it
      console.log('[IPC_CONNECT] Executing RefreshAll() for AmiBroker reconnect...')
      const psScript = `try { $ab = New-Object -ComObject Broker.Application; $ab.RefreshAll() } catch { }`
      require('child_process').exec(`powershell -Command "${psScript}"`, () => {})
    }, 5000)
  }

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
            // AUTO-REGISTER: Symbol not in DB but AmiBroker is requesting it.
            // This happens when user manually types a symbol directly in AmiBroker.
            // Find the first active broker and auto-add so streaming works.
            const activeBrokers = stmts.getBrokers.all() as any[]
            const activeBroker = activeBrokers.find((b: any) => brokerManager.getAdapter(b.id))
            if (activeBroker && ticker && ticker.trim().length >= 2) {
              const adapter = brokerManager.getAdapter(activeBroker.id)
              if (adapter) {
                console.log(`[IPC_AUTO_REG] AmiBroker requested unknown symbol "${ticker}" — auto-registering...`)
                try {
                  const resolvedToken = (adapter as any).resolveSymbol ? await (adapter as any).resolveSymbol(ticker) : ticker
                  const exchMatch = resolvedToken.match(/^([A-Z]+):/)
                  const exchange = exchMatch ? exchMatch[1] : 'NSE'
                  const instrType = /FUT|CE|PE/.test(resolvedToken) ? 'FUT' : 'EQ'

                  stmts.insertSymbol.run({
                    broker_id: activeBroker.id,
                    instrument_id: resolvedToken,
                    amibroker_ticker: ticker,
                    exchange,
                    instrument_type: instrType,
                    raw_symbol: resolvedToken,
                    created_at: Date.now(),
                  })

                  feedSimulator.addInstrument({
                    ticker, exchange: exchange as any, instrumentType: instrType as any,
                    basePrice: 0, volatility: 0, avgVolume: 0,
                    brokerId: activeBroker.id, brokerToken: resolvedToken,
                  })

                  await brokerManager.subscribe(activeBroker.id, [resolvedToken])

                  const settings = getAllSettings() as any
                  const backfillDepth = Number(settings?.backfillDepthDays) || 365
                  backfillQueue.enqueue(ticker, activeBroker.id, resolvedToken, backfillDepth)
                  console.log(`[IPC_AUTO_REG] "${ticker}" → "${resolvedToken}" registered, subscribed, backfill queued.`)
                } catch (autoRegErr) {
                  console.error(`[IPC_AUTO_REG] Failed to auto-register "${ticker}":`, autoRegErr)
                }
              }
            }
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

// ===== Parent watchdog =====
// The desktop app runs this engine as a hidden background process and passes its PID.
// If the app is killed (Task Manager, crash) shut down too instead of lingering invisibly.
const parentPid = Number(process.env.DATABRIDGE_PARENT_PID) || 0
if (parentPid > 0) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0)
    } catch (err: any) {
      if (err?.code === 'EPERM') return // process exists, just not signalable
      console.log('[Server] DataBridge Pro app is no longer running — stopping data engine.')
      process.exit(0)
    }
  }, 5000).unref()
}



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





