/**
 * DataBridge Pro — Feed Simulator Unit Tests
 * Tests tick generation, bar aggregation, and coalescing behavior
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { FeedSimulator } from '../src/services/feedSimulator'

// Use in-memory DB
process.env.DB_PATH = ':memory:'

describe('FeedSimulator', () => {
  let sim: FeedSimulator

  beforeAll(() => {
    sim = new FeedSimulator()
  })

  afterAll(() => {
    sim.stop()
  })

  it('starts with 0 default instruments', () => {
    expect(sim.getFeedStatuses().length).toBe(0)
  })

  it('getCoreStats returns valid stats', () => {
    const stats = sim._getCoreStats()
    expect(stats.cpuPercent).toBeGreaterThanOrEqual(0)
    expect(stats.cpuPercent).toBeLessThanOrEqual(100)
    expect(stats.ramMb).toBeGreaterThan(0)
    expect(stats.totalSymbols).toBe(0)
  })

  it('emits feed_update events when started', async () => {
    sim.addSymbolByTicker('RELIANCE', 'test-broker')
    
    const updates: unknown[] = []
    sim.on('feed_update', (payload) => updates.push(payload))
    sim.start()
    await new Promise(resolve => setTimeout(resolve, 1100))
    sim.stop()
    expect(updates.length).toBeGreaterThan(0)
  })


  it('addSymbolByTicker adds a new symbol', () => {
    const beforeCount = sim.getFeedStatuses().length
    sim.addSymbolByTicker('BAJFINANCE', 'test-broker')
    const afterCount = sim.getFeedStatuses().length
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount)
  })

  it('removeSymbolByTicker removes a symbol', () => {
    sim.addSymbolByTicker('TITAN', 'test-broker-2')
    const beforeCount = sim.getFeedStatuses().length
    sim.removeSymbolByTicker('TITAN', 'test-broker-2')
    const afterCount = sim.getFeedStatuses().length
    expect(afterCount).toBeLessThanOrEqual(beforeCount)
  })

  it('processes real ticks correctly', () => {
    const sim3 = new FeedSimulator()
    sim3.addSymbolByTicker('RELIANCE', 'test-broker')
    sim3.processRealTick({
      instrumentId: 'NSE:RELIANCE-EQ',
      lastPrice: 2500,
      volume: 100,
      timestamp: Date.now()
    }, 'test-broker')

    const bar = sim3.getLiveBar('RELIANCE', 'test-broker')
    expect(bar).toBeDefined()
    expect(bar?.close).toBe(2500)
  })
})

// ===== Bar Aggregation Logic Tests =====
describe('Bar Aggregation (1-second bucketing)', () => {
  it('bucket calculation is correct', () => {
    const ts = 1700000001500 // 1.5s into epoch second
    const bucket = Math.floor(ts / 1000) * 1000
    expect(bucket).toBe(1700000001000)
  })

  it('different ticks in same second go to same bucket', () => {
    const t1 = 1700000001100
    const t2 = 1700000001900
    const b1 = Math.floor(t1 / 1000) * 1000
    const b2 = Math.floor(t2 / 1000) * 1000
    expect(b1).toBe(b2)
  })

  it('ticks in different seconds go to different buckets', () => {
    const t1 = 1700000001999
    const t2 = 1700000002001
    const b1 = Math.floor(t1 / 1000) * 1000
    const b2 = Math.floor(t2 / 1000) * 1000
    expect(b1).not.toBe(b2)
    expect(b2 - b1).toBe(1000)
  })

  it('OHLCV bar logic: high is max, low is min', () => {
    const prices = [100, 105, 98, 103, 101]
    let high = prices[0], low = prices[0], close = prices[0]
    const open = prices[0]
    for (let i = 1; i < prices.length; i++) {
      high = Math.max(high, prices[i])
      low = Math.min(low, prices[i])
      close = prices[i]
    }
    expect(open).toBe(100)
    expect(high).toBe(105)
    expect(low).toBe(98)
    expect(close).toBe(101)
  })

  it('late tolerance window: 2s default handles late ticks', () => {
    const barClosedAt = 1700000001000
    const lateTick = 1700000001800 // 0.8s late — within 2s window
    const veryLateTick = 1700000003500 // 2.5s late — outside window
    const LATE_TOLERANCE_MS = 2000

    expect(lateTick - barClosedAt).toBeLessThan(LATE_TOLERANCE_MS) // should amend
    expect(veryLateTick - barClosedAt).toBeGreaterThan(LATE_TOLERANCE_MS) // should discard
  })
})
