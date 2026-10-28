/**
 * XTS brokers (Compositedge, 5paisa XTS, Jainam, IndiaBulls, Rmoney): symbol list, history,
 * live touchline, key login. Rows and error answers are real ones from the live servers
 * (Oct 2026, fake keys only). fetch is faked.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { parseXtsInstruments } from '../src/brokers/adapters/xts/XtsInstruments'
import { parseXtsCandles, xtsTimeParam, createXtsAdapter, xtsMaster } from '../src/brokers/adapters/xts/XtsAdapter'
import { parseXtsTouchline, xtsTimeMs } from '../src/brokers/adapters/xts/XtsFeed'
import { BROKERS, isDirectLogin } from '../src/brokers/brokerAuth'

const NSECM = [
  'NSECM|2885|8|RELIANCE|RELIANCE-EQ|EQ|RELIANCE-EQ|1100100002885|1315.8|1076.6|81195|0.1|1|1|RELIANCE|INE002A01018|1|1|RELIANCE INDUSTRIES LTD-EQ|0|-1|-1',
  'NSECM|757287|8|RELIANCE|RELIANCE-T0|T0|RELIANCE-T0|1100100757287|1208.1|1184.3|81195|0.1|1|1|RELIANCE|INE002A01018|1|1|RELIANCE INDUSTRIES LTD-T0|0|-1|-1',
  'NSECM|14778|8|131NSETEST|131NSETEST-EQ|EQ|131NSETEST-EQ|1100100014778|220|180|50000|0.05|1|1|131NSETEST|DUMMYSAN017|1|1|131NSETEST-EQ|0|-1|-1',
].join('\n')
const BSECM = 'BSECM|500325|8|RELIANCE|RELIANCE-A|A|RELIANCE-A|11100100500325|1320|1080|0|0.05|1|1|RELIANCE|INE002A01018|1|1|RELIANCE INDUSTRIES LTD.|100|-1|-1'
const NSEFO = [
  'NSEFO|61471|1|NIFTY|NIFTY26NOVFUT|FUTIDX|NIFTY-FUTIDX|2632700061471|25128.1|20559.5|3511|0.1|65|1|-1|Nifty 50|2026-11-23T14:30:00|NIFTY 23NOV2026|1|1|NIFTY26NOVFUT',
  'NSEFO|15791325|4|NIFTY|NIFTY26NOV27JANFUT|FUTIDX|NIFTY-FUTIDX|2100115791325|456.9|-456.9|3511|0.1|65|1|-1||2026-11-23T14:30:00|NIFTY 23NOV25JAN SPD|1|1|NIFTY26NOV27JANFUT',
  'NSEFO|45281|2|NIFTY|NIFTY26N1723350CE|OPTIDX|NIFTY-OPTIDX|2632100045281|285.7|0.05|3511|0.05|65|1|-1|Nifty 50|2026-11-17T14:30:00|23350|3|NIFTY 17NOV2026 CE 23350|1|1|NIFTY26N1723350CE',
  'NSEFO|64358|2|NIFTY|NIFTY26NOV23300PE|OPTIDX|NIFTY-OPTIDX|2632700064358|1014.15|254.25|3511|0.05|65|1|-1|Nifty 50|2026-11-23T14:30:00|23300|4|NIFTY 23NOV2026 PE 23300|1|1|NIFTY26NOV23300PE',
].join('\n')
const MCXFO = [
  'MCXFO|573422|1|CRUDEOIL|CRUDEOIL19NOV2026FUT|FUTCOM|CRUDEOIL-FUTCOM|51632300573422|9877|9119|100|1|1|100|51100100000294||2026-11-19T23:59:59|CRUDEOIL 19NOV2026|1|1|CRUDEOIL19NOV2026FUT',
  'MCXFO|584460|2|CRUDEOIL|CRUDEOIL17NOV202611900CE|OPTFUT|CRUDEOIL-OPTFUT|51632100584460|113.3|0.1|100|0.1|1|100|51632300573422||2026-11-17T23:59:59|11900|3|CRUDEOIL 17NOV2026 CE 11900|1|1|CRUDEOIL17NOV202611900CE',
  'MCXFO|333|16|SMASURNDR|SMASURNDR-COMDTY|COMDTY|SMASURNDR-COMDTY|51100100000333|NaN|NaN|0|0.05|1|1|SMASURNDR|1|1|SMASURNDRCOM',
].join('\n')
const INDICES = [
  { segment: 'NSECM' as const, names: ['NIFTY 50_26000', 'NIFTY BANK_26001', 'INDIA VIX_26002', 'NIFTY FIN SERVICE_26034', 'NIFTY MID SELECT_26121'] },
  { segment: 'BSECM' as const, names: ['SENSEX_26065', 'BANKEX_26118'] },
]

const records = () => parseXtsInstruments([NSECM, BSECM, NSEFO, MCXFO], INDICES)

afterEach(() => vi.unstubAllGlobals())

describe('XTS symbol list', () => {
  it('builds the same symbol names as every other broker, with XTS references', () => {
    const by = Object.fromEntries(records().map(r => [r.key, r]))
    expect(by['NSE:RELIANCE']).toMatchObject({ cat: 'EQ', ref: 'NSECM|2885', tick: 0.1 })
    expect(by['BSE:RELIANCE']).toMatchObject({ cat: 'EQ', ref: 'BSECM|500325' })
    expect(by['NFO:NIFTY26NOVFUT']).toMatchObject({ cat: 'FUTIDX', ref: 'NSEFO|61471', lot: 65, expiry: '2026-11-23' })
    expect(by['NFO:NIFTY26N1723350CE']).toMatchObject({ cat: 'OPTIDX', ref: 'NSEFO|45281' })  // weekly
    expect(by['NFO:NIFTY26NOV23300PE']).toMatchObject({ cat: 'OPTIDX', ref: 'NSEFO|64358' })  // monthly
    expect(by['MCX:CRUDEOIL26NOVFUT']).toMatchObject({ cat: 'FUTCOM', ref: 'MCXFO|573422' })
    expect(by['MCX:CRUDEOIL26NOV11900CE']).toMatchObject({ cat: 'OPTFUT', ref: 'MCXFO|584460' })
    expect(by['NSE:NIFTY50-INDEX']).toMatchObject({ cat: 'INDEX', ref: 'NSECM|26000' })
    expect(by['NSE:NIFTYBANK-INDEX']?.ref).toBe('NSECM|26001')
    expect(by['NSE:FINNIFTY-INDEX']?.ref).toBe('NSECM|26034')
    expect(by['NSE:MIDCPNIFTY-INDEX']?.ref).toBe('NSECM|26121')
    expect(by['BSE:SENSEX-INDEX']?.ref).toBe('BSECM|26065')
  })

  it('leaves out calendar spreads, MCX spot rows, T0 series and the exchanges\' test symbols', () => {
    const keys = records().map(r => r.key)
    expect(keys.some(k => k.includes('27JAN'))).toBe(false)
    expect(keys.some(k => k.includes('SMASURNDR'))).toBe(false)
    expect(keys.some(k => k.includes('RELIANCE-T0'))).toBe(false)
    expect(keys.some(k => k.includes('NSETEST'))).toBe(false)
  })
})

describe('XTS history', () => {
  it('reads candles whose times are IST clock written as unix seconds', () => {
    // 27 Oct 2026 09:15 IST written as if it were UTC
    const istAsUtc = Date.UTC(2026, 9, 27, 9, 15) / 1000
    const bars = parseXtsCandles(`${istAsUtc + 60}|101|102|100|101.5|300|0,${istAsUtc}|100|101|99|100.5|250|0`)
    expect(bars.map(b => b.ts)).toEqual([Date.parse('2026-10-27T09:15:00+05:30'), Date.parse('2026-10-27T09:16:00+05:30')])
    expect(bars[0]).toMatchObject({ open: 100, high: 101, low: 99, close: 100.5, volume: 250 })
  })

  it('asks for IST clock times in the form XTS takes', () => {
    expect(xtsTimeParam(Date.parse('2026-10-27T09:15:00+05:30'))).toBe('Oct 27 2026 091500')
    expect(xtsTimeParam(Date.parse('2026-01-05T15:30:59+05:30'))).toBe('Jan 05 2026 153059')
  })

  it('requests 1-minute candles for the symbol and renews a refused token with the saved keys', async () => {
    xtsMaster('compositedge').setRecords(records())
    const calls: string[] = []
    let logins = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      calls.push(`${init?.method || 'GET'} ${url} ${init?.headers?.authorization ?? ''}`)
      if (url.endsWith('/auth/login')) {
        logins++
        return new Response(JSON.stringify({ type: 'success', result: { token: `tok${logins}`, userID: 'CE123' } }), { status: 200 })
      }
      if (url.includes('/instruments/ohlc') && init.headers.authorization === 'tok1') {
        return new Response(JSON.stringify({ type: 'error', code: 'e-session-0007', description: 'Invalid Token' }), { status: 400 })
      }
      if (url.includes('/instruments/ohlc')) {
        const ts = Date.UTC(2026, 9, 27, 9, 15) / 1000
        return new Response(JSON.stringify({ type: 'success', result: { dataReponse: `${ts}|1|2|1|2|5|0` } }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    }))
    const a: any = createXtsAdapter('compositedge')
    a.startFeed = () => {}
    expect(await a.connect({ apiKey: 'Key1234abcd', apiSecret: 'Sec#1234' })).toMatchObject({ accountId: 'CE123', accessToken: 'tok1' })
    const bars = await a.getHistoricalBars('NSE:RELIANCE', '1', new Date('2026-10-27T03:00:00Z'), new Date('2026-10-27T10:00:00Z'))
    expect(bars).toHaveLength(1)
    expect(logins).toBe(2) // the refused token was replaced without asking anyone
    const ohlc = calls.filter(c => c.includes('/instruments/ohlc'))
    expect(ohlc[0]).toContain('https://xts.compositedge.com/apimarketdata/instruments/ohlc?exchangeSegment=NSECM&exchangeInstrumentID=2885&startTime=Oct+27+2026+083000&endTime=Oct+27+2026+153000&compressionValue=60')
    expect(ohlc[1]).toContain(' tok2')
    await a.disconnect()
  })

  it('wrong keys say which keys to use (the real "Data Not found" answer)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'error', code: 'e-response-0004', description: 'Data Not found.' }), { status: 400 })))
    const a: any = createXtsAdapter('jainam')
    await expect(a.connect({ apiKey: 'Key1234abcd', apiSecret: 'Sec#1234' })).rejects.toThrow(/Jainam login failed: the Market Data API key or secret was not accepted/)
  })
})

describe('XTS live prices', () => {
  it('reads a 1501 touchline (sent as a JSON string) and the XTS clock', () => {
    const now = Date.parse('2026-10-27T10:00:00+05:30')
    const istSec = (Date.parse('2026-10-27T09:59:58+05:30') + 19_800_000) / 1000 - 315_532_800
    const t = parseXtsTouchline(JSON.stringify({
      MessageCode: 1501, ExchangeSegment: 1, ExchangeInstrumentID: 2885,
      Touchline: { LastTradedPrice: 1305.4, LastTradedQunatity: 15, TotalTradedQuantity: 81234, LastTradedTime: istSec },
    }))
    expect(t).toMatchObject({ segment: 1, instrumentId: 2885, lastPrice: 1305.4, lastQty: 15, totalVolume: 81234 })
    expect(xtsTimeMs(t!.lastTradedTime, now)).toBe(Date.parse('2026-10-27T09:59:58+05:30'))
    expect(xtsTimeMs(undefined, now)).toBe(now)
    expect(parseXtsTouchline('{"Touchline":{"LastTradedPrice":0}}')).toBeNull()
  })

  it('subscribes over REST and shows the snapshot prices it returns at once', async () => {
    xtsMaster('compositedge').setRecords(records())
    const sent: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/instruments/subscription')) {
        sent.push({ method: init.method, body: JSON.parse(init.body) })
        return new Response(JSON.stringify({ type: 'success', result: { listQuotes: [JSON.stringify({ ExchangeSegment: 1, ExchangeInstrumentID: 2885, Touchline: { LastTradedPrice: 1301, TotalTradedQuantity: 10 } })] } }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    }))
    const a: any = createXtsAdapter('compositedge')
    a.token = 'tok'
    const ticks: any[] = []
    a.on('tick', (t: any) => ticks.push(t))
    await a.subscribe(['NSE:RELIANCE'])
    await vi.waitFor(() => expect(ticks).toHaveLength(1))
    expect(sent[0]).toEqual({ method: 'POST', body: { instruments: [{ exchangeSegment: 1, exchangeInstrumentID: 2885 }], xtsMessageCode: 1501 } })
    expect(ticks[0]).toMatchObject({ instrumentId: 'NSE:RELIANCE', lastPrice: 1301 })
  })
})

describe('XTS brokers in the app', () => {
  it('log in with their keys, without a browser page', () => {
    for (const type of ['compositedge', 'fivepaisa_xts', 'jainam', 'ibulls', 'rmoney']) {
      expect(isDirectLogin(type)).toBe(true)
      expect(BROKERS[type].loginUrl).toBeUndefined()
    }
    expect(isDirectLogin('fyers')).toBe(false)
  })
})
