/**
 * Live feed: turns broker ticks into 1-minute bars.
 *
 * Every broker adapter's ticks arrive in processRealTick(); this keeps the in-progress bar per
 * symbol, emits live_bar_updated (pushed to AmiBroker and the app) and bar_finalized (saved to
 * the database) and holds the per-symbol feed status the Feed Status page shows.
 *
 * A minute's bar is built from ticks stamped inside that minute (exchange time) and is closed
 * once, either by the first tick of a later minute or by the clock a little after the minute
 * ends (a quiet symbol may not tick again for a long time). After that the minute is never
 * reopened: a late tick for it changes nothing in the saved bar, and broker history replaces
 * the bar later anyway. Ticks that are not trading build no bar: snapshots sent on subscribe
 * (old exchange time) and, on NSE/BSE, updates after the close.
 */
import { EventEmitter } from 'events'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { stmts, insertBarBatch } from '../db'
import { perf } from '../system/perf'
import { isWeekend, isClosedDay, getSessionWindowMs } from './MarketCalendar'
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
  /** Start of the bar's minute (UTC ms); 0 = no bar yet */
  bucketMs: number
  /** Open interest at the bar's last update (F&O; brokers send it with the ticks) */
  oi?: number
  /** Closed and handed to the database: later ticks for this minute leave it alone */
  done?: boolean
  /** Exchange time of the update the close comes from */
  lastMs?: number
}

/** A minute is closed this long after it ends, plus the feed's usual delay (whole-second stamps, travel) */
const CLOSE_GRACE_MS = 2000
/** The feed's spread of delays added to that wait is capped here */
const MAX_EXTRA_WAIT_MS = 30_000
/** A tick stamped this much before the feed's clock is a snapshot of an earlier trade (sent on subscribe): price only, no bar */
const SNAPSHOT_AGE_MS = 5 * 60_000
/** Tick ages further off than this tell nothing about the feed clock (yesterday's last trade, a broken stamp) */
const CLOCK_SAMPLE_MAX_MS = 60 * 60_000
/** Tick ages kept per broker to place its clock */
const CLOCK_SAMPLES = 300
/** The PC clock this far off the exchange's is worth a line in the log */
const CLOCK_WARN_MS = 30_000
const IST_MS = 19_800_000
const DAY_MS = 86_400_000
/** Exchanges on NSE's fixed 09:15-15:30 day. MCX and CDS are left alone: their evening close moves with US daylight saving */
const FIXED_SESSION = new Set(['NSE', 'BSE', 'NFO', 'BFO'])

/** Day volume last seen for an instrument, and the IST day it belongs to */
interface CumVolume { total: number; day: number }

export class LiveFeed extends EventEmitter {
  private instruments: Map<string, Instrument> = new Map()
  private liveBars: Map<string, LiveBar> = new Map()
  private feedStatuses: Map<string, SymbolFeedStatus> = new Map()
  private startTime = Date.now()
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private logInterval: ReturnType<typeof setInterval> | null = null
  private msgCount = 0
  private latencyHistory: number[] = []
  private brokerId = 'zerodha-1'
  private pendingStatusUpdates = new Map<string, SymbolFeedStatus>()
  // Last cumulative day volume seen per instrument (broker sends running totals)
  private lastCumVolume = new Map<string, CumVolume>()
  // Last open interest seen per instrument: carried into every new bar, since NSE only
  // publishes it every few minutes (a bar without an update still has that OI)
  private lastOi = new Map<string, number>()
  // When each instrument's previous update arrived (performance.now()), and the name of its broker's
  // inter-arrival metric: how often the provider really sends, apart from anything the engine does
  private lastArrival = new Map<string, number>()
  private interarrivalMetric = new Map<string, string>()
  private feedUpdateThrottleTimer: ReturnType<typeof setTimeout> | null = null
  /** Trading-day answer per exchange and IST day: closed day, or the session window */
  private sessionCache = new Map<string, { closed: boolean; openMs: number; closeMs: number } | null>()

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
          this.liveBars.set(newKey, { open: 0, high: 0, low: 0, close: 0, volume: 0, bucketMs: 0 })
        }

        console.log(`[LiveFeed] Re-keyed ${ticker} (${brokerId}): "${oldKey}" to "${newKey}"`)
        break
      }
    }
  }

  /**
   * Re-key a symbol to another broker account (broker removed and re-added) keeping its feed
   * state; ticks from the new broker are matched by `${brokerId}:${token}`. Returns false if
   * the symbol isn't loaded at all.
   */
  moveSymbolToBroker(ticker: string, toBrokerId: string): boolean {
    for (const [oldKey, inst] of this.instruments) {
      if (inst.ticker !== ticker) continue
      if (inst.brokerId === toBrokerId) return true
      const newKey = `${toBrokerId}:${inst.brokerToken}`
      inst.brokerId = toBrokerId
      this.instruments.delete(oldKey)
      this.instruments.set(newKey, inst)
      const bar = this.liveBars.get(oldKey)
      this.liveBars.delete(oldKey)
      if (bar) this.liveBars.set(newKey, bar)
      const cum = this.lastCumVolume.get(oldKey)
      this.lastCumVolume.delete(oldKey)
      if (cum !== undefined) this.lastCumVolume.set(newKey, cum)
      const oi = this.lastOi.get(oldKey)
      this.lastOi.delete(oldKey)
      if (oi !== undefined) this.lastOi.set(newKey, oi)
      return true
    }
    return false
  }

  addInstrument(inst: Instrument) {
    const key = `${inst.brokerId}:${inst.brokerToken}`
    this.instruments.set(key, inst)
    // No bar until the first trading tick (its own minute, whatever the clock says)
    this.liveBars.set(key, {
      open: inst.basePrice, high: inst.basePrice, low: inst.basePrice,
      close: inst.basePrice, volume: 0, bucketMs: 0,
    })
    this.feedStatuses.set(inst.ticker, {
      ticker: inst.ticker,
      exchange: inst.exchange,
      instrumentType: inst.instrumentType,
      lastPrice: inst.basePrice,
      prevClose: inst.basePrice, // no random offset
      lastTickUtcMs: 0, // no tick yet (it used to say "just now" for a symbol that never had one)
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
    this._emitLog('info', 'LiveFeed', `Live feed started: ${this.instruments.size} instruments (prices only from the broker)`)
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.logInterval) clearInterval(this.logInterval)
    this.tickInterval = null
    this.logInterval = null
    if (this.saveBar) this.off('bar_finalized', this.saveBar)
    this.saveBar = null
  }

  private _startTickGeneration() {
    this.tickInterval = setInterval(() => {
      const now = Date.now()
      
      this.closeFinishedMinutes(now)

      // Sweep for stale feeds - 60s threshold for low-liquidity stocks
      const changed: SymbolFeedStatus[] = []
      for (const status of this.feedStatuses.values()) {
        if (status.status === 'RECEIVING' && status.lastTickUtcMs) {
           if (now - status.lastTickUtcMs > 60000) {
             status.status = 'STALE' as any
             changed.push(status)
           }
        }
      }

      // Heartbeat: engine stats, plus only the symbols that just went stale. Ticks are sent as
      // they arrive (_scheduleFeedBroadcast) and a window gets the full list when it connects,
      // so repeating every symbol each second only made the UI redo all its work for nothing.
      this.emit('feed_update', {
        symbols: changed,
        coreEngine: this._getCoreStats(),
        timestamp: now,
      })
    }, 1000)
  }

  // BUG #5 FIX: processRealTick now handles key mismatch between Fyers resolved format
  // (e.g. "NSE:BPCL-EQ") and instruments Map key (e.g. "fyers-xxx:BPCL")
  processRealTick(tick: { instrumentId: string, lastPrice: number, volume: number, totalVolume?: number, timestamp: number, openInterest?: number, prevClose?: number, bid?: number, ask?: number, bidQty?: number, askQty?: number, rxAt?: number }, brokerId: string) {
    // How long the update sat between the feed's socket and here (performance.now() stamp from the feed)
    if (tick.rxAt !== undefined) perf.record('tick.rx_to_feed_ms', performance.now() - tick.rxAt)

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

        if (
          instrIdUpper === tickerUpper ||
          instrIdUpper === `NSE:${tickerUpper}-EQ` ||
          instrIdUpper === `BSE:${tickerUpper}-EQ` ||
          instrIdUpper === `NSE:${tickerUpper}-INDEX` ||
          instrIdUpper === `NSE:${tickerUpper}` ||
          instrIdUpper.endsWith(`:${tickerUpper}-EQ`) ||
          instrIdUpper.endsWith(`:${tickerUpper}`)
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
          console.log(`[LiveFeed] Auto-resolved key: "${k}" to "${key}" for tick ${tick.instrumentId}`)
          break
        }
      }
    }

    if (!inst) return
    if (!(Number.isFinite(tick.lastPrice) && tick.lastPrice > 0)) return

    const ticker = inst.ticker
    const wallNow = Date.now()
    const now = tick.timestamp || wallNow
    const bucket = Math.floor(now / 60000) * 60000
    if (tick.timestamp) this.noteTickAge(brokerId, wallNow - tick.timestamp)

    const bar = this.liveBars.get(key)
    if (!bar) return

    const arrivedAt = performance.now()
    const prevArrival = this.lastArrival.get(key)
    if (prevArrival !== undefined) {
      let metric = this.interarrivalMetric.get(brokerId)
      if (!metric) this.interarrivalMetric.set(brokerId, metric = `feed.interarrival_ms.${brokerId}`)
      perf.record(metric, arrivedAt - prevArrival)
    }
    this.lastArrival.set(key, arrivedAt)

    const newPrice = tick.lastPrice
    if (typeof tick.openInterest === 'number' && tick.openInterest > 0) this.lastOi.set(key, tick.openInterest)
    const oi = this.lastOi.get(key)
    const tickQty = this.volumeSince(key, tick, now)

    // Snapshots of an earlier trade and updates outside trading hours show the price only. "Earlier"
    // is judged by the feed's own clock, not the PC's: a PC clock minutes off used to make every
    // tick look old (no live bars at all until the next history refresh)
    const feedNow = wallNow - this.feedClock(brokerId, wallNow).offsetMs
    const trading = now >= feedNow - SNAPSHOT_AGE_MS && this.inSession(now, inst.exchange)
    let barChanged = false
    if (trading) {
      if (bar.bucketMs === 0 || bucket > bar.bucketMs) {
        // A new minute: the previous one is complete (unless the clock already closed it)
        if (bar.bucketMs !== 0) this.closeBar(key, bar, ticker)
        this.liveBars.set(key, {
          open: newPrice, high: newPrice, low: newPrice,
          close: newPrice, volume: tickQty, bucketMs: bucket, oi, lastMs: now,
        })
        barChanged = true
      } else if (bucket === bar.bucketMs && !bar.done) {
        // The close is the newest trade's price: an update that overtook a newer one only counts
        // for the high, low and volume
        const newest = now >= (bar.lastMs ?? 0)
        const close = newest ? newPrice : bar.close
        // An update that only moves the bid/ask (or repeats the price) leaves the bar as it was:
        // nothing is sent on for it
        barChanged = newPrice > bar.high || newPrice < bar.low || close !== bar.close || tickQty > 0 || (newest && oi !== bar.oi)
        bar.high = Math.max(bar.high, newPrice)
        bar.low = Math.min(bar.low, newPrice)
        bar.close = close
        bar.volume += tickQty
        if (newest) { bar.oi = oi; bar.lastMs = now }
      }
      // Otherwise a late tick for a minute already closed: saved bars are not reopened
    }
    // The in-progress bar to AmiBroker, the app and the other platforms, at once (also for an
    // update older than the price shown, which still changed the bar's high, low or volume)
    // `at`: when this update was ready, so the push to AmiBroker can say how long it then waited
    if (barChanged) this.emit('live_bar_updated', { ticker, bar: { ...this.liveBars.get(key)! }, at: performance.now() })

    // Update feed status
    let status = this.feedStatuses.get(ticker)
    if (!status) return
    // An update older than the one shown (ticks overtaking each other) doesn't move the price back
    if (now < (status.lastTickUtcMs || 0)) return

    // The broker's previous close (Fyers sends it) beats the one read from stored bars
    if (typeof tick.prevClose === 'number' && tick.prevClose > 0) {
      status.prevClose = tick.prevClose
      this.brokerPrevCloseDay.set(ticker, Math.floor((now + IST_MS) / DAY_MS))
    }
    status.lastPrice = newPrice
    status.lastTickUtcMs = now
    this.updateChange(status)
    // Best bid / ask (Fyers, Kite): the Real-time Quote window shows them
    if (typeof tick.bid === 'number' && tick.bid > 0) { status.bid = tick.bid; status.bidQty = tick.bidQty }
    if (typeof tick.ask === 'number' && tick.ask > 0) { status.ask = tick.ask; status.askQty = tick.askQty }
    status.volume = typeof tick.totalVolume === 'number' ? tick.totalVolume : status.volume + tickQty
    if (oi) status.openInterest = oi
    status.status = 'RECEIVING' as any
    // How old the price is when it gets here: the exchange's own time of the update to now
    // (it used to be a made-up 5-10 ms). Feeds stamp whole seconds, so it is coarse.
    const ageMs = tick.timestamp ? Math.max(0, wallNow - tick.timestamp) : 0
    status.internalLatencyMs = ageMs
    this.msgCount++
    // Snapshots of old trades aren't a delay (and would hold minutes open for longer)
    if (ageMs < SNAPSHOT_AGE_MS) {
      this.latencyHistory.push(ageMs)
      if (this.latencyHistory.length > 500) this.latencyHistory.shift()
      if (tick.timestamp) perf.record('tick.age_ms', ageMs)
    }

    this._scheduleFeedBroadcast(status, now)
  }

  /** IST day for which the broker itself sent each symbol's previous close */
  private brokerPrevCloseDay = new Map<string, number>()

  /** Change against the previous close (none known: no change shown, rather than a wrong one) */
  private updateChange(status: SymbolFeedStatus) {
    const prev = status.prevClose
    if (!(prev > 0) || !(status.lastPrice > 0)) { status.change = 0; status.changePercent = 0; return }
    status.change = +(status.lastPrice - prev).toFixed(2)
    status.changePercent = +((status.lastPrice - prev) / prev * 100).toFixed(2)
  }

  /**
   * The previous session's close, worked out from stored bars (most brokers' feeds don't send
   * it). Ignored when the broker sent its own for `day` (IST day number).
   */
  setPrevClose(ticker: string, prevClose: number, day: number) {
    const status = this.feedStatuses.get(ticker)
    if (!status || !(prevClose > 0) || this.brokerPrevCloseDay.get(ticker) === day) return
    if (status.prevClose === prevClose) return
    status.prevClose = prevClose
    this.updateChange(status)
    this._scheduleFeedBroadcast(status, Date.now())
  }

  /**
   * Volume traded since the previous update. The feed sends periodic snapshots, not every trade,
   * so summing last-traded-qty misses most volume; the day's running total is diffed instead
   * (last-traded-qty only for feeds without one). The first total of a day is a baseline. A
   * total lower than the last one on the same day is an update that overtook a newer one, or
   * an empty field: ignored, so the next update doesn't count the whole day's volume again.
   */
  private volumeSince(key: string, tick: { volume: number; totalVolume?: number }, tickMs: number): number {
    if (!(typeof tick.totalVolume === 'number' && tick.totalVolume >= 0)) return tick.volume > 0 ? tick.volume : 0
    const day = Math.floor((tickMs + IST_MS) / DAY_MS)
    const prev = this.lastCumVolume.get(key)
    if (!prev || prev.day !== day) {
      this.lastCumVolume.set(key, { total: tick.totalVolume, day })
      return 0
    }
    let delta = tick.totalVolume - prev.total
    if (delta < -(2 ** 30)) delta += 2 ** 32          // int32 wrap on very heavy volume
    if (delta <= 0) return 0
    prev.total = tick.totalVolume
    return delta
  }

  /** True when a tick at `utcMs` is trading time for the exchange (special sessions on closed days count) */
  private inSession(utcMs: number, exchange: string): boolean {
    const ex = (exchange || 'NSE').toUpperCase()
    if (!FIXED_SESSION.has(ex)) return true
    const day = Math.floor((utcMs + IST_MS) / DAY_MS)
    const cacheKey = `${ex}:${day}`
    let s = this.sessionCache.get(cacheKey)
    if (s === undefined) {
      const noon = day * DAY_MS - IST_MS + 12 * 3600_000
      const w = getSessionWindowMs(noon, ex)
      s = w ? { closed: isWeekend(noon) || isClosedDay(noon, ex), openMs: w.openMs, closeMs: w.closeMs } : null
      if (this.sessionCache.size > 64) this.sessionCache.clear()
      this.sessionCache.set(cacheKey, s)
    }
    if (!s || s.closed) return true   // Muhurat trading and other special sessions
    return utcMs >= s.openMs && utcMs < s.closeMs
  }

  /** Closes a minute's bar once: handed to the database (bars without a price aren't saved) */
  private closeBar(key: string, bar: LiveBar, ticker: string) {
    if (bar.done) return
    bar.done = true
    if (!(bar.close > 0)) return
    const inst = this.instruments.get(key)
    this.emit('bar_finalized', { key, bar: { ...bar }, ticker, exchange: inst?.exchange || 'NSE' })
  }

  /**
   * Closes the bars of minutes that are over, for symbols whose next tick hasn't come: without
   * this a quiet symbol's last bar was saved only at its next trade (maybe the next day) and was
   * lost when the engine stopped first. The wait covers the feed's usual delay, so ticks stamped
   * in the last second of a minute still make it in.
   */
  closeFinishedMinutes(nowMs = Date.now()) {
    for (const [key, bar] of this.liveBars) {
      if (bar.bucketMs === 0 || bar.done) continue
      const inst = this.instruments.get(key)
      if (!inst) continue
      // The minute is over by the feed's clock (the PC's may be minutes off), plus the spread of
      // the feed's delays, so ticks stamped in its last second still make it in
      const clock = this.feedClock(inst.brokerId, nowMs)
      const feedNow = nowMs - clock.offsetMs
      if (feedNow >= bar.bucketMs + 60_000 + CLOSE_GRACE_MS + Math.min(MAX_EXTRA_WAIT_MS, clock.spreadMs)) {
        this.closeBar(key, bar, inst.ticker)
      }
    }
  }

  /** Recent tick ages per broker: arrival (PC clock) minus the exchange's stamp, so any PC clock offset included */
  private tickAges = new Map<string, number[]>()
  private clockCache = new Map<string, { at: number; offsetMs: number; spreadMs: number }>()
  private clockWarnedAt = 0

  private noteTickAge(brokerId: string, ageMs: number) {
    if (!(Math.abs(ageMs) < CLOCK_SAMPLE_MAX_MS)) return
    let ages = this.tickAges.get(brokerId)
    if (!ages) this.tickAges.set(brokerId, ages = [])
    ages.push(ageMs)
    if (ages.length > CLOCK_SAMPLES) ages.shift()
    // The first ticks of a feed place its clock at once (no waiting for the next recount)
    if (ages.length <= 20) this.clockCache.delete(brokerId)
  }

  /**
   * Where a broker's feed clock stands against the PC clock. offsetMs: how far the PC clock is
   * ahead of the exchange's stamps, from the freshest recent ticks (a low percentile, so an odd
   * stamp doesn't move it); negative when the PC clock is behind. spreadMs: how much later than
   * those the usual tick arrives. Worked out at most once a second.
   */
  private feedClock(brokerId: string, nowMs: number): { offsetMs: number; spreadMs: number } {
    const cached = this.clockCache.get(brokerId)
    if (cached && nowMs - cached.at < 1000 && nowMs >= cached.at) return cached
    const ages = this.tickAges.get(brokerId)
    let offsetMs = 0, spreadMs = 0
    if (ages?.length) {
      const sorted = [...ages].sort((a, b) => a - b)
      offsetMs = sorted[Math.floor((sorted.length - 1) * 0.05)]
      spreadMs = Math.max(0, sorted[Math.floor(sorted.length / 2)] - offsetMs)
    }
    this.clockCache.set(brokerId, { at: nowMs, offsetMs, spreadMs })
    if (Math.abs(offsetMs) > CLOCK_WARN_MS && (ages?.length ?? 0) >= 50 && nowMs - this.clockWarnedAt > 3600_000) {
      this.clockWarnedAt = nowMs
      const secs = Math.round(Math.abs(offsetMs) / 1000)
      this._emitLog('warn', 'LiveFeed', `This PC's clock is about ${secs} s ${offsetMs > 0 ? 'ahead of' : 'behind'} the exchange's time. Live candles use the exchange's time, so they are not affected; set Windows to sync its clock automatically to keep other programs right.`)
    }
    return { offsetMs, spreadMs }
  }

  private saveBar: ((e: { ticker: string; bar: LiveBar }) => void) | null = null

  private _startBarFlush() {
    // Closed bars go straight to the database's write buffer (committed every 2 s, and before
    // any read of bars, so AmiBroker never asks for a minute that is in neither place)
    if (this.saveBar) return
    this.saveBar = ({ ticker, bar }) => {
      insertBarBatch([{
        amibroker_ticker: ticker,
        ts_utc_ms: bar.bucketMs,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        open_interest: bar.oi ?? null,
      }])
    }
    this.on('bar_finalized', this.saveBar)
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

  // Measured, not made up: CPU and memory of this process, updates per second since the last look
  private cpuMark = { at: Date.now(), usage: process.cpuUsage() }
  private rateMark = { at: Date.now(), count: 0 }
  private lastCpu = 0
  private lastRate = 0

  _getCoreStats(): CoreEngineStats {
    const sorted = [...this.latencyHistory].sort((a, b) => a - b)
    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0
    const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0
    const now = Date.now()
    if (now - this.cpuMark.at >= 900) {
      const used = process.cpuUsage(this.cpuMark.usage)   // microseconds since the mark
      const cores = Math.max(1, os.cpus().length)
      this.lastCpu = ((used.user + used.system) / 1000) / ((now - this.cpuMark.at) * cores) * 100
      this.lastRate = (this.msgCount - this.rateMark.count) / ((now - this.rateMark.at) / 1000)
      this.cpuMark = { at: now, usage: process.cpuUsage() }
      this.rateMark = { at: now, count: this.msgCount }
    }

    return {
      cpuPercent: +this.lastCpu.toFixed(1),
      ramMb: Math.round(process.memoryUsage().rss / 1048576),
      uptimeSec: Math.floor((now - this.startTime) / 1000),
      messagesPerSec: Math.round(this.lastRate),
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
      status.internalLatencyMs = 0
      // Default to SUBSCRIBED so user immediately sees active feed upon addition
      status.status = 'SUBSCRIBED' as any
      this._scheduleFeedBroadcast(status, Date.now())
    }

    this._emitLog('info', 'LiveFeed', `Symbol added: ${ticker} (${inst.exchange})`)
  }

  /** Called by the IPC server whenever AmiBroker sends GET_QUOTES for this ticker. */
  private _streamingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  /**
   * Whether the broker streams this symbol (false: its plan's live places are taken, liveSlots.ts).
   * A symbol without a place shows "Not live" instead of a "Subscribed" that never gets a price.
   */
  setLivePlace(ticker: string, live: boolean) {
    const status = this.feedStatuses.get(ticker)
    if (!status) return
    if (!live && status.status !== 'NOT_LIVE') status.status = 'NOT_LIVE' as any
    else if (live && status.status === 'NOT_LIVE') status.status = 'SUBSCRIBED' as any
    else return
    this._scheduleFeedBroadcast(status, Date.now())
  }

  setStreaming(ticker: string) {
    const status = this.feedStatuses.get(ticker)
    if (!status) return
    // Only upgrade status, don't downgrade if already RECEIVING (real tick); a symbol without a
    // live place stays "Not live" while AmiBroker shows it
    if (status.status !== 'RECEIVING' && status.status !== 'NOT_LIVE') {
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

  /** Forgets every symbol (Clean Database, factory reset): no more bars or status for them. */
  removeAllInstruments() {
    this.instruments.clear()
    this.liveBars.clear()
    this.feedStatuses.clear()
    this.lastCumVolume.clear()
    this.lastOi.clear()
    this.lastArrival.clear()
    this.pendingStatusUpdates.clear()
    for (const timer of this._streamingTimers.values()) clearTimeout(timer)
    this._streamingTimers.clear()
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
    this._emitLog('info', 'LiveFeed', `Symbol removed: ${ticker}`)
  }
}

// Singleton
export const liveFeed = new LiveFeed()
