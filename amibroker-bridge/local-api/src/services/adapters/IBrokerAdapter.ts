import { EventEmitter } from 'events'

export interface InstrumentInfo {
  instrumentId: string
  exchange: string
  ticker: string
  instrumentType: string
  lotSize: number
  tickSize: number
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
  // Lifecycle
  connect(credentials: BrokerCredentials): Promise<SessionInfo>
  disconnect(): Promise<void>
  
  // Discovery & Mapping
  searchSymbols(query: string, exchange?: string): Promise<InstrumentInfo[]>
  downloadInstruments?(): Promise<void>
  resolveSymbol?(ticker: string, dbExchange?: string): Promise<string>
  
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
