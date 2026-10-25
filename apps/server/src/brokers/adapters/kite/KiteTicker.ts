/**
 * KiteTicker.ts — Zerodha Kite Connect live feed (wss://ws.kite.trade).
 *
 * Binary frames, big-endian: int16 packet count, then per packet an int16 length and the
 * packet. Packet size tells the mode: 8 = LTP, 28/32 = index quote/full, 44 = quote,
 * 184 = full (adds last-trade / exchange timestamps, OI and depth). Instruments are
 * subscribed in "full" mode for the exchange timestamp. A 1-byte frame is a heartbeat.
 * Limits: 3000 instruments per connection, 3 connections per API key.
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface KitePacket {
  token: number
  lastPrice: number
  lastQty?: number
  /** Volume traded today (cumulative) */
  volume?: number
  open?: number
  high?: number
  low?: number
  close?: number
  oi?: number
  /** Exchange timestamp, unix seconds (full mode only) */
  exchangeTs?: number
  lastTradeTs?: number
}

export const KITE_MAX_INSTRUMENTS = 3000

const SEGMENT_CDS = 3
const SEGMENT_BCD = 6
const SEGMENT_INDICES = 9

function priceDivisor(token: number): number {
  const segment = token & 0xff
  if (segment === SEGMENT_CDS) return 10_000_000
  if (segment === SEGMENT_BCD) return 10_000
  return 100
}

/** Parses one binary frame into packets. Heartbeats (1 byte) and short frames give []. */
export function parseKiteFrame(buf: Buffer): KitePacket[] {
  if (buf.length < 4) return []
  const packets: KitePacket[] = []
  const count = buf.readUInt16BE(0)
  let off = 2
  for (let i = 0; i < count && off + 2 <= buf.length; i++) {
    const len = buf.readUInt16BE(off)
    off += 2
    if (off + len > buf.length) break
    const p = parseKitePacket(buf.subarray(off, off + len))
    if (p) packets.push(p)
    off += len
  }
  return packets
}

export function parseKitePacket(p: Buffer): KitePacket | null {
  if (p.length < 8) return null
  const token = p.readUInt32BE(0)
  const div = priceDivisor(token)
  const price = (o: number) => p.readInt32BE(o) / div
  const out: KitePacket = { token, lastPrice: price(4) }
  if (p.length === 8) return out

  if ((token & 0xff) === SEGMENT_INDICES) {
    if (p.length >= 28) {
      out.high = price(8)
      out.low = price(12)
      out.open = price(16)
      out.close = price(20)
    }
    if (p.length >= 32) out.exchangeTs = p.readUInt32BE(28) || undefined
    return out
  }

  if (p.length >= 44) {
    out.lastQty = p.readUInt32BE(8)
    out.volume = p.readUInt32BE(16)
    out.open = price(28)
    out.high = price(32)
    out.low = price(36)
    out.close = price(40)
  }
  if (p.length >= 64) {
    out.lastTradeTs = p.readUInt32BE(44) || undefined
    out.oi = p.readUInt32BE(48)
    out.exchangeTs = p.readUInt32BE(60) || undefined
  }
  return out
}

export class KiteTicker extends EventEmitter {
  private ws: WebSocket | null = null
  private tokens = new Set<number>()
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private attempts = 0
  private lastMessageAt = 0
  private stopped = false

  constructor(private readonly apiKey: string, private readonly accessToken: string) {
    super()
  }

  get isOpen() { return this.ws?.readyState === WebSocket.OPEN }

  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const url = `wss://ws.kite.trade?api_key=${encodeURIComponent(this.apiKey)}&access_token=${encodeURIComponent(this.accessToken)}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.on('open', () => {
      this.attempts = 0
      this.lastMessageAt = Date.now()
      console.log(`[KiteTicker] Connected (${this.tokens.size} instruments)`)
      this.emit('connected')
      this.send([...this.tokens], 'subscribe')
      this.startWatchdog()
    })

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      this.lastMessageAt = Date.now()
      if (isBinary) {
        for (const p of parseKiteFrame(data)) this.emit('packet', p)
        return
      }
      try {
        const msg = JSON.parse(data.toString('utf8'))
        if (msg?.type === 'error') console.error(`[KiteTicker] Error from Kite: ${msg.data}`)
        else if (msg?.type === 'message') console.log(`[KiteTicker] Kite: ${msg.data}`)
      } catch { /* not JSON */ }
    })

    // Kite refuses the upgrade with 403 when the access token is invalid or expired (400 when
    // it is malformed); retrying can't fix either
    let refusedStatus = 0
    ws.on('unexpected-response', (_req, res) => {
      refusedStatus = res.statusCode || 0
      console.error(`[KiteTicker] Connection refused: HTTP ${refusedStatus}`)
      ws.terminate() // aborts the handshake; 'close' follows
    })

    ws.on('error', (err) => {
      if (!refusedStatus) console.error(`[KiteTicker] Socket error: ${err?.message || err}`)
    })

    ws.on('close', () => {
      this.stopWatchdog()
      if (this.ws === ws) this.ws = null
      this.emit('disconnected')
      if (refusedStatus === 400 || refusedStatus === 401 || refusedStatus === 403) {
        this.stopped = true
        this.emit('auth_failed')
        return
      }
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
      ws.on('error', () => {}) // closing mid-handshake emits an error
      try { ws.terminate() } catch { /* ignore */ }
    }
  }

  subscribe(tokens: number[]) {
    const fresh = tokens.filter(t => !this.tokens.has(t))
    for (const t of fresh) {
      if (this.tokens.size >= KITE_MAX_INSTRUMENTS) {
        console.warn(`[KiteTicker] Kite streams at most ${KITE_MAX_INSTRUMENTS} instruments per connection; ${fresh.length - fresh.indexOf(t)} not streamed`)
        break
      }
      this.tokens.add(t)
    }
    if (this.isOpen) this.send(fresh.filter(t => this.tokens.has(t)), 'subscribe')
    else this.connect()
  }

  unsubscribe(tokens: number[]) {
    const gone = tokens.filter(t => this.tokens.delete(t))
    if (this.isOpen && gone.length) this.send(gone, 'unsubscribe')
  }

  private send(tokens: number[], action: 'subscribe' | 'unsubscribe') {
    if (!this.ws || !this.isOpen || tokens.length === 0) return
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500)
      this.ws.send(JSON.stringify({ a: action, v: batch }))
      if (action === 'subscribe') this.ws.send(JSON.stringify({ a: 'mode', v: ['full', batch] }))
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

  /** Kite sends a heartbeat every few seconds; silence means a dead connection */
  private startWatchdog() {
    this.stopWatchdog()
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastMessageAt > 30_000 && this.ws) {
        console.warn('[KiteTicker] No data or heartbeat for 30s, reconnecting')
        this.ws.terminate()
      }
    }, 10_000)
    this.watchdog.unref()
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
  }
}
