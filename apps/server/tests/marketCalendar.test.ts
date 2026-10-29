/**
 * DataBridge Pro — trading calendar: static holidays and closed days learned from broker history
 * Runs in its own temp home folder (closed_days.json lives in the data folder).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-calendar-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'calendar.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let cal: typeof import('../src/market/MarketCalendar')
let db: typeof import('../src/db')

const IST = 5.5 * 3600_000
/** Every NSE minute bar (09:15–15:29 IST) of the given IST dates */
function sessionBars(...dates: string[]) {
  const bars: { ts: number }[] = []
  for (const d of dates) {
    const open = Date.parse(`${d}T09:15:00Z`) - IST
    for (let i = 0; i < 375; i++) bars.push({ ts: open + i * 60_000 })
  }
  return bars
}
/** Gap between the last bar of `before` and the first bar of `after` (IST dates) */
function gapBetween(before: string, after: string, exchange = 'NSE') {
  const prev = Date.parse(`${before}T15:29:00Z`) - IST
  const next = Date.parse(`${after}T09:15:00Z`) - IST
  return cal.getTrueGapRange(prev, next, 60, exchange)
}
const range = (from: string, to: string) => [Date.parse(`${from}T00:00:00Z`) - IST, Date.parse(`${to}T23:59:00Z`) - IST] as const

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  cal = await import('../src/market/MarketCalendar')
})

beforeEach(() => cal.resetLearnedClosedDays())

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

describe('Static NSE holidays', () => {
  it('2026 holidays are not gaps (Holi on 3 Mar, Dussehra on 20 Oct)', () => {
    expect(gapBetween('2026-03-02', '2026-03-04')).toBeNull()
    expect(gapBetween('2026-10-19', '2026-10-21')).toBeNull()
  })

  it('a missing trading day is a gap', () => {
    expect(gapBetween('2026-10-12', '2026-10-14')).not.toBeNull()
  })
})

describe('Learned closed days', () => {
  // Tue 26 Jan 2027 is not in the static list
  const [from, to] = range('2027-01-22', '2027-01-29')
  const around = sessionBars('2027-01-22', '2027-01-25', '2027-01-27', '2027-01-28', '2027-01-29')

  it('needs two symbols with no bars on the day before it is a holiday', () => {
    expect(gapBetween('2027-01-25', '2027-01-27')).not.toBeNull()
    cal.learnClosedDays('NSE', 'AAA', from, to, around)
    expect(gapBetween('2027-01-25', '2027-01-27')).not.toBeNull() // one illiquid symbol proves nothing
    cal.learnClosedDays('NSE', 'AAA', from, to, around)
    expect(gapBetween('2027-01-25', '2027-01-27')).not.toBeNull() // the same symbol twice neither
    cal.learnClosedDays('NSE', 'BBB', from, to, around)
    expect(gapBetween('2027-01-25', '2027-01-27')).toBeNull()
    expect(cal.isNSEHoliday(Date.parse('2027-01-26T06:00:00Z'))).toBe(true)
    // BSE and F&O follow NSE's calendar; MCX does not
    expect(gapBetween('2027-01-25', '2027-01-27', 'NFO')).toBeNull()
    expect(cal.isClosedDay(Date.parse('2027-01-26T06:00:00Z'), 'MCX')).toBe(false)
  })

  it('is remembered across restarts (closed_days.json)', () => {
    cal.learnClosedDays('NSE', 'AAA', from, to, around)
    cal.learnClosedDays('NSE', 'BBB', from, to, around)
    const saved = JSON.parse(fs.readFileSync(path.join(db.DATA_DIR, 'closed_days.json'), 'utf8'))
    expect(saved.NSE.closed['2027-01-26'].sort()).toEqual(['AAA', 'BBB'])
  })

  it('one symbol with bars on the day makes it a trading day for good', () => {
    cal.learnClosedDays('NSE', 'AAA', from, to, around)
    cal.learnClosedDays('NSE', 'BBB', from, to, around)
    cal.learnClosedDays('NSE', 'CCC', from, to, sessionBars('2027-01-25', '2027-01-26', '2027-01-27'))
    expect(gapBetween('2027-01-25', '2027-01-27')).not.toBeNull()
    cal.learnClosedDays('NSE', 'DDD', from, to, around)
    cal.learnClosedDays('NSE', 'EEE', from, to, around)
    expect(gapBetween('2027-01-25', '2027-01-27')).not.toBeNull()
  })

  it("a symbol's own day without trades is remembered, even when the market was open", () => {
    const at26 = Date.parse('2027-01-26T06:00:00Z')
    cal.learnClosedDays('NSE', 'CCC', from, to, sessionBars('2027-01-25', '2027-01-26', '2027-01-27'))
    cal.learnClosedDays('NSE', 'FUT', from, to, around)  // a far-month future: nothing traded on the 26th
    expect(cal.isQuietDay(at26, 'NFO', 'FUT')).toBe(true)
    expect(cal.isQuietDay(at26, 'NSE', 'CCC')).toBe(false)
    expect(cal.isClosedDay(at26, 'NSE')).toBe(false)       // the market itself was open
    const saved = JSON.parse(fs.readFileSync(path.join(db.DATA_DIR, 'closed_days.json'), 'utf8'))
    expect(saved.NSE.quiet.FUT).toEqual(['2027-01-26'])
    // Bars for that day turn up later: it's no longer quiet
    cal.learnClosedDays('NSE', 'FUT', from, to, sessionBars('2027-01-25', '2027-01-26', '2027-01-27'))
    expect(cal.isQuietDay(at26, 'NSE', 'FUT')).toBe(false)
  })

  it('a file from before quiet days were kept counts each closed-day vote as one', () => {
    fs.writeFileSync(path.join(db.DATA_DIR, 'closed_days.json'), JSON.stringify({ NSE: { closed: { '2026-09-03': ['FORTIS26NOVFUT'] }, traded: [] } }))
    expect(cal.isQuietDay(Date.parse('2026-09-03T06:00:00Z'), 'NFO', 'FORTIS26NOVFUT')).toBe(true)
    expect(cal.isQuietDay(Date.parse('2026-09-03T06:00:00Z'), 'NSE', 'FORTIS')).toBe(false)
    expect(cal.isClosedDay(Date.parse('2026-09-03T06:00:00Z'), 'NSE')).toBe(false)
  })

  it('bars on a static holiday override the list (the list once had a wrong date)', () => {
    expect(gapBetween('2026-10-19', '2026-10-21')).toBeNull()
    const [f, t] = range('2026-10-19', '2026-10-21')
    cal.learnClosedDays('NSE', 'AAA', f, t, sessionBars('2026-10-19', '2026-10-20', '2026-10-21'))
    expect(gapBetween('2026-10-19', '2026-10-21')).not.toBeNull()
  })

  it('a day with only the 1-hour Muhurat session stays a holiday, and is learned as one', () => {
    const muhurat = (d: string) => Array.from({ length: 61 }, (_, i) => ({ ts: Date.parse(`${d}T13:45:00Z`) - IST + i * 60_000 }))
    // Static: 21 Oct 2025 (Diwali)
    const [f, t] = range('2025-10-20', '2025-10-23')
    cal.learnClosedDays('NSE', 'AAA', f, t, [...sessionBars('2025-10-20'), ...muhurat('2025-10-21'), ...sessionBars('2025-10-23')])
    expect(cal.isNSEHoliday(Date.parse('2025-10-21T06:00:00Z'))).toBe(true)
    // Learned: Mon 1 Nov 2027 is not in the static list
    const [f2, t2] = range('2027-10-29', '2027-11-02')
    for (const who of ['AAA', 'BBB']) cal.learnClosedDays('NSE', who, f2, t2, [...sessionBars('2027-10-29'), ...muhurat('2027-11-01'), ...sessionBars('2027-11-02')])
    expect(cal.isNSEHoliday(Date.parse('2027-11-01T06:00:00Z'))).toBe(true)
  })

  it('learns nothing from days at the edges of a response (before listing, today)', () => {
    const [f, t] = range('2027-01-25', '2027-01-29')
    for (const who of ['AAA', 'BBB']) cal.learnClosedDays('NSE', who, f, t, sessionBars('2027-01-27', '2027-01-28'))
    expect(cal.isNSEHoliday(Date.parse('2027-01-26T06:00:00Z'))).toBe(false)
    expect(cal.isNSEHoliday(Date.parse('2027-01-29T06:00:00Z'))).toBe(false)
  })
})
