/**
 * DataBridge Pro — Shared Types
 * Used across all local-api modules
 */

export type BrokerType = 'zerodha_kite' | 'angel_one' | 'upstox' | 'fyers'
export type BrokerStatus = 'connected' | 'reconnecting' | 'auth_required' | 'disconnected'
export type FeedStatusType = 'SUBSCRIBED' | 'RECEIVING' | 'STREAMING' | 'STALE' | 'CLOSED' | 'ERROR'
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type ConnectionEventType = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'AUTH_REQUIRED' | 'ERROR'
export type UpdateChannel = 'stable' | 'beta'
export type InstrumentType = 'EQ' | 'FUT' | 'OPT' | 'INDEX' | 'CURRENCY' | 'COMMODITY'
export type Exchange = 'NSE' | 'BSE' | 'MCX' | 'NFO' | 'BFO' | 'CDS'
export type BackfillJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface BrokerAccount {
  id: string
  brokerType: BrokerType
  label: string
  status: BrokerStatus
  lastConnectedAt?: number
  accountId?: string
  healthScore: number
  reconnectCount1h: number
  credentialRef: string // opaque reference — never the actual token
}

export interface SymbolMap {
  brokerId: string
  instrumentId: string
  amiBrokerTicker: string
  exchange: Exchange
  instrumentType: InstrumentType
  rawSymbol: string
  createdAt: number
}

export interface SymbolFeedStatus {
  ticker: string
  exchange: Exchange
  instrumentType: InstrumentType
  lastPrice: number
  prevClose: number
  lastTickUtcMs: number
  barsPerMin: number
  internalLatencyMs: number
  status: FeedStatusType
  change: number
  changePercent: number
  volume: number
  openInterest?: number
  bid?: number
  ask?: number
}

export interface Bar1s {
  amiBrokerTicker: string
  tsUtcMs: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  openInterest?: number
}

export interface CoreEngineStats {
  cpuPercent: number
  ramMb: number
  uptimeSec: number
  messagesPerSec: number
  totalSymbols: number
  p50LatencyMs: number
  p99LatencyMs: number
}

export interface ConnectionEvent {
  id: number
  brokerId: string
  eventType: ConnectionEventType
  detail?: string
  tsUtcMs: number
}

export interface AppSettings {
  amiBrokerPath: string
  autoStartWithWindows: boolean
  autoStartAmiBroker: boolean
  autoUpdate: boolean
  updateChannel: UpdateChannel
  logLevel: LogLevel
  logRetentionDays: number
  backfillDepthDays: number
  lateToleranaceSeconds: number
  clockSkewThresholdSeconds: number
  // Backfill engine config
  historyChunkDays: number        // Days per API chunk request (default: 30)
  maxBackfillRpsDelayMs: number   // Milliseconds between API calls (default: 150)
  maxBackfillRetries: number      // Max retry attempts per chunk (default: 3)
  // Daily auto-relogin
  dailyReloginEnabled: boolean    // Open Fyers login page automatically every day
  dailyReloginTime: string        // HH:MM in IST (e.g. "08:50")
}

export interface LogEntry {
  id: string
  ts: number
  level: LogLevel
  component: string
  message: string
}

export interface FeedStatusResponse {
  symbols: SymbolFeedStatus[]
  coreEngine: CoreEngineStats
  timestamp: number
}

export interface HealthResponse {
  brokers: Array<{
    brokerId: string
    score: number
    reconnectCount1h: number
    errorRate: number
    heartbeatFreshMs: number
    recentEvents: ConnectionEvent[]
  }>
  coreEngine: CoreEngineStats
  uptimeSec: number
}

/**
 * Backfill status for a single symbol/ticker.
 * Tracks progress, chunk count, error state and timing.
 */
export interface BackfillStatus {
  ticker: string
  brokerId: string
  status: BackfillJobStatus
  progress: number          // 0–100
  candlesFetched: number
  totalChunks: number
  completedChunks: number
  fromDate: string          // ISO date string
  toDate: string            // ISO date string
  startedAt: number         // Unix ms
  completedAt?: number      // Unix ms
  lastError?: string
  retryCount: number
}

// WebSocket message types
export type WsMessageType =
  | 'feed_update'
  | 'log_entry'
  | 'broker_status'
  | 'health_update'
  | 'ping'
  | 'master_sync_progress'
  | 'master_sync_complete'
  | 'master_sync_error'
  | 'backfill_progress'
  | 'backfill_completed'
  | 'backfill_failed'
  | 'market_status'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  payload: T
  ts: number
}

export interface ExchangeRegistry {
  exchangeCode: Exchange
  timezone: string
  sessionOpenLocal: string
  sessionCloseLocal: string
}
