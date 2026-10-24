/**
 * DataBridge Pro — Local Data Store (SQLite)
 *
 * One file, %APPDATA%\DataBridgePro\databridge.db, through Node's built-in SQLite: nothing to
 * install on a client PC. Brokers, symbols and settings are cached in memory for the
 * synchronous fast paths and written through; bars live only on disk.
 *
 * bars: one row per ticker-minute, keyed (tid, ts) WITHOUT ROWID so a ticker's bars sit
 * together in time order. ts is unix seconds; prices are integers in 1/10000 units (exact for
 * exchange ticks, and about half the size of REAL). Roughly 40 bytes per bar on disk.
 *
 * Heavy reads (multi-year chart loads, gap scans, candles) run in reader worker threads —
 * see dbReader.ts — so live ticks never wait behind them. Writes stay here: one Fyers chunk
 * (~25k bars) commits in ~25 ms.
 *
 * Earlier versions stored everything in PostgreSQL; pgImport.ts copies that data over once.
 */
import path from 'path'
import os from 'os'
import fs from 'fs'
import dotenv from 'dotenv'
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite'
import type { AppSettings, ExchangeRegistry } from './types'
import { readBarsCsv, setReaderDbFile } from './dbReader'
import { importFromPostgresIfNeeded } from './pgImport'

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
export const DB_FILE = process.env.DATABRIDGE_DB_PATH || path.join(DATA_DIR, 'databridge.db')

/** Loads node:sqlite without its one-off "experimental feature" warning (it only confuses users). */
export function loadSqlite(): typeof import('node:sqlite') {
  const emitWarning = process.emitWarning
  process.emitWarning = ((w: any, ...rest: any[]) => {
    if (!/SQLite/.test(String(w?.message ?? w))) (emitWarning as any).call(process, w, ...rest)
  }) as typeof process.emitWarning
  try {
    return require('node:sqlite')
  } finally {
    process.emitWarning = emitWarning
  }
}

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
const { DatabaseSync } = loadSqlite()
export const sqlite: DatabaseSyncT = new DatabaseSync(DB_FILE)
// WAL: the reader workers read while this connection writes. NORMAL: no fsync per commit
// (an app crash loses nothing; a power cut can lose the last second of bars).
const SCHEMA = `
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;

  CREATE TABLE IF NOT EXISTS brokers (
    id TEXT PRIMARY KEY,
    broker_type TEXT,
    label TEXT,
    credential_ref TEXT,
    api_key TEXT,
    api_secret TEXT,
    access_token TEXT,
    status TEXT,
    health_score INTEGER,
    reconnect_count_1h INTEGER,
    account_id TEXT,
    created_at INTEGER,
    last_connected_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS symbols (
    instrument_id TEXT,
    broker_id TEXT,
    amibroker_ticker TEXT,
    exchange TEXT,
    instrument_type TEXT,
    raw_symbol TEXT,
    created_at INTEGER,
    PRIMARY KEY (instrument_id, broker_id),
    UNIQUE (broker_id, amibroker_ticker)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS connection_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broker_id TEXT,
    event_type TEXT,
    detail TEXT,
    ts_utc_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS connection_events_broker_ts ON connection_events (broker_id, ts_utc_ms);

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    level TEXT,
    component TEXT,
    message TEXT
  );
  CREATE INDEX IF NOT EXISTS logs_timestamp ON logs (timestamp);

  CREATE TABLE IF NOT EXISTS tickers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bars (
    tid INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    open INTEGER,
    high INTEGER,
    low INTEGER,
    close INTEGER,
    volume INTEGER,
    oi INTEGER,
    PRIMARY KEY (tid, ts)
  ) WITHOUT ROWID;
`

// Another engine process can hold the file for a moment (the desktop app restarting a crashed
// engine); switching to WAL then fails at once with "database is locked" instead of waiting
for (let attempt = 1; ; attempt++) {
  try {
    sqlite.exec(SCHEMA)
    break
  } catch (err: any) {
    if (!/locked|busy/i.test(String(err?.message)) || attempt >= 50) throw err
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200) // startup only: sleep 200 ms
  }
}

setReaderDbFile(DB_FILE)

/** Runs `fn` in one transaction (one disk commit for many rows). Not re-entrant. */
function tx<T>(fn: () => T): T {
  sqlite.exec('BEGIN')
  try {
    const result = fn()
    sqlite.exec('COMMIT')
    return result
  } catch (err) {
    sqlite.exec('ROLLBACK')
    throw err
  }
}

/** node:sqlite rejects `undefined` parameters */
const n = (v: unknown) => (v === undefined ? null : v) as any

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
const tickerIds = new Map<string, number>()

const q = {
  insertTicker: sqlite.prepare('INSERT OR IGNORE INTO tickers (name) VALUES (?)'),
  getTickerId: sqlite.prepare('SELECT id FROM tickers WHERE name = ?'),
  // Live-tick bars never overwrite broker history
  insertLiveBar: sqlite.prepare('INSERT OR IGNORE INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  // Broker history is authoritative; identical rows are skipped (no write, changes = 0)
  upsertHistoryBar: sqlite.prepare(`
    INSERT INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT (tid, ts) DO UPDATE SET
      open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume
    WHERE (open, high, low, close, volume) IS NOT (excluded.open, excluded.high, excluded.low, excluded.close, excluded.volume)
  `),
  lastBarTs: sqlite.prepare('SELECT ts FROM bars WHERE tid = ? ORDER BY ts DESC LIMIT 1'),
  oldestBarTs: sqlite.prepare('SELECT ts FROM bars WHERE tid = ? ORDER BY ts ASC LIMIT 1'),
  deleteTickerBars: sqlite.prepare('DELETE FROM bars WHERE tid = ?'),

  upsertBroker: sqlite.prepare(`
    INSERT INTO brokers (id, broker_type, label, credential_ref, status, health_score, reconnect_count_1h, account_id, created_at, last_connected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET broker_type = excluded.broker_type, label = excluded.label
  `),
  updateBrokerStatus: sqlite.prepare('UPDATE brokers SET status = ?, last_connected_at = ? WHERE id = ?'),
  updateBrokerHealth: sqlite.prepare('UPDATE brokers SET health_score = ?, reconnect_count_1h = ? WHERE id = ?'),
  updateCredentials: sqlite.prepare('UPDATE brokers SET api_key = ?, api_secret = ?, access_token = ? WHERE id = ?'),
  updateAccountId: sqlite.prepare('UPDATE brokers SET account_id = ? WHERE id = ?'),
  deleteBroker: sqlite.prepare('DELETE FROM brokers WHERE id = ?'),

  upsertSymbol: sqlite.prepare(`
    INSERT INTO symbols (broker_id, instrument_id, amibroker_ticker, exchange, instrument_type, raw_symbol, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (broker_id, amibroker_ticker) DO UPDATE SET raw_symbol = excluded.raw_symbol
  `),
  deleteSymbol: sqlite.prepare('DELETE FROM symbols WHERE broker_id = ? AND amibroker_ticker = ?'),
  deleteDuplicateSymbols: sqlite.prepare(`
    DELETE FROM symbols WHERE broker_id = ? AND EXISTS (
      SELECT 1 FROM symbols t WHERE t.broker_id = ?
        AND (t.amibroker_ticker = symbols.amibroker_ticker OR t.instrument_id = symbols.instrument_id))
  `),
  moveSymbols: sqlite.prepare('UPDATE symbols SET broker_id = ? WHERE broker_id = ?'),

  upsertSetting: sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),

  insertEvent: sqlite.prepare('INSERT INTO connection_events (broker_id, event_type, detail, ts_utc_ms) VALUES (?, ?, ?, ?)'),
  recentEvents: sqlite.prepare('SELECT * FROM connection_events WHERE broker_id = ? ORDER BY ts_utc_ms DESC LIMIT ?'),
  eventsSince: sqlite.prepare('SELECT * FROM connection_events WHERE ts_utc_ms > ?'),

  insertLog: sqlite.prepare('INSERT INTO logs (timestamp, level, component, message) VALUES (?, ?, ?, ?)'),
}

function loadCaches() {
  brokersCache.length = 0
  brokersCache.push(...(sqlite.prepare('SELECT * FROM brokers ORDER BY created_at ASC').all() as any[]))

  symbolsCache.length = 0
  for (const r of sqlite.prepare('SELECT * FROM symbols').all() as any[]) {
    symbolsCache.push({
      brokerId: r.broker_id, instrumentId: r.instrument_id,
      amiBrokerTicker: r.amibroker_ticker, exchange: r.exchange,
      instrumentType: r.instrument_type, rawSymbol: r.raw_symbol, createdAt: r.created_at,
    })
  }

  // Stored values are JSON text; callers parse them (getAllSettings) and coerce numbers
  for (const r of sqlite.prepare('SELECT * FROM settings').all() as any[]) settingsCache.set(r.key, r.value)

  tickerIds.clear()
  for (const r of sqlite.prepare('SELECT id, name FROM tickers').all() as any[]) tickerIds.set(r.name, Number(r.id))
}
loadCaches()

async function syncCaches() {
  try {
    if (await importFromPostgresIfNeeded(sqlite)) loadCaches()
  } catch (err) {
    console.error('[DB] PostgreSQL import failed (continuing with the local database):', err)
  }
}

// Resolves once older PostgreSQL data (if any) has been imported; callers await it before
// serving bars so AmiBroker never syncs from a half-imported database.
export const syncCachesPromise = syncCaches()

// ===== Bars =====
const PRICE_SCALE = 10000
const px = (p: number) => Math.round(p * PRICE_SCALE)

/** Ticker id, created on first write */
function tickerId(name: string): number {
  let id = tickerIds.get(name)
  if (id === undefined) {
    q.insertTicker.run(name)
    id = Number((q.getTickerId.get(name) as any).id)
    tickerIds.set(name, id)
  }
  return id
}

export function invalidateDiskBarsCache(_safeTicker: string) {
  // no-op: reads always come from the database
}

// Live bars are buffered and committed together every 2 s
const pendingBarsAppends = new Map<string, any[]>() // key: amibroker_ticker, value: bar objects

function flushLiveBars() {
  if (pendingBarsAppends.size === 0) return
  const batch = new Map(pendingBarsAppends)
  pendingBarsAppends.clear()
  try {
    tx(() => {
      for (const [ticker, bars] of batch) {
        const tid = tickerId(ticker)
        for (const b of bars) {
          q.insertLiveBar.run(tid, Math.floor(b.ts_utc_ms / 1000), px(b.open), px(b.high), px(b.low), px(b.close), Math.round(b.volume || 0), b.open_interest == null ? null : Math.round(b.open_interest))
        }
      }
    })
  } catch (err) {
    console.error('[DB] Failed to write live bars (will retry):', err)
    for (const [ticker, bars] of batch) pendingBarsAppends.set(ticker, [...bars, ...(pendingBarsAppends.get(ticker) || [])])
  }
}
setInterval(flushLiveBars, 2000).unref()

export function insertBarBatch(barsToInsert: any[]) {
  for (const bar of barsToInsert) {
    const ticker = bar.amibroker_ticker || bar.ticker
    if (!ticker) continue
    let existing = pendingBarsAppends.get(ticker)
    if (!existing) pendingBarsAppends.set(ticker, existing = [])
    existing.push(bar)
  }
}

/**
 * Upserts broker history bars ("tsSec,open,high,low,close,volume" lines); returns how many rows
 * were inserted or actually changed. Broker history replaces bars built from live ticks for
 * the same minute (live inserts never overwrite history).
 */
export async function upsertBarsToHistory(amibrokerTicker: string, csvLines: string[]): Promise<number> {
  // Skip the still-forming minute: a partial history bar would block the live bar for that
  // minute (live inserts never overwrite history), leaving it with partial volume.
  const currentMinuteSec = Math.floor(Date.now() / 60000) * 60
  // One row per minute (last wins)
  const byMinute = new Map<number, string[]>()
  for (const line of csvLines) {
    const p = line.split(',')
    const tsSec = Number(p[0])
    if (tsSec < currentMinuteSec) byMinute.set(tsSec, p)
  }
  if (byMinute.size === 0) return 0

  return tx(() => {
    const tid = tickerId(amibrokerTicker)
    let changed = 0
    for (const [tsSec, p] of byMinute) {
      changed += Number(q.upsertHistoryBar.run(tid, tsSec, px(Number(p[1])), px(Number(p[2])), px(Number(p[3])), px(Number(p[4])), Math.round(Number(p[5]) || 0)).changes)
    }
    return changed
  })
}

/**
 * Repairs broker bars whose high/low are inconsistent with open/close (Fyers' older
 * 1-minute history has whole days with high and low swapped): high/low become the
 * max/min of the four prices. Bars with missing or non-positive prices are left as-is
 * so validateBar still rejects them.
 */
export function repairBar<T extends { open: number; high: number; low: number; close: number }>(b: T): T {
  const { open, high, low, close } = b
  if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0)) return b
  const hi = Math.max(open, high, low, close)
  const lo = Math.min(open, high, low, close)
  return hi === high && lo === low ? b : { ...b, high: hi, low: lo }
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

export async function getLastBarTimestampSec(amibrokerTicker: string): Promise<number> {
  const tid = tickerIds.get(amibrokerTicker)
  if (tid === undefined) return 0
  const row = q.lastBarTs.get(tid) as any
  return row ? Number(row.ts) : 0
}

export async function getOldestBarTimestampSec(amibrokerTicker: string): Promise<number> {
  const tid = tickerIds.get(amibrokerTicker)
  if (tid === undefined) return 0
  const row = q.oldestBarTs.get(tid) as any
  return row ? Number(row.ts) : 0
}

// ===== Settings =====
export function upsertSettings(k: string | Record<string, unknown>, v?: string) {
  if (typeof k === 'object') {
    tx(() => {
      for (const [key, value] of Object.entries(k)) {
        settingsCache.set(key, value)
        q.upsertSetting.run(key, JSON.stringify(value))
      }
    })
  } else if (v !== undefined) {
    settingsCache.set(k, v)
    q.upsertSetting.run(k, v)
  }
}

// ===== Symbol ownership =====
/** broker_id of symbols whose broker was removed; the next broker that connects adopts them */
export const ORPHANED = 'orphaned'

function reassignSymbols(fromId: string, toId: string): Array<{ ticker: string; previousBrokerId: string; record: any }> {
  if (fromId === toId) return []
  const moved: Array<{ ticker: string; previousBrokerId: string; record: any }> = []
  tx(() => {
    q.deleteDuplicateSymbols.run(fromId, toId)
    q.moveSymbols.run(toId, fromId)
  })
  for (let i = symbolsCache.length - 1; i >= 0; i--) {
    const s = symbolsCache[i]
    if (s.brokerId !== fromId) continue
    // Target already tracks this ticker/instrument: keep its row, drop the duplicate
    const dup = symbolsCache.some(t => t.brokerId === toId && (t.amiBrokerTicker === s.amiBrokerTicker || t.instrumentId === s.instrumentId))
    if (dup) { symbolsCache.splice(i, 1); continue }
    s.brokerId = toId
    moved.push({ ticker: s.amiBrokerTicker, previousBrokerId: fromId, record: s })
  }
  return moved
}

// ===== Logs (buffered: the engine logs several lines a second during market hours) =====
const pendingLogs: Array<[number, string, string, string]> = []
function flushLogs() {
  if (pendingLogs.length === 0) return
  const batch = pendingLogs.splice(0)
  try {
    tx(() => { for (const l of batch) q.insertLog.run(...l) })
  } catch (err) {
    console.error('[DB] Failed to write logs:', err)
  }
}
setInterval(flushLogs, 1000).unref()

export function appendLog(level: string, component: string, message: string) {
  pendingLogs.push([Date.now(), level, component, message])
}

/** Most recent log rows, newest first (optionally filtered) */
export async function queryLogs(opts: { level?: string; component?: string; limit: number }): Promise<any[]> {
  flushLogs()
  let sql = 'SELECT * FROM logs WHERE 1=1'
  const params: any[] = []
  if (opts.level) { sql += ' AND level = ?'; params.push(opts.level) }
  if (opts.component) { sql += ' AND component = ?'; params.push(opts.component) }
  sql += ' ORDER BY timestamp DESC LIMIT ?'
  params.push(opts.limit)
  return sqlite.prepare(sql).all(...params) as any[]
}

export async function getLogs(limit: number = 1000): Promise<any[]> {
  flushLogs()
  return sqlite.prepare('SELECT timestamp AS ts, level, component, message FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit) as any[]
}

export function clearLogs() {
  pendingLogs.length = 0
  sqlite.exec('DELETE FROM logs')
}

export function rotateOldLogs(retentionDays: number = 14) {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  try {
    sqlite.prepare('DELETE FROM logs WHERE timestamp < ?').run(cutoffMs)
    sqlite.prepare('DELETE FROM connection_events WHERE ts_utc_ms < ?').run(cutoffMs)
  } catch (err) {
    console.error('[DB] Log rotation failed:', err)
  }
}

// ===== Prepared statement facade (synchronous where AmiBroker / the routes need it) =====
export const stmts = {
  // Broker accounts
  getBrokers: { all: () => brokersCache },
  getBrokerById: { get: (id: string) => brokersCache.find(b => b.id === id) },
  insertBroker: {
    run: (row: any) => {
      q.upsertBroker.run(row.id, n(row.broker_type), n(row.label), n(row.credential_ref), n(row.status), n(row.health_score), n(row.reconnect_count_1h), n(row.account_id), n(row.created_at), n(row.last_connected_at))
      const existing = brokersCache.find(b => b.id === row.id)
      if (existing) Object.assign(existing, { broker_type: row.broker_type, label: row.label })
      else brokersCache.push({ ...row })
    }
  },
  updateBrokerStatus: {
    run: (status: string, lastConnectedAt: number | null, id: string) => {
      const b = brokersCache.find(b => b.id === id)
      if (b) { b.status = status; b.last_connected_at = lastConnectedAt }
      q.updateBrokerStatus.run(status, n(lastConnectedAt), id)
    }
  },
  /** Broker's own account id: Kite user id, Dhan Client ID (Dhan needs it to log in and stream) */
  updateBrokerAccountId: {
    run: (accountId: string | null, id: string) => {
      const b = brokersCache.find(b => b.id === id)
      if (b) b.account_id = accountId
      q.updateAccountId.run(n(accountId), id)
    }
  },
  updateBrokerHealth: {
    run: (healthScore: number, reconnectCount: number, id: string) => {
      const b = brokersCache.find(b => b.id === id)
      if (b) { b.health_score = healthScore; b.reconnect_count_1h = reconnectCount }
      q.updateBrokerHealth.run(healthScore, reconnectCount, id)
    }
  },
  deleteBroker: {
    run: (id: string) => {
      const idx = brokersCache.findIndex(b => b.id === id)
      if (idx !== -1) brokersCache.splice(idx, 1)
      // The symbol list belongs to the user, not to one login: park it as 'orphaned' so the
      // next broker that connects adopts it (deleting it here wiped every symbol on re-login).
      reassignSymbols(id, ORPHANED)
      q.deleteBroker.run(id)
    }
  },

  /** Moves every symbol of `fromId` to `toId`; returns the moved records (with their previous broker id). */
  reassignSymbols: {
    run: (fromId: string, toId: string) => reassignSymbols(fromId, toId)
  },

  adoptOrphanedSymbols: {
    run: (newBrokerId: string) => reassignSymbols(ORPHANED, newBrokerId).length
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
      q.updateCredentials.run(n(creds.apiKey), n(creds.apiSecret), n(creds.accessToken), id)
    }
  },

  // Symbol map
  getSymbols: { all: () => symbolsCache },
  getSymbolsByBroker: { all: (brokerId: string) => symbolsCache.filter(s => s.brokerId === brokerId) },
  insertSymbol: {
    run: (s: { broker_id: string; instrument_id: string; amibroker_ticker: string; exchange: string; instrument_type: string; raw_symbol: string; created_at: number }) => {
      try {
        q.upsertSymbol.run(s.broker_id, n(s.instrument_id), s.amibroker_ticker, n(s.exchange), n(s.instrument_type), n(s.raw_symbol), n(s.created_at))
      } catch (err) {
        console.error(`[DB] Failed to save symbol ${s.amibroker_ticker}:`, err)
        return
      }
      const idx = symbolsCache.findIndex(sym => sym.brokerId === s.broker_id && sym.amiBrokerTicker === s.amibroker_ticker)
      const obj = { brokerId: s.broker_id, instrumentId: s.instrument_id, amiBrokerTicker: s.amibroker_ticker, exchange: s.exchange, instrumentType: s.instrument_type, rawSymbol: s.raw_symbol, createdAt: s.created_at }
      if (idx !== -1) symbolsCache[idx] = { ...obj, instrumentId: symbolsCache[idx].instrumentId }
      else symbolsCache.push(obj)
    }
  },
  deleteSymbol: {
    run: (brokerId: string, ticker: string) => {
      const idx = symbolsCache.findIndex(sym => sym.brokerId === brokerId && sym.amiBrokerTicker === ticker)
      if (idx !== -1) symbolsCache.splice(idx, 1)
      tx(() => {
        q.deleteSymbol.run(brokerId, ticker)
        const tid = tickerIds.get(ticker)
        if (tid !== undefined) q.deleteTickerBars.run(tid)
      })
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
      q.upsertSetting.run(key, value)
    }
  },

  // Connection events
  insertEvent: {
    run: (e: { broker_id: string; event_type: string; detail?: string; ts_utc_ms: number }) => {
      try { q.insertEvent.run(e.broker_id, e.event_type, n(e.detail), e.ts_utc_ms) } catch (err) { console.error('[DB] Failed to save event:', err) }
    }
  },
  getRecentEvents: {
    all: (brokerId: string, limit: number = 50) => q.recentEvents.all(brokerId, limit) as any[]
  },
  getEventsLast24h: {
    all: (cutoffMs: number) => q.eventsSince.all(cutoffMs) as any[]
  },

  // Logs
  insertLog: {
    run: (log: { id: string; ts: number; level: string; component: string; message: string }) => {
      pendingLogs.push([log.ts, log.level, log.component, log.message])
    }
  },
  getLogs: {
    // Synchronous stub kept for old callers; use getLogs() / queryLogs() for data
    all: (_limit: number = 1000) => [] as any[]
  },

  // Bars
  insertBarsToDiskOnly: {
    run: (bars: { amibroker_ticker: string; ts_utc_ms: number; open: number; high: number; low: number; close: number; volume: number; open_interest: number | null }[]) => {
      insertBarBatch(bars)
    }
  },

  // CSV for the AmiBroker plugin: "tsSec,open,high,low,close,volume" lines, newest `limit`
  // bars, ascending. Built inside SQLite in a reader worker.
  getBarsCsvByTickerAsync: {
    get: async (amibrokerTicker: string, limit: number = 50000): Promise<string> => {
      try {
        return await readBarsCsv(amibrokerTicker, 0, limit)
      } catch (err) {
        console.error('[DB] Failed to get bars CSV:', err)
        return ''
      }
    }
  },

  // Bars strictly newer than `sinceSec` (newest `limit` of them), ascending CSV
  getBarsCsvSinceAsync: {
    get: async (amibrokerTicker: string, sinceSec: number, limit: number = 50000): Promise<string> => {
      try {
        return await readBarsCsv(amibrokerTicker, Math.floor(sinceSec), limit)
      } catch (err) {
        console.error('[DB] Failed to get bars CSV since:', err)
        return ''
      }
    }
  },
}

/** Wipes symbols, history, mappings and logs (keeps broker logins and settings). */
export function cleanDatabase() {
  pendingBarsAppends.clear()
  pendingLogs.length = 0
  sqlite.exec('DELETE FROM symbols; DELETE FROM bars; DELETE FROM tickers; DELETE FROM logs; DELETE FROM connection_events;')
  symbolsCache.length = 0
  tickerIds.clear()
}

/** Factory reset: every table. */
export function fullForceClean() {
  pendingBarsAppends.clear()
  pendingLogs.length = 0
  sqlite.exec('DELETE FROM symbols; DELETE FROM bars; DELETE FROM tickers; DELETE FROM brokers; DELETE FROM settings; DELETE FROM logs; DELETE FROM connection_events;')
  brokersCache.length = 0
  symbolsCache.length = 0
  tickerIds.clear()
  settingsCache.clear()
  for (const [k, v] of Object.entries(defaultSettings)) settingsCache.set(k, v)
}

export function deduplicateAndCompactDiskBars(_ticker: string) {
  // The (tid, ts) primary key dedupes. History is never pruned here: an old version deleted
  // everything older than 365 days, which wiped multi-year downloads.
}

/** Writes buffered live bars and logs now (normally every 1–2 s). */
export function flushPendingBars() {
  flushLiveBars()
  flushLogs()
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

// On exit: commit what is buffered, then close the file cleanly
let closed = false
function closeDb() {
  if (closed) return
  closed = true
  try { flushPendingBars() } catch {}
  try { sqlite.close() } catch {}
}
process.on('exit', closeDb)
process.on('SIGTERM', () => { closeDb(); process.exit(0) })
process.on('SIGINT', () => { closeDb(); process.exit(0) })
