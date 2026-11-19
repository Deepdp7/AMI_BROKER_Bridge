/**
 * AmiBroker's Real-time Quote window (2026-11-18): the day's open/high/low/volume and the
 * previous close, not the current minute's figures; change against a real previous close
 * (it was 0.00% for every symbol: no feed but Fyers' sends one, and it was never stored).
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-quote-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'quote.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

vi.mock('../src/config', async (orig) => ({ ...(await orig<any>()), AMIBROKER_IPC_PORT: 17892 }))
vi.mock('../src/amibroker/symbolDetails', () => ({ startSymbolDetailsSync() {}, schedulePush() {}, symbolDetailsCached: async () => [] }))

const IST = 19_800_000
const ist = (hhmmss: string, date = '2026-11-12') => Date.parse(`${date}T${hhmmss}Z`) - IST

let db: typeof import('../src/db')
let feed: typeof import('../src/market/liveFeed')['liveFeed']
let ipc: typeof import('../src/amibroker/ipcServer')
beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  feed = (await import('../src/market/liveFeed')).liveFeed
  ipc = await import('../src/amibroker/ipcServer')
})
afterEach(() => { vi.useRealTimers() })

const bar = (ts: number, o: number, h: number, l: number, c: number) => ({ ts, open: o, high: h, low: l, close: c, volume: 10 })
const tick = (ticker: string, ms: number, price: number, extra: Record<string, number> = {}) =>
  feed.processRealTick({ instrumentId: `NSE:${ticker}-EQ`, lastPrice: price, volume: 0, timestamp: ms, ...extra }, 'q1')

describe('Real-time Quote window', () => {
  it("the previous close comes from the stored bars when the broker doesn't send one", async () => {
    // Wednesday's last bar closed at 500; today's bars so far: open 505, high 512, low 503
    await db.upsertBarsToHistory('QPREV', [
      bar(ist('15:28:00', '2026-11-11'), 499, 501, 498, 500.5),
      bar(ist('15:29:00', '2026-11-11'), 500.5, 501, 499, 500),
      bar(ist('09:15:00'), 505, 512, 503, 510),
    ])
    feed.addSymbolByTicker('QPREV', 'q1', 'NSE', 'EQ', 'NSE:QPREV-EQ')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(ist('09:16:10'))
    tick('QPREV', ist('09:16:05'), 515, { totalVolume: 4000 })
    ipc.quoteMessage('QPREV')                      // asks the database once for today
    await vi.waitFor(() => expect(feed.getFeedStatus('QPREV')?.prevClose).toBe(500), { timeout: 5000 })
    expect(feed.getFeedStatus('QPREV')).toMatchObject({ change: 15, changePercent: 3 })
    // last|open|high|low|prev|vol|oi|bid|ask|tickSec: the day's open/high/low, not the minute's
    await vi.waitFor(() => expect(ipc.quoteMessage('QPREV')).toBe(`QUOTE|QPREV|515|505|515|503|500|4000|0|0|0|${ist('09:16:05') / 1000}|0|0\n`), { timeout: 5000 })
  })

  it("the broker's own previous close wins over the stored one", async () => {
    await db.upsertBarsToHistory('QBRK', [bar(ist('15:29:00', '2026-11-11'), 100, 101, 99, 100)])
    feed.addSymbolByTicker('QBRK', 'q1', 'NSE', 'EQ', 'NSE:QBRK-EQ')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(ist('10:00:10'))
    tick('QBRK', ist('10:00:05'), 103, { prevClose: 101.5 })   // the official close (an average), not the last trade
    ipc.quoteMessage('QBRK')
    await new Promise(r => setTimeout(r, 300))     // the stored one has arrived by now and is ignored
    expect(feed.getFeedStatus('QBRK')).toMatchObject({ prevClose: 101.5, change: 1.5 })
  })

  it('best bid / ask reach the quote; an update that only moves them sends no bar to AmiBroker', async () => {
    feed.addSymbolByTicker('QBID', 'q1', 'NSE', 'EQ', 'NSE:QBID-EQ')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(ist('11:00:10'))
    const bars: any[] = []
    const onBar = (e: any) => { if (e.ticker === 'QBID') bars.push(e.bar) }
    feed.on('live_bar_updated', onBar)
    try {
      tick('QBID', ist('11:00:01'), 200, { totalVolume: 100, bid: 199.95, ask: 200.05, bidQty: 40, askQty: 25 })
      tick('QBID', ist('11:00:02'), 200, { totalVolume: 100, bid: 199.9, ask: 200, bidQty: 10, askQty: 70 })
      expect(bars).toHaveLength(1)
      expect(feed.getFeedStatus('QBID')).toMatchObject({ bid: 199.9, ask: 200, bidQty: 10, askQty: 70 })
      expect(ipc.quoteMessage('QBID')).toMatch(/\|199\.9\|200\|\d+\|10\|70\n$/)
    } finally {
      feed.off('live_bar_updated', onBar)
    }
  })

  it('no previous close known: no change shown, rather than a made-up 0 against the price itself', async () => {
    feed.addSymbolByTicker('QNEW', 'q1', 'NSE', 'EQ', 'NSE:QNEW-EQ')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(ist('10:00:10'))
    tick('QNEW', ist('10:00:05'), 50)
    expect(feed.getFeedStatus('QNEW')).toMatchObject({ prevClose: 0, change: 0, changePercent: 0 })
    expect(ipc.quoteMessage('QNEW')).toMatch(/^QUOTE\|QNEW\|50\|50\|50\|50\|0\|/)
    expect(ipc.quoteMessage('NOSUCH')).toBe('')
  })
})
