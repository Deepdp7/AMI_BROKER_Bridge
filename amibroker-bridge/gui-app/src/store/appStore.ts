import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ===== Types =====
export type BrokerStatus = 'connected' | 'reconnecting' | 'auth_required' | 'disconnected'
export type FeedStatus = 'SUBSCRIBED' | 'RECEIVING' | 'STREAMING' | 'STALE' | 'CLOSED' | 'ERROR'
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface BrokerAccount {
  id: string
  brokerType: 'zerodha_kite' | 'angel_one' | 'upstox' | 'fyers'
  label: string
  status: BrokerStatus
  lastConnectedAt?: number
  accountId?: string
}

export interface SymbolFeed {
  ticker: string
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NFO' | 'BFO'
  instrumentType: 'EQ' | 'FUT' | 'OPT' | 'INDEX'
  rawSymbol?: string
  brokerId?: string
  lastPrice: number
  prevClose: number
  lastTickUtcMs: number
  barsPerMin: number
  internalLatencyMs: number
  status: FeedStatus
  change: number
  changePercent: number
  volume: number
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
  // Daily auto-relogin
  dailyReloginEnabled: boolean
  dailyReloginTime: string  // HH:MM in IST
}

export interface CoreEngineStats {
  cpuPercent: number
  ramMb: number
  uptimeSec: number
  messagesPerSec: number
  totalSymbols: number
}

// ===== Store =====
interface AppStore {
  // Broker
  brokers: BrokerAccount[]
  addBroker: (b: BrokerAccount) => void
  removeBroker: (id: string) => void
  updateBrokerStatus: (id: string, status: BrokerStatus) => void

  // Symbols
  symbols: SymbolFeed[]
  addSymbol: (s: SymbolFeed) => void
  removeSymbol: (ticker: string) => void
  updateSymbolFeed: (ticker: string, update: Partial<SymbolFeed>) => void
  batchUpdateSymbolFeeds: (updates: { ticker: string, update: Partial<SymbolFeed> }[]) => void

  // Logs
  logs: LogEntry[]
  addLog: (l: LogEntry) => void
  clearLogs: () => void

  // Settings
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // Core Engine Stats
  coreStats: CoreEngineStats
  updateCoreStats: (s: Partial<CoreEngineStats>) => void

  // Backfill status
  backfillStatuses: Record<string, { ticker: string; progress: number; status: string; candlesFetched: number; completedChunks: number; totalChunks: number }>
  updateBackfillStatus: (ticker: string, data: any) => void
  clearBackfillStatus: (ticker: string) => void

  // UI State
  activePage: string
  setActivePage: (p: string) => void

  // Market Status (IST hours)
  marketStatus: 'open' | 'closed' | 'unknown'
  setMarketStatus: (s: 'open' | 'closed' | 'unknown') => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      brokers: [],
      addBroker: (b) => set((s) => {
        if (s.brokers.find(exist => exist.id === b.id)) return s;
        return { brokers: [...s.brokers, b] }
      }),
      removeBroker: (id) => set((s) => ({ brokers: s.brokers.filter(b => b.id !== id) })),
      updateBrokerStatus: (id, status) => set((s) => ({
        brokers: s.brokers.map(b => b.id === id ? { ...b, status } : b)
      })),

  symbols: [],
  addSymbol: (sym) => set((s) => ({ symbols: [...s.symbols, sym] })),
  removeSymbol: (ticker) => set((s) => ({ symbols: s.symbols.filter(sym => sym.ticker !== ticker) })),
  updateSymbolFeed: (ticker, update) => set((s) => ({
    symbols: s.symbols.map(sym => sym.ticker === ticker ? { ...sym, ...update } : sym)
  })),
  batchUpdateSymbolFeeds: (updates) => set((s) => {
    const updateMap = new Map(updates.map(u => [u.ticker, u.update]))
    const newSymbols = [...s.symbols]
    const existingTickers = new Set(s.symbols.map(sym => sym.ticker))
    
    for (const [ticker, update] of updateMap.entries()) {
      if (!existingTickers.has(ticker)) {
        newSymbols.push({
          ticker,
          exchange: (update.exchange as any) || 'NSE',
          instrumentType: (update.instrumentType as any) || 'EQ',
          lastPrice: update.lastPrice || 0,
          prevClose: update.prevClose || 0,
          lastTickUtcMs: update.lastTickUtcMs || 0,
          barsPerMin: update.barsPerMin || 0,
          internalLatencyMs: update.internalLatencyMs || 0,
          status: update.status || 'CLOSED',
          change: update.change || 0,
          changePercent: update.changePercent || 0,
          volume: update.volume || 0
        })
      } else {
        const idx = newSymbols.findIndex(sym => sym.ticker === ticker)
        if (idx !== -1) {
          newSymbols[idx] = { ...newSymbols[idx], ...update }
        }
      }
    }
    return { symbols: newSymbols }
  }),

  logs: [],
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, 500) })),
  clearLogs: () => set({ logs: [] }),

  settings: {
    amiBrokerPath: 'C:\\Program Files\\AmiBroker',
    autoStartWithWindows: true,
    autoStartAmiBroker: false,
    autoUpdate: true,
    updateChannel: 'stable',
    logLevel: 'info',
    logRetentionDays: 14,
    backfillDepthDays: 30,
    lateToleranaceSeconds: 2,
    clockSkewThresholdSeconds: 5,
    dailyReloginEnabled: false,
    dailyReloginTime: '08:50',
  },
  updateSettings: (s) => set((prev) => ({ settings: { ...prev.settings, ...s } })),

  coreStats: {
    cpuPercent: 0,
    ramMb: 0,
    uptimeSec: 0,
    messagesPerSec: 0,
    totalSymbols: 0,
  },
  updateCoreStats: (s) => set((prev) => ({ coreStats: { ...prev.coreStats, ...s } })),

  backfillStatuses: {},
  updateBackfillStatus: (ticker, data) => set((prev) => ({
    backfillStatuses: { ...prev.backfillStatuses, [ticker]: data }
  })),
  clearBackfillStatus: (ticker) => set((prev) => {
    const { [ticker]: _, ...rest } = prev.backfillStatuses
    return { backfillStatuses: rest }
  }),

      activePage: 'feed-status',
      setActivePage: (p) => set({ activePage: p }),

      marketStatus: 'unknown',
      setMarketStatus: (s) => set({ marketStatus: s }),
    }),
    { 
      name: 'databridge-pro-storage',
      partialize: (state) => ({
        brokers: state.brokers,
        settings: state.settings,
        activePage: state.activePage,
      }),
    }
  )
)
