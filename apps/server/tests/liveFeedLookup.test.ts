/**
 * Finding a symbol's bar and matching a broker's tick to a symbol is a lookup, not a scan of every symbol
 * (it ran on every update and on every request for history). The index has to follow every re-key.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-lookup-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'lookup.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const MINUTE0 = 1_788_000_000_000
async function setup() {
  const { LiveFeed } = await import('../src/market/liveFeed')
  const { perf } = await import('../src/system/perf')
  const feed = new LiveFeed()
  const scans = () => perf.snapshot().sinceStart.counters['feed.fallback_scans'] ?? 0
  // MCX: trading at any hour, so the tests do not depend on the clock
  const tick = (instrumentId: string, price: number, brokerId = 'b1') =>
    feed.processRealTick({ instrumentId, lastPrice: price, volume: 1, totalVolume: 10, timestamp: Date.now() }, brokerId)
  return { feed, scans, tick }
}

describe('the symbol index', () => {
  it('finds a symbol\'s live bar by ticker and broker, and keeps finding it after the token is resolved, the symbol moves to another broker, and not after it is removed', async () => {
    const { feed, tick } = await setup()
    feed.addSymbolByTicker('LKA', 'b1', 'MCX', 'FUT', 'LKA')
    expect(feed.getLiveBar('LKA', 'b1')).toBeTruthy()
    expect(feed.getLiveBar('LKA', 'b2')).toBeUndefined()
    expect(feed.getLiveBar('NOSUCH', 'b1')).toBeUndefined()

    tick('LKA', 100)
    expect(feed.getLiveBar('LKA', 'b1')!.close).toBe(100)

    feed.updateResolvedToken('b1', 'LKA', 'MCX:LKA26NOVFUT')            // the broker's own name for it
    expect(feed.getLiveBar('LKA', 'b1')!.close).toBe(100)               // same bar, new key
    tick('MCX:LKA26NOVFUT', 101)
    expect(feed.getLiveBar('LKA', 'b1')!.close).toBe(101)

    expect(feed.moveSymbolToBroker('LKA', 'b2')).toBe(true)
    expect(feed.getLiveBar('LKA', 'b1')).toBeUndefined()
    expect(feed.getLiveBar('LKA', 'b2')!.close).toBe(101)
    tick('MCX:LKA26NOVFUT', 102, 'b2')
    expect(feed.getLiveBar('LKA', 'b2')!.close).toBe(102)

    feed.removeSymbolByTicker('LKA', 'b2')
    expect(feed.getLiveBar('LKA', 'b2')).toBeUndefined()
  })

  it('a tick named differently from the symbol (NSE:LKB-EQ for LKB) is matched by the slow search once, then by key; the index follows the re-key', async () => {
    const { feed, scans, tick } = await setup()
    feed.addSymbolByTicker('LKB', 'b1', 'MCX', 'EQ', 'LKB')
    const before = scans()
    tick('NSE:LKB-EQ', 55)
    expect(scans() - before).toBe(1)
    expect(feed.getLiveBar('LKB', 'b1')!.close).toBe(55)
    tick('NSE:LKB-EQ', 56)
    tick('NSE:LKB-EQ', 57)
    expect(scans() - before).toBe(1)                                    // found by key now
    expect(feed.getLiveBar('LKB', 'b1')!.close).toBe(57)
  })

  it('an id that matches nothing is searched for once, until the symbol list changes', async () => {
    const { feed, scans, tick } = await setup()
    feed.addSymbolByTicker('LKC', 'b1', 'MCX', 'EQ', 'LKC')
    const before = scans()
    for (let i = 0; i < 50; i++) tick('NSE:GHOST-EQ', 10 + i)
    expect(scans() - before).toBe(1)

    feed.addSymbolByTicker('GHOST', 'b1', 'MCX', 'EQ', 'NSE:GHOST-EQ')  // now it is tracked: the next tick counts
    tick('NSE:GHOST-EQ', 99)
    expect(feed.getLiveBar('GHOST', 'b1')!.close).toBe(99)
    expect(scans() - before).toBe(1)                                    // matched by key, no search
  })

  it('a name that is tracked later is matched by the slow search again, even if it was unknown before', async () => {
    const { feed, scans, tick } = await setup()
    feed.addSymbolByTicker('LKD', 'b1', 'MCX', 'EQ', 'LKD')
    tick('NSE:LATE-EQ', 5)                                              // unknown: remembered as unknown
    const before = scans()
    feed.addSymbolByTicker('LATE', 'b1', 'MCX', 'EQ', 'LATE')           // tracked under its plain name
    tick('NSE:LATE-EQ', 6)                                              // the slow search must run again (the list changed)
    expect(scans() - before).toBe(1)
    expect(feed.getLiveBar('LATE', 'b1')!.close).toBe(6)
    void MINUTE0
  })
})
