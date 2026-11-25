/**
 * Stage 4: the write-ahead log is checkpointed on a worker thread, and the reader workers are split in two
 * lanes so that what AmiBroker waits for never queues behind work nobody waits for.
 */
import { describe, it, expect, vi, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-maint-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'maint.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* files still open on Windows */ }
})

describe('the engine connection', () => {
  it('leaves checkpoints to the worker: its own automatic one is a last resort far above the default', async () => {
    const db = await import('../src/db')
    await db.syncCachesPromise
    const auto = (db.sqlite.prepare('PRAGMA wal_autocheckpoint').get() as any).wal_autocheckpoint
    const limit = (db.sqlite.prepare('PRAGMA journal_size_limit').get() as any).journal_size_limit
    expect(auto).toBe(20_000)
    expect(limit).toBe(64 * 1024 * 1024)
  })
})

describe('the checkpoint worker', () => {
  it('copies a large log into the database file while the writer keeps going, then empties the file once idle', async () => {
    const { DatabaseSync } = (await import('../src/db')).loadSqlite()
    const { startMaintenance } = await import('../src/db/maintenance')
    const { perf } = await import('../src/system/perf')
    const file = path.join(tmpHome, 'wal.db')
    const writer = new DatabaseSync(file)
    writer.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)')
    // Same thresholds as the real thing, scaled down: a "big" log is 200 KB, idle is half a second
    startMaintenance(file, { pollMs: 50, bigWalBytes: 200_000, everyMs: 3_600_000, idleMs: 600 })

    const walSize = () => { try { return fs.statSync(file + '-wal').size } catch { return 0 } }
    const text = 'x'.repeat(500)
    for (let i = 0; i < 1500; i++) writer.prepare('INSERT INTO t (a, b) VALUES (?, ?)').run(i, text)   // each its own commit
    expect(walSize()).toBeGreaterThan(200_000)

    // The worker copies the log into the file (nothing else is checkpointing: the writer's own limit is off)
    await vi.waitFor(() => expect(perf.snapshot().sinceStart.counters['db.checkpoints'] ?? 0).toBeGreaterThanOrEqual(1), { timeout: 5000, interval: 50 })
    expect(perf.snapshot().sinceStart.hist['db.checkpoint_ms']?.count ?? 0).toBeGreaterThanOrEqual(1)

    // Idle: the log file goes back to zero bytes
    await vi.waitFor(() => expect(walSize()).toBe(0), { timeout: 6000, interval: 100 })
    expect((writer.prepare('SELECT COUNT(*) AS n FROM t').get() as any).n).toBe(1500)   // nothing lost
    writer.close()
  }, 20_000)
})

describe('a log written to all the time', () => {
  it('starts over now and then (history saves wait a moment for the copy), instead of growing until the engine\'s own limit', async () => {
    const { DatabaseSync } = (await import('../src/db')).loadSqlite()
    const { startMaintenance, historyWritesAllowed } = await import('../src/db/maintenance')
    const { perf } = await import('../src/system/perf')
    const file = path.join(tmpHome, 'download.db')
    const writer = new DatabaseSync(file)
    // No automatic checkpoint at all: only the worker can keep this log small
    writer.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT)')
    const insert = writer.prepare('INSERT OR REPLACE INTO t (a, b) VALUES (?, ?)')
    const text = 'y'.repeat(400)
    const checkpoints = () => perf.snapshot().sinceStart.counters['db.checkpoints'] ?? 0
    const holds = () => perf.snapshot().sinceStart.hist['db.history_hold_ms']?.count ?? 0
    // The worker is running (it copied a first small log) before the download starts
    const checkpointsBefore = checkpoints()
    insert.run(-1, text)
    startMaintenance(file, { pollMs: 20, bigWalBytes: 2_000_000, everyMs: 0, idleMs: 60_000 })
    await vi.waitFor(() => expect(checkpoints()).toBeGreaterThan(checkpointsBefore), { timeout: 5000, interval: 20 })
    const holdsBefore = holds()
    // The log file's header counts the times the log started over (its "checkpoint sequence", bytes 12-15)
    const restarts = () => { const fd = fs.openSync(file + '-wal', 'r'); const b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd); return b.readUInt32BE(12) }
    const restartsBefore = restarts()

    // A download: slices of rows one after the other, a turn of the event loop between them (as upsertBarsToHistory)
    for (let slice = 0; slice < 1600; slice++) {
      await new Promise(r => setImmediate(r))
      const held = historyWritesAllowed()
      if (held) await held
      writer.exec('BEGIN')
      for (let i = 0; i < 100; i++) insert.run(slice * 100 + i, text)
      writer.exec('COMMIT')
    }
    // Without the holds a log written to with no pause never starts over (the copy is never complete)
    expect(restarts() - restartsBefore).toBeGreaterThanOrEqual(2)
    expect(holds() - holdsBefore).toBeGreaterThanOrEqual(2)
    expect((writer.prepare('SELECT COUNT(*) AS n FROM t').get() as any).n).toBe(160_001)   // nothing lost
    writer.close()
  }, 30_000)
})

describe('a long read while the log is idle', () => {
  it('never makes the writer wait (the truncating checkpoint does not sit on the write lock)', async () => {
    const { DatabaseSync } = (await import('../src/db')).loadSqlite()
    const { startMaintenance } = await import('../src/db/maintenance')
    const file = path.join(tmpHome, 'busy.db')
    const writer = new DatabaseSync(file)
    writer.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE t (a INTEGER PRIMARY KEY)')
    writer.exec('INSERT INTO t (a) VALUES (1)')
    // A backup or a gap scan: a read that stays open
    const reader = new DatabaseSync(file, { readOnly: true })
    reader.exec('BEGIN')
    reader.prepare('SELECT COUNT(*) FROM t').get()
    writer.exec('INSERT INTO t (a) VALUES (2)')          // the reader still needs the older state
    startMaintenance(file, { pollMs: 50, bigWalBytes: 1e9, everyMs: 3_600_000, idleMs: 300 })
    let worst = 0
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 700))         // idle long enough for it to try
      const startedAt = performance.now()
      writer.prepare('INSERT INTO t (a) VALUES (?)').run(10 + i)
      worst = Math.max(worst, performance.now() - startedAt)
    }
    expect(worst).toBeLessThan(500)                      // it waited up to 5 s for the lock
    reader.exec('COMMIT')
    reader.close()
    // Once nobody reads, the log is emptied as before
    await vi.waitFor(() => expect(fs.statSync(file + '-wal').size).toBe(0), { timeout: 6000, interval: 100 })
    writer.close()
  }, 30_000)
})

describe('reader lanes', () => {
  it('a plugin request goes to its own worker while bulk work is spread over two others', async () => {
    const db = await import('../src/db')
    await db.syncCachesPromise
    const reader = await import('../src/db/reader')
    const { perf } = await import('../src/system/perf')
    const lane = () => perf.probeResults().readers as { interactive: number[]; bulk: number[] }

    const now = Math.floor(Date.now() / 1000)
    const bulk = Array.from({ length: 6 }, (_, i) => reader.readGapCandidates(`NOSUCH${i}`, now - 86400, now, 60))
    expect(lane().bulk).toEqual([3, 3])                 // spread over the two bulk workers
    expect(lane().interactive).toEqual([0])             // none of it on the interactive one

    const csv = reader.readBarsCsv('NOSUCH', 0, 10)
    expect(lane().interactive).toEqual([1])             // a history request for the plugin: its own worker
    expect(lane().bulk).toEqual([3, 3])

    // An export of a platform asks for the bulk lane explicitly
    const exp = reader.readBarsCsv('NOSUCH', 0, 10, 0, 'bulk')
    expect(lane().interactive).toEqual([1])
    expect(lane().bulk.reduce((a, b) => a + b, 0)).toBe(7)

    await Promise.all([...bulk, csv, exp])
    expect(lane().interactive).toEqual([0])
    expect(lane().bulk).toEqual([0, 0])
  })

  it('counts the days of a range per ticker, and gives nothing for an unknown ticker', async () => {
    const db = await import('../src/db')
    const reader = await import('../src/db/reader')
    const T = Date.UTC(2026, 9, 20, 4, 30) / 1000   // 10:00 IST on 2026-10-20
    await db.upsertBarsToHistory('LANE1', [0, 1, 2, 24 * 60, 24 * 60 + 1].map(m => ({ ts: (T + m * 60) * 1000, open: 1, high: 2, low: 1, close: 1, volume: 1 })))
    const day = Math.floor((T + 19800) / 86400)
    const [one, none, half] = await reader.readDayCountsRanges([
      { ticker: 'LANE1', fromSec: T - 3600, toSec: T + 3 * 86400 },
      { ticker: 'NOSUCH', fromSec: 0, toSec: 9e15 },
      { ticker: 'LANE1', fromSec: T + 60, toSec: T + 3 * 60 },   // toSec is not included
    ])
    expect(one).toEqual([[day, 3], [day + 1, 2]])
    expect(none).toEqual([])
    expect(half).toEqual([[day, 2]])
  })
})
