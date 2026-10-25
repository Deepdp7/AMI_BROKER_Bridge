/**
 * DataBridge Pro — SQLite store tests (bars, AmiBroker CSV, gap scan, candles, logs)
 * Runs against its own SQLite file in a temp home folder.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-store-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'store.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let reader: typeof import('../src/db/reader')

// A past weekday session minute (Tue 2026-10-20 10:00 IST = 04:30 UTC)
const T = Date.UTC(2026, 9, 20, 4, 30) / 1000
const line = (ts: number, o: number, h: number, l: number, c: number, v: number) => `${ts},${o},${h},${l},${c},${v}`

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  reader = await import('../src/db/reader')
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

describe('Bars', () => {
  it('stores prices exactly and serves the AmiBroker CSV (newest N, ascending)', async () => {
    await db.upsertBarsToHistory('ZZA', [
      line(T, 2269.3, 2270.05, 2268.85, 2269.35, 439064),
      line(T + 60, 0.0025, 0.005, 0.0025, 0.0050, 12),
      line(T + 120, 85000.55, 85010, 84990.1, 85001.25, 7),
    ])
    const all = await db.stmts.getBarsCsvByTickerAsync.get('ZZA', 50000)
    const rows = all.split('\n').map(r => r.split(',').map(Number))
    expect(rows.map(r => r[0])).toEqual([T, T + 60, T + 120])
    expect(rows[0].slice(1)).toEqual([2269.3, 2270.05, 2268.85, 2269.35, 439064])
    expect(rows[1].slice(1)).toEqual([0.0025, 0.005, 0.0025, 0.005, 12])
    expect(rows[2].slice(1)).toEqual([85000.55, 85010, 84990.1, 85001.25, 7])

    // newest 2 bars, still ascending
    expect((await db.stmts.getBarsCsvByTickerAsync.get('ZZA', 2)).split('\n').map(r => Number(r.split(',')[0]))).toEqual([T + 60, T + 120])
    // strictly newer than `since`
    expect((await db.stmts.getBarsCsvSinceAsync.get('ZZA', T + 60, 50000)).split('\n').map(r => Number(r.split(',')[0]))).toEqual([T + 120])
    expect(await db.stmts.getBarsCsvByTickerAsync.get('NO_SUCH_TICKER', 100)).toBe('')
  })

  it('history replaces live-built bars, live bars never replace history, identical rows are not rewritten', async () => {
    db.insertBarBatch([{ amibroker_ticker: 'ZZB', ts_utc_ms: T * 1000, open: 10, high: 11, low: 9, close: 10.5, volume: 3, open_interest: null }])
    db.flushPendingBars()
    expect(await db.upsertBarsToHistory('ZZB', [line(T, 10, 12, 9, 11, 100)])).toBe(1) // corrected
    expect(await db.upsertBarsToHistory('ZZB', [line(T, 10, 12, 9, 11, 100)])).toBe(0) // unchanged
    db.insertBarBatch([{ amibroker_ticker: 'ZZB', ts_utc_ms: T * 1000, open: 1, high: 1, low: 1, close: 1, volume: 1, open_interest: null }])
    db.flushPendingBars()
    expect(await db.stmts.getBarsCsvByTickerAsync.get('ZZB', 10)).toBe(line(T, 10, 12, 9, 11, 100))
  })

  it('skips the still-forming minute', async () => {
    const nowMin = Math.floor(Date.now() / 60000) * 60
    expect(await db.upsertBarsToHistory('ZZC', [line(nowMin, 1, 1, 1, 1, 1)])).toBe(0)
    expect(await db.getLastBarTimestampSec('ZZC')).toBe(0)
  })

  it('reports first/last bar and the holes between bars', async () => {
    await db.upsertBarsToHistory('ZZD', [line(T, 1, 1, 1, 1, 1), line(T + 60, 1, 1, 1, 1, 1), line(T + 600, 1, 1, 1, 1, 1)])
    expect(await db.getOldestBarTimestampSec('ZZD')).toBe(T)
    expect(await db.getLastBarTimestampSec('ZZD')).toBe(T + 600)
    const g = await reader.readGapCandidates('ZZD', T - 3600, T + 3600, 60)
    expect(g).toEqual({ pairs: [[T + 60, T + 600]], firstSec: T, lastSec: T + 600 })
  })

  it('resamples candles (first open, max high, min low, last close, summed volume)', async () => {
    // 5 one-minute bars inside one 5-minute bucket anchored at 09:15 IST
    const start = T // 10:00 IST is on a 5-minute boundary from 09:15
    await db.upsertBarsToHistory('ZZE', [0, 1, 2, 3, 4].map(i => line(start + i * 60, 100 + i, 110 + i, 90 - i, 101 + i, 10)))
    const candles = await reader.readCandles('ZZE', (start - 3600) * 1000, 300_000, (3 * 60 + 45) * 60_000, 10)
    expect(candles).toEqual([{ t: start * 1000, open: 100, high: 114, low: 86, close: 105, volume: 50 }])
    expect(await reader.readHighLow('ZZE', (start - 60) * 1000)).toEqual({ hi: 114, lo: 86 })
  })

  it('deleting a symbol removes its bars', async () => {
    db.stmts.insertSymbol.run({ broker_id: 'b1', instrument_id: 'NSE:ZZF-EQ', amibroker_ticker: 'ZZF', exchange: 'NSE', instrument_type: 'EQ', raw_symbol: 'NSE:ZZF-EQ', created_at: Date.now() })
    await db.upsertBarsToHistory('ZZF', [line(T, 1, 1, 1, 1, 1)])
    db.stmts.deleteSymbol.run('b1', 'ZZF')
    expect(await db.getLastBarTimestampSec('ZZF')).toBe(0)
    expect(db.stmts.getSymbols.all().some((s: any) => s.amiBrokerTicker === 'ZZF')).toBe(false)
  })
})

describe('Logs and settings', () => {
  it('buffers log rows and filters them', async () => {
    db.stmts.insertLog.run({ id: 'x', ts: Date.now(), level: 'error', component: 'ZZTest', message: 'boom' })
    db.appendLog('info', 'ZZTest', 'hello')
    const errors = await db.queryLogs({ level: 'error', component: 'ZZTest', limit: 10 })
    expect(errors.map(r => r.message)).toEqual(['boom'])
    expect((await db.queryLogs({ component: 'ZZTest', limit: 10 })).length).toBe(2)
  })

  it('persists settings as JSON text', () => {
    db.upsertSettings({ backfillDepthDays: 730 })
    expect(db.getAllSettings().backfillDepthDays).toBe(730)
    const row = db.sqlite.prepare("SELECT value FROM settings WHERE key = 'backfillDepthDays'").get() as any
    expect(JSON.parse(row.value)).toBe(730)
  })
})
