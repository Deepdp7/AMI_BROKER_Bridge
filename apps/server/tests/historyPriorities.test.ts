/**
 * Stage 3: a broker's rate limiter serves history requests by urgency (a chart's, then the
 * auto-refresh's, then bulk downloads), without letting either side starve the other.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RateLimiter, limiterStats } from '../src/lib/RateLimiter'
import { withPriority, currentPriority, setPrioritiesEnabled, type Priority } from '../src/lib/priority'

afterEach(() => {
  vi.useRealTimers()
  setPrioritiesEnabled(() => true)
})

/** Asks for a slot with a priority and records the order they are served in */
function ask(rl: RateLimiter, served: string[], label: string, priority: Priority) {
  return withPriority(priority, () => rl.acquire()).then(() => { served.push(label) })
}

describe('priority classes in the rate limiter', () => {
  it('an interactive request goes before a refresh, which goes before bulk; first come first served inside a class', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(100, 3)
    for (let i = 0; i < 3; i++) await rl.acquire()                    // the minute's budget is used up
    const served: string[] = []
    ask(rl, served, 'bulk1', 'bulk')
    ask(rl, served, 'refresh1', 'refresh')
    ask(rl, served, 'bulk2', 'bulk')
    ask(rl, served, 'interactive1', 'interactive')
    ask(rl, served, 'interactive2', 'interactive')
    expect(rl.pendingByClass).toEqual({ interactive: 2, refresh: 1, bulk: 2 })
    expect(limiterStats().find(l => l.name === rl.name)?.pendingByClass.bulk).toBe(2)

    await vi.advanceTimersByTimeAsync(61_000)
    expect(served).toEqual(['interactive1', 'interactive2', 'refresh1'])   // the minute's three slots
    await vi.advanceTimersByTimeAsync(61_000)
    expect(served.slice(3)).toEqual(['bulk1', 'bulk2'])
    expect(rl.pending).toBe(0)
  })

  it('bulk requests keep to 70% of the budget for a minute after an urgent one had to wait', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(1000, 10)
    // Bulk used the whole minute: nothing urgent had waited, so nothing held it back
    for (let i = 0; i < 10; i++) await withPriority('bulk', () => rl.acquire())
    const served: string[] = []
    ask(rl, served, 'interactive', 'interactive')                       // has to wait: the budget is used up
    for (let i = 0; i < 12; i++) ask(rl, served, `bulk${i}`, 'bulk')

    await vi.advanceTimersByTimeAsync(61_000)                           // the first minute's requests are out of the window
    const bulkStarted = served.filter(s => s.startsWith('bulk')).length
    expect(served[0]).toBe('interactive')
    expect(bulkStarted).toBe(7)                                          // 70% of 10, not the 9 left in the budget
    expect(rl.pending).toBe(5)

    await vi.advanceTimersByTimeAsync(60_000)                           // a minute later the earlier bulk starts have expired
    expect(served.filter(s => s.startsWith('bulk')).length).toBe(12)
  })

  it('bulk may use the whole budget when no urgent request has waited', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(1000, 10)
    const served: string[] = []
    for (let i = 0; i < 12; i++) ask(rl, served, `bulk${i}`, 'bulk')
    await vi.advanceTimersByTimeAsync(10)
    expect(served.length).toBe(10)
    await vi.advanceTimersByTimeAsync(61_000)
    expect(served.length).toBe(12)
  })

  it('an urgent request is not held back by a bulk request that is waiting for its share', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(1000, 10)
    for (let i = 0; i < 10; i++) await withPriority('bulk', () => rl.acquire())
    const served: string[] = []
    ask(rl, served, 'interactive0', 'interactive')
    for (let i = 0; i < 9; i++) ask(rl, served, `bulk${i}`, 'bulk')
    await vi.advanceTimersByTimeAsync(61_000)                           // interactive0 and 7 bulk are out; bulk7 waits for its share
    ask(rl, served, 'interactive1', 'interactive')
    await vi.advanceTimersByTimeAsync(10)
    expect(served).toContain('interactive1')                            // served at once: the budget has room
  })

  it('with historyPriorities off every request waits in the order it came', async () => {
    vi.useFakeTimers()
    setPrioritiesEnabled(() => false)
    const rl = new RateLimiter(100, 3)
    for (let i = 0; i < 3; i++) await rl.acquire()
    const served: string[] = []
    ask(rl, served, 'bulk1', 'bulk')
    ask(rl, served, 'interactive1', 'interactive')
    ask(rl, served, 'bulk2', 'bulk')
    await vi.advanceTimersByTimeAsync(61_000)
    expect(served).toEqual(['bulk1', 'interactive1', 'bulk2'])
  })

  it('keeps the pacing: the per-second cap, a pause, and a lowered budget apply to every class', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(2, 100)
    const served: string[] = []
    for (let i = 0; i < 4; i++) ask(rl, served, `r${i}`, 'refresh')
    await vi.advanceTimersByTimeAsync(10)
    expect(served.length).toBe(2)                                       // 2 a second
    await vi.advanceTimersByTimeAsync(1_000)
    expect(served.length).toBe(4)

    rl.pause(5_000)
    ask(rl, served, 'after-pause', 'interactive')
    await vi.advanceTimersByTimeAsync(4_000)
    expect(served).not.toContain('after-pause')
    await vi.advanceTimersByTimeAsync(1_500)
    expect(served).toContain('after-pause')
  })
})

describe('the priority follows a request through its awaits', () => {
  it('withPriority sets it for everything the function does, and the default is refresh', async () => {
    expect(currentPriority()).toBe('refresh')
    const seen = await withPriority('bulk', async () => {
      await Promise.resolve()
      await new Promise(r => setTimeout(r, 5))
      return [currentPriority(), await withPriority('interactive', async () => { await Promise.resolve(); return currentPriority() }), currentPriority()]
    })
    expect(seen).toEqual(['bulk', 'interactive', 'bulk'])
    expect(currentPriority()).toBe('refresh')
  })
})

describe('what the download queue asks with', () => {
  it('a chart goes first with its newest chunk; the years behind it are bulk, or a scan would hold up the auto-refresh', async () => {
    const { backfillQueue } = await import('../src/market/BackfillQueue')
    const q = backfillQueue as any
    const seen: Priority[] = []
    const route = { id: 'b', helper: false, token: 't', release() {}, adapter: { getHistoricalBars: async () => { seen.push(currentPriority()); return [] } } }
    const fetch = (task: object) => q.fetchChunk({ brokerId: 'b', retryCount: 0, ...task }, route, new Date(0), new Date(1))
    q.priorityTickers.add('CHART')
    try {
      await fetch({ ticker: 'CHART' })
      await fetch({ ticker: 'CHART', cursorTo: new Date(0) })
      await fetch({ ticker: 'OTHER' })
      await fetch({ ticker: 'OTHER', interactive: true, cursorTo: new Date(0) })   // a manual refresh, all of it
    } finally { q.priorityTickers.delete('CHART') }
    expect(seen).toEqual(['interactive', 'bulk', 'bulk', 'interactive'])
  })
})
