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
import type { AppSettings, ExchangeRegistry } from '../types'
import { EventEmitter } from 'events'
import { readBarsCsv, setReaderDbFile } from './reader'
import { startMaintenance, historyWritesAllowed, writesHeld, MAINTENANCE_ENABLED, BACKSTOP_CHECKPOINT_PAGES, JOURNAL_SIZE_LIMIT_BYTES } from './maintenance'
import { importFromPostgresIfNeeded } from './pgImport'
import { applyPendingRestore } from './restore'
import { isSealed, open, seal, secretsEncrypted } from '../lib/secretBox'
import { perf } from '../system/perf'

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
// A restore from a backup staged before the last restart is swapped in before anything opens the file
try {
  applyPendingRestore(DB_FILE, DatabaseSync)
} catch (err) {
  console.error('[Restore] Could not apply the backup; the current data is kept:', err)
}
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

  -- Daily bars from the broker for the years before 1-minute history starts (AmiBroker's mixed
  -- EOD/intraday mode). ts = the IST day's midnight, unix seconds; prices as in bars.
  CREATE TABLE IF NOT EXISTS daily_bars (
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

// The log's checkpoints run on a worker thread (maintenance.ts); this connection keeps an automatic one only
// as a last resort, far above the default 1,000 pages, so no commit of the engine's thread waits for the disk
if (MAINTENANCE_ENABLED) {
  sqlite.exec(`PRAGMA wal_autocheckpoint = ${BACKSTOP_CHECKPOINT_PAGES}; PRAGMA journal_size_limit = ${JOURNAL_SIZE_LIMIT_BYTES};`)
}
// Page cache of this connection in KiB (SQLite's default is 2,000: 2 MB). Only set for measuring.
const cacheKiB = Number(process.env.DATABRIDGE_SQLITE_CACHE_KIB)
if (cacheKiB > 0) sqlite.exec(`PRAGMA cache_size = -${Math.floor(cacheKiB)}`)

setReaderDbFile(DB_FILE)
startMaintenance(DB_FILE)

/**
 * What changed in the bars table, for whoever keeps a picture derived from it (the data health page):
 *   'changed' (ticker, fromSec, toSec)  bars were written between those minutes (unix seconds)
 *   'removed' (ticker)                  the ticker's bars were deleted
 *   'reset'                             everything was deleted or replaced
 * Emitted from here only: this module imports nothing from market/.
 */
export const barWrites = new EventEmitter()
barWrites.setMaxListeners(50)

/** Runs `fn` in one transaction (one disk commit for many rows). Not re-entrant. */
function tx<T>(fn: () => T): T {
  newTickers.length = 0
  sqlite.exec('BEGIN')
  try {
    const result = fn()
    sqlite.exec('COMMIT')
    return result
  } catch (err) {
    // Ids given out in here are undone with the rest: kept in the cache, the next new symbol would get the
    // same id and the bars of two symbols would end up under one
    for (const name of newTickers) tickerIds.delete(name)
    // A full disk makes SQLite roll back by itself; the second one then fails and would hide the reason
    try { sqlite.exec('ROLLBACK') } catch { /* already rolled back */ }
    throw err
  }
}
/** Tickers that got their id in the transaction in progress (see tx) */
const newTickers: string[] = []

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
  historyUseAllBrokers: true,
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
  // Open interest: a broker answer without it keeps what the bar had (from live ticks)
  upsertHistoryBar: sqlite.prepare(`
    INSERT INTO bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tid, ts) DO UPDATE SET
      open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume,
      oi = COALESCE(excluded.oi, bars.oi)
    WHERE (bars.open, bars.high, bars.low, bars.close, bars.volume, bars.oi) IS NOT
          (excluded.open, excluded.high, excluded.low, excluded.close, excluded.volume, COALESCE(excluded.oi, bars.oi))
  `),
  lastBarTs: sqlite.prepare('SELECT ts FROM bars WHERE tid = ? ORDER BY ts DESC LIMIT 1'),
  oldestBarTs: sqlite.prepare('SELECT ts FROM bars WHERE tid = ? ORDER BY ts ASC LIMIT 1'),
  deleteTickerBars: sqlite.prepare('DELETE FROM bars WHERE tid = ?'),
  deleteTickerDaily: sqlite.prepare('DELETE FROM daily_bars WHERE tid = ?'),
  upsertDailyBar: sqlite.prepare(`
    INSERT INTO daily_bars (tid, ts, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tid, ts) DO UPDATE SET
      open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume,
      oi = COALESCE(excluded.oi, daily_bars.oi)
  `),
  dailyBefore: sqlite.prepare('SELECT ts, open, high, low, close, volume FROM daily_bars WHERE tid = ? AND ts < ? ORDER BY ts'),
  oldestDailyTs: sqlite.prepare('SELECT ts FROM daily_bars WHERE tid = ? ORDER BY ts ASC LIMIT 1'),

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

const CREDENTIAL_COLUMNS = ['api_key', 'api_secret', 'access_token'] as const

function loadCaches() {
  // Credentials are encrypted on disk and plain only in memory; values saved by older
  // versions (plain text) are encrypted here, once
  brokersCache.length = 0
  let sealedNow = 0
  for (const row of sqlite.prepare('SELECT * FROM brokers ORDER BY created_at ASC').all() as any[]) {
    const plainOnDisk = CREDENTIAL_COLUMNS.some(c => row[c] && !isSealed(row[c]))
    for (const c of CREDENTIAL_COLUMNS) row[c] = open(row[c])
    if (plainOnDisk && secretsEncrypted()) {
      q.updateCredentials.run(seal(row.api_key), seal(row.api_secret), seal(row.access_token), row.id)
      sealedNow++
    }
    brokersCache.push(row)
  }
  if (sealedNow) console.log(`[Secrets] Encrypted the saved credentials of ${sealedNow} broker account(s)`)

  symbolsCache.length = 0
  for (const r of sqlite.prepare('SELECT * FROM symbols').all() as any[]) {
    symbolsCache.push({
      brokerId: r.broker_id, instrumentId: r.instrument_id,
      amiBrokerTicker: r.amibroker_ticker, exchange: r.exchange,
      instrumentType: r.instrument_type, rawSymbol: r.raw_symbol, createdAt: r.created_at,
    })
  }

  // Stored values are JSON text (true, 730, "C:\\AmiBroker", [..]) or, for a few single-key
  // writes, plain text (08:45). The cache holds real values, the same as during the session that
  // saved them; keeping the text made every setting a string after a restart, so a switch saved
  // off ("false") showed on, numbers stopped matching and paths gained quotes.
  for (const r of sqlite.prepare('SELECT * FROM settings').all() as any[]) {
    let value: unknown = r.value
    try { value = JSON.parse(r.value) } catch { /* plain text */ }
    settingsCache.set(r.key, value)
  }

  tickerIds.clear()
  for (const r of sqlite.prepare('SELECT id, name FROM tickers').all() as any[]) tickerIds.set(r.name, Number(r.id))
}
loadCaches()

async function syncCaches() {
  try {
    if (await importFromPostgresIfNeeded(sqlite)) { loadCaches(); barWrites.emit('reset') }
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
    newTickers.push(name)
  }
  return id
}

export function invalidateDiskBarsCache(_safeTicker: string) {
  // no-op: reads always come from the database
}

// Live bars are buffered and committed together every 2 s
const pendingBarsAppends = new Map<string, any[]>() // key: amibroker_ticker, value: bar objects

/**
 * When the database does not take writes (disk full, file locked by something else, a damaged file) the bars wait in
 * memory and are tried again, less and less often. From PENDING_WARN bars waiting it says so; from PENDING_LIMIT on,
 * the oldest are given up so memory does not grow without end, and each ticker's "verified through" mark is moved back
 * to them (barWrites 'lost'): the next gap pass finds those minutes missing and fetches them from the broker.
 */
const PENDING_WARN = 50_000
const PENDING_LIMIT = 500_000
/** After giving up, this share of the limit is kept (so it does not happen again at the next try) */
const PENDING_KEEP = 0.9
const FAILURE_LOG_EVERY_MS = 60_000
let liveFlushFailures = 0
let liveFlushRetryAt = 0
let lastFailureLogAt = 0
let warnedPending = false

/** Gives up the oldest waiting bars (about the same share of each ticker's) down to PENDING_KEEP of the limit; returns how many */
function giveUpOldestLiveBars(waiting: number): number {
  const excess = waiting - Math.floor(PENDING_LIMIT * PENDING_KEEP)
  const share = excess / waiting
  let dropped = 0
  for (const [ticker, bars] of pendingBarsAppends) {
    const k = Math.min(bars.length, Math.ceil(bars.length * share))
    if (k <= 0) continue
    const gone = bars.splice(0, k)
    dropped += k
    if (!bars.length) pendingBarsAppends.delete(ticker)
    let lo = Infinity, hi = 0
    for (const b of gone) { const ts = Math.floor(b.ts_utc_ms / 1000); if (ts < lo) lo = ts; if (ts > hi) hi = ts }
    barWrites.emit('lost', ticker, lo, hi)
  }
  perf.count('db.live_bars_dropped', dropped)
  return dropped
}

function flushLiveBars(force = false) {
  if (pendingBarsAppends.size === 0) return
  // The last try failed: not again at every call (a long backlog costs the engine's thread a lot to try)
  if (!force && Date.now() < liveFlushRetryAt) return
  const batch = new Map(pendingBarsAppends)
  pendingBarsAppends.clear()
  const startedAt = performance.now()
  let rows = 0
  try {
    const ranges: Array<[string, number, number]> = []
    tx(() => {
      for (const [ticker, bars] of batch) {
        const tid = tickerId(ticker)
        let lo = Infinity, hi = 0
        for (const b of bars) {
          const ts = Math.floor(b.ts_utc_ms / 1000)
          q.insertLiveBar.run(tid, ts, px(b.open), px(b.high), px(b.low), px(b.close), Math.round(b.volume || 0), b.open_interest == null ? null : Math.round(b.open_interest))
          if (ts < lo) lo = ts
          if (ts > hi) hi = ts
          rows++
        }
        if (hi > 0) ranges.push([ticker, lo, hi])
      }
    })
    for (const [ticker, lo, hi] of ranges) barWrites.emit('changed', ticker, lo, hi)
    perf.record('db.live_flush_ms', performance.now() - startedAt)
    perf.count('db.live_flush_rows', rows)
    if (liveFlushFailures > 0) {
      console.log(`[DB] Live bars are being saved again, after ${liveFlushFailures} failed attempt(s) (${rows} bars written)`)
      liveFlushFailures = 0; liveFlushRetryAt = 0; warnedPending = false
    }
  } catch (err) {
    liveFlushFailures++
    perf.count('db.live_flush_failures')
    liveFlushRetryAt = Date.now() + Math.min(2000 * 2 ** liveFlushFailures, 30_000)   // 4 s, 8 s, 16 s, then every 30 s
    for (const [ticker, bars] of batch) pendingBarsAppends.set(ticker, [...bars, ...(pendingBarsAppends.get(ticker) || [])])
    const waiting = pendingLiveBars()
    const dropped = waiting > PENDING_LIMIT ? giveUpOldestLiveBars(waiting) : 0
    if (waiting > PENDING_WARN && !warnedPending) {
      warnedPending = true
      console.warn(`[DB] ${waiting} live bars are waiting for the database (more than ${PENDING_WARN}): it is not taking writes. Check the disk space and that nothing else holds the file.`)
    }
    // Giving bars up is always said (it is rare: at most once per try); the failure itself once a minute
    if (dropped) console.error(`[DB] ${dropped} of the oldest waiting live bars were given up (more than ${PENDING_LIMIT} waiting): their minutes are fetched from the broker again once the database takes writes.`)
    if (Date.now() - lastFailureLogAt >= FAILURE_LOG_EVERY_MS) {
      lastFailureLogAt = Date.now()
      console.error(`[DB] Failed to write live bars (attempt ${liveFlushFailures}, ${pendingLiveBars()} waiting in memory, trying again in ${Math.round((liveFlushRetryAt - Date.now()) / 1000)} s):`, err)
    }
  }
}
setInterval(() => { if (!writesHeld()) flushLiveBars() }, 2000).unref()   // (held: db/maintenance.ts)

// Levels for /api/diagnostics/perf: how big the write-ahead log is and how many live bars wait to be committed
const pendingLiveBars = () => { let n = 0; for (const bars of pendingBarsAppends.values()) n += bars.length; return n }
if (perf.enabled) {
  setInterval(() => {
    perf.gauge('db.pending_live_bars', pendingLiveBars())
    fs.promises.stat(DB_FILE + '-wal').then(s => perf.gauge('db.wal_bytes', s.size), () => { /* no log file yet */ })
  }, 5000).unref()
}
perf.probe('db', () => {
  let walBytes = 0
  try { walBytes = fs.statSync(DB_FILE + '-wal').size } catch { /* no log file yet */ }
  return { walBytes, pendingLiveBars: pendingLiveBars() }
})

export function insertBarBatch(barsToInsert: any[]) {
  for (const bar of barsToInsert) {
    const ticker = bar.amibroker_ticker || bar.ticker
    if (!ticker) continue
    let existing = pendingBarsAppends.get(ticker)
    if (!existing) pendingBarsAppends.set(ticker, existing = [])
    existing.push(bar)
  }
}

/** A minute's broker bar is stored only once the minute ended at least this long ago */
const HISTORY_SETTLE_MS = 30_000

/** A broker history bar; `ts` is the minute's start in UTC ms */
export interface HistoryBar { ts: number; open: number; high: number; low: number; close: number; volume: number; openInterest?: number }

/** Oldest and newest bar time (unix seconds) of some history bars: the range a "history changed" notice covers */
export function historyRangeSec(bars: Array<{ ts: number }>): { fromSec: number; toSec: number } {
  let lo = Infinity, hi = 0
  for (const b of bars) { if (b.ts < lo) lo = b.ts; if (b.ts > hi) hi = b.ts }
  return { fromSec: Number.isFinite(lo) ? Math.floor(lo / 1000) : 0, toSec: Math.floor(hi / 1000) }
}

/**
 * Rows per history transaction. A 35,000-bar chunk in one transaction held the engine's one
 * thread for ~50 ms, and live ticks waited behind it; at 2,000 rows a slice takes ~2-3 ms and the
 * event loop gets a turn between slices.
 */
export const HISTORY_SLICE_ROWS = Math.max(1, Number(process.env.DATABRIDGE_HISTORY_SLICE_ROWS) || 2000)   // the variable is for measuring (a huge value: one transaction per chunk, as before)

/**
 * One history slice per turn of the event loop, however many chunks are being saved. Each chunk used to give the
 * loop a turn between its own slices (setImmediate), but six chunks saved at once ran their six slices in the same
 * turn, and a live tick (or the answer to AmiBroker) waited for all of them: 6 x 2 ms plus the parsing of the
 * answers. A chunk now takes a turn for each slice; the first slice of a quiet moment goes at once, the others queue
 * and are let go one a turn, in the order they asked.
 */
let sliceTurnTaken = false
const sliceTurnQueue: Array<() => void> = []
function takeSliceTurn(): Promise<void> {
  if (!sliceTurnTaken) { sliceTurnTaken = true; setImmediate(passSliceTurn); return Promise.resolve() }
  return new Promise<void>(resolve => sliceTurnQueue.push(resolve))
}
function passSliceTurn() {
  const next = sliceTurnQueue.shift()
  if (next) { setImmediate(passSliceTurn); next() }   // the turn stays taken: the next slice has this one
  else sliceTurnTaken = false
}

/**
 * Upserts broker history bars (bar objects, or "tsSec,open,high,low,close,volume" lines); returns
 * how many rows were inserted or actually changed. Broker history replaces bars built from live
 * ticks for the same minute (live inserts never overwrite history). The rows are committed in
 * slices of HISTORY_SLICE_ROWS with a turn for the event loop between them; they are independent,
 * so a caller that sees the promise reject can simply run it again. `work.syncMs` (optional)
 * collects the time this call held the thread without yielding.
 */
export async function upsertBarsToHistory(amibrokerTicker: string, bars: Array<HistoryBar | string>, work?: { syncMs: number }): Promise<number> {
  let syncStartedAt = performance.now()
  const endSyncPart = () => { if (work) work.syncMs += performance.now() - syncStartedAt }
  // Skip the still-forming minute, and one that ended only seconds ago: the broker's bar for it
  // can still be missing its last trades, and would replace the complete bar built from live
  // ticks (live inserts never overwrite history). Later passes write those minutes.
  const firstUnsettledSec = Math.floor((Date.now() - 60_000 - HISTORY_SETTLE_MS) / 60000) * 60 + 60
  // One row per minute (last wins). Bar objects are used as they are: turning a 23k-bar chunk
  // into text and back made several MB of garbage per chunk, which kept the engine's heap large.
  const byMinute = new Map<number, HistoryBar>()
  for (const item of bars) {
    let bar: HistoryBar
    if (typeof item === 'string') {
      const p = item.split(',')
      bar = { ts: Number(p[0]) * 1000, open: Number(p[1]), high: Number(p[2]), low: Number(p[3]), close: Number(p[4]), volume: Number(p[5]) }
    } else {
      bar = item
    }
    const tsSec = Math.floor(bar.ts / 1000)
    if (tsSec < firstUnsettledSec) byMinute.set(tsSec, bar)
  }
  if (byMinute.size === 0) { endSyncPart(); return 0 }

  const rows = [...byMinute]
  let changed = 0
  let lo = Infinity, hi = 0   // what has been committed so far
  try {
    for (let from = 0; from < rows.length; from += HISTORY_SLICE_ROWS) {
      endSyncPart()
      await takeSliceTurn()   // live ticks, timers and requests get their turns in between
      const held = historyWritesAllowed()   // the checkpoint worker is copying the end of the log (db/maintenance.ts)
      if (held) await held
      syncStartedAt = performance.now()
      const startedAt = performance.now()
      const end = Math.min(rows.length, from + HISTORY_SLICE_ROWS)
      changed += tx(() => {
        const tid = tickerId(amibrokerTicker)
        let sliceChanged = 0
        for (let i = from; i < end; i++) {
          const [tsSec, b] = rows[i]
          const oi = Number(b.openInterest)
          sliceChanged += Number(q.upsertHistoryBar.run(tid, tsSec, px(b.open), px(b.high), px(b.low), px(b.close), Math.round(Number(b.volume) || 0), oi > 0 ? Math.round(oi) : null).changes)
        }
        return sliceChanged
      })
      for (let i = from; i < end; i++) { const tsSec = rows[i][0]; if (tsSec < lo) lo = tsSec; if (tsSec > hi) hi = tsSec }
      perf.record('db.history_tx_ms', performance.now() - startedAt)
    }
  } finally {
    // Also when a later slice failed: run again, the slices that were saved change nothing and would not be announced
    if (changed > 0) barWrites.emit('changed', amibrokerTicker, lo, hi)
  }
  endSyncPart()
  perf.count('db.history_rows', rows.length)
  perf.count('db.history_changed', changed)
  return changed
}

// ===== Daily bars (years before the 1-minute history) =====
const IST_SEC = 19_800
const DAY_SEC = 86_400
/** Midnight (IST) of the IST day `utcSec` falls on, unix seconds */
const istDaySec = (utcSec: number) => Math.floor((utcSec + IST_SEC) / DAY_SEC) * DAY_SEC - IST_SEC

/**
 * Stores broker daily bars (any time of day the broker stamps them with: brokers use IST
 * midnight, UTC midnight or the session open, all the same IST day). Today and later are left
 * out: the current day comes from the 1-minute bars. Returns how many were written.
 */
export function upsertDailyBars(amibrokerTicker: string, bars: HistoryBar[]): number {
  const today = istDaySec(Date.now() / 1000)
  const byDay = new Map<number, HistoryBar>()
  for (const b of bars) {
    const day = istDaySec(Math.floor(b.ts / 1000))
    if (day < today && validateBar(b.open, b.high, b.low, b.close, Number(b.volume) || 0)) byDay.set(day, b)
  }
  if (byDay.size === 0) return 0
  return tx(() => {
    const tid = tickerId(amibrokerTicker)
    for (const [day, b] of byDay) {
      const oi = Number(b.openInterest)
      q.upsertDailyBar.run(tid, day, px(b.open), px(b.high), px(b.low), px(b.close), Math.round(Number(b.volume) || 0), oi > 0 ? Math.round(oi) : null)
    }
    return byDay.size
  })
}

/** Daily bars of the IST days before the day of `beforeSec`, "tsSec,o,h,l,c,v" lines ascending */
export function dailyCsvBefore(amibrokerTicker: string, beforeSec: number): string {
  const tid = tickerIds.get(amibrokerTicker)
  if (tid === undefined) return ''
  const rows = q.dailyBefore.all(tid, istDaySec(beforeSec)) as any[]
  return rows.map(r => `${r.ts},${r.open / PRICE_SCALE},${r.high / PRICE_SCALE},${r.low / PRICE_SCALE},${r.close / PRICE_SCALE},${r.volume ?? 0}`).join('\n')
}

/** Oldest stored daily bar (unix seconds), 0 when there is none */
export function getOldestDailyTimestampSec(amibrokerTicker: string): number {
  const tid = tickerIds.get(amibrokerTicker)
  if (tid === undefined) return 0
  return Number((q.oldestDailyTs.get(tid) as any)?.ts ?? 0)
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
setInterval(() => { if (!writesHeld()) flushLogs() }, 1000).unref()   // (held: db/maintenance.ts)

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
      q.updateCredentials.run(seal(n(creds.apiKey)), seal(n(creds.apiSecret)), seal(n(creds.accessToken)), id)
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
  /**
   * Saves many symbols in one transaction (an import of hundreds is one commit, not one each) and updates the
   * cache through an index, so it stays linear. Same result as insertSymbol.run for each. A failure of the
   * batch (one bad row) falls back to one at a time, so the good rows are still saved.
   */
  insertSymbols: {
    run: (rows: Array<{ broker_id: string; instrument_id: string; amibroker_ticker: string; exchange: string; instrument_type: string; raw_symbol: string; created_at: number }>) => {
      if (!rows.length) return
      try {
        tx(() => { for (const s of rows) q.upsertSymbol.run(s.broker_id, n(s.instrument_id), s.amibroker_ticker, n(s.exchange), n(s.instrument_type), n(s.raw_symbol), n(s.created_at)) })
      } catch (err) {
        console.error('[DB] Could not save the symbols in one go, saving them one at a time:', err)
        for (const s of rows) stmts.insertSymbol.run(s)
        return
      }
      const at = new Map<string, number>()
      symbolsCache.forEach((sym, i) => at.set(`${sym.brokerId}\u0000${sym.amiBrokerTicker}`, i))
      for (const s of rows) {
        const key = `${s.broker_id}\u0000${s.amibroker_ticker}`
        const obj = { brokerId: s.broker_id, instrumentId: s.instrument_id, amiBrokerTicker: s.amibroker_ticker, exchange: s.exchange, instrumentType: s.instrument_type, rawSymbol: s.raw_symbol, createdAt: s.created_at }
        const idx = at.get(key)
        if (idx !== undefined) symbolsCache[idx] = { ...obj, instrumentId: symbolsCache[idx].instrumentId }
        else at.set(key, symbolsCache.push(obj) - 1)
      }
    }
  },
  deleteSymbol: {
    run: (brokerId: string, ticker: string) => {
      const idx = symbolsCache.findIndex(sym => sym.brokerId === brokerId && sym.amiBrokerTicker === ticker)
      if (idx !== -1) symbolsCache.splice(idx, 1)
      tx(() => {
        q.deleteSymbol.run(brokerId, ticker)
        const tid = tickerIds.get(ticker)
        if (tid !== undefined) { q.deleteTickerBars.run(tid); q.deleteTickerDaily.run(tid) }
      })
      barWrites.emit('removed', ticker)
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
        flushLiveBars()   // a minute closed a moment ago is in the answer, not only in the write buffer
        return await readBarsCsv(amibrokerTicker, 0, limit)
      } catch (err) {
        console.error('[DB] Failed to get bars CSV:', err)
        return ''
      }
    }
  },

  // Bars strictly newer than `sinceSec` (newest `limit` of them), ascending CSV; with `untilSec` (> 0), none newer than that
  getBarsCsvSinceAsync: {
    get: async (amibrokerTicker: string, sinceSec: number, limit: number = 50000, untilSec: number = 0): Promise<string> => {
      try {
        flushLiveBars()
        return await readBarsCsv(amibrokerTicker, Math.floor(sinceSec), limit, Math.floor(untilSec))
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
  sqlite.exec('DELETE FROM symbols; DELETE FROM bars; DELETE FROM daily_bars; DELETE FROM tickers; DELETE FROM logs; DELETE FROM connection_events;')
  symbolsCache.length = 0
  tickerIds.clear()
  barWrites.emit('reset')
}

/** Factory reset: every table. */
export function fullForceClean() {
  pendingBarsAppends.clear()
  pendingLogs.length = 0
  sqlite.exec('DELETE FROM symbols; DELETE FROM bars; DELETE FROM daily_bars; DELETE FROM tickers; DELETE FROM brokers; DELETE FROM settings; DELETE FROM logs; DELETE FROM connection_events;')
  brokersCache.length = 0
  symbolsCache.length = 0
  tickerIds.clear()
  barWrites.emit('reset')
  settingsCache.clear()
  for (const [k, v] of Object.entries(defaultSettings)) settingsCache.set(k, v)
}

export function deduplicateAndCompactDiskBars(_ticker: string) {
  // The (tid, ts) primary key dedupes. History is never pruned here: an old version deleted
  // everything older than 365 days, which wiped multi-year downloads.
}

/** Writes buffered live bars and logs now (normally every 1–2 s). */
export function flushPendingBars(force = false) {
  flushLiveBars(force)
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
  try { flushPendingBars(true) } catch {}   // one last try, however recent the last one was
  // Copy what the log holds into the database file if nothing is reading (never waits: PASSIVE), so the
  // next start does not have to replay a log of up to 80 MB
  if (MAINTENANCE_ENABLED) { try { sqlite.exec('PRAGMA wal_checkpoint(PASSIVE)') } catch {} }
  try { sqlite.close() } catch {}
}
process.on('exit', closeDb)
process.on('SIGTERM', () => { closeDb(); process.exit(0) })
process.on('SIGINT', () => { closeDb(); process.exit(0) })
