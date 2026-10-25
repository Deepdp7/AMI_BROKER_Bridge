/**
 * UpstoxFeed.ts — Upstox Market Data Feed V3.
 *
 * GET /v3/feed/market-data-feed/authorize (Bearer token) gives a one-time wss URL; a fresh
 * one is asked for on every reconnect. Subscriptions are JSON sent as binary frames,
 * {guid, method:"sub", data:{mode:"full", instrumentKeys:[…]}}; "full" carries the day
 * volume (ltpc mode doesn't). Messages are protobuf FeedResponse (MarketDataFeedV3.proto),
 * read here field by field for the few values used. Limits: 1500 keys in full mode per
 * connection, 2 connections per user.
 */
import WebSocket from 'ws'
import crypto from 'crypto'
import { EventEmitter } from 'events'

export interface UpstoxTick {
  key: string
  ltp: number
  /** Last trade time, unix ms */
  ltt?: number
  ltq?: number
  /** Volume traded today */
  vtt?: number
  oi?: number
}

export const UPSTOX_FULL_MODE_LIMIT = 1500

// ---------------------------------------------------------------------------------------
// Minimal protobuf reader: varints, 64-bit doubles and length-delimited fields
// ---------------------------------------------------------------------------------------

type PbValue = number | Buffer

/** Fields of one protobuf message: [field number, value]. Varints are numbers (safe up to
 *  2^53, enough for prices, volumes and ms times); 64-bit fields are their 8 raw bytes. */
export function pbFields(buf: Buffer): Array<[number, PbValue]> {
  const out: Array<[number, PbValue]> = []
  let pos = 0
  const varint = () => {
    let result = 0, mul = 1, b: number
    do {
      if (pos >= buf.length) throw new Error('truncated varint')
      b = buf[pos++]
      result += (b & 0x7f) * mul
      mul *= 128
    } while (b & 0x80)
    return result
  }
  while (pos < buf.length) {
    const tag = varint()
    const field = Math.floor(tag / 8), wire = tag & 7
    if (wire === 0) out.push([field, varint()])
    else if (wire === 1) { out.push([field, buf.subarray(pos, pos + 8)]); pos += 8 }
    else if (wire === 2) { const len = varint(); out.push([field, buf.subarray(pos, pos + len)]); pos += len }
    else if (wire === 5) { out.push([field, buf.subarray(pos, pos + 4)]); pos += 4 }
    else throw new Error(`unsupported protobuf wire type ${wire}`)
  }
  return out
}

const dbl = (v: PbValue) => (Buffer.isBuffer(v) && v.length === 8 ? v.readDoubleLE(0) : undefined)
const num = (v: PbValue) => (typeof v === 'number' ? v : undefined)
const msg = (v: PbValue) => (Buffer.isBuffer(v) ? v : Buffer.alloc(0))

/** LTPC {ltp=1 double, ltt=2 int64, ltq=3 int64, cp=4 double} into `t` */
function readLtpc(buf: Buffer, t: Partial<UpstoxTick>) {
  for (const [f, v] of pbFields(buf)) {
    if (f === 1) t.ltp = dbl(v)
    else if (f === 2) t.ltt = num(v)
    else if (f === 3) t.ltq = num(v)
  }
}

/** Feed {ltpc=1 | fullFeed=2 {marketFF=1 | indexFF=2} | firstLevelWithGreeks=3} */
function readFeed(buf: Buffer, t: Partial<UpstoxTick>) {
  for (const [f, v] of pbFields(buf)) {
    if (f === 1) readLtpc(msg(v), t)
    else if (f === 2) {
      for (const [ff, fv] of pbFields(msg(v))) {
        // marketFF: ltpc=1, vtt=6, oi=7 · indexFF: ltpc=1
        for (const [g, gv] of pbFields(msg(fv))) {
          if (g === 1) readLtpc(msg(gv), t)
          else if (ff === 1 && g === 6) t.vtt = num(gv)
          else if (ff === 1 && g === 7) t.oi = dbl(gv)
        }
      }
    } else if (f === 3) {
      // firstLevelWithGreeks: ltpc=1, vtt=4, oi=5
      for (const [g, gv] of pbFields(msg(v))) {
        if (g === 1) readLtpc(msg(gv), t)
        else if (g === 4) t.vtt = num(gv)
        else if (g === 5) t.oi = dbl(gv)
      }
    }
  }
}

/** FeedResponse {type=1, feeds=2 map<string, Feed>, currentTs=3} → ticks with a price */
export function decodeUpstoxFeed(buf: Buffer): { type: number; ticks: UpstoxTick[] } {
  let type = 0
  const ticks: UpstoxTick[] = []
  for (const [f, v] of pbFields(buf)) {
    if (f === 1) type = num(v) ?? 0
    else if (f === 2) {
      let key = ''
      const t: Partial<UpstoxTick> = {}
      for (const [ef, ev] of pbFields(msg(v))) {
        if (ef === 1) key = msg(ev).toString('utf8')
        else if (ef === 2) readFeed(msg(ev), t)
      }
      if (key && t.ltp && t.ltp > 0) ticks.push({ ...t, key, ltp: t.ltp })
    }
  }
  return { type, ticks }
}

// ---------------------------------------------------------------------------------------

export class UpstoxFeed extends EventEmitter {
  private ws: WebSocket | null = null
  private keys = new Set<string>()
  private stopped = false
  private connecting = false
  private attempts = 0
  private lastMessageAt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null

  constructor(private readonly accessToken: string) {
    super()
  }

  get isOpen() { return this.ws?.readyState === WebSocket.OPEN }

  async connect() {
    this.stopped = false
    if (this.connecting || this.ws) return
    this.connecting = true
    let url: string
    try {
      const res = await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize', {
        headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })
      const body: any = await res.json().catch(() => null)
      if (res.status === 401) {
        console.error('[UpstoxFeed] Feed refused: the access token is no longer valid')
        this.stopped = true
        this.emit('auth_failed')
        return
      }
      url = body?.data?.authorized_redirect_uri || body?.data?.authorizedRedirectUri
      if (!url) throw new Error(body?.errors?.[0]?.message || `HTTP ${res.status}`)
    } catch (err: any) {
      console.error(`[UpstoxFeed] Could not open the feed: ${err?.message || err}`)
      this.scheduleReconnect()
      return
    } finally {
      this.connecting = false
    }
    if (this.stopped) return

    const ws = new WebSocket(url, { followRedirects: true })
    this.ws = ws
    ws.on('open', () => {
      this.attempts = 0
      this.lastMessageAt = Date.now()
      console.log(`[UpstoxFeed] Connected (${this.keys.size} instruments)`)
      this.emit('connected')
      this.send('sub', [...this.keys])
      this.startWatchdog()
    })
    ws.on('message', (data: Buffer, isBinary: boolean) => {
      this.lastMessageAt = Date.now()
      if (!isBinary) return
      try {
        for (const t of decodeUpstoxFeed(data).ticks) this.emit('tick', t)
      } catch (err: any) {
        console.warn(`[UpstoxFeed] Unreadable message: ${err?.message || err}`)
      }
    })
    ws.on('ping', () => { this.lastMessageAt = Date.now() })
    ws.on('unexpected-response', (_req, res) => {
      console.error(`[UpstoxFeed] Connection refused: HTTP ${res.statusCode}`)
      ws.terminate()
    })
    ws.on('error', (err) => console.error(`[UpstoxFeed] Socket error: ${err?.message || err}`))
    ws.on('close', () => {
      this.stopWatchdog()
      if (this.ws === ws) this.ws = null
      this.emit('disconnected')
      if (!this.stopped) this.scheduleReconnect()
    })
  }

  disconnect() {
    this.stopped = true
    this.stopWatchdog()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.removeAllListeners()
      ws.on('error', () => {})
      try { ws.terminate() } catch { /* ignore */ }
    }
  }

  subscribe(keys: string[]) {
    const fresh: string[] = []
    for (const k of keys) {
      if (this.keys.has(k)) continue
      if (this.keys.size >= UPSTOX_FULL_MODE_LIMIT) {
        console.warn(`[UpstoxFeed] Upstox streams at most ${UPSTOX_FULL_MODE_LIMIT} instruments per connection; ${keys.length - keys.indexOf(k)} not streamed`)
        break
      }
      this.keys.add(k)
      fresh.push(k)
    }
    if (this.isOpen) this.send('sub', fresh)
    else this.connect()
  }

  unsubscribe(keys: string[]) {
    const gone = keys.filter(k => this.keys.delete(k))
    if (this.isOpen) this.send('unsub', gone)
  }

  private send(method: 'sub' | 'unsub', keys: string[]) {
    if (!this.ws || !this.isOpen || !keys.length) return
    for (let i = 0; i < keys.length; i += 500) {
      const data: any = { instrumentKeys: keys.slice(i, i + 500) }
      if (method === 'sub') data.mode = 'full'
      this.ws.send(Buffer.from(JSON.stringify({ guid: crypto.randomUUID().replace(/-/g, '').slice(0, 20), method, data })), { binary: true })
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return
    this.attempts++
    const delay = Math.min(2000 * Math.pow(1.5, this.attempts - 1), 60_000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /** Upstox pings every few seconds; a long silence means a dead connection */
  private startWatchdog() {
    this.stopWatchdog()
    this.watchdog = setInterval(() => {
      if (this.ws && Date.now() - this.lastMessageAt > 60_000) {
        console.warn('[UpstoxFeed] No data or ping for 60s, reconnecting')
        this.ws.terminate()
      }
    }, 15_000)
    this.watchdog.unref()
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
  }
}
