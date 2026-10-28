/**
 * dbReader.ts — heavy SQLite reads on worker threads
 *
 * SQLite calls are synchronous, so a multi-year chart load (hundreds of thousands of bars)
 * or a year-long gap scan would stall live ticks if run on the engine thread. These run on
 * two read-only connections in worker threads instead (WAL lets them read while the engine
 * writes).
 *
 * The worker is plain JavaScript passed as a string (eval), so it also runs from the single
 * packaged .exe, where there is no separate script file to point a Worker at.
 */
import { Worker } from 'worker_threads'

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('worker_threads')
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => { if (!/SQLite/.test(String((w && w.message) || w))) emitWarning.call(process, w, ...rest) }
const { DatabaseSync } = require('node:sqlite')
process.emitWarning = emitWarning

const db = new DatabaseSync(workerData.file, { readOnly: true })
db.exec('PRAGMA busy_timeout = 5000')
const S = 10000

const tidOf = db.prepare('SELECT id FROM tickers WHERE name = ?')
// %.12g: "2269.3", "10", "0.0025" (same text the PostgreSQL version produced, no "10.0")
const csvStmt = db.prepare(
  "SELECT group_concat(printf('%d,%.12g,%.12g,%.12g,%.12g,%d', ts, open / 10000.0, high / 10000.0, low / 10000.0, close / 10000.0, volume), char(10) ORDER BY ts) AS csv " +
  'FROM (SELECT * FROM bars WHERE tid = ? AND ts > ? ORDER BY ts DESC LIMIT ?)')
const gapPairs = db.prepare(
  'SELECT prev, ts FROM (SELECT ts, LAG(ts) OVER (ORDER BY ts) AS prev FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?) ' +
  'WHERE prev IS NOT NULL AND ts - prev > ? ORDER BY ts')
const bounds = db.prepare('SELECT MIN(ts) AS first, MAX(ts) AS last FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?')
const rangeRows = db.prepare('SELECT ts, open, high, low, close, volume FROM bars WHERE tid = ? AND ts >= ? ORDER BY ts')
const hiLo = db.prepare('SELECT MAX(high) AS hi, MIN(low) AS lo FROM bars WHERE tid = ? AND ts >= ?')
// Days (IST day number) with at least one bar, per ticker: data health in Symbol Setup
const dayRows = db.prepare(
  'SELECT t.name AS ticker, (b.ts + 19800) / 86400 AS d, COUNT(*) AS n FROM bars b JOIN tickers t ON t.id = b.tid ' +
  'WHERE b.ts >= ? GROUP BY b.tid, d')

const ops = {
  csv({ ticker, since, limit }) {
    const t = tidOf.get(ticker)
    return t ? (csvStmt.get(t.id, since, limit).csv || '') : ''
  },
  gaps({ ticker, fromSec, toSec, intervalSec }) {
    const t = tidOf.get(ticker)
    if (!t) return { pairs: [], firstSec: null, lastSec: null }
    const b = bounds.get(t.id, fromSec, toSec)
    return {
      pairs: gapPairs.all(t.id, fromSec, toSec, intervalSec).map(r => [r.prev, r.ts]),
      firstSec: b.first ?? null,
      lastSec: b.last ?? null,
    }
  },
  // OHLCV candles: buckets of bucketMs anchored at originMs, the newest 'count', ascending
  candles({ ticker, fromMs, bucketMs, originMs, count }) {
    const t = tidOf.get(ticker)
    if (!t) return []
    const out = []
    let cur = null
    for (const r of rangeRows.iterate(t.id, Math.floor(fromMs / 1000))) {
      const ms = r.ts * 1000
      const bucket = Math.floor((ms - originMs) / bucketMs) * bucketMs + originMs
      if (!cur || cur.t !== bucket) {
        cur = { t: bucket, open: r.open / S, high: r.high / S, low: r.low / S, close: r.close / S, volume: r.volume || 0 }
        out.push(cur)
        if (out.length > count) out.shift()
      } else {
        cur.high = Math.max(cur.high, r.high / S)
        cur.low = Math.min(cur.low, r.low / S)
        cur.close = r.close / S
        cur.volume += r.volume || 0
      }
    }
    return out
  },
  hiLo({ ticker, fromMs }) {
    const t = tidOf.get(ticker)
    if (!t) return { hi: null, lo: null }
    const r = hiLo.get(t.id, Math.floor(fromMs / 1000))
    return { hi: r.hi == null ? null : r.hi / S, lo: r.lo == null ? null : r.lo / S }
  },
  // A consistent, compacted copy of the whole database (Settings → Backup), made on this
  // read-only connection so the engine keeps writing meanwhile
  backupTo({ path }) {
    db.exec("VACUUM INTO '" + String(path).replace(/'/g, "''") + "'")
    return true
  },
  // Per ticker: the IST day numbers that have bars, and the bar count, since fromSec
  dayCounts({ fromSec }) {
    const out = {}
    for (const r of dayRows.iterate(fromSec)) {
      const e = out[r.ticker] || (out[r.ticker] = { days: [], bars: 0 })
      e.days.push(r.d)
      e.bars += r.n
    }
    return out
  },
}

parentPort.on('message', ({ id, op, args }) => {
  try {
    parentPort.postMessage({ id, result: ops[op](args) })
  } catch (err) {
    parentPort.postMessage({ id, error: String((err && err.message) || err) })
  }
})
`

type Op = 'csv' | 'gaps' | 'candles' | 'hiLo' | 'dayCounts' | 'backupTo'
interface Reader { worker: Worker; pending: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }> }

const READERS = 2
const readers: (Reader | null)[] = new Array(READERS).fill(null)
let dbFile = ''
let nextId = 1
let nextReader = 0

/** Called once by db.ts with the database path (after the schema exists). */
export function setReaderDbFile(file: string) {
  dbFile = file
}

function startReader(slot: number): Reader {
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { file: dbFile } })
  worker.unref()
  const reader: Reader = { worker, pending: new Map() }
  const fail = (err: Error) => {
    if (readers[slot] === reader) readers[slot] = null
    for (const p of reader.pending.values()) p.reject(err)
    reader.pending.clear()
  }
  worker.on('message', ({ id, result, error }) => {
    const p = reader.pending.get(id)
    if (!p) return
    reader.pending.delete(id)
    error ? p.reject(new Error(error)) : p.resolve(result)
  })
  worker.on('error', fail)
  worker.on('exit', code => fail(new Error(`database reader exited (${code})`)))
  readers[slot] = reader
  return reader
}

function call<T>(op: Op, args: object): Promise<T> {
  if (!dbFile) return Promise.reject(new Error('database reader not configured'))
  const slot = nextReader++ % READERS
  const reader = readers[slot] || startReader(slot)
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    reader.pending.set(id, { resolve, reject })
    reader.worker.postMessage({ id, op, args })
  })
}

/** "tsSec,open,high,low,close,volume" lines strictly newer than `sinceSec`: the newest `limit`, ascending. */
export function readBarsCsv(ticker: string, sinceSec: number, limit: number): Promise<string> {
  return call<string>('csv', { ticker, since: sinceSec, limit })
}

/** Adjacent stored bars more than `intervalSec` apart in [fromSec, toSec], plus the first/last bar there. */
export function readGapCandidates(ticker: string, fromSec: number, toSec: number, intervalSec: number) {
  return call<{ pairs: [number, number][]; firstSec: number | null; lastSec: number | null }>('gaps', { ticker, fromSec, toSec, intervalSec })
}

export function readCandles(ticker: string, fromMs: number, bucketMs: number, originMs: number, count: number) {
  return call<Array<{ t: number; open: number; high: number; low: number; close: number; volume: number }>>('candles', { ticker, fromMs, bucketMs, originMs, count })
}

export function readHighLow(ticker: string, fromMs: number) {
  return call<{ hi: number | null; lo: number | null }>('hiLo', { ticker, fromMs })
}

/** Writes a consistent copy of the database to `path` (which must not exist yet) */
export function backupDatabaseTo(path: string) {
  return call<boolean>('backupTo', { path })
}

/** Per ticker, the IST day numbers (days since 1970 in IST) that have bars since fromSec */
export function readDayCounts(fromSec: number) {
  return call<Record<string, { days: number[]; bars: number }>>('dayCounts', { fromSec })
}
