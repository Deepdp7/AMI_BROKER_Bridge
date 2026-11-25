/**
 * Broker plan limits (2026-11-19, a client's log): Fyers' Standard plan streams 100 symbols per
 * account (438 tracked: 338 never got a live price), allows 5,000 history requests a day and
 * serves 1-minute history for 1 year, daily for 5. Live places go to AmiBroker's charts, the
 * refresh spends the allowance on symbols without live prices, nothing is asked that the plan
 * can only refuse.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-plan-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'plan.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const DAY = 86_400_000
// Fyers' real answers (problem.txt, 2026-11-19)
const RANGE_REFUSAL = { code: -50, data: { range_from: "The requested start date (range_from) is outside your Standard plan's historical data limit of 5 years for daily data and 1 year for intraday data. Please select a later start date." }, message: 'Invalid input', s: 'error' }
const RATE_REFUSAL = { code: -360, message: "You've reached the Standard plan limit of 5 requests/second. Upgrade to Prime for higher API limits.", s: 'error' }

let db: typeof import('../src/db')
let plan: typeof import('../src/brokers/adapters/fyers/fyersPlan')
beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  plan = await import('../src/brokers/adapters/fyers/fyersPlan')
})
beforeEach(() => plan.resetFyersPlan())
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('the Fyers plan, learned from its own answers', () => {
  it('a refusal naming the Standard plan sets the daily allowance; the history windows come from the -50 answer', () => {
    expect(plan.requestsLeftToday()).toBe(Infinity)
    expect(plan.historyFloorMs(false)).toBe(0)
    plan.learnFromFyersMessage(RATE_REFUSAL.message)
    expect(plan.fyersPlan()).toBe('standard')
    expect(plan.liveSymbolCap()).toBe(100)
    expect(plan.requestsLeftToday()).toBe(4800)
    plan.learnFromFyersMessage(JSON.stringify(RANGE_REFUSAL))
    const now = Date.now()
    expect(Math.abs(plan.historyFloorMs(false, now) - (now - 364 * DAY))).toBeLessThan(1000)
    expect(Math.abs(plan.historyFloorMs(true, now) - (now - 1824 * DAY))).toBeLessThan(1000)
  })

  it("counts requests per India day and remembers them across a restart", () => {
    plan.learnFromFyersMessage(RATE_REFUSAL.message)
    const t = Date.parse('2026-11-19T10:00:00+05:30')
    for (let i = 0; i < 10; i++) plan.noteRequest(t)
    expect(plan.requestsLeftToday(t)).toBe(4790)
    expect(plan.requestsLeftToday(Date.parse('2026-11-20T00:01:00+05:30'))).toBe(4800)   // a new day
    expect(plan.msUntilNewDay(t)).toBe(14 * 3600_000)
  })

  it('a live socket that took more than 100 symbols is Prime: no daily cap', () => {
    plan.learnFromLiveCap(100, 438)
    expect(plan.fyersPlan()).toBe('standard')
    plan.learnFromLiveCap(438, 438)
    expect(plan.fyersPlan()).toBe('prime')
    expect(plan.requestsLeftToday()).toBe(Infinity)
  })
})

describe('daily history on the Standard plan (the 20-year loop of 2026-11-19)', () => {
  it("asks for what the plan serves, once: Fyers' -50 doesn't come back every round", async () => {
    const daily = await import('../src/market/DailyHistory')
    const { brokerManager } = await import('../src/brokers/BrokerManager')
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const saturday = Date.parse('2026-11-21T11:00:00+05:30')   // no market: daily history may run
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })   // the request pacing reads the clock
    vi.setSystemTime(saturday)
    const fiveYearsAgo = saturday - 5 * 365 * DAY
    const sent: { from: number; refused: boolean }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const from = Date.parse(/range_from=([^&]+)/.exec(url)![1] + 'T00:00:00+05:30')
      const refused = from < fiveYearsAgo
      sent.push({ from, refused })
      return new Response(JSON.stringify(refused ? RANGE_REFUSAL : { s: 'ok', candles: [[Math.floor(from / 1000) + 5 * 86400, 10, 11, 9, 10, 100]] }), { status: 200 })
    }))
    const fyers: any = new FyersAdapter()
    Object.assign(fyers, { accessToken: 'tok', appId: 'APP-100', on() {} })
    ;(brokerManager as any).activeAdapters.set('fyD', fyers)
    db.stmts.insertSymbol.run({ broker_id: 'fyD', instrument_id: 'NSE:DLOOP-EQ', amibroker_ticker: 'DLOOP', exchange: 'NSE', instrument_type: 'EQ', raw_symbol: 'NSE:DLOOP-EQ', created_at: Date.now() })
    await db.upsertBarsToHistory('DLOOP', [{ ts: saturday - 300 * DAY, open: 1, high: 1, low: 1, close: 1, volume: 1 }])
    const sym = (db.stmts.getSymbols.all() as any[]).find(s => (s.amiBrokerTicker || s.amibroker_ticker) === 'DLOOP')

    await daily.downloadDailyFor(sym, saturday)
    expect(sent.filter(s => s.refused)).toHaveLength(1)        // learned from the first refusal
    expect(sent.every(s => !s.refused || s.from < fiveYearsAgo)).toBe(true)
    const asked = sent.length
    expect(await daily.downloadDailyFor(sym, saturday + 60_000)).toBe('done')
    expect(sent.length).toBe(asked)                             // the next round asks nothing

    // On market days the allowance is the market's: no daily history then
    daily.forgetDailyFloor('DLOOP')
    const thursday = Date.parse('2026-11-19T11:00:00+05:30')
    vi.setSystemTime(thursday)
    expect(await daily.downloadDailyFor(sym, thursday)).toBe('later')
    expect(sent.length).toBe(asked)
    ;(brokerManager as any).activeAdapters.delete('fyD')
  })
})

describe('Fyers history inside the plan', () => {
  function adapter() {
    return import('../src/brokers/adapters/fyers/FyersAdapter').then(({ FyersAdapter }) => {
      const a = new FyersAdapter() as any
      Object.assign(a, { accessToken: 'tok', appId: 'APP-100' })
      return a
    })
  }

  it('a -50 for a start before the window: learned, asked once more for the part inside it; older ranges are never sent again', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      const from = Number(/range_from=([^&]+)/.exec(url)![1].replace(/-/g, '')) // yyyymmdd
      const tooOld = from < Number(new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10).replace(/-/g, ''))
      const body = tooOld ? RANGE_REFUSAL : { s: 'ok', candles: [[Math.floor(Date.now() / 1000) - 3 * DAY / 1000, 1, 2, 1, 2, 10]] }
      return new Response(JSON.stringify(body), { status: 200 })
    }))
    const a = await adapter()
    const now = Date.now()
    const bars = await a.getHistoricalBars('NSE:TCS-EQ', '1m', new Date(now - 400 * DAY), new Date(now - 300 * DAY))
    expect(urls).toHaveLength(2)                 // refused, then the part inside the year
    expect(bars).toHaveLength(1)
    // Entirely older than a year: no request at all
    expect(await a.getHistoricalBars('NSE:TCS-EQ', '1m', new Date(now - 600 * DAY), new Date(now - 500 * DAY))).toEqual([])
    expect(urls).toHaveLength(2)
    // Daily bars: 5 years, learned from the same answer
    await a.getHistoricalBars('NSE:TCS-EQ', '1d', new Date(now - 3000 * DAY), new Date(now - 2000 * DAY))
    expect(urls).toHaveLength(2)
  })

  it('every history request counts against the day, and a Standard refusal is understood', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(RATE_REFUSAL), { status: 200 })))
    const a = await adapter()
    await expect(a.getHistoricalBars('NSE:INFY-EQ', '1m', new Date(Date.now() - DAY), new Date())).rejects.toMatchObject({ code: 429 })
    expect(plan.fyersPlan()).toBe('standard')
    expect(a.historyRequestsLeftToday()).toBe(4800 - 1)
  })
})

describe('the Fyers live socket and its 100-symbol limit', () => {
  it('reports which symbols Fyers took and which it left out, and keeps only the taken ones for a reconnect', async () => {
    vi.useFakeTimers()
    const { FyersHSMClient } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    const client: any = new FyersHSMClient('APPID:x.y.z')
    const sent: Buffer[] = []
    client.ws = { readyState: 1, send: (b: Buffer) => sent.push(b), removeAllListeners() {}, close() {} }
    client.authenticated = true
    const names = ['A', 'B', 'C', 'D', 'E']
    names.forEach((n, i) => client.setSymbolMapping(`NSE:${n}-EQ`, `sf|nse_cm|${100 + i}`))
    const reports: any[] = []
    client.on('live_cap', (r: any) => reports.push(r))
    client.subscribe(names.map(n => `NSE:${n}-EQ`))
    // Fyers answers the first three with snapshots (topic ids) and nothing for the others
    names.slice(0, 3).forEach((_, i) => client.subscriptions.set(i + 1, `sf|nse_cm|${100 + i}`))
    await vi.advanceTimersByTimeAsync(11_000)
    expect(reports).toEqual([{ accepted: 3, asked: 5, live: ['NSE:A-EQ', 'NSE:B-EQ', 'NSE:C-EQ'], waiting: ['NSE:D-EQ', 'NSE:E-EQ'] }])
    expect([...client.activeSubscriptions]).toEqual(['NSE:A-EQ', 'NSE:B-EQ', 'NSE:C-EQ'])

    // Unsubscribing frees the place: its topic is forgotten and Fyers is told
    const before = sent.length
    client.unsubscribe(['NSE:A-EQ'])
    expect(sent.length).toBe(before + 1)
    expect([...client.subscriptions.values()]).toEqual(['sf|nse_cm|101', 'sf|nse_cm|102'])
    clearInterval(client.statsTimer)
  })

  it("unsubscribing through the adapter reaches the socket (it used to pass only resolved names it didn't know)", async () => {
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const a: any = new FyersAdapter()
    const got: string[][] = []
    a.hsmClient = { unsubscribe: (t: string[]) => got.push(t) }
    a.resolveSymbol = async (s: string) => (s === 'TCS' ? 'NSE:TCS-EQ' : s)
    await a.unsubscribe(['TCS'])
    expect(got[0]).toEqual(expect.arrayContaining(['TCS', 'NSE:TCS-EQ']))
  })
})

describe('live places go to what AmiBroker shows', () => {
  it("a symbol on screen takes the place of one nobody looks at; it gets today's bars once and shows as live", async () => {
    const slots = await import('../src/market/liveSlots')
    const { brokerManager } = await import('../src/brokers/BrokerManager')
    const { liveFeed } = await import('../src/market/liveFeed')
    const { backfillQueue } = await import('../src/market/BackfillQueue')
    slots.resetLiveSlots()
    const calls: string[] = []
    ;(brokerManager as any).activeAdapters.set('fy1', {
      on() {}, disconnect: async () => {},
      subscribe: async (s: string[]) => { calls.push(`+${s.join(',')}`) },
      unsubscribe: async (s: string[]) => { calls.push(`-${s.join(',')}`) },
    })
    const fills = vi.spyOn(backfillQueue, 'enqueueGapFill').mockImplementation(() => {})
    for (const t of ['LV1', 'LV2', 'WT1', 'WT2']) {
      db.stmts.insertSymbol.run({ broker_id: 'fy1', instrument_id: `NSE:${t}-EQ`, amibroker_ticker: t, exchange: 'NSE', instrument_type: 'EQ', raw_symbol: `NSE:${t}-EQ`, created_at: Date.now() })
      liveFeed.addSymbolByTicker(t, 'fy1', 'NSE', 'EQ', `NSE:${t}-EQ`)
    }
    slots.onLiveCap('fy1', ['NSE:LV1-EQ', 'NSE:LV2-EQ'], ['NSE:WT1-EQ', 'NSE:WT2-EQ'])
    expect(liveFeed.getFeedStatus('WT1')?.status).toBe('NOT_LIVE')
    expect(slots.waitingTickers()).toEqual(new Set(['WT1', 'WT2']))

    const now = Date.now()
    slots.noteViewed('LV1', now - 60_000)        // LV1 on screen a minute ago: keeps its place
    slots.noteViewed('WT1', now - 20_000)        // WT1 just opened in AmiBroker: a chart asks again every 15 s
    slots.noteViewed('WT1', now - 5_000)
    await slots.rebalance(now)
    expect(calls).toEqual(['-NSE:LV2-EQ', '+NSE:WT1-EQ'])
    expect(liveFeed.getFeedStatus('WT1')?.status).toBe('SUBSCRIBED')
    expect(liveFeed.getFeedStatus('LV2')?.status).toBe('NOT_LIVE')
    expect(fills).toHaveBeenCalledWith('WT1', 'fy1', 'NSE:WT1-EQ', expect.any(Number), now, true)

    // A later report about only the new subscription doesn't forget who is waiting
    slots.onLiveCap('fy1', ['NSE:WT1-EQ'], [])
    expect(slots.waitingTickers()).toEqual(new Set(['LV2', 'WT2']))
    // Nothing on screen is waiting: nothing moves
    calls.length = 0
    await slots.rebalance(now + 1000)
    expect(calls).toEqual([])
    ;(brokerManager as any).activeAdapters.delete('fy1')
  })
})

describe('the request pacing', () => {
  it("a PC clock set back (synced after running fast) doesn't hold requests until it catches up", async () => {
    const { RateLimiter } = await import('../src/lib/RateLimiter')
    const limiter = new RateLimiter(3, 45)
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    const now = Date.now()
    vi.setSystemTime(now + 6 * 60_000)           // clock 6 minutes fast
    for (let i = 0; i < 3; i++) await limiter.acquire()
    vi.setSystemTime(now)                        // corrected
    const t0 = performance.now()
    await limiter.acquire()
    expect(performance.now() - t0).toBeLessThan(500)
  })
})

describe('the history refresh on a plan with a daily allowance', () => {
  it('during the market: symbols streaming live wait for the after-close pass; AmiBroker\'s first, then the longest since checked', async () => {
    const { autoRefresh } = await import('../src/market/AutoRefresh')
    const { brokerManager } = await import('../src/brokers/BrokerManager')
    const { liveFeed } = await import('../src/market/liveFeed')
    const slots = await import('../src/market/liveSlots')
    let left = 4000
    const capped = { on() {}, historyRequestsLeftToday: () => left }
    ;(brokerManager as any).activeAdapters.set('fyR', capped)
    const sym = (t: string) => ({ amibroker_ticker: t, broker_id: 'fyR' })
    for (const t of ['R1', 'R2', 'R3', 'R4']) liveFeed.addSymbolByTicker(t, 'fyR', 'NSE', 'EQ', `NSE:${t}-EQ`)
    const now = Date.now()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    liveFeed.processRealTick({ instrumentId: 'NSE:R1-EQ', lastPrice: 10, volume: 1, timestamp: now - 1000 }, 'fyR')   // R1 streams
    ;(autoRefresh as any).refreshedAt.set('R2', now - 60_000)
    ;(autoRefresh as any).refreshedAt.set('R3', now - 600_000)
    slots.noteViewed('R4', now - 10_000)
    const order = (autoRefresh as any).passSymbols([sym('R1'), sym('R2'), sym('R3'), sym('R4')], false, now).map((s: any) => s.amibroker_ticker)
    expect(order).toEqual(['R4', 'R3', 'R2'])
    // The after-close pass checks everything
    expect((autoRefresh as any).passSymbols([sym('R1'), sym('R2')], true, now)).toHaveLength(2)
    // Allowance down to one after-close pass (+ margin): no more passes in the market
    left = 100
    expect((autoRefresh as any).passSymbols([sym('R1'), sym('R2'), sym('R3')], false, now)).toEqual([])
    ;(brokerManager as any).activeAdapters.delete('fyR')
  })
})
