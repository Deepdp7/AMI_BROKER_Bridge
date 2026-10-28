import { describe, it, expect } from 'vitest'
import type { SymbolFeed } from '../store/appStore'
import { viewRows, filterCounts, nextSort, breadth, trendOf } from './feedView'
import { sessionInfo, formatCountdown } from './marketClock'
import { formatAgo, formatDuration } from './format'

const sym = (ticker: string, over: Partial<SymbolFeed> = {}): SymbolFeed => ({
  ticker, exchange: 'NSE', instrumentType: 'EQ', lastPrice: 100, prevClose: 100, lastTickUtcMs: 0, barsPerMin: 0,
  internalLatencyMs: 0, status: 'STALE', change: 0, changePercent: 0, volume: 0, ...over,
})

const list = [
  sym('TCS', { changePercent: 1.2, status: 'STREAMING', lastPrice: 4000 }),
  sym('INFY', { changePercent: -0.8, status: 'STALE', lastPrice: 1500 }),
  sym('SBIN', { changePercent: 0, status: 'RECEIVING', lastPrice: 800, exchange: 'BSE' }),
  sym('ITC', { changePercent: 2.5, status: 'STALE', lastPrice: 450 }),
]
const none = new Set<string>()
const base = { search: '', filter: 'all' as const, exchange: 'ALL', sort: { key: null, dir: 1 as const }, pinned: none }

describe('Feed Status table rows', () => {
  it('quick filters and their counts agree', () => {
    const counts = filterCounts(list, new Set(['ITC']))
    expect(counts).toEqual({ all: 4, streaming: 2, stale: 2, gainers: 2, losers: 1, pinned: 1 })
    expect(viewRows(list, { ...base, filter: 'streaming' }).map(s => s.ticker)).toEqual(['TCS', 'SBIN'])
    expect(viewRows(list, { ...base, filter: 'losers' }).map(s => s.ticker)).toEqual(['INFY'])
  })

  it('search matches the name, an exchange typed in full, and the exchange picker narrows', () => {
    expect(viewRows(list, { ...base, search: 'inf' }).map(s => s.ticker)).toEqual(['INFY'])
    expect(viewRows(list, { ...base, search: 'bse' }).map(s => s.ticker)).toEqual(['SBIN'])
    expect(viewRows(list, { ...base, exchange: 'NSE' })).toHaveLength(3)
  })

  it('sorting: change % biggest first, then reversed, then back to the original order', () => {
    let sort = nextSort({ key: null, dir: 1 }, 'change')
    expect(viewRows(list, { ...base, sort }).map(s => s.ticker)).toEqual(['ITC', 'TCS', 'SBIN', 'INFY'])
    sort = nextSort(sort, 'change')
    expect(viewRows(list, { ...base, sort }).map(s => s.ticker)).toEqual(['INFY', 'SBIN', 'TCS', 'ITC'])
    sort = nextSort(sort, 'change')
    expect(sort.key).toBeNull()
    expect(viewRows(list, { ...base, sort }).map(s => s.ticker)).toEqual(['TCS', 'INFY', 'SBIN', 'ITC'])
    expect(nextSort({ key: null, dir: 1 }, 'ticker')).toEqual({ key: 'ticker', dir: 1 })
  })

  it('pinned symbols stay on top whatever the sort', () => {
    const rows = viewRows(list, { ...base, pinned: new Set(['INFY']), sort: { key: 'change', dir: -1 } })
    expect(rows.map(s => s.ticker)).toEqual(['INFY', 'ITC', 'TCS', 'SBIN'])
  })

  it('breadth counts up/down/flat and finds the biggest movers; symbols without a price are left out', () => {
    const b = breadth([...list, sym('NOPRICE', { lastPrice: 0, changePercent: 9 })])
    expect({ up: b.up, down: b.down, flat: b.flat }).toEqual({ up: 2, down: 1, flat: 1 })
    expect(b.best?.ticker).toBe('ITC')
    expect(b.worst?.ticker).toBe('INFY')
  })

  it('trend keeps one sample a second, the last 20', () => {
    const t = 1_000_000
    trendOf('X', 10, t)
    trendOf('X', 11, t + 200) // same second: ignored
    for (let i = 1; i <= 25; i++) trendOf('X', 10 + i, t + i * 1000)
    const v = trendOf('X', 99, t + 25_500)
    expect(v).toHaveLength(20)
    expect(v[v.length - 1]).toBe(35)
  })
})

describe('Market clock', () => {
  const ist = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi) - 5.5 * 3600_000

  it('in session: progress and time to the close', () => {
    const s = sessionInfo(ist(2026, 10, 28, 12, 22)) // Wednesday
    expect(s.inSession).toBe(true)
    expect(s.progress).toBeCloseTo(0.5, 1)
    expect(formatCountdown(s.msToNext)).toBe('3h 08m')
  })

  it('before the open the same day, after the close, and over a weekend', () => {
    expect(sessionInfo(ist(2026, 10, 28, 8, 45))).toMatchObject({ inSession: false, nextOpenDay: 'Today', msToNext: 30 * 60_000 })
    expect(sessionInfo(ist(2026, 10, 28, 16, 0))).toMatchObject({ inSession: false, nextOpenDay: 'Tomorrow' })
    const fri = sessionInfo(ist(2026, 10, 30, 18, 0)) // Friday evening → Monday
    expect(fri.nextOpenDay).toBe('Mon')
    expect(formatCountdown(fri.msToNext)).toBe('2d 15h')
  })
})

describe('Plain time words', () => {
  it('ago and durations', () => {
    const now = 10_000_000
    expect(formatAgo(0, now)).toBe('—')
    expect(formatAgo(now - 500, now)).toBe('Just now')
    expect(formatAgo(now - 42_000, now)).toBe('42s ago')
    expect(formatAgo(now - (9 * 3600 + 26 * 60) * 1000, now)).toBe('9h 26m ago')
    expect(formatAgo(now - 3 * 86400_000, now)).toBe('3d ago')
    expect(formatDuration(125 * 60)).toBe('2h 05m')
  })
})
