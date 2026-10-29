import { describe, it, expect } from 'vitest'
import { expiryOf, isExpired, monthLabel, todayIst } from './expiry'

describe('expiry of a symbol', () => {
  it('reads monthly futures and options from the ticker', () => {
    expect(expiryOf('RELIANCE26OCTFUT')).toEqual({ month: '2026-10' })
    expect(expiryOf('NIFTY26NOV24000CE')).toEqual({ month: '2026-11' })
    expect(expiryOf('M&M26DECFUT')).toEqual({ month: '2026-12' })
    expect(expiryOf('NSE:BANKNIFTY26SEP52000.5PE')).toEqual({ month: '2026-09' })
  })

  it('reads weekly options (month 1-9, O, N, D and the day)', () => {
    expect(expiryOf('NIFTY26O2117350CE')).toEqual({ month: '2026-10', date: '2026-10-21' })
    expect(expiryOf('NIFTY2610217350CE')).toEqual({ month: '2026-01', date: '2026-01-02' })
    expect(expiryOf('NIFTY26N0424000PE')).toEqual({ month: '2026-11', date: '2026-11-04' })
    expect(expiryOf('SENSEX2630580000CE')).toEqual({ month: '2026-03', date: '2026-03-05' })
  })

  it('prefers the date from the broker list', () => {
    expect(expiryOf('RELIANCE26NOVFUT', '2026-11-24')).toEqual({ month: '2026-11', date: '2026-11-24' })
  })

  it('has none for cash shares and indices', () => {
    for (const t of ['RELIANCE', 'NIFTY', 'NIFTY50', 'BAJAJ-AUTO', 'M&M', 'NIFTYNXT50', 'TCS', '3MINDIA']) expect(expiryOf(t), t).toBeNull()
  })

  it('knows what has certainly expired', () => {
    expect(isExpired({ month: '2026-09' }, '2026-10-28')).toBe(true)
    expect(isExpired({ month: '2026-10' }, '2026-10-28')).toBe(false) // day not known: maybe still trading
    expect(isExpired({ month: '2026-10', date: '2026-10-27' }, '2026-10-28')).toBe(true)
    expect(isExpired({ month: '2026-11', date: '2026-11-24' }, '2026-10-28')).toBe(false)
  })

  it('labels months and uses the Indian date', () => {
    expect(monthLabel('2026-11')).toBe('Nov 2026')
    expect(todayIst(Date.parse('2026-10-27T19:00:00Z'))).toBe('2026-10-28') // 00:30 IST
  })
})
