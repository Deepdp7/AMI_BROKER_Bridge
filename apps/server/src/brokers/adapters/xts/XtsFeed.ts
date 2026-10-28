/**
 * XtsFeed.ts — the live price socket of the XTS platform.
 *
 * XTS runs Socket.IO 2 (Engine.IO protocol 3: every XTS host answers the handshake with
 * '0{"sid":…,"pingInterval":20000,"pingTimeout":60000}' then '40'). Spoken directly over a
 * WebSocket here, which needs no Socket.IO library:
 *   wss://<host><md path>/socket.io/?token=…&userID=…&publishFormat=JSON&broadcastMode=Full&EIO=3&transport=websocket
 *   server → "0{…}" open, "40" connected, "42[event, data]" events, "3" pong
 *   client → "2" ping every pingInterval
 * Prices arrive as "1501-json-full" events whose data is a JSON string with ExchangeSegment,
 * ExchangeInstrumentID and Touchline {LastTradedPrice, LastTradedQunatity (sic),
 * TotalTradedQuantity, LastTradedTime, …}. Subscribing is a REST call, not a socket message
 * (XtsAdapter). Some hosts (/apibinarymarketdata) may send "xts-binary-packet" frames instead,
 * which aren't decoded: that is logged once and the account keeps working on history alone.
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface XtsTouchline {
  segment: number
  instrumentId: number
  lastPrice: number
  lastQty?: number
  totalVolume?: number
  /** Seconds since 1980-01-01 (XTS clock) */
  lastTradedTime?: number
  openInterest?: number
}

const SILENCE_MS = 90_000

/** Seconds from 1970 to 1980-01-01, the start of XTS clock values */
const XTS_EPOCH_SEC = 315_532_800

/**
 * An XTS time (seconds since 1980) as unix ms. The servers have sent both IST and UTC clock
 * values; the reading closest to now wins, and arrival time is used when neither is plausible.
 */
export function xtsTimeMs(sec: number | undefined, nowMs = Date.now()): number {
  if (!(Number(sec) > 0)) return nowMs
  const utc = (Number(sec) + XTS_EPOCH_SEC) * 1000
  const best = [utc - 19_800_000, utc].reduce((a, b) => (Math.abs(b - nowMs) < Math.abs(a - nowMs) ? b : a))
  return Math.abs(best - nowMs) < 6 * 3600_000 ? best : nowMs
}

/** One "1501-json-full" payload (a JSON string, or already an object) → a touchline */
export function parseXtsTouchline(data: unknown): XtsTouchline | null {
  let msg: any = data
  if (typeof data === 'string') {
    try { msg = JSON.parse(data) } catch { return null }
  }
  if (!msg || typeof msg !== 'object') return null
  const t = msg.Touchline && typeof msg.Touchline === 'object' ? msg.Touchline : msg
  const lastPrice = Number(t.LastTradedPrice)
  if (!(lastPrice > 0)) return null
  return {
    segment: Number(msg.ExchangeSegment),
    instrumentId: Number(msg.ExchangeInstrumentID),
    lastPrice,
    lastQty: Number(t.LastTradedQunatity ?? t.LastTradedQuantity) || undefined,
    totalVolume: Number(t.TotalTradedQuantity) || undefined,
    lastTradedTime: Number(t.LastTradedTime) || undefined,
    openInterest: Number(msg.OpenInterest ?? t.OpenInterest) || undefined,
  }
}

export class XtsFeed extends EventEmitter {
  private ws: WebSocket | null = null
  private stopped = false
  private attempts = 0
  private lastMessageAt = 0
  private ping: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private warnedBinary = false
  private open = false

  constructor(
    /** e.g. wss://xts.compositedge.com/apimarketdata/socket.io/ */
    private readonly socketUrl: string,
    private readonly token: string,
    private readonly userId: string,
    private readonly label: string,
  ) {
    super()
  }

  get isOpen() { return this.open }

  connect() {
    this.stopped = false
    if (this.ws) return
    const q = new URLSearchParams({ token: this.token, userID: this.userId, publishFormat: 'JSON', broadcastMode: 'Full', EIO: '3', transport: 'websocket' })
    const ws = new WebSocket(`${this.socketUrl}?${q}`)
    this.ws = ws

    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      this.lastMessageAt = Date.now()
      if (isBinary) { this.noteBinary(); return }
      this.onPacket(raw.toString('utf8'))
    })

    let refusedStatus = 0
    ws.on('unexpected-response', (_req, res) => {
      refusedStatus = res.statusCode || 0
      console.error(`[${this.label}Feed] Connection refused: HTTP ${refusedStatus}`)
      ws.terminate()
    })
    ws.on('error', err => { if (!refusedStatus) console.error(`[${this.label}Feed] Socket error: ${err?.message || err}`) })
    ws.on('close', () => {
      this.stopPing()
      const wasOpen = this.open
      this.open = false
      if (this.ws === ws) this.ws = null
      if (wasOpen) this.emit('disconnected')
      if (refusedStatus === 401 || refusedStatus === 403) {
        this.stopped = true
        this.emit('auth_failed')
        return
      }
      if (!this.stopped) this.scheduleReconnect()
    })
  }

  private onPacket(text: string) {
    const type = text[0]
    if (type === '0') {
      // Engine.IO open: start pinging at the server's interval
      let interval = 20_000
      try { interval = Number(JSON.parse(text.slice(1)).pingInterval) || interval } catch { /* default */ }
      this.startPing(interval)
    } else if (type === '4') {
      const sub = text[1]
      if (sub === '0') {
        // '40' arrives even for a refused token (a socketError follows within milliseconds),
        // so "connected" waits a moment for that
        setTimeout(() => {
          if (this.stopped || this.ws?.readyState !== WebSocket.OPEN) return
          this.open = true
          this.attempts = 0
          console.log(`[${this.label}Feed] Connected`)
          this.emit('connected')
        }, 1500)
      } else if (sub === '2') {
        this.onEvent(text.slice(2))
      } else if (sub === '5') {
        this.noteBinary() // binary event announcement
      } else if (sub === '1') {
        // The server ended the session (it follows a socketError)
        this.ws?.close()
      } else if (sub === '4') {
        // Socket.IO error packet: the token was refused
        console.error(`[${this.label}Feed] Refused: ${text.slice(2)}`)
        this.stopped = true
        this.emit('auth_failed')
        this.ws?.close()
      }
    }
    // '3' pong and anything else: nothing to do (lastMessageAt was updated)
  }

  private onEvent(body: string) {
    let arr: any
    try { arr = JSON.parse(body) } catch { return }
    if (!Array.isArray(arr)) return
    const [event, data] = arr
    if (event === '1501-json-full' || event === '1501-json-partial' || event === '1512-json-full') {
      const t = parseXtsTouchline(data)
      if (t) this.emit('touchline', t)
    } else if (event === 'xts-binary-packet') {
      this.noteBinary()
    } else if (event === 'socketError' || event === 'logout') {
      // A refused token: '40' (connected) comes first, then
      // 42["socketError","{\"code\":\"e-socket-0004\",\"description\":\"Your session has been expired\"}"], then '41'
      let description = ''
      try { description = typeof data === 'string' ? JSON.parse(data).description : data?.description } catch { description = String(data) }
      console.error(`[${this.label}Feed] Refused: ${description || event}`)
      this.stopped = true
      this.open = false
      this.emit('auth_failed')
      this.ws?.close()
    }
  }

  private noteBinary() {
    if (this.warnedBinary) return
    this.warnedBinary = true
    console.warn(`[${this.label}Feed] This server sends live prices in XTS binary form, which DataBridge Pro doesn't read yet: history downloads work, live ticks from ${this.label} don't`)
  }

  disconnect() {
    this.stopped = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const ws = this.ws
    this.ws = null
    this.open = false
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
  }

  private startPing(intervalMs: number) {
    this.stopPing()
    this.ping = setInterval(() => {
      if (!this.ws) return
      if (Date.now() - this.lastMessageAt > SILENCE_MS) {
        console.warn(`[${this.label}Feed] Nothing received for ${SILENCE_MS / 1000}s, reconnecting`)
        this.ws.terminate()
        return
      }
      try { this.ws.send('2') } catch { /* closing */ }
    }, intervalMs)
    this.ping.unref()
  }

  private stopPing() {
    if (this.ping) clearInterval(this.ping)
    this.ping = null
  }
}
