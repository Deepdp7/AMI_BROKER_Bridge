import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

const lastWritten = new Map<string, string>()
const dedupedLocalStorage: StateStorage = {
  getItem: name => { try { return localStorage.getItem(name) } catch { return null } },
  setItem: (name, value) => {
    if (lastWritten.get(name) === value) return
    lastWritten.set(name, value)
    try { localStorage.setItem(name, value) } catch { /* storage unavailable */ }
  },
  removeItem: name => { lastWritten.delete(name); try { localStorage.removeItem(name) } catch { /* storage unavailable */ } },
}

// ===== Types =====
export type BrokerStatus = 'connected' | 'reconnecting' | 'auth_required' | 'disconnected'
export type FeedStatus = 'SUBSCRIBED' | 'RECEIVING' | 'STREAMING' | 'STALE' | 'CLOSED' | 'ERROR'
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface BrokerAccount {
  id: string
  brokerType: 'zerodha_kite' | 'angel_one' | 'upstox' | 'fyers' | 'dhan' | 'flattrade' | 'shoonya' | 'zebu' | 'tradesmart' | 'compositedge' | 'fivepaisa_xts' | 'jainam' | 'ibulls' | 'rmoney'
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
  /** Spread history downloads over every connected broker (the fastest free one fetches each chunk) */
  historyUseAllBrokers: boolean
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
  /** Drop completed/failed entries (after the finished-batch notification is gone) */
  clearFinishedBackfills: () => void
  /** Drop every entry (the user cancelled the downloads) */
  clearAllBackfills: () => void
  /** History downloads paused by the user (kept by the engine across restarts) */
  backfillPaused: boolean
  setBackfillPaused: (paused: boolean) => void

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
  // Runs up to 10 times a second during market hours: a symbol only gets a new object when one
  // of its values really changed, and nothing at all happens when none did, so screens (and
  // their memoised cards) redraw only what moved.
  batchUpdateSymbolFeeds: (updates) => set((s) => {
    const index = new Map(s.symbols.map((sym, i) => [sym.ticker, i]))
    let newSymbols: SymbolFeed[] | null = null

    for (const { ticker, update } of updates) {
      const idx = index.get(ticker)
      if (idx !== undefined) {
        const cur = (newSymbols ?? s.symbols)[idx]
        let differs = false
        for (const k in update) {
          const v = (update as any)[k]
          if (v !== undefined && (cur as any)[k] !== v) { differs = true; break }
        }
        if (!differs) continue
        newSymbols ??= [...s.symbols]
        const merged = { ...cur }
        for (const k in update) { const v = (update as any)[k]; if (v !== undefined) (merged as any)[k] = v }
        newSymbols[idx] = merged
      } else {
        newSymbols ??= [...s.symbols]
        index.set(ticker, newSymbols.length)
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
      }
    }
    return newSymbols ? { symbols: newSymbols } : s
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
    historyUseAllBrokers: true,
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
  updateCoreStats: (s) => set((prev) => {
    const changed = (Object.keys(s) as (keyof CoreEngineStats)[]).some(k => s[k] !== undefined && s[k] !== prev.coreStats[k])
    return changed ? { coreStats: { ...prev.coreStats, ...s } } : prev
  }),

  backfillStatuses: {},
  updateBackfillStatus: (ticker, data) => set((prev) => ({
    backfillStatuses: { ...prev.backfillStatuses, [ticker]: data }
  })),
  clearFinishedBackfills: () => set((prev) => ({
    backfillStatuses: Object.fromEntries(Object.entries(prev.backfillStatuses).filter(([, st]) => st.status === 'pending' || st.status === 'running')),
  })),
  clearAllBackfills: () => set({ backfillStatuses: {} }),
  backfillPaused: false,
  setBackfillPaused: (paused) => set({ backfillPaused: paused }),
  clearBackfillStatus: (ticker) => set((prev) => {
    const { [ticker]: _, ...rest } = prev.backfillStatuses
    return { backfillStatuses: rest }
  }),

      activePage: 'feed-status',
      setActivePage: (p) => set({ activePage: p }),

      marketStatus: 'unknown',
      setMarketStatus: (s) => set(prev => prev.marketStatus === s ? prev : { marketStatus: s }),
    }),
    {
      name: 'databridge-pro-storage',
      // The saved part (brokers, settings, page) rarely changes, but persist writes on every
      // update, live prices included: only touch localStorage when the text differs
      storage: createJSONStorage(() => dedupedLocalStorage),
      partialize: (state) => ({
        brokers: state.brokers,
        settings: state.settings,
        activePage: state.activePage,
      }),
    }
  )
)
