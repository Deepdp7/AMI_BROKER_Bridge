/**
 * AutoRefresh.ts
 *
 * Automatic version of the "Refresh All Today" button. While the market is open it
 * re-downloads today's official 1-minute bars for every symbol every N minutes and
 * upserts them, so candles built from live ticks are replaced by the broker's exact
 * OHLCV, then tells the AmiBroker plugin to re-sync (SYNC|ticker). One final pass
 * runs just after the close so the day ends with exchange-accurate data.
 *
 * Runs quietly: no backfill banner / desktop notifications (unlike the manual button).
 */
import { EventEmitter } from 'events'
import { stmts, upsertBarsToHistory, historyRangeSec, validateBar, repairBar, getAllSettings, upsertSettings } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { withPriority } from '../lib/priority'
import { learnClosedDays } from './MarketCalendar'
import { liveFeed } from './liveFeed'
import { lastViewedAt } from './liveSlots'

export interface AutoRefreshStatus {
  enabled: boolean
  intervalMin: number
  running: boolean
  lastRunAt: number | null
  lastRunSymbols: number
  lastRunBars: number
  nextRunAt: number | null
  lastError: string | null
  progressDone: number
  progressTotal: number
  /** Why a due sync hasn't started yet (e.g. a history download is using the broker's rate limit) */
  waitingFor: 'history-download' | null
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000
const CONCURRENCY = 6            // request pacing comes from the broker adapter's shared rate limiter
const RECHECK_MS = 5 * 60_000    // incremental passes re-check the minutes since the last pass plus this margin
const ALLOWED_INTERVALS = [1, 2, 3, 5, 10, 15, 30]
/** A symbol with a live tick this recent is streaming: its bars are being built from the feed */
const LIVE_RECENT_MS = 3 * 60_000
/** Shown in AmiBroker this recently: refreshed first */
const VIEWED_RECENT_MS = 2 * 60_000
/** Requests a broker with a daily allowance keeps back beyond one after-close pass (repairs, new symbols) */
const ALLOWANCE_MARGIN = 150

/** History requests a broker still allows today (Infinity: no daily cap) */
function requestsLeft(adapter: any): number {
  const left = adapter?.historyRequestsLeftToday?.()
  return typeof left === 'number' ? left : Infinity
}

function istNow() {
  const ist = new Date(Date.now() + IST_OFFSET_MS)
  return { day: ist.getUTCDay(), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(), date: ist.toISOString().slice(0, 10) }
}

class AutoRefreshService extends EventEmitter {
  private status: AutoRefreshStatus = {
    enabled: true, intervalMin: 5, running: false,
    lastRunAt: null, lastRunSymbols: 0, lastRunBars: 0, nextRunAt: null, lastError: null,
    progressDone: 0, progressTotal: 0, waitingFor: null,
  }
  private timer: NodeJS.Timeout | null = null
  private closePassDoneFor = ''
  private fullPassDoneFor = ''
  private notifySync: (ticker: string, fromSec?: number, toSec?: number) => void = () => {}

  start(notifySync: (ticker: string, fromSec?: number, toSec?: number) => void) {
    this.notifySync = notifySync
    const s = getAllSettings() as any
    if (s.autoRefreshEnabled !== undefined) this.status.enabled = String(s.autoRefreshEnabled) !== 'false'
    const iv = Number(s.autoRefreshIntervalMin)
    if (ALLOWED_INTERVALS.includes(iv)) this.status.intervalMin = iv
    this.scheduleNext()
    if (!this.timer) this.timer = setInterval(() => this.tick(), 5_000)
  }

  getStatus(): AutoRefreshStatus { return { ...this.status } }

  configure(opts: { enabled?: boolean; intervalMin?: number }) {
    if (typeof opts.enabled === 'boolean') {
      this.status.enabled = opts.enabled
      upsertSettings('autoRefreshEnabled', String(opts.enabled))
    }
    if (opts.intervalMin !== undefined) {
      if (!ALLOWED_INTERVALS.includes(opts.intervalMin)) throw new Error(`intervalMin must be one of ${ALLOWED_INTERVALS.join(', ')}`)
      this.status.intervalMin = opts.intervalMin
      upsertSettings('autoRefreshIntervalMin', String(opts.intervalMin))
    }
    this.scheduleNext()
    this.publish()
  }

  /** How long the last run took: the next one waits at least that long */
  private lastRunMs = 0
  /** Start of the last pass that reached every symbol: incremental passes re-check from there */
  private lastCompleteRunAt: number | null = null
  /** ticker → when its bars were last checked against the broker (the least recent go first) */
  private refreshedAt = new Map<string, number>()
  /**
   * Minutes between passes the brokers' daily allowance stretches to (0: the interval set): a
   * pass costs one request per symbol, and the day's requests must last until the close.
   */
  private stretchMin = 0

  private scheduleNext() {
    // From the end of the last run, and never sooner than it took: with many symbols a run
    // fills the broker's rate limit for minutes, and back-to-back runs left nothing for downloads
    // (57 symbols, 1-min interval: runs of 4-5 min, one after the other, all afternoon).
    const base = this.status.lastRunAt !== null ? this.status.lastRunAt + this.lastRunMs : Date.now()
    const gap = Math.max(this.status.intervalMin * 60_000, this.stretchMin * 60_000, this.lastRunMs)
    this.status.nextRunAt = this.status.enabled ? Math.max(Date.now(), base + gap) : null
  }

  private publish() { this.emit('status', this.getStatus()) }

  private tick() {
    if (!this.status.enabled || this.status.running) return
    const { day, minutes, date } = istNow()
    const weekday = day !== 0 && day !== 6
    const inSession = weekday && minutes >= 9 * 60 + 16 && minutes < 15 * 60 + 30
    // One final pass shortly after the close so the whole day matches the exchange
    const closePass = weekday && minutes >= 15 * 60 + 32 && minutes < 16 * 60 && this.closePassDoneFor !== date

    if (!inSession && !closePass) {
      // Outside market hours: tell the UI once ("Starts at market open")
      if (this.status.nextRunAt !== null || this.status.waitingFor) {
        this.status.nextRunAt = null
        this.status.waitingFor = null
        this.publish()
      }
      return
    }
    if (this.status.nextRunAt === null) { this.scheduleNext(); this.publish() }
    if (!closePass && this.status.nextRunAt && Date.now() < this.status.nextRunAt) return
    // A history download no longer holds a pass back: the broker's rate limiter serves a refresh
    // before a bulk download request (lib/priority.ts), and on a plan with few live places the refresh
    // is the only way the other symbols get today's bars. `waitingFor` stays for the page that shows it.
    if (this.status.waitingFor !== null) { this.status.waitingFor = null; this.publish() }
    if (closePass) this.closePassDoneFor = date
    this.run(closePass).then(finished => {
      // A close pass cut short (auto-refresh turned off meanwhile) runs again (until 16:00)
      if (closePass && !finished) this.closePassDoneFor = ''
    }).catch(err => {
      this.status.lastError = err?.message || String(err)
      console.error('[AutoRefresh] Run failed:', this.status.lastError)
      this.publish()
    })
  }

  /** One pass over every symbol; false when it stopped early (auto-refresh turned off) */
  private async run(fullDay: boolean): Promise<boolean> {
    this.status.running = true
    this.status.lastError = null
    this.status.progressDone = 0
    const started = Date.now()
    let symbolsDone = 0, barsSaved = 0, barsChanged = 0

    // Midnight IST today → now (Fyers returns the whole day for date-based ranges)
    const { date } = istNow()
    const from = new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS)
    const to = new Date()
    // After the day's first full pass only recent minutes can still differ from the broker,
    // so only those are written (the post-close pass re-checks the whole day).
    const full = fullDay || this.fullPassDoneFor !== date
    const writeFromMs = full ? 0 : (this.lastCompleteRunAt ?? 0) - RECHECK_MS

    const tracked = (stmts.getSymbols.all() as any[]).filter(s => (s.brokerId || s.broker_id) && (s.brokerId || s.broker_id) !== 'orphaned')
    const symbols = this.passSymbols(tracked, fullDay, started)
    this.status.progressTotal = symbols.length
    this.publish()

    const refreshOne = async (sym: any) => {
      const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
      const adapter: any = brokerManager.getAdapter(sym.brokerId || sym.broker_id)
      if (!ticker || !adapter) return
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = sym.rawSymbol || sym.raw_symbol || ticker
          const token = adapter.resolveSymbol ? await adapter.resolveSymbol(raw, sym.exchange) : raw
          const bars: any[] = await withPriority<any[]>('refresh', () => adapter.getHistoricalBars(token, '1m', from, to))
          const good = (bars || []).map(repairBar).filter(b => b.ts >= writeFromMs && validateBar(b.open, b.high, b.low, b.close, b.volume))
          if (good.length > 0) {
            const changed = await upsertBarsToHistory(ticker, good)
            learnClosedDays(sym.exchange || 'NSE', ticker, from.getTime(), to.getTime(), good)
            if (changed > 0) {
              // Only make AmiBroker re-read symbols whose data actually changed
              const { fromSec, toSec } = historyRangeSec(good)
              this.notifySync(ticker, fromSec, toSec)
              barsChanged += changed
            }
            barsSaved += good.length
          }
          symbolsDone++
          this.refreshedAt.set(ticker, Date.now())
          return
        } catch (err: any) {
          const msg = err?.message || String(err)
          if (attempt === 0 && (err?.code === 429 || /429|request limit/i.test(msg))) {
            // The adapter's shared rate limiter has already paused all requests; retry once
            console.warn(`[AutoRefresh] Rate limited by broker on ${ticker} — retrying`)
            continue
          }
          console.warn(`[AutoRefresh] ${ticker}: ${msg}`)
          return
        }
      }
    }

    let next = 0
    try {
      // Small worker pool: requests overlap; the adapter's rate limiter spaces their starts
      const worker = async () => {
        while (next < symbols.length && this.status.enabled) {
          await refreshOne(symbols[next++])
          this.status.progressDone++
          this.publishThrottled()
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker))
      if (next >= symbols.length) this.lastCompleteRunAt = started
      if (full && next >= symbols.length && symbolsDone > 0) this.fullPassDoneFor = date
    } finally {
      this.status.running = false
      this.status.lastRunAt = started
      this.lastRunMs = Date.now() - started
      this.status.lastRunSymbols = symbolsDone
      this.status.lastRunBars = barsSaved
      this.scheduleNext()
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      const stopped = next < symbols.length ? ` — stopped early, auto-refresh was turned off (${symbols.length - next} left)` : ''
      console.log(`[AutoRefresh] Checked ${symbolsDone} symbol(s) against the broker in ${secs}s — ${barsChanged} bar(s) corrected${full ? ' (full day)' : ''}${stopped}`)
      this.publish()
    }
    return next >= symbols.length
  }

  /**
   * The symbols one pass checks, in order. During the market, on a broker with a daily request
   * allowance (Fyers Standard: 5,000), symbols streaming live prices are left to the after-close
   * pass: the allowance goes to those without (their only source until then). The rest go
   * shown-in-AmiBroker first, then longest since checked, so a pass cut short by a download
   * doesn't leave the same symbols at the end of the list unchecked all day. A broker whose
   * allowance is down to one after-close pass gets no more passes until then, and the time
   * between passes stretches so the day's allowance lasts until the close.
   */
  private passSymbols(tracked: any[], fullDay: boolean, nowMs: number): any[] {
    const tickerOf = (s: any) => s.amiBrokerTicker || s.amibroker_ticker
    const adapterOf = (s: any) => brokerManager.getAdapter(s.brokerId || s.broker_id) as any
    const perBroker = new Map<any, number>()
    for (const s of tracked) perBroker.set(adapterOf(s), (perBroker.get(adapterOf(s)) ?? 0) + 1)
    const streaming = (ticker: string) => {
      const st = liveFeed.getFeedStatus(ticker)
      return !!st && (st.status === 'RECEIVING' || st.status === 'STREAMING') && nowMs - (st.lastTickUtcMs || 0) < LIVE_RECENT_MS
    }

    let list = tracked
    let held = 0
    this.stretchMin = 0
    if (!fullDay) {
      list = tracked.filter(s => {
        const adapter = adapterOf(s)
        const left = requestsLeft(adapter)
        if (!Number.isFinite(left)) return true
        if (left <= (perBroker.get(adapter) ?? 0) + ALLOWANCE_MARGIN) { held++; return false }
        return !streaming(tickerOf(s))
      })
      // Space the passes so what is left lasts until the close (one request per symbol and pass)
      const ist = new Date(nowMs + IST_OFFSET_MS)
      const minutesLeft = Math.max(1, 15 * 60 + 30 - (ist.getUTCHours() * 60 + ist.getUTCMinutes()))
      for (const [adapter, count] of perBroker) {
        const left = requestsLeft(adapter)
        if (!Number.isFinite(left)) continue
        const cost = list.filter(s => adapterOf(s) === adapter).length
        const spare = left - count - ALLOWANCE_MARGIN
        if (cost > 0 && spare > 0) this.stretchMin = Math.max(this.stretchMin, Math.ceil(minutesLeft * cost / spare))
      }
      if (held) console.log(`[AutoRefresh] ${held} symbol(s) wait for the after-close pass: their broker's daily history allowance is nearly used up`)
      else if (this.stretchMin > this.status.intervalMin) console.log(`[AutoRefresh] Passes every ${this.stretchMin} min (not ${this.status.intervalMin}) so the broker's daily history allowance lasts until the close`)
    }
    const viewed = (s: any) => nowMs - lastViewedAt(tickerOf(s)) < VIEWED_RECENT_MS ? 1 : 0
    return [...list].sort((a, b) =>
      viewed(b) - viewed(a) || (this.refreshedAt.get(tickerOf(a)) ?? 0) - (this.refreshedAt.get(tickerOf(b)) ?? 0))
  }

  private lastPublishAt = 0
  private publishThrottled() {
    if (Date.now() - this.lastPublishAt < 250) return
    this.lastPublishAt = Date.now()
    this.publish()
  }
}

export const autoRefresh = new AutoRefreshService()
