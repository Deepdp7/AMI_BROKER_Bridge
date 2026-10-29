/**
 * KotakAdapter.ts — Kotak Securities, "Neo Trade API" v2.
 *
 * Keys: in the Kotak Neo app / web → Invest → Trade API, create an application and copy its
 * access token. Also needed: the account's UCC (client code), the registered mobile number, the
 * trading MPIN and an authenticator (TOTP) registered for the API.
 *
 * Login (two steps, no browser; checked against Kotak's SDK and OpenAlgo's working code):
 *   POST https://mis.kotaksecurities.com/login/1.0/tradeApiLogin
 *        headers Authorization: <access token>, neo-fin-key: neotradeapi
 *        {mobileNumber: "+91…", ucc, totp}                    → data {token, sid}  (the "view" session)
 *   POST …/login/1.0/tradeApiValidate  headers + sid, Auth: <view token>
 *        {mpin}                                               → data {token, sid, baseUrl, dataCenter}
 * The 6-digit code changes every 30 s. Given the authenticator's secret key the engine makes the
 * code itself, which is what lets it log in again every morning without asking; given only a code,
 * the first login works and later ones ask for a new code.
 *
 * History: GET <baseUrl>/market-data/1.0/historical/details?neosymbol=<segment>|<token>&fromdate=
 * YYYY-MM-DD&todate=…&interval=1min  header Authorization: <access token>. {status:"success",
 * data:{candles:[[ISO time +05:30, o, h, l, c, volume, oi], …]}}. NSE, BSE, NFO and BFO only (MCX
 * and currency give quotes but no history); at most 30 days of 1-minute data per request, five
 * years back; about one request a second is the most it keeps up with (429 beyond that). A range
 * with no candles is a 400 "No data found". Some opening candles have a high/low that excludes
 * their own open, and one minute a day can carry a negative volume: both are repaired here.
 * Live: SFeed socket (KotakFeed).
 */
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { totpCode } from '../../../lib/totp'
import { InstrumentMaster, type MasterRecord } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { downloadKotakInstruments } from './KotakInstruments'
import { KotakFeed, kotakFeedUrl, KOTAK_INDEX_NAMES, type KotakTick } from './KotakFeed'

const LOGIN_HOST = 'https://mis.kotaksecurities.com'
const DAY_MS = 86_400_000
const IST_MS = 19_800_000
const CHUNK_DAYS: Record<string, number> = { '1min': 30, '3min': 30, '5min': 30, '10min': 60, '15min': 60, '30min': 90, '60min': 90 }
const MAX_LOOKBACK_DAYS = 365 * 5 - 2
const RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000]

/** What the login form saves in the "secret" field: "mobile|mpin|totp" (secret key or 6-digit code) */
export function packKotakSecret(parts: { mobile: string; mpin: string; totp: string }): string {
  return [parts.mobile, parts.mpin, parts.totp].map(p => p.trim().replace(/\|/g, '')).join('|')
}

export function unpackKotakSecret(secret: string): { mobile: string; mpin: string; totp: string } {
  const [mobile = '', mpin = '', totp = ''] = (secret || '').split('|')
  return { mobile: mobile.trim(), mpin: mpin.trim(), totp: totp.trim() }
}

/** "9876543210", "919876543210" or "+91 98765 43210" → "+919876543210" */
export function kotakMobile(text: string): string {
  let m = text.replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (m.startsWith('91') && m.length === 12) m = m.slice(2)
  return `+91${m}`
}

/** The code to log in with now: made from the secret key, or the 6 digits as typed */
export function kotakTotp(totp: string, nowMs = Date.now()): { code: string; fromSecret: boolean } {
  const t = totp.replace(/\s/g, '')
  if (/^\d{6}$/.test(t)) return { code: t, fromSecret: false }
  return { code: totpCode(t, nowMs), fromSecret: true }
}

/** Minutes → Kotak's interval name */
export function kotakInterval(interval: string): string {
  const m = parseInt(interval, 10) || 1
  return m >= 60 ? '60min' : `${[1, 3, 5, 10, 15, 30].reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a))}min`
}

/** result candles → bars, oldest first, with the broker's inconsistencies repaired */
export function parseKotakCandles(rows: unknown): Bar[] {
  const bars: Bar[] = []
  for (const c of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(c) || c.length < 5) continue
    const ts = typeof c[0] === 'number' ? (c[0] < 1e11 ? c[0] * 1000 : c[0]) : Date.parse(String(c[0]).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
    const open = Number(c[1]), high = Number(c[2]), low = Number(c[3]), close = Number(c[4])
    if (!(ts > 0 && open > 0 && high > 0 && low > 0 && close > 0)) continue
    const oi = Number(c[6])
    bars.push({
      ts,
      open,
      // An opening candle can take its open from the pre-open auction, outside its own high / low
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      // Some minutes come back with a negative volume
      volume: Math.max(0, Math.round(Number(c[5]) || 0)),
      ...(oi > 0 ? { openInterest: oi } : {}),
    })
  }
  return bars.sort((a, b) => a.ts - b.ts)
}

const NO_DATA_RE = /no data found|data not available|no data is available|market has not yet opened/i
const SESSION_RE = /invalid (token|session|credentials)|unauthori[sz]ed|session.*(expired|invalid)|token.*expired/i

/** IST calendar day (YYYY-MM-DD) of a unix ms time */
const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10)

export class KotakAdapter extends ListedBrokerAdapter {
  readonly maxIntradayHistoryDays = 30
  protected readonly label = 'Kotak'
  protected readonly master: InstrumentMaster
  private readonly historyLimiter: RateLimiter

  private accessToken = ''
  private ucc = ''
  private mobile = ''
  private mpin = ''
  private totp = ''
  private baseUrl = ''
  private sid = ''
  private dataCenter = ''
  private feed: KotakFeed | null = null
  private relogin: Promise<void> | null = null
  private feedReloginAt = 0
  /** ref → Kotak's index name, for the index instruments being streamed */
  private indexNameOf = new Map<string, string>()
  private refOfIndexName = new Map<string, string>()

  constructor(master: InstrumentMaster, limiter: RateLimiter) {
    super()
    this.master = master
    this.historyLimiter = limiter
  }

  historyRequestsPerMinute() { return this.historyLimiter.perMinuteBudget }

  /** Both login steps; sets the session used by history and the live feed */
  private async login(): Promise<void> {
    const { code } = kotakTotp(this.totp)
    const headers = { Authorization: this.accessToken, 'neo-fin-key': 'neotradeapi', 'Content-Type': 'application/json' }
    const post = async (path: string, extra: Record<string, string>, body: object) => {
      const res = await fetch(`${LOGIN_HOST}${path}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
      const answer: any = await res.json().catch(() => null)
      if (answer?.data?.status !== 'success') {
        // Real answers: {"error":[{"code":"424","message":"Consumer key … does not exist"}]} for a wrong access token
        const why = String(answer?.errMsg || answer?.message || answer?.data?.message || answer?.fault?.message || answer?.error?.[0]?.message || `HTTP ${res.status}`)
        throw Object.assign(new Error(/consumer key/i.test(why) ? 'the access token was not accepted' : why), { code: 'TOKEN_EXPIRED' })
      }
      return answer.data as { token: string; sid: string; baseUrl?: string; dataCenter?: string }
    }
    let view: { token: string; sid: string }
    try {
      view = await post('/login/1.0/tradeApiLogin', {}, { mobileNumber: kotakMobile(this.mobile), ucc: this.ucc, totp: code })
    } catch (err: any) {
      throw Object.assign(new Error(`Kotak login failed (code step): ${err.message}. Check the access token, client code (UCC), mobile number and authenticator ${/^\d{6}$/.test(this.totp.trim()) ? 'code' : 'secret key'}.`), { code: 'TOKEN_EXPIRED' })
    }
    let session: { token: string; sid: string; baseUrl?: string; dataCenter?: string }
    try {
      session = await post('/login/1.0/tradeApiValidate', { sid: view.sid, Auth: view.token }, { mpin: this.mpin })
    } catch (err: any) {
      throw Object.assign(new Error(`Kotak login failed (MPIN step): ${err.message}. Check the MPIN.`), { code: 'TOKEN_EXPIRED' })
    }
    if (!session.baseUrl) throw Object.assign(new Error('Kotak login worked but gave no server address (baseUrl); try again'), { code: 'TOKEN_EXPIRED' })
    this.baseUrl = session.baseUrl.replace(/\/+$/, '')
    this.sid = session.sid
    this.dataCenter = session.dataCenter || ''
  }

  /** A session that stopped working: log in again once (callers share it) */
  private reloginOnce(): Promise<void> {
    this.relogin ??= this.login()
      .then(() => { console.log('[Kotak] Session renewed'); return this.startFeed() })
      .finally(() => { this.relogin = null })
    return this.relogin
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    this.accessToken = (credentials.apiKey || '').trim()
    this.ucc = String(credentials.clientId || '').trim().toUpperCase()
    const secret = unpackKotakSecret(credentials.apiSecret || '')
    this.mobile = secret.mobile
    this.mpin = secret.mpin
    this.totp = secret.totp
    if (!this.accessToken || !this.ucc || !this.mobile || !this.mpin || !this.totp) {
      throw new Error('Kotak needs the access token, client code (UCC), mobile number, MPIN and authenticator secret key')
    }
    await this.login()
    this.emit('connection_state', 'CONNECTED')
    await this.startFeed()
    this.master.ensureLoaded().catch(err => console.error(`[Kotak] ${err?.message || err}`))
    return { accountId: this.ucc, accessToken: this.sid }
  }

  async disconnect(): Promise<void> {
    this.feed?.disconnect()
    this.feed = null
    this.emit('connection_state', 'DISCONNECTED')
  }

  private async startFeed() {
    this.feed?.disconnect()
    const url = await kotakFeedUrl(this.dataCenter)
    const feed = new KotakFeed(url, this.ucc, this.sid, this.label)
    this.feed = feed
    feed.on('tick', (t: KotakTick) => this.onTick(t))
    feed.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => {
      // A feed that refuses even a fresh login would otherwise log in again forever
      if (Date.now() - this.feedReloginAt < 120_000) {
        console.warn('[Kotak] The live price socket refused a fresh login; live ticks are paused (history downloads continue). Reconnecting the broker retries.')
        return
      }
      this.feedReloginAt = Date.now()
      this.reloginOnce().catch(err => {
        console.error(`[Kotak] ${err?.message || err}`)
        this.emit('auth_failed')
      })
    })
    // Whatever was streaming before (a renewed session starts a new socket)
    this.replaySubscriptions(feed)
    feed.connect()
  }

  private replaySubscriptions(feed: KotakFeed) {
    const scrips: string[] = [], indices: string[] = []
    for (const ref of this.subscribedRefs()) {
      const index = this.indexNameOf.get(ref)
      if (index) indices.push(`${ref.split('|')[0]}|${index}`)
      else scrips.push(ref)
    }
    if (scrips.length) feed.subscribeScrips(scrips)
    if (indices.length) feed.subscribeIndices(indices)
  }

  private onTick(t: KotakTick) {
    const ref = t.indexName ? this.refOfIndexName.get(`${t.segment}|${t.indexName.toLowerCase()}`) : `${t.segment}|${t.token}`
    if (!ref) return
    this.emitTick(ref, { lastPrice: t.lastPrice, lastQty: t.lastQty, totalVolume: t.totalVolume, timestampMs: Date.now(), openInterest: t.openInterest })
  }

  protected feedSubscribe(records: MasterRecord[]) {
    const scrips: string[] = [], indices: string[] = []
    for (const r of records) {
      if (r.cat === 'INDEX') {
        const name = KOTAK_INDEX_NAMES[r.ticker]
        if (!name) { console.warn(`[Kotak] No live feed name known for the index ${r.ticker}; no live ticks for it`); continue }
        const segment = r.ref.split('|')[0]
        this.indexNameOf.set(r.ref, name)
        this.refOfIndexName.set(`${segment}|${name.toLowerCase()}`, r.ref)
        indices.push(`${segment}|${name}`)
      } else {
        scrips.push(r.ref)
      }
    }
    // Before the first login or during a renewal there is no socket; startFeed replays these
    if (scrips.length) this.feed?.subscribeScrips(scrips)
    if (indices.length) this.feed?.subscribeIndices(indices)
  }

  protected feedUnsubscribe(refs: string[]) {
    const scrips: string[] = [], indices: string[] = []
    for (const ref of refs) {
      const name = this.indexNameOf.get(ref)
      if (name) {
        const segment = ref.split('|')[0]
        indices.push(`${segment}|${name}`)
        this.refOfIndexName.delete(`${segment}|${name.toLowerCase()}`)
        this.indexNameOf.delete(ref)
      } else scrips.push(ref)
    }
    if (scrips.length) this.feed?.unsubscribeScrips(scrips)
    if (indices.length) this.feed?.unsubscribeIndices(indices)
  }

  /** One history request; returns the candle rows ([] for a range with no trading) */
  private async fetchChunk(neosymbol: string, interval: string, fromDay: string, toDay: string, retried = false): Promise<unknown[]> {
    const q = new URLSearchParams({ neosymbol, fromdate: fromDay, todate: toDay, interval })
    const url = `${this.baseUrl}/market-data/1.0/historical/details?${q.toString().replace(/%7C/gi, '|')}`
    for (let attempt = 0; ; attempt++) {
      await this.historyLimiter.acquire()
      const res = await fetch(url, { headers: { Authorization: this.accessToken, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60_000) })
      if (res.status === 429) {
        this.historyLimiter.limited()
        if (attempt >= RETRY_BACKOFF_MS.length) {
          throw Object.assign(new Error(`429 request limit reached for ${neosymbol}`), { code: 429 })
        }
        console.warn(`[Kotak] Rate limit reached for ${neosymbol}: waiting ${RETRY_BACKOFF_MS[attempt] / 1000}s, now ${this.historyLimiter.perMinuteBudget} requests/min`)
        await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[attempt]))
        continue
      }
      const body: any = await res.json().catch(() => null)
      const message = String(body?.fault?.message || body?.emsg || body?.message || '')
      if (NO_DATA_RE.test(message)) return []
      if (res.ok && String(body?.status || '').toLowerCase() === 'success') return body?.data?.candles || []
      if ((res.status === 401 || SESSION_RE.test(message)) && !retried) {
        try { await this.reloginOnce() } catch (err: any) { throw Object.assign(new Error(`Auth Error: ${err?.message || err}`), { code: -16 }) }
        return this.fetchChunk(neosymbol, interval, fromDay, toDay, true)
      }
      throw Object.assign(new Error(`Kotak API Error: ${message || `HTTP ${res.status}`}`), { code: -1, fromApi: true })
    }
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.baseUrl) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const neointerval = kotakInterval(interval)
    const [segment] = rec.ref.split('|')
    // An index also answers to its descriptive name when the token isn't accepted
    const candidates = [rec.ref]
    const indexName = rec.cat === 'INDEX' ? KOTAK_INDEX_NAMES[rec.ticker] : undefined
    if (indexName) candidates.push(`${segment}|${indexName}`, `${segment}|${indexName.toUpperCase()}`)

    // Kotak refuses a start date five years old or more, and caps the range per request
    const earliest = Date.now() - MAX_LOOKBACK_DAYS * DAY_MS
    let start = Math.max(from.getTime(), earliest)
    const end = to.getTime()
    const chunkMs = (CHUNK_DAYS[neointerval] || 30) * DAY_MS
    const rows: unknown[] = []
    let working = candidates[0]
    while (start <= end) {
      const chunkEnd = Math.min(start + chunkMs - DAY_MS, end)
      let got: unknown[] | null = null
      let lastError: any
      for (const sym of working === candidates[0] ? candidates : [working]) {
        try {
          got = await this.fetchChunk(sym, neointerval, istDay(start), istDay(chunkEnd))
        } catch (err: any) {
          lastError = err
          // A refused symbol name is worth trying the next spelling; a limit or login problem is not
          if (err?.code === 429 || err?.code === -16) throw err
          continue
        }
        // The first spelling that returns candles is kept for the rest of the range
        if (got.length) { working = sym; break }
      }
      if (!got) throw lastError
      rows.push(...got)
      start = chunkEnd + DAY_MS
    }
    const lo = from.getTime(), hi = to.getTime()
    return parseKotakCandles(rows).filter(b => b.ts >= lo && b.ts <= hi)
  }
}

// ---- one instrument list and one request budget, shared by every Kotak account ----

let master: InstrumentMaster | null = null
let limiter: RateLimiter | null = null

export function createKotakAdapter(): KotakAdapter {
  master ??= new InstrumentMaster('kotak', () => downloadKotakInstruments())
  // Sustained rate Kotak keeps up with: about one request a second
  limiter ??= new RateLimiter(1, 50)
  return new KotakAdapter(master, limiter)
}

/** The instrument list (tests, search) */
export function kotakMaster(): InstrumentMaster {
  createKotakAdapter()
  return master!
}
