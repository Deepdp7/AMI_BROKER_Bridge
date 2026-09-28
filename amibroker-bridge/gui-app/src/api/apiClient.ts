/**
 * DataBridge Pro — Local API Client
 * Typed HTTP + WebSocket client for the local Express API (localhost:7890)
 */

const isTauri = window.location.origin.startsWith('tauri://') || window.location.origin.includes('tauri.localhost') || !!(window as any).__TAURI_INTERNALS__
export const BASE_URL = isTauri ? 'http://127.0.0.1:7890/api' : '/api'
const WS_URL = 'ws://127.0.0.1:7890/api/status/stream'

// ===== Types (mirrors local-api/src/types.ts) =====
export type BrokerStatus = 'connected' | 'reconnecting' | 'auth_required' | 'disconnected'
export type FeedStatusType = 'STREAMING' | 'STALE' | 'CLOSED' | 'ERROR'
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type BrokerType = 'zerodha_kite' | 'angel_one' | 'upstox' | 'fyers'

export interface BrokerAccount {
  id: string
  brokerType: BrokerType
  label: string
  status: BrokerStatus
  lastConnectedAt?: number
  accountId?: string
  healthScore?: number
  reconnectCount1h?: number
}

export interface SymbolFeedStatus {
  ticker: string
  exchange: string
  instrumentType: string
  lastPrice: number
  prevClose: number
  lastTickUtcMs: number
  barsPerMin: number
  internalLatencyMs: number
  status: FeedStatusType
  change: number
  changePercent: number
  volume: number
}

export interface CoreEngineStats {
  cpuPercent: number
  ramMb: number
  uptimeSec: number
  messagesPerSec: number
  totalSymbols: number
}

export interface FeedStatusResponse {
  symbols: SymbolFeedStatus[]
  coreEngine: CoreEngineStats
  timestamp: number
}

export interface HealthEvent {
  ts: number
  type: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'AUTH_REQUIRED' | 'ERROR'
  brokerId: string
  detail?: string
}

export interface ConnectionHealth {
  brokerId: string
  score: number // 0–100
  reconnectCount1h: number
  errorRate: number
  heartbeatFreshMs: number
  history: HealthEvent[]
}

export interface HealthResponse {
  brokers: ConnectionHealth[]
  coreEngine: CoreEngineStats
  uptimeSec: number
}

export interface LogEntry {
  id: string
  ts: number
  level: LogLevel
  component: string
  message: string
}

export interface AppSettings {
  amiBrokerPath: string
  autoStartWithWindows: boolean
  autoStartAmiBroker: boolean
  autoUpdate: boolean
  updateChannel: 'stable' | 'beta'
  logLevel: LogLevel
  logRetentionDays: number
  backfillDepthDays: number
  lateToleranaceSeconds: number
  clockSkewThresholdSeconds: number
}

export interface WsMessage {
  type: 'feed_update' | 'log_entry' | 'broker_status' | 'health_update' | 'ping'
  payload: unknown
}

// ===== HTTP Client =====
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${path} failed (${res.status}): ${err}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Brokers
  getBrokers: () => apiFetch<BrokerAccount[]>('/brokers'),
  addBroker: (payload: { brokerType: BrokerType; label: string; apiKey?: string; apiSecret?: string }) =>
    apiFetch<BrokerAccount>('/brokers', { method: 'POST', body: JSON.stringify(payload) }),
  removeBroker: (id: string) =>
    apiFetch<{ ok: boolean }>(`/brokers/${id}`, { method: 'DELETE' }),
  addSymbolsToBroker: (id: string, symbols: any[]) =>
    apiFetch<{ added: number }>(`/brokers/${id}/symbols`, { method: 'POST', body: JSON.stringify({ symbols }) }),
  removeSymbolFromBroker: (id: string, ticker: string) =>
    apiFetch<{ ok: boolean }>(`/brokers/${id}/symbols/${ticker}`, { method: 'DELETE' }),
  searchSymbols: (id: string, q: string, exchange?: string) => {
    let path = id ? `/brokers/${id}/search?q=${encodeURIComponent(q)}` : `/brokers/search?q=${encodeURIComponent(q)}`
    if (exchange) path += `&exchange=${encodeURIComponent(exchange)}`
    return apiFetch<any[]>(path)
  },


  // Folder picker (Native OS Dialog)
  pickFolder: () =>
    apiFetch<{ path: string | null }>('/system/pick-folder'),

  // System Clean Operations
  cleanDatabase: () =>
    apiFetch<{ ok: boolean }>('/system/clean-database', { method: 'POST' }),
  fullForceClean: () =>
    apiFetch<{ ok: boolean }>('/system/full-force-clean', { method: 'POST' }),

  // Status
  getFeedStatus: () => apiFetch<FeedStatusResponse>('/status/feed'),
  getHealth: () => apiFetch<HealthResponse>('/status/health'),
  getBackfillStatus: () => apiFetch<{ queueLength: number; statuses: any[] }>('/backfill/status'),
  // Master Contracts
  syncMaster: (id: string) => apiFetch<{ ok: boolean }>(`/brokers/${id}/master/sync`, { method: 'POST' }),
  getMasterStatus: (id: string) => apiFetch<{ isDownloading: boolean, lastSync: number, isDownloadedToday: boolean, count: number }>(`/brokers/${id}/master/status`),

  // Settings
  getSettings: () => apiFetch<AppSettings>('/settings'),
  updateSettings: (s: Partial<AppSettings>) =>
    apiFetch<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(s) }),

  // Logs
  getLogs: (params?: { level?: string; component?: string; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ) : ''
    return apiFetch<LogEntry[]>(`/logs${qs}`)
  },
  exportDiagnostics: () => apiFetch<{ url: string; filename: string }>('/diagnostics/export', { method: 'POST' }),
}

// ===== WebSocket Manager =====
type WsEventType = 'feed_update' | 'log_entry' | 'broker_status' | 'health_update' | 'open' | 'close' | 'error' | 'backfill_progress' | 'backfill_completed' | 'backfill_failed' | 'master_sync_progress' | 'master_sync_complete' | 'market_status'
type WsListener = (payload: unknown) => void

class WebSocketManager {
  private _ws: WebSocket | null = null
  private listeners: Map<WsEventType, Set<WsListener>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private shouldConnect = false

  get ws(): WebSocket | null { return this._ws }

  connect() {
    this.shouldConnect = true
    this._connect()
  }

  disconnect() {
    this.shouldConnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  private _connect() {
    if (this._ws?.readyState === WebSocket.OPEN || this._ws?.readyState === WebSocket.CONNECTING) return
    const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/status/stream'
    
    try {
      this._ws = new WebSocket(wsUrl)
      this._ws.binaryType = 'arraybuffer'
      this._ws.onopen = () => {
        this.reconnectDelay = 1000
        this._emit('open', null)
      }
      this._ws.onclose = () => {
        this._emit('close', null)
        this._scheduleReconnect()
      }
      this._ws.onerror = (e) => {
        this._emit('error', e)
      }
      this._ws.onmessage = async (ev) => {
        try {
          const { decode } = await import('@msgpack/msgpack')
          const data = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : ev.data
          const msg = decode(data) as any
          if (msg.type !== 'ping') this._emit(msg.type as WsEventType, msg.payload)
        } catch { /* ignore malformed */ }
      }
    } catch {
      this._scheduleReconnect()
    }
  }

  private _scheduleReconnect() {
    if (!this.shouldConnect) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
      this._connect()
    }, this.reconnectDelay)
  }

  private _emit(type: WsEventType, payload: unknown) {
    this.listeners.get(type)?.forEach(fn => fn(payload))
  }

  on(type: WsEventType, listener: WsListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
    return () => this.listeners.get(type)?.delete(listener)
  }

  get isConnected() {
    return this._ws?.readyState === WebSocket.OPEN
  }
}

export const wsManager = new WebSocketManager()

// ===== API availability check =====
export async function isApiAvailable(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/settings`, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}
