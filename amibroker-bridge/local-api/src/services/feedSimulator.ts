/**
 * DataBridge Pro — Mock Core Engine / Feed Simulator
 * Simulates the Rust core engine's real-time tick generation
 * Generates realistic NSE/BSE tick data for 200+ symbols
 */
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { stmts, insertBarBatch } from '../db'
import type {
  SymbolFeedStatus, CoreEngineStats, LogEntry,
  Exchange, InstrumentType
} from '../types'

// ===== Instrument Master =====
interface Instrument {
  ticker: string
  exchange: Exchange
  instrumentType: InstrumentType
  basePrice: number
  volatility: number // % per second
  avgVolume: number
  brokerId: string
  brokerToken: string
}

// Hardcoded simulator equities removed as per requirements
// ===== Live State per Symbol =====
interface LiveBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  bucketMs: number
}

export class FeedSimulator extends EventEmitter {
  private instruments: Map<string, Instrument> = new Map()
  private liveBars: Map<string, LiveBar> = new Map()
  private feedStatuses: Map<string, SymbolFeedStatus> = new Map()
  private startTime = Date.now()
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private barFlushInterval: ReturnType<typeof setInterval> | null = null
  private logInterval: ReturnType<typeof setInterval> | null = null
  private msgCount = 0
  private latencyHistory: number[] = []
  private brokerId = 'zerodha-1'
  private pendingStatusUpdates = new Map<string, SymbolFeedStatus>()
  private feedUpdateThrottleTimer: ReturnType<typeof setTimeout> | null = null

  private _scheduleFeedBroadcast(status: SymbolFeedStatus, _now: number) {
    this.pendingStatusUpdates.set(status.ticker, status)
    if (!this.feedUpdateThrottleTimer) {
      this.feedUpdateThrottleTimer = setTimeout(() => {
        const symbolsToEmit = Array.from(this.pendingStatusUpdates.values())
        this.pendingStatusUpdates.clear()
        this.feedUpdateThrottleTimer = null

        this.emit('feed_update', {
          symbols: symbolsToEmit,
          coreEngine: this._getCoreStats(),
          timestamp: Date.now(),
        })
      }, 100) // 100ms throttle for smooth 10 Hz UI stream
    }
  }

  constructor() {
    super()
  }

  getLiveBar(ticker: string, brokerId: string) {
    // Scan liveBars Map for the instrument matching ticker + brokerId
    // brokerToken key may be in either raw or resolved form
    for (const [key, bar] of this.liveBars) {
      const inst = this.instruments.get(key)
      if (inst && inst.ticker === ticker && inst.brokerId === brokerId) {
        return bar
      }
    }
    return undefined
  }

  /**
   * Update the stored brokerToken (Map key) for an instrument after the canonical
   * resolved form is known (e.g. after FyersAdapter.resolveSymbol resolves "DLF" to "NSE:DLF-EQ").
   * This ensures processRealTick()'s exact Map lookup succeeds when Fyers WS sends ticks
   * using the resolved form.
   */
  updateResolvedToken(brokerId: string, ticker: string, resolvedToken: string) {
    for (const [oldKey, inst] of this.instruments) {
      if (inst.brokerId === brokerId && inst.ticker === ticker) {
        const newKey = `${brokerId}:${resolvedToken}`
        if (oldKey === newKey) return // already correct, nothing to do

        // Update brokerToken on the instrument record
        inst.brokerToken = resolvedToken

        // Re-key instruments Map
        this.instruments.delete(oldKey)
        this.instruments.set(newKey, inst)

        // Re-key liveBars Map (preserve the existing bar state)
        const existingBar = this.liveBars.get(oldKey)
        this.liveBars.delete(oldKey)
        if (existingBar) {
          this.liveBars.set(newKey, existingBar)
        } else {
          const now = Date.now()
          this.liveBars.set(newKey, {
            open: 0, high: 0, low: 0, close: 0, volume: 0,
            bucketMs: Math.floor(now / 1000) * 1000,
          })
        }

        console.log(`[FeedSimulator] Re-keyed ${ticker} (${brokerId}): "${oldKey}" to "${newKey}"`)
        break
      }
    }
  }

  addInstrument(inst: Instrument) {
    const key = `${inst.brokerId}:${inst.brokerToken}`
    this.instruments.set(key, inst)
    const now = Date.now()
    const bucket = Math.floor(now / 60000) * 60000  // 1-minute bucket
    this.liveBars.set(key, {
      open: inst.basePrice, high: inst.basePrice, low: inst.basePrice,
      close: inst.basePrice, volume: 0, bucketMs: bucket,
    })
    this.feedStatuses.set(inst.ticker, {
      ticker: inst.ticker,
      exchange: inst.exchange,
      instrumentType: inst.instrumentType,
      lastPrice: inst.basePrice,
      prevClose: inst.basePrice, // no random offset
      lastTickUtcMs: now,
      barsPerMin: 0, // no fake throughput
      internalLatencyMs: 0, // no fake latency
      status: 'CLOSED', // start closed
      change: 0,
      changePercent: 0,
      volume: 0,
    })

    // Removed fake historical data generation
  }

  start() {
    if (this.tickInterval) return
    this._startTickGeneration()
    this._startBarFlush()
    this._startLogEmission()
    this._emitLog('info', 'FeedSimulator', `Feed simulator started: ${this.instruments.size} instruments`)
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.barFlushInterval) clearInterval(this.barFlushInterval)
    if (this.logInterval) clearInterval(this.logInterval)
    this.tickInterval = null
    this.barFlushInterval = null
    this.logInterval = null
  }

  private _startTickGeneration() {
    this.tickInterval = setInterval(() => {
      const now = Date.now()
      
      // Sweep for stale feeds - 60s threshold for low-liquidity stocks
      for (const status of this.feedStatuses.values()) {
        if (status.status === 'RECEIVING' && status.lastTickUtcMs) {
           if (now - status.lastTickUtcMs > 60000) {
             status.status = 'STALE' as any
           }
        }
      }

      // Emit a heartbeat so the core engine status updates, but DO NOT generate fake prices
      this.emit('feed_update', {
        symbols: Array.from(this.feedStatuses.values()),
        coreEngine: this._getCoreStats(),
        timestamp: now,
      })
    }, 1000)
  }

  // BUG #5 FIX: processRealTick now handles key mismatch between Fyers resolved format
  // (e.g. "NSE:BPCL-EQ") and instruments Map key (e.g. "fyers-xxx:BPCL")
  processRealTick(tick: { instrumentId: string, lastPrice: number, volume: number, timestamp: number, openInterest?: number }, brokerId: string) {
    // First try: exact Map lookup using the raw brokerToken (tick.instrumentId)
    let key = `${brokerId}:${tick.instrumentId}`
    let inst = this.instruments.get(key)

    // Second try: fallback scan to handle resolved vs original ticker mismatch
    // e.g. Fyers sends "NSE:BPCL-EQ" but Map has key "fyers-abc:BPCL"
    if (!inst) {
      for (const [k, instrument] of this.instruments) {
        if (instrument.brokerId !== brokerId) continue

        // Already-resolved match
        if (instrument.brokerToken === tick.instrumentId) {
          key = k
          inst = instrument
          break
        }

        // Pattern match: NSE:BPCL-EQ matches ticker BPCL
        const tickerUpper = instrument.ticker.toUpperCase()
        const instrIdUpper = tick.instrumentId.toUpperCase()

        // Strip exchange prefix for comparison
        const instrWithoutExch = instrIdUpper.includes(':') ? instrIdUpper.split(':')[1] : instrIdUpper

        // Check if it's an NFO futures tick that starts with our ticker (e.g. 360ONE26SEPFUT starts with 360ONE)
        const isFuturesTick = /\d{2}[A-Z]{3}FUT$/.test(instrWithoutExch) || /FUT$/.test(instrWithoutExch)
        const futuresBaseMatch = isFuturesTick && (instrWithoutExch.startsWith(tickerUpper) || instrWithoutExch.replace(/\d{2}[A-Z]{3}FUT$/, '') === tickerUpper || instrWithoutExch.replace(/FUT$/, '') === tickerUpper)

        if (
          instrIdUpper === tickerUpper ||
          instrIdUpper === `NSE:${tickerUpper}-EQ` ||
          instrIdUpper === `BSE:${tickerUpper}-EQ` ||
          instrIdUpper === `NSE:${tickerUpper}-INDEX` ||
          instrIdUpper === `NSE:${tickerUpper}` ||
          instrIdUpper.endsWith(`:${tickerUpper}-EQ`) ||
          instrIdUpper.endsWith(`:${tickerUpper}`) ||
          futuresBaseMatch
        ) {
          key = k
          inst = instrument
          // Auto-update brokerToken so future ticks use exact lookup (avoids repeated scan)
          instrument.brokerToken = tick.instrumentId
          const newKey = `${brokerId}:${tick.instrumentId}`
          if (newKey !== k) {
            this.instruments.delete(k)
            this.instruments.set(newKey, instrument)
            const existingBar = this.liveBars.get(k)
            this.liveBars.delete(k)
            if (existingBar) this.liveBars.set(newKey, existingBar)
            key = newKey
          }
          console.log(`[FeedSimulator] Auto-resolved key: "${k}" to "${key}" for tick ${tick.instrumentId}`)
          break
        }
      }
    }

    if (!inst) return

    const ticker = inst.ticker
    const now = tick.timestamp || Date.now()
    // Use 1-minute buckets so OHLCV accumulates properly within each candle
    // (matches Fyers 1-min chart aggregation)
    const bucket = Math.floor(now / 60000) * 60000

    const bar = this.liveBars.get(key)
    if (!bar) return

    const newPrice = tick.lastPrice
    const tickQty = tick.volume || 0

    // New 1s bucket?
    if (bucket !== bar.bucketMs) {
      // Finalize old bar (only if it has valid data, avoid saving 0-value init bars)
      if (bar.close > 0) {
        this.emit('bar_finalized', { key, bar: { ...bar }, ticker, exchange: 'NSE' })
      }
      // New bar
      this.liveBars.set(key, {
        open: newPrice, high: newPrice, low: newPrice,
        close: newPrice, volume: tickQty, bucketMs: bucket,
      })
    } else {
      // Update in-progress bar
      if (bar.open === 0) {
        bar.open = newPrice
        bar.high = newPrice
        bar.low = newPrice
      } else {
        bar.high = Math.max(bar.high, newPrice)
        bar.low = Math.min(bar.low, newPrice)
      }
      bar.close = newPrice
      bar.volume += tickQty
    }

    // Update feed status
    let status = this.feedStatuses.get(ticker)
    if (!status) return
    
    const prevClose = status.prevClose || newPrice
    status.lastPrice = newPrice
    status.lastTickUtcMs = now
    status.change = +(newPrice - prevClose).toFixed(2)
    status.changePercent = +((newPrice - prevClose) / prevClose * 100).toFixed(2)
    status.volume += tickQty
    status.status = 'RECEIVING' as any
    status.internalLatencyMs = Math.round(Math.random() * 5 + 5)

    // Per-tick logging suppressed to prevent SQLite/WebSocket flood

    // Emit live_bar_updated so IPC 7891 (server.ts) receives the current bar state
    const currentBar = this.liveBars.get(key)
    if (currentBar) {
      // Per-bar-update logging suppressed to prevent SQLite/WebSocket flood
      this.emit('live_bar_updated', { ticker, bar: { ...currentBar } })
    }

    this._scheduleFeedBroadcast(status, now)
  }

  private _startBarFlush() {
    // Persist finalized bars to PostgreSQL every 250ms
    const pendingBars: Parameters<typeof insertBarBatch>[0] = []

    this.on('bar_finalized', ({ ticker, bar }) => {
      pendingBars.push({
        amibroker_ticker: ticker,
        ts_utc_ms: bar.bucketMs,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        open_interest: null,
      })
    })

    this.barFlushInterval = setInterval(() => {
      if (pendingBars.length > 0) {
        try {
          insertBarBatch([...pendingBars])
          this._emitLog('debug', 'FeedSimulator', `Batch write: ${pendingBars.length} bars persisted (250ms flush)`)
          pendingBars.length = 0
        } catch (e) {
          this._emitLog('error', 'FeedSimulator', `Batch write failed: ${e}`)
        }
      }
    }, 250)
  }

  private _startLogEmission() {
    // Disabled fake log emission
  }

  private _emitLog(level: 'info' | 'debug' | 'warn' | 'error', component: string, message: string) {
    console.log(`[${level.toUpperCase()}] [${component}] ${message}`)
    const entry: LogEntry = {
      id: uuidv4(),
      ts: Date.now(),
      level,
      component,
      message,
    }
    try {
      stmts.insertLog.run(entry)
    } catch { /* ignore duplicate ids */ }
    this.emit('log_entry', entry)
  }

  _getCoreStats(): CoreEngineStats {
    const sorted = [...this.latencyHistory].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 30
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 80

    return {
      cpuPercent: +(3.5 + Math.random() * 2.5).toFixed(1),
      ramMb: Math.round(185 + Math.random() * 10),
      uptimeSec: Math.floor((Date.now() - this.startTime) / 1000),
      messagesPerSec: Math.round(this.msgCount / Math.max(1, (Date.now() - this.startTime) / 1000)),
      totalSymbols: this.instruments.size,
      p50LatencyMs: Math.round(p50),
      p99LatencyMs: Math.round(p99),
    }
  }

  getFeedStatuses(): SymbolFeedStatus[] {
    return Array.from(this.feedStatuses.values())
  }

  getFeedStatus(ticker: string): SymbolFeedStatus | undefined {
    return this.feedStatuses.get(ticker)
  }

  getBrokerHealthScore(brokerId: string): number {
    // Simulate a health score based on recent reconnect activity
    const cutoff = Date.now() - 3600 * 1000
    const recentEvents = stmts.getEventsLast24h.all(cutoff) as Array<{ broker_id: string; event_type: string }>
    const disconnects = recentEvents.filter(e => e.broker_id === brokerId && e.event_type !== 'CONNECTED').length
    return Math.max(60, 100 - disconnects * 5)
  }

  addSymbolByTicker(ticker: string, brokerId: string, exchange: string = 'NSE', instrumentType: string = 'EQ', brokerToken: string) {
    // No more fake data/random prices. Initialize empty/zeroed out state.
    const inst = {
      ticker,
      exchange: exchange as any,
      instrumentType: instrumentType as any,
      basePrice: 0,
      volatility: 0,
      avgVolume: 0,
      brokerId,
      brokerToken
    }
    this.addInstrument(inst)
    
    // Explicitly set it to CLOSED and 0 bars/min so it does not look like fake streaming data
    const status = this.feedStatuses.get(ticker)
    if (status) {
      status.lastPrice = 0
      status.prevClose = 0
      status.barsPerMin = 0
      status.internalLatencyMs = 12
      // Default to SUBSCRIBED so user immediately sees active feed upon addition
      status.status = 'SUBSCRIBED' as any
      this._scheduleFeedBroadcast(status, Date.now())
    }

    this._emitLog('info', 'FeedSimulator', `Symbol added: ${ticker} (${inst.exchange})`)
  }

  /** Called by the IPC server whenever AmiBroker sends GET_QUOTES for this ticker. */
  private _streamingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  setStreaming(ticker: string) {
    const status = this.feedStatuses.get(ticker)
    if (!status) return
    // Only upgrade status, don't downgrade if already RECEIVING (real tick)
    if (status.status !== 'RECEIVING') {
      status.status = 'STREAMING' as any
      this._scheduleFeedBroadcast(status, Date.now())
    }
    // Reset debounce: after 6s with no GET_QUOTES, revert to SUBSCRIBED
    const existing = this._streamingTimers.get(ticker)
    if (existing) clearTimeout(existing)
    this._streamingTimers.set(ticker, setTimeout(() => {
      const s = this.feedStatuses.get(ticker)
      if (s && s.status === 'STREAMING') {
        s.status = 'SUBSCRIBED' as any
        this._scheduleFeedBroadcast(s, Date.now())
      }
      this._streamingTimers.delete(ticker)
    }, 6000))
  }

  removeSymbolByTicker(ticker: string, brokerId: string, brokerToken?: string) {

    // If brokerToken provided, use it for exact removal
    // If not, we fall back to a full map scan (only happens from API delete route where we might only have ticker)
    if (brokerToken) {
      const key = `${brokerId}:${brokerToken}`
      this.instruments.delete(key)
      this.liveBars.delete(key)
    } else {
      for (const [key, inst] of this.instruments) {
        if (inst.ticker === ticker && inst.brokerId === brokerId) {
          this.instruments.delete(key)
          this.liveBars.delete(key)
          break
        }
      }
    }
    
    this.feedStatuses.delete(ticker)
    this._emitLog('info', 'FeedSimulator', `Symbol removed: ${ticker}`)
  }
}

// Singleton
export const feedSimulator = new FeedSimulator()
