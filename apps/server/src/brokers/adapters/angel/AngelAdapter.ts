/**
 * AngelAdapter.ts — Angel One SmartAPI.
 *
 * Keys: smartapi.angelone.in → create an app with the redirect URL
 * http://127.0.0.1:7890/api/callback/angel_one; its API key (the secret isn't used by this
 * login but is kept like the other brokers').
 * Login (publisher login, no PIN / TOTP typed into this app): browser →
 * smartapi.angelone.in/publisher-login/?api_key=…&state=… → redirect with ?auth_token (JWT),
 * feed_token, refresh_token. getProfile names the client code the feed needs; a missing feed
 * token comes from generateTokens. The session ends at the JWT's expiry (end of the day).
 *
 * History: POST /historical/v1/getCandleData, ONE_MINUTE at most 30 days per request,
 * IST "YYYY-MM-DD HH:mm" ranges; 3 requests/second. Live: AngelFeed (quote mode).
 */
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, type MasterRecord, type InstrumentCategory } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { AngelFeed, ANGEL_EXCHANGE_TYPES, type AngelPacket } from './AngelFeed'
import {
  INDEX_UNDERLYINGS, NSE_SHARE_SERIES, indexKey, indexName, isKnownIndexName, futureSymbol, optionSymbol,
  lastExpiryByMonth, isMonthlyExpiry, parseDayMonYear, formatIstDateTime, jwtExpiryMs, next0600IstMs,
} from '../symbolKey'

const API = 'https://apiconnect.angelone.in'

// getCandleData: 3 requests/second (the per-minute figure isn't published)
const historyLimiter = new RateLimiter(3, 150)

const EXCHANGE_TYPE_NAMES = Object.fromEntries(Object.entries(ANGEL_EXCHANGE_TYPES).map(([k, v]) => [v, k]))

/** Angel's scrip master (public JSON) reduced to NSE/BSE cash, indices, NSE F&O and MCX */
export function parseAngelInstruments(rows: any[]): MasterRecord[] {
  const derivative = (r: any) => (r.exch_seg === 'NFO' || r.exch_seg === 'MCX') && /^(FUT|OPT)/.test(r.instrumenttype || '')
  const monthly = lastExpiryByMonth(rows.filter(r => derivative(r) && String(r.instrumenttype).startsWith('OPT'))
    .map(r => ({ group: `${r.exch_seg}|${String(r.name).toUpperCase()}`, expiry: parseDayMonYear(r.expiry) })))
  const byKey = new Map<string, MasterRecord>()

  for (const r of rows) {
    const exch = String(r.exch_seg || ''), type = String(r.instrumenttype || ''), sym = String(r.symbol || '').trim()
    if (!sym || !r.token) continue
    const ref = `${exch}|${r.token}`
    const base = { name: String(r.name || sym), lot: Number(r.lotsize) || 1, tick: (Number(r.tick_size) || 5) / 100, ref }
    let rec: MasterRecord | null = null

    if ((exch === 'NSE' || exch === 'BSE') && type === 'AMXIDX') {
      const name = indexName([r.name, sym].find(n => n && isKnownIndexName(n)) || sym)
      rec = { ...base, key: indexKey(exch, name), ticker: name, exchange: exch, cat: 'INDEX', lot: 1, tick: 0.05, expiry: '' }
    } else if (exch === 'NSE' && type === '') {
      const series = /-([A-Z0-9]+)$/.exec(sym)?.[1] || ''
      if (!NSE_SHARE_SERIES.has(series)) continue
      const ticker = series === 'EQ' ? sym.slice(0, -3) : sym
      rec = { ...base, key: `NSE:${ticker}`, ticker, exchange: 'NSE', cat: 'EQ', expiry: '' }
    } else if (exch === 'BSE' && type === '') {
      rec = { ...base, key: `BSE:${sym}`, ticker: sym, exchange: 'BSE', cat: 'EQ', expiry: '' }
    } else if (derivative(r)) {
      const mcx = exch === 'MCX'
      const underlying = String(r.name).toUpperCase()
      const expiry = parseDayMonYear(r.expiry)
      if (!expiry) continue
      const isIndex = INDEX_UNDERLYINGS.has(underlying) || type.endsWith('IDX')
      let ticker: string
      let cat: InstrumentCategory
      if (type.startsWith('FUT')) {
        ticker = futureSymbol(underlying, expiry)
        cat = isIndex ? 'FUTIDX' : mcx ? 'FUTCOM' : 'FUTSTK'
      } else {
        const optType = sym.endsWith('CE') ? 'CE' : sym.endsWith('PE') ? 'PE' : null
        if (!optType) continue
        const weekly = !mcx && !isMonthlyExpiry(monthly, `${exch}|${underlying}`, expiry)
        // Strikes are listed in paise
        ticker = optionSymbol(underlying, expiry, Number(r.strike) / 100, optType, weekly)
        cat = isIndex ? 'OPTIDX' : mcx ? 'OPTFUT' : 'OPTSTK'
      }
      rec = { ...base, key: `${exch}:${ticker}`, ticker, exchange: exch, cat, expiry }
    }
    if (rec && !byKey.has(rec.key)) byKey.set(rec.key, rec)
  }
  return [...byKey.values()]
}

async function downloadAngelInstruments(): Promise<MasterRecord[]> {
  const res = await fetch('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json', { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return parseAngelInstruments(await res.json() as any[])
}

/** One instrument list for every Angel One account */
export const angelMaster = new InstrumentMaster('angel', downloadAngelInstruments)

/** Maps an Angel error answer to the codes the backfill queue understands */
export function angelError(status: number, body: any): Error {
  const code = String(body?.errorcode || body?.errorCode || '')
  const message = String(body?.message || body?.errorMessage || `HTTP ${status}`)
  if (status === 429 || /exceed|access rate|rate limit/i.test(message)) {
    return Object.assign(new Error(`429 request limit reached: ${message}`), { code: 429 })
  }
  if (status === 401 || ['AG8001', 'AG8002', 'AG8003', 'AB1010', 'AB8050', 'AB8051'].includes(code) || /invalid token|token expired|session expired/i.test(message)) {
    return Object.assign(new Error(`Auth Error: ${message}`), { code: -16 })
  }
  return Object.assign(new Error(`Angel API Error: ${code ? code + ' ' : ''}${message}`), { code: code || status || -1, fromApi: true })
}

/** Angel candle rows ["2026-10-26T09:15:00+05:30", o, h, l, c, volume] → bars */
export function parseAngelCandles(rows: any[]): Bar[] {
  const bars: Bar[] = []
  for (const c of rows || []) {
    const ts = Date.parse(c?.[0])
    if (!Number.isFinite(ts)) continue
    bars.push({ ts, open: c[1], high: c[2], low: c[3], close: c[4], volume: Math.round(c[5] || 0) })
  }
  return bars.sort((a, b) => a.ts - b.ts)
}

/** What is saved as the "access token": Angel's three tokens and the client code */
interface AngelSession { jwt: string; feedToken: string; refreshToken: string; clientCode: string }

export class AngelAdapter extends ListedBrokerAdapter {
  /** ONE_MINUTE candles: at most 30 days per request */
  readonly maxIntradayHistoryDays = 28
  /** History requests per minute allowed right now (the download queue picks the fastest broker) */
  historyRequestsPerMinute() { return historyLimiter.perMinuteBudget }
  protected readonly label = 'Angel'
  protected readonly master = angelMaster
  private apiKey = ''
  private session: AngelSession = { jwt: '', feedToken: '', refreshToken: '', clientCode: '' }
  private feed: AngelFeed | null = null

  static loginUrl(apiKey: string, brokerId: string): string {
    return `https://smartapi.angelone.in/publisher-login/?api_key=${encodeURIComponent(apiKey)}&state=${encodeURIComponent(brokerId)}`
  }

  private headers(jwt = this.session.jwt) {
    return {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': this.apiKey,
    }
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const data: any = await res.json().catch(() => null)
    // Successes say status: true, refusals success: false (HTTP 200 either way)
    if (res.ok && (data?.status === true || data?.success === true)) return data.data
    throw angelError(res.status, data)
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    this.apiKey = (credentials.apiKey || '').trim()
    if (!this.apiKey) throw new Error('Angel One API key is missing. Remove the broker and add it again.')
    const fresh = !credentials.accessToken
    if (fresh) {
      const jwt = String(credentials.requestToken || '').replace(/^Bearer\s+/i, '')
      if (!jwt) throw new Error('Angel One login missing the auth_token from the login page')
      this.session = { jwt, feedToken: credentials.feedToken || '', refreshToken: credentials.refreshToken || '', clientCode: '' }
    } else {
      this.session = readSession(credentials.accessToken!)
    }

    try {
      this.session.clientCode = (await this.call('GET', '/rest/secure/angelbroking/user/v1/getProfile'))?.clientcode || this.session.clientCode
    } catch (err: any) {
      if (err?.code === -16) {
        // The JWT is dead; the refresh token may still give a new one
        if (!(await this.renew())) {
          throw Object.assign(new Error('Token expired — log in to Angel One again'), { code: 'TOKEN_EXPIRED' })
        }
      } else if (fresh) {
        throw err
      } else {
        // Offline is not "expired": the feed keeps retrying
        console.warn(`[Angel] Could not check the saved token (${err?.message || err}); connecting anyway`)
      }
    }
    if (!this.session.feedToken) await this.renew()
    if (!this.session.clientCode) this.session.clientCode = String(credentials.clientId || '')

    const expiresAt = jwtExpiryMs(this.session.jwt) ?? next0600IstMs()
    this.startFeed()
    this.scheduleExpiry(expiresAt)
    angelMaster.ensureLoaded().catch(err => console.error(`[Angel] ${err?.message || err}`))
    return { accountId: this.session.clientCode || 'ANGEL_USER', accessToken: JSON.stringify(this.session), expiresAt }
  }

  /** New JWT + feed token from the refresh token; false if Angel refuses */
  private async renew(): Promise<boolean> {
    if (!this.session.refreshToken) return false
    try {
      const d = await this.call('POST', '/rest/auth/angelbroking/jwt/v1/generateTokens', { refreshToken: this.session.refreshToken })
      if (!d?.jwtToken) return false
      this.session.jwt = String(d.jwtToken).replace(/^Bearer\s+/i, '')
      this.session.feedToken = d.feedToken || this.session.feedToken
      this.session.refreshToken = d.refreshToken || this.session.refreshToken
      if (!this.session.clientCode) {
        this.session.clientCode = (await this.call('GET', '/rest/secure/angelbroking/user/v1/getProfile').catch(() => null))?.clientcode || ''
      }
      return true
    } catch (err: any) {
      console.warn(`[Angel] Token renewal refused: ${err?.message || err}`)
      return false
    }
  }

  private startFeed() {
    this.feed?.disconnect()
    if (!this.session.feedToken || !this.session.clientCode) {
      console.warn('[Angel] No feed token or client code from Angel: live ticks are off until the next login')
      return
    }
    const feed = new AngelFeed({ jwt: this.session.jwt, apiKey: this.apiKey, clientCode: this.session.clientCode, feedToken: this.session.feedToken })
    this.feed = feed
    feed.on('packet', (p: AngelPacket) => this.onPacket(p))
    feed.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => this.emit('auth_failed'))
    feed.connect()
    const refs = this.subscribedRefs()
    if (refs.length) feed.subscribe(refs)
  }

  private onPacket(p: AngelPacket) {
    const exch = EXCHANGE_TYPE_NAMES[p.exchangeType]
    if (!exch) return
    this.emitTick(`${exch}|${p.token}`, {
      lastPrice: p.ltp,
      lastQty: p.ltq,
      totalVolume: p.volume,
      timestampMs: p.exchangeTimeMs > 0 ? p.exchangeTimeMs : Date.now(),
    })
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

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.session.jwt) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const [exchange, symboltoken] = rec.ref.split('|')
    const daily = interval === '1d' || interval === '1D'
    const minutes = parseInt(interval, 10) || 1
    const names: Record<number, string> = { 1: 'ONE_MINUTE', 3: 'THREE_MINUTE', 5: 'FIVE_MINUTE', 10: 'TEN_MINUTE', 15: 'FIFTEEN_MINUTE', 30: 'THIRTY_MINUTE', 60: 'ONE_HOUR' }

    await historyLimiter.acquire()
    let data: any
    try {
      data = await this.call('POST', '/rest/secure/angelbroking/historical/v1/getCandleData', {
        exchange, symboltoken,
        interval: daily ? 'ONE_DAY' : names[minutes] || 'ONE_MINUTE',
        fromdate: formatIstDateTime(from).slice(0, 16),
        todate: formatIstDateTime(to).slice(0, 16),
      })
    } catch (err: any) {
      if (err?.code === 429) {
        historyLimiter.limited()
        console.warn(`[Angel] Rate limit reached for ${instrumentToken}: pausing, now ${historyLimiter.perMinuteBudget} requests/min`)
      }
      // "No Data Available" for a range without trading is not an error
      if (/no data/i.test(err?.message || '')) return []
      throw err
    }
    return parseAngelCandles(Array.isArray(data) ? data : [])
  }
}

function readSession(saved: string): AngelSession {
  try {
    const s = JSON.parse(saved)
    if (s && typeof s.jwt === 'string') return { jwt: s.jwt, feedToken: s.feedToken || '', refreshToken: s.refreshToken || '', clientCode: s.clientCode || '' }
  } catch { /* an older bare JWT */ }
  return { jwt: saved, feedToken: '', refreshToken: '', clientCode: '' }
}
