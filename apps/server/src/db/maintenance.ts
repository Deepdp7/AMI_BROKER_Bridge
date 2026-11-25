/**
 * maintenance.ts: the database's write-ahead log is checkpointed on a worker thread
 *
 * SQLite commits into a log file (WAL) and copies it into the database file in "checkpoints", which
 * wait for the disk. The engine's own connection used to do that inside the COMMIT of whichever
 * write crossed the default limit (1,000 pages, 4 MB), on the one thread that also handles live
 * ticks: a history chunk's save then took tens of ms longer now and then. Here a second connection
 * does it instead, so those waits happen on this thread:
 *
 *   - PASSIVE checkpoint (never blocks the writer) when the log passes 16 MB, or a minute after the last one;
 *     if the log still holds 16 MB of pages after it, the engine holds its history saves for a moment and a second
 *     PASSIVE copies the rest, then this thread makes the first write of the new log (holdHistoryWrites below).
 *     Copying alone never let a log that is written to all the time start over (the engine had always written
 *     more by the time the copy was done): during a long download it grew to the engine's own 20,000-page limit
 *     and the engine's thread checkpointed inside a commit after all, about every 80 MB (seen at up to 1 s,
 *     Stage 9). The first write of a log that starts over syncs the log's header to the disk, which takes seconds
 *     while another program writes a lot to the same disk (seen at 5.9 s): it is made here, not by the engine.
 *     RESTART would also start the log over, but it holds the write lock while it copies and syncs (seen at 180 ms);
 *   - TRUNCATE (log file back to zero bytes) once nothing has been written for 30 s. It holds the write
 *     lock, so it never waits: PASSIVE copies the log first, and while a reader is busy (a backup, a long
 *     gap scan) it gives up at once and is tried again half a minute later. Waiting for the reader with the
 *     lock held would make the engine's next write, and so its one thread, wait too.
 *
 * The engine's own connection keeps an automatic checkpoint at 20,000 pages (about 80 MB) as a last resort,
 * so a dead worker only brings the old behaviour back. DATABRIDGE_MAINTENANCE=0 turns all of this off
 * (default SQLite settings, as before Stage 4).
 *
 * The worker is plain JavaScript passed as a string (eval), like db/reader.ts, so it also runs from the
 * single packaged .exe.
 */
import { Worker } from 'worker_threads'
import { perf } from '../system/perf'

export const MAINTENANCE_ENABLED = process.env.DATABRIDGE_MAINTENANCE !== '0'
/** Automatic checkpoint of the engine's own connection when the worker has not done its job (pages of 4 KB) */
export const BACKSTOP_CHECKPOINT_PAGES = 20_000
/** The log file is cut down to this size after a checkpoint has emptied it */
export const JOURNAL_SIZE_LIMIT_BYTES = 64 * 1024 * 1024

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('worker_threads')
const fs = require('fs')
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => { if (!/SQLite/.test(String((w && w.message) || w))) emitWarning.call(process, w, ...rest) }
const { DatabaseSync } = require('node:sqlite')
process.emitWarning = emitWarning

const db = new DatabaseSync(workerData.file)
db.exec('PRAGMA busy_timeout = 5000')
const walFile = workerData.file + '-wal'
const BIG_WAL_BYTES = workerData.bigWalBytes
const EVERY_MS = workerData.everyMs
const IDLE_MS = workerData.idleMs
const PAGE_BYTES = Number(db.prepare('PRAGMA page_size').get().page_size) || 4096
// One row, written by this thread to start the log over (startOver below)
let markRestart = null
try {
  db.exec('CREATE TABLE IF NOT EXISTS wal_restarts (id INTEGER PRIMARY KEY, at INTEGER)')
  markRestart = db.prepare('INSERT OR REPLACE INTO wal_restarts (id, at) VALUES (1, ?)')
} catch { /* the engine's next write starts the log over instead */ }
let lastCheckpointAt = Date.now()
let truncateFrom = 0   // not before this time (the last one found a reader busy)

function checkpoint(mode) {
  const startedAt = performance.now()
  let r
  try {
    r = db.prepare('PRAGMA wal_checkpoint(' + mode + ')').get()
  } catch (err) {
    parentPort.postMessage({ mode, error: String((err && err.message) || err) })
    return null
  }
  lastCheckpointAt = Date.now()
  parentPort.postMessage({ mode, ms: performance.now() - startedAt, busy: Number(r.busy), log: Number(r.log), checkpointed: Number(r.checkpointed) })
  return r
}

function truncate(now) {
  if (now < truncateFrom) return
  checkpoint('PASSIVE')
  db.exec('PRAGMA busy_timeout = 0')
  const r = checkpoint('TRUNCATE')
  db.exec('PRAGMA busy_timeout = 5000')
  if (!r || Number(r.busy)) truncateFrom = now + IDLE_MS
}

// The pages in the log, not the file's size: the file keeps its size once the log starts over
let holding = false
function copy() {
  const r = checkpoint('PASSIVE')
  if (!r || holding || Number(r.log) * PAGE_BYTES < BIG_WAL_BYTES) return
  holding = true
  parentPort.postMessage({ hold: true })
}
// The log has been copied to its end: the first write after that starts it over, and syncs its header
function startOver() {
  const startedAt = performance.now()
  db.exec('PRAGMA busy_timeout = 0')
  try { markRestart.run(Date.now()) } catch { /* the engine is writing after all: the engine's write starts it over */ }
  db.exec('PRAGMA busy_timeout = 5000')
  parentPort.postMessage({ startOverMs: performance.now() - startedAt })
}
parentPort.on('message', m => {
  if (m !== 'held') return
  const r = checkpoint('PASSIVE')   // nothing is being added meanwhile: it reaches the end of the log
  if (markRestart && r && !Number(r.busy) && Number(r.log) === Number(r.checkpointed)) startOver()
  holding = false
  parentPort.postMessage({ release: true })
})

setInterval(() => {
  let st
  try { st = fs.statSync(walFile) } catch { return }   // no log file yet
  if (st.size === 0) return
  const now = Date.now()
  if (now - st.mtimeMs >= IDLE_MS) truncate(now)   // nothing written for a while
  else if (st.size >= BIG_WAL_BYTES || now - lastCheckpointAt >= EVERY_MS) copy()
}, workerData.pollMs)
`

/** One worker per database file (the engine has one file; tests start more) */
const workers = new Map<string, Worker>()

/**
 * The engine's writes wait while the worker copies the end of the log and starts it over (see the header): a few
 * ms usually, seconds while the disk is very busy, at most HOLD_MAX_MS should the worker not answer. History
 * slices wait for the release; the live bars and the log lines stay in memory for their next round (writesHeld).
 * A rarer write made meanwhile waits for the worker's lock, or only means the log starts over a little later.
 */
const HOLD_MAX_MS = 10_000
let holdTimer: NodeJS.Timeout | null = null
const holdWaiters: Array<() => void> = []
let heldAt = 0

/** Resolves at once, or when the worker has copied the log (upsertBarsToHistory awaits it before each slice) */
export function historyWritesAllowed(): Promise<void> | null {
  return holdTimer ? new Promise<void>(resolve => holdWaiters.push(resolve)) : null
}

/** The worker is copying the end of the log: a timed write (live bars, log lines) waits for its next round */
export function writesHeld(): boolean {
  return holdTimer !== null
}

function holdHistoryWrites(w: Worker) {
  if (holdTimer) return
  heldAt = performance.now()
  holdTimer = setTimeout(releaseHistoryWrites, HOLD_MAX_MS)
  w.postMessage('held')   // this thread writes nothing more until the answer: no history slice runs meanwhile
}

function releaseHistoryWrites() {
  if (!holdTimer) return
  clearTimeout(holdTimer)
  holdTimer = null
  perf.record('db.history_hold_ms', performance.now() - heldAt)
  for (const resolve of holdWaiters.splice(0)) resolve()
}

/** Starts the checkpoint worker for the database file (called by db/index.ts once the schema exists) */
export function startMaintenance(file: string, opts: { pollMs?: number; bigWalBytes?: number; everyMs?: number; idleMs?: number } = {}) {
  if (!MAINTENANCE_ENABLED || workers.has(file)) return
  const w = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { file, pollMs: opts.pollMs ?? 1000, bigWalBytes: opts.bigWalBytes ?? 16 * 1024 * 1024, everyMs: opts.everyMs ?? 60_000, idleMs: opts.idleMs ?? 30_000 },
  })
  w.unref()
  workers.set(file, w)
  w.on('message', (m: { mode: string; ms?: number; busy?: number; log?: number; checkpointed?: number; error?: string; hold?: boolean; release?: boolean; startOverMs?: number }) => {
    if (m.hold) { holdHistoryWrites(w); return }
    if (m.release) { releaseHistoryWrites(); return }
    if (m.startOverMs !== undefined) { perf.record('db.wal_start_over_ms', m.startOverMs); return }
    if (m.error) {
      perf.count('db.checkpoint_errors')
      console.warn(`[DB] ${m.mode} checkpoint failed: ${m.error}`)
      return
    }
    perf.record('db.checkpoint_ms', m.ms ?? 0)
    perf.record(`db.checkpoint_ms.${m.mode.toLowerCase()}`, m.ms ?? 0)
    perf.count('db.checkpoints')
    if (m.busy) perf.count('db.checkpoints_busy')   // readers or a writer kept it from finishing: it will try again
    // pages left in the log after it ran (0 = fully copied into the database file)
    perf.gauge('db.wal_pages_after_checkpoint', Math.max(0, (m.log ?? 0) - (m.checkpointed ?? 0)))
  })
  const gone = (why: string) => {
    if (workers.get(file) !== w) return
    workers.delete(file)
    releaseHistoryWrites()
    console.warn(`[DB] The checkpoint worker stopped (${why}); the engine's own limit of ${BACKSTOP_CHECKPOINT_PAGES} pages takes over until it is restarted`)
    perf.count('db.maintenance_restarts')
    setTimeout(() => startMaintenance(file, opts), 30_000).unref()
  }
  w.on('error', err => gone(String(err?.message || err)))
  w.on('exit', code => gone(`exit ${code}`))
}
