/**
 * DataBridge Pro — data health per symbol (Symbol Setup) and Repair
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-health-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'health.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let health: typeof import('../src/market/DataHealth')
let bq: typeof import('../src/market/BackfillQueue')
let cal: typeof import('../src/market/MarketCalendar')
let lifecycle: typeof import('../src/brokers/BrokerLifecycle')
let brokerManager: any

const DAY = 86_400_000
const IST = 19_800_000
const istDay = (ms: number) => Math.floor((ms + IST) / DAY)
const dayStr = (d: number) => new Date(d * DAY).toISOString().slice(0, 10)
/** 10:00 IST on IST day d */
const tenAm = (d: number) => d * DAY - IST + 10 * 3600_000

/** Trading days from about 25 days ago up to the last finished one */
let tradingDays: number[] = []

function addSymbol(ticker: string, brokerId = 'fyers-h') {
  db.stmts.insertSymbol.run({ broker_id: brokerId, instrument_id: `NSE:${ticker}-EQ`, amibroker_ticker: ticker, exchange: 'NSE', instrument_type: 'EQ', raw_symbol: `NSE:${ticker}-EQ`, created_at: Date.now() })
}
async function addBars(ticker: string, days: number[]) {
  await db.upsertBarsToHistory(ticker, days.map(d => ({ ts: tenAm(d), open: 100, high: 101, low: 99, close: 100, volume: 5 })))
}

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  health = await import('../src/market/DataHealth')
  bq = await import('../src/market/BackfillQueue')
  cal = await import('../src/market/MarketCalendar')
  lifecycle = await import('../src/brokers/BrokerLifecycle')
  brokerManager = (await import('../src/brokers/BrokerManager')).brokerManager
  db.upsertSettings({ backfillDepthDays: 30 })

  const now = Date.now()
  const istNow = now + IST
  const lastFinished = Math.floor(istNow / DAY) - ((istNow % DAY) / 60_000 >= 15 * 60 + 30 ? 0 : 1)
  for (let d = istDay(now - 25 * DAY); d <= lastFinished; d++) {
    const noon = d * DAY - IST + 12 * 3600_000
    if (!cal.isWeekend(noon) && !cal.isClosedDay(noon, 'NSE')) tradingDays.push(d)
  }

  for (const t of ['HFULL', 'HGAPS', 'HEMPTY', 'HBUSY', 'HCANCEL']) addSymbol(t)
  await addBars('HFULL', tradingDays)
  await addBars('HGAPS', tradingDays.filter((_, i) => i !== 3 && i !== 7))
  await addBars('HBUSY', tradingDays)
  await addBars('HCANCEL', tradingDays.slice(0, 5))
  bq.backfillStatusMap.set('HBUSY', { ticker: 'HBUSY', brokerId: 'fyers-h', status: 'running', progress: 50, candlesFetched: 0, totalChunks: 2, completedChunks: 1, fromDate: '', toDate: '', startedAt: Date.now(), retryCount: 0 } as any)
  ;(bq.backfillQueue as any).skippedSet().add('HCANCEL')
})

afterAll(() => {
  bq.backfillStatusMap.clear()
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

describe('Data health', () => {
  it('gives each symbol one plain status', async () => {
    const all = await health.computeHealth(true)
    const by = Object.fromEntries(all.map(h => [h.ticker, h]))
    expect(by.HFULL).toMatchObject({ status: 'complete', missingDays: 0, olderMissing: false })
    expect(by.HGAPS).toMatchObject({ status: 'missing', missingDays: 2 })
    expect(by.HGAPS.missingSample).toEqual([dayStr(tradingDays[3]), dayStr(tradingDays[7])])
    expect(by.HEMPTY).toMatchObject({ status: 'empty', bars: 0, firstDay: null })
    expect(by.HBUSY.status).toBe('downloading')
    expect(by.HCANCEL.status).toBe('cancelled')
    expect(by.HFULL.bars).toBe(tradingDays.length)
  })

  it('hands out the stored answer at once and two checks never run side by side', async () => {
    const first = await health.computeHealth(true)
    // Within the cache time the very same answer comes back, without another database pass
    expect(await health.computeHealth()).toBe(first)
    expect(health.healthAgeMs()).toBeLessThan(5_000)

    // Older than the cache time but not very old: still handed out at once while a new one is made
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 60_000)
      expect(health.healthAgeMs()).toBeGreaterThanOrEqual(60_000)
      expect(await health.computeHealth()).toBe(first)
    } finally {
      vi.useRealTimers()
    }
    // The background check finishes with a new answer, and parallel callers share one check
    const [a, b] = await Promise.all([health.computeHealth(true), health.computeHealth(true)])
    expect(a.map(h => h.ticker)).toEqual(b.map(h => h.ticker))
    expect(health.healthAgeMs()).toBeLessThan(5_000)
  })

  it('a repair forgets the stored answer, so the next look is a new one', async () => {
    const before = await health.computeHealth(true)
    health.invalidateHealth()
    expect(health.healthAgeMs()).toBe(Infinity)
    const after = await health.computeHealth()
    expect(after).not.toBe(before)
    expect(after.find(h => h.ticker === 'HFULL')?.status).toBe(before.find(h => h.ticker === 'HFULL')?.status)
  })

  it('weekends and market holidays are never "missing"', async () => {
    const [full] = (await health.computeHealth(true)).filter(h => h.ticker === 'HFULL')
    expect(full.missingDays).toBe(0) // the bars skip every weekend and holiday in the range
  })

  it("a day the broker has no trades for in that symbol is not missing (illiquid futures)", async () => {
    addSymbol('HQUIET')
    const quietDay = tradingDays[10]
    await addBars('HQUIET', tradingDays.filter(d => d !== quietDay))
    expect((await health.computeHealth(true)).find(h => h.ticker === 'HQUIET')).toMatchObject({ status: 'missing', missingDays: 1 })

    // The broker's answer had bars before and after that day, and none on it
    const session = (d: number) => [0, 200, 374].map(m => ({ ts: d * DAY - IST + (9 * 60 + 15 + m) * 60_000 }))
    const answer = tradingDays.filter(d => d !== quietDay).flatMap(session)
    cal.learnClosedDays('NSE', 'HQUIET', tenAm(tradingDays[0]) - DAY, tenAm(tradingDays.at(-1)!) + DAY, answer)
    expect((await health.computeHealth(true)).find(h => h.ticker === 'HQUIET')).toMatchObject({ status: 'complete', missingDays: 0 })
    // Other symbols still count that day
    expect(cal.isClosedDay(tenAm(quietDay), 'NSE')).toBe(false)
  })

  it('history that starts long after the requested depth counts as older history missing', async () => {
    db.upsertSettings({ backfillDepthDays: 365 })
    try {
      const [full] = (await health.computeHealth(true)).filter(h => h.ticker === 'HFULL')
      expect(full).toMatchObject({ status: 'missing', olderMissing: true, missingDays: 0 })
    } finally {
      db.upsertSettings({ backfillDepthDays: 30 })
    }
  })

  it('Repair queues the missing days of the chosen symbols', async () => {
    const calls: Array<{ from: number; to: number }> = []
    brokerManager.activeAdapters.set('fyers-h', {
      maxIntradayHistoryDays: 95,
      on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
      getHistoricalBars: async (_t: string, _i: string, from: Date, to: Date) => { calls.push({ from: from.getTime(), to: to.getTime() }); return [] },
    })
    try {
      const r = await lifecycle.repairHistory(['HGAPS'])
      expect(r.queued).toBe(1)
      const missingDay = tradingDays[3]
      await vi.waitFor(() => expect(calls.some(c => c.from <= tenAm(missingDay) && c.to >= tenAm(missingDay))).toBe(true), { timeout: 10_000 })
    } finally {
      bq.backfillQueue.cancelAll()
      brokerManager.activeAdapters.clear()
    }
  })
})
