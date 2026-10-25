/**
 * AngelFeed.ts — Angel One SmartAPI WebSocket 2.0 (wss://smartapisocket.angelone.in/smart-stream).
 *
 * Headers Authorization (the JWT), x-api-key, x-client-code, x-feed-token. Subscriptions are
 * JSON {correlationID, action: 1 (0 = unsubscribe), params: {mode, tokenList: [{exchangeType,
 * tokens}]}}; mode 2 ("quote") carries the day volume. "ping" text every 30 s keeps it open.
 * Packets are little-endian binary, one per frame: mode u8, exchange type u8, token (25 bytes,
 * NUL-padded), sequence i64, exchange time i64 (ms), last price i64 (paise); quote mode adds
 * last qty, average price, day volume (i64 each). Limit: 1000 tokens per connection.
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export const ANGEL_EXCHANGE_TYPES: Record<string, number> = { NSE: 1, NFO: 2, BSE: 3, BFO: 4, MCX: 5 }
export const ANGEL_MAX_TOKENS = 1000
const QUOTE_MODE = 2

export interface AngelPacket {
  mode: number
  exchangeType: number
  token: string
  exchangeTimeMs: number
  /** Rupees */
  ltp: number
  ltq?: number
  volume?: number
}

/** One binary packet, or null for anything shorter than an LTP packet */
export function parseAngelPacket(buf: Buffer): AngelPacket | null {
  if (buf.length < 51) return null
  const end = buf.indexOf(0, 2)
  const p: AngelPacket = {
    mode: buf.readUInt8(0),
    exchangeType: buf.readUInt8(1),
    token: buf.subarray(2, end >= 2 && end < 27 ? end : 27).toString('ascii'),
    exchangeTimeMs: Number(buf.readBigInt64LE(35)),
    ltp: Number(buf.readBigInt64LE(43)) / 100,
  }
  if (p.mode >= QUOTE_MODE && buf.length >= 75) {
    p.ltq = Number(buf.readBigInt64LE(51))
    p.volume = Number(buf.readBigInt64LE(67))
  }
  return p
}

export interface AngelFeedAuth {
  jwt: string
  apiKey: string
  clientCode: string
  feedToken: string
}

export class AngelFeed extends EventEmitter {
  private ws: WebSocket | null = null
  /** "NSE|2885" feed keys */
  private keys = new Set<string>()
  private stopped = false
  private attempts = 0
  private lastMessageAt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeat: NodeJS.Timeout | null = null

  constructor(private readonly auth: AngelFeedAuth) {
    super()
  }

  get isOpen() { return this.ws?.readyState === WebSocket.OPEN }

  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const ws = new WebSocket('wss://smartapisocket.angelone.in/smart-stream', {
      headers: {
        Authorization: this.auth.jwt,
        'x-api-key': this.auth.apiKey,
        'x-client-code': this.auth.clientCode,
        'x-feed-token': this.auth.feedToken,
      },
    })
    this.ws = ws

    ws.on('open', () => {
      this.attempts = 0
      this.lastMessageAt = Date.now()
      console.log(`[AngelFeed] Connected (${this.keys.size} instruments)`)
      this.emit('connected')
      this.send(1, [...this.keys])
      this.startHeartbeat()
    })

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      this.lastMessageAt = Date.now()
      if (!isBinary) {
        const text = data.toString('utf8')
        if (text !== 'pong') console.warn(`[AngelFeed] Angel: ${text.slice(0, 200)}`)
        return
      }
      const p = parseAngelPacket(data)
      if (p) this.emit('packet', p)
    })

    let refusedStatus = 0
    ws.on('unexpected-response', (_req, res) => {
      refusedStatus = res.statusCode || 0
      console.error(`[AngelFeed] Connection refused: HTTP ${refusedStatus}`)
      ws.terminate()
    })
    ws.on('error', (err) => { if (!refusedStatus) console.error(`[AngelFeed] Socket error: ${err?.message || err}`) })
    ws.on('close', () => {
      this.stopHeartbeat()
      if (this.ws === ws) this.ws = null
      this.emit('disconnected')
      if (refusedStatus === 401 || refusedStatus === 403) {
        this.stopped = true
        this.emit('auth_failed')
        return
      }
      if (!this.stopped) this.scheduleReconnect()
    })
  }

  disconnect() {
    this.stopped = true
    this.stopHeartbeat()
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
      if (this.keys.size >= ANGEL_MAX_TOKENS) {
        console.warn(`[AngelFeed] Angel streams at most ${ANGEL_MAX_TOKENS} instruments per connection; ${keys.length - keys.indexOf(k)} not streamed`)
        break
      }
      this.keys.add(k)
      fresh.push(k)
    }
    if (this.isOpen) this.send(1, fresh)
    else this.connect()
  }

  unsubscribe(keys: string[]) {
    const gone = keys.filter(k => this.keys.delete(k))
    if (this.isOpen) this.send(0, gone)
  }

  private send(action: 0 | 1, keys: string[]) {
    if (!this.ws || !this.isOpen || !keys.length) return
    const byType = new Map<number, string[]>()
    for (const k of keys) {
      const [exch, token] = k.split('|')
      const type = ANGEL_EXCHANGE_TYPES[exch]
      if (!type || !token) continue
      const list = byType.get(type)
      if (list) list.push(token); else byType.set(type, [token])
    }
    if (!byType.size) return
    this.ws.send(JSON.stringify({
      correlationID: `db${Date.now().toString(36)}`.slice(0, 10),
      action,
      params: { mode: QUOTE_MODE, tokenList: [...byType].map(([exchangeType, tokens]) => ({ exchangeType, tokens })) },
    }))
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

  /** "ping" every 25 s; Angel answers "pong", so a long silence means a dead connection */
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => {
      if (!this.ws) return
      if (Date.now() - this.lastMessageAt > 70_000) {
        console.warn('[AngelFeed] No data or pong for 70s, reconnecting')
        this.ws.terminate()
        return
      }
      try { this.ws.send('ping') } catch { /* closing */ }
    }, 25_000)
    this.heartbeat.unref()
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
  }
}
