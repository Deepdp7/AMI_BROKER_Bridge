/**
 * XtsAdapter.ts — brokers on Symphony's XTS platform: Compositedge, 5paisa (XTS), Jainam,
 * IndiaBulls (Dhani) and Rmoney. Only XTS's market data API is used.
 *
 * Login needs no browser: POST <md>/auth/login {appKey, secretKey, source:"WebAPI"} with the
 * Market Data API key and secret answers {type:"success", result:{token, userID}}. Wrong keys
 * answer 400 {type:"error", code:"e-response-0004", description:"Data Not found."}. Because the
 * keys are enough, a refused token (e-session-0007 "Invalid Token") is fixed here by logging in
 * again; the user is only asked when the keys themselves stop working.
 *
 * History: GET <md>/instruments/ohlc?exchangeSegment=NSECM&exchangeInstrumentID=2885&
 * startTime=Oct 27 2026 091500&endTime=…&compressionValue=60 (IST clock times), header
 * authorization: <token>. result.dataReponse (sic) is "ts|o|h|l|c|v|oi,…" where ts is IST clock
 * time written as unix seconds. Requests cover about six days.
 * Live: REST subscription (POST / PUT <md>/instruments/subscription, xtsMessageCode 1501) plus
 * the socket in XtsFeed. Checked Oct 2026 against the live servers with fake keys.
 */
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, type MasterRecord } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { parseXtsInstruments, XTS_SEGMENT_IDS } from './XtsInstruments'
import { XtsFeed, xtsTimeMs, parseXtsTouchline, type XtsTouchline } from './XtsFeed'

const IST_SEC = 19_800
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SUBSCRIBE_BATCH = 50

export interface XtsSite {
  /** Broker type in the app, e.g. "compositedge" */
  type: string
  label: string
  /** Market data API root, e.g. https://xts.compositedge.com/apimarketdata */
  marketData: string
}

/** "Oct 27 2026 091500": the IST clock time XTS history takes */
export function xtsTimeParam(ms: number): string {
  const d = new Date(ms + IST_SEC * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${MONTHS[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

/** result.dataReponse → bars, oldest first (times are IST clock written as unix seconds) */
export function parseXtsCandles(data: string): Bar[] {
  const bars: Bar[] = []
  for (const row of String(data || '').split(',')) {
    const f = row.split('|')
    if (f.length < 6) continue
    const ts = (Number(f[0]) - IST_SEC) * 1000
    const open = Number(f[1]), high = Number(f[2]), low = Number(f[3]), close = Number(f[4])
    if (!(ts > 0 && open > 0 && high > 0 && low > 0 && close > 0)) continue
    const oi = Number(f[6])
    bars.push({ ts, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: Math.max(0, Math.round(Number(f[5]) || 0)), ...(oi > 0 ? { openInterest: oi } : {}) })
  }
  return bars.sort((a, b) => a.ts - b.ts)
}

const SESSION_CODES = /^e-session-|invalid token|token.*expired/i
const RATE_RE = /rate ?limit|too many|throttl/i
const NO_DATA_RE = /data not found|no data/i

/** Downloads one XTS broker's symbol list */
export async function downloadXtsInstruments(marketData: string): Promise<MasterRecord[]> {
  const post = async (segment: string) => {
    const res = await fetch(`${marketData}/instruments/master`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeSegmentList: [segment] }),
      signal: AbortSignal.timeout(180_000),
    })
    const body: any = await res.json().catch(() => null)
    if (body?.type !== 'success' || typeof body.result !== 'string') throw new Error(`${segment}: ${body?.description || `HTTP ${res.status}`}`)
    return body.result as string
  }
  const indexList = async (segment: 'NSECM' | 'BSECM') => {
    try {
      const res = await fetch(`${marketData}/instruments/indexlist?exchangeSegment=${XTS_SEGMENT_IDS[segment]}`, { signal: AbortSignal.timeout(30_000) })
      const body: any = await res.json()
      return { segment, names: Array.isArray(body?.result?.indexList) ? body.result.indexList as string[] : [] }
    } catch {
      return { segment, names: [] } // indices only; the rest of the list still works
    }
  }
  const [texts, indices] = await Promise.all([
    Promise.all(['NSECM', 'BSECM', 'NSEFO', 'MCXFO'].map(post)),
    Promise.all([indexList('NSECM'), indexList('BSECM')]),
  ])
  return parseXtsInstruments(texts, indices)
}

export class XtsAdapter extends ListedBrokerAdapter {
  readonly maxIntradayHistoryDays = 6
  protected readonly label: string
  protected readonly master: InstrumentMaster
  private readonly historyLimiter: RateLimiter
  private appKey = ''
  private secretKey = ''
  private token = ''
  private userId = ''
  private feed: XtsFeed | null = null
  private relogin: Promise<void> | null = null
  /** When the live socket last caused a fresh login */
  private feedReloginAt = 0

  constructor(private readonly site: XtsSite, master: InstrumentMaster, limiter: RateLimiter) {
    super()
    this.label = site.label
    this.master = master
    this.historyLimiter = limiter
  }

  historyRequestsPerMinute() { return this.historyLimiter.perMinuteBudget }

  /** Logs in with the Market Data key and secret; returns the token and user id */
  private async login(): Promise<void> {
    const res = await fetch(`${this.site.marketData}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey: this.appKey, secretKey: this.secretKey, source: 'WebAPI' }),
      signal: AbortSignal.timeout(30_000),
    })
    const body: any = await res.json().catch(() => null)
    if (body?.type !== 'success' || !body.result?.token) {
      const why = NO_DATA_RE.test(body?.description || '') || body?.code === 'e-app-001'
        ? 'the Market Data API key or secret was not accepted (use the Market Data API keys, not the Interactive ones)'
        : body?.description || `HTTP ${res.status}`
      throw Object.assign(new Error(`${this.label} login failed: ${why}`), { code: 'TOKEN_EXPIRED' })
    }
    this.token = String(body.result.token)
    this.userId = String(body.result.userID || this.userId)
  }

  /** A refused token: log in again once (concurrent callers share it) */
  private reloginOnce(): Promise<void> {
    this.relogin ??= this.login()
      .then(() => { console.log(`[${this.label}] Session renewed with the saved keys`); this.startFeed() })
      .finally(() => { this.relogin = null })
    return this.relogin
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    this.appKey = (credentials.apiKey || '').trim()
    this.secretKey = (credentials.apiSecret || '').trim()
    if (!this.appKey || !this.secretKey) throw new Error(`${this.label} needs the Market Data API key and secret`)
    // A saved token may be from yesterday; the keys get a fresh one in a second
    await this.login()
    this.emit('connection_state', 'CONNECTED')
    this.startFeed()
    this.master.ensureLoaded().catch(err => console.error(`[${this.label}] ${err?.message || err}`))
    return { accountId: this.userId, accessToken: this.token }
  }

  async disconnect(): Promise<void> {
    this.feed?.disconnect()
    this.feed = null
    this.emit('connection_state', 'DISCONNECTED')
  }

  private startFeed() {
    this.feed?.disconnect()
    const socketUrl = `${this.site.marketData.replace(/^http/, 'ws')}/socket.io/`
    const feed = new XtsFeed(socketUrl, this.token, this.userId, this.label)
    this.feed = feed
    feed.on('touchline', (t: XtsTouchline) => this.onTouchline(t))
    feed.on('connected', () => {
      this.emit('connection_state', 'CONNECTED')
      // The server keeps nothing for a new socket: subscribe everything again
      const refs = this.subscribedRefs()
      if (refs.length) this.sendSubscription('POST', refs).catch(() => {})
    })
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => {
      // A socket that refuses even a fresh token would otherwise log in again forever: after one
      // try, live prices stop and history keeps working on the REST API
      if (Date.now() - this.feedReloginAt < 120_000) {
        console.warn(`[${this.label}] The live price socket refused a fresh login; live ticks are paused (history downloads continue). Reconnecting the broker retries.`)
        return
      }
      this.feedReloginAt = Date.now()
      this.reloginOnce().catch(err => {
        console.error(`[${this.label}] ${err?.message || err}`)
        this.emit('auth_failed')
      })
    })
    feed.connect()
  }

  private onTouchline(t: XtsTouchline) {
    const segment = Object.keys(XTS_SEGMENT_IDS).find(s => XTS_SEGMENT_IDS[s] === t.segment)
    if (!segment) return
    this.emitTick(`${segment}|${t.instrumentId}`, {
      lastPrice: t.lastPrice,
      lastQty: t.lastQty,
      totalVolume: t.totalVolume,
      timestampMs: xtsTimeMs(t.lastTradedTime),
      openInterest: t.openInterest,
    })
  }

  /** GET/POST/PUT on the market data API with the token; renews a refused token once */
  private async call(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, retried = false): Promise<any> {
    const res = await fetch(`${this.site.marketData}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: this.token },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const answer: any = await res.json().catch(() => null)
    if (answer?.type === 'success') return answer
    const description = String(answer?.description || `HTTP ${res.status}`)
    if ((res.status === 401 || SESSION_CODES.test(String(answer?.code || '')) || SESSION_CODES.test(description)) && !retried) {
      try {
        await this.reloginOnce()
      } catch (err: any) {
        throw Object.assign(new Error(`Auth Error: ${err?.message || err}`), { code: -16 })
      }
      return this.call(method, path, body, true)
    }
    if (res.status === 429 || RATE_RE.test(description)) throw Object.assign(new Error(`429 request limit reached: ${description}`), { code: 429 })
    return answer ?? { type: 'error', description }
  }

  private async sendSubscription(method: 'POST' | 'PUT', refs: string[]) {
    for (let i = 0; i < refs.length; i += SUBSCRIBE_BATCH) {
      const instruments = refs.slice(i, i + SUBSCRIBE_BATCH).map(ref => {
        const [segment, id] = ref.split('|')
        return { exchangeSegment: XTS_SEGMENT_IDS[segment], exchangeInstrumentID: Number(id) }
      })
      const answer = await this.call(method, '/instruments/subscription', { instruments, xtsMessageCode: 1501 })
      if (answer?.type !== 'success') {
        // "Already subscribed" after a reconnect is fine; anything else is worth a line in the log
        if (!/already/i.test(answer?.description || '')) console.warn(`[${this.label}] Live subscription: ${answer?.description}`)
        continue
      }
      // The answer carries the current price of each instrument: shown at once, before any trade
      for (const q of answer.result?.listQuotes || []) {
        const t = parseXtsTouchline(q)
        if (t) this.onTouchline(t)
      }
    }
  }

  protected feedSubscribe(records: MasterRecord[]) {
    this.sendSubscription('POST', records.map(r => r.ref)).catch(err => console.error(`[${this.label}] Subscribe failed: ${err?.message || err}`))
  }

  protected feedUnsubscribe(refs: string[]) {
    this.sendSubscription('PUT', refs).catch(() => {})
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.token) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const [segment, id] = rec.ref.split('|')
    const minutes = parseInt(interval, 10) || 1
    const q = new URLSearchParams({
      exchangeSegment: segment,
      exchangeInstrumentID: id,
      startTime: xtsTimeParam(from.getTime()),
      endTime: xtsTimeParam(to.getTime()),
      compressionValue: String(minutes * 60),
    })
    await this.historyLimiter.acquire()
    let answer: any
    try {
      answer = await this.call('GET', `/instruments/ohlc?${q}`)
    } catch (err: any) {
      if (err?.code === 429) {
        this.historyLimiter.limited()
        console.warn(`[${this.label}] Rate limit reached for ${instrumentToken}: pausing, now ${this.historyLimiter.perMinuteBudget} requests/min`)
      }
      throw err
    }
    if (answer?.type === 'success') return parseXtsCandles(answer.result?.dataReponse ?? answer.result?.dataResponse ?? '')
    if (NO_DATA_RE.test(answer?.description || '')) return []
    throw Object.assign(new Error(`${this.label} API Error: ${answer?.description || 'unknown error'}`), { code: -1, fromApi: true })
  }
}

// ---- the XTS brokers ----

export const XTS_SITES: XtsSite[] = [
  { type: 'compositedge', label: 'Compositedge', marketData: 'https://xts.compositedge.com/apimarketdata' },
  { type: 'fivepaisa_xts', label: '5paisa (XTS)', marketData: 'https://xtsmum.5paisa.com/apimarketdata' },
  { type: 'jainam', label: 'Jainam', marketData: 'https://jtrade.jainam.in:5000/apibinarymarketdata' },
  { type: 'ibulls', label: 'IndiaBulls', marketData: 'https://xts.ibullssecurities.com/apibinarymarketdata' },
  { type: 'rmoney', label: 'Rmoney', marketData: 'https://xts.rmoneyindia.co.in:3000/apibinarymarketdata' },
]

const masters = new Map<string, InstrumentMaster>()
const limiters = new Map<string, RateLimiter>()

/** One instrument list and one request budget per XTS broker, shared by its accounts */
export function createXtsAdapter(type: string): XtsAdapter {
  const site = XTS_SITES.find(s => s.type === type)
  if (!site) throw new Error(`Unknown XTS broker ${type}`)
  if (!masters.has(type)) masters.set(type, new InstrumentMaster(type, () => downloadXtsInstruments(site.marketData)))
  if (!limiters.has(type)) limiters.set(type, new RateLimiter(2, 60))
  return new XtsAdapter(site, masters.get(type)!, limiters.get(type)!)
}

/** The instrument list of an XTS broker (tests, search) */
export function xtsMaster(type: string): InstrumentMaster {
  createXtsAdapter(type)
  return masters.get(type)!
}
