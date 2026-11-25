/**
 * Stage 6: the history answer is not rebuilt by splitting its text, the answers kept for the 50 ms throttle are
 * bounded, polled paths stay out of the log, a symbol's QUOTE goes out at most every 250 ms, and GET_QUOTES
 * (which no plugin sends any more) is answered with END.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'
import request from 'supertest'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-clean-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'clean.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

vi.mock('../src/config', async (orig) => ({ ...(await orig<any>()), AMIBROKER_IPC_PORT: 17895 }))
vi.mock('../src/amibroker/symbolDetails', () => ({ startSymbolDetailsSync() {}, schedulePush() {}, symbolDetailsCached: async () => [] }))

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
// A past weekday session minute (Tue 2026-10-20 10:00 IST = 04:30 UTC)
const T = Date.UTC(2026, 9, 20, 4, 30) / 1000
const bar = (i: number) => ({ ts: (T + i * 60) * 1000, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 10 + i })
const secs = (csv: string) => csv.split('\n').filter(l => /^\d/.test(l)).map(l => Number(l.split(',')[0]))

let db: typeof import('../src/db')
let app: typeof import('../src/app').app
let feed: any
let queue: any

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  app = (await import('../src/app')).app
  feed = (await import('../src/market/liveFeed')).liveFeed
  queue = (await import('../src/market/BackfillQueue')).backfillQueue
  vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
})
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })
afterEach(() => { vi.useRealTimers() })

const addSymbol = (t: string) => db.stmts.insertSymbol.run({ broker_id: 'cl-1', instrument_id: t, amibroker_ticker: t, exchange: 'NSE', instrument_type: 'EQ', raw_symbol: t, created_at: Date.now() })
const liveBar = (ticker: string, minute: number, close: number) => vi.spyOn(feed, 'getLiveBar').mockImplementation((t: string) =>
  t === ticker ? { open: close, high: close, low: close, close, volume: 7, bucketMs: (T + minute * 60) * 1000 } : undefined)

describe('the history answer for the plugin', () => {
  it('gives the stored bars after `since` as they are, and the live bar only when it is newer than both `since` and the last stored bar', async () => {
    addSymbol('CL1')
    await db.upsertBarsToHistory('CL1', [0, 1, 2, 3, 4].map(bar))             // T .. T+240

    // full load: the live minute (T+300) comes last, once
    liveBar('CL1', 5, 150)
    let r = await request(app).get('/api/feed/bars').query({ ticker: 'CL1', limit: 100 })
    expect(secs(r.text)).toEqual([0, 1, 2, 3, 4, 5].map(i => T + i * 60))
    expect(r.text.trimEnd().endsWith('END')).toBe(true)
    expect(r.text).toContain(`${T + 300},150,150,150,150,7`)

    // a catch-up: only what is newer than `since`, from the database as it is, then the live bar
    await sleep(60)                                                          // (an identical request within 50 ms is answered from the throttle)
    r = await request(app).get('/api/feed/bars').query({ ticker: 'CL1', since: T + 120, limit: 100 })
    expect(secs(r.text)).toEqual([3, 4, 5].map(i => T + i * 60))

    // the live bar is the last stored minute: it is not added a second time
    await sleep(60)                                                          // (an identical request within 50 ms is answered from the throttle)
    vi.restoreAllMocks(); vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
    liveBar('CL1', 4, 151)
    r = await request(app).get('/api/feed/bars').query({ ticker: 'CL1', since: T + 120, limit: 100 })
    expect(secs(r.text)).toEqual([3, 4].map(i => T + i * 60))

    // the live bar is not newer than `since`: it is not added
    await sleep(60)                                                          // (an identical request within 50 ms is answered from the throttle)
    vi.restoreAllMocks(); vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
    liveBar('CL1', 5, 152)
    r = await request(app).get('/api/feed/bars').query({ ticker: 'CL1', since: T + 300, limit: 100 })
    expect(secs(r.text)).toEqual([])
    expect(r.text.trim()).toBe('END')

    // a range up to `until` is history only
    await sleep(60)                                                          // (an identical request within 50 ms is answered from the throttle)
    vi.restoreAllMocks(); vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
    liveBar('CL1', 5, 153)
    r = await request(app).get('/api/feed/bars').query({ ticker: 'CL1', since: T, until: T + 180, limit: 100 })
    expect(secs(r.text)).toEqual([1, 2, 3].map(i => T + i * 60))
    vi.restoreAllMocks(); vi.spyOn(queue, 'enqueue').mockImplementation(() => {})
  })

  it('a symbol with no stored bars still gets its live bar, and the answers kept for the throttle never pass 16 MB', async () => {
    addSymbol('CL2')
    vi.spyOn(feed, 'getLiveBar').mockImplementation((t: string) => (t === 'CL2' ? { open: 1, high: 1, low: 1, close: 1, volume: 1, bucketMs: T * 1000 } : undefined))
    const r = await request(app).get('/api/feed/bars').query({ ticker: 'CL2', limit: 100 })
    expect(r.text).toBe(`${T},1,1,1,1,1\nEND`)
    vi.restoreAllMocks(); vi.spyOn(queue, 'enqueue').mockImplementation(() => {})

    // twenty symbols of 40,000 bars: a full load of each is about 1.5 MB of text, 30 MB in all
    const { feedCacheStats } = await import('../src/api/routes/feed')
    const bars = Array.from({ length: 40_000 }, (_, i) => ({ ts: (T + i * 60) * 1000, open: 100, high: 101, low: 99, close: 100.5, volume: 10 }))
    let highest = 0
    for (let k = 0; k < 20; k++) {
      const t = `CB${k}`
      addSymbol(t)
      await db.upsertBarsToHistory(t, bars)
      const res = await request(app).get('/api/feed/bars').query({ ticker: t, limit: 100_000 })
      expect(secs(res.text).length).toBeGreaterThan(39_000)
      highest = Math.max(highest, feedCacheStats().bytes)
    }
    expect(highest).toBeLessThanOrEqual(16 * 1024 * 1024)
    expect(highest).toBeGreaterThan(8 * 1024 * 1024)                 // it does keep answers, up to the limit
    expect(feedCacheStats().entries).toBeLessThan(20)                // the oldest went first
  }, 120_000)
})

describe('the request log', () => {
  it('leaves out what the app and the plugin ask for again and again, and keeps the rest', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    for (const p of ['/api/status/feed', '/api/status/health', '/api/backfill/status', '/api/symbols/health', '/api/ping', '/api/diagnostics/perf', '/api/feed/bars?ticker=X']) await request(app).get(p)
    await request(app).get('/api/settings')
    const logged = log.mock.calls.map(c => String(c[0])).filter(l => l.startsWith('{"ts"')).map(l => JSON.parse(l).path)
    expect(logged).toEqual(['/api/settings'])
  })
})

describe('the channel to the plugin', () => {
  async function connect() {
    const { startAmiBrokerIpc } = await import('../src/amibroker/ipcServer')
    const server = startAmiBrokerIpc()
    await new Promise<void>(r => server.listening ? r() : server.once('listening', () => r()))
    const client = net.connect(17895, '127.0.0.1')
    await new Promise<void>(r => client.once('connect', () => r()))
    const received: string[] = []
    let pending = ''
    client.on('data', d => { pending += d.toString(); const parts = pending.split('\n'); pending = parts.pop() || ''; received.push(...parts) })
    await sleep(100)
    return { server, client, received }
  }

  it('a symbol\'s QUOTE goes out at most every 250 ms, with its newest figures, and LIVE_BAR is not held back', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { server, client, received } = await connect()
    feed.addSymbolByTicker('QT1', 'cl-1', 'NSE', 'EQ', 'QT1')
    const status = feed.getFeedStatus('QT1')
    const quotes = () => received.filter(l => l.startsWith('QUOTE|QT1|'))
    const lastOf = (l: string) => Number(l.split('|')[2])
    const { startAmiBrokerIpc: _ } = await import('../src/amibroker/ipcServer')

    status.lastPrice = 100
    feed.emit('feed_update', { symbols: [{ ticker: 'QT1' }] })
    await sleep(40)
    expect(quotes().map(lastOf)).toEqual([100])                     // the first goes at once

    for (const p of [101, 102, 103, 104]) {                         // five updates in the next 120 ms
      status.lastPrice = p
      feed.emit('feed_update', { symbols: [{ ticker: 'QT1' }] })
      // a live bar in between goes out at once
      feed.emit('live_bar_updated', { ticker: 'QT1', bar: { open: p, high: p, low: p, close: p, volume: 1, bucketMs: Math.floor(Date.now() / 60_000) * 60_000 } })
      await sleep(30)
    }
    expect(quotes().map(lastOf)).toEqual([100])                     // held back
    expect(received.filter(l => l.startsWith('LIVE_BAR|QT1|')).length).toBe(4)
    // the four updates that arrived while one was waiting took its place (they are counted as merged, not as many waiting)
    const { perf } = await import('../src/system/perf')
    expect(perf.snapshot().sinceStart.counters['ipc.quotes_coalesced']).toBeGreaterThanOrEqual(3)
    // and the sample line of the live bars is written once a minute, not at every flush
    expect(log.mock.calls.filter(c => String(c[0]).startsWith('[IPC_LIVE_BAR]')).length).toBeLessThanOrEqual(1)

    await sleep(250)                                                // its time comes: one quote, the newest figures
    expect(quotes().map(lastOf)).toEqual([100, 104])

    await sleep(300)                                                // nothing more is waiting
    expect(quotes().length).toBe(2)

    // After a quiet while the next one goes at once again
    status.lastPrice = 110
    const before = Date.now()
    feed.emit('feed_update', { symbols: [{ ticker: 'QT1' }] })
    await sleep(40)
    expect(quotes().map(lastOf)).toEqual([100, 104, 110])
    expect(Date.now() - before).toBeLessThan(250)

    client.destroy()
    await new Promise<void>(r => server.close(() => r()))
  }, 15_000)

  it('GET_QUOTES, which no plugin sends any more, is answered END and warned about once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { startAmiBrokerIpc } = await import('../src/amibroker/ipcServer')
    const server = startAmiBrokerIpc()
    await new Promise<void>(r => server.listening ? r() : server.once('listening', () => r()))
    const client = net.connect(17895, '127.0.0.1')
    await new Promise<void>(r => client.once('connect', () => r()))
    let text = ''
    client.on('data', d => { text += d.toString() })
    client.write('GET_QUOTES CL1\nGET_QUOTES NOSUCH\n')
    await vi.waitFor(() => expect(text.split('\n').filter(l => l === 'END').length).toBe(2), { timeout: 3000 })
    expect(text).not.toMatch(/^\d+,/m)                                // no bars into the live socket
    expect(warn.mock.calls.filter(c => String(c[0]).includes('GET_QUOTES')).length).toBe(1)
    client.destroy()
    await new Promise<void>(r => server.close(() => r()))
  }, 15_000)
})
