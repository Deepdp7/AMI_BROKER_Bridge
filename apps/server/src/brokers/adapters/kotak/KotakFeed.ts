/**
 * KotakFeed.ts — Kotak Neo's live price socket ("SFeed", wire format native_batch).
 *
 * Layout checked against Kotak's own SDK (kotak-neo-python, neo_api_client/websocket/feed/protocol.py)
 * and OpenAlgo's working decoder:
 *   - the host depends on the account's data centre, looked up in Kotak's public config service
 *     (kotakFeedUrl); the default is wss://sfeed.kotaksecurities.com/apifeed
 *   - text frame out, right after connecting: {user: <ucc>, auth: <session sid>, format: "native_batch",
 *     source: "NEOTRADEAPI", …}; the answer (message_code 1117 / 1119) carries each exchange's price
 *     divider ({exchanges: {nse_cm: {value: 1, divider: 100}, …}}). Prices are integers; nothing
 *     can be read before this answer
 *   - subscribe: {event: "subscribeScrips" | "subscribeIndices", inputtoken: "nse_cm|2885,nse_fo|61697",
 *     ack_symbol: true}. Indices go by Kotak's name ("nse_cm|Nifty 50"), not by token
 *   - binary frames carry several packets, each with a uint16 length first, all little-endian:
 *     9-byte header (length u16, code u16, exchange i8, level u8, auction u8, seq u8, bitmask u8)
 *     then the body: level 1 mini touchline, levels 2/4/8/16 market picture (the 135-byte fixed
 *     part is read here, depth rows are ignored), code 7207 index
 *   - keep-alive is the WebSocket's own ping/pong; there is no application heartbeat
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export const DEFAULT_FEED_URL = 'wss://sfeed.kotaksecurities.com/apifeed'
const CONFIG_URL = 'https://lapi.kotaksecurities.com/5config/config?appVersion=1.0.0&platform=api&environment=prod'

const HEADER = 9
// Both arrive, one after the other, whatever the outcome; the verdict is a 1120 (refused) or silence (accepted)
const MSG_AUTH = new Set([1117, 1119])
const MSG_AUTH_FAILED = 1120
/** How long after the login answer a refusal (1120) may still arrive */
const GRACE_MS = 600
const MSG_INDEX = 7207
const MSG_MARKET_OPEN = 6511, MSG_MARKET_CLOSE = 6521, MSG_MARKET_STATUS = 105, MSG_CAS = 104, MSG_ACK = 1109

const EXCHANGE_IDS: Record<number, string> = { 1: 'nse_cm', 2: 'nse_fo', 3: 'cde_fo', 4: 'nse_com', 5: 'bse_cm', 6: 'bse_fo', 7: 'bse_cd', 8: 'bse_co', 9: 'mcx_fo', 10: 'ncd_co' }
const DEFAULT_DIVIDER = 100

export interface KotakTick {
  segment: string
  /** Instrument token as text (cash / F&O); '' for an index */
  token: string
  /** Kotak's index name ("Nifty 50"), for an index tick */
  indexName?: string
  lastPrice: number
  lastQty?: number
  totalVolume?: number
  openInterest?: number
}

/** The live-feed host for an account's data centre ("E43"), the default when it can't be told */
export async function kotakFeedUrl(dataCenter: string | undefined, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!dataCenter) return DEFAULT_FEED_URL
  try {
    const res = await fetchImpl(CONFIG_URL, { signal: AbortSignal.timeout(5000) })
    const configs = ((await res.json()) as any)?.data?.configs || {}
    const source = configs[`${dataCenter}_broadcast_source`]
    const endpoint = source && configs[`${dataCenter}_${source}_broadcast_endpoint`]
    // "hs" is Kotak's retired HSM feed, a different format that is not read here
    if (!endpoint || source === 'hs') return DEFAULT_FEED_URL
    const url = String(endpoint).trim()
    if (/^wss?:\/\//.test(url)) return url
    return url.replace(/^https?:\/\//, 'wss://').replace(/^(?!wss:\/\/)/, 'wss://')
  } catch {
    return DEFAULT_FEED_URL
  }
}

/** A frame split into its packets */
export function splitBatch(frame: Buffer): Buffer[] {
  const out: Buffer[] = []
  let offset = 0
  while (offset + 2 <= frame.length) {
    const size = frame.readUInt16LE(offset)
    // A cut-off or garbage tail ends the scan; the packets before it still count
    if (size < HEADER || offset + size > frame.length) break
    out.push(frame.subarray(offset, offset + size))
    offset += size
  }
  return out
}

const big = (v: bigint) => Number(v)

/** One packet → a tick, or null for control / empty packets. `dividers` is exchange id → price divider */
export function decodePacket(p: Buffer, dividers: Map<number, number>): KotakTick | null {
  if (p.length < HEADER) return null
  const code = p.readUInt16LE(2)
  const exchangeId = p.readInt8(4)
  const level = p.readUInt8(5)
  const segment = EXCHANGE_IDS[exchangeId] || String(exchangeId)
  const divider = dividers.get(exchangeId) || DEFAULT_DIVIDER

  if (code === MSG_MARKET_OPEN || code === MSG_MARKET_CLOSE || code === MSG_MARKET_STATUS || code === MSG_CAS) return null

  if (code === MSG_INDEX) {
    if (p.length < HEADER + 78) return null
    const index = p.readInt32LE(HEADER + 20)
    const nameBytes = p.subarray(HEADER + 57, HEADER + 78)
    const nul = nameBytes.indexOf(0)
    const indexName = nameBytes.subarray(0, nul < 0 ? nameBytes.length : nul).toString('utf8').trim()
    if (!(index > 0)) return null
    return { segment, token: String(p.readUInt32LE(HEADER)), indexName, lastPrice: index / divider }
  }

  if (level === 1) {
    // Mini touchline: token u32, last trade time i64, price u32, last qty i64, close u32, …
    if (p.length < HEADER + 24) return null
    const price = p.readUInt32LE(HEADER + 12)
    if (!(price > 0)) return null
    return { segment, token: String(p.readUInt32LE(HEADER)), lastPrice: price / divider, lastQty: big(p.readBigInt64LE(HEADER + 16)) || undefined }
  }

  if (level === 2 || level === 4 || level === 8 || level === 16) {
    // Market picture, fixed part: token u32, buy qty i64, sell qty i64, volume i64, last trade time i64,
    // last update time i64, open u32, close u32, high u32, low u32, price u32, last qty i64,
    // average price u32, indicative close u32, buy / sell depth counts u32 ×2, status i16, change % i32,
    // open interest u32 (at 94), …
    if (p.length < HEADER + 98) return null
    const price = p.readUInt32LE(HEADER + 60)
    if (!(price > 0)) return null
    return {
      segment,
      token: String(p.readUInt32LE(HEADER)),
      lastPrice: price / divider,
      lastQty: big(p.readBigInt64LE(HEADER + 64)) || undefined,
      totalVolume: big(p.readBigInt64LE(HEADER + 20)) || undefined,
      openInterest: p.readUInt32LE(HEADER + 94) || undefined,
    }
  }
  return null
}

/** Tokens Kotak knows an index by (the names the index subscription takes) */
export const KOTAK_INDEX_NAMES: Record<string, string> = {
  NIFTY50: 'Nifty 50', NIFTYBANK: 'Nifty Bank', FINNIFTY: 'Nifty Fin Service', MIDCPNIFTY: 'Nifty Mid Select',
  NIFTYNXT50: 'Nifty Next 50', INDIAVIX: 'India VIX', SENSEX: 'SENSEX', BANKEX: 'BANKEX',
}

const MAX_SUBSCRIPTIONS = 3000
const AUTH_TIMEOUT_MS = 15_000
const PING_MS = 20_000
const SILENCE_MS = 70_000

export class KotakFeed extends EventEmitter {
  private ws: WebSocket | null = null
  private stopped = false
  private attempts = 0
  private ready = false
  private dividers = new Map<number, number>()
  private reconnectTimer: NodeJS.Timeout | null = null
  private ping: NodeJS.Timeout | null = null
  private authTimer: NodeJS.Timeout | null = null
  private graceTimer: NodeJS.Timeout | null = null
  private lastSeenAt = 0
  /** "event:segment|token" for everything wanted live */
  private subscribed = new Set<string>()

  constructor(
    private readonly url: string,
    private readonly ucc: string,
    /** The session id from the MPIN step; the feed takes it as its credential */
    private readonly sid: string,
    private readonly label = 'Kotak',
  ) {
    super()
  }

  get isOpen() { return this.ready }

  connect() {
    this.stopped = false
    if (this.ws) return
    const ws = new WebSocket(this.url)
    this.ws = ws
    let refused = 0

    ws.on('open', () => {
      ws.send(JSON.stringify({
        user: this.ucc || 'neome', auth: this.sid || '1', format: 'native_batch', source: 'NEOTRADEAPI', platform: 'Web',
        version: '1.2.3', sdk_version: 2, sdk_date: '2026-08-07T09:41:17.667Z', conn_req_time: Date.now(), sessionValidation: false,
      }))
      this.lastSeenAt = Date.now()
      this.startPing()
      // A rejected login leaves the socket open and silent: turn that into a reconnect
      this.authTimer = setTimeout(() => {
        if (!this.ready && this.ws === ws) { console.error(`[${this.label}Feed] No answer to the login within ${AUTH_TIMEOUT_MS / 1000}s, reconnecting`); ws.terminate() }
      }, AUTH_TIMEOUT_MS)
      this.authTimer.unref()
    })
    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      this.lastSeenAt = Date.now()
      try {
        if (isBinary) this.onBinary(Buffer.isBuffer(raw) ? raw : Buffer.from(raw as any))
        else this.onText(raw.toString('utf8'))
      } catch (err: any) {
        console.error(`[${this.label}Feed] Could not read a message: ${err?.message || err}`)
      }
    })
    ws.on('pong', () => { this.lastSeenAt = Date.now() })
    ws.on('unexpected-response', (_req, res) => {
      refused = res.statusCode || 0
      console.error(`[${this.label}Feed] Connection refused: HTTP ${refused}`)
      ws.terminate()
    })
    ws.on('error', err => { if (!refused) console.error(`[${this.label}Feed] Socket error: ${err?.message || err}`) })
    ws.on('close', () => {
      this.clearTimers()
      const wasReady = this.ready
      this.ready = false
      this.dividers.clear()
      if (this.ws === ws) this.ws = null
      if (wasReady) this.emit('disconnected')
      if (refused === 401 || refused === 403) {
        this.stopped = true
        this.emit('auth_failed')
        return
      }
      if (!this.stopped) this.scheduleReconnect()
    })
  }

  private onText(text: string) {
    let data: any
    try { data = JSON.parse(text) } catch { return }
    if (!data || typeof data !== 'object') return
    const code = Number(data.message_code)
    if (MSG_AUTH.has(code)) {
      if (data.format === 'native_fallback') {
        console.error(`[${this.label}Feed] The server chose an older feed format, which isn't read here; live ticks are off (history still works)`)
        this.stopped = true
        this.ws?.close()
        return
      }
      for (const [name, info] of Object.entries<any>(data.exchanges || {})) {
        const id = Number(info?.value ?? Object.entries(EXCHANGE_IDS).find(([, n]) => n === name)?.[0])
        if (Number.isFinite(id)) this.dividers.set(id, Number(info?.divider) || DEFAULT_DIVIDER)
      }
      // A refused login gets these same two answers first and "Auth failed" (1120) right after,
      // so the connection counts as good once a moment has passed without that
      if (!this.ready && !this.graceTimer) {
        const ws = this.ws
        this.graceTimer = setTimeout(() => {
          this.graceTimer = null
          if (this.stopped || !ws || this.ws !== ws || ws.readyState !== WebSocket.OPEN) return
          this.ready = true
          this.attempts = 0
          if (this.authTimer) clearTimeout(this.authTimer)
          this.authTimer = null
          console.log(`[${this.label}Feed] Connected`)
          // Everything wanted so far (also after a reconnect: the server keeps nothing for a new socket)
          this.resubscribeAll()
          this.emit('connected')
        }, GRACE_MS)
        this.graceTimer.unref()
      }
    } else if (code === MSG_AUTH_FAILED) {
      console.error(`[${this.label}Feed] Login refused: ${String(data.message || '').replace(/\s+/g, ' ').slice(0, 120)}`)
      this.stopped = true
      this.emit('auth_failed')
      this.ws?.close()
    } else if (code === MSG_ACK) {
      // trading_symbols: not needed, ticks are matched by token
    }
  }

  private onBinary(frame: Buffer) {
    // Prices are integers scaled by a divider that arrives with the login answer: nothing before it can be read
    if (!this.ready) return
    for (const packet of splitBatch(frame)) {
      const tick = decodePacket(packet, this.dividers)
      if (tick) this.emit('tick', tick)
    }
  }

  /** Subscribes cash / F&O instruments ("nse_cm|2885") */
  subscribeScrips(refs: string[]) { this.subscribe('subscribeScrips', refs) }
  /** Subscribes indices by Kotak's name ("nse_cm|Nifty 50") */
  subscribeIndices(refs: string[]) { this.subscribe('subscribeIndices', refs) }
  unsubscribeScrips(refs: string[]) { this.unsubscribe('unsubscribeScrips', refs) }
  unsubscribeIndices(refs: string[]) { this.unsubscribe('unsubscribeIndices', refs) }

  private subscribe(event: string, refs: string[]) {
    const fresh = refs.filter(r => !this.subscribed.has(`${event}:${r}`))
    if (!fresh.length) return
    if (this.subscribed.size + fresh.length > MAX_SUBSCRIPTIONS) {
      console.error(`[${this.label}Feed] ${fresh.length} more instruments would pass Kotak's limit of ${MAX_SUBSCRIPTIONS} live symbols at once; not subscribed`)
      return
    }
    for (const r of fresh) this.subscribed.add(`${event}:${r}`)
    this.send({ event, inputtoken: fresh.join(','), ack_symbol: true })
  }

  private unsubscribe(event: string, refs: string[]) {
    const paired = event === 'unsubscribeScrips' ? 'subscribeScrips' : 'subscribeIndices'
    for (const r of refs) this.subscribed.delete(`${paired}:${r}`)
    this.send({ event, inputtoken: refs.join(',') })
  }

  /** Sends everything subscribed so far again (after a reconnect) */
  resubscribeAll() {
    for (const event of ['subscribeScrips', 'subscribeIndices']) {
      const refs = [...this.subscribed].filter(s => s.startsWith(`${event}:`)).map(s => s.slice(event.length + 1))
      for (let i = 0; i < refs.length; i += 500) this.send({ event, inputtoken: refs.slice(i, i + 500).join(','), ack_symbol: true })
    }
  }

  private send(frame: object) {
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(frame)) } catch { /* closing */ }
    }
    // Not connected: the subscription is remembered and sent when the socket is ready (resubscribeAll)
  }

  disconnect() {
    this.stopped = true
    this.clearTimers()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const ws = this.ws
    this.ws = null
    this.ready = false
    if (ws) {
      ws.removeAllListeners()
      ws.on('error', () => {})
      try { ws.terminate() } catch { /* ignore */ }
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return
    this.attempts++
    const delay = Math.min(2000 * Math.pow(1.5, this.attempts - 1), 60_000)
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect() }, delay)
    this.reconnectTimer.unref()
  }

  private startPing() {
    this.stopPing()
    this.ping = setInterval(() => {
      if (!this.ws) return
      if (Date.now() - this.lastSeenAt > SILENCE_MS) {
        console.warn(`[${this.label}Feed] Nothing received for ${SILENCE_MS / 1000}s, reconnecting`)
        this.ws.terminate()
        return
      }
      try { this.ws.ping() } catch { /* closing */ }
    }, PING_MS)
    this.ping.unref()
  }

  private stopPing() {
    if (this.ping) clearInterval(this.ping)
    this.ping = null
  }

  private clearTimers() {
    this.stopPing()
    if (this.graceTimer) clearTimeout(this.graceTimer)
    this.graceTimer = null
    if (this.authTimer) clearTimeout(this.authTimer)
    this.authTimer = null
  }
}
