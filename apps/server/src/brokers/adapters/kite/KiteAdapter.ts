/**
 * KiteAdapter.ts — Zerodha Kite Connect v3.
 *
 * Login: browser → kite.zerodha.com/connect/login → redirect with request_token →
 * POST /session/token (checksum = sha256(api_key + request_token + api_secret)).
 * Access tokens die at 06:00 IST the next day (or on logout from Kite web).
 *
 * History: GET /instruments/historical/{token}/minute, at most 60 days of 1-minute candles
 * per request, 3 requests/second. Needs the paid Kite Connect plan (the free "Personal"
 * plan has no market data). Live: KiteTicker (wss://ws.kite.trade), full mode.
 */
import crypto from 'crypto'
import type { BrokerCredentials, SessionInfo, Bar } from '../IBrokerAdapter'
import { RateLimiter } from '../../../lib/RateLimiter'
import { InstrumentMaster, splitCsvLine, type MasterRecord, type InstrumentCategory } from '../InstrumentMaster'
import { ListedBrokerAdapter } from '../ListedBrokerAdapter'
import { KiteTicker, type KitePacket } from './KiteTicker'
import { INDEX_UNDERLYINGS, indexKey, indexName, formatIstDateTime, next0600IstMs } from '../symbolKey'

const API = 'https://api.kite.trade'

// Kite Connect historical candles: 3 requests/second (no per-minute figure published).
// Shared by every caller: backfill workers, auto-refresh, startup fetches.
const historyLimiter = new RateLimiter(3, 170)

/** Kite's instruments dump (public, no login needed) reduced to NSE/BSE cash, indices, NFO and MCX */
export function parseKiteInstruments(csv: string): MasterRecord[] {
  const lines = csv.split('\n')
  const header = splitCsvLine(lines[0].trim())
  const col = (name: string) => header.indexOf(name)
  const iToken = col('instrument_token'), iSym = col('tradingsymbol'), iName = col('name'), iExpiry = col('expiry')
  const iTick = col('tick_size'), iLot = col('lot_size'), iType = col('instrument_type'), iSeg = col('segment'), iExch = col('exchange')
  const out: MasterRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const p = splitCsvLine(line)
    const segment = p[iSeg], exchange = p[iExch], sym = p[iSym]
    const name = p[iName] || sym
    const base = { name, lot: Number(p[iLot]) || 1, tick: Number(p[iTick]) || 0.05, expiry: p[iExpiry] || '', ref: p[iToken] }
    const isIndexUnderlying = INDEX_UNDERLYINGS.has(name)
    let cat: InstrumentCategory

    if (segment === 'NSE' || segment === 'BSE') {
      if (p[iType] !== 'EQ') continue
      out.push({ ...base, key: `${exchange}:${sym}`, ticker: sym, exchange, cat: 'EQ' })
    } else if (segment === 'INDICES') {
      if (exchange !== 'NSE' && exchange !== 'BSE') continue
      out.push({ ...base, key: indexKey(exchange, sym), ticker: indexName(sym), exchange, cat: 'INDEX', lot: 1, tick: 0.05 })
    } else if (segment === 'NFO-FUT' || segment === 'MCX-FUT') {
      cat = isIndexUnderlying ? 'FUTIDX' : exchange === 'MCX' ? 'FUTCOM' : 'FUTSTK'
      out.push({ ...base, key: `${exchange}:${sym}`, ticker: sym, exchange, cat })
    } else if (segment === 'NFO-OPT' || segment === 'MCX-OPT') {
      cat = isIndexUnderlying ? 'OPTIDX' : exchange === 'MCX' ? 'OPTFUT' : 'OPTSTK'
      out.push({ ...base, key: `${exchange}:${sym}`, ticker: sym, exchange, cat })
    }
  }
  return out
}

async function downloadKiteInstruments(): Promise<MasterRecord[]> {
  const res = await fetch(`${API}/instruments`, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return parseKiteInstruments(await res.text())
}

/** One instrument list for every Kite account */
export const kiteMaster = new InstrumentMaster('kite', downloadKiteInstruments)

/** "2017-12-15T09:15:00+0530" → ms (the offset has no colon, which Date.parse doesn't promise to read) */
export function parseKiteTime(s: string): number {
  return Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
}

/** Maps a Kite error answer to the codes the backfill queue understands */
export function kiteError(status: number, body: any): Error {
  const type = String(body?.error_type || '')
  const message = String(body?.message || `HTTP ${status}`)
  if (status === 429 || /too many requests/i.test(message)) {
    return Object.assign(new Error(`429 request limit reached: ${message}`), { code: 429 })
  }
  if (type === 'TokenException' || (status === 403 && type !== 'PermissionException')) {
    return Object.assign(new Error(`Auth Error: ${message}`), { code: -16 })
  }
  if (type === 'PermissionException') {
    return Object.assign(new Error(`Kite: ${message} — historical and live data need an active Kite Connect subscription`), { code: status, fromApi: true })
  }
  return Object.assign(new Error(`Kite API Error: ${message}`), { code: status || -1, fromApi: true })
}

function kiteInterval(interval: string): string {
  if (interval === '1d' || interval === '1D') return 'day'
  const minutes = parseInt(interval, 10) || 1
  return minutes === 1 ? 'minute' : `${minutes}minute`
}

export class KiteAdapter extends ListedBrokerAdapter {
  /** Kite serves at most 60 days of 1-minute candles per request */
  readonly maxIntradayHistoryDays = 55
  /** History requests per minute allowed right now (the download queue picks the fastest broker) */
  historyRequestsPerMinute() { return historyLimiter.perMinuteBudget }
  protected readonly label = 'Kite'
  protected readonly master = kiteMaster
  private apiKey = ''
  private accessToken = ''
  private ticker: KiteTicker | null = null

  static loginUrl(apiKey: string, brokerId: string): string {
    // redirect_params come back on the redirect: they carry the account id like Fyers' `state`
    return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}&redirect_params=${encodeURIComponent(`state=${brokerId}`)}`
  }

  private headers() {
    return { 'X-Kite-Version': '3', Authorization: `token ${this.apiKey}:${this.accessToken}` }
  }

  private async get(pathAndQuery: string): Promise<any> {
    const res = await fetch(`${API}${pathAndQuery}`, { headers: this.headers(), signal: AbortSignal.timeout(30_000) })
    const body: any = await res.json().catch(() => null)
    if (res.ok && body?.status === 'success') return body.data
    throw kiteError(res.status, body)
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    this.apiKey = (credentials.apiKey || '').trim()
    const apiSecret = (credentials.apiSecret || '').trim()
    let accountId = credentials.clientId || ''

    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken
      // Kite tokens die at 06:00 IST or on a logout from Kite web: check with Kite before
      // streaming. Offline is not "expired" — the stream keeps retrying.
      try {
        accountId = (await this.get('/user/profile'))?.user_id || accountId
      } catch (err: any) {
        if (err?.code === -16) {
          throw Object.assign(new Error('Token expired — log in to Kite again'), { code: 'TOKEN_EXPIRED' })
        }
        console.warn(`[Kite] Could not check the saved token (${err?.message || err}); connecting anyway`)
      }
    } else {
      if (!this.apiKey || !apiSecret || !credentials.requestToken) {
        throw new Error(`Kite login missing parameters. API Key: ${!!this.apiKey}, API Secret: ${!!apiSecret}, request_token: ${!!credentials.requestToken}`)
      }
      const checksum = crypto.createHash('sha256').update(`${this.apiKey}${credentials.requestToken}${apiSecret}`).digest('hex')
      const res = await fetch(`${API}/session/token`, {
        method: 'POST',
        headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ api_key: this.apiKey, request_token: credentials.requestToken, checksum }),
        signal: AbortSignal.timeout(30_000),
      })
      const body: any = await res.json().catch(() => null)
      if (body?.status !== 'success' || !body.data?.access_token) {
        throw new Error(body?.message || `Kite login failed (HTTP ${res.status})`)
      }
      this.accessToken = body.data.access_token
      accountId = body.data.user_id || accountId
    }

    this.startTicker()
    this.scheduleExpiry(next0600IstMs())
    kiteMaster.ensureLoaded().catch(err => console.error(`[Kite] ${err?.message || err}`))
    return { accountId: accountId || 'KITE_USER', accessToken: this.accessToken, expiresAt: next0600IstMs() }
  }

  private startTicker() {
    this.ticker?.disconnect()
    const ticker = new KiteTicker(this.apiKey, this.accessToken)
    this.ticker = ticker
    ticker.on('packet', (p: KitePacket) => {
      const ts = p.exchangeTs || p.lastTradeTs
      this.emitTick(String(p.token), {
        lastPrice: p.lastPrice,
        lastQty: p.lastQty,
        totalVolume: p.volume,
        timestampMs: ts ? ts * 1000 : Date.now(),
        openInterest: p.oi,
      })
    })
    ticker.on('connected', () => this.emit('connection_state', 'CONNECTED'))
    ticker.on('disconnected', () => this.emit('connection_state', 'DISCONNECTED'))
    ticker.on('auth_failed', () => this.emit('auth_failed'))
    ticker.connect()
    const refs = this.subscribedRefs()
    if (refs.length) ticker.subscribe(refs.map(Number))
  }

  async disconnect(): Promise<void> {
    this.clearExpiry()
    this.ticker?.disconnect()
    this.ticker = null
    this.emit('connection_state', 'DISCONNECTED')
  }

  protected feedSubscribe(records: MasterRecord[]) {
    this.ticker?.subscribe(records.map(r => Number(r.ref)))
  }

  protected feedUnsubscribe(refs: string[]) {
    this.ticker?.unsubscribe(refs.map(Number))
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.accessToken) return []
    const rec = await this.lookup(instrumentToken)
    if (!rec) throw this.unknownSymbol(instrumentToken)

    const qs = `from=${encodeURIComponent(formatIstDateTime(from))}&to=${encodeURIComponent(formatIstDateTime(to))}`
    await historyLimiter.acquire()
    let data: any
    try {
      data = await this.get(`/instruments/historical/${rec.ref}/${kiteInterval(interval)}?${qs}`)
    } catch (err: any) {
      if (err?.code === 429) {
        historyLimiter.limited()
        console.warn(`[Kite] Rate limit reached for ${instrumentToken}: pausing, now ${historyLimiter.perMinuteBudget} requests/min`)
      }
      throw err
    }
    return ((data?.candles || []) as any[]).map(c => ({
      ts: parseKiteTime(c[0]),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5] || 0,
    })).filter(b => Number.isFinite(b.ts))
  }
}
