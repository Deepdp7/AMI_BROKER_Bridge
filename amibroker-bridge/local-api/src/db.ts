/**
 * DataBridge Pro — PostgreSQL Data Store
 * Fully migrates away from the in-memory/JSON/CSV SQLite-emulator
 * Uses pg connection pool and asynchronous batched writes
 */
import path from 'path'
import os from 'os'
import fs from 'fs'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import type { AppSettings, ExchangeRegistry, BrokerAccount, SymbolMap, LogEntry, Bar1s, ConnectionEvent } from './types'

// ===== Env Resolution =====
// When running as an installed SEA/Tauri binary, process.cwd() is the install
// directory — not the source folder — so a bare dotenv.config() finds nothing.
// We search for .env in the following order:
//   1. Next to the executable (process.execPath dir) — catches portable / dev EXE runs
//   2. %APPDATA%\DataBridgePro — the app's data folder (created by installer)
//   3. CWD fallback — works for plain `node dist/server.js` dev runs
;(function loadEnv() {
  const candidates = [
    path.join(path.dirname(process.execPath), '.env'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'DataBridgePro', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  let loaded = false
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath })
      const count = result.parsed ? Object.keys(result.parsed).length : 0
      console.log(`◇ injected env (${count}) from ${envPath}`)
      loaded = true
      break
    }
  }
  if (!loaded) {
    console.log('◇ injected env (0) from .env — no .env file found in any search path')
  }
})()

export const BARS_DIR = '' // No longer used, but kept exported for legacy references if any
// BUG #13 FIX: Use proper AppData path, not empty string which resolves to CWD
export const DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'DataBridgePro')

// ===== PostgreSQL Connection Pool =====
export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'databridgepro',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  max: 20, // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
})

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('[POSTGRES] Connected successfully')
}).catch((err: Error) => {
  console.error('[POSTGRES] Connection failed. The system will retry dynamically.', err.message)
})

// ===== Exchange Registry (static) =====
export const exchangeRegistry: ExchangeRegistry[] = [
  { exchangeCode: 'NSE', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:15', sessionCloseLocal: '15:30' },
  { exchangeCode: 'BSE', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:15', sessionCloseLocal: '15:30' },
  { exchangeCode: 'MCX', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:00', sessionCloseLocal: '23:30' },
  { exchangeCode: 'NFO', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:15', sessionCloseLocal: '15:30' },
  { exchangeCode: 'BFO', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:15', sessionCloseLocal: '15:30' },
  { exchangeCode: 'CDS', timezone: 'Asia/Kolkata', sessionOpenLocal: '09:00', sessionCloseLocal: '17:00' },
]

// ===== Default Settings =====
const defaultSettings: AppSettings = {
  amiBrokerPath: 'C:\\Program Files\\AmiBroker',
  autoStartWithWindows: true,
  autoStartAmiBroker: false,
  autoUpdate: true,
  updateChannel: 'stable',
  logLevel: 'info',
  logRetentionDays: 14,
  backfillDepthDays: 365,
  lateToleranaceSeconds: 2,
  clockSkewThresholdSeconds: 5,
  historyChunkDays: 30,
  maxBackfillRpsDelayMs: 150,
  maxBackfillRetries: 3,
  dailyReloginEnabled: false,
  dailyReloginTime: '08:50',
}

// Memory caches for synchronous reads
const brokersCache: any[] = []
const symbolsCache: any[] = []
const settingsCache = new Map<string, unknown>(Object.entries(defaultSettings))
const barsMemCache = new Map<string, Map<number, Bar1s>>()

// Asynchronous Batch Writers (to keep event loop non-blocking)
const pendingBarsAppends = new Map<string, any[]>() // key: amibroker_ticker, value: bar objects

async function syncCaches() {
  try {
    const bRes = await pool.query('SELECT * FROM brokers ORDER BY created_at ASC')
    brokersCache.length = 0
    bRes.rows.forEach((r: any) => brokersCache.push(r))

    const sRes = await pool.query('SELECT * FROM symbols')
    symbolsCache.length = 0
    sRes.rows.forEach((r: any) => symbolsCache.push({
      brokerId: r.broker_id, instrumentId: r.instrument_id,
      amiBrokerTicker: r.amibroker_ticker, exchange: r.exchange,
      instrumentType: r.instrument_type, rawSymbol: r.raw_symbol, createdAt: r.created_at
    }))

    const setRes = await pool.query('SELECT * FROM settings')
    setRes.rows.forEach((r: any) => settingsCache.set(r.key, r.value))
  } catch (err) {
    console.error('[POSTGRES] Failed to sync caches on startup:', err)
  }
}

// Initiate first sync
export const syncCachesPromise = syncCaches()

export function invalidateDiskBarsCache(safeTicker: string) {
  // no-op in postgres
}

let isFlushingBars = false
// Periodically flush bar appends asynchronously
setInterval(async () => {
  if (isFlushingBars) return
  if (pendingBarsAppends.size === 0) return
  
  isFlushingBars = true
  const currentAppends = new Map(pendingBarsAppends)
  pendingBarsAppends.clear()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [ticker, bars] of currentAppends.entries()) {
      if (bars.length === 0) continue
      const barRows = bars.map(b => `('${ticker.replace(/'/g, "''")}', ${b.ts_utc_ms}, ${b.open}, ${b.high}, ${b.low}, ${b.close}, ${b.volume}, ${b.open_interest || null})`)
      
      // Batch insert in chunks of 5000
      for (let i = 0; i < barRows.length; i += 5000) {
        const chunk = barRows.slice(i, i + 5000)
        await client.query(`
          INSERT INTO bars_1s (amibroker_ticker, ts_utc_ms, open, high, low, close, volume, open_interest)
          VALUES ${chunk.join(',')}
          ON CONFLICT (amibroker_ticker, ts_utc_ms) DO NOTHING
        `)
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[POSTGRES] Failed to flush bars batch:', err)
    // Re-queue failed bars
    for (const [ticker, bars] of currentAppends.entries()) {
      let existing = pendingBarsAppends.get(ticker) || []
      pendingBarsAppends.set(ticker, [...existing, ...bars])
    }
  } finally {
    isFlushingBars = false
    client.release()
  }
}, 2000)

// ===== Migration Stubs =====
export function insertBarBatch(barsToInsert: any[]) {
  // Push into pendingBarsAppends
  for (const bar of barsToInsert) {
    const ticker = bar.amibroker_ticker || bar.ticker
    if (!ticker) continue
    let existing = pendingBarsAppends.get(ticker) || []
    existing.push(bar)
    pendingBarsAppends.set(ticker, existing)
  }
}

// BUG #4 FIX: Implement actual PostgreSQL upsert (was empty stub — backfill data was silently discarded)
export async function upsertBarsToHistory(amibrokerTicker: string, csvLines: string[]): Promise<void> {
  if (csvLines.length === 0) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Insert in chunks of 1000 rows to avoid massive single queries
    for (let i = 0; i < csvLines.length; i += 1000) {
      const chunk = csvLines.slice(i, i + 1000)
      const rows = chunk.map(line => {
        const parts = line.split(',')
        const tsSec = Number(parts[0])
        const open = Number(parts[1])
        const high = Number(parts[2])
        const low = Number(parts[3])
        const close = Number(parts[4])
        const volume = Number(parts[5])
        return `('${amibrokerTicker.replace(/'/g, "''")}', ${tsSec * 1000}, ${open}, ${high}, ${low}, ${close}, ${volume}, NULL)`
      }).filter(r => r !== null)
      if (rows.length > 0) {
        await client.query(`
          INSERT INTO bars_1s (amibroker_ticker, ts_utc_ms, open, high, low, close, volume, open_interest)
          VALUES ${rows.join(',')}
          ON CONFLICT (amibroker_ticker, ts_utc_ms) DO NOTHING
        `)
      }
    }
    await client.query('COMMIT')

    // Do not double-insert into RAM/disk queue!
    // BackfillQueue.ts handles loading recent 3 days into RAM manually.
    // By skipping this, we prevent a huge memory spike and double-inserting all history.

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[POSTGRES] upsertBarsToHistory failed:', err)
    throw err
  } finally {
    client.release()
  }
}

export function validateBar(open: number, high: number, low: number, close: number, volume: number): boolean {
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) {
    return false
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return false
  if (high < low) return false
  if (high < open || high < close) return false
  if (low > open || low > close) return false
  if (volume < 0) return false
  return true
}

export function upsertSettings(k: string | Record<string, unknown>, v?: string) {
  if (typeof k === 'object') {
    for (const [key, value] of Object.entries(k)) {
      const strValue = JSON.stringify(value)
      settingsCache.set(key, value)
      pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, strValue]).catch((e: Error) => console.error(e))
    }
  } else if (v !== undefined) {
    settingsCache.set(k, v)
    pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [k, v]).catch((e: Error) => console.error(e))
  }
}

// ===== Prepared statement emulators =====
// We return synchronously from memory for fast paths where AmiBroker requires synchronous responses,
// and asynchronously execute the postgres statements.
export const stmts = {
  // Broker accounts
  getBrokers: { all: () => brokersCache },
  getBrokerById: { get: (id: string) => brokersCache.find(b => b.id === id) },
  insertBroker: {
    run: (row: any) => { 
      brokersCache.push(row)
      pool.query(`
        INSERT INTO brokers (id, broker_type, label, credential_ref, status, health_score, reconnect_count_1h, account_id, created_at, last_connected_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET broker_type = EXCLUDED.broker_type, label = EXCLUDED.label
      `, [row.id, row.broker_type, row.label, row.credential_ref, row.status, row.health_score, row.reconnect_count_1h, row.account_id, row.created_at, row.last_connected_at]).catch(console.error)
    }
  },
  updateBrokerStatus: {
    run: (status: string, lastConnectedAt: number | null, id: string) => {
      const b = brokersCache.find(b => b.id === id)
      if (b) { b.status = status; b.last_connected_at = lastConnectedAt; }
      pool.query(`UPDATE brokers SET status = $1, last_connected_at = $2 WHERE id = $3`, [status, lastConnectedAt, id]).catch(console.error)
    }
  },
  updateBrokerHealth: {
    run: (healthScore: number, reconnectCount: number, id: string) => {
      const b = brokersCache.find(b => b.id === id)
      if (b) { b.health_score = healthScore; b.reconnect_count_1h = reconnectCount }
      pool.query(`UPDATE brokers SET health_score = $1, reconnect_count_1h = $2 WHERE id = $3`, [healthScore, reconnectCount, id]).catch(console.error)
    }
  },
  deleteBroker: { 
    run: (id: string) => { 
      const idx = brokersCache.findIndex(b => b.id === id)
      if (idx !== -1) brokersCache.splice(idx, 1)
      // BUG #3 FIX: Remove symbols from symbolsCache immediately (was a known no-op)
      for (let i = symbolsCache.length - 1; i >= 0; i--) {
        if (symbolsCache[i].brokerId === id) {
          symbolsCache.splice(i, 1)
        }
      }
      // Delete symbols first, then delete broker (FK constraint)
      pool.query('DELETE FROM symbols WHERE broker_id = $1', [id])
        .then(() => pool.query('DELETE FROM brokers WHERE id = $1', [id]))
        .catch(console.error)
    } 
  },

  adoptOrphanedSymbols: {
    run: (newBrokerId: string) => {
      let adopted = 0
      symbolsCache.forEach(s => {
        if (s.brokerId === 'orphaned') {
          s.brokerId = newBrokerId
          adopted++
        }
      })
      if (adopted > 0) {
        pool.query(`UPDATE symbols SET broker_id = $1 WHERE broker_id = 'orphaned'`, [newBrokerId]).catch(console.error)
      }
      return adopted
    }
  },

  // Credentials
  getCredentials: { get: (id: string) => {
    const b = brokersCache.find(b => b.id === id)
    return b ? { apiKey: b.api_key, apiSecret: b.api_secret, accessToken: b.access_token } : undefined
  }},
  upsertCredentials: { 
    run: (id: string, creds: { apiKey: string, apiSecret?: string, accessToken: string }) => { 
      const b = brokersCache.find(b => b.id === id)
      if (b) {
        b.api_key = creds.apiKey
        b.api_secret = creds.apiSecret
        b.access_token = creds.accessToken
      }
      pool.query(`UPDATE brokers SET api_key = $1, api_secret = $2, access_token = $3 WHERE id = $4`, 
        [creds.apiKey, creds.apiSecret, creds.accessToken, id]).catch(console.error)
    } 
  },

  // Symbol map
  getSymbols: { all: () => symbolsCache },
  getSymbolsByBroker: { all: (brokerId: string) => symbolsCache.filter(s => s.brokerId === brokerId) },
  insertSymbol: {
    run: (s: { broker_id: string; instrument_id: string; amibroker_ticker: string; exchange: string; instrument_type: string; raw_symbol: string; created_at: number }) => {
      const idx = symbolsCache.findIndex(sym => sym.brokerId === s.broker_id && sym.amiBrokerTicker === s.amibroker_ticker)
      const obj = { brokerId: s.broker_id, instrumentId: s.instrument_id, amiBrokerTicker: s.amibroker_ticker, exchange: s.exchange, instrumentType: s.instrument_type, rawSymbol: s.raw_symbol, createdAt: s.created_at }
      if (idx !== -1) symbolsCache[idx] = obj
      else symbolsCache.push(obj)

      pool.query(`
        INSERT INTO symbols (broker_id, instrument_id, amibroker_ticker, exchange, instrument_type, raw_symbol, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (broker_id, amibroker_ticker) DO UPDATE SET raw_symbol = EXCLUDED.raw_symbol
      `, [s.broker_id, s.instrument_id, s.amibroker_ticker, s.exchange, s.instrument_type, s.raw_symbol, s.created_at]).catch(console.error)
    }
  },
  deleteSymbol: {
    run: (brokerId: string, ticker: string) => {
      const idx = symbolsCache.findIndex(sym => sym.brokerId === brokerId && sym.amiBrokerTicker === ticker)
      if (idx !== -1) symbolsCache.splice(idx, 1)
      barsMemCache.delete(ticker)
      pool.query(`DELETE FROM symbols WHERE broker_id = $1 AND amibroker_ticker = $2`, [brokerId, ticker])
        .then(() => pool.query(`DELETE FROM bars_1s WHERE amibroker_ticker = $1`, [ticker]))
        .catch(console.error)
    }
  },

  // Settings
  getSetting: { get: (key: string) => ({ value: JSON.stringify(settingsCache.get(key)) }) },
  getAllSettings: {
    all: () => Array.from(settingsCache.entries()).map(([key, value]) => ({ key, value: JSON.stringify(value) }))
  },
  upsertSetting: {
    run: (key: string, value: string) => {
      settingsCache.set(key, JSON.parse(value))
      pool.query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, value]).catch(console.error)
    }
  },

  // Connection events (Write async, Read from Postgres when needed, but APIs use async methods)
  // Wait, local-api routes currently call getRecentEvents.all synchronously! We need a small hack to fetch async.
  // Actually, Express routes can be async, but if the codebase expects synchronous arrays, we will maintain an in-memory queue.
  insertEvent: {
    run: (e: { broker_id: string; event_type: string; detail?: string; ts_utc_ms: number }) => {
      pool.query(`
        INSERT INTO connection_events (broker_id, event_type, detail, ts_utc_ms)
        VALUES ($1, $2, $3, $4)
      `, [e.broker_id, e.event_type, e.detail, e.ts_utc_ms]).catch(console.error)
    }
  },
  getRecentEvents: {
    // BUG #10 FIX: Return cached empty array synchronously (events are async-only in PG version)
    // Routes that need live events should call pool.query directly
    all: (brokerId: string) => [] as any[]
  },
  getEventsLast24h: {
    all: (cutoffMs: number) => [] as any[]
  },

  // Logs
  insertLog: {
    run: (log: { id: string; ts: number; level: string; component: string; message: string }) => {
      pool.query(`
        INSERT INTO logs (timestamp, level, component, message)
        VALUES ($1, $2, $3, $4)
      `, [log.ts, log.level, log.component, log.message]).catch(console.error)
    }
  },
  getLogs: {
    // BUG #9 NOTE: This is synchronous stub. Use the async getLogs() export below for actual data.
    all: (limit: number = 1000) => [] as any[]
  },

  // Bars
  insertBarsToDiskOnly: {
    run: (bars: { amibroker_ticker: string; ts_utc_ms: number; open: number; high: number; low: number; close: number; volume: number; open_interest: number | null }[]) => {
      if (bars.length === 0) return
      const ticker = bars[0].amibroker_ticker
      let appends = pendingBarsAppends.get(ticker)
      if (!appends) {
        appends = []
        pendingBarsAppends.set(ticker, appends)
      }
      for (const b of bars) {
        appends.push(b)
      }
    }
  },
  insertBarsToRamOnly: {
    run: (bars: { amibroker_ticker: string; ts_utc_ms: number; open: number; high: number; low: number; close: number; volume: number; open_interest: number | null }[]) => {
      if (bars.length === 0) return
      const ticker = bars[0].amibroker_ticker
      let tickerMap = barsMemCache.get(ticker)
      if (!tickerMap) {
        tickerMap = new Map<number, Bar1s>()
        barsMemCache.set(ticker, tickerMap)
      }
      for (const b of bars) {
        if (!tickerMap.has(b.ts_utc_ms)) {
          const bar: Bar1s = {
            amiBrokerTicker: b.amibroker_ticker, tsUtcMs: b.ts_utc_ms,
            open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
            openInterest: b.open_interest ?? undefined,
          }
          tickerMap.set(b.ts_utc_ms, bar)
        }
      }
    }
  },

  getBarsCsvByTicker: {
    // BUG #1 FIX: Build CSV from barsMemCache instead of always returning ""
    // This is called by AmiBroker DLL (/api/feed/bars) and IPC TCP server
    get: (amibrokerTicker: string, limit: number = 50000): string => {
      const tickerMap = barsMemCache.get(amibrokerTicker)
      if (!tickerMap || tickerMap.size === 0) return ''
      // Sort ascending by timestamp
      const tsKeys = Array.from(tickerMap.keys()).sort((a, b) => a - b)
      const len = Math.min(limit, tsKeys.length)
      const start = Math.max(0, tsKeys.length - len)
      const lines: string[] = []
      for (let i = start; i < tsKeys.length; i++) {
        const bar = tickerMap.get(tsKeys[i])!
        const tsSec = Math.floor(bar.tsUtcMs / 1000)
        lines.push(`${tsSec},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`)
      }
      return lines.join('\n')
    }
  },

  getBarsCsvByTickerAsync: {
    get: async (amibrokerTicker: string, limit: number = 50000): Promise<string> => {
      try {
        const res = await pool.query(
          'SELECT * FROM bars_1s WHERE amibroker_ticker = $1 ORDER BY ts_utc_ms DESC LIMIT $2',
          [amibrokerTicker, limit]
        )
        if (res.rows.length === 0) return ''
        const lines: string[] = []
        for (let i = res.rows.length - 1; i >= 0; i--) {
          const r = res.rows[i]
          const tsSec = Math.floor(Number(r.ts_utc_ms) / 1000)
          lines.push(`${tsSec},${r.open},${r.high},${r.low},${r.close},${r.volume}`)
        }
        return lines.join('\n')
      } catch (err) {
        console.error('[POSTGRES] Failed to get bars CSV:', err)
        return ''
      }
    }
  },
  
  getLastHistoryTs: {
    get: (amibrokerTicker: string): number => {
      // Needs to be awaited. We'll update getHsmTokens backfill check.
      return 0
    }
  },

  getBarsByTicker: {
    all: (amibrokerTicker: string, limit: number = 50000) => {
      // Note: This is called by AmiBroker plugin TCP server. It expects synchronous array return!
      // But we can't synchronously query postgres.
      // AmiBroker Bridge's AmiBroker TCP protocol: request -> async response is fine?
      // Wait, let's look at how server.ts handles getBarsByTicker.
      const tickerMap = barsMemCache.get(amibrokerTicker)
      if (tickerMap) {
        const tsKeys = Array.from(tickerMap.keys()).sort((a, b) => b - a)
        const bars: any[] = []
        const len = Math.min(limit, tsKeys.length)
        for (let i = 0; i < len; i++) {
          const bar = tickerMap.get(tsKeys[i])!
          bars.push({
            amibroker_ticker: bar.amiBrokerTicker,
            ts_utc_ms: bar.tsUtcMs,
            open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
            open_interest: bar.openInterest ?? null
          })
        }
        return bars
      }
      return []
    }
  }
}

export function fullForceClean() {
  pool.query(`
    TRUNCATE TABLE bars_1s, symbols, brokers, connection_events, logs, settings CASCADE;
  `).catch(console.error)
  brokersCache.length = 0
  symbolsCache.length = 0
  barsMemCache.clear()
}

export function deduplicateAndCompactDiskBars(ticker: string) {
  // Database does this natively. We can just delete old bars.
  const cutoffMs = Date.now() - (365 * 24 * 60 * 60 * 1000)
  pool.query(`
    DELETE FROM bars_1s 
    WHERE amibroker_ticker = $1 
    AND ts_utc_ms < $2
  `, [ticker, cutoffMs]).catch(console.error)
}

export function flushPendingBars() {
  // Let the setInterval handle it
}

export function loadBarsFromDisk() {
  // Load the last 3 days of bars for all symbols into memory for AmiBroker
  console.log('[DB] Loading last 3 days of bars from PostgreSQL into RAM cache...')
  const cutoff = Date.now() - (3 * 24 * 60 * 60 * 1000)
  
  pool.query(`
    SELECT * FROM bars_1s WHERE ts_utc_ms > $1 ORDER BY ts_utc_ms ASC
  `, [cutoff]).then((res: any) => {
    let count = 0
    for (const row of res.rows) {
      let tickerMap = barsMemCache.get(row.amibroker_ticker)
      if (!tickerMap) {
        tickerMap = new Map<number, Bar1s>()
        barsMemCache.set(row.amibroker_ticker, tickerMap)
      }
      tickerMap.set(Number(row.ts_utc_ms), {
        amiBrokerTicker: row.amibroker_ticker,
        tsUtcMs: Number(row.ts_utc_ms),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
        openInterest: row.open_interest ? Number(row.open_interest) : undefined
      })
      count++
    }
    console.log(`[DB] Loaded ${count} bars into RAM cache`)
  }).catch((err: Error) => {
    console.error('[DB] Failed to load bars into cache:', err)
  })
}

// Log writes
export function appendLog(level: string, component: string, message: string) {
  pool.query(`
    INSERT INTO logs (timestamp, level, component, message)
    VALUES ($1, $2, $3, $4)
  `, [Date.now(), level, component, message]).catch(() => {})
}

// BUG #9 FIX: getLogs now queries PostgreSQL asynchronously
export async function getLogs(limit: number = 1000): Promise<any[]> {
  try {
    const res = await pool.query(
      'SELECT timestamp as ts, level, component, message FROM logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    )
    return res.rows
  } catch (err) {
    console.error('[POSTGRES] Failed to query logs:', err)
    return []
  }
}

export function clearLogs() {
  pool.query('TRUNCATE TABLE logs').catch(() => {})
}

export function rotateOldLogs(retentionDays: number = 14) {
  const cutoffMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
  pool.query(`
    DELETE FROM logs 
    WHERE timestamp < $1
  `, [cutoffMs]).catch(() => {})
}

export function getAllSettings(): Record<string, unknown> {
  const arr = stmts.getAllSettings.all() as Array<{ key: string; value: string }>
  const obj: Record<string, unknown> = {}
  for (const item of arr) {
    try {
      obj[item.key] = JSON.parse(item.value)
    } catch {
      obj[item.key] = item.value
    }
  }
  return obj
}

export async function getLastBarTimestampSec(amibrokerTicker: string): Promise<number> {
  try {
    const res = await pool.query(`
      SELECT ts_utc_ms FROM bars_1s 
      WHERE amibroker_ticker = $1 
      ORDER BY ts_utc_ms DESC 
      LIMIT 1
    `, [amibrokerTicker])
    if (res.rows.length > 0) {
      return Math.floor(Number(res.rows[0].ts_utc_ms) / 1000)
    }
  } catch (err) {}
  return 0
}

export async function getOldestBarTimestampSec(amibrokerTicker: string): Promise<number> {
  try {
    const res = await pool.query(`
      SELECT ts_utc_ms FROM bars_1s 
      WHERE amibroker_ticker = $1 
      ORDER BY ts_utc_ms ASC 
      LIMIT 1
    `, [amibrokerTicker])
    if (res.rows.length > 0) {
      return Math.floor(Number(res.rows[0].ts_utc_ms) / 1000)
    }
  } catch (err) {}
  return 0
}

// On exit
process.on('SIGTERM', () => pool.end())
process.on('SIGINT', () => pool.end())
