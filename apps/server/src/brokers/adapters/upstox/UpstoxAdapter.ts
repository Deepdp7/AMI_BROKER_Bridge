/**
 * UpstoxAdapter.ts — Upstox API v2 / v3.
 *
 * Keys: account.upstox.com/developer/apps → new app with the redirect URL
 * http://127.0.0.1:7890/api/callback/upstox; its API Key and API Secret.
 * Login: browser → api.upstox.com/v2/login/authorization/dialog?client_id=…&redirect_uri=…
 * &state=… → redirect with ?code=…&state=… → POST /v2/login/authorization/token
 * (form: code, client_id, client_secret, redirect_uri, grant_type) → access_token, valid
 * until 03:30 IST the next day.
 *
 * History (v3): GET /historical-candle/{key}/minutes/1/{to}/{from} for whole past days
 * (1-minute data from January 2022, a month per request) plus
 * /historical-candle/intraday/{key}/minutes/1 for today. Standard API limits: 50/second,
 * 500/minute, 2000 per 30 minutes. Live: UpstoxFeed (protobuf, full mode).
 */
import zlib from 'zlib'
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, type MasterRecord, type InstrumentCategory } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { UpstoxFeed, type UpstoxTick } from './UpstoxFeed'
import {
  INDEX_UNDERLYINGS, NSE_SHARE_SERIES, BSE_SHARE_GROUPS, indexKey, indexName, isKnownIndexName, futureSymbol, optionSymbol,
  lastExpiryByMonth, isMonthlyExpiry, istDate, nextIstTimeMs,
} from '../symbolKey'

const API = 'https://api.upstox.com'
/** Must equal the app's registered redirect URL (brokerAuth.callbackUrl('upstox')): the token request repeats it */
const REDIRECT_URI = 'http://127.0.0.1:7890/api/callback/upstox'
const DAY_MS = 24 * 3600 * 1000

// 2000 requests per 30 minutes is the binding limit: ~66 a minute on average
const historyLimiter = new RateLimiter(5, 60)

/** Upstox's instrument list (public JSON) reduced to NSE/BSE cash, indices, NSE F&O and MCX */
export function parseUpstoxInstruments(rows: any[]): MasterRecord[] {
  const derivative = (r: any) => (r.segment === 'NSE_FO' || r.segment === 'MCX_FO') && r.expiry
  const underlyingOf = (r: any) => String(r.underlying_symbol || r.asset_symbol || r.name || '').toUpperCase()
  const monthly = lastExpiryByMonth(rows.filter(r => derivative(r) && (r.instrument_type === 'CE' || r.instrument_type === 'PE'))
    .map(r => ({ group: `${r.segment}|${underlyingOf(r)}`, expiry: istDate(Number(r.expiry)) })))
  const byKey = new Map<string, MasterRecord>()

  for (const r of rows) {
    const seg = r.segment, type = String(r.instrument_type || ''), sym = String(r.trading_symbol || '').trim()
    const ref = String(r.instrument_key || '')
    if (!ref || !sym) continue
    const base = { name: String(r.name || sym), lot: Number(r.lot_size) || 1, tick: (Number(r.tick_size) || 5) / 100, ref }
    let rec: MasterRecord | null = null

    if (seg === 'NSE_EQ' && NSE_SHARE_SERIES.has(type)) {
      const ticker = type === 'EQ' || sym.endsWith(`-${type}`) ? sym : `${sym}-${type}`
      rec = { ...base, key: `NSE:${ticker}`, ticker, exchange: 'NSE', cat: 'EQ', expiry: '' }
    } else if (seg === 'BSE_EQ' && BSE_SHARE_GROUPS.has(type)) {
      rec = { ...base, key: `BSE:${sym}`, ticker: sym, exchange: 'BSE', cat: 'EQ', expiry: '' }
    } else if (seg === 'NSE_INDEX' || seg === 'BSE_INDEX') {
      const exchange = seg === 'NSE_INDEX' ? 'NSE' : 'BSE'
      const name = indexName([r.name, sym].find(n => n && isKnownIndexName(n)) || String(r.name || sym))
      rec = { ...base, key: indexKey(exchange, name), ticker: name, exchange, cat: 'INDEX', lot: 1, tick: 0.05, expiry: '' }
    } else if (derivative(r)) {
      const mcx = seg === 'MCX_FO'
      const exchange = mcx ? 'MCX' : 'NFO'
      const underlying = underlyingOf(r)
      const expiry = istDate(Number(r.expiry))
      const isIndex = INDEX_UNDERLYINGS.has(underlying) || r.underlying_type === 'INDEX'
      let ticker: string
      let cat: InstrumentCategory
      if (type === 'FUT') {
        ticker = futureSymbol(underlying, expiry)
        cat = isIndex ? 'FUTIDX' : mcx ? 'FUTCOM' : 'FUTSTK'
      } else if (type === 'CE' || type === 'PE') {
        const weekly = !mcx && !isMonthlyExpiry(monthly, `${seg}|${underlying}`, expiry)
        ticker = optionSymbol(underlying, expiry, Number(r.strike_price), type, weekly)
        cat = isIndex ? 'OPTIDX' : mcx ? 'OPTFUT' : 'OPTSTK'
      } else continue
      rec = { ...base, key: `${exchange}:${ticker}`, ticker, exchange, cat, expiry }
    }
    if (rec && !byKey.has(rec.key)) byKey.set(rec.key, rec)
  }
  return [...byKey.values()]
}

async function downloadUpstoxInstruments(): Promise<MasterRecord[]> {
  const res = await fetch('https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz', { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return parseUpstoxInstruments(JSON.parse(zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')))
}

/** One instrument list for every Upstox account */
export const upstoxMaster = new InstrumentMaster('upstox', downloadUpstoxInstruments)

/** Maps an Upstox error answer to the codes the backfill queue understands */
export function upstoxError(status: number, body: any): Error {
  const e = body?.errors?.[0] || {}
  const code = String(e.errorCode || e.error_code || '')
  const message = String(e.message || body?.message || `HTTP ${status}`)
  if (status === 429 || /too many/i.test(message)) {
    return Object.assign(new Error(`429 request limit reached: ${message}`), { code: 429 })
  }
  if (status === 401 || code === 'UDAPI100050' || /invalid token/i.test(message)) {
    return Object.assign(new Error(`Auth Error: ${message}`), { code: -16 })
  }
  return Object.assign(new Error(`Upstox API Error: ${code ? code + ' ' : ''}${message}`), { code: status || -1, fromApi: true })
}

/** Upstox candle rows ["2026-10-26T09:15:00+05:30", o, h, l, c, volume, oi] → bars */
export function parseUpstoxCandles(rows: any[]): Bar[] {
  const bars: Bar[] = []
  for (const c of rows || []) {
    const ts = Date.parse(c?.[0])
    if (!Number.isFinite(ts)) continue
    bars.push({ ts, open: c[1], high: c[2], low: c[3], close: c[4], volume: Math.round(c[5] || 0), openInterest: c[6] || undefined })
  }
  return bars
}

export class UpstoxAdapter extends ListedBrokerAdapter {
  /** 1-minute history: at most a month per request */
  readonly maxIntradayHistoryDays = 28
  /** History requests per minute allowed right now (the download queue picks the fastest broker) */
  historyRequestsPerMinute() { return historyLimiter.perMinuteBudget }
  protected readonly label = 'Upstox'
  protected readonly master = upstoxMaster
  private accessToken = ''
  private feed: UpstoxFeed | null = null

  static loginUrl(apiKey: string, brokerId: string): string {
    return `${API}/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(brokerId)}`
  }

  private async get(path: string): Promise<any> {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json', 'Api-Version': '2.0' },
      signal: AbortSignal.timeout(30_000),
    })
    const body: any = await res.json().catch(() => null)
    if (res.ok && body?.status === 'success') return body.data
    throw upstoxError(res.status, body)
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    const apiKey = (credentials.apiKey || '').trim()
    const apiSecret = (credentials.apiSecret || '').trim()
    let accountId = credentials.clientId || ''

    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken
      try {
        accountId = (await this.get('/v2/user/profile'))?.user_id || accountId
      } catch (err: any) {
        if (err?.code === -16) throw Object.assign(new Error('Token expired — log in to Upstox again'), { code: 'TOKEN_EXPIRED' })
        console.warn(`[Upstox] Could not check the saved token (${err?.message || err}); connecting anyway`)
      }
    } else {
      if (!apiKey || !apiSecret || !credentials.requestToken) {
        throw new Error(`Upstox login missing parameters. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}, code: ${!!credentials.requestToken}`)
      }
      const res = await fetch(`${API}/v2/login/authorization/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'Api-Version': '2.0' },
        body: new URLSearchParams({ code: credentials.requestToken, client_id: apiKey, client_secret: apiSecret, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
        signal: AbortSignal.timeout(30_000),
      })
      const body: any = await res.json().catch(() => null)
      if (!res.ok || !body?.access_token) {
        throw new Error(`Upstox login failed: ${body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`}`)
      }
      this.accessToken = body.access_token
      accountId = body.user_id || accountId
    }

    const expiresAt = nextIstTimeMs(3, 30)
    this.startFeed()
    this.scheduleExpiry(expiresAt)
    upstoxMaster.ensureLoaded().catch(err => console.error(`[Upstox] ${err?.message || err}`))
    return { accountId: accountId || 'UPSTOX_USER', accessToken: this.accessToken, expiresAt }
  }

  private startFeed() {
    this.feed?.disconnect()
    const feed = new UpstoxFeed(this.accessToken)
    this.feed = feed
    feed.on('tick', (t: UpstoxTick) => {
      this.emitTick(t.key, { lastPrice: t.ltp, lastQty: t.ltq, totalVolume: t.vtt, timestampMs: t.ltt || Date.now(), openInterest: t.oi })
    })
    feed.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => this.emit('auth_failed'))
    const refs = this.subscribedRefs()
    if (refs.length) feed.subscribe(refs)
    else feed.connect()
  }

  async disconnect(): Promise<void> {
    this.clearExpiry()
    this.feed?.disconnect()
    this.feed = null
    this.emit('connection_state', 'DISCONNECTED')
  }

  protected feedSubscribe(records: MasterRecord[]) {
    this.feed?.subscribe(records.map(r => r.ref))
  }

  protected feedUnsubscribe(refs: string[]) {
    this.feed?.unsubscribe(refs)
  }

  private async candles(path: string): Promise<Bar[]> {
    await historyLimiter.acquire()
    try {
      return parseUpstoxCandles((await this.get(path))?.candles)
    } catch (err: any) {
      if (err?.code === 429) {
        historyLimiter.limited()
        console.warn(`[Upstox] Rate limit reached: pausing, now ${historyLimiter.perMinuteBudget} requests/min`)
      }
      throw err
    }
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.accessToken) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const key = encodeURIComponent(rec.ref)
    const daily = interval === '1d' || interval === '1D'
    const unit = daily ? 'days/1' : `minutes/${parseInt(interval, 10) || 1}`

    const today = istDate(Date.now())
    const fromDay = istDate(from.getTime())
    const toDay = istDate(to.getTime())
    const bars: Bar[] = []
    // Past days from the history endpoint, today from the intraday one
    const lastPastDay = toDay >= today ? istDate(Date.now() - DAY_MS) : toDay
    if (fromDay <= lastPastDay) bars.push(...await this.candles(`/v3/historical-candle/${key}/${unit}/${lastPastDay}/${fromDay}`))
    if (!daily && toDay >= today) bars.push(...await this.candles(`/v3/historical-candle/intraday/${key}/${unit}`))

    const fromMs = from.getTime(), toMs = to.getTime()
    return bars.filter(b => daily || (b.ts >= fromMs && b.ts <= toMs)).sort((a, b) => a.ts - b.ts)
  }
}
