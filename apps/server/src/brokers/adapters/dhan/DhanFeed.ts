/**
 * DhanFeed.ts — DhanHQ v2 live market feed (wss://api-feed.dhan.co).
 *
 * Requests are JSON (subscribe quote = RequestCode 17, at most 100 instruments per
 * message, 5000 per connection, 5 connections per user). Responses are binary,
 * little-endian, an 8-byte header — response code (u8), message length (i16), exchange
 * segment (u8), security id (i32) — then the packet:
 *   1 index / 2 ticker  LTP f32 @8, last trade time i32 @12
 *   4 quote             LTP @8, LTQ u16 @12, LTT @14, ATP @18, volume i32 @22,
 *                       sell qty @26, buy qty @30, open f32 @34, close @38, high @42, low @46
 *   5 OI                OI i32 @8
 *   6 prev close        prev close f32 @8, prev OI @12
 *   8 full              as quote up to @34, then OI @34, OI high @38, OI low @42,
 *                       open f32 @46, close @50, high @54, low @58, depth 5×20 bytes
 *   50 disconnect       reason i16 @8 (805 too many connections, 807-810 token / client id)
 * The server pings every 10 s (the ws library answers); 40 s without a pong ends the connection.
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

/** Exchange segment strings (requests, history API) ↔ codes (feed headers) */
export const DHAN_SEGMENT_CODES: Record<string, number> = {
  IDX_I: 0, NSE_EQ: 1, NSE_FNO: 2, NSE_CURRENCY: 3, BSE_EQ: 4, MCX_COMM: 5, BSE_CURRENCY: 7, BSE_FNO: 8,
}

export const DHAN_MAX_INSTRUMENTS = 5000
const AUTH_DISCONNECT_CODES = new Set([807, 808, 809, 810])

export interface DhanPacket {
  code: number
  segment: number
  securityId: number
  ltp?: number
  ltq?: number
  /** Last trade time, epoch seconds as Dhan sends it */
  ltt?: number
  volume?: number
  open?: number
  high?: number
  low?: number
  close?: number
  oi?: number
  prevClose?: number
  disconnectReason?: number
}

/** Fixed packet sizes by response code, for frames that carry several packets */
const PACKET_SIZE: Record<number, number> = { 1: 16, 2: 16, 4: 50, 5: 12, 6: 16, 8: 162, 50: 10 }

export function parseDhanFrame(buf: Buffer): DhanPacket[] {
  const out: DhanPacket[] = []
  let off = 0
  while (off + 8 <= buf.length) {
    const code = buf.readUInt8(off)
    const declared = buf.readUInt16LE(off + 1)
    const size = PACKET_SIZE[code] || declared
    if (!size || size < 8 || off + size > buf.length) {
      // Last (or only) packet shorter than its full layout: parse what is there
      const p = parseDhanPacket(buf.subarray(off))
      if (p) out.push(p)
      break
    }
    const p = parseDhanPacket(buf.subarray(off, off + size))
    if (p) out.push(p)
    off += size
  }
  return out
}

export function parseDhanPacket(b: Buffer): DhanPacket | null {
  if (b.length < 8) return null
  const p: DhanPacket = { code: b.readUInt8(0), segment: b.readUInt8(3), securityId: b.readInt32LE(4) }
  const has = (end: number) => b.length >= end
  switch (p.code) {
    case 1:
    case 2:
      if (has(12)) p.ltp = b.readFloatLE(8)
      if (has(16)) p.ltt = b.readInt32LE(12)
      break
    case 4:
    case 8:
      if (has(12)) p.ltp = b.readFloatLE(8)
      if (has(14)) p.ltq = b.readUInt16LE(12)
      if (has(18)) p.ltt = b.readInt32LE(14)
      if (has(26)) p.volume = b.readInt32LE(22)
      if (p.code === 4 && has(50)) {
        p.open = b.readFloatLE(34)
        p.close = b.readFloatLE(38)
        p.high = b.readFloatLE(42)
        p.low = b.readFloatLE(46)
      }
      if (p.code === 8 && has(62)) {
        p.oi = b.readInt32LE(34)
        p.open = b.readFloatLE(46)
        p.close = b.readFloatLE(50)
        p.high = b.readFloatLE(54)
        p.low = b.readFloatLE(58)
      }
      break
    case 5:
      if (has(12)) p.oi = b.readInt32LE(8)
      break
    case 6:
      if (has(12)) p.prevClose = b.readFloatLE(8)
      break
    case 50:
      if (has(10)) p.disconnectReason = b.readInt16LE(8)
      break
  }
  return p
}

export interface DhanInstrument { segment: string; securityId: string }

export class DhanFeed extends EventEmitter {
  private ws: WebSocket | null = null
  /** "NSE_EQ|11536" → instrument */
  private instruments = new Map<string, DhanInstrument>()
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private attempts = 0
  private lastMessageAt = 0
  private stopped = false
  /** Connections in a row Dhan dropped right after opening, before sending anything */
  private quickDrops = 0

  constructor(private readonly accessToken: string, private readonly clientId: string) {
    super()
  }

  get isOpen() { return this.ws?.readyState === WebSocket.OPEN }

  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const url = `wss://api-feed.dhan.co?version=2&token=${encodeURIComponent(this.accessToken)}&clientId=${encodeURIComponent(this.clientId)}&authType=2`
    const ws = new WebSocket(url)
    this.ws = ws
    let authRefused = false
    let openedAt = 0
    let heardBack = false

    ws.on('open', () => {
      this.attempts = 0
      openedAt = Date.now()
      this.lastMessageAt = Date.now()
      console.log(`[DhanFeed] Connected (${this.instruments.size} instruments)`)
      this.emit('connected')
      this.send([...this.instruments.values()], 17)
      this.startWatchdog()
    })

    ws.on('ping', () => {
      heardBack = true
      this.lastMessageAt = Date.now()
    })

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      heardBack = true
      this.lastMessageAt = Date.now()
      if (!isBinary) return
      for (const p of parseDhanFrame(data)) {
        if (p.code === 50) {
          console.error(`[DhanFeed] Disconnected by Dhan, reason ${p.disconnectReason}`)
          if (AUTH_DISCONNECT_CODES.has(p.disconnectReason || 0)) authRefused = true
          continue
        }
        this.emit('packet', p)
      }
    })

    ws.on('unexpected-response', (_req, res) => {
      const status = res.statusCode || 0
      console.error(`[DhanFeed] Connection refused: HTTP ${status}`)
      if (status === 401 || status === 403) authRefused = true
      ws.terminate() // aborts the handshake; 'close' follows
    })

    ws.on('error', (err) => {
      if (!authRefused) console.error(`[DhanFeed] Socket error: ${err?.message || err}`)
    })

    ws.on('close', () => {
      this.stopWatchdog()
      if (this.ws === ws) this.ws = null
      this.emit('disconnected')
      if (authRefused) {
        this.stopped = true
        this.emit('auth_failed')
        return
      }
      // Dhan drops a connection with a dead token (or no Data API plan) right after it opens,
      // without a word: after a few of those the adapter asks Dhan whether the token is good
      if (openedAt && !heardBack && Date.now() - openedAt < 15_000) {
        if (++this.quickDrops % 3 === 0) this.emit('rejected', this.quickDrops)
      } else if (heardBack) {
        this.quickDrops = 0
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
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ RequestCode: 12 }))
        ws.terminate()
      } catch { /* ignore */ }
    }
  }

  subscribe(list: DhanInstrument[]) {
    const fresh: DhanInstrument[] = []
    for (const inst of list) {
      const k = `${inst.segment}|${inst.securityId}`
      if (this.instruments.has(k)) continue
      if (this.instruments.size >= DHAN_MAX_INSTRUMENTS) {
        console.warn(`[DhanFeed] Dhan streams at most ${DHAN_MAX_INSTRUMENTS} instruments per connection; the rest are not streamed`)
        break
      }
      this.instruments.set(k, inst)
      fresh.push(inst)
    }
    if (this.isOpen) this.send(fresh, 17)
    else this.connect()
  }

  unsubscribe(list: DhanInstrument[]) {
    const gone = list.filter(i => this.instruments.delete(`${i.segment}|${i.securityId}`))
    if (this.isOpen && gone.length) this.send(gone, 18)
  }

  private send(list: DhanInstrument[], requestCode: 17 | 18) {
    if (!this.ws || !this.isOpen || list.length === 0) return
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100)
      this.ws.send(JSON.stringify({
        RequestCode: requestCode,
        InstrumentCount: batch.length,
        InstrumentList: batch.map(b => ({ ExchangeSegment: b.segment, SecurityId: b.securityId })),
      }))
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

  /** Dhan pings every 10 s; 45 s of silence means a dead connection */
  private startWatchdog() {
    this.stopWatchdog()
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastMessageAt > 45_000 && this.ws) {
        console.warn('[DhanFeed] No data or ping for 45s, reconnecting')
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
