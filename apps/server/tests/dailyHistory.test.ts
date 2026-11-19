/**
 * Daily bars for the years before the 1-minute history (AmiBroker's mixed EOD/intraday mode),
 * 2026-11-18: stored per India day, served only before the first 1-minute day, downloaded
 * newest year first, only from brokers that really serve daily bars, never for contracts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-daily-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'daily.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const IST = 19_800_000
const DAY = 86_400_000
/** UTC ms of an IST wall time */
const ist = (date: string, hhmm = '00:00') => Date.parse(`${date}T${hhmm}:00Z`) - IST
const daySec = (date: string) => ist(date) / 1000

let db: typeof import('../src/db')
let daily: typeof import('../src/market/DailyHistory')
let brokerManager: any
beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  daily = await import('../src/market/DailyHistory')
  brokerManager = (await import('../src/brokers/BrokerManager')).brokerManager
})

const bar = (ts: number, close = 100) => ({ ts, open: close, high: close + 2, low: close - 2, close, volume: 1000 })

function addSymbol(ticker: string, brokerId: string, type = 'EQ') {
  db.stmts.insertSymbol.run({ broker_id: brokerId, instrument_id: `NSE:${ticker}-EQ`, amibroker_ticker: ticker, exchange: 'NSE', instrument_type: type, raw_symbol: `NSE:${ticker}-EQ`, created_at: Date.now() })
  return (db.stmts.getSymbols.all() as any[]).find(s => (s.amiBrokerTicker || s.amibroker_ticker) === ticker)
}

describe('daily bars in the database', () => {
  it('one row per India day, however the broker stamps it; today is left to the 1-minute bars', () => {
    const today = new Date(Date.now() + IST).toISOString().slice(0, 10)
    expect(db.upsertDailyBars('DSTAMP', [
      bar(ist('2015-03-02'), 10),            // IST midnight (Fyers, Kite)
      bar(Date.parse('2015-03-03T00:00:00Z'), 11), // UTC midnight = 05:30 IST
      bar(ist('2015-03-04', '09:15'), 12),   // session open
      bar(ist(today), 13),                   // today: not stored
      { ts: ist('2015-03-05'), open: 0, high: 0, low: 0, close: 0, volume: 0 },  // broken: not stored
    ])).toBe(3)
    expect(db.dailyCsvBefore('DSTAMP', daySec('2015-03-05')).split('\n')).toEqual([
      `${daySec('2015-03-02')},10,12,8,10,1000`,
      `${daySec('2015-03-03')},11,13,9,11,1000`,
      `${daySec('2015-03-04')},12,14,10,12,1000`,
    ])
  })

  it('only the days before the given time are served (the 1-minute history covers the rest)', () => {
    db.upsertDailyBars('DCUT', [bar(ist('2017-07-01')), bar(ist('2017-07-03')), bar(ist('2017-07-04'))])
    // first 1-minute bar on 3 July 09:15: 1 July only
    expect(db.dailyCsvBefore('DCUT', ist('2017-07-03', '09:15') / 1000)).toBe(`${daySec('2017-07-01')},100,102,98,100,1000`)
    expect(db.dailyCsvBefore('NOSUCH', Date.now() / 1000)).toBe('')
  })
})

describe('downloading daily years', () => {
  function fakeBroker(id: string, listedMs: number, opts: { dailyHistory?: boolean } = { dailyHistory: true }) {
    const calls: Array<{ interval: string; from: number; to: number }> = []
    brokerManager.activeAdapters.set(id, {
      ...opts,
      on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
      getHistoricalBars: async (_t: string, interval: string, from: Date, to: Date) => {
        calls.push({ interval, from: from.getTime(), to: to.getTime() })
        const out = []
        for (let t = Math.max(from.getTime(), listedMs); t < to.getTime(); t += 7 * DAY) out.push(bar(Math.floor((t + IST) / DAY) * DAY - IST))
        return out
      },
    })
    return calls
  }

  it('newest year first, from where the 1-minute history starts, back to the listing; then never again', async () => {
    const now = ist('2026-11-18', '12:00')
    const calls = fakeBroker('dl1', ist('2022-06-01'))
    const sym = addSymbol('DLIST', 'dl1')
    await db.upsertBarsToHistory('DLIST', [bar(ist('2024-01-02', '09:15'))])   // 1-minute history from 2024
    expect(await daily.downloadDailyFor(sym, now)).toBe('downloaded')
    expect(calls.every(c => c.interval === '1d')).toBe(true)
    expect(calls[0].to).toBe(ist('2024-01-02', '09:15'))            // ends where 1-minute bars begin
    for (let i = 1; i < calls.length; i++) expect(calls[i].to).toBe(calls[i - 1].from)   // newest first, no overlap
    for (const c of calls) expect(c.to - c.from).toBeLessThanOrEqual(365 * DAY)
    expect(calls).toHaveLength(3)                                    // 2023, 2022 (listing), then an empty year
    const csv = db.dailyCsvBefore('DLIST', ist('2024-01-02', '09:15') / 1000)
    expect(csv.split('\n')[0].startsWith(String(daySec('2022-06-01')))).toBe(true)
    // Asked back to the listing already: nothing more, also after a restart (kept on disk)
    expect(await daily.downloadDailyFor(sym, now)).toBe('done')
    expect(calls).toHaveLength(3)
    expect(JSON.parse(fs.readFileSync(path.join(db.DATA_DIR, 'daily_floor.json'), 'utf8')).DLIST).toBeGreaterThan(0)
  })

  it("not from brokers that read '1d' as 1 minute, not for contracts, not before any 1-minute history", async () => {
    const now = ist('2026-11-18', '12:00')
    const minuteOnly = fakeBroker('dl2', 0, {})
    const s1 = addSymbol('DNOAPI', 'dl2')
    await db.upsertBarsToHistory('DNOAPI', [bar(ist('2024-01-02', '09:15'))])
    expect(await daily.downloadDailyFor(s1, now)).toBe('skipped')
    expect(minuteOnly).toHaveLength(0)

    const calls = fakeBroker('dl3', 0)
    const fut = addSymbol('RELIANCE26NOVFUT', 'dl3', 'FUT')
    expect(await daily.downloadDailyFor(fut, now)).toBe('skipped')
    const fresh = addSymbol('DFRESH', 'dl3')
    expect(await daily.downloadDailyFor(fresh, now)).toBe('later')   // waits for its 1-minute history
    expect(calls).toHaveLength(0)
  })

  it('the years setting: 0 turns it off', async () => {
    db.upsertSettings({ dailyHistoryYears: 0 })
    try {
      expect(daily.dailyYears()).toBe(0)
      expect(await daily.dailyRound()).toBe(0)
    } finally {
      db.upsertSettings({ dailyHistoryYears: 20 })
    }
    expect(daily.dailyYears()).toBe(20)
  })
})
