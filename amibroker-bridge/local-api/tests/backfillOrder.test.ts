/**
 * DataBridge Pro — download order and pacing tests
 *
 * Newest-first: every symbol gets its latest months before any symbol gets its oldest
 * history, and a symbol open in AmiBroker jumps the queue. Pacing: the shared limiter keeps
 * under the broker's per-minute cap and backs off when the broker still says "too many".
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-order-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'order.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let backfillQueue: any
let brokerManager: any
let RateLimiter: typeof import('../src/services/RateLimiter').RateLimiter

beforeAll(async () => {
  const db = await import('../src/db')
  await db.syncCachesPromise
  backfillQueue = (await import('../src/services/BackfillQueue')).backfillQueue
  brokerManager = (await import('../src/services/BrokerManager')).brokerManager
  RateLimiter = (await import('../src/services/RateLimiter')).RateLimiter
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

afterEach(() => {
  vi.useRealTimers()
})

/** Adapter whose history calls wait until `release()`, recording [ticker, from, to] in call order */
function gatedAdapter() {
  let open!: () => void
  const gate = new Promise<void>(r => { open = r })
  const calls: Array<{ token: string; from: Date; to: Date }> = []
  return {
    calls,
    release: () => open(),
    adapter: {
      maxIntradayHistoryDays: 95,
      on() {},
      subscribe: async () => {},
      unsubscribe: async () => {},
      disconnect: async () => {},
      getHistoricalBars: async (token: string, _i: string, from: Date, to: Date) => {
        calls.push({ token, from, to })
        await gate
        return []
      },
    },
  }
}

describe('Download order', () => {
  it('fetches the newest chunk of every symbol first, and an AmiBroker symbol jumps the queue', async () => {
    const g = gatedAdapter()
    brokerManager.activeAdapters.set('fyers-order', g.adapter)
    const tickers = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8']
    for (const t of tickers) backfillQueue.enqueue(t, 'fyers-order', `NSE:${t}-EQ`, 150) // 2 chunks each

    // 6 workers take the newest chunk of O1..O6 and wait at the gate
    await vi.waitFor(() => expect(g.calls.length).toBe(6))
    backfillQueue.prioritize('O8')
    g.release()
    await vi.waitFor(() => expect(g.calls.length).toBe(16), { timeout: 10_000 })

    const now = Date.now()
    const newest = (c: { to: Date }) => now - c.to.getTime() < 60_000
    const order = g.calls.map(c => `${c.token.slice(4, 6)}${newest(c) ? 'new' : 'old'}`)
    // O8 (open in AmiBroker) is fetched next, ahead of O7, and finishes before the regular symbols
    expect(order.slice(0, 6).every(o => o.endsWith('new'))).toBe(true)
    expect(order[6]).toBe('O8new')
    expect(order.indexOf('O8old')).toBeLessThan(order.indexOf('O7old'))
    // No symbol's older chunk before every symbol's newest chunk (O8's priority aside)
    const firstOld = order.findIndex(o => o.endsWith('old') && !o.startsWith('O8'))
    expect(order.slice(0, firstOld).filter(o => o.endsWith('new')).length).toBe(8)
    // Each task walks backwards: newest window, then the older one
    for (const t of tickers) {
      const mine = g.calls.filter(c => c.token === `NSE:${t}-EQ`)
      expect(mine[0].from.getTime()).toBeGreaterThan(mine[1].from.getTime())
      expect(mine[1].to.getTime()).toBe(mine[0].from.getTime())
    }
  })
})

describe('Pacing', () => {
  it('holds requests over the per-minute cap until the window frees up', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(10, 3)
    await rl.acquire(); await rl.acquire(); await rl.acquire()
    let fourth = false
    rl.acquire().then(() => { fourth = true })
    await vi.advanceTimersByTimeAsync(59_000)
    expect(fourth).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(fourth).toBe(true)
  })

  it('after a "too many requests" reply: waits out the broker window and lowers the budget', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(4, 48)
    await rl.acquire()
    rl.limited()
    expect(rl.perMinuteBudget).toBe(43)
    let next = false
    rl.acquire().then(() => { next = true })
    await vi.advanceTimersByTimeAsync(59_000)
    expect(next).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(next).toBe(true)
  })
})
