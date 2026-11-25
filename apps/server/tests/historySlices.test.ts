/**
 * Stage 3: a history chunk is committed in slices with a turn for the event loop between them (so live
 * ticks are not held behind one long transaction), and the plugin can ask for the bars up to an end
 * (`until`) when a SYNC notice named the range that changed.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import * as db from '../src/db'
import { perf } from '../src/system/perf'

// A past weekday session minute (Tue 2026-10-20 10:00 IST = 04:30 UTC)
const T = Date.UTC(2026, 9, 20, 4, 30) / 1000
const bar = (i: number) => ({ ts: (T + i * 60) * 1000, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 10 + i })

/** Counts the turns the event loop gets while `work` runs */
async function turnsDuring<R>(work: () => Promise<R>): Promise<{ result: R; turns: number }> {
  let turns = 0
  let running = true
  const spin = () => { if (running) { turns++; setImmediate(spin) } }
  setImmediate(spin)
  const result = await work()
  running = false
  return { result, turns }
}

describe('history upserts in slices', () => {
  it('stores a long chunk completely, returns the same changed count, and lets the event loop run between slices', async () => {
    await db.syncCachesPromise
    const rows = db.HISTORY_SLICE_ROWS * 2 + 500        // three slices
    const bars = Array.from({ length: rows }, (_, i) => bar(i))
    const work = { syncMs: 0 }
    const { result: changed, turns } = await turnsDuring(() => db.upsertBarsToHistory('SLICE1', bars, work))
    expect(changed).toBe(rows)
    expect(turns).toBeGreaterThanOrEqual(2)             // a turn after each of the first two slices
    expect(work.syncMs).toBeGreaterThan(0)

    const csv = (await db.stmts.getBarsCsvByTickerAsync.get('SLICE1', 1_000_000)).split('\n')
    expect(csv.length).toBe(rows)
    expect(csv[0].split(',').map(Number).slice(0, 2)).toEqual([T, 100])
    expect(Number(csv[rows - 1].split(',')[0])).toBe(T + (rows - 1) * 60)

    // Run again: nothing differs, nothing changes (the slices don't change what is counted)
    expect(await db.upsertBarsToHistory('SLICE1', bars)).toBe(0)
  })

  it('a chunk of one slice does not wait for the event loop', async () => {
    const { result, turns } = await turnsDuring(() => db.upsertBarsToHistory('SLICE2', Array.from({ length: 100 }, (_, i) => bar(i))))
    expect(result).toBe(100)
    expect(turns).toBe(0)
  })

  it('chunks saved at the same time take turns: one slice per turn of the event loop, whoever it belongs to', async () => {
    await db.syncCachesPromise
    const rows = db.HISTORY_SLICE_ROWS * 3                             // three slices each
    const sliceCount = () => (perf.snapshot().sinceStart.hist['db.history_tx_ms']?.count ?? 0)
    const before = sliceCount()
    const { result, turns } = await turnsDuring(() => Promise.all(Array.from({ length: 6 }, (_, k) =>
      db.upsertBarsToHistory(`TAKE${k}`, Array.from({ length: rows }, (_, i) => bar(i))))))
    expect(result).toEqual(Array(6).fill(rows))
    expect(sliceCount() - before).toBe(18)
    // Six chunks of three slices: each slice has a turn of its own (it was about three turns in all, with all six
    // chunks' slices in the same turn)
    expect(turns).toBeGreaterThanOrEqual(17)
  })

  it('historyRangeSec: the oldest and the newest bar, in seconds', () => {
    expect(db.historyRangeSec([bar(5), bar(2), bar(9), bar(3)])).toEqual({ fromSec: T + 2 * 60, toSec: T + 9 * 60 })
    expect(db.historyRangeSec([])).toEqual({ fromSec: 0, toSec: 0 })
  })
})

describe('bars up to an end (until)', () => {
  it('the database read and /api/feed/bars give the bars after `since` and not after `until`', async () => {
    await db.syncCachesPromise
    await db.upsertBarsToHistory('UNTIL1', Array.from({ length: 10 }, (_, i) => bar(i)))   // T .. T+540
    const secs = (csv: string) => csv.split('\n').filter(l => /^\d/.test(l)).map(l => Number(l.split(',')[0]))

    expect(secs(await db.stmts.getBarsCsvSinceAsync.get('UNTIL1', T + 60, 100, T + 300))).toEqual([T + 120, T + 180, T + 240, T + 300])   // until is inclusive
    expect(secs(await db.stmts.getBarsCsvSinceAsync.get('UNTIL1', T + 60, 100))).toEqual([120, 180, 240, 300, 360, 420, 480, 540].map(s => T + s))   // without it: to the newest
    expect(secs(await db.stmts.getBarsCsvSinceAsync.get('UNTIL1', 0, 2, T + 300))).toEqual([T + 240, T + 300])                              // the newest `limit` inside the range

    const ranged = await request(app).get('/api/feed/bars').query({ ticker: 'UNTIL1', since: T + 60, until: T + 300, limit: 100 })
    expect(ranged.status).toBe(200)
    expect(secs(ranged.text)).toEqual([T + 120, T + 180, T + 240, T + 300])
    expect(ranged.text.trimEnd().endsWith('END')).toBe(true)

    // A different range is not served from the answer cached for this one
    const other = await request(app).get('/api/feed/bars').query({ ticker: 'UNTIL1', since: T + 60, until: T + 180, limit: 100 })
    expect(secs(other.text)).toEqual([T + 120, T + 180])
    const open = await request(app).get('/api/feed/bars').query({ ticker: 'UNTIL1', since: T + 60, limit: 100 })
    expect(secs(open.text).length).toBe(8)
  })
})
