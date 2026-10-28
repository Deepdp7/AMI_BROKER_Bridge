/**
 * Live updates must not redraw what didn't change: the store keeps the same objects (and the
 * same list) when the values are the same, so memoised screens skip their work.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore, type SymbolFeed } from './appStore'
import { useThrottledSymbols } from '../hooks/useThrottledSymbols'
import { freshSymbol, sameSymbol } from '../hooks/useApiSync'

const sym = (ticker: string, over: Partial<SymbolFeed> = {}): SymbolFeed => ({
  ticker, exchange: 'NSE', instrumentType: 'EQ', lastPrice: 100, prevClose: 100, lastTickUtcMs: 1, barsPerMin: 0,
  internalLatencyMs: 0, status: 'STALE', change: 0, changePercent: 0, volume: 0, ...over,
})

beforeEach(() => {
  useAppStore.setState({ symbols: Array.from({ length: 500 }, (_, i) => sym(`S${i}`)) })
})

describe('Live updates', () => {
  it('the same values again change nothing: same list, no redraw', () => {
    const before = useAppStore.getState().symbols
    const listener = vi.fn()
    const off = useAppStore.subscribe(listener)
    useAppStore.getState().batchUpdateSymbolFeeds(before.map(s => ({ ticker: s.ticker, update: { lastPrice: 100, status: 'STALE' } })))
    off()
    expect(useAppStore.getState().symbols).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('one price moves: only that symbol gets a new object', () => {
    const before = useAppStore.getState().symbols
    useAppStore.getState().batchUpdateSymbolFeeds([
      { ticker: 'S7', update: { lastPrice: 101 } },
      { ticker: 'S8', update: { lastPrice: 100 } },
    ])
    const after = useAppStore.getState().symbols
    expect(after).not.toBe(before)
    expect(after[7]).not.toBe(before[7])
    expect(after[7].lastPrice).toBe(101)
    expect(after[8]).toBe(before[8])
    expect(after[0]).toBe(before[0])
  })

  it('a new ticker is added at the end', () => {
    useAppStore.getState().batchUpdateSymbolFeeds([{ ticker: 'NEW', update: { lastPrice: 5, status: 'STREAMING' } }])
    const after = useAppStore.getState().symbols
    expect(after).toHaveLength(501)
    expect(after[500]).toMatchObject({ ticker: 'NEW', lastPrice: 5, status: 'STREAMING' })
  })

  it('engine stats and market status that did not change cause no redraw', () => {
    useAppStore.getState().updateCoreStats({ cpuPercent: 3, ramMb: 180 })
    useAppStore.getState().setMarketStatus('closed')
    const listener = vi.fn()
    const off = useAppStore.subscribe(listener)
    useAppStore.getState().updateCoreStats({ cpuPercent: 3, ramMb: 180 })
    useAppStore.getState().setMarketStatus('closed')
    off()
    expect(listener).not.toHaveBeenCalled()
  })

  it('a resync keeps the objects of symbols that did not change', () => {
    const old = sym('A', { brokerId: 'f1', rawSymbol: 'NSE:A-EQ' })
    const same = freshSymbol({ ...old }, old)
    expect(sameSymbol(old, same)).toBe(true)
    expect(sameSymbol(old, freshSymbol({ ...old, lastPrice: 99 }, old))).toBe(false)
  })
})

describe('Throttled symbol list (Symbol Setup, Broker Connection)', () => {
  it('price updates show at most once per period; adding or removing shows at once', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useThrottledSymbols(1000))
      const first = result.current
      act(() => { vi.advanceTimersByTime(1200) })

      act(() => { useAppStore.getState().batchUpdateSymbolFeeds([{ ticker: 'S1', update: { lastPrice: 1 } }]) })
      const afterFirstTick = result.current // leading edge: shown
      expect(afterFirstTick).not.toBe(first)

      act(() => { useAppStore.getState().batchUpdateSymbolFeeds([{ ticker: 'S2', update: { lastPrice: 2 } }]) })
      act(() => { useAppStore.getState().batchUpdateSymbolFeeds([{ ticker: 'S3', update: { lastPrice: 3 } }]) })
      expect(result.current).toBe(afterFirstTick) // held back
      act(() => { vi.advanceTimersByTime(1000) })
      expect(result.current[3].lastPrice).toBe(3) // the latest, once

      act(() => { useAppStore.getState().removeSymbol('S4') })
      expect(result.current).toHaveLength(499) // at once
    } finally {
      vi.useRealTimers()
    }
  })
})
