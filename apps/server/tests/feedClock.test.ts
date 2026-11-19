/**
 * Live candles must not depend on the PC clock (2026-11-18): with the PC minutes ahead of the
 * exchange, every tick looked like an old snapshot (no live bars; gaps until the next history
 * refresh 5-15 minutes later), and a minute ahead closed each minute on its first tick.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-feedclock-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'feedclock.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const IST = 19_800_000
/** UTC ms of an IST wall time on 2026-11-12 (a trading day) */
const ist = (hhmmss: string) => Date.parse(`2026-11-12T${hhmmss}Z`) - IST

afterEach(() => { vi.useRealTimers() })

/**
 * A feed whose ticks are stamped with exchange time `ex` and arrive `skewMs` later by the PC
 * clock (PC ahead of the exchange when positive), about 300 ms after the trade.
 */
async function feedWithSkew(skewMs: number, ticker = 'TCS') {
  const { LiveFeed } = await import('../src/market/liveFeed')
  const feed = new LiveFeed()
  const closed: any[] = []
  const sent: any[] = []
  feed.on('bar_finalized', e => closed.push({ ...e.bar }))
  feed.on('live_bar_updated', e => sent.push({ ...e.bar }))
  feed.addSymbolByTicker(ticker, 'b1', 'NSE', 'EQ', `NSE:${ticker}-EQ`)
  vi.useFakeTimers({ toFake: ['Date'] })
  const tick = (ex: number, price: number, totalVolume?: number) => {
    vi.setSystemTime(ex + skewMs + 300)
    feed.processRealTick({ instrumentId: `NSE:${ticker}-EQ`, lastPrice: price, volume: 0, totalVolume, timestamp: ex }, 'b1')
  }
  /** The clock sweep at exchange time `ex` */
  const sweep = (ex: number) => feed.closeFinishedMinutes(ex + skewMs)
  return { feed, closed, sent, tick, sweep, live: () => feed.getLiveBar(ticker, 'b1') }
}

/** Ticks every 5 s through one minute, price rising by 1 each */
function tradeMinute(tick: (ex: number, p: number, v?: number) => void, start: number, base: number, vol0: number) {
  for (let i = 0; i < 12; i++) tick(start + i * 5000, base + i, vol0 + i * 10)
}

describe('live candles with the PC clock off', () => {
  for (const [label, skew] of [['6 minutes ahead', 6 * 60_000], ['90 seconds ahead', 90_000], ['2 minutes behind', -2 * 60_000], ['right', 0]] as const) {
    it(`PC clock ${label}: every minute is a full candle, closed once`, async () => {
      const { closed, tick, sweep, live } = await feedWithSkew(skew, `T${Math.abs(skew)}${skew < 0 ? 'B' : ''}`)
      tradeMinute(tick, ist('10:00:00'), 100, 1000)
      tradeMinute(tick, ist('10:01:00'), 200, 2000)
      // A whole minute: the sweep at its last second must not close it early
      expect(live()).toMatchObject({ bucketMs: ist('10:01:00'), open: 200, high: 211, close: 211 })
      sweep(ist('10:01:59'))
      expect(closed).toHaveLength(1)
      sweep(ist('10:02:05'))
      expect(closed).toHaveLength(2)
      expect(closed[0]).toMatchObject({ bucketMs: ist('10:00:00'), open: 100, high: 111, low: 100, close: 111 })
      expect(closed[1]).toMatchObject({ bucketMs: ist('10:01:00'), open: 200, high: 211, low: 200, close: 211, volume: 2110 - 1110 })
    })
  }

  it('a snapshot of an old trade still makes no candle when the PC clock is ahead', async () => {
    const { tick, live } = await feedWithSkew(6 * 60_000, 'SNAPX')
    tradeMinute(tick, ist('10:00:00'), 100, 1000)
    tick(ist('09:40:00'), 90)                       // 20 minutes old by the exchange's clock
    expect(live()?.bucketMs).toBe(ist('10:00:00'))
    expect(live()?.close).toBe(111)
  })

  it('an update that overtook a newer one counts for the high, low and volume, not the close, and reaches AmiBroker', async () => {
    const { tick, live, sent } = await feedWithSkew(0, 'OOO')
    tick(ist('11:00:01'), 50, 100)
    tick(ist('11:00:05'), 52, 120)
    const before = sent.length
    tick(ist('11:00:03'), 49, 130)                  // stamped before the last one
    expect(live()).toMatchObject({ open: 50, high: 52, low: 49, close: 52, volume: 30 })
    expect(sent.length).toBe(before + 1)            // the new low is sent on
  })
})
