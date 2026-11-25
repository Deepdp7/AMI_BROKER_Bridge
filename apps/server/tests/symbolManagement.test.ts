/**
 * Stage 5: many symbols are added in one pass (one transaction, one subscribe, one queueing of history, a few log
 * lines), and live places go to symbols AmiBroker keeps asking for, not to those a scan touched once.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-symmgmt-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'sm.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let add: typeof import('../src/brokers/addSymbols')
let manager: any
let feed: any
let queue: any
let slots: typeof import('../src/market/liveSlots')

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  add = await import('../src/brokers/addSymbols')
  manager = (await import('../src/brokers/BrokerManager')).brokerManager
  feed = (await import('../src/market/liveFeed')).liveFeed
  queue = (await import('../src/market/BackfillQueue')).backfillQueue
  slots = await import('../src/market/liveSlots')
})
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })
afterEach(() => { vi.restoreAllMocks(); manager.activeAdapters.clear() })

const names = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(3, '0')}`)

function fakeBroker(id: string, opts: { failResolveFor?: string } = {}) {
  const stats = { subscribed: [] as string[][], resolving: 0, maxResolving: 0, resolved: 0 }
  manager.activeAdapters.set(id, {
    on() {}, disconnect: async () => {}, unsubscribe: async () => {},
    subscribe: async (s: string[]) => { stats.subscribed.push(s) },
    resolveSymbol: async (t: string) => {
      stats.resolving++; stats.maxResolving = Math.max(stats.maxResolving, stats.resolving)
      await new Promise(r => setTimeout(r, 2))
      stats.resolving--; stats.resolved++
      if (t === opts.failResolveFor) throw new Error(`no such symbol ${t}`)
      return `NSE:${t}-EQ`
    },
  })
  return stats
}

describe('adding many symbols', () => {
  it('names are looked up a few at a time, saved in one go, subscribed in one call and queued for history once', async () => {
    const stats = fakeBroker('bulk-1')
    const batch = vi.spyOn(queue, 'enqueueBatch').mockImplementation(() => {})
    const single = vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const tickers = names('BK', 40)

    const res = await add.addSymbolsToBroker('bulk-1', tickers.map(t => ({ ticker: t, exchange: 'NSE', instrumentType: 'EQ' })))

    expect(res).toEqual({ added: 40, total: 40 })
    expect(stats.resolved).toBe(40)
    expect(stats.maxResolving).toBeGreaterThan(1)
    expect(stats.maxResolving).toBeLessThanOrEqual(8)
    expect(stats.subscribed).toEqual([tickers.map(t => `NSE:${t}-EQ`)])                       // one call, in the order given
    const saved = (db.stmts.getSymbolsByBroker.all('bulk-1') as any[])
    expect(saved.map(s => s.amiBrokerTicker)).toEqual(tickers)
    expect(saved[0]).toMatchObject({ rawSymbol: 'NSE:BK001-EQ', instrumentId: 'NSE:BK001-EQ', exchange: 'NSE', instrumentType: 'EQ' })
    for (const t of tickers) expect(feed.getFeedStatus(t)?.status).toBe('SUBSCRIBED')
    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch.mock.calls[0][0]).toHaveLength(40)
    expect(batch.mock.calls[0][0][0]).toMatchObject({ ticker: 'BK001', brokerId: 'bulk-1', brokerToken: 'NSE:BK001-EQ' })
    expect(single).not.toHaveBeenCalled()
    // One line for all of them (it used to be several for each symbol)
    expect(log.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('a symbol that cannot be resolved is skipped and reported; the others are added', async () => {
    fakeBroker('bulk-2', { failResolveFor: 'BAD002' })
    vi.spyOn(queue, 'enqueueBatch').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await add.addSymbolsToBroker('bulk-2', ['BAD001', 'BAD002', 'BAD003'].map(ticker => ({ ticker })))
    expect(res).toEqual({ added: 2, total: 3 })
    expect((db.stmts.getSymbolsByBroker.all('bulk-2') as any[]).map(s => s.amiBrokerTicker)).toEqual(['BAD001', 'BAD003'])
    expect(err.mock.calls.some(c => String(c[0]).includes('BAD002'))).toBe(true)
  })

  it('an import (resolve: false) stores the ticker as the broker name and asks the broker for nothing', async () => {
    const stats = fakeBroker('bulk-3')
    vi.spyOn(queue, 'enqueueBatch').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await add.addSymbolsToBroker('bulk-3', names('IM', 12).map(ticker => ({ ticker, instrumentId: ticker, exchange: 'NSE', instrumentType: 'EQ' })), { resolve: false })
    expect(res.added).toBe(12)
    expect(stats.resolved).toBe(0)
    expect(stats.subscribed).toEqual([names('IM', 12)])
  })

  it('adding the same symbols again keeps one of each and does not lose the order', async () => {
    fakeBroker('bulk-4')
    vi.spyOn(queue, 'enqueueBatch').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const list = names('RE', 10).map(ticker => ({ ticker }))
    await add.addSymbolsToBroker('bulk-4', list)
    await add.addSymbolsToBroker('bulk-4', [...list.slice(5), ...names('NW', 3).map(ticker => ({ ticker }))])
    expect((db.stmts.getSymbolsByBroker.all('bulk-4') as any[]).map(s => s.amiBrokerTicker)).toEqual([...names('RE', 10), ...names('NW', 3)])
    // and the database agrees with the cache
    const rows = db.sqlite.prepare('SELECT amibroker_ticker FROM symbols WHERE broker_id = ? ORDER BY rowid').all('bulk-4') as any[]
    expect(rows.length).toBe(13)
  })

  it('queueing history for a batch writes one line, not one per symbol', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const spy = vi.spyOn(queue as any, 'enqueue')
    queue.enqueueBatch(names('QB', 6).map(ticker => ({ ticker, brokerId: 'no-such-broker' })))
    expect(spy).toHaveBeenCalledTimes(6)
    expect(spy.mock.calls.every(c => c[4] === true)).toBe(true)           // quiet
    expect(log.mock.calls.filter(c => String(c[0]).includes('History queued for')).length).toBe(1)
  })
})

describe('live places go to symbols that are asked for again and again', () => {
  const place = (broker: string, live: string[], waiting: string[]) => {
    for (const t of [...live, ...waiting]) {
      db.stmts.insertSymbol.run({ broker_id: broker, instrument_id: `NSE:${t}-EQ`, amibroker_ticker: t, exchange: 'NSE', instrument_type: 'EQ', raw_symbol: `NSE:${t}-EQ`, created_at: Date.now() })
      feed.addSymbolByTicker(t, broker, 'NSE', 'EQ', `NSE:${t}-EQ`)
    }
    slots.onLiveCap(broker, live.map(t => `NSE:${t}-EQ`), waiting.map(t => `NSE:${t}-EQ`))
  }
  const broker = (id: string) => {
    const calls: string[] = []
    manager.activeAdapters.set(id, {
      on() {}, disconnect: async () => {},
      subscribe: async (s: string[]) => { calls.push(`+${s.length}`) },
      unsubscribe: async (s: string[]) => { calls.push(`-${s.length}`) },
    })
    vi.spyOn(queue, 'enqueueGapFill').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    return calls
  }

  it('one look does not move a place (a scan touches every symbol once)', async () => {
    slots.resetLiveSlots()
    const calls = broker('ls-1')
    place('ls-1', ['SA1', 'SA2'], ['SB1', 'SB2', 'SB3'])
    const now = Date.now()
    for (const t of ['SB1', 'SB2', 'SB3']) slots.noteViewed(t, now - 2_000)
    await slots.rebalance(now)
    expect(calls).toEqual([])
  })

  it('two looks less than 10 s apart are still one (a chart load asks for history and reports the symbol)', async () => {
    slots.resetLiveSlots()
    const calls = broker('ls-2')
    place('ls-2', ['SC1'], ['SD1'])
    const now = Date.now()
    slots.noteViewed('SD1', now - 6_000)
    slots.noteViewed('SD1', now - 2_000)
    await slots.rebalance(now)
    expect(calls).toEqual([])
  })

  it('a symbol asked for again 15 s later (a chart that stays open) takes a place', async () => {
    slots.resetLiveSlots()
    const calls = broker('ls-3')
    place('ls-3', ['SE1'], ['SF1'])
    const now = Date.now()
    slots.noteViewed('SF1', now - 16_000)
    slots.noteViewed('SF1', now - 1_000)
    await slots.rebalance(now)
    expect(calls).toEqual(['-1', '+1'])
    expect(feed.getFeedStatus('SF1')?.status).toBe('SUBSCRIBED')
  })

  it('looks older than a minute do not count, and reports within a second are one look', async () => {
    slots.resetLiveSlots()
    const calls = broker('ls-4')
    place('ls-4', ['SG1'], ['SH1', 'SH2'])
    const now = Date.now()
    slots.noteViewed('SH1', now - 90_000)         // a chart that was closed
    slots.noteViewed('SH1', now - 30_000)
    slots.noteViewed('SH2', now - 12_000)
    slots.noteViewed('SH2', now - 11_900)         // the same look, reported twice
    slots.noteViewed('SH2', now - 11_500)
    await slots.rebalance(now)
    expect(calls).toEqual([])
    expect(slots.lastViewedAt('SH2')).toBe(now - 11_500)
  })

  it('at most 5 places move in a round', async () => {
    slots.resetLiveSlots()
    const calls = broker('ls-5')
    const live = names('LP', 8), waiting = names('WP', 8)
    place('ls-5', live, waiting)
    const now = Date.now()
    for (const t of waiting) { slots.noteViewed(t, now - 20_000); slots.noteViewed(t, now - 3_000) }
    await slots.rebalance(now)
    expect(calls).toEqual(['-5', '+5'])
  })
})
