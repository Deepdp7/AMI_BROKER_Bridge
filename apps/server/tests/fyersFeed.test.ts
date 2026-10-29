/**
 * Fyers live feed (HSM binary): fields are read in the order Fyers' own SDK reads them
 * (fyers_apiv3 3.2.0 map.json "data_val" / "index_val"). Messages below are built field by
 * field in that order.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { FyersHSMClient, type HSMMappedTick } from '../src/brokers/adapters/fyers/FyersHSMClient'

const NIL = -2147483648
const str = (s: string) => Buffer.concat([Buffer.from([s.length]), Buffer.from(s)])

/** One data-feed message (type 6) with a single snapshot (83) for `topic` */
function snapshot(topic: string, fields: number[], scrip: boolean): Buffer {
  const head = Buffer.from([0, 0, 6, 0, 0, 0, 0, 0, 1])
  const vals = Buffer.alloc(fields.length * 4)
  fields.forEach((v, i) => vals.writeInt32BE(v, i * 4))
  const parts = [head, Buffer.from([83, 0, 1]), str(topic), Buffer.from([fields.length]), vals]
  if (scrip) parts.push(Buffer.from([0, 0, 0, 1, 2]), str('NSE'), str('61697'), str('RELIANCE26NOVFUT'))
  return Buffer.concat(parts)
}

let client: FyersHSMClient | null = null
afterEach(() => { (client as any)?.statsTimer && clearInterval((client as any).statsTimer); client = null })

function feed(topic: string, ticker: string, msg: Buffer): Promise<HSMMappedTick> {
  client = new FyersHSMClient('token')
  client.setSymbolMapping(ticker, topic)
  return new Promise(resolve => {
    client!.on('tick', resolve)
    ;(client as any).parseBinaryMessage(msg)
  })
}

describe('Fyers live feed', () => {
  it('a future: price, day volume, time and open interest (field 13)', async () => {
    const now = Math.floor(Date.now() / 1000)
    //            ltp     vol      ltt  feed time  bsz asz  bid     ask     ltq  tbq   tsq   atp     OI         low     high    yh   yl   lc   uc   open    prev close
    const f = [140050, 1_234_500, now, now, 500, 500, 140045, 140055, 500, 9000, 8000, 139900, 5_250_000, 139500, 140500, NIL, NIL, NIL, NIL, 139600, 139000]
    const tick = await feed('sf|nse_fo|61697', 'NSE:RELIANCE26NOVFUT', snapshot('sf|nse_fo|61697', f, true))
    expect(tick.lastPrice).toBe(1400.5)
    expect(tick.totalVolume).toBe(1_234_500)
    expect(tick.timestamp).toBe(now * 1000)
    expect(tick.openInterest).toBe(5_250_000)
    expect(tick.prevClose).toBe(1390)
    expect(tick.open).toBe(1396)
  })

  it('an index: prev close comes 2nd and the feed time 3rd', async () => {
    const now = Math.floor(Date.now() / 1000)
    //            ltp       prev close feed time high     low      open
    const f = [2_401_050, 2_390_000, now, 2_405_000, 2_388_000, 2_395_000]
    const tick = await feed('if|nse_cm|Nifty 50', 'NSE:NIFTY50-INDEX', snapshot('if|nse_cm|Nifty 50', f, false))
    expect(tick.lastPrice).toBe(24010.5)
    expect(tick.prevClose).toBe(23900)
    expect(tick.high).toBe(24050)
    expect(tick.open).toBe(23950)
    expect(tick.timestamp).toBe(now * 1000)
  })

  it('a time that is not a believable clock time never makes a candle in 1970', async () => {
    const before = Date.now()
    const f = [2_401_050, 2_390_000, 2_395_000 /* a price where the time should be */, 2_405_000, 2_388_000, 2_395_000]
    const tick = await feed('if|nse_cm|Nifty 50', 'NSE:NIFTY50-INDEX', snapshot('if|nse_cm|Nifty 50', f, false))
    expect(tick.timestamp).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000)
  })
})
