import { describe, it, expect, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import zlib from 'zlib'
import { parseNorenInstruments, norenExpiry } from '../src/brokers/adapters/noren/NorenInstruments'
import { parseNorenCandles, parseNorenTime, norenError, norenBody, norenFeedTimeMs } from '../src/brokers/adapters/noren/NorenAdapter'
import { FlattradeAdapter, flattradeMaster } from '../src/brokers/adapters/flattrade/FlattradeAdapter'
import { ShoonyaAdapter, shoonyaMaster } from '../src/brokers/adapters/shoonya/ShoonyaAdapter'
import { unzipFirstFile } from '../src/lib/unzip'
import { brokerLoginUrl } from '../src/brokers/brokerAuth'

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

// Real rows from the two public instrument lists (Oct 2026)
const SHOONYA_NSE = `Exchange,Token,LotSize,Symbol,TradingSymbol,Instrument,TickSize,
NSE,26000,1,Nifty 50,NIFTY INDEX,INDEX,0,
NSE,26009,1,Nifty Bank,NIFTY BANK,INDEX,0,
NSE,26037,1,Nifty Fin Services,FINNIFTY,INDEX,0,
NSE,23976,300,ZTECH,ZTECH-SM,SM,0.05,
NSE,19804,1,WELINV,WELINV-BE,BE,0.1,
NSE,11536,1,TCS,TCS-EQ,EQ,0.1,
NSE,2031,1,M&M,M&M-EQ,EQ,0.1,
NSE,3411,1,TATAELXSI,TATAELXSI-EQ,EQ,0.1,
NSE,100,1,GS2030,GS2030-GS,GS,0.01,
`
const SHOONYA_NFO = `Exchange,Token,LotSize,Symbol,TradingSymbol,Expiry,Instrument,OptionType,StrikePrice,TickSize,
NFO,48577,,,,,,,0,0,
NFO,64286,65,NIFTY,NIFTY23NOV26C22600,23-NOV-2026,OPTIDX,CE,22600,0.05,
NFO,61721,125,TATAELXSI,TATAELXSI23NOV26F,23-NOV-2026,FUTSTK,XX,-0.01,0.1,
NFO,61471,65,NIFTY,NIFTY23NOV26F,23-NOV-2026,FUTIDX,XX,-0.01,0.1,
NFO,49010,125,TATAELXSI,TATAELXSI27OCT26F,27-OCT-2026,FUTSTK,XX,-0.01,0.1,
NFO,39883,65,NIFTY,NIFTY09NOV26C22600,09-NOV-2026,OPTIDX,CE,22600,0.05,
`
const SHOONYA_MCX = `Exchange,Token,LotSize,GNGD,Symbol,TradingSymbol,Expiry,Instrument,OptionType,StrikePrice,TickSize,
MCX,573422,100,1,CRUDEOIL,CRUDEOIL19NOV26,19-NOV-2026,FUTCOM,XX,0,1,
`
const SHOONYA_BSE = `Exchange,Token,LotSize,Symbol,TradingSymbol,Instrument,TickSize,
BSE,500408,1,TATAELXSI,TATAELXSI,A,0.05,
BSE,978333,1,125ARSUT27,125ARSUT27,F,0.01,
`
const FLATTRADE_NSE = `Exchange,Token,Lotsize,Symbol,Tradingsymbol,Instrument,Expiry,Strike,Optiontype
NSE,26009,1,BANKNIFTY,Nifty Bank,INDEX,,0,
NSE,26000,1,NIFTY,Nifty 50,INDEX,,0,
NSE,26037,1,FINNIFTY,Nifty Fin,INDEX,,0,
NSE,11536,1,TCS,TCS-EQ,EQ,,0,
NSE,2031,1,M&M,M&M-EQ,EQ,,0,
NSE,3411,1,TATAELXSI,TATAELXSI-EQ,EQ,,0,
NSE,19804,1,WELINV,WELINV-BE,BE,,0,
`
const FLATTRADE_NFO = `Exchange,Token,Lotsize,Symbol,Tradingsymbol,Instrument,Expiry,Strike,Optiontype
NFO,61721,125,TATAELXSI,TATAELXSI23NOV26F,FUTSTK,23-NOV-2026,-0.01,XX
NFO,49010,125,TATAELXSI,TATAELXSI27OCT26F,FUTSTK,27-OCT-2026,-0.01,XX
NFO,61471,65,NIFTY,NIFTY23NOV26F,FUTIDX,23-NOV-2026,-0.01,XX
NFO,64286,65,NIFTY,NIFTY23NOV26C22600,OPTIDX,23-NOV-2026,22600.00,CE
NFO,39883,65,NIFTY,NIFTY09NOV26C22600,OPTIDX,09-NOV-2026,22600.00,CE
`
const FLATTRADE_MCX = `Exchange,Token,Lotsize,Symbol,Tradingsymbol,Instrument,Expiry,Strike,Optiontype
MCX,573422,100,CRUDEOIL,CRUDEOIL19NOV26,FUTCOM,19-NOV-2026,0.00,XX
`
const FLATTRADE_BSE = `Exchange,Token,Lotsize,Symbol,Tradingsymbol,Instrument,Expiry,Strike,Optiontype
BSE,1,1,SENSEX,SENSEX,UNDIND,,0,
BSE,500408,1,TATAELXSI,TATAELXSI,A,,0,
`

// The same keys Kite and Dhan give these instruments (kiteDhan.test.ts)
const SHARED: Record<string, string> = {
  'NSE:NIFTY50-INDEX': 'NSE|26000',
  'NSE:NIFTYBANK-INDEX': 'NSE|26009',
  'NSE:FINNIFTY-INDEX': 'NSE|26037',
  'NSE:TCS': 'NSE|11536',
  'NSE:M&M': 'NSE|2031',
  'NSE:TATAELXSI': 'NSE|3411',
  'NSE:WELINV-BE': 'NSE|19804',
  'NFO:TATAELXSI26OCTFUT': 'NFO|49010',
  'NFO:TATAELXSI26NOVFUT': 'NFO|61721',
  'NFO:NIFTY26NOVFUT': 'NFO|61471',
  'NFO:NIFTY26N0922600CE': 'NFO|39883', // weekly
  'NFO:NIFTY26NOV22600CE': 'NFO|64286', // last expiry of November: monthly
  'MCX:CRUDEOIL26NOVFUT': 'MCX|573422',
  'BSE:TATAELXSI': 'BSE|500408',
}

const shoonya = parseNorenInstruments(SHOONYA_NSE, SHOONYA_NFO, SHOONYA_MCX, SHOONYA_BSE)
const flattrade = parseNorenInstruments(FLATTRADE_NSE, FLATTRADE_NFO, FLATTRADE_MCX, FLATTRADE_BSE)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Noren instrument lists', () => {
  it.each([['Shoonya', shoonya], ['Flattrade', flattrade]])('%s rows get the broker-neutral keys and feed refs', (_name, records) => {
    const byKey = new Map(records.map(r => [r.key, r]))
    for (const [key, ref] of Object.entries(SHARED)) {
      expect(byKey.get(key)?.ref, key).toBe(ref)
    }
  })

  it('keeps SME / BE series in the name and drops bonds, G-secs and empty rows', () => {
    const keys = shoonya.map(r => r.key)
    expect(keys).toContain('NSE:ZTECH-SM')
    expect(keys.some(k => k.includes('GS2030') || k.includes('125ARSUT27'))).toBe(false)
    expect(shoonya.every(r => r.ref && r.ticker)).toBe(true)
  })

  it('reads categories, lot sizes, expiries and tick sizes', () => {
    const get = (key: string) => shoonya.find(r => r.key === key)!
    expect(get('NSE:NIFTY50-INDEX')).toMatchObject({ ticker: 'NIFTY50', cat: 'INDEX' })
    expect(get('NFO:TATAELXSI26NOVFUT')).toMatchObject({ ticker: 'TATAELXSI26NOVFUT', cat: 'FUTSTK', lot: 125, expiry: '2026-11-23', tick: 0.1 })
    expect(get('NFO:NIFTY26NOVFUT').cat).toBe('FUTIDX')
    expect(get('NFO:NIFTY26N0922600CE')).toMatchObject({ cat: 'OPTIDX', lot: 65, expiry: '2026-11-09' })
    expect(get('MCX:CRUDEOIL26NOVFUT')).toMatchObject({ cat: 'FUTCOM', lot: 100 })
    // Flattrade lists no tick sizes
    expect(flattrade.find(r => r.key === 'NSE:TCS')!.tick).toBe(0.05)
    expect(flattrade.find(r => r.key === 'BSE:SENSEX-INDEX')).toMatchObject({ ref: 'BSE|1', cat: 'INDEX' })
  })

  it('reads expiry dates', () => {
    expect(norenExpiry('09-NOV-2026')).toBe('2026-11-09')
    expect(norenExpiry('9-Nov-2026')).toBe('2026-11-09')
    expect(norenExpiry('')).toBe('')
  })

  it('resolves names stored by other brokers', () => {
    flattradeMaster.setRecords(flattrade)
    expect(flattradeMaster.resolve('NSE:TCS-EQ', 'NSE', 'EQ')?.ref).toBe('NSE|11536')    // Fyers
    expect(flattradeMaster.resolve('NIFTY 50', 'NSE')?.ref).toBe('NSE|26000')            // Kite
    expect(flattradeMaster.resolve('NSE:TATAELXSI26NOVFUT', 'NFO', 'FUT')?.ref).toBe('NFO|61721')
    expect(flattradeMaster.resolve('TATAELXSI-FUT', 'NFO', 'FUT')?.key).toMatch(/^NFO:TATAELXSI26(OCT|NOV)FUT$/)
  })
})

describe('Noren history', () => {
  const t0 = Date.parse('2026-10-26T09:15:00+05:30')

  it('reads TPSeries candles (IST times, newest first) into bars oldest first', () => {
    const rows = [
      { stat: 'Ok', time: '26-10-2026 09:16:00', into: '4210.5', inth: '4215', intl: '4209', intc: '4212', intv: '1250', v: '3100' },
      { stat: 'Ok', time: '26-10-2026 09:15:00', into: '4200', inth: '4211', intl: '4198.5', intc: '4210.5', intv: '1850', v: '1850' },
      { stat: 'Ok', time: '26-10-2026 09:14:00', into: '4200', inth: '4200', intl: '4200', intc: '4200', intv: '0', v: '0' },
    ]
    expect(parseNorenCandles(rows, 'NSE')).toEqual([
      { ts: t0, open: 4200, high: 4211, low: 4198.5, close: 4210.5, volume: 1850 },
      { ts: t0 + 60_000, open: 4210.5, high: 4215, low: 4209, close: 4212, volume: 1250 },
    ])
    // MCX trades from 09:00, so its early bars stay
    expect(parseNorenCandles(rows, 'MCX')).toHaveLength(3)
  })

  it('repairs what the series gets wrong: negative volume, wicks that miss open / close', () => {
    const [bar] = parseNorenCandles([{ time: '26-10-2026 15:20:00', into: '100', inth: '99', intl: '101', intc: '100.5', intv: '-3908214' }], 'NSE')
    expect(bar).toMatchObject({ high: 100.5, low: 100, volume: 0 })
  })

  it('falls back to ssboe when the time is missing', () => {
    const [bar] = parseNorenCandles([{ ssboe: String(t0 / 1000), into: '1', inth: '1', intl: '1', intc: '1', intv: '5' }], 'NSE')
    expect(bar.ts).toBe(t0)
  })

  it('parses IST time strings', () => {
    expect(parseNorenTime('07-12-2022 09:15:00')).toBe(Date.parse('2022-12-07T09:15:00+05:30'))
    expect(Number.isNaN(parseNorenTime('2022-12-07'))).toBe(true)
  })

  it('escapes "&" inside jData (the server splits the body on it)', () => {
    expect(norenBody({ tsym: 'M&M-EQ' }, 'tok')).toBe('jData={"tsym":"M\\u0026M-EQ"}&jKey=tok')
    expect(norenBody({ a: '1' })).toBe('jData={"a":"1"}')
  })

  it('maps errors to the backfill codes', () => {
    expect((norenError('Shoonya', 200, { stat: 'Not_Ok', emsg: 'Session Expired :  Invalid Session Key' }) as any).code).toBe(-16)
    expect((norenError('Shoonya', 200, { stat: 'Not_Ok', emsg: 'Rate_Limited: too many requests, retry after backoff' }) as any).code).toBe(429)
    expect(norenError('Shoonya', 200, { stat: 'Not_Ok', emsg: 'Invalid IP' }).message).toMatch(/static\) IP address/)
    expect((norenError('Flattrade', 500, null) as any)).toMatchObject({ code: 500, fromApi: true })
  })

  it('asks TPSeries with jKey for both brokers and treats "no data" as an empty range', async () => {
    const calls: Array<{ url: string; init: any }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ stat: 'Not_Ok', emsg: 'Error Occurred : 5 "no data"' }), { status: 200 })
    }))
    flattradeMaster.setRecords(flattrade)
    shoonyaMaster.setRecords(shoonya)
    const ft: any = new FlattradeAdapter()
    ft.uid = 'FT123'; ft.accessToken = 'tok-ft'
    const sh: any = new ShoonyaAdapter()
    sh.uid = 'SH123'; sh.accessToken = 'tok-sh'
    const from = new Date('2026-10-20T00:00:00Z'), to = new Date('2026-10-24T10:00:00Z')
    expect(await ft.getHistoricalBars('NSE:TCS', '1m', from, to)).toEqual([])
    expect(await sh.getHistoricalBars('NSE:TCS', '1m', from, to)).toEqual([])

    expect(calls[0].url).toBe('https://piconnect.flattrade.in/PiConnectAPI/TPSeries')
    expect(calls[0].init.body).toBe(`jData=${JSON.stringify({ uid: 'FT123', actid: 'FT123', exch: 'NSE', token: '11536', st: String(from.getTime() / 1000), et: String(to.getTime() / 1000), intrv: '1' })}&jKey=tok-ft`)
    expect(calls[1].url).toBe('https://api.shoonya.com/NorenWClientAPI/TPSeries')
    expect(calls[1].init.body).toMatch(/^jData=\{"uid":"SH123","exch":"NSE".*\}&jKey=tok-sh$/)
    expect(calls[1].init.headers.Authorization).toBeUndefined()
  })

  it('reports a dead session as an auth error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ stat: 'Not_Ok', emsg: 'Session Expired :  Invalid Session Key' }), { status: 200 })))
    flattradeMaster.setRecords(flattrade)
    const ft: any = new FlattradeAdapter()
    ft.uid = 'FT123'; ft.accessToken = 'old'
    await expect(ft.getHistoricalBars('NSE:TCS', '1m', new Date(t0 - 86_400_000), new Date(t0))).rejects.toMatchObject({ code: -16 })
  })
})

describe('Noren live feed', () => {
  it('merges tk snapshots with tf changes into ticks under the subscribed name', async () => {
    shoonyaMaster.setRecords(shoonya)
    const sh: any = new ShoonyaAdapter()
    await sh.subscribe(['NSE:TCS'])
    const ticks: any[] = []
    sh.on('tick', (t: any) => ticks.push(t))
    const now = Date.now()

    sh.onTouch({ t: 'tk', e: 'NSE', tk: '11536', lp: '4210.50', v: '980515', ft: String(Math.floor(now / 1000) - 5) })
    sh.onTouch({ t: 'tf', e: 'NSE', tk: '11536', lp: '4211.00', ft: String(Math.floor(now / 1000)) })   // price only
    sh.onTouch({ t: 'tf', e: 'NSE', tk: '11536', bp1: '4210.95' })                                   // depth only
    sh.onTouch({ t: 'tf', e: 'NSE', tk: '99999', lp: '10' })                                         // not subscribed

    expect(ticks).toHaveLength(2)
    expect(ticks[0]).toMatchObject({ instrumentId: 'NSE:TCS', lastPrice: 4210.5, totalVolume: 980515 })
    expect(ticks[1]).toMatchObject({ instrumentId: 'NSE:TCS', lastPrice: 4211, totalVolume: 980515 })
  })

  it('reads feed time as unix seconds, or IST clock when that is hours ahead', () => {
    const now = Date.parse('2026-10-26T10:00:00+05:30')
    expect(norenFeedTimeMs(String(now / 1000 - 2), now)).toBe(now - 2000)
    expect(norenFeedTimeMs(String(now / 1000 + 19_800), now)).toBe(now)
    expect(norenFeedTimeMs(undefined, now)).toBe(now)
  })
})

describe('Noren login', () => {
  it('builds the login pages', async () => {
    expect(await brokerLoginUrl('flattrade', 'flattrade-1', { apiKey: 'KEY 1', apiSecret: 's' })).toBe('https://auth.flattrade.in/?app_key=KEY%201')
    expect(await brokerLoginUrl('shoonya', 'shoonya-1', { apiKey: 'FA12345_U', apiSecret: 's' })).toBe('https://api.shoonya.com/OAuthlogin/authorize/oauth?client_id=FA12345_U')
  })

  it('exchanges the Flattrade code for a token and the client id (key + code + secret)', async () => {
    let sent: any
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.includes('apitoken')) {
        sent = JSON.parse(init.body)
        return new Response(JSON.stringify({ token: 'tok', client: 'FT123', stat: 'Ok', emsg: '' }), { status: 200 })
      }
      throw new Error('offline')
    }))
    const ft: any = new FlattradeAdapter()
    ft.startFeed = () => {}
    const session = await ft.connect({ apiKey: 'key', apiSecret: 'secret', requestToken: 'code1' })
    await ft.disconnect()
    expect(session).toMatchObject({ accountId: 'FT123', accessToken: 'tok' })
    expect(sent).toEqual({ api_key: 'key', request_code: 'code1', api_secret: sha256('keycode1secret') })
  })

  it('exchanges the Shoonya code through GenAcsTok (id + secret + code)', async () => {
    let body = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/GenAcsTok')) {
        body = init.body
        return new Response(JSON.stringify({ stat: 'Ok', susertoken: 'tok', uid: 'SH123', actid: 'SH123' }), { status: 200 })
      }
      throw new Error('offline')
    }))
    const sh: any = new ShoonyaAdapter()
    sh.startFeed = () => {}
    expect(await sh.connect({ apiKey: 'CID', apiSecret: 'SEC', requestToken: 'abc' })).toMatchObject({ accountId: 'SH123', accessToken: 'tok' })
    await sh.disconnect()
    expect(body).toBe(`jData=${JSON.stringify({ code: 'abc', checksum: sha256('CIDSECabc') })}`)
  })

  it('checks a saved Shoonya token with a Bearer request and reports a refused one as expired', async () => {
    const headers: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/UserDetails')) {
        headers.push(init.headers)
        return new Response(JSON.stringify({ stat: 'Not_Ok', emsg: 'Session Expired :  Invalid Session Key' }), { status: 200 })
      }
      throw new Error('offline')
    }))
    await expect(new ShoonyaAdapter().connect({ apiKey: 'CID', apiSecret: 'SEC', accessToken: 'old', clientId: 'SH123' })).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(headers[0].Authorization).toBe('Bearer old')
  })
})

describe('unzipFirstFile', () => {
  it('reads a deflated single-file archive', () => {
    const text = Buffer.from('Exchange,Token\nNSE,22\n')
    const data = zlib.deflateRawSync(text)
    const name = Buffer.from('NSE_symbols.txt')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(text.length, 22); local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(text.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42)
    const centralOff = local.length + name.length + data.length
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
    eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(centralOff, 16)
    const zip = Buffer.concat([local, name, data, central, name, eocd])
    expect(unzipFirstFile(zip).toString()).toBe(text.toString())
    expect(() => unzipFirstFile(Buffer.from('not a zip at all, not a zip at all'))).toThrow()
  })
})
