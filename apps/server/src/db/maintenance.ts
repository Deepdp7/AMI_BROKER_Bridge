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
 *   - TRUNCATE (log file back to zero bytes) once nothing has been written for 30 s.
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
let lastCheckpointAt = Date.now()

function checkpoint(mode) {
  const startedAt = performance.now()
  let r
  try {
    r = db.prepare('PRAGMA wal_checkpoint(' + mode + ')').get()
  } catch (err) {
    parentPort.postMessage({ mode, error: String((err && err.message) || err) })
    return
  }
  lastCheckpointAt = Date.now()
  parentPort.postMessage({ mode, ms: performance.now() - startedAt, busy: Number(r.busy), log: Number(r.log), checkpointed: Number(r.checkpointed) })
}

setInterval(() => {
  let st
  try { st = fs.statSync(walFile) } catch { return }   // no log file yet
  if (st.size === 0) return
  const now = Date.now()
  if (now - st.mtimeMs >= IDLE_MS) checkpoint('TRUNCATE')              // nothing written for a while
  else if (st.size >= BIG_WAL_BYTES || now - lastCheckpointAt >= EVERY_MS) checkpoint('PASSIVE')
}, workerData.pollMs)
`

/** One worker per database file (the engine has one file; tests start more) */
const workers = new Map<string, Worker>()

/** Starts the checkpoint worker for the database file (called by db/index.ts once the schema exists) */
export function startMaintenance(file: string, opts: { pollMs?: number; bigWalBytes?: number; everyMs?: number; idleMs?: number } = {}) {
  if (!MAINTENANCE_ENABLED || workers.has(file)) return
  const w = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { file, pollMs: opts.pollMs ?? 1000, bigWalBytes: opts.bigWalBytes ?? 16 * 1024 * 1024, everyMs: opts.everyMs ?? 60_000, idleMs: opts.idleMs ?? 30_000 },
  })
  w.unref()
  workers.set(file, w)
  w.on('message', (m: { mode: string; ms?: number; busy?: number; log?: number; checkpointed?: number; error?: string }) => {
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
    console.warn(`[DB] The checkpoint worker stopped (${why}); the engine's own limit of ${BACKSTOP_CHECKPOINT_PAGES} pages takes over until it is restarted`)
    perf.count('db.maintenance_restarts')
    setTimeout(() => startMaintenance(file, opts), 30_000).unref()
  }
  w.on('error', err => gone(String(err?.message || err)))
  w.on('exit', code => gone(`exit ${code}`))
}
