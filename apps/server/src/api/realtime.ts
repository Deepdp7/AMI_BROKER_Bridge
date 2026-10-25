/**
 * Real-time push to the desktop app: WebSocket at ws://127.0.0.1:7890/api/status/stream.
 * Messages (msgpack): feed_update, log_entry, broker_status, backfill_*, market_status,
 * console_lines, auto_refresh, morning_brief, master_sync_*.
 */
import http = require('http')
import { WebSocketServer, WebSocket } from 'ws'
import { encode } from '@msgpack/msgpack'
import { consoleEvents, type ConsoleLine } from '../system/ConsoleCapture'
import { liveFeed } from '../market/liveFeed'
import type { WsMessage } from '../types'

const wsClients = new Set<WebSocket>()

/** Pushes one message to every connected app window (msgpack-encoded) */
export function broadcast<T>(type: WsMessage['type'], payload: T) {
  if (wsClients.size === 0) return
  const msgObj = { type, payload, ts: Date.now() }
  const buffer = encode(msgObj)
  wsClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(buffer)
    }
  })
}

/** NSE/BSE regular session: 09:15–15:30 IST on weekdays */
export function isMarketOpen(): boolean {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffset)
  const dayOfWeek = ist.getUTCDay() // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return false // Weekend
  const hours = ist.getUTCHours()
  const minutes = ist.getUTCMinutes()
  const totalMin = hours * 60 + minutes
  return totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30
}

/** Serves the WebSocket on the API server and starts the once-a-minute market status push. */
export function attachRealtime(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/api/status/stream' })

  wss.on('connection', (ws, req) => {
    // Security: reject non-localhost connections
    const ip = req.socket.remoteAddress
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      ws.close(1008, 'Non-localhost connection rejected')
      return
    }

    ws.binaryType = 'arraybuffer'
    wsClients.add(ws)
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'ws_connected', clients: wsClients.size }))

    // Send initial snapshot
    const snapshot = liveFeed.getFeedStatuses()
    if (snapshot.length > 0) {
      const snapshotMsg = {
        type: 'feed_update',
        payload: { symbols: snapshot, coreEngine: liveFeed._getCoreStats(), timestamp: Date.now() },
        ts: Date.now(),
      }
      ws.send(encode(snapshotMsg))
    }

    // Immediately send market_status so the new client knows without waiting 60s
    ws.send(encode({ type: 'market_status', payload: { open: isMarketOpen(), ts: Date.now() }, ts: Date.now() }))

    // Ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encode({ type: 'ping', payload: null, ts: Date.now() }))
      }
    }, 30000)

    ws.on('close', () => {
      wsClients.delete(ws)
      clearInterval(pingInterval)
      console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'ws_disconnected', clients: wsClients.size }))
    })

    ws.on('error', (err) => {
      console.error('[WS Error]', err.message)
      wsClients.delete(ws)
      clearInterval(pingInterval)
    })
  })

  let _lastMarketStatus: boolean | null = null
  setInterval(() => {
    const open = isMarketOpen()
    broadcast('market_status', { open, ts: Date.now() })
    // Log transition
    if (_lastMarketStatus !== null && _lastMarketStatus !== open) {
      console.log(`[Market] Status changed: ${open ? 'OPEN' : 'CLOSED'}`)
    }
    _lastMarketStatus = open
  }, 60 * 1000).unref()

  return wss
}

// ===== Live engine console → WebSocket (batched, the Live Console page renders these) =====
let pendingConsoleLines: ConsoleLine[] = []
let consoleFlushTimer: NodeJS.Timeout | null = null
consoleEvents.on('line', (line: ConsoleLine) => {
  if (wsClients.size === 0) return
  pendingConsoleLines.push(line)
  if (!consoleFlushTimer) {
    consoleFlushTimer = setTimeout(() => {
      consoleFlushTimer = null
      const lines = pendingConsoleLines
      pendingConsoleLines = []
      broadcast('console_lines', { lines })
    }, 250)
  }
})
