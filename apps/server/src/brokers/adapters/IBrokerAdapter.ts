import { EventEmitter } from 'events'

export interface InstrumentInfo {
  instrumentId: string
  exchange: string
  ticker: string
  instrumentType: string
  lotSize: number
  tickSize: number
  /** Company / contract name, when the broker's list has one */
  name?: string
  /** YYYY-MM-DD for futures and options */
  expiry?: string
}

/** What the broker's instrument list says about one contract (shown in AmiBroker's Symbol Information) */
export interface InstrumentDetails {
  name: string
  /** Shares in one lot: F&O are bought in whole lots only (1 for cash shares) */
  lotSize: number
  /** Smallest price step */
  tickSize: number
  /** YYYY-MM-DD for futures and options, '' otherwise */
  expiry: string
  /** Rupees one lot gains per rupee of price move, when the list says (MCX at Fyers: lot 1, CRUDEOIL 100) */
  pointValue?: number
}

export interface Bar {
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  openInterest?: number
}

export interface NormalizedTick {
  instrumentId: string
  lastPrice: number
  volume: number
  timestamp: number
  openInterest?: number
}

export interface BrokerCredentials {
  apiKey: string
  apiSecret: string
  requestToken?: string
  accessToken?: string
  [key: string]: string | undefined
}

export interface SessionInfo {
  accountId: string
  accessToken: string
  expiresAt?: number
}

export interface IBrokerAdapter extends EventEmitter {
  /** Largest date range (days) of 1-minute history one request may cover, if the broker caps it */
  readonly maxIntradayHistoryDays?: number
  /** History requests per minute the broker allows right now (lowered while it is refusing) */
  historyRequestsPerMinute?(): number
  /** Broker data API passthrough (option chain, quotes) — Fyers only for now */
  dataApi?(pathAndQuery: string): Promise<any>

  // Lifecycle
  connect(credentials: BrokerCredentials): Promise<SessionInfo>
  disconnect(): Promise<void>
  
  // Discovery & Mapping
  searchSymbols(query: string, exchange?: string): Promise<InstrumentInfo[]>
  downloadInstruments?(): Promise<void>
  resolveSymbol?(ticker: string, dbExchange?: string): Promise<string>
  /** Every NFO stock future ('stock') or index future ('index') the broker lists, all expiries */
  listFutures?(kind: 'stock' | 'index'): Promise<InstrumentInfo[]>
  /** Lot size, tick size and name of stored symbol names (names the list doesn't have are left out) */
  instrumentDetails?(names: string[]): Promise<Map<string, InstrumentDetails>>

  // Historical
  getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]>
  
  // Real-time
  subscribe(instruments: string[]): Promise<void>
  unsubscribe(instruments: string[]): Promise<void>
  
  // Metadata
  getCapabilities(): { supportsTickData: boolean; supports1sBars: boolean; supportsDepth: boolean }
}

// Events emitted by the adapter:
// 'tick': (tick: NormalizedTick) => void
// 'connection_state': (state: 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void
