/**
 * NorenAdapter.ts
 *
 * Shared part of the brokers on the Noren platform (Flattrade, Shoonya, Zebu, TradeSmart): the request format,
 * error answers, 1-minute history and the live feed. Each broker adds its login and its
 * symbol list download.
 *
 * Requests are POSTs with the body `jData=<JSON>` (not URL-encoded, the server splits on
 * "&", so a "&" inside the JSON must be escaped) and the access token as `&jKey=<token>`
 * (chart endpoints, and all of Flattrade) or an Authorization: Bearer header (Shoonya's other
 * endpoints). Failures are {stat:"Not_Ok", emsg:"…"}; only the text tells a dead session
 * ("Session Expired : Invalid Session Key") from a window without trades ("no data").
 *
 * History: TPSeries, 1-minute candles by epoch-second range; long ranges time out (504), so
 * a request covers a few days. Candle times are IST wall clock ("27-10-2026 09:15:00").
 */
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import type { RateLimiter } from '../../../lib/RateLimiter'
import type { MasterRecord } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { NorenFeed, type NorenTouch } from './NorenFeed'
import { next0600IstMs } from '../symbolKey'

const IST_SEC = 19_800

export interface NorenEndpoints {
  /** REST base, e.g. https://piconnect.flattrade.in/PiConnectAPI */
  rest: string
  ws: string
  /** How non-chart requests carry the token */
  tokenIn: 'jKey' | 'bearer'
  /** How chart requests (TPSeries) carry it: jKey in the body (Flattrade, Shoonya), unless the
   *  broker takes the Bearer header there too (Zebu, TradeSmart v2) */
  chartTokenIn?: 'jKey' | 'bearer'
  /** Flattrade wants actid next to uid in every request */
  sendActid: boolean
}

/** `jData=…` body: "&" escaped inside the JSON (M&M), token appended as jKey when given */
export function norenBody(data: Record<string, unknown>, jKey?: string): string {
  return `jData=${JSON.stringify(data).replace(/&/g, '\\u0026')}${jKey ? `&jKey=${jKey}` : ''}`
}

const SESSION_RE = /session expired|invalid session|session key|not logged in|invalid input : uid|invalid access ?token/i
const RATE_RE = /rate_?limit|too many|exceeds limit/i
const NO_DATA_RE = /no data/i

/** Maps a Noren error answer to the codes the backfill queue understands */
export function norenError(label: string, status: number, body: any): Error {
  const message = String(body?.emsg || body?.message || `HTTP ${status}`)
  if (status === 429 || RATE_RE.test(message)) {
    return Object.assign(new Error(`429 request limit reached: ${message}`), { code: 429 })
  }
  if (status === 401 || SESSION_RE.test(message)) {
    return Object.assign(new Error(`Auth Error: ${message}`), { code: -16 })
  }
  const hint = /\bip\b|whitelist/i.test(message) ? ` — register this PC's internet (static) IP address in your ${label} API settings` : ''
  return Object.assign(new Error(`${label} API Error: ${message}${hint}`), { code: status && status !== 200 ? status : -1, fromApi: true })
}

export function isNoDataError(body: any): boolean {
  return NO_DATA_RE.test(String(body?.emsg || ''))
}

/** "27-10-2026 09:15:00" (IST) → unix ms, NaN if unreadable */
export function parseNorenTime(s: string): number {
  const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim())
  if (!m) return NaN
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]) - IST_SEC * 1000
}

/** TPSeries rows → bars, oldest first. Drops the pre-open 09:14 bar NSE/BSE answers carry. */
export function parseNorenCandles(rows: any[], exchange: string): Bar[] {
  const bars: Bar[] = []
  const cash = exchange === 'NSE' || exchange === 'BSE' || exchange === 'NFO' || exchange === 'BFO'
  for (const c of rows) {
    if (!c || typeof c !== 'object') continue
    let ts = parseNorenTime(c.time)
    if (!Number.isFinite(ts) && Number(c.ssboe) > 0) ts = Number(c.ssboe) * 1000
    if (!Number.isFinite(ts)) continue
    const open = Number(c.into), high = Number(c.inth), low = Number(c.intl), close = Number(c.intc)
    if (!(open > 0 && high > 0 && low > 0 && close > 0)) continue
    if (cash) {
      const istMinute = Math.floor(((ts / 1000 + IST_SEC) % 86_400) / 60)
      if (istMinute < 9 * 60 + 15) continue
    }
    // The running day volume restarts during NSE's closing session, which makes the
    // per-bar volume negative for a few minutes: a bar can't trade less than nothing
    bars.push({ ts, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: Math.max(0, Math.round(Number(c.intv) || 0)) })
  }
  return bars.sort((a, b) => a.ts - b.ts)
}

/** Feed time `ft` (unix seconds) → ms. A value hours ahead of now is IST clock time. */
export function norenFeedTimeMs(ft: string | undefined, nowMs = Date.now()): number {
  const sec = Number(ft)
  if (!(sec > 0)) return nowMs
  const ms = sec * 1000
  return ms - nowMs > 60 * 60_000 ? ms - IST_SEC * 1000 : ms
}

export abstract class NorenAdapter extends ListedBrokerAdapter {
  /** TPSeries times out on long 1-minute ranges: about five trading days per request */
  readonly maxIntradayHistoryDays = 5
  /** History requests per minute allowed right now (the download queue picks the fastest broker) */
  historyRequestsPerMinute() { return this.historyLimiter.perMinuteBudget }
  protected abstract readonly endpoints: NorenEndpoints
  protected abstract readonly historyLimiter: RateLimiter
  protected uid = ''
  protected accessToken = ''
  private feed: NorenFeed | null = null
  /** Last known price / day volume per feed key: "tf" updates carry only what changed */
  private touch = new Map<string, { lp?: number; v?: number; oi?: number }>()

  /** Exchanges the login code for a token; returns the token and the user id */
  protected abstract login(credentials: BrokerCredentials): Promise<{ accessToken: string; uid: string }>

  /** POST to `endpoint`; returns the parsed answer (object or array) */
  protected async post(endpoint: string, data: Record<string, unknown>, chart = false): Promise<any> {
    const viaJKey = chart ? (this.endpoints.chartTokenIn ?? 'jKey') === 'jKey' : this.endpoints.tokenIn === 'jKey'
    const payload = { uid: this.uid, ...(this.endpoints.sendActid ? { actid: this.uid } : {}), ...data }
    const res = await fetch(`${this.endpoints.rest}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': viaJKey ? 'application/x-www-form-urlencoded' : 'text/plain',
        ...(viaJKey ? {} : { Authorization: `Bearer ${this.accessToken}` }),
      },
      body: norenBody(payload, viaJKey ? this.accessToken : undefined),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    let body: any = null
    try { body = JSON.parse(text) } catch { /* HTML error page */ }
    if (!res.ok && !body) throw norenError(this.label, res.status, { emsg: `HTTP ${res.status}` })
    return { status: res.status, body }
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken
      this.uid = String(credentials.clientId || '').trim()
      if (!this.uid) throw new Error(`${this.label} user ID is missing. Remove the broker and add it again.`)
      await this.checkSession()
    } else {
      if (!credentials.requestToken) throw new Error(`${this.label} login missing the code from the login page`)
      const session = await this.login(credentials)
      this.accessToken = session.accessToken
      this.uid = session.uid
      if (!this.uid) throw new Error(`${this.label} did not say which user logged in. Remove the broker and add it again with your user ID.`)
    }

    this.startFeed()
    this.scheduleExpiry(next0600IstMs())
    this.master.ensureLoaded().catch(err => console.error(`[${this.label}] ${err?.message || err}`))
    return { accountId: this.uid, accessToken: this.accessToken, expiresAt: next0600IstMs() }
  }

  /** The saved token still works? Offline is not "expired": the feed keeps retrying. */
  private async checkSession() {
    try {
      const { status, body } = await this.post('UserDetails', {})
      if (body?.stat === 'Ok') return
      const err: any = norenError(this.label, status, body)
      if (err.code === -16) throw Object.assign(new Error(`Token expired — log in to ${this.label} again`), { code: 'TOKEN_EXPIRED' })
      console.warn(`[${this.label}] Could not check the saved token (${err.message}); connecting anyway`)
    } catch (err: any) {
      if (err?.code === 'TOKEN_EXPIRED') throw err
      console.warn(`[${this.label}] Could not check the saved token (${err?.message || err}); connecting anyway`)
    }
  }

  private startFeed() {
    this.feed?.disconnect()
    this.touch.clear()
    const feed = new NorenFeed(this.endpoints.ws, this.uid, this.accessToken, this.label)
    this.feed = feed
    feed.on('touch', (m: NorenTouch) => this.onTouch(m))
    feed.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => this.emit('auth_failed'))
    feed.connect()
    const refs = this.subscribedRefs()
    if (refs.length) feed.subscribe(refs)
  }

  private onTouch(m: NorenTouch) {
    const ref = `${m.e}|${m.tk}`
    const state = this.touch.get(ref) || {}
    const lp = Number(m.lp), v = Number(m.v), oi = Number(m.oi)
    if (m.lp !== undefined && lp > 0) state.lp = lp
    if (m.v !== undefined && Number.isFinite(v)) state.v = v
    if (m.oi !== undefined && Number.isFinite(oi)) state.oi = oi
    this.touch.set(ref, state)
    // An update with neither a trade price nor volume (depth, OI only) is not a trade
    if (m.lp === undefined && m.v === undefined) return
    if (!state.lp) return
    this.emitTick(ref, {
      lastPrice: state.lp,
      lastQty: Number(m.ltq) || undefined,
      totalVolume: state.v,
      timestampMs: norenFeedTimeMs(m.ft),
      openInterest: state.oi,
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
    for (const ref of refs) this.touch.delete(ref)
    this.feed?.unsubscribe(refs)
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.accessToken) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const [exch, token] = rec.ref.split('|')
    const minutes = parseInt(interval, 10) || 1

    await this.historyLimiter.acquire()
    let answer: { status: number; body: any }
    try {
      answer = await this.post('TPSeries', {
        exch, token,
        st: String(Math.floor(from.getTime() / 1000)),
        et: String(Math.floor(to.getTime() / 1000)),
        intrv: String(minutes),
      }, true)
    } catch (err: any) {
      if (err?.code === 429) this.historyLimiter.limited()
      throw err
    }
    const { status, body } = answer
    if (Array.isArray(body)) return parseNorenCandles(body, rec.exchange)
    if (isNoDataError(body)) return []
    const err: any = norenError(this.label, status, body)
    if (err.code === 429) {
      this.historyLimiter.limited()
      console.warn(`[${this.label}] Rate limit reached for ${instrumentToken}: pausing, now ${this.historyLimiter.perMinuteBudget} requests/min`)
    }
    throw err
  }
}
