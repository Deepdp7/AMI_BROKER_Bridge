/**
 * Open interest for F&O: carried from live ticks into every 1-minute bar (NSE publishes it only
 * every few minutes), and asked for with Fyers history of F&O contracts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-oi-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'oi.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

afterEach(() => vi.unstubAllGlobals())

describe('open interest', () => {
  it('live: the last OI seen is in every bar, also in minutes without an OI update', async () => {
    const { LiveFeed } = await import('../src/market/liveFeed')
    const feed = new LiveFeed()
    const finalized: any[] = []
    feed.on('bar_finalized', e => finalized.push(e.bar))
    feed.addSymbolByTicker('NIFTY26NOVFUT', 'b1', 'NFO', 'FUT', 'NSE:NIFTY26NOVFUT')
    const t0 = Date.UTC(2026, 10, 2, 4, 0)
    const tick = (ms: number, price: number, oi?: number) =>
      feed.processRealTick({ instrumentId: 'NSE:NIFTY26NOVFUT', lastPrice: price, volume: 75, timestamp: ms, openInterest: oi }, 'b1')
    tick(t0, 24000, 12_500_000)
    tick(t0 + 20_000, 24010)
    expect(feed.getLiveBar('NIFTY26NOVFUT', 'b1')?.oi).toBe(12_500_000)
    tick(t0 + 60_000, 24020)                 // next minute, no OI in the tick
    expect(finalized[0].oi).toBe(12_500_000)
    expect(feed.getLiveBar('NIFTY26NOVFUT', 'b1')?.oi).toBe(12_500_000)
    tick(t0 + 90_000, 24030, 12_560_000)
    expect(feed.getLiveBar('NIFTY26NOVFUT', 'b1')?.oi).toBe(12_560_000)
    expect(feed.getFeedStatuses().find(s => s.ticker === 'NIFTY26NOVFUT')?.openInterest).toBe(12_560_000)
    feed.stop()
  })

  it('Fyers history: OI is asked for (and read) for F&O contracts only', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      const fno = url.includes('FUT')
      return new Response(JSON.stringify({ s: 'ok', candles: [[1793000000, 100, 101, 99, 100.5, 1500, ...(fno ? [2_450_000] : [])]] }), { status: 200 })
    }))
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const fyers = new FyersAdapter() as any
    Object.assign(fyers, { accessToken: 'tok', appId: 'APP-100' })
    const from = new Date(Date.UTC(2026, 9, 20)), to = new Date(Date.UTC(2026, 9, 21))
    const fut = await fyers.getHistoricalBars('NSE:RELIANCE26NOVFUT', '1m', from, to)
    const eq = await fyers.getHistoricalBars('NSE:RELIANCE-EQ', '1m', from, to)
    expect(urls[0]).toContain('&oi_flag=1')
    expect(urls[1]).not.toContain('oi_flag')
    expect(fut[0].openInterest).toBe(2_450_000)
    expect(eq[0].openInterest).toBeUndefined()
  })
})
