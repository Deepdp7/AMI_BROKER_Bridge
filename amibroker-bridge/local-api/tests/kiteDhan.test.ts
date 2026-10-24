import { describe, it, expect, afterEach, vi } from 'vitest'
import { parseSymbol, next0600IstMs, formatIstDateTime } from '../src/services/adapters/symbolKey'
import { InstrumentMaster } from '../src/services/adapters/InstrumentMaster'
import { parseKiteInstruments, parseKiteTime, kiteError, KiteAdapter, kiteMaster } from '../src/services/adapters/KiteAdapter'
import { parseDhanInstruments, dhanEpochOffsetSec, feedTimeMs, resetLearnedTimes, dhanError, DhanAdapter, dhanMaster } from '../src/services/adapters/DhanAdapter'
import { parseKiteFrame } from '../src/services/adapters/KiteTicker'
import { parseDhanFrame } from '../src/services/adapters/DhanFeed'
import { brokerLoginUrl } from '../src/services/brokerAuth'

// Real rows from the two public instrument lists (Oct 2026)
const KITE_CSV = `instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange
2953217,11536,TCS,"TATA CONSULTANCY SERV LT",0,,0,0.1,1,EQ,NSE,NSE
519937,2031,M&M,"MAHINDRA & MAHINDRA",0,,0,0.1,1,EQ,NSE,NSE
4267265,16669,BAJAJ-AUTO,"BAJAJ AUTO",0,,0,1,1,EQ,NSE,NSE
2584833,10097,GUJRAFFIA-BE,"GUJARAT RAFFIA INDUST",0,,0,0.01,1,EQ,NSE,NSE
256265,1001,NIFTY 50,"NIFTY 50",0,,0,0,0,EQ,INDICES,NSE
260105,1016,NIFTY BANK,"NIFTY BANK",0,,0,0,0,EQ,INDICES,NSE
12546562,49010,TATAELXSI26OCTFUT,"TATAELXSI",0,2026-10-27,0,0.1,125,FUT,NFO-FUT,NFO
15800578,61721,TATAELXSI26NOVFUT,"TATAELXSI",0,2026-11-23,0,0.1,125,FUT,NFO-FUT,NFO
10210050,39883,NIFTY26N0922600CE,"NIFTY",0,2026-11-09,22600,0.05,65,CE,NFO-OPT,NFO
13141506,51334,NIFTY26OCT22600CE,"NIFTY",0,2026-10-27,22600,0.05,65,CE,NFO-OPT,NFO
146796039,573422,CRUDEOIL26NOVFUT,"CRUDEOIL",0,2026-11-19,0,1,1,FUT,MCX-FUT,MCX
221605381,865646,BANKEX26OCTFUT,"BANKEX",0,2026-10-29,0,0.05,30,FUT,BFO-FUT,BFO
`

const DHAN_CSV = `SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,SEM_EXPIRY_CODE,SEM_TRADING_SYMBOL,SEM_LOT_UNITS,SEM_CUSTOM_SYMBOL,SEM_EXPIRY_DATE,SEM_STRIKE_PRICE,SEM_OPTION_TYPE,SEM_TICK_SIZE,SEM_EXPIRY_FLAG,SEM_EXCH_INSTRUMENT_TYPE,SEM_SERIES,SM_SYMBOL_NAME
NSE,E,11536,EQUITY,0,TCS,1.0,Tata Consultancy Services,,,,10.0000,NA,ES,EQ,TATA CONSULTANCY SERV LT
NSE,E,2031,EQUITY,0,M&M,1.0,Mahindra & Mahindra,,,,10.0000,NA,ES,EQ,MAHINDRA & MAHINDRA LTD
NSE,E,16669,EQUITY,0,BAJAJ-AUTO,1.0,Bajaj Auto,,,,100.0000,NA,ES,EQ,BAJAJ AUTO LIMITED
NSE,E,10097,EQUITY,0,GUJRAFFIA,1.0,Gujarat Raffia Industries,,,,1.0000,NA,ES,BE,GUJARAT RAFFIA INDUST LTD
NSE,I,13,INDEX,0,NIFTY,1.0,Nifty 50,0001-01-01,,XX,0.0500,,INDEX,X,NIFTY
NSE,I,25,INDEX,0,BANKNIFTY,1.0,Nifty Bank,0001-01-01,,XX,0.0500,,INDEX,X,BANKNIFTY
NSE,D,49010,FUTSTK,0,TATAELXSI-Oct2026-FUT,125.0,TATAELXSI OCT FUT,2026-10-27 14:30:00,-0.01000,XX,10.0000,M,FUT,,
NSE,D,61721,FUTSTK,0,TATAELXSI-Nov2026-FUT,125.0,TATAELXSI NOV FUT,2026-11-23 14:30:00,-0.01000,XX,10.0000,M,FUT,,
NSE,D,39883,OPTIDX,0,NIFTY-Nov2026-22600-CE,65.0,NIFTY 09 NOV 22600 CALL,2026-11-09 14:30:00,22600.00000,CE,5.0000,W,OP,,
NSE,D,51334,OPTIDX,0,NIFTY-Oct2026-22600-CE,65.0,NIFTY 27 OCT 22600 CALL,2026-10-27 14:30:00,22600.00000,CE,5.0000,M,OP,,
MCX,M,573422,FUTCOM,0,CRUDEOIL-19Nov2026-FUT,1.0,CRUDEOIL NOV FUT,2026-11-19 23:30:00,0.00000,XX,100.0000,M,FUTCOM,2,CRUDEOIL
BSE,D,1107392,FUTSTK,0,TATAELXSI-Nov2026-FUT,125.0,TATAELXSI NOV  FUT,2026-11-26 15:30:00,0.00000,,5.0000,M,FUTSTK,,TELXFUT
`

const SHARED_KEYS = [
  'NSE:TCS', 'NSE:M&M', 'NSE:BAJAJ-AUTO', 'NSE:GUJRAFFIA-BE', 'NSE:NIFTY50-INDEX', 'NSE:NIFTYBANK-INDEX',
  'NFO:TATAELXSI26OCTFUT', 'NFO:TATAELXSI26NOVFUT', 'NFO:NIFTY26N0922600CE', 'NFO:NIFTY26OCT22600CE', 'MCX:CRUDEOIL26NOVFUT',
]

const IST = (s: string) => new Date(`${s}+05:30`)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('parseSymbol reads every broker\'s stored names', () => {
  const cases: Array<[string, string | undefined, string | undefined, string, string]> = [
    ['NSE:TCS-EQ', 'NSE', 'EQ', 'NSE:TCS', 'EQ'],                         // Fyers
    ['NSE:BAJAJ-AUTO-EQ', 'NSE', 'EQ', 'NSE:BAJAJ-AUTO', 'EQ'],
    ['NSE:M&M-EQ', 'NSE', 'EQ', 'NSE:M&M', 'EQ'],
    ['NSE:GUJRAFFIA-BE', 'NSE', 'EQ', 'NSE:GUJRAFFIA-BE', 'EQ'],
    ['NSE:TATAELXSI26OCTFUT', 'NFO', 'FUT', 'NFO:TATAELXSI26OCTFUT', 'FUT'], // Fyers lists F&O under NSE:
    ['NFO:TATAELXSI26OCTFUT', undefined, undefined, 'NFO:TATAELXSI26OCTFUT', 'FUT'],
    ['NSE:NIFTY50-INDEX', undefined, undefined, 'NSE:NIFTY50-INDEX', 'INDEX'],
    ['NSE:NIFTY 50', undefined, undefined, 'NSE:NIFTY50-INDEX', 'INDEX'],   // Kite spelling
    ['NSE:NIFTY IT', undefined, undefined, 'NSE:NIFTYIT-INDEX', 'INDEX'],
    ['NIFTY', 'NSE', 'EQ', 'NSE:NIFTY50-INDEX', 'INDEX'],                   // plain AmiBroker ticker
    ['BANKNIFTY', undefined, undefined, 'NSE:NIFTYBANK-INDEX', 'INDEX'],
    ['SENSEX', undefined, undefined, 'BSE:SENSEX-INDEX', 'INDEX'],
    ['TCS', 'NSE', 'EQ', 'NSE:TCS', 'EQ'],
    ['BSE:RELIANCE-EQ', undefined, undefined, 'BSE:RELIANCE', 'EQ'],
    ['BSE:BAJAJ-AUTO', undefined, undefined, 'BSE:BAJAJ-AUTO', 'EQ'],
    ['TATAELXSI-FUT', undefined, undefined, 'NFO:TATAELXSI', 'NEAREST_FUT'],
    ['TATAELXSI', 'NFO', 'FUT', 'NFO:TATAELXSI', 'NEAREST_FUT'],
    ['NIFTY', 'NFO', undefined, 'NFO:NIFTY', 'NEAREST_FUT'],
    ['CRUDEOIL', 'MCX', 'COMM', 'MCX:CRUDEOIL', 'NEAREST_FUT'],
    ['CRUDEOIL', undefined, undefined, 'MCX:CRUDEOIL', 'NEAREST_FUT'],
    ['GOLDBEES', undefined, undefined, 'NSE:GOLDBEES', 'EQ'],                 // an ETF, not MCX gold
    ['MCX:CRUDEOIL26NOVFUT', undefined, undefined, 'MCX:CRUDEOIL26NOVFUT', 'FUT'],
    ['NFO:NIFTY26N0922600CE', undefined, undefined, 'NFO:NIFTY26N0922600CE', 'OPT'],
    ['NIFTY26OCT22600PE', 'NFO', 'OPT', 'NFO:NIFTY26OCT22600PE', 'OPT'],
  ]
  for (const [raw, ex, type, key, kind] of cases) {
    it(`${raw} (${ex || '-'}/${type || '-'}) → ${key}`, () => {
      const p = parseSymbol(raw, ex, type)
      expect(p.key).toBe(key)
      expect(p.kind).toBe(kind)
    })
  }
})

describe('instrument lists', () => {
  const kite = parseKiteInstruments(KITE_CSV)
  const dhan = parseDhanInstruments(DHAN_CSV)

  it('Kite and Dhan give the same contract the same key', () => {
    const kiteKeys = new Set(kite.map(r => r.key))
    const dhanKeys = new Set(dhan.map(r => r.key))
    for (const k of SHARED_KEYS) {
      expect(kiteKeys, `kite ${k}`).toContain(k)
      expect(dhanKeys, `dhan ${k}`).toContain(k)
    }
  })

  it('keeps only the tracked segments (no BSE F&O)', () => {
    expect(kite.some(r => r.key.startsWith('BFO:'))).toBe(false)
    expect(dhan.find(r => r.ref.includes('1107392'))).toBeUndefined()
  })

  it('stores what each broker needs to fetch and stream', () => {
    expect(kite.find(r => r.key === 'NFO:TATAELXSI26OCTFUT')).toMatchObject({ ref: '12546562', ticker: 'TATAELXSI26OCTFUT', cat: 'FUTSTK', lot: 125, expiry: '2026-10-27' })
    expect(kite.find(r => r.key === 'NSE:NIFTY50-INDEX')).toMatchObject({ ref: '256265', ticker: 'NIFTY50', cat: 'INDEX' })
    expect(dhan.find(r => r.key === 'NSE:TCS')).toMatchObject({ ref: 'NSE_EQ|11536|EQUITY', ticker: 'TCS', tick: 0.1 })
    expect(dhan.find(r => r.key === 'NSE:NIFTY50-INDEX')).toMatchObject({ ref: 'IDX_I|13|INDEX', ticker: 'NIFTY50' })
    expect(dhan.find(r => r.key === 'NFO:NIFTY26N0922600CE')).toMatchObject({ ref: 'NSE_FNO|39883|OPTIDX', cat: 'OPTIDX' })
    expect(dhan.find(r => r.key === 'MCX:CRUDEOIL26NOVFUT')).toMatchObject({ ref: 'MCX_COMM|573422|FUTCOM', cat: 'FUTCOM' })
  })

  it('resolves stored Fyers names, plain tickers and nearest futures', async () => {
    const master = new InstrumentMaster('test-kite', async () => kite, 1)
    master.setRecords(kite)
    expect(master.resolve('NSE:TCS-EQ', 'NSE', 'EQ')?.ref).toBe('2953217')
    expect(master.resolve('NSE:BAJAJ-AUTO-EQ', 'NSE', 'EQ')?.ref).toBe('4267265')
    expect(master.resolve('NSE:TATAELXSI26OCTFUT', 'NFO', 'FUT')?.ref).toBe('12546562')
    expect(master.resolve('NIFTY', 'NSE', 'EQ')?.ref).toBe('256265')
    expect(master.resolve('NSE:NOSUCHSTOCK-EQ')).toBeUndefined()

    expect(master.nearestFuture('NFO:TATAELXSI', IST('2026-10-25T10:00:00').getTime())?.key).toBe('NFO:TATAELXSI26OCTFUT')
    // After the October expiry the November contract is the nearest
    expect(master.nearestFuture('NFO:TATAELXSI', IST('2026-10-28T10:00:00').getTime())?.key).toBe('NFO:TATAELXSI26NOVFUT')
  })

  it('searches by ticker with exact matches first and the app\'s segment filters', () => {
    const master = new InstrumentMaster('test-dhan', async () => dhan, 1)
    master.setRecords(dhan)
    const all = master.search('tataelxsi')
    expect(all.map(r => r.ticker)).toEqual(['TATAELXSI26OCTFUT', 'TATAELXSI26NOVFUT'])
    expect(all[0]).toMatchObject({ instrumentId: 'NFO:TATAELXSI26OCTFUT', exchange: 'NFO', instrumentType: 'FUT', lotSize: 125 })
    expect(master.search('TCS')[0]).toMatchObject({ instrumentId: 'NSE:TCS', ticker: 'TCS', instrumentType: 'EQ' })
    expect(master.search('NIFTY', 'NFO-13').every(r => r.instrumentType === 'OPT')).toBe(true)
    expect(master.search('NIFTY', 'NSE-10').map(r => r.ticker)).toEqual(['NIFTY50', 'NIFTYBANK'])
  })
})

describe('Kite live feed packets (big-endian)', () => {
  function frame(...packets: Buffer[]) {
    const parts = [Buffer.alloc(2)]
    parts[0].writeUInt16BE(packets.length)
    for (const p of packets) {
      const len = Buffer.alloc(2)
      len.writeUInt16BE(p.length)
      parts.push(len, p)
    }
    return Buffer.concat(parts)
  }

  it('reads full-mode equity packets with day volume and exchange time', () => {
    const p = Buffer.alloc(184)
    p.writeUInt32BE(2953217, 0)        // TCS (segment 1 = NSE)
    p.writeInt32BE(305055, 4)          // ₹3050.55
    p.writeUInt32BE(12, 8)             // last qty
    p.writeUInt32BE(1_234_567, 16)     // day volume
    p.writeInt32BE(300000, 28)
    p.writeUInt32BE(1_792_731_540, 44)
    p.writeUInt32BE(1_792_731_541, 60)
    const idx = Buffer.alloc(8)
    idx.writeUInt32BE(256265, 0)       // NIFTY 50 (segment 9), LTP mode
    idx.writeInt32BE(2_550_010, 4)
    const [eq, index] = parseKiteFrame(frame(p, idx))
    expect(eq).toMatchObject({ token: 2953217, lastPrice: 3050.55, lastQty: 12, volume: 1_234_567, open: 3000, exchangeTs: 1_792_731_541 })
    expect(index).toEqual({ token: 256265, lastPrice: 25500.1 })
  })

  it('reads index full packets and ignores heartbeats', () => {
    const p = Buffer.alloc(32)
    p.writeUInt32BE(256265, 0)
    p.writeInt32BE(2_550_010, 4)
    p.writeInt32BE(2_560_000, 8)
    p.writeUInt32BE(1_792_731_541, 28)
    expect(parseKiteFrame(frame(p))[0]).toMatchObject({ lastPrice: 25500.1, high: 25600, exchangeTs: 1_792_731_541 })
    expect(parseKiteFrame(Buffer.from([0]))).toEqual([])
  })

  it('uses the currency divisor for CDS tokens', () => {
    const p = Buffer.alloc(8)
    p.writeUInt32BE((1234 << 8) | 3, 0)
    p.writeInt32BE(840_512_345, 4)
    expect(parseKiteFrame(frame(p))[0].lastPrice).toBeCloseTo(84.0512345, 7)
  })
})

describe('Dhan live feed packets (little-endian)', () => {
  function quote(segment: number, securityId: number, ltp: number, ltq: number, ltt: number, volume: number) {
    const b = Buffer.alloc(50)
    b.writeUInt8(4, 0); b.writeUInt16LE(50, 1); b.writeUInt8(segment, 3); b.writeInt32LE(securityId, 4)
    b.writeFloatLE(ltp, 8); b.writeUInt16LE(ltq, 12); b.writeInt32LE(ltt, 14); b.writeFloatLE(ltp, 18)
    b.writeInt32LE(volume, 22); b.writeFloatLE(3000, 34); b.writeFloatLE(3100, 42); b.writeFloatLE(2990, 46)
    return b
  }

  it('reads quote packets, several in one frame', () => {
    const packets = parseDhanFrame(Buffer.concat([quote(1, 11536, 3050.5, 7, 1_792_731_541, 99_000), quote(2, 49010, 5123.25, 125, 1_792_731_542, 5_000)]))
    expect(packets).toHaveLength(2)
    expect(packets[0]).toMatchObject({ code: 4, segment: 1, securityId: 11536, ltq: 7, ltt: 1_792_731_541, volume: 99_000, open: 3000, high: 3100, low: 2990 })
    expect(packets[0].ltp).toBeCloseTo(3050.5, 2)
    expect(packets[1]).toMatchObject({ segment: 2, securityId: 49010 })
  })

  it('reads ticker and disconnect packets', () => {
    const t = Buffer.alloc(16)
    t.writeUInt8(2, 0); t.writeUInt16LE(16, 1); t.writeUInt8(0, 3); t.writeInt32LE(13, 4); t.writeFloatLE(25500.1, 8); t.writeInt32LE(1_792_731_541, 12)
    const d = Buffer.alloc(10)
    d.writeUInt8(50, 0); d.writeUInt16LE(10, 1); d.writeInt16LE(807, 8)
    const [ticker, disconnect] = parseDhanFrame(Buffer.concat([t, d]))
    expect(ticker).toMatchObject({ code: 2, segment: 0, securityId: 13, ltt: 1_792_731_541 })
    expect(disconnect).toMatchObject({ code: 50, disconnectReason: 807 })
  })
})

describe('Dhan timestamps', () => {
  // 23 Oct 2026, 09:15–15:29 IST, one candle a minute
  const from = IST('2026-10-23T09:15:00').getTime()
  const to = IST('2026-10-23T15:30:00').getTime()
  const unix = Array.from({ length: 375 }, (_, i) => from / 1000 + i * 60)

  afterEach(() => resetLearnedTimes())

  it('reads a full day as unix time, IST clock time or the old 1980 epoch, whichever is in market hours', () => {
    resetLearnedTimes()
    expect(dhanEpochOffsetSec(unix, from, to, 'NSE')).toBe(0)
    expect(dhanEpochOffsetSec(unix.map(t => t + 19_800), from, to, 'NSE')).toBe(-19_800)
    expect(dhanEpochOffsetSec(unix.map(t => t - 315_532_800), from, to, 'NSE')).toBe(315_532_800)
  })

  it('a morning-only answer (in market hours either way) uses the format learned earlier', () => {
    const morning = unix.slice(0, 60) // 09:15–10:14
    resetLearnedTimes()
    dhanEpochOffsetSec(unix.map(t => t + 19_800), from, to, 'NSE') // a full day teaches "IST clock"
    expect(dhanEpochOffsetSec(morning.map(t => t + 19_800), from, to, 'NSE')).toBe(-19_800)
    resetLearnedTimes()
    dhanEpochOffsetSec(unix, from, to, 'NSE')
    expect(dhanEpochOffsetSec(morning, from, to, 'NSE')).toBe(0)
  })

  it('the v2 docs\' sample reads as 09:15 IST on the 1980 epoch', () => {
    const offset = dhanEpochOffsetSec([1328845500, 1328845560, 1328845620], IST('2022-02-09T09:15:00').getTime(), IST('2022-02-09T09:20:00').getTime(), 'NSE')
    expect(new Date((1328845500 + offset) * 1000).toISOString()).toBe('2022-02-09T03:45:00.000Z')
  })

  it('learns whether feed trade times are unix or IST clock from a live trade', () => {
    const now = IST('2026-10-26T10:30:00').getTime()
    const nowSec = now / 1000
    const lastFridayClose = IST('2026-10-23T15:29:58').getTime()
    resetLearnedTimes()
    expect(feedTimeMs(nowSec - 2, 'NSE', now)).toBe(now - 2000)
    // An old trade (subscribe snapshot) uses what was learned
    expect(feedTimeMs(lastFridayClose / 1000, 'NSE', now)).toBe(lastFridayClose)

    resetLearnedTimes()
    expect(feedTimeMs(nowSec + 19_800 - 2, 'NSE', now)).toBe(now - 2000)
    expect(feedTimeMs(lastFridayClose / 1000 + 19_800, 'NSE', now)).toBe(lastFridayClose)
  })
})

describe('error mapping', () => {
  it('Kite', () => {
    expect((kiteError(403, { status: 'error', error_type: 'TokenException', message: 'Incorrect `api_key` or `access_token`.' }) as any).code).toBe(-16)
    expect((kiteError(429, { status: 'error', error_type: 'NetworkException', message: 'Too many requests' }) as any).code).toBe(429)
    const perm: any = kiteError(403, { status: 'error', error_type: 'PermissionException', message: 'Insufficient permission for that call.' })
    expect(perm.fromApi).toBe(true)
    expect(perm.message).toMatch(/Kite Connect subscription/)
    expect((kiteError(400, { status: 'error', error_type: 'InputException', message: 'interval exceeds max limit: 60 days' }) as any).fromApi).toBe(true)
  })

  it('Dhan', () => {
    expect((dhanError(401, { errorType: 'Invalid_Authentication', errorCode: 'DH-901', errorMessage: 'Client ID or user generated access token is invalid or expired.' }) as any).code).toBe(-16)
    expect((dhanError(429, { errorCode: 'DH-904' }) as any).code).toBe(429)
    expect((dhanError(400, { errorCode: 'DH-902', errorMessage: 'not subscribed to Data APIs' }) as any).message).toMatch(/Data API plan/)
    expect((dhanError(400, { errorCode: 'DH-905', errorMessage: 'bad input' }) as any).fromApi).toBe(true)
  })
})

describe('history requests', () => {
  it('Kite: instrument token in the path, IST range, candles to unix ms', async () => {
    kiteMaster.setRecords(parseKiteInstruments(KITE_CSV))
    const calls: Array<{ url: string; init: any }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ status: 'success', data: { candles: [['2026-10-23T09:15:00+0530', 3000, 3010, 2995, 3005, 1200], ['2026-10-23T09:16:00+0530', 3005, 3006, 3001, 3002, 800]] } }), { status: 200 })
    }))
    const kite = new KiteAdapter()
    Object.assign(kite as any, { apiKey: 'key123', accessToken: 'tok456' })

    const bars = await kite.getHistoricalBars('NSE:TCS-EQ', '1m', IST('2026-10-23T09:15:00'), IST('2026-10-23T15:30:00'))
    expect(calls[0].url).toBe('https://api.kite.trade/instruments/historical/2953217/minute?from=2026-10-23%2009%3A15%3A00&to=2026-10-23%2015%3A30%3A00')
    expect(calls[0].init.headers).toMatchObject({ 'X-Kite-Version': '3', Authorization: 'token key123:tok456' })
    expect(bars).toEqual([
      { ts: IST('2026-10-23T09:15:00').getTime(), open: 3000, high: 3010, low: 2995, close: 3005, volume: 1200 },
      { ts: IST('2026-10-23T09:16:00').getTime(), open: 3005, high: 3006, low: 3001, close: 3002, volume: 800 },
    ])
    await expect(kite.getHistoricalBars('NSE:EXPIRED26SEPFUT', '1m', new Date(), new Date())).rejects.toMatchObject({ code: -300 })
  })

  it('Dhan: security id + segment in the body; IST-clock timestamps corrected', async () => {
    dhanMaster.setRecords(parseDhanInstruments(DHAN_CSV))
    resetLearnedTimes()
    const t0 = IST('2026-10-23T09:15:00').getTime() / 1000
    const calls: Array<{ url: string; init: any }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, init })
      const ts = Array.from({ length: 375 }, (_, i) => t0 + 19_800 + i * 60) // a full day on the IST wall clock
      return new Response(JSON.stringify({ open: ts.map(() => 5100), high: ts.map(() => 5110), low: ts.map(() => 5090), close: ts.map(() => 5105), volume: ts.map(() => 250), timestamp: ts }), { status: 200 })
    }))
    const dhan = new DhanAdapter()
    Object.assign(dhan as any, { accessToken: 'jwt', clientId: '1100000001' })

    const bars = await dhan.getHistoricalBars('NSE:TATAELXSI26OCTFUT', '1m', IST('2026-10-23T09:15:00'), IST('2026-10-23T15:30:00'))
    expect(calls[0].url).toBe('https://api.dhan.co/v2/charts/intraday')
    expect(JSON.parse(calls[0].init.body)).toEqual({
      securityId: '49010', exchangeSegment: 'NSE_FNO', instrument: 'FUTSTK', interval: '1', oi: false,
      fromDate: '2026-10-23 09:15:00', toDate: '2026-10-23 15:30:00',
    })
    expect(calls[0].init.headers['access-token']).toBe('jwt')
    expect(bars[0]).toEqual({ ts: IST('2026-10-23T09:15:00').getTime(), open: 5100, high: 5110, low: 5090, close: 5105, volume: 250 })
    expect(bars[374].ts).toBe(IST('2026-10-23T15:29:00').getTime())
    resetLearnedTimes()
  })
})

describe('login', () => {
  it('Kite login URL carries the account id back as state', async () => {
    expect(await brokerLoginUrl('zerodha_kite', 'zerodha_kite-ab12cd34', { apiKey: 'kitekey', apiSecret: 's' }))
      .toBe('https://kite.zerodha.com/connect/login?v=3&api_key=kitekey&redirect_params=state%3Dzerodha_kite-ab12cd34')
  })

  it('Fyers login URL is unchanged', async () => {
    expect(await brokerLoginUrl('fyers', 'fyers-1', { apiKey: 'ABC-100', apiSecret: 's' }))
      .toBe('https://api-t1.fyers.in/api/v3/generate-authcode?client_id=ABC-100&redirect_uri=http%3A%2F%2F127.0.0.1%3A7890%2Fapi%2Fcallback%2Ffyers&response_type=code&state=fyers-1')
  })

  it('Dhan asks for a consent session with the app keys, then opens its login page', async () => {
    const calls: Array<{ url: string; init: any }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ consentAppId: '940b0ca1-3ff4', consentAppStatus: 'GENERATED', status: 'success' }), { status: 200 })
    }))
    expect(await brokerLoginUrl('dhan', 'dhan-1', { apiKey: 'appkey', apiSecret: 'appsecret', clientId: '1100000001' }))
      .toBe('https://auth.dhan.co/login/consentApp-login?consentAppId=940b0ca1-3ff4')
    expect(calls[0].url).toBe('https://auth.dhan.co/app/generate-consent?client_id=1100000001')
    expect(calls[0].init).toMatchObject({ method: 'POST', headers: { app_id: 'appkey', app_secret: 'appsecret' } })
    await expect(brokerLoginUrl('dhan', 'dhan-1', { apiKey: 'a', apiSecret: 'b' })).rejects.toThrow(/Client ID/)
  })
})

describe('time helpers', () => {
  it('Kite tokens die at the next 06:00 IST', () => {
    expect(next0600IstMs(IST('2026-10-26T09:00:00').getTime())).toBe(IST('2026-10-27T06:00:00').getTime())
    expect(next0600IstMs(IST('2026-10-27T05:00:00').getTime())).toBe(IST('2026-10-27T06:00:00').getTime())
  })

  it('formats IST ranges and reads Kite times', () => {
    expect(formatIstDateTime(new Date('2026-10-23T03:45:00Z'))).toBe('2026-10-23 09:15:00')
    expect(parseKiteTime('2026-10-23T09:15:00+0530')).toBe(Date.parse('2026-10-23T03:45:00Z'))
  })
})
