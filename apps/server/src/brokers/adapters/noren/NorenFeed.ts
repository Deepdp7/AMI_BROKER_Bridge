/**
 * NorenFeed.ts — live feed of the Noren platform (Flattrade, Shoonya).
 *
 * JSON over WebSocket. After connecting, send {t:"a", uid, actid, source:"API", accesstoken}
 * and wait for {t:"ak", s:"OK"} ("Not_Ok" means the token or user id is wrong). Touchline
 * subscriptions are "NSE|22#NFO|35003"; the gateway answers each with a full snapshot
 * ("tk") and then sends only the changed fields ("tf"). It keeps nothing across a dropped
 * socket, so every subscription is sent again after a reconnect. {t:"h"} every 30 s keeps the
 * session alive; idle connections are dropped.
 */
import WebSocket from 'ws'
import { EventEmitter } from 'events'

/** One touchline message as sent ("tk" snapshot or "tf" update), fields are strings */
export interface NorenTouch {
  t: 'tk' | 'tf'
  e: string
  tk: string
  lp?: string
  v?: string
  ltq?: string
  ft?: string
  oi?: string
  [field: string]: string | undefined
}

const HEARTBEAT_MS = 30_000
const SILENCE_MS = 75_000
const BATCH = 100

export class NorenFeed extends EventEmitter {
  private ws: WebSocket | null = null
  private keys = new Set<string>()
  private authed = false
  private stopped = false
  private attempts = 0
  private lastMessageAt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeat: NodeJS.Timeout | null = null

  constructor(
    private readonly url: string,
    private readonly uid: string,
    private readonly accessToken: string,
    private readonly label: string,
  ) {
    super()
  }

  get isReady() { return this.authed && this.ws?.readyState === WebSocket.OPEN }

  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const ws = new WebSocket(this.url)
    this.ws = ws
    this.authed = false

    ws.on('open', () => {
      this.lastMessageAt = Date.now()
      ws.send(JSON.stringify({ t: 'a', uid: this.uid, actid: this.uid, source: 'API', accesstoken: this.accessToken }))
    })

    ws.on('message', (data: Buffer) => {
      this.lastMessageAt = Date.now()
      let msg: any
      try { msg = JSON.parse(data.toString('utf8')) } catch { return }
      switch (msg?.t) {
        case 'ak':
          if (String(msg.s || '').toLowerCase() === 'ok') {
            this.authed = true
            this.attempts = 0
            console.log(`[${this.label}Feed] Connected (${this.keys.size} instruments)`)
            this.emit('connected')
            this.send('t', [...this.keys])
            this.startHeartbeat()
          } else {
            console.error(`[${this.label}Feed] Login refused: ${msg.emsg || msg.s || 'Not_Ok'}`)
            this.stopped = true
            this.emit('auth_failed')
            ws.close()
          }
          break
        case 'tk':
        case 'tf':
          this.emit('touch', msg as NorenTouch)
          break
        default:
          // heartbeat acks ("h" / "hk"), unsubscribe acks ("uk")
          break
      }
    })

    let refusedStatus = 0
    ws.on('unexpected-response', (_req, res) => {
      refusedStatus = res.statusCode || 0
      console.error(`[${this.label}Feed] Connection refused: HTTP ${refusedStatus}`)
      ws.terminate()
    })

    ws.on('error', (err) => {
      if (!refusedStatus) console.error(`[${this.label}Feed] Socket error: ${err?.message || err}`)
    })

    ws.on('close', () => {
      this.stopHeartbeat()
      const wasAuthed = this.authed
      this.authed = false
      if (this.ws === ws) this.ws = null
      if (wasAuthed) this.emit('disconnected')
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
      ws.on('error', () => {}) // closing mid-handshake emits an error
      try { ws.terminate() } catch { /* ignore */ }
    }
    this.authed = false
  }

  /** Feed keys "NSE|22" */
  subscribe(keys: string[]) {
    const fresh = keys.filter(k => !this.keys.has(k))
    fresh.forEach(k => this.keys.add(k))
    if (this.isReady) this.send('t', fresh)
    else if (!this.ws) this.connect()
  }

  unsubscribe(keys: string[]) {
    const gone = keys.filter(k => this.keys.delete(k))
    if (this.isReady) this.send('u', gone)
  }

  private send(t: 't' | 'u', keys: string[]) {
    if (!this.ws || !keys.length) return
    for (let i = 0; i < keys.length; i += BATCH) {
      this.ws.send(JSON.stringify({ t, k: keys.slice(i, i + BATCH).join('#') }))
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

  /** Heartbeat out; the gateway answers it, so a long silence means a dead connection */
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => {
      if (!this.ws) return
      if (Date.now() - this.lastMessageAt > SILENCE_MS) {
        console.warn(`[${this.label}Feed] No data or heartbeat for ${SILENCE_MS / 1000}s, reconnecting`)
        this.ws.terminate()
        return
      }
      try { this.ws.send(JSON.stringify({ t: 'h' })) } catch { /* closing */ }
    }, HEARTBEAT_MS)
    this.heartbeat.unref()
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
  }
}
