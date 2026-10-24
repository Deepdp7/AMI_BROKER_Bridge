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
import { stmts, upsertBarsToHistory, validateBar, repairBar, getAllSettings, upsertSettings } from '../db'
import { brokerManager } from './BrokerManager'
import { backfillQueue } from './BackfillQueue'

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
  private notifySync: (ticker: string) => void = () => {}

  start(notifySync: (ticker: string) => void) {
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

  private scheduleNext() {
    const base = this.status.lastRunAt ?? Date.now()
    this.status.nextRunAt = this.status.enabled ? Math.max(Date.now(), base + this.status.intervalMin * 60_000) : null
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
    // Don't compete with a history download for the broker's rate limit; try again next tick
    if (backfillQueue.getQueueLength() > 0) {
      if (this.status.waitingFor !== 'history-download') {
        this.status.waitingFor = 'history-download'
        this.publish()
      }
      return
    }

    this.status.waitingFor = null
    if (closePass) this.closePassDoneFor = date
    this.run(closePass).catch(err => {
      this.status.lastError = err?.message || String(err)
      console.error('[AutoRefresh] Run failed:', this.status.lastError)
      this.publish()
    })
  }

  private async run(fullDay: boolean) {
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
    const writeFromMs = full ? 0 : (this.status.lastRunAt ?? 0) - RECHECK_MS

    const symbols = (stmts.getSymbols.all() as any[]).filter(s => (s.brokerId || s.broker_id) && (s.brokerId || s.broker_id) !== 'orphaned')
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
          const bars: any[] = await adapter.getHistoricalBars(token, '1m', from, to)
          const good = (bars || []).map(repairBar).filter(b => b.ts >= writeFromMs && validateBar(b.open, b.high, b.low, b.close, b.volume))
          if (good.length > 0) {
            const changed = await upsertBarsToHistory(ticker, good.map(b => `${Math.floor(b.ts / 1000)},${b.open},${b.high},${b.low},${b.close},${b.volume}`))
            if (changed > 0) {
              // Only make AmiBroker re-read symbols whose data actually changed
              this.notifySync(ticker)
              barsChanged += changed
            }
            barsSaved += good.length
          }
          symbolsDone++
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

    try {
      // Small worker pool: requests overlap; the adapter's rate limiter spaces their starts
      let next = 0
      const worker = async () => {
        while (next < symbols.length && this.status.enabled) {
          await refreshOne(symbols[next++])
          this.status.progressDone++
          this.publishThrottled()
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker))
      if (full && symbolsDone > 0) this.fullPassDoneFor = date
    } finally {
      this.status.running = false
      this.status.lastRunAt = started
      this.status.lastRunSymbols = symbolsDone
      this.status.lastRunBars = barsSaved
      this.scheduleNext()
      const secs = ((Date.now() - started) / 1000).toFixed(1)
      console.log(`[AutoRefresh] Checked ${symbolsDone} symbol(s) against the broker in ${secs}s — ${barsChanged} bar(s) corrected${full ? ' (full day)' : ''}`)
      this.publish()
    }
  }

  private lastPublishAt = 0
  private publishThrottled() {
    if (Date.now() - this.lastPublishAt < 250) return
    this.lastPublishAt = Date.now()
    this.publish()
  }
}

export const autoRefresh = new AutoRefreshService()
