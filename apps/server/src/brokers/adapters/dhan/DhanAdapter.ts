/**
 * DhanAdapter.ts — DhanHQ v2.
 *
 * Login (API key mode, keys made on web.dhan.co → "Access DhanHQ APIs" with redirect URL
 * http://127.0.0.1:7890/api/callback/dhan):
 *   POST auth.dhan.co/app/generate-consent?client_id=… (headers app_id, app_secret) → consentAppId
 *   browser → auth.dhan.co/login/consentApp-login?consentAppId=… → redirect with tokenId
 *   GET  auth.dhan.co/app/consumeApp-consent?tokenId=… → accessToken (JWT, valid 24 h)
 *
 * History: POST /v2/charts/intraday, 1-minute candles, at most 90 days per request, about
 * 5 years back. Data APIs: 5 requests/second, 100,000 a day, and they need Dhan's Data API
 * plan (DH-902 / 806 without it). Live: DhanFeed, quote packets.
 */
import fs from 'fs'
import path from 'path'
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { DATA_DIR } from '../../../db'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, splitCsvLine, type MasterRecord, type InstrumentCategory } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { DhanFeed, DHAN_SEGMENT_CODES, type DhanPacket } from './DhanFeed'
import { INDEX_UNDERLYINGS, indexKey, indexName, futureSymbol, optionSymbol, formatIstDateTime, jwtExpiryMs, jwtPayload } from '../symbolKey'

const API = 'https://api.dhan.co/v2'
const AUTH = 'https://auth.dhan.co'
const IST_SEC = 19_800
const DAY_MS = 24 * 3600 * 1000
/** Dhan's v1 epoch, seconds since 1980-01-01 (the v2 docs' sample reads as 09:15 IST with the UTC one) */
const DHAN_V1_EPOCHS_SEC = [315_532_800, 315_513_000]

// Dhan Data APIs: 5 requests/second, 100,000 a day. Shared by every caller.
const historyLimiter = new RateLimiter(4, 240)

const SEGMENTS: Record<string, string> = {
  'NSE|E': 'NSE_EQ', 'BSE|E': 'BSE_EQ', 'NSE|D': 'NSE_FNO', 'MCX|M': 'MCX_COMM', 'NSE|I': 'IDX_I', 'BSE|I': 'IDX_I',
}
const SEGMENT_NAMES_BY_CODE = Object.fromEntries(Object.entries(DHAN_SEGMENT_CODES).map(([k, v]) => [v, k]))

/** "TATAELXSI-Oct2026-FUT", "CRUDEOIL-19Nov2026-FUT" → underlying; options end "-22600-CE" */
const DERIV_RE = /^(.+?)-\d{0,2}[A-Za-z]{3}\d{4}-(FUT|[\d.]+-(CE|PE))$/

/**
 * Dhan's scrip master (public CSV) reduced to NSE/BSE cash, indices, NSE F&O and MCX, with
 * contract names built the NSE / Kite way (Dhan's own are "TATAELXSI-Oct2026-FUT").
 */
export function parseDhanInstruments(csv: string): MasterRecord[] {
  const lines = csv.split('\n')
  const header = splitCsvLine(lines[0].trim())
  const col = (name: string) => header.indexOf(name)
  const iExch = col('SEM_EXM_EXCH_ID'), iSeg = col('SEM_SEGMENT'), iId = col('SEM_SMST_SECURITY_ID'), iInst = col('SEM_INSTRUMENT_NAME')
  const iSym = col('SEM_TRADING_SYMBOL'), iLot = col('SEM_LOT_UNITS'), iCustom = col('SEM_CUSTOM_SYMBOL'), iExpiry = col('SEM_EXPIRY_DATE')
  const iStrike = col('SEM_STRIKE_PRICE'), iOptType = col('SEM_OPTION_TYPE'), iTick = col('SEM_TICK_SIZE'), iFlag = col('SEM_EXPIRY_FLAG')
  const iSeries = col('SEM_SERIES'), iName = col('SM_SYMBOL_NAME')
  const out: MasterRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const p = splitCsvLine(line)
    const exch = p[iExch], seg = p[iSeg]
    const segment = SEGMENTS[`${exch}|${seg}`]
    if (!segment) continue
    const instrument = p[iInst]
    const sym = (p[iSym] || '').trim()
    if (!sym) continue
    const ref = `${segment}|${p[iId]}|${instrument}`
    const name = p[iCustom] || p[iName] || sym
    const lot = Number(p[iLot]) || 1
    // Tick sizes in the scrip master are in paise for traded instruments
    const tick = (Number(p[iTick]) || 5) / (instrument === 'INDEX' ? 1 : 100)

    if (seg === 'E') {
      if (instrument !== 'EQUITY') continue
      const series = (p[iSeries] || '').trim()
      const ticker = exch === 'NSE' && series && series !== 'EQ' ? `${sym}-${series}` : sym
      out.push({ key: `${exch}:${ticker}`, ticker, name, exchange: exch, cat: 'EQ', lot, tick, expiry: '', ref })
      continue
    }
    if (seg === 'I') {
      out.push({ key: indexKey(exch, sym), ticker: indexName(sym), name, exchange: exch, cat: 'INDEX', lot: 1, tick: 0.05, expiry: '', ref })
      continue
    }

    const m = DERIV_RE.exec(sym)
    const expiry = (p[iExpiry] || '').slice(0, 10)
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) continue
    const underlying = m[1].toUpperCase()
    const exchange = exch === 'MCX' ? 'MCX' : 'NFO'
    const isIndex = INDEX_UNDERLYINGS.has(underlying) || instrument === 'FUTIDX' || instrument === 'OPTIDX'
    let ticker: string
    let cat: InstrumentCategory
    if (m[2] === 'FUT') {
      ticker = futureSymbol(underlying, expiry)
      cat = isIndex ? 'FUTIDX' : exch === 'MCX' ? 'FUTCOM' : 'FUTSTK'
    } else {
      const type = (p[iOptType] || m[3]) as 'CE' | 'PE'
      ticker = optionSymbol(underlying, expiry, Number(p[iStrike]), type, p[iFlag] === 'W')
      cat = isIndex ? 'OPTIDX' : exch === 'MCX' ? 'OPTFUT' : 'OPTSTK'
    }
    out.push({ key: `${exchange}:${ticker}`, ticker, name, exchange, cat, lot, tick, expiry, ref })
  }
  return out
}

async function downloadDhanInstruments(): Promise<MasterRecord[]> {
  const res = await fetch('https://images.dhan.co/api-data/api-scrip-master.csv', { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return parseDhanInstruments(await res.text())
}

/** One instrument list for every Dhan account */
export const dhanMaster = new InstrumentMaster('dhan', downloadDhanInstruments)

// ---------------------------------------------------------------------------------------
// Timestamps. Dhan documents only "epoch". v1 counted from 1980-01-01 IST, the v2 docs'
// sample still shows such values, and the feed's trade time may be IST wall clock. Read
// each response the way that puts its candles inside market hours.
// ---------------------------------------------------------------------------------------

/** IST minutes-of-day window a candle / trade of this exchange can fall in */
function sessionWindow(exchange: string): [number, number] {
  return exchange === 'MCX' ? [8 * 60 + 55, 23 * 60 + 59] : [9 * 60, 15 * 60 + 59]
}

export function inSession(ms: number, exchange: string): boolean {
  const ist = new Date(ms + IST_SEC * 1000)
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  const [open, close] = sessionWindow(exchange)
  return minute >= open && minute <= close
}

// What the timestamps turned out to be, learned from unambiguous answers and kept across runs:
// a morning-only answer (09:15–10:30) is in market hours read either way
const TIME_FILE = path.join(DATA_DIR, 'dhan_master', 'time_format.json')
const learned: { feedShiftSec: number | null; historyOffsetSec: number | null } = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(TIME_FILE, 'utf8'))
    return { feedShiftSec: typeof j.feedShiftSec === 'number' ? j.feedShiftSec : null, historyOffsetSec: typeof j.historyOffsetSec === 'number' ? j.historyOffsetSec : null }
  } catch {
    return { feedShiftSec: null, historyOffsetSec: null }
  }
})()

function learn(field: 'feedShiftSec' | 'historyOffsetSec', value: number) {
  if (learned[field] === value) return
  learned[field] = value
  const what = value === 0 ? 'unix time' : value === -IST_SEC || value === IST_SEC ? 'IST clock time' : 'Dhan\'s 1980 epoch'
  console.log(`[Dhan] ${field === 'feedShiftSec' ? 'Feed trade' : 'Candle'} times are ${what}`)
  try {
    fs.mkdirSync(path.dirname(TIME_FILE), { recursive: true })
    fs.writeFileSync(TIME_FILE, JSON.stringify(learned))
  } catch { /* only a cache */ }
}

/** For tests */
export function resetLearnedTimes(feedShiftSec: number | null = null, historyOffsetSec: number | null = null) {
  learned.feedShiftSec = feedShiftSec
  learned.historyOffsetSec = historyOffsetSec
}

/** Seconds to add to Dhan candle timestamps to get unix time: 0, −19800 (IST clock) or the 1980 epoch */
export function dhanEpochOffsetSec(timestamps: number[], fromMs: number, toMs: number, exchange: string): number {
  if (!timestamps.length) return learned.historyOffsetSec ?? 0
  const candidates = [0, -IST_SEC, ...DHAN_V1_EPOCHS_SEC]
  const step = Math.max(1, Math.floor(timestamps.length / 120))
  const scores = candidates.map(offset => {
    let score = 0
    for (let i = 0; i < timestamps.length; i += step) {
      const ms = (timestamps[i] + offset) * 1000
      if (ms >= fromMs - DAY_MS && ms <= toMs + DAY_MS && inSession(ms, exchange)) score++
    }
    return score
  })
  const top = Math.max(...scores)
  const tied = candidates.filter((_, i) => scores[i] === top)
  if (top > 0 && tied.length === 1) {
    learn('historyOffsetSec', tied[0])
    return tied[0]
  }
  if (learned.historyOffsetSec !== null && tied.includes(learned.historyOffsetSec)) return learned.historyOffsetSec
  return tied[0]
}

/** Last-trade time of a feed packet in unix ms */
export function feedTimeMs(ltt: number | undefined, exchange: string, nowMs = Date.now()): number {
  if (!ltt) return nowMs
  const asUnix = ltt * 1000
  const asIst = (ltt - IST_SEC) * 1000
  const live = (t: number) => Math.abs(t - nowMs) < 3 * 60_000
  // A trade happening now tells which reading is right
  if (live(asUnix) && !live(asIst)) { learn('feedShiftSec', 0); return asUnix }
  if (live(asIst) && !live(asUnix)) { learn('feedShiftSec', IST_SEC); return asIst }
  if (learned.feedShiftSec !== null) return (ltt - learned.feedShiftSec) * 1000
  // An old trade (the snapshot sent on subscribe) before any live one: the reading in market hours
  if (asUnix <= nowMs + 60_000 && inSession(asUnix, exchange)) return asUnix
  if (inSession(asIst, exchange)) return asIst
  return asUnix
}

// ---------------------------------------------------------------------------------------

/** Maps a Dhan error answer to the codes the backfill queue understands */
export function dhanError(status: number, body: any): Error {
  const code = String(body?.errorCode || body?.remarks?.error_code || body?.data?.errorCode || body?.error_code || '')
  const message = String(body?.errorMessage || body?.remarks?.error_message || body?.data?.errorMessage || body?.message || `HTTP ${status}`)
  if (status === 429 || code === 'DH-904' || code === '805') {
    return Object.assign(new Error(`429 request limit reached: ${message}`), { code: 429 })
  }
  if (status === 401 || ['DH-901', '807', '808', '809', '810'].includes(code)) {
    return Object.assign(new Error(`Auth Error: ${message}`), { code: -16 })
  }
  if (code === 'DH-902' || code === '806') {
    return Object.assign(new Error(`Dhan: ${message} — history and live data need Dhan's Data API plan`), { code: 806, fromApi: true })
  }
  return Object.assign(new Error(`Dhan API Error: ${code ? code + ' ' : ''}${message}`), { code: code || status || -1, fromApi: true })
}

/** Dhan's expiryTime ("2025-09-23T12:37:23", IST) → unix ms */
function istTimeMs(s: string | undefined): number | null {
  if (!s) return null
  const ms = Date.parse(`${s.slice(0, 19)}+05:30`)
  return Number.isFinite(ms) ? ms : null
}

export class DhanAdapter extends ListedBrokerAdapter {
  /** Dhan serves at most 90 days of intraday candles per request */
  readonly maxIntradayHistoryDays = 85
  protected readonly label = 'Dhan'
  protected readonly master = dhanMaster
  private accessToken = ''
  private clientId = ''
  private feed: DhanFeed | null = null
  /** "NSE_EQ|11536" (what feed packets carry) → record ref "NSE_EQ|11536|EQUITY" */
  private refByFeedKey = new Map<string, string>()

  /** Asks Dhan for a login session and returns the browser URL for it */
  static async loginUrl(clientId: string, apiKey: string, apiSecret: string): Promise<string> {
    if (!clientId) throw new Error('Dhan Client ID is missing. Remove the broker and add it again with your Client ID.')
    const res = await fetch(`${AUTH}/app/generate-consent?client_id=${encodeURIComponent(clientId)}`, {
      method: 'POST',
      headers: { app_id: apiKey, app_secret: apiSecret },
      signal: AbortSignal.timeout(20_000),
    })
    const body: any = await res.json().catch(() => null)
    if (!res.ok || !body?.consentAppId) {
      const reason = body?.errorMessage || body?.message || (res.status === 401 || res.status === 403 ? 'API Key or API Secret not accepted' : `HTTP ${res.status}`)
      throw new Error(`Dhan refused the login request: ${reason}. Check the Client ID, API Key and API Secret (web.dhan.co → Access DhanHQ APIs).`)
    }
    return `${AUTH}/login/consentApp-login?consentAppId=${encodeURIComponent(body.consentAppId)}`
  }

  private headers() {
    return { 'access-token': this.accessToken, 'client-id': this.clientId, 'Content-Type': 'application/json', Accept: 'application/json' }
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    const apiKey = (credentials.apiKey || '').trim()
    const apiSecret = (credentials.apiSecret || '').trim()
    let expiresAt: number | null = null

    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken
      expiresAt = jwtExpiryMs(this.accessToken)
      if (expiresAt !== null && expiresAt < Date.now() + 60_000) {
        throw Object.assign(new Error('Token expired — log in to Dhan again'), { code: 'TOKEN_EXPIRED' })
      }
    } else {
      if (!apiKey || !apiSecret || !credentials.requestToken) {
        throw new Error(`Dhan login missing parameters. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}, tokenId: ${!!credentials.requestToken}`)
      }
      const res = await fetch(`${AUTH}/app/consumeApp-consent?tokenId=${encodeURIComponent(credentials.requestToken)}`, {
        headers: { app_id: apiKey, app_secret: apiSecret },
        signal: AbortSignal.timeout(20_000),
      })
      const body: any = await res.json().catch(() => null)
      if (!res.ok || !body?.accessToken) {
        throw new Error(`Dhan login failed: ${body?.errorMessage || body?.message || `HTTP ${res.status}`}`)
      }
      this.accessToken = body.accessToken
      if (body.dhanClientId) credentials.clientId = String(body.dhanClientId)
      expiresAt = istTimeMs(body.expiryTime) ?? jwtExpiryMs(this.accessToken)
    }
    this.clientId = String(credentials.clientId || jwtPayload(this.accessToken).dhanClientId || '')
    if (!this.clientId) throw new Error('Dhan Client ID is missing. Remove the broker and add it again with your Client ID.')

    await this.checkProfile(!credentials.requestToken)
    this.startFeed()
    this.scheduleExpiry(expiresAt)
    dhanMaster.ensureLoaded().catch(err => console.error(`[Dhan] ${err?.message || err}`))
    return { accountId: this.clientId, accessToken: this.accessToken, expiresAt: expiresAt ?? undefined }
  }

  /** Token still accepted? Also warns when the Data API plan (history + live) isn't active. */
  private async checkProfile(savedToken: boolean) {
    try {
      const res = await fetch(`${API}/profile`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) })
      const body: any = await res.json().catch(() => null)
      if (!res.ok) {
        const err: any = dhanError(res.status, body)
        if (err.code === -16 && savedToken) throw Object.assign(new Error('Token expired — log in to Dhan again'), { code: 'TOKEN_EXPIRED' })
        throw err
      }
      const plan = String(body?.dataPlan ?? '')
      console.log(`[Dhan] Logged in as ${body?.dhanClientId || this.clientId}; Data API plan: ${plan || 'unknown'}${body?.dataValidity ? ` (valid till ${body.dataValidity})` : ''}`)
      if (plan && !/^active$/i.test(plan)) {
        console.warn('[Dhan] The Data API plan is not active: history downloads and live ticks will be refused until it is (web.dhan.co → DhanHQ Trading APIs)')
      }
    } catch (err: any) {
      if (err?.code === 'TOKEN_EXPIRED') throw err
      console.warn(`[Dhan] Could not check the token (${err?.message || err}); connecting anyway`)
    }
  }

  private startFeed() {
    this.feed?.disconnect()
    const feed = new DhanFeed(this.accessToken, this.clientId)
    this.feed = feed
    feed.on('packet', (p: DhanPacket) => this.onPacket(p))
    feed.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    feed.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    feed.on('auth_failed', () => this.emit('auth_failed'))
    feed.on('rejected', (drops: number) => this.onFeedRejected(drops))
    feed.connect()
    const refs = this.subscribedRefs()
    if (refs.length) feed.subscribe(refs.map(refToInstrument))
  }

  /** Dhan keeps dropping the feed right after it opens: a dead token, or no Data API plan */
  private async onFeedRejected(drops: number) {
    try {
      const res = await fetch(`${API}/profile`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) })
      const body: any = await res.json().catch(() => null)
      if (!res.ok && (dhanError(res.status, body) as any).code === -16) {
        console.error('[Dhan] Live feed refused: the access token is no longer valid')
        this.feed?.disconnect()
        this.emit('auth_failed')
        return
      }
      if (drops === 3) {
        console.warn('[Dhan] Dhan keeps closing the live feed right after connecting although the token is valid. Is the Data API plan active? (web.dhan.co → DhanHQ Trading APIs)')
      }
    } catch { /* offline: the feed keeps retrying */ }
  }

  private onPacket(p: DhanPacket) {
    if (p.ltp === undefined || (p.code !== 1 && p.code !== 2 && p.code !== 4 && p.code !== 8)) return
    const segment = SEGMENT_NAMES_BY_CODE[p.segment]
    if (!segment) return
    const ref = this.refByFeedKey.get(`${segment}|${p.securityId}`)
    if (!ref) return
    const exchange = segment === 'MCX_COMM' ? 'MCX' : 'NSE'
    this.emitTick(ref, {
      lastPrice: Math.round(p.ltp * 100) / 100,
      lastQty: p.ltq,
      totalVolume: p.volume,
      timestampMs: feedTimeMs(p.ltt, exchange),
      openInterest: p.oi,
    })
  }

  protected feedSubscribe(records: MasterRecord[]) {
    for (const r of records) this.refByFeedKey.set(r.ref.slice(0, r.ref.lastIndexOf('|')), r.ref)
    this.feed?.subscribe(records.map(r => refToInstrument(r.ref)))
  }

  protected feedUnsubscribe(refs: string[]) {
    for (const ref of refs) this.refByFeedKey.delete(ref.slice(0, ref.lastIndexOf('|')))
    this.feed?.unsubscribe(refs.map(refToInstrument))
  }

  async disconnect(): Promise<void> {
    this.clearExpiry()
    this.feed?.disconnect()
    this.feed = null
    this.emit('connection_state', 'DISCONNECTED')
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.accessToken) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)
    const [exchangeSegment, securityId, instrument] = rec.ref.split('|')
    const daily = interval === '1d' || interval === '1D'

    const body = daily
      ? { securityId, exchangeSegment, instrument, oi: false, fromDate: formatIstDateTime(from).slice(0, 10), toDate: formatIstDateTime(new Date(to.getTime() + DAY_MS)).slice(0, 10) }
      : { securityId, exchangeSegment, instrument, interval: String(parseInt(interval, 10) || 1), oi: false, fromDate: formatIstDateTime(from), toDate: formatIstDateTime(to) }

    await historyLimiter.acquire()
    const res = await fetch(`${API}/charts/${daily ? 'historical' : 'intraday'}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const data: any = await res.json().catch(() => null)
    if (!res.ok || !Array.isArray(data?.timestamp)) {
      const err: any = dhanError(res.status, data)
      if (err.code === 429) {
        historyLimiter.limited()
        console.warn(`[Dhan] Rate limit reached for ${instrumentToken}: pausing, now ${historyLimiter.perMinuteBudget} requests/min`)
      }
      // "No data present" for a range without trading is not an error
      if (err.code === 'DH-907' && /no data/i.test(err.message)) return []
      if (res.ok && data && !data.errorCode && !data.remarks) return [] // empty answer
      throw err
    }

    const ts: number[] = data.timestamp
    const offset = dhanEpochOffsetSec(ts, from.getTime(), to.getTime(), rec.exchange)
    const bars: Bar[] = []
    for (let i = 0; i < ts.length; i++) {
      bars.push({
        ts: (ts[i] + offset) * 1000,
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i],
        volume: Math.round(data.volume?.[i] || 0),
      })
    }
    return bars
  }
}

function refToInstrument(ref: string) {
  const [segment, securityId] = ref.split('|')
  return { segment, securityId }
}
