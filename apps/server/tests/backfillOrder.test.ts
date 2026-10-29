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
let RateLimiter: typeof import('../src/lib/RateLimiter').RateLimiter

beforeAll(async () => {
  const db = await import('../src/db')
  await db.syncCachesPromise
  backfillQueue = (await import('../src/market/BackfillQueue')).backfillQueue
  brokerManager = (await import('../src/brokers/BrokerManager')).brokerManager
  RateLimiter = (await import('../src/lib/RateLimiter')).RateLimiter
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

describe('Pause, resume, cancel (the download card)', () => {
  it('paused: nothing is fetched and the queue is kept; resume fetches it; cancel empties it', async () => {
    const calls: string[] = []
    brokerManager.activeAdapters.set('fyers-pause', {
      maxIntradayHistoryDays: 95,
      on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
      getHistoricalBars: async (token: string) => { calls.push(token); return [] },
    })
    const events: any[] = []
    const onControl = (e: any) => events.push(e)
    backfillQueue.on('backfill_control', onControl)
    try {
      backfillQueue.pause()
      expect(backfillQueue.isPaused()).toBe(true)
      for (const t of ['P1', 'P2', 'P3']) backfillQueue.enqueue(t, 'fyers-pause', `NSE:${t}-EQ`, 30)
      await new Promise(r => setTimeout(r, 300))
      expect(calls).toEqual([])
      expect(backfillQueue.getQueueLength()).toBe(3)
      expect(backfillQueue.hasActiveWork()).toBe(false) // auto-refresh may use the broker meanwhile

      backfillQueue.resume()
      await vi.waitFor(() => expect(calls.length).toBe(3))

      backfillQueue.pause()
      for (const t of ['P4', 'P5']) backfillQueue.enqueue(t, 'fyers-pause', `NSE:${t}-EQ`, 30)
      backfillQueue.cancelAll()
      expect(backfillQueue.getQueueLength()).toBe(0)
      expect(events.map(e => [e.paused, !!e.cancelled])).toEqual([[true, false], [false, false], [true, false], [true, true]])
    } finally {
      backfillQueue.off('backfill_control', onControl)
      backfillQueue.resume()
    }
  })

  it('Cancel sticks: no automatic downloads for those symbols until they are allowed again', async () => {
    const calls: string[] = []
    brokerManager.activeAdapters.set('fyers-cancel', {
      maxIntradayHistoryDays: 95,
      on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
      getHistoricalBars: async (token: string) => { calls.push(token); return [] },
    })
    backfillQueue.pause()
    try {
      for (const t of ['C1', 'C2']) backfillQueue.enqueue(t, 'fyers-cancel', `NSE:${t}-EQ`, 30)
      await vi.waitFor(() => expect(backfillQueue.getQueueLength()).toBe(2))
      backfillQueue.cancelAll(true)
      expect(backfillQueue.isSkipped('C1')).toBe(true)
      // Survives a restart: at startup the settings cache holds the stored JSON text (not the
      // array), exactly what a single-key upsert of that text leaves behind
      const db = await import('../src/db')
      const stored = (db.getAllSettings() as any).historySkipped
      db.upsertSettings('historySkipped', JSON.stringify(stored))
      expect(typeof (db.getAllSettings() as any).historySkipped).toBe('string')
      ;(backfillQueue as any).skipped = null
      expect(backfillQueue.isSkipped('C1') && backfillQueue.isSkipped('C2')).toBe(true)
      backfillQueue.resume()

      // What startup catch-up, the 30-min check and AmiBroker do: all ignored now
      backfillQueue.enqueue('C1', 'fyers-cancel', 'NSE:C1-EQ', 30)
      backfillQueue.enqueueGapPass('C2', 'fyers-cancel', 'NSE:C2-EQ', [{ fromMs: Date.now() - 86400_000, toMs: Date.now() }], Date.now())
      expect(await backfillQueue.extendHistory('C1', 'fyers-cancel', 'NSE:C1-EQ', 365)).toBe(false)
      await new Promise(r => setTimeout(r, 300))
      expect(backfillQueue.getQueueLength()).toBe(0)
      expect(calls).toEqual([])

      // The "Today" button still works for one symbol, without undoing the cancel
      backfillQueue.enqueueGapFill('C2', 'fyers-cancel', 'NSE:C2-EQ', Date.now() - 3600_000, Date.now(), true)
      await vi.waitFor(() => expect(calls).toEqual(['NSE:C2-EQ']))
      expect(backfillQueue.isSkipped('C2')).toBe(true)

      // "Download now"
      expect(backfillQueue.allowHistory().sort()).toEqual(['C1', 'C2'])
      backfillQueue.enqueue('C1', 'fyers-cancel', 'NSE:C1-EQ', 30)
      await vi.waitFor(() => expect(calls).toContain('NSE:C1-EQ'))
    } finally {
      backfillQueue.allowHistory()
      backfillQueue.resume()
    }
  })
})

describe('A name the broker doesn\'t have', () => {
  it('is asked for once, not retried chunk after chunk, and not queued again until re-added', async () => {
    const calls: string[] = []
    brokerManager.activeAdapters.set('fyers-bad', {
      maxIntradayHistoryDays: 95,
      on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
      getHistoricalBars: async (token: string) => {
        calls.push(token)
        throw Object.assign(new Error('Fyers API Error: Invalid symbol provided'), { code: -300 })
      },
    })
    backfillQueue.enqueue('TICKER', 'fyers-bad', 'NSE:TICKER-EQ', 150) // 2 chunks
    await vi.waitFor(() => expect(calls.length).toBe(1))
    await new Promise(r => setTimeout(r, 800))
    expect(calls.length).toBe(1)
    await vi.waitFor(() => expect(backfillQueue.getQueueLength()).toBe(0))

    // Startup catch-up and gap checks leave it alone
    backfillQueue.enqueue('TICKER', 'fyers-bad', 'NSE:TICKER-EQ', 150)
    backfillQueue.enqueueGapFill('TICKER', 'fyers-bad', 'NSE:TICKER-EQ', Date.now() - 86400_000, Date.now())
    await new Promise(r => setTimeout(r, 300))
    expect(calls.length).toBe(1)

    // Added again (or "Download now"): tried once more
    backfillQueue.allowHistory(['TICKER'])
    backfillQueue.enqueue('TICKER', 'fyers-bad', 'NSE:TICKER-EQ', 30)
    await vi.waitFor(() => expect(calls.length).toBe(2))
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
    expect(rl.perMinuteBudget).toBe(24) // refused after 1 request: throttled, so at most halve
    let next = false
    rl.acquire().then(() => { next = true })
    await vi.advanceTimersByTimeAsync(59_000)
    expect(next).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(next).toBe(true)
  })

  it('refused at the normal limit: only a small cut', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(48, 48)
    for (let i = 0; i < 48; i++) await rl.acquire()
    rl.limited()
    expect(rl.perMinuteBudget).toBe(43)
  })

  /** acquire() under fake timers: moves the clock until the limiter lets the request start */
  async function acquireFake(rl: InstanceType<typeof RateLimiter>) {
    let done = false
    rl.acquire().then(() => { done = true })
    while (!done) await vi.advanceTimersByTimeAsync(250)
  }

  it('throttled account (broker accepts ~5/min): finds that rate in a few refusals, then spaces requests', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(4, 48)
    const accepted = 5
    const budgets: number[] = []
    // Broker: the 6th request inside any 60 s is refused
    const sentAt: number[] = []
    for (let round = 0; round < 12; round++) {
      await acquireFake(rl)
      const now = Date.now()
      const inWindow = sentAt.filter(t => now - t < 60_000).length
      sentAt.push(now)
      if (inWindow >= accepted) { rl.limited(); budgets.push(rl.perMinuteBudget) }
    }
    expect(budgets[0]).toBe(24)
    expect(rl.perMinuteBudget).toBeLessThanOrEqual(12)
    // Lowered budget: requests are spread over the minute, not sent together
    const t0 = Date.now()
    await acquireFake(rl)
    await acquireFake(rl)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(Math.floor(60_000 / rl.perMinuteBudget) - 1)
  })

  it('climbs back once the broker stops refusing', async () => {
    vi.useFakeTimers()
    const rl = new RateLimiter(4, 48)
    await rl.acquire()
    rl.limited(); await vi.advanceTimersByTimeAsync(2_000)
    rl.limited(); await vi.advanceTimersByTimeAsync(2_000)
    rl.limited()
    const low = rl.perMinuteBudget
    expect(low).toBeLessThan(10)
    for (let i = 0; i < 40; i++) { await vi.advanceTimersByTimeAsync(3 * 60_000 + 1_000); await rl.acquire() }
    expect(rl.perMinuteBudget).toBe(48)
  })
})
