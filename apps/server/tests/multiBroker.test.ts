/**
 * DataBridge Pro — history downloads spread over every connected broker
 *
 * Each broker gets its own download slots; a chunk goes to the fastest broker with a free slot.
 * Another broker only "helps": when it has nothing or fails, the symbol's own broker fetches
 * that period, and a helper's trouble never pauses the queue.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-multi-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'multi.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let backfillQueue: any
let statusMap: Map<string, any>
let brokerManager: any
let db: typeof import('../src/db')

const DAY = 86_400_000

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  const bq = await import('../src/market/BackfillQueue')
  backfillQueue = bq.backfillQueue
  statusMap = bq.backfillStatusMap
  brokerManager = (await import('../src/brokers/BrokerManager')).brokerManager
})

afterEach(() => {
  backfillQueue.cancelAll()
  brokerManager.activeAdapters.clear()
  db.upsertSettings('historyUseAllBrokers', 'true')
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

interface FakeOpts { perMinute: number; days: number; delayMs?: number; emptyBefore?: number; fail?: () => Error | null; resolves?: boolean }

/** A broker whose history answers one valid bar per request (inside the requested range) */
function fakeBroker(o: FakeOpts) {
  const calls: Array<{ token: string; from: number; to: number; empty: boolean }> = []
  const state = { inFlight: 0, maxInFlight: 0 }
  const adapter: any = {
    maxIntradayHistoryDays: o.days,
    historyRequestsPerMinute: () => o.perMinute,
    on() {}, subscribe: async () => {}, unsubscribe: async () => {}, disconnect: async () => {},
    getHistoricalBars: async (token: string, _i: string, from: Date, to: Date) => {
      state.inFlight++
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
      try {
        if (o.delayMs) await new Promise(r => setTimeout(r, o.delayMs))
        const err = o.fail?.()
        if (err) throw err
        const empty = o.emptyBefore !== undefined && to.getTime() <= o.emptyBefore
        calls.push({ token, from: from.getTime(), to: to.getTime(), empty })
        if (empty) return []
        const ts = Math.floor((from.getTime() + 3600_000) / 60_000) * 60_000
        return [{ ts, open: 100, high: 101, low: 99, close: 100, volume: 10 }]
      } finally {
        state.inFlight--
      }
    },
  }
  if (o.resolves !== false) adapter.resolveSymbol = async (t: string) => `TOK:${t}`
  return { adapter, calls, state }
}

/** Queues a history range per ticker (gap fills: no extra gap scan afterwards) */
async function queue(tickers: string[], ownerId: string, fromDaysAgo: number, toDaysAgo = 1) {
  const now = Date.now()
  for (const t of tickers) backfillQueue.enqueueGapFill(t, ownerId, `OWN:${t}`, now - fromDaysAgo * DAY, now - toDaysAgo * DAY)
  // Tasks are added a moment later (the symbol is resolved first) and may finish at once: wait for each to complete
  await vi.waitFor(() => expect(tickers.filter(t => statusMap.get(t)?.status !== 'completed')).toEqual([]), { timeout: 15_000, interval: 10 })
}

const drained = () => vi.waitFor(() => expect(backfillQueue.getQueueLength()).toBe(0), { timeout: 2_000, interval: 10 })

/** Every requested range of `ticker`, over all brokers, must cover [from, to] without holes */
function covered(ticker: string, from: number, to: number, ...brokers: Array<ReturnType<typeof fakeBroker>>) {
  const ranges = brokers.flatMap(b => b.calls).filter(c => !c.empty && (c.token === `OWN:${ticker}` || c.token === `TOK:${ticker}`))
    .map(c => [c.from, c.to]).sort((a, b) => a[0] - b[0])
  let reach = from
  for (const [a, b] of ranges) { if (a > reach + 60_000) return false; reach = Math.max(reach, b) }
  return reach >= to - 60_000
}

describe('History downloads over several brokers', () => {
  it('sends chunks to the faster broker (Dhan-like 240/min beats Fyers-like 48/min)', async () => {
    const fyers = fakeBroker({ perMinute: 48, days: 95 })
    const dhan = fakeBroker({ perMinute: 240, days: 85 })
    brokerManager.activeAdapters.set('fyers-a', fyers.adapter)
    brokerManager.activeAdapters.set('dhan-a', dhan.adapter)
    await queue(['A1', 'A2', 'A3'], 'fyers-a', 170)
    await drained()
    expect(fyers.calls).toHaveLength(0)
    expect(dhan.calls.length).toBe(6) // 169 days / 85-day chunks = 2 per symbol
    expect(dhan.calls.every(c => c.token.startsWith('TOK:'))).toBe(true) // the symbol's own token on Dhan
    const now = Date.now()
    for (const t of ['A1', 'A2', 'A3']) expect(covered(t, now - 170 * DAY, now - DAY, fyers, dhan)).toBe(true)
  })

  it('two brokers download at the same time: twice the parallel requests', async () => {
    const one = fakeBroker({ perMinute: 100, days: 30, delayMs: 40 })
    const two = fakeBroker({ perMinute: 100, days: 30, delayMs: 40 })
    brokerManager.activeAdapters.set('one-b', one.adapter)
    brokerManager.activeAdapters.set('two-b', two.adapter)
    await queue(Array.from({ length: 24 }, (_, i) => `B${i}`), 'one-b', 59)
    await drained()
    expect(one.state.maxInFlight).toBe(6)
    expect(two.state.maxInFlight).toBe(6)
    expect(one.calls.length + two.calls.length).toBe(48)
  })

  it('a helper with nothing for an older period: the own broker fetches it, nothing is lost', async () => {
    const now = Date.now()
    const fyers = fakeBroker({ perMinute: 48, days: 95 })
    const upstox = fakeBroker({ perMinute: 240, days: 28, emptyBefore: now - 100 * DAY }) // "only recent history"
    brokerManager.activeAdapters.set('fyers-c', fyers.adapter)
    brokerManager.activeAdapters.set('upstox-c', upstox.adapter)
    await queue(['C1'], 'fyers-c', 300)
    await drained()
    expect(upstox.calls.some(c => c.empty)).toBe(true)
    const emptyTo = upstox.calls.find(c => c.empty)!.to
    // The period the helper had nothing for is fetched again by the own broker
    expect(fyers.calls.some(c => c.to === emptyTo)).toBe(true)
    // ...and the helper isn't asked for anything older after that
    expect(upstox.calls.filter(c => c.to < emptyTo)).toHaveLength(0)
    expect(covered('C1', now - 300 * DAY, now - DAY, fyers, upstox)).toBe(true)
  })

  it("a helper's expired login sits it out; the queue never pauses and the own broker carries on", async () => {
    const fyers = fakeBroker({ perMinute: 48, days: 95 })
    const kite = fakeBroker({ perMinute: 170, days: 55, fail: () => Object.assign(new Error('Auth error: TokenException'), { code: -16 }) })
    brokerManager.activeAdapters.set('fyers-d', fyers.adapter)
    brokerManager.activeAdapters.set('kite-d', kite.adapter)
    await queue(['D1', 'D2'], 'fyers-d', 180)
    await drained()
    expect(backfillQueue.consecutiveAuthErrors).toBe(0)
    expect(backfillQueue.tokenPausedUntil).toBe(0)
    const now = Date.now()
    for (const t of ['D1', 'D2']) expect(covered(t, now - 180 * DAY, now - DAY, fyers)).toBe(true)
  })

  it('a helper that cannot find the symbol is skipped', async () => {
    const fyers = fakeBroker({ perMinute: 48, days: 95 })
    const other = fakeBroker({ perMinute: 240, days: 85 })
    other.adapter.resolveSymbol = async () => ''
    brokerManager.activeAdapters.set('fyers-e', fyers.adapter)
    brokerManager.activeAdapters.set('other-e', other.adapter)
    await queue(['E1'], 'fyers-e', 120)
    await drained()
    expect(other.calls).toHaveLength(0)
    expect(fyers.calls.length).toBeGreaterThan(0)
  })

  it('with the setting off, every symbol uses only its own broker', async () => {
    db.upsertSettings('historyUseAllBrokers', 'false')
    const fyers = fakeBroker({ perMinute: 48, days: 95 })
    const dhan = fakeBroker({ perMinute: 240, days: 85 })
    brokerManager.activeAdapters.set('fyers-f', fyers.adapter)
    brokerManager.activeAdapters.set('dhan-f', dhan.adapter)
    await queue(['F1', 'F2'], 'fyers-f', 170)
    await drained()
    expect(dhan.calls).toHaveLength(0)
    expect(fyers.calls.length).toBe(4)
  })

  it('estimates the time left from the real speed', async () => {
    const slow = fakeBroker({ perMinute: 48, days: 10, delayMs: 30 })
    brokerManager.activeAdapters.set('slow-g', slow.adapter)
    const now = Date.now()
    for (let i = 0; i < 6; i++) backfillQueue.enqueueGapFill(`G${i}`, 'slow-g', `OWN:G${i}`, now - 200 * DAY, now - DAY)
    await vi.waitFor(() => expect(slow.calls.length).toBeGreaterThan(6), { timeout: 10_000, interval: 10 })
    const eta = backfillQueue.estimateRemainingMs()
    expect(eta).not.toBeNull()
    expect(eta).toBeGreaterThan(0)
    backfillQueue.cancelAll()
    expect(backfillQueue.estimateRemainingMs()).toBe(0)
  })
})
