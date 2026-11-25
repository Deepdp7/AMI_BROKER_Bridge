/**
 * dbReader.ts — heavy SQLite reads on worker threads
 *
 * SQLite calls are synchronous, so a multi-year chart load (hundreds of thousands of bars)
 * or a year-long gap scan would stall live ticks if run on the engine thread. These run on
 * read-only connections in worker threads instead (WAL lets them read while the engine
 * writes).
 *
 * Two lanes, so work nobody is waiting for can never queue in front of a request AmiBroker is
 * waiting for: `interactive` (one worker) serves the plugin's history requests (/api/feed/bars);
 * `bulk` (two workers) serves everything else: data health, gap scans, candles, backups, exports.
 *
 * The worker is plain JavaScript passed as a string (eval), so it also runs from the single
 * packaged .exe, where there is no separate script file to point a Worker at.
 */
import { Worker } from 'worker_threads'
import { perf } from '../system/perf'

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('worker_threads')
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => { if (!/SQLite/.test(String((w && w.message) || w))) emitWarning.call(process, w, ...rest) }
const { DatabaseSync } = require('node:sqlite')
process.emitWarning = emitWarning

const db = new DatabaseSync(workerData.file, { readOnly: true })
db.exec('PRAGMA busy_timeout = 5000')
if (workerData.mmapBytes > 0) db.exec('PRAGMA mmap_size = ' + workerData.mmapBytes)
const S = 10000

const tidOf = db.prepare('SELECT id FROM tickers WHERE name = ?')
// History as CSV for the AmiBroker plugin: "ts,open,high,low,close,volume" lines, oldest first,
// F&O bars with open interest as a 7th value. Built here from the raw numbers: formatting each
// row in SQL (printf + group_concat) took ~80 ms for 100k bars, this ~65 ms, with the same text
// (prices are stored ×10000, so they have at most ~10 significant digits and print the same).
// "until" (inclusive) is for a catch-up of a known range (SYNC|ticker|from|to); without one it is far in the future
const rawBars = db.prepare('SELECT ts, open, high, low, close, volume, oi FROM bars WHERE tid = ? AND ts > ? AND ts <= ? ORDER BY ts DESC LIMIT ?')
if (typeof rawBars.setReturnArrays === 'function') rawBars.setReturnArrays(true)
const NO_END = 9e15
function barsCsv(tid, since, limit, until) {
  const rows = rawBars.all(tid, since, until, limit)
  const lines = new Array(rows.length)
  for (let i = rows.length - 1, j = 0; i >= 0; i--, j++) {
    const r = rows[i]
    const a = Array.isArray(r) ? r : [r.ts, r.open, r.high, r.low, r.close, r.volume, r.oi]
    lines[j] = a[0] + ',' + a[1] / S + ',' + a[2] / S + ',' + a[3] / S + ',' + a[4] / S + ',' + (a[5] ?? 0) + (a[6] > 0 ? ',' + a[6] : '')
  }
  return lines.join('\n')
}
const gapPairs = db.prepare(
  'SELECT prev, ts FROM (SELECT ts, LAG(ts) OVER (ORDER BY ts) AS prev FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?) ' +
  'WHERE prev IS NOT NULL AND ts - prev > ? ORDER BY ts')
const bounds = db.prepare('SELECT MIN(ts) AS first, MAX(ts) AS last FROM bars WHERE tid = ? AND ts >= ? AND ts <= ?')
const rangeRows = db.prepare('SELECT ts, open, high, low, close, volume FROM bars WHERE tid = ? AND ts >= ? ORDER BY ts')
const hiLo = db.prepare('SELECT MAX(high) AS hi, MIN(low) AS lo FROM bars WHERE tid = ? AND ts >= ?')
// Days (IST day number) with bars, and how many, in one ticker's time range: data health in Symbol Setup
// (a range of the primary key (tid, ts), so only that ticker's rows are read)
const dayRange = db.prepare('SELECT (ts + 19800) / 86400 AS d, COUNT(*) AS n FROM bars WHERE tid = ? AND ts >= ? AND ts < ? GROUP BY d')

const ops = {
  csv({ ticker, since, limit, until }) {
    const t = tidOf.get(ticker)
    return t ? barsCsv(t.id, since, limit, until > 0 ? until : NO_END) : ''
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
  // For each { ticker, fromSec, toSec } (toSec excluded): [[IST day number, bar count], ...] ascending; [] for an unknown ticker
  dayCountsRanges({ ranges }) {
    return ranges.map(r => {
      const t = tidOf.get(r.ticker)
      if (!t) return []
      return dayRange.all(t.id, r.fromSec, r.toSec).map(x => [x.d, x.n])
    })
  },
}

// startedAt / endedAt (unix ms; process.timeOrigin is shared, so every thread reads the same clock) say
// how long a request waited behind others and how long it ran
parentPort.on('message', ({ id, op, args }) => {
  const startedAt = performance.timeOrigin + performance.now()
  try {
    const result = ops[op](args)
    parentPort.postMessage({ id, result, startedAt, endedAt: performance.timeOrigin + performance.now() })
  } catch (err) {
    parentPort.postMessage({ id, error: String((err && err.message) || err), startedAt, endedAt: performance.timeOrigin + performance.now() })
  }
})
`

type Op = 'csv' | 'gaps' | 'candles' | 'hiLo' | 'dayCountsRanges' | 'backupTo'
export type Lane = 'interactive' | 'bulk'
/** Which lane an operation uses unless its caller says otherwise */
const DEFAULT_LANE: Record<Op, Lane> = { csv: 'interactive', gaps: 'bulk', candles: 'bulk', hiLo: 'bulk', dayCountsRanges: 'bulk', backupTo: 'bulk' }
interface Pending { resolve: (v: any) => void; reject: (e: Error) => void; op: Op; sentAt: number }
interface Reader { worker: Worker; pending: Map<number, Pending> }

const epochNow = () => performance.timeOrigin + performance.now()

/** The worker slots of each lane */
const LANE_SLOTS: Record<Lane, number[]> = { interactive: [0], bulk: [1, 2] }
const readers: (Reader | null)[] = new Array(3).fill(null)
let dbFile = ''
let nextId = 1
// Memory-mapped reads (megabytes of the file a reader maps; 0 = off). Only set for measuring: DATABRIDGE_SQLITE_MMAP_MB
const MMAP_BYTES = Math.max(0, Number(process.env.DATABRIDGE_SQLITE_MMAP_MB) || 0) * 1024 * 1024

/** Called once by db.ts with the database path (after the schema exists). */
export function setReaderDbFile(file: string) {
  dbFile = file
}

function startReader(slot: number): Reader {
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { file: dbFile, mmapBytes: MMAP_BYTES } })
  worker.unref()
  const reader: Reader = { worker, pending: new Map() }
  const fail = (err: Error) => {
    if (readers[slot] === reader) readers[slot] = null
    for (const p of reader.pending.values()) p.reject(err)
    reader.pending.clear()
  }
  worker.on('message', ({ id, result, error, startedAt, endedAt }) => {
    const p = reader.pending.get(id)
    if (!p) return
    reader.pending.delete(id)
    perf.record(`reader.wait_ms.${p.op}`, Math.max(0, startedAt - p.sentAt))
    perf.record(`reader.exec_ms.${p.op}`, Math.max(0, endedAt - startedAt))
    error ? p.reject(new Error(error)) : p.resolve(result)
  })
  worker.on('error', fail)
  worker.on('exit', code => fail(new Error(`database reader exited (${code})`)))
  readers[slot] = reader
  return reader
}

/** Requests waiting or running on each worker, for /api/diagnostics/perf */
perf.probe('readers', () => ({
  interactive: LANE_SLOTS.interactive.map(i => readers[i]?.pending.size ?? 0),
  bulk: LANE_SLOTS.bulk.map(i => readers[i]?.pending.size ?? 0),
}))

function call<T>(op: Op, args: object, lane: Lane = DEFAULT_LANE[op]): Promise<T> {
  if (!dbFile) return Promise.reject(new Error('database reader not configured'))
  // The worker of the lane with the fewest requests waiting (the first of them when they are equal)
  let slot = LANE_SLOTS[lane][0]
  for (const i of LANE_SLOTS[lane]) if ((readers[i]?.pending.size ?? 0) < (readers[slot]?.pending.size ?? 0)) slot = i
  const reader = readers[slot] || startReader(slot)
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    reader.pending.set(id, { resolve, reject, op, sentAt: epochNow() })
    reader.worker.postMessage({ id, op, args })
  })
}

/**
 * "tsSec,open,high,low,close,volume" lines strictly newer than `sinceSec` (and, when given, not newer than `untilSec`):
 * the newest `limit`, ascending. `lane`: the plugin's requests are interactive (the default); an export or a
 * platform's feed passes 'bulk', so a large one can never delay what AmiBroker is waiting for.
 */
export function readBarsCsv(ticker: string, sinceSec: number, limit: number, untilSec = 0, lane?: Lane): Promise<string> {
  return call<string>('csv', { ticker, since: sinceSec, limit, until: untilSec }, lane)
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

/**
 * For each range ({ ticker, fromSec, toSec }: toSec excluded): the IST days (days since 1970 in IST) that have
 * bars in it, with how many, ascending. [] for a ticker with no bars.
 */
export function readDayCountsRanges(ranges: Array<{ ticker: string; fromSec: number; toSec: number }>) {
  return call<Array<Array<[number, number]>>>('dayCountsRanges', { ranges })
}
