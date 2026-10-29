import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, type SymbolFeed } from '../store/appStore'
import { restoreSnapshot, saveSnapshot } from './startupSnapshot'

const sym = (ticker: string, status: SymbolFeed['status'] = 'STREAMING') =>
  ({ ticker, exchange: 'NSE', instrumentType: 'EQ', lastPrice: 100, prevClose: 99, lastTickUtcMs: 1, barsPerMin: 1, internalLatencyMs: 5, status, change: 1, changePercent: 1, volume: 10 }) as SymbolFeed

describe('startup snapshot', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ symbols: [] })
  })

  it('puts the last session\'s symbols back on screen, not claiming they still stream', () => {
    useAppStore.setState({ symbols: [sym('TCS'), sym('INFY', 'STALE')] })
    saveSnapshot(Date.now())
    useAppStore.setState({ symbols: [] })
    expect(restoreSnapshot()).toBe(true)
    const restored = useAppStore.getState().symbols
    expect(restored.map(s => [s.ticker, s.status, s.lastPrice])).toEqual([['TCS', 'STALE', 100], ['INFY', 'STALE', 100]])
  })

  it('shows nothing old: no snapshot, an empty one, or one from weeks ago', () => {
    expect(restoreSnapshot()).toBe(false)
    useAppStore.setState({ symbols: [sym('TCS')] })
    saveSnapshot(Date.now() - 30 * 24 * 3600_000)
    useAppStore.setState({ symbols: [] })
    expect(restoreSnapshot()).toBe(false)
    expect(useAppStore.getState().symbols).toEqual([])
  })

  it('never replaces live data that is already there', () => {
    useAppStore.setState({ symbols: [sym('TCS')] })
    saveSnapshot()
    useAppStore.setState({ symbols: [sym('LIVE')] })
    expect(restoreSnapshot()).toBe(false)
    expect(useAppStore.getState().symbols[0].ticker).toBe('LIVE')
  })
})
