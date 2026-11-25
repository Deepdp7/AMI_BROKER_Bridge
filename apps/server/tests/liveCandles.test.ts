/**
 * Live ticks → 1-minute candles → database → AmiBroker, and the gap filling around them
 * (2026-11-14): late ticks, quiet symbols, after-close updates, volume totals going backwards,
 * bars AmiBroker couldn't see yet, broker bars replacing live ones too early, the gap watermark.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-candles-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'candles.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

// The AmiBroker channel on a test port (7891 is the real engine's), without the Symbol
// Information push (it talks to a real AmiBroker)
vi.mock('../src/config', async (orig) => ({ ...(await orig<any>()), AMIBROKER_IPC_PORT: 17891 }))
vi.mock('../src/amibroker/symbolDetails', () => ({ startSymbolDetailsSync() {}, schedulePush() {} }))

const IST = 19_800_000
/** UTC ms of an IST wall time on 2026-11-12 (a Thursday, a trading day) */
const ist = (hhmmss: string, date = '2026-11-12') => Date.parse(`${date}T${hhmmss}Z`) - IST

let db: typeof import('../src/db')
beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
})
afterEach(() => { vi.useRealTimers() })

async function newFeed(ticker = 'TCS', exchange = 'NSE') {
  const { LiveFeed } = await import('../src/market/liveFeed')
  const feed = new LiveFeed()
  const closed: any[] = []
  feed.on('bar_finalized', e => closed.push({ ...e.bar }))
  feed.addSymbolByTicker(ticker, 'b1', exchange, 'EQ', `NSE:${ticker}-EQ`)
  const tick = (ms: number, price: number, totalVolume?: number) =>
    feed.processRealTick({ instrumentId: `NSE:${ticker}-EQ`, lastPrice: price, volume: 0, totalVolume, timestamp: ms }, 'b1')
  const live = () => feed.getLiveBar(ticker, 'b1')
  return { feed, closed, tick, live }
}

/** The clock at `ms` (ticks are judged against it) */
function clockAt(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ms)
}

describe('ticks into 1-minute candles', () => {
  it('a late tick for a finished minute changes neither that minute nor the current one', async () => {
    const { closed, tick, live } = await newFeed()
    clockAt(ist('10:01:05'))
    tick(ist('10:00:10'), 100, 1000)
    tick(ist('10:00:50'), 102, 1100)
    tick(ist('10:01:01'), 103, 1150)          // 10:01 starts: 10:00 is complete
    tick(ist('10:00:59'), 99, 1120)           // overtaken by the 10:01 one
    tick(ist('10:01:30'), 104, 1200)
    expect(closed).toHaveLength(1)
    expect(closed[0]).toMatchObject({ open: 100, high: 102, low: 100, close: 102, volume: 100 })
    // It used to close 10:01 with one tick, reopen 10:00 with the late one, then restart 10:01
    expect(live()).toMatchObject({ bucketMs: ist('10:01:00'), open: 103, high: 104, low: 103, close: 104, volume: 100 })
  })

  it("a quiet symbol's minute is closed by the clock, and a straggler doesn't reopen it", async () => {
    const { feed, closed, tick, live } = await newFeed('QUIET')
    clockAt(ist('10:00:20'))
    tick(ist('10:00:20'), 50, 10)
    clockAt(ist('10:00:40'))
    tick(ist('10:00:40'), 51, 15)
    feed.closeFinishedMinutes(ist('10:01:01'))  // the minute's last second may still be on its way
    expect(closed).toHaveLength(0)
    feed.closeFinishedMinutes(ist('10:01:03'))
    expect(closed).toEqual([expect.objectContaining({ bucketMs: ist('10:00:00'), close: 51, volume: 5 })])
    clockAt(ist('10:01:10'))
    tick(ist('10:00:59'), 60, 16)               // too late: the saved bar stays as it was
    expect(live()).toMatchObject({ close: 51, done: true })
    tick(ist('10:05:00'), 52, 20)               // the next trade starts its own minute
    expect(closed).toHaveLength(1)              // and doesn't save 10:00 a second time
    expect(live()).toMatchObject({ bucketMs: ist('10:05:00'), close: 52, volume: 4 })
  })

  it('updates after the close and before the open move the price but make no candle (NSE)', async () => {
    const { feed, closed, tick, live } = await newFeed('WIPRO')
    clockAt(ist('15:31:00'))
    tick(ist('15:29:30'), 240, 500)
    tick(ist('15:30:20'), 241, 600)             // closing-session update: no 15:30 candle
    feed.closeFinishedMinutes(ist('15:35:00'))
    expect(closed).toEqual([expect.objectContaining({ bucketMs: ist('15:29:00'), close: 240 })])
    expect(feed.getFeedStatus('WIPRO')?.lastPrice).toBe(241)
    clockAt(ist('09:08:00', '2026-11-13'))
    tick(ist('09:07:30', '2026-11-13'), 243, 50)  // pre-open price
    expect(live()?.bucketMs).toBe(ist('15:29:00'))
    expect(feed.getFeedStatus('WIPRO')?.lastPrice).toBe(243)
  })

  it('MCX trades into the evening; a special session on a closed day still makes candles', async () => {
    const mcx = await newFeed('CRUDEOIL', 'MCX')
    clockAt(ist('23:40:10'))
    mcx.tick(ist('23:40:05'), 5000, 10)        // winter hours run to 23:55
    expect(mcx.live()?.bucketMs).toBe(ist('23:40:00'))

    const muhurat = await newFeed('RELIANCE')
    clockAt(ist('18:15:10', '2026-11-08'))       // Sunday: Diwali's Muhurat trading
    muhurat.tick(ist('18:15:05', '2026-11-08'), 1500, 10)
    expect(muhurat.live()?.bucketMs).toBe(ist('18:15:00', '2026-11-08'))
  })

  it('a snapshot of an old trade (sent on subscribe) makes no candle', async () => {
    const { tick, live, feed } = await newFeed('SNAP')
    clockAt(ist('09:15:30'))
    tick(ist('15:29:58', '2026-11-11'), 700, 90_000)   // yesterday's last trade
    expect(live()?.bucketMs).toBe(0)
    expect(feed.getFeedStatus('SNAP')?.lastPrice).toBe(700)
    tick(ist('09:15:10'), 705, 100)
    expect(live()).toMatchObject({ bucketMs: ist('09:15:00'), open: 705, volume: 0 })  // first total of the day is the baseline
  })

  it("a day total that goes backwards doesn't count the day's volume again", async () => {
    const { tick, live } = await newFeed('VOL')
    clockAt(ist('11:00:30'))
    tick(ist('11:00:01'), 10, 5000)
    tick(ist('11:00:05'), 10, 5200)
    tick(ist('11:00:06'), 10, 0)               // an update without the total
    tick(ist('11:00:07'), 10, 5150)            // one that overtook a newer one
    tick(ist('11:00:09'), 10, 5300)
    expect(live()?.volume).toBe(300)           // it used to be 200 + 5150 + 150
  })

  it('the clock waits for the feed\'s usual delay before closing a minute', async () => {
    const { feed, closed, tick } = await newFeed('SLOW')
    clockAt(ist('12:00:20'))
    for (let i = 0; i < 20; i++) tick(ist('12:00:00') + i * 500, 10 + i, 100 + i)   // all about 10-20 s old on arrival
    feed.closeFinishedMinutes(ist('12:01:05'))
    expect(closed).toHaveLength(0)
    feed.closeFinishedMinutes(ist('12:01:30'))
    expect(closed).toHaveLength(1)
  })
})

describe('closed candles in the database', () => {
  it('a candle closed a moment ago is in the answer AmiBroker gets (not only in the write buffer)', async () => {
    const { feed, tick } = await newFeed('FRESH')
    ;(feed as any)._startBarFlush()            // the feed's own database writer
    clockAt(ist('10:01:02'))
    tick(ist('10:00:10'), 1, 100)
    tick(ist('10:00:40'), 2, 107)
    tick(ist('10:01:01'), 2, 108)              // closes 10:00
    const csv = await db.stmts.getBarsCsvSinceAsync.get('FRESH', ist('09:59:00') / 1000, 10)
    expect(csv).toBe(`${ist('10:00:00') / 1000},1,2,1,2,7`)
    feed.stop()
  })

  it("broker history doesn't replace a minute that ended only seconds ago; later it does", async () => {
    const bar = (ts: number, close: number) => ({ ts, open: 5, high: 9, low: 4, close, volume: 9 })
    clockAt(ist('10:05:20'))                   // 10:04 ended 20 s ago, 10:03 80 s ago
    expect(await db.upsertBarsToHistory('SETTLE', [bar(ist('10:03:00'), 5.5), bar(ist('10:04:00'), 6), bar(ist('10:05:00'), 7)])).toBe(1)
    expect(await db.stmts.getBarsCsvSinceAsync.get('SETTLE', 0, 10)).toBe(`${ist('10:03:00') / 1000},5,9,4,5.5,9`)
    clockAt(ist('10:05:31'))
    expect(await db.upsertBarsToHistory('SETTLE', [bar(ist('10:04:00'), 6)])).toBe(1)
  })
})

describe('gap filling', () => {
  it('the last minutes are never marked verified, so a skipped or unsettled gap there is looked at again', async () => {
    const { backfillQueue } = await import('../src/market/BackfillQueue')
    const { getVerifiedThroughMs } = await import('../src/market/state/coverageState')
    const now = Date.now()
    backfillQueue.enqueueGapPass('WMARK', 'nobroker', 'WMARK', [], now)
    const mark = getVerifiedThroughMs('WMARK')!
    expect(mark).toBeLessThanOrEqual(now - 5 * 60_000 + 1000)
    expect(mark).toBeGreaterThan(now - 6 * 60_000)
  })
})

describe('live bars to AmiBroker', () => {
  it("one write per burst, and a finished minute's last state always goes out before the next minute", async () => {
    const { startAmiBrokerIpc } = await import('../src/amibroker/ipcServer')
    const { liveFeed } = await import('../src/market/liveFeed')
    const server = startAmiBrokerIpc()
    await new Promise<void>(r => server.listening ? r() : server.once('listening', () => r()))
    const client = net.connect(17891, '127.0.0.1')
    let got = ''
    client.on('data', d => { got += d.toString() })
    await new Promise<void>(r => client.once('connect', () => r()))
    await new Promise(r => setTimeout(r, 50))

    const bar = (bucketMs: number, close: number) => ({ open: 1, high: close, low: 1, close, volume: 1, bucketMs })
    const m0 = ist('10:00:00'), m1 = ist('10:01:00')
    for (const c of [2, 3, 4]) liveFeed.emit('live_bar_updated', { ticker: 'IPCX', bar: bar(m0, c) })
    liveFeed.emit('live_bar_updated', { ticker: 'IPCX', bar: bar(m1, 5) })
    liveFeed.emit('live_bar_updated', { ticker: 'IPCX', bar: bar(m1, 6) })
    await new Promise(r => setTimeout(r, 100))

    const raw = got.split('\n').filter(l => l.startsWith('LIVE_BAR|IPCX'))
    // The last field is the engine's clock (unix ms) when the line was written: the plugin times its
    // transit with it. Older plugins stop reading at the open interest before it.
    for (const l of raw) expect(Math.abs(Number(l.split('|')[9]) - Date.now())).toBeLessThan(5000)
    const lines = raw.map(l => l.split('|').slice(0, 9).join('|'))
    expect(lines).toEqual([
      `LIVE_BAR|IPCX|${m0 / 1000}|1|4|1|4|1|0`,
      `LIVE_BAR|IPCX|${m1 / 1000}|1|6|1|6|1|0`,
    ])
    client.destroy()
    server.close()
  })
})
