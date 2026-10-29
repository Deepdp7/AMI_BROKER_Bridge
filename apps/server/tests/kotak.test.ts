/**
 * Kotak Neo: symbol list, login (code + MPIN), history, live feed packets. The symbol rows and the
 * expiry numbers are real ones from Kotak's public lists (Oct 2026); the login and history answers
 * follow Kotak's own SDK and OpenAlgo's working code. No real account was used. fetch is faked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { totpCode, base32Decode } from '../src/lib/totp'
import { parseKotakInstruments, kotakExpiry, kotakListUrl } from '../src/brokers/adapters/kotak/KotakInstruments'
import { WebSocketServer } from 'ws'
import { splitBatch, decodePacket, kotakFeedUrl, DEFAULT_FEED_URL, KotakFeed } from '../src/brokers/adapters/kotak/KotakFeed'
import {
  createKotakAdapter, kotakMaster, kotakTotp, kotakMobile, kotakInterval, packKotakSecret, unpackKotakSecret, parseKotakCandles,
} from '../src/brokers/adapters/kotak/KotakAdapter'
import { BROKERS, isDirectLogin } from '../src/brokers/brokerAuth'

afterEach(() => vi.unstubAllGlobals())

const HEADER = 'pSymbol,pGroup,pExchSeg,pInstType,pSymbolName,pTrdSymbol,pOptionType,pISIN,lLotSize,dTickSize ,lExpiryDate ,dStrikePrice;'
const csv = (rows: string[]) => [HEADER, ...rows].join('\n')
/** lExpiryDate for a date, the way the F&O lists write it */
const foExpiry = (isoDay: string) => Date.parse(`${isoDay}T09:00:00Z`) / 1000 - 315_513_000

const NSE_CM = csv([
  '2885,EQ,nse_cm,,RELIANCE,RELIANCE-EQ,,INE002A01018,1,10,-1,-1',
  '16819,EQ,nse_cm,,QNIFTY,QNIFTY-EQ,,INF082J01499,1,1,-1,-1',
  '30000,BE,nse_cm,,SOMEBE,SOMEBE-BE,,INE000000001,1,5,-1,-1',
  '99,SG,nse_cm,,SGBX,SGBX-SG,,IN0000000099,1,1,-1,-1',
  '26000,,nse_cm,,NIFTY,NIFTY,,,1,-1,-1,-1',
  '26009,,nse_cm,,BANKNIFTY,BANKNIFTY,,,1,-1,-1,-1',
])
const BSE_CM = csv([
  '500325,A,bse_cm,,RELIANCE,RELIANCE,,INE002A01018,1,5,-1,-1',
  '1,,bse_cm,,SENSEX,SENSEX,,,1,-1,-1,-1',
])
const NSE_FO = csv([
  `61697,XX,nse_fo,FUTSTK,RELIANCE,RELIANCE26NOVFUT,XX,,500,10,${foExpiry('2026-11-23')},-1`,
  `54747,XX,nse_fo,FUTIDX,FINNIFTY,FINNIFTY26NOVFUT,XX,,60,10,${foExpiry('2026-11-23')},-1`,
  `117850,,nse_fo,OPTSTK,NBCC,NBCC26NOV82CE,CE,,6500,5,${foExpiry('2026-11-23')},8200`,
  `7001,,nse_fo,OPTIDX,NIFTY,NIFTY26N1723350CE,CE,,65,5,${foExpiry('2026-11-17')},2335000`,
  `7002,,nse_fo,OPTIDX,NIFTY,NIFTY26NOV23300PE,PE,,65,5,${foExpiry('2026-11-23')},2330000`,
  '7003,XX,nse_fo,FUTSTK,NOEXPIRY,NOEXPIRY,XX,,1,5,-1,-1',
])
const BSE_FO = csv([
  `81001,XX,bse_fo,FUTIDX,SENSEX,SENSEX26NOVFUT,XX,,20,20,${foExpiry('2026-11-26')},-1`,
  `81002,XX,bse_fo,FUTSTK,RELIANCE,RELIANCE26NOVFUT,XX,,250,5,${foExpiry('2026-11-26')},-1`,
])

const records = () => parseKotakInstruments({ nse_cm: NSE_CM, bse_cm: BSE_CM, nse_fo: NSE_FO, bse_fo: BSE_FO })
const byKey = () => Object.fromEntries(records().map(r => [r.key, r]))

describe('authenticator codes', () => {
  it('match the RFC 6238 test vector (secret "12345678901234567890", time 59 s → …287082)', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(totpCode(secret, 59_000)).toBe('287082')
    expect(totpCode(secret, 1111111109_000)).toBe('081804')
    expect(totpCode(secret.toLowerCase().replace(/(.{4})/g, '$1 '), 59_000)).toBe('287082') // spaces and lower case, as apps show it
  })

  it('refuses a key that is not base32', () => {
    expect(base32Decode('not base32!')).toBeNull()
    expect(() => totpCode('abc1', 0)).toThrow(/secret key is not valid/)
  })

  it('uses a typed 6-digit code as it is and anything else as the secret key', () => {
    expect(kotakTotp('123456')).toEqual({ code: '123456', fromSecret: false })
    expect(kotakTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toEqual({ code: '287082', fromSecret: true })
  })
})

describe('Kotak symbol list', () => {
  it('reads the expiry the way the F&O lists write it (real numbers)', () => {
    expect(kotakExpiry('1479911400')).toBe('2026-11-23')  // RELIANCE26NOVFUT
    expect(kotakExpiry('1485354600')).toBe('2027-01-25')  // RELIANCE27JANFUT
    expect(kotakExpiry('-1')).toBe('')
    expect(kotakExpiry('0')).toBe('')
  })

  it('builds the same symbol names as every other broker, with Kotak references', () => {
    const by = byKey()
    expect(by['NSE:RELIANCE']).toMatchObject({ cat: 'EQ', ref: 'nse_cm|2885', tick: 0.1, lot: 1 })
    expect(by['NSE:SOMEBE-BE']).toMatchObject({ cat: 'EQ', ref: 'nse_cm|30000' })
    expect(by['BSE:RELIANCE']).toMatchObject({ cat: 'EQ', ref: 'bse_cm|500325' })
    expect(by['NSE:NIFTY50-INDEX']).toMatchObject({ cat: 'INDEX', ref: 'nse_cm|26000' })
    expect(by['NSE:NIFTYBANK-INDEX']?.ref).toBe('nse_cm|26009')
    expect(by['BSE:SENSEX-INDEX']).toMatchObject({ cat: 'INDEX', ref: 'bse_cm|1' })
    expect(by['NFO:RELIANCE26NOVFUT']).toMatchObject({ cat: 'FUTSTK', ref: 'nse_fo|61697', lot: 500, tick: 0.1, expiry: '2026-11-23' })
    expect(by['NFO:FINNIFTY26NOVFUT']).toMatchObject({ cat: 'FUTIDX', lot: 60, tick: 0.1 })
    expect(by['BFO:SENSEX26NOVFUT']).toMatchObject({ cat: 'FUTIDX', ref: 'bse_fo|81001', lot: 20 })
  })

  it('names options like NSE does: strikes in rupees, weekly expiries with a month code', () => {
    const by = byKey()
    expect(by['NFO:NBCC26NOV82CE']).toMatchObject({ cat: 'OPTSTK', ref: 'nse_fo|117850', lot: 6500 })
    expect(by['NFO:NIFTY26N1723350CE']).toMatchObject({ cat: 'OPTIDX', ref: 'nse_fo|7001' })   // weekly
    expect(by['NFO:NIFTY26NOV23300PE']).toMatchObject({ cat: 'OPTIDX', ref: 'nse_fo|7002' })   // monthly
  })

  it('leaves out bonds, contracts with no expiry and anything outside the four segments', () => {
    const keys = records().map(r => r.key)
    expect(keys.some(k => k.includes('SGBX'))).toBe(false)
    expect(keys.some(k => k.includes('NOEXPIRY'))).toBe(false)
    expect(keys).not.toContain('BFO:RELIANCE26NOVFUT') // BSE stock derivatives
  })

  it('addresses the public lists by segment and day', () => {
    expect(kotakListUrl('nse_cm', '2026-10-28')).toBe('https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-10-28/transformed-v1/nse_cm-v1.csv')
    expect(kotakListUrl('nse_fo', '2026-10-28')).toBe('https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-10-28/transformed/nse_fo.csv')
  })
})

// ---- live feed packets (little-endian, as Kotak's SDK lays them out) ----

function header(len: number, code: number, exchange: number, level: number) {
  const b = Buffer.alloc(len)
  b.writeUInt16LE(len, 0); b.writeUInt16LE(code, 2); b.writeInt8(exchange, 4); b.writeUInt8(level, 5)
  return b
}
const DIVIDERS = new Map([[1, 100], [2, 100]])

describe('Kotak live feed', () => {
  it('reads a market picture: price, quantity, volume and open interest (F&O)', () => {
    const p = header(144, 0, 2, 4)
    p.writeUInt32LE(61697, 9)                       // token
    p.writeBigInt64LE(81234n, 9 + 20)               // volume traded today
    p.writeUInt32LE(131580, 9 + 60)                 // price ×100
    p.writeBigInt64LE(500n, 9 + 64)                 // last quantity
    p.writeUInt32LE(1_234_500, 9 + 94)              // open interest
    expect(decodePacket(p, DIVIDERS)).toEqual({ segment: 'nse_fo', token: '61697', lastPrice: 1315.8, lastQty: 500, totalVolume: 81234, openInterest: 1_234_500 })
  })

  it('reads a mini touchline and an index packet', () => {
    const mini = header(54, 0, 1, 1)
    mini.writeUInt32LE(2885, 9); mini.writeUInt32LE(130540, 9 + 12); mini.writeBigInt64LE(15n, 9 + 16)
    expect(decodePacket(mini, DIVIDERS)).toMatchObject({ segment: 'nse_cm', token: '2885', lastPrice: 1305.4, lastQty: 15 })

    const idx = header(87, 7207, 1, 0)
    idx.writeUInt32LE(26000, 9); idx.writeInt32LE(2_512_345, 9 + 20); idx.write('Nifty 50', 9 + 57, 'utf8')
    expect(decodePacket(idx, DIVIDERS)).toMatchObject({ segment: 'nse_cm', token: '26000', indexName: 'Nifty 50', lastPrice: 25123.45 })
  })

  it('skips market status packets and zero prices', () => {
    expect(decodePacket(header(9, 6511, 1, 0), DIVIDERS)).toBeNull()
    const zero = header(144, 0, 2, 4)
    expect(decodePacket(zero, DIVIDERS)).toBeNull()
  })

  it('splits a frame into packets and stops at a cut-off tail', () => {
    const a = header(54, 0, 1, 1), b = header(54, 0, 1, 1)
    const frame = Buffer.concat([a, b, header(54, 0, 1, 1).subarray(0, 30)])
    expect(splitBatch(frame)).toHaveLength(2)
    expect(splitBatch(Buffer.from([1, 0, 0]))).toHaveLength(0)
  })

  it('finds the feed host of the account\'s data centre, with the default as the fallback', async () => {
    const configs = { E43_broadcast_source: 'sh', E43_sh_broadcast_endpoint: 'https://sfeed.kotaksecurities.com/apifeed', E210_broadcast_source: 'ks', E210_ks_broadcast_endpoint: 'https://cdtstream.kotaksecurities.com/mfeed', E99_broadcast_source: 'hs', E99_hs_broadcast_endpoint: 'mlhsm.kotaksecurities.com' }
    const fake = (async () => new Response(JSON.stringify({ data: { configs } }), { status: 200 })) as unknown as typeof fetch
    expect(await kotakFeedUrl('E43', fake)).toBe('wss://sfeed.kotaksecurities.com/apifeed')
    expect(await kotakFeedUrl('E210', fake)).toBe('wss://cdtstream.kotaksecurities.com/mfeed')
    expect(await kotakFeedUrl('E99', fake)).toBe(DEFAULT_FEED_URL)   // the retired format
    expect(await kotakFeedUrl('E1', fake)).toBe(DEFAULT_FEED_URL)
    expect(await kotakFeedUrl(undefined, fake)).toBe(DEFAULT_FEED_URL)
    expect(await kotakFeedUrl('E43', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBe(DEFAULT_FEED_URL)
  })
})

describe('Kotak live socket', () => {
  /** A stand-in for Kotak's server: answers the login the way the real one does (checked Oct 2026) */
  async function server(verdict: 'accepted' | 'refused') {
    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
    await new Promise(r => wss.on('listening', r))
    const received: any[] = []
    const hello = JSON.stringify({ message_code: 1119, id: 'SFD_CBETA_31', version: 1, exchanges: { nse_cm: { value: 1, divider: 100 }, nse_fo: { value: 2, divider: 100 } } })
    wss.on('connection', ws => {
      ws.on('message', raw => {
        const msg = JSON.parse(String(raw))
        received.push(msg)
        if (msg.format === 'native_batch') {
          ws.send(hello)
          ws.send(hello.replace('1119', '1117'))
          if (verdict === 'refused') ws.send(JSON.stringify({ message_code: 1120, message: 'Auth failed Matrix Auth failed ZZZZZ fakesid NEOTRADEAPI 100000 "ok" false null' }))
        } else if (msg.event === 'subscribeScrips') {
          const p = header(144, 0, 2, 4)
          p.writeUInt32LE(61697, 9); p.writeUInt32LE(131580, 9 + 60); p.writeBigInt64LE(81234n, 9 + 20)
          ws.send(p)
        }
      })
    })
    const url = `ws://127.0.0.1:${(wss.address() as any).port}`
    return { wss, url, received }
  }

  it('logs in with the client code and session id, subscribes what was asked for, and reads the prices that follow', async () => {
    const s = await server('accepted')
    const feed = new KotakFeed(s.url, 'A1B2C', 'SESSIONID')
    // Asked for before the socket is up: remembered and sent once the login is through
    feed.subscribeScrips(['nse_fo|61697'])
    feed.subscribeIndices(['nse_cm|Nifty 50'])
    const ticks: any[] = []
    feed.on('tick', t => ticks.push(t))
    const connected = new Promise(r => feed.on('connected', r))
    feed.connect()
    await connected
    await vi.waitFor(() => expect(ticks).toHaveLength(1))
    expect(s.received[0]).toMatchObject({ user: 'A1B2C', auth: 'SESSIONID', format: 'native_batch', source: 'NEOTRADEAPI' })
    expect(s.received.slice(1)).toEqual([
      { event: 'subscribeScrips', inputtoken: 'nse_fo|61697', ack_symbol: true },
      { event: 'subscribeIndices', inputtoken: 'nse_cm|Nifty 50', ack_symbol: true },
    ])
    expect(ticks[0]).toMatchObject({ segment: 'nse_fo', token: '61697', lastPrice: 1315.8, totalVolume: 81234 })
    feed.disconnect()
    s.wss.close()
  })

  it('a refused login (the real "Auth failed" answer) ends in auth_failed, never "connected"', async () => {
    const s = await server('refused')
    const feed = new KotakFeed(s.url, 'ZZZZZ', 'fakesid')
    const events: string[] = []
    feed.on('connected', () => events.push('connected'))
    feed.on('auth_failed', () => events.push('auth_failed'))
    feed.connect()
    await vi.waitFor(() => expect(events).toEqual(['auth_failed']))
    await new Promise(r => setTimeout(r, 900)) // past the moment a good login would count as connected
    expect(events).toEqual(['auth_failed'])
    feed.disconnect()
    s.wss.close()
  })
})

// ---- login and history ----

const answer = (body: object, status = 200) => new Response(JSON.stringify(body), { status })

describe('Kotak login', () => {
  it('packs the mobile number, MPIN and authenticator key into the secret and back', () => {
    const packed = packKotakSecret({ mobile: '98765 43210', mpin: '123456', totp: 'ABCD EFGH' })
    expect(unpackKotakSecret(packed)).toEqual({ mobile: '98765 43210', mpin: '123456', totp: 'ABCD EFGH' })
    expect(kotakMobile('98765 43210')).toBe('+919876543210')
    expect(kotakMobile('+91 98765-43210')).toBe('+919876543210')
    expect(kotakMobile('919876543210')).toBe('+919876543210')
  })

  it('logs in with the code, then the MPIN, and keeps the session\'s server address', async () => {
    const calls: { url: string; headers: any; body: any }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) })
      if (url.endsWith('/tradeApiLogin')) return answer({ data: { status: 'success', token: 'VIEWTOK', sid: 'VIEWSID' } })
      return answer({ data: { status: 'success', token: 'EDITTOK', sid: 'EDITSID', baseUrl: 'https://cis.kotaksecurities.com/', dataCenter: 'E43' } })
    }))
    kotakMaster().setRecords(records())
    const a: any = createKotakAdapter()
    a.startFeed = async () => {}
    const session = await a.connect({ apiKey: 'ACCESSTOKEN', apiSecret: packKotakSecret({ mobile: '9876543210', mpin: '112233', totp: '654321' }), clientId: 'a1b2c' })
    expect(session).toMatchObject({ accountId: 'A1B2C', accessToken: 'EDITSID' })
    expect(calls[0].url).toBe('https://mis.kotaksecurities.com/login/1.0/tradeApiLogin')
    expect(calls[0].headers).toMatchObject({ Authorization: 'ACCESSTOKEN', 'neo-fin-key': 'neotradeapi' })
    expect(calls[0].body).toEqual({ mobileNumber: '+919876543210', ucc: 'A1B2C', totp: '654321' })
    expect(calls[1].url).toBe('https://mis.kotaksecurities.com/login/1.0/tradeApiValidate')
    expect(calls[1].headers).toMatchObject({ Authorization: 'ACCESSTOKEN', sid: 'VIEWSID', Auth: 'VIEWTOK' })
    expect(calls[1].body).toEqual({ mpin: '112233' })
    expect(a.baseUrl).toBe('https://cis.kotaksecurities.com')
    expect(a.dataCenter).toBe('E43')
    await a.disconnect()
  })

  it('says which step failed and what to check', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ errMsg: 'Invalid TOTP' }, 400)))
    const a: any = createKotakAdapter()
    const creds = { apiKey: 'ACCESSTOKEN', apiSecret: packKotakSecret({ mobile: '9876543210', mpin: '112233', totp: '654321' }), clientId: 'A1B2C' }
    await expect(a.connect(creds)).rejects.toThrow(/code step\): Invalid TOTP.*authenticator code/)

    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/tradeApiLogin') ? answer({ data: { status: 'success', token: 't', sid: 's' } }) : answer({ errMsg: 'Invalid MPIN' }, 400)))
    await expect(createKotakAdapter().connect(creds)).rejects.toThrow(/MPIN step\): Invalid MPIN/)

    // A wrong access token: Kotak's real answer (checked with a made-up token)
    vi.stubGlobal('fetch', vi.fn(async () => answer({ error: [{ code: '424', message: 'Consumer key fakefakefake does not exist' }] }, 424)))
    await expect(createKotakAdapter().connect(creds)).rejects.toThrow(/code step\): the access token was not accepted/)
    await expect(createKotakAdapter().connect({ ...creds, apiSecret: '9876543210|1122' })).rejects.toThrow(/needs the access token/)
  })
})

describe('Kotak history', () => {
  const candle = (iso: string, o: number, h: number, l: number, c: number, v: number, oi?: number) => [iso, o, h, l, c, v, ...(oi === undefined ? [] : [oi])]

  it('repairs what Kotak gets wrong: an open outside the high / low, a negative volume', () => {
    const bars = parseKotakCandles([
      candle('2026-10-27T09:15:00+0530', 1304.1, 1310, 1306.3, 1308, 5000),
      candle('2026-10-27T09:16:00+05:30', 1308, 1309, 1307, 1308.5, -2800171),
      candle('2026-10-27T09:17:00+05:30', 0, 1, 1, 1, 1),
      candle('2026-10-27T09:18:00+05:30', 100, 101, 99, 100.5, 10, 1234567),
    ])
    expect(bars).toHaveLength(3)
    expect(bars[0]).toMatchObject({ ts: Date.parse('2026-10-27T09:15:00+05:30'), open: 1304.1, low: 1304.1, high: 1310 })
    expect(bars[1].volume).toBe(0)
    expect(bars[2]).toMatchObject({ openInterest: 1234567 })
    expect(bars[0].openInterest).toBeUndefined()
  })

  it('maps minutes to Kotak\'s interval names', () => {
    expect(kotakInterval('1')).toBe('1min')
    expect(kotakInterval('5')).toBe('5min')
    expect(kotakInterval('60')).toBe('60min')
    expect(kotakInterval('7')).toBe('5min')
  })

  async function loggedIn(history: (url: string, init: any) => Response) {
    kotakMaster().setRecords(records())
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.includes('/tradeApiLogin')) return answer({ data: { status: 'success', token: 'V', sid: 'VS' } })
      if (url.includes('/tradeApiValidate')) return answer({ data: { status: 'success', token: 'E', sid: 'ES', baseUrl: 'https://cis.kotaksecurities.com', dataCenter: 'E43' } })
      return history(url, init)
    }))
    const a: any = createKotakAdapter()
    a.startFeed = async () => {}
    await a.connect({ apiKey: 'ACCESSTOKEN', apiSecret: packKotakSecret({ mobile: '9876543210', mpin: '112233', totp: '654321' }), clientId: 'A1B2C' })
    return a
  }

  it('asks for a symbol\'s candles by segment and token, and keeps only those inside the range', async () => {
    const urls: string[] = []
    const a = await loggedIn((url, init) => {
      urls.push(`${url} ${init.headers.Authorization}`)
      return answer({ status: 'success', data: { candles: [
        candle('2026-10-27T09:14:00+05:30', 100, 101, 99, 100, 5),   // before the range
        candle('2026-10-27T09:15:00+05:30', 101, 102, 100, 101.5, 7, 4500),
        candle('2026-10-27T09:16:00+05:30', 101.5, 103, 101, 102, 9, 4600),
      ] } })
    })
    const bars = await a.getHistoricalBars('NFO:RELIANCE26NOVFUT', '1', new Date('2026-10-27T03:45:00Z'), new Date('2026-10-27T10:00:00Z'))
    expect(urls).toEqual(['https://cis.kotaksecurities.com/market-data/1.0/historical/details?neosymbol=nse_fo|61697&fromdate=2026-10-27&todate=2026-10-27&interval=1min ACCESSTOKEN'])
    expect(bars.map(b => b.ts)).toEqual([Date.parse('2026-10-27T09:15:00+05:30'), Date.parse('2026-10-27T09:16:00+05:30')])
    expect(bars[0]).toMatchObject({ open: 101, close: 101.5, volume: 7, openInterest: 4500 })
    await a.disconnect()
  }, 20_000)

  it('treats Kotak\'s "No data found" (a weekend, a holiday) as an empty range, not an error', async () => {
    const a = await loggedIn(() => answer({ fault: { message: 'No data found' } }, 400))
    expect(await a.getHistoricalBars('NSE:RELIANCE', '1', new Date('2026-10-25T03:45:00Z'), new Date('2026-10-25T10:00:00Z'))).toEqual([])
    await a.disconnect()
  }, 20_000)

  it('splits a longer range into requests Kotak accepts (30 days of 1-minute data at most)', async () => {
    const days: string[] = []
    const a = await loggedIn(url => {
      const q = new URL(url).searchParams
      days.push(`${q.get('fromdate')}..${q.get('todate')}`)
      return answer({ fault: { message: 'No data found' } }, 400)
    })
    await a.getHistoricalBars('NSE:RELIANCE', '1', new Date('2026-09-01T00:00:00Z'), new Date('2026-10-20T00:00:00Z'))
    expect(days).toEqual(['2026-09-01..2026-09-30', '2026-10-01..2026-10-20'])
    await a.disconnect()
  }, 20_000)

  it('names an unknown symbol as an expired contract', async () => {
    const a = await loggedIn(() => answer({}))
    await expect(a.getHistoricalBars('NFO:RELIANCE20JANFUT', '1', new Date(), new Date())).rejects.toThrow(/not in the Kotak instrument list/)
    await a.disconnect()
  }, 20_000)
})

describe('Kotak live subscriptions', () => {
  it('subscribes shares by token and indices by Kotak\'s name, and hands ticks back under the stored name', async () => {
    kotakMaster().setRecords(records())
    const scrips: string[][] = [], indices: string[][] = []
    const a: any = createKotakAdapter()
    a.feed = { subscribeScrips: (r: string[]) => scrips.push(r), subscribeIndices: (r: string[]) => indices.push(r), unsubscribeScrips: () => {}, unsubscribeIndices: () => {}, disconnect() {} }
    const ticks: any[] = []
    a.on('tick', (t: any) => ticks.push(t))
    await a.subscribe(['NFO:RELIANCE26NOVFUT', 'NSE:NIFTY50-INDEX', 'NSE:RELIANCE'])
    expect(scrips).toEqual([['nse_fo|61697', 'nse_cm|2885']])
    expect(indices).toEqual([['nse_cm|Nifty 50']])

    a.onTick({ segment: 'nse_fo', token: '61697', lastPrice: 1315.8, lastQty: 500, totalVolume: 81234, openInterest: 1234500 })
    a.onTick({ segment: 'nse_cm', token: '4247863880', indexName: 'Nifty 50', lastPrice: 25123.45 })
    a.onTick({ segment: 'nse_cm', token: '777', lastPrice: 5 }) // not subscribed
    expect(ticks).toHaveLength(2)
    expect(ticks[0]).toMatchObject({ instrumentId: 'NFO:RELIANCE26NOVFUT', lastPrice: 1315.8, totalVolume: 81234, openInterest: 1234500 })
    expect(ticks[1]).toMatchObject({ instrumentId: 'NSE:NIFTY50-INDEX', lastPrice: 25123.45 })
  })
})

describe('Kotak in the app', () => {
  it('logs in without a browser page and asks for the client code', () => {
    expect(isDirectLogin('kotak_neo')).toBe(true)
    expect(BROKERS.kotak_neo.loginUrl).toBeUndefined()
    expect(BROKERS.kotak_neo.userId?.upperCase).toBe(true)
  })
})
