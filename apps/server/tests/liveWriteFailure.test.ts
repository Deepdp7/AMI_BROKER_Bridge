/**
 * Stage 8c: the database stops taking writes (disk full, file held by something else). Live bars wait in memory and are
 * tried again less and less often; at 50,000 waiting it says so; above 500,000 the oldest are given up so memory does
 * not grow without end, and their tickers are marked to be fetched from the broker again (nothing is dropped without a
 * way back).
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-wfail-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'wf.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let coverage: typeof import('../src/market/state/coverageState')
let perf: typeof import('../src/system/perf').perf
let beginAttempts = 0
let failing = false

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  await import('../src/market/BackfillQueue')           // listens for bars that were given up
  coverage = await import('../src/market/state/coverageState')
  perf = (await import('../src/system/perf')).perf
  // The database refuses to start a transaction while `failing`
  const exec = db.sqlite.exec.bind(db.sqlite)
  vi.spyOn(db.sqlite, 'exec').mockImplementation(((sql: string) => {
    if (sql === 'BEGIN') { beginAttempts++; if (failing) throw new Error('database or disk is full') }
    return exec(sql)
  }) as any)
})
afterAll(() => { vi.restoreAllMocks(); try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })
afterEach(() => { vi.useRealTimers() })

const MINUTE0 = Date.UTC(2026, 9, 20, 4, 30)            // a past weekday minute
const bar = (ticker: string, i: number) => ({ amibroker_ticker: ticker, ts_utc_ms: MINUTE0 + i * 60_000, open: 10, high: 11, low: 9, close: 10.5, volume: 5 })
const waiting = () => (perf.probeResults().db as any).pendingLiveBars as number
const logged = (spy: ReturnType<typeof vi.spyOn>, text: string) => spy.mock.calls.filter(c => String(c[0]).includes(text))

describe('when the database does not take writes', () => {
  it('keeps the bars, tries again less and less often, and writes them all once it works', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['Date'] })
    db.insertBarBatch([0, 1, 2].map(i => bar('WF1', i)))
    failing = true

    db.flushPendingBars(true)
    expect(waiting()).toBe(3)                                      // nothing lost
    expect(logged(error, 'Failed to write live bars')).toHaveLength(1)

    // Called again at once (a read, a gap scan, the 2 s timer): not tried again yet
    const attempts = beginAttempts
    db.flushPendingBars(); db.flushPendingBars()
    expect(beginAttempts).toBe(attempts)

    // After the wait it tries, fails again, and says so only once a minute
    vi.setSystemTime(Date.now() + 5_000)
    db.flushPendingBars()
    expect(beginAttempts).toBe(attempts + 1)
    expect(logged(error, 'Failed to write live bars')).toHaveLength(1)
    vi.setSystemTime(Date.now() + 61_000)
    db.flushPendingBars()
    expect(logged(error, 'Failed to write live bars')).toHaveLength(2)

    // The disk has room again
    failing = false
    vi.setSystemTime(Date.now() + 31_000)                          // the longest wait is 30 s
    db.flushPendingBars()
    expect(waiting()).toBe(0)
    expect(logged(log, 'Live bars are being saved again')).toHaveLength(1)
    const csv = await db.stmts.getBarsCsvByTickerAsync.get('WF1', 100)
    expect(csv.split('\n')).toHaveLength(3)                        // all three arrived
    error.mockRestore(); log.mockRestore()
  })

  it('says so when more than 50,000 bars are waiting, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const t of ['WF2', 'WF3', 'WF4']) db.insertBarBatch(Array.from({ length: 20_000 }, (_, i) => bar(t, i)))
    failing = true
    db.flushPendingBars(true)
    expect(waiting()).toBe(60_000)
    expect(logged(warn, '60000 live bars are waiting')).toHaveLength(1)
    vi.setSystemTime(Date.now() + 40_000)
    db.flushPendingBars(true)
    expect(logged(warn, 'live bars are waiting')).toHaveLength(1)   // not again for the same trouble
    failing = false
    db.flushPendingBars(true)
    expect(waiting()).toBe(0)
    warn.mockRestore(); error.mockRestore(); log.mockRestore()
  })

  it('gives up the oldest above 500,000, keeps the newest, and marks the tickers to be fetched again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['Date'] })
    const lost: Array<[string, number, number]> = []
    db.barWrites.on('lost', (t: string, from: number, to: number) => lost.push([t, from, to]))

    const total = 4 * 130_000
    for (const t of ['WL1', 'WL2', 'WL3', 'WL4']) db.insertBarBatch(Array.from({ length: 130_000 }, (_, i) => bar(t, i)))
    // Each ticker was verified up to now: its history was believed complete
    for (const t of ['WL1', 'WL2', 'WL3', 'WL4']) coverage.setVerifiedThroughMs(t, MINUTE0 + 200_000 * 60_000)
    failing = true
    db.flushPendingBars(true)

    expect(waiting()).toBeLessThanOrEqual(450_000)                  // 90% of the limit
    expect(waiting()).toBeGreaterThan(400_000)                      // and most of it is still there
    expect(lost.map(l => l[0]).sort()).toEqual(['WL1', 'WL2', 'WL3', 'WL4'])
    for (const [, from, to] of lost) {
      expect(from).toBe(MINUTE0 / 1000)                             // the oldest minute of each
      expect(to).toBeGreaterThan(from)
      expect(to).toBeLessThan(MINUTE0 / 1000 + 130_000 * 60)       // not the newest
    }
    expect(logged(error, 'oldest waiting live bars were given up')).toHaveLength(1)
    // Their "verified through" marks went back to the minute before the first lost one: the next gap pass looks from there
    for (const t of ['WL1', 'WL2', 'WL3', 'WL4']) expect(coverage.getVerifiedThroughMs(t)).toBe(MINUTE0 - 60_000)

    // The rest is written when the disk works again; what was given up is the part that is missing
    failing = false
    vi.setSystemTime(Date.now() + 31_000)
    db.flushPendingBars()
    expect(waiting()).toBe(0)
    const stored = (await db.stmts.getBarsCsvByTickerAsync.get('WL1', 1_000_000)).split('\n').length
    const droppedOfWl1 = lost.find(l => l[0] === 'WL1')!
    expect(stored).toBe(130_000 - Math.round((droppedOfWl1[2] - droppedOfWl1[1]) / 60) - 1)
    expect(total).toBeGreaterThan(waiting())
    error.mockRestore(); warn.mockRestore(); log.mockRestore()
  }, 60_000)
})
