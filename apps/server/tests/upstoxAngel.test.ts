import { describe, it, expect, afterEach, vi } from 'vitest'
import { parseUpstoxInstruments, parseUpstoxCandles, upstoxError, UpstoxAdapter, upstoxMaster } from '../src/brokers/adapters/upstox/UpstoxAdapter'
import { decodeUpstoxFeed, pbFields } from '../src/brokers/adapters/upstox/UpstoxFeed'
import { parseAngelInstruments, parseAngelCandles, angelError, AngelAdapter, angelMaster } from '../src/brokers/adapters/angel/AngelAdapter'
import { parseAngelPacket } from '../src/brokers/adapters/angel/AngelFeed'
import { brokerLoginUrl } from '../src/brokers/brokerAuth'
import { nextIstTimeMs } from '../src/brokers/adapters/symbolKey'

// Real rows from the two public instrument lists (Oct 2026)
const ANGEL_ROWS = [
  { token: '11536', symbol: 'TCS-EQ', name: 'TCS', expiry: '', strike: '-1.000000', lotsize: '1', instrumenttype: '', exch_seg: 'NSE', tick_size: '10.000000' },
  { token: '2031', symbol: 'M&M-EQ', name: 'M&M', expiry: '', strike: '-1.000000', lotsize: '1', instrumenttype: '', exch_seg: 'NSE', tick_size: '10.000000' },
  { token: '10097', symbol: 'GUJRAFFIA-BE', name: 'GUJRAFFIA', expiry: '', strike: '-1.000000', lotsize: '1', instrumenttype: '', exch_seg: 'NSE', tick_size: '1.000000' },
  { token: '10046', symbol: '757GS2033-GS', name: '757GS2033', expiry: '', strike: '-1.000000', lotsize: '1', instrumenttype: '', exch_seg: 'NSE', tick_size: '1.000000' },
  { token: '99926000', symbol: 'Nifty 50', name: 'NIFTY', expiry: '', strike: '0.000000', lotsize: '1', instrumenttype: 'AMXIDX', exch_seg: 'NSE', tick_size: '0.000000' },
  { token: '99919000', symbol: 'SENSEX', name: 'SENSEX', expiry: '', strike: '0.000000', lotsize: '1', instrumenttype: 'AMXIDX', exch_seg: 'BSE', tick_size: '0.000000' },
  { token: '49010', symbol: 'TATAELXSI27OCT26FUT', name: 'TATAELXSI', expiry: '27OCT2026', strike: '-1.000000', lotsize: '125', instrumenttype: 'FUTSTK', exch_seg: 'NFO', tick_size: '10.000000' },
  { token: '39883', symbol: 'NIFTY09NOV2622600CE', name: 'NIFTY', expiry: '09NOV2026', strike: '2260000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '64286', symbol: 'NIFTY23NOV2622600CE', name: 'NIFTY', expiry: '23NOV2026', strike: '2260000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '573422', symbol: 'CRUDEOIL19NOV26FUT', name: 'CRUDEOIL', expiry: '19NOV2026', strike: '0.000000', lotsize: '100', instrumenttype: 'FUTCOM', exch_seg: 'MCX', tick_size: '100.000000' },
  { token: '294', symbol: 'CRUDEOILCOM', name: 'CRUDEOIL', expiry: '', strike: '0.000000', lotsize: '100', instrumenttype: 'COMDTY', exch_seg: 'MCX', tick_size: '100.000000' },
]

const UPSTOX_ROWS = [
  { segment: 'NSE_EQ', name: 'TATA CONSULTANCY SERV LT', instrument_type: 'EQ', instrument_key: 'NSE_EQ|INE467B01029', trading_symbol: 'TCS', lot_size: 1, tick_size: 10 },
  { segment: 'NSE_EQ', name: 'MAHINDRA & MAHINDRA LTD', instrument_type: 'EQ', instrument_key: 'NSE_EQ|INE101A01026', trading_symbol: 'M&M', lot_size: 1, tick_size: 10 },
  { segment: 'NSE_EQ', name: 'GUJARAT RAFFIA INDUST LTD', instrument_type: 'BE', instrument_key: 'NSE_EQ|INE610B01024', trading_symbol: 'GUJRAFFIA', lot_size: 1, tick_size: 1 },
  { segment: 'NSE_EQ', name: 'GOI STRIPS C 220830', instrument_type: 'GS', instrument_key: 'NSE_EQ|IN000830C025', trading_symbol: 'GS220830C', lot_size: 100, tick_size: 1 },
  { segment: 'NSE_INDEX', name: 'Nifty 50', instrument_type: 'INDEX', instrument_key: 'NSE_INDEX|Nifty 50', trading_symbol: 'NIFTY' },
  { segment: 'BSE_INDEX', name: 'BSE SENSEX', instrument_type: 'INDEX', instrument_key: 'BSE_INDEX|SENSEX', trading_symbol: 'SENSEX' },
  { segment: 'NSE_FO', name: 'TATA ELXSI LIMITED', instrument_type: 'FUT', instrument_key: 'NSE_FO|49010', trading_symbol: 'TATAELXSI FUT 27 OCT 26', lot_size: 125, tick_size: 10, expiry: 1793125799000, strike_price: 0, underlying_symbol: 'TATAELXSI', underlying_type: 'EQUITY', weekly: false },
  { segment: 'NSE_FO', name: 'NIFTY', instrument_type: 'CE', instrument_key: 'NSE_FO|39883', trading_symbol: 'NIFTY 22600 CE 09 NOV 26', lot_size: 65, tick_size: 5, expiry: 1794248999000, strike_price: 22600, underlying_symbol: 'NIFTY', underlying_type: 'INDEX', weekly: true },
  { segment: 'NSE_FO', name: 'NIFTY', instrument_type: 'CE', instrument_key: 'NSE_FO|64286', trading_symbol: 'NIFTY 22600 CE 23 NOV 26', lot_size: 65, tick_size: 5, expiry: 1795458599000, strike_price: 22600, underlying_symbol: 'NIFTY', underlying_type: 'INDEX', weekly: false },
  { segment: 'MCX_FO', name: 'CRUDE OIL', instrument_type: 'FUT', instrument_key: 'MCX_FO|573422', trading_symbol: 'CRUDEOIL FUT 19 NOV 26', lot_size: 100, tick_size: 100, expiry: 1795112999000, strike_price: 0, underlying_symbol: 'CRUDEOIL', underlying_type: 'COM' },
]

// The keys Kite, Dhan, Flattrade and Shoonya give the same instruments
const SHARED_KEYS = [
  'NSE:TCS', 'NSE:M&M', 'NSE:GUJRAFFIA-BE', 'NSE:NIFTY50-INDEX', 'BSE:SENSEX-INDEX',
  'NFO:TATAELXSI26OCTFUT', 'NFO:NIFTY26N0922600CE', 'NFO:NIFTY26NOV22600CE', 'MCX:CRUDEOIL26NOVFUT',
]

const angel = parseAngelInstruments(ANGEL_ROWS)
const upstox = parseUpstoxInstruments(UPSTOX_ROWS)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('instrument lists', () => {
  it.each([['Angel One', angel], ['Upstox', upstox]])('%s rows get the broker-neutral keys', (_name, records) => {
    const keys = records.map(r => r.key)
    for (const k of SHARED_KEYS) expect(keys, k).toContain(k)
    // Government securities and the MCX spot rows are not tradable symbols here
    expect(keys.some(k => /GS/.test(k) || k === 'MCX:CRUDEOILCOM')).toBe(false)
  })

  it('reads refs, lots, tick sizes (paise) and strikes (paise for Angel)', () => {
    const a = (key: string) => angel.find(r => r.key === key)!
    expect(a('NSE:TCS')).toMatchObject({ ref: 'NSE|11536', tick: 0.1, cat: 'EQ' })
    expect(a('NSE:NIFTY50-INDEX')).toMatchObject({ ref: 'NSE|99926000', cat: 'INDEX' })
    expect(a('NFO:NIFTY26N0922600CE')).toMatchObject({ ref: 'NFO|39883', lot: 65, tick: 0.05, cat: 'OPTIDX', expiry: '2026-11-09' })
    expect(a('MCX:CRUDEOIL26NOVFUT')).toMatchObject({ cat: 'FUTCOM', tick: 1, lot: 100 })
    const u = (key: string) => upstox.find(r => r.key === key)!
    expect(u('NSE:TCS')).toMatchObject({ ref: 'NSE_EQ|INE467B01029', tick: 0.1 })
    expect(u('NFO:TATAELXSI26OCTFUT')).toMatchObject({ ref: 'NSE_FO|49010', expiry: '2026-10-27', cat: 'FUTSTK' })
    expect(u('NFO:NIFTY26NOV22600CE').expiry).toBe('2026-11-23')
  })

  it('resolves names stored by other brokers', () => {
    upstoxMaster.setRecords(upstox)
    expect(upstoxMaster.resolve('NSE:TCS-EQ', 'NSE', 'EQ')?.ref).toBe('NSE_EQ|INE467B01029')  // Fyers
    expect(upstoxMaster.resolve('NIFTY 50', 'NSE')?.ref).toBe('NSE_INDEX|Nifty 50')            // Kite
    angelMaster.setRecords(angel)
    expect(angelMaster.resolve('CRUDEOIL', 'MCX', 'COMM')?.key).toBe('MCX:CRUDEOIL26NOVFUT')  // nearest future
  })
})

describe('history', () => {
  const t0 = Date.parse('2026-10-23T09:15:00+05:30')
  const ROWS = [['2026-10-23T09:16:00+05:30', 2531, 2533, 2530, 2532, 1200, 0], ['2026-10-23T09:15:00+05:30', 2525, 2531, 2524, 2531, 5000, 0]]

  it('reads candles newest first into bars', () => {
    expect(parseUpstoxCandles(ROWS)[1]).toEqual({ ts: t0, open: 2525, high: 2531, low: 2524, close: 2531, volume: 5000, openInterest: undefined })
    expect(parseAngelCandles(ROWS.map(r => r.slice(0, 6)))).toEqual([
      { ts: t0, open: 2525, high: 2531, low: 2524, close: 2531, volume: 5000 },
      { ts: t0 + 60_000, open: 2531, high: 2533, low: 2530, close: 2532, volume: 1200 },
    ])
  })

  it('maps the real error answers', () => {
    // Replies seen from the live APIs with a fake token
    expect((upstoxError(401, { status: 'error', errors: [{ errorCode: 'UDAPI100050', message: 'Invalid token used to access API' }] }) as any).code).toBe(-16)
    expect((upstoxError(429, { status: 'error', errors: [{ errorCode: 'UDAPI10005', message: 'Too Many Request Sent' }] }) as any).code).toBe(429)
    expect((angelError(200, { success: false, message: 'Invalid Token', errorCode: 'AG8001', data: '' }) as any).code).toBe(-16)
    expect((angelError(403, { message: 'Access denied because of exceeding access rate' }) as any).code).toBe(429)
    expect(angelError(200, { success: false, message: 'Something Went Wrong', errorCode: 'AB1004' })).toMatchObject({ fromApi: true })
  })

  it('asks Upstox for past days and today separately, within the range', async () => {
    upstoxMaster.setRecords(upstox)
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({ status: 'success', data: { candles: url.includes('/intraday/') ? [] : ROWS } }), { status: 200 })
    }))
    const up: any = new UpstoxAdapter()
    up.accessToken = 'tok'
    const bars = await up.getHistoricalBars('NSE:TCS', '1m', new Date(t0), new Date(t0 + 30_000))
    expect(bars.map((b: any) => b.ts)).toEqual([t0])
    expect(urls).toEqual(['https://api.upstox.com/v3/historical-candle/NSE_EQ%7CINE467B01029/minutes/1/2026-10-23/2026-10-23'])
  })

  it('sends Angel IST ranges and the exchange token', async () => {
    angelMaster.setRecords(angel)
    let sent: any
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      sent = { headers: init.headers, body: JSON.parse(init.body) }
      return new Response(JSON.stringify({ status: true, message: 'SUCCESS', errorcode: '', data: [] }), { status: 200 })
    }))
    const an: any = new AngelAdapter()
    an.apiKey = 'key'; an.session.jwt = 'jwt'
    expect(await an.getHistoricalBars('NSE:TCS', '1m', new Date(t0), new Date(t0 + 3600_000))).toEqual([])
    expect(sent.body).toEqual({ exchange: 'NSE', symboltoken: '11536', interval: 'ONE_MINUTE', fromdate: '2026-10-23 09:15', todate: '2026-10-23 10:15' })
    expect(sent.headers).toMatchObject({ Authorization: 'Bearer jwt', 'X-PrivateKey': 'key' })
  })
})

describe('live feeds', () => {
  it('reads Angel quote packets (little-endian, paise)', () => {
    const buf = Buffer.alloc(123)
    buf.writeUInt8(2, 0); buf.writeUInt8(1, 1); buf.write('11536', 2, 'ascii')
    buf.writeBigInt64LE(1n, 27); buf.writeBigInt64LE(1_793_000_000_000n, 35); buf.writeBigInt64LE(253_120n, 43)
    buf.writeBigInt64LE(25n, 51); buf.writeBigInt64LE(1_234_567n, 67)
    expect(parseAngelPacket(buf)).toEqual({ mode: 2, exchangeType: 1, token: '11536', exchangeTimeMs: 1_793_000_000_000, ltp: 2531.2, ltq: 25, volume: 1_234_567 })
    expect(parseAngelPacket(Buffer.alloc(10))).toBeNull()
  })

  // Tiny protobuf writer for the test messages
  const varint = (n: number) => { const out: number[] = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; out.push(b) } while (n); return Buffer.from(out) }
  const field = (no: number, v: number | Buffer, wire: 0 | 1 | 2) => {
    const tag = varint(no * 8 + wire)
    if (wire === 0) return Buffer.concat([tag, varint(v as number)])
    if (wire === 1) { const b = Buffer.alloc(8); b.writeDoubleLE(v as number); return Buffer.concat([tag, b]) }
    return Buffer.concat([tag, varint((v as Buffer).length), v as Buffer])
  }

  it('decodes Upstox full-mode FeedResponse messages', () => {
    const ltpc = Buffer.concat([field(1, 2531.2, 1), field(2, 1_793_000_000_000, 0), field(3, 25, 0), field(4, 2520, 1)])
    const marketFF = Buffer.concat([field(1, ltpc, 2), field(6, 1_234_567, 0), field(7, 0, 1)])
    const feed = field(2, field(1, marketFF, 2), 2) // Feed.fullFeed.marketFF
    const indexFeed = field(2, field(2, field(1, Buffer.concat([field(1, 25110.5, 1)]), 2), 2), 2) // Feed.fullFeed.indexFF
    const entry = (key: string, f: Buffer) => field(2, Buffer.concat([field(1, Buffer.from(key), 2), field(2, f, 2)]), 2)
    const msg = Buffer.concat([field(1, 1, 0), entry('NSE_EQ|INE467B01029', feed), entry('NSE_INDEX|Nifty 50', indexFeed), field(3, 1_793_000_000_500, 0)])

    expect(decodeUpstoxFeed(msg)).toEqual({
      type: 1,
      ticks: [
        { key: 'NSE_EQ|INE467B01029', ltp: 2531.2, ltt: 1_793_000_000_000, ltq: 25, vtt: 1_234_567, oi: 0 },
        { key: 'NSE_INDEX|Nifty 50', ltp: 25110.5 },
      ],
    })
    expect(pbFields(Buffer.from([0x08, 0x96, 0x01]))).toEqual([[1, 150]])
  })
})

describe('logins', () => {
  it('builds the login pages', async () => {
    expect(await brokerLoginUrl('upstox', 'upstox-1', { apiKey: 'KEY', apiSecret: 's' }))
      .toBe('https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=KEY&redirect_uri=http%3A%2F%2F127.0.0.1%3A7890%2Fapi%2Fcallback%2Fupstox&state=upstox-1')
    expect(await brokerLoginUrl('angel_one', 'angel_one-1', { apiKey: 'KEY', apiSecret: 's' }))
      .toBe('https://smartapi.angelone.in/publisher-login/?api_key=KEY&state=angel_one-1')
  })

  it('exchanges the Upstox code (with the same redirect URL) and expires at 03:30 IST', async () => {
    let body = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/authorization/token')) {
        body = String(init.body)
        return new Response(JSON.stringify({ access_token: 'tok', user_id: 'AB1234' }), { status: 200 })
      }
      throw new Error('offline')
    }))
    const up: any = new UpstoxAdapter()
    up.startFeed = () => {}
    const s = await up.connect({ apiKey: 'key', apiSecret: 'secret', requestToken: 'c1' })
    await up.disconnect()
    expect(s).toMatchObject({ accountId: 'AB1234', accessToken: 'tok', expiresAt: nextIstTimeMs(3, 30) })
    expect(body).toBe('code=c1&client_id=key&client_secret=secret&redirect_uri=http%3A%2F%2F127.0.0.1%3A7890%2Fapi%2Fcallback%2Fupstox&grant_type=authorization_code')
  })

  it('keeps all three Angel tokens and the client code, and renews a dead JWT', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push(`${url.split('/').pop()} ${init.headers.Authorization}`)
      if (url.endsWith('/getProfile')) {
        return init.headers.Authorization === 'Bearer old'
          ? new Response(JSON.stringify({ success: false, message: 'Invalid Token', errorCode: 'AG8001', data: '' }), { status: 200 })
          : new Response(JSON.stringify({ status: true, data: { clientcode: 'A123' } }), { status: 200 })
      }
      if (url.endsWith('/generateTokens')) return new Response(JSON.stringify({ status: true, data: { jwtToken: 'new', refreshToken: 'r2', feedToken: 'f2' } }), { status: 200 })
      throw new Error('offline')
    }))
    const fresh: any = new AngelAdapter()
    fresh.startFeed = () => {}
    const s = await fresh.connect({ apiKey: 'key', apiSecret: '', requestToken: 'jwt1', feedToken: 'f1', refreshToken: 'r1' })
    await fresh.disconnect()
    expect(s.accountId).toBe('A123')
    expect(JSON.parse(s.accessToken)).toEqual({ jwt: 'jwt1', feedToken: 'f1', refreshToken: 'r1', clientCode: 'A123' })

    calls.length = 0
    const saved: any = new AngelAdapter()
    saved.startFeed = () => {}
    const s2 = await saved.connect({ apiKey: 'key', apiSecret: '', accessToken: JSON.stringify({ jwt: 'old', feedToken: 'f1', refreshToken: 'r1', clientCode: 'A123' }) })
    await saved.disconnect()
    expect(JSON.parse(s2.accessToken)).toEqual({ jwt: 'new', feedToken: 'f2', refreshToken: 'r2', clientCode: 'A123' })
    expect(calls).toEqual(['getProfile Bearer old', 'generateTokens Bearer old'])
  })
})
