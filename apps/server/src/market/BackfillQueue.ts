/**
 * BackfillQueue.ts
 *
 * Production-grade, rate-limited FIFO queue for historical candle backfilling.
 *
 * Features:
 * - Incremental backfill (only missing range, not full history)
 * - Configurable chunk size, delay, and retry count (from AppSettings)
 * - Exponential backoff on 429 rate-limit errors
 * - Per-ticker backfill lock (prevents duplicate downloads)
 * - OHLCV data validation before storage
 * - Emits WS events: backfill_progress, backfill_completed, backfill_failed
 * - Gap-fill support: accepts arbitrary from/to date ranges
 * - Bulk upsert via upsertBarsToHistory (dedup + compact in one pass)
 */

import { EventEmitter } from 'events'
import {
  stmts,
  flushPendingBars,
  deduplicateAndCompactDiskBars,
  upsertBarsToHistory,
  validateBar,
  repairBar,
  getAllSettings,
  getOldestBarTimestampSec
} from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { backfilledTickers } from './state/backfillState'
import { getVerifiedThroughMs, setVerifiedThroughMs, getHistoryFloorMs, setHistoryFloorMs } from './state/coverageState'
import { detectGaps, formatGapSummary } from './GapDetector'
import { learnClosedDays } from './MarketCalendar'
import type { BackfillStatus, BackfillJobStatus } from '../types'
import path from 'path'
import fs from 'fs'

/** Exchange of a tracked symbol (NSE when unknown) */
function exchangeOf(ticker: string): string {
  const sym = (stmts.getSymbols.all() as any[]).find(s => (s.amiBrokerTicker || s.amibroker_ticker) === ticker)
  return sym?.exchange || 'NSE'
}

export interface BackfillTask {
  ticker: string
  brokerId: string
  brokerToken: string
  targetTo: Date            // Absolute newest date we want (end boundary)
  currentFrom: Date         // Oldest date we want (start boundary)
  cursorTo?: Date           // End of the next chunk: walks backwards from targetTo (newest first)
  retryCount: number
  depthDays: number
  isGapFill: boolean        // True if this is a gap-fill task (not initial/incremental)
  gapFrom?: Date            // For gap fills: the exact start of the gap
  pass?: GapPass            // Gap-detection pass this task belongs to
  skippedChunk?: boolean    // A chunk was given up after max retries (range not fully filled)
  floorMs?: number          // On full success, history is known complete back to here
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Futures history window (days): near-month contracts only have about two months of trading worth keeping */
export const FUTURES_HISTORY_DAYS = 60
const FUTURES_RE = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i
/** Deepest history the app will request (10 years). Fyers' 1-minute data starts around 2017-18. */
export const MAX_HISTORY_DAYS = 3650

/** All gaps found by one detection scan of a ticker; when every one fills, the scan range is verified. */
interface GapPass {
  ticker: string
  scanToMs: number
  remaining: number
  ok: boolean
}

// ===== Exported status store (used by /api/backfill routes) =====
export const backfillStatusMap = new Map<string, BackfillStatus>()

class BackfillQueueService extends EventEmitter {
  private queue: BackfillTask[] = []
  private readonly CONCURRENCY = 6   // parallel chunk downloads; the adapter's rate limiter keeps them within broker limits
  private workers = 0
  private busyTickers = new Set<string>()
  private priorityTickers = new Set<string>()  // open in AmiBroker: download before the rest
  private kickTimer: NodeJS.Timeout | null = null
  private activeTickers = new Set<string>()
  private consecutiveAuthErrors = 0
  private tokenPausedUntil = 0
  private tokenPermanentlyPaused = false
  private readonly MAX_CONSECUTIVE_AUTH_ERRORS = 3
  private readonly MAX_ABSOLUTE_AUTH_ERRORS = 5  // after this, stop until manual re-auth
  private readonly TOKEN_PAUSE_MS = 60_000 // 1 minute pause if token is dead

  public getStatus(ticker: string): BackfillStatus | undefined {
    return backfillStatusMap.get(ticker)
  }

  public getAllStatuses(): BackfillStatus[] {
    return Array.from(backfillStatusMap.values())
  }

  /**
   * Enqueue an incremental or initial backfill for a ticker.
   * If the ticker is already in the active set, it is skipped (lock).
   */
  private _isValidTicker(ticker: string): boolean {
    if (!ticker || ticker.trim().length < 2) return false
    // Reject headers/garbage like "SYMBOL NAME", "Symbol", strings with spaces that aren't futures
    if (/\s/.test(ticker) && !ticker.includes('26') && !ticker.includes('27')) return false
    return true
  }

  public enqueue(ticker: string, brokerId: string, brokerToken: string | number = '', depthDays: number = 365) {
    if (!ticker) {
      console.warn(`[BackfillQueue] Skipping invalid ticker: "${ticker}"`)
      return
    }
    
    let safeBrokerToken = typeof brokerToken === 'string' ? brokerToken : String(brokerToken)
    if (this.activeTickers.has(ticker) || backfilledTickers.has(ticker)) return
    // History already downloaded and verified once — newer gaps are handled by the
    // startup/daily gap passes. (Manual re-download and symbol delete clear the watermark.)
    if (getVerifiedThroughMs(ticker)) return

    const adapter = brokerManager.getAdapter(brokerId)
    if (!adapter) return

    this.activeTickers.add(ticker)

    Promise.resolve().then(async () => {
      try {
        // We now receive exact brokerToken directly; no regex guesswork needed!
        let resolvedToken = safeBrokerToken;
        if ((!resolvedToken || resolvedToken === ticker) && adapter.resolveSymbol) {
          const symRecord = (stmts.getSymbols.all() as any[]).find((s: any) => (s.amiBrokerTicker || s.amibroker_ticker) === ticker);
          resolvedToken = await adapter.resolveSymbol(ticker, symRecord?.exchange);
        }
        if (!resolvedToken) resolvedToken = ticker;
        // Futures contracts only trade ~3 months and are tracked for the near month: history = last 2 months
        if (FUTURES_RE.test(ticker)) depthDays = Math.min(depthDays, FUTURES_HISTORY_DAYS)
        const targetTo = new Date()
        const currentFrom = new Date(Date.now() - depthDays * 24 * 60 * 60 * 1000)
        const totalChunks = Math.ceil(depthDays / this.chunkDaysFor(adapter))

        this.queue.push({
          ticker,
          brokerId,
          brokerToken: resolvedToken,
          targetTo,
          currentFrom,
          retryCount: 0,
          depthDays,
          isGapFill: false,
          floorMs: currentFrom.getTime(),
        })

        backfillStatusMap.set(ticker, {
          ticker,
          brokerId,
          status: 'pending',
          progress: 0,
          candlesFetched: 0,
          totalChunks,
          completedChunks: 0,
          fromDate: currentFrom.toISOString().split('T')[0],
          toDate: targetTo.toISOString().split('T')[0],
          startedAt: Date.now(),
          retryCount: 0,
        })

        console.log(`[Backfill] ${ticker} : Queued for backfill (${depthDays} days)`)
        this.emit('backfill_progress', { ticker, ...backfillStatusMap.get(ticker) })
        this.processNext()
      } catch (err) {
        console.error(`[BackfillQueue] Failed to resolve symbol for ${ticker}:`, err)
        this.activeTickers.delete(ticker)
      }
    })
  }

  /**
   * Enqueue a targeted gap-fill for a specific date range.
   * Used by GapDetector results.
   */
  public enqueueGapFill(ticker: string, brokerId: string, brokerToken: string | number = '', fromMs: number, toMs: number, forceEvenDuringMarket = false, pass?: GapPass, floorMs?: number) {
    const gapKey = `${ticker}:gap:${fromMs}`
    if (this.activeTickers.has(gapKey)) { this.settlePass(pass, false); return }
    
    let safeBrokerToken = typeof brokerToken === 'string' ? brokerToken : String(brokerToken)

    const adapter = brokerManager.getAdapter(brokerId)
    if (!adapter) { this.settlePass(pass, false); return }

    this.activeTickers.add(gapKey)
    this.activeTickers.add(ticker)

    Promise.resolve().then(async () => {
      try {
        // Use exact token passed from task context
        let resolvedToken = safeBrokerToken;
        if ((!resolvedToken || resolvedToken === ticker) && adapter.resolveSymbol) {
          const symRecord = (stmts.getSymbols.all() as any[]).find((s: any) => (s.amiBrokerTicker || s.amibroker_ticker) === ticker);
          resolvedToken = await adapter.resolveSymbol(ticker, symRecord?.exchange);
        }
        if (!resolvedToken) resolvedToken = ticker;
        const gapFrom = new Date(fromMs)
        const targetTo   = new Date(toMs)
        const depthDays = Math.max(1, Math.ceil((toMs - fromMs) / (24 * 3600 * 1000)))

        // Skip same-day gaps ONLY if the gap is very recent (< 5 min ago).
        // Past intra-day gaps (e.g. app was closed during trading) must always be filled.
        // After market close, Fyers has full historical data for today — always allow the fill.
        // forceEvenDuringMarket=true bypasses all skip logic (used by manual "Refresh Today" button).
        const isSameDay = gapFrom.toISOString().split('T')[0] === targetTo.toISOString().split('T')[0]
        if (isSameDay && !forceEvenDuringMarket) {
          const nowMs = Date.now()
          const nowIST = new Date(nowMs + 5.5 * 3600 * 1000)
          const istHHMM = nowIST.getUTCHours() * 100 + nowIST.getUTCMinutes()
          const isMarketOpen = istHHMM >= 915 && istHHMM < 1530  // 9:15 AM to 3:30 PM IST
          if (isMarketOpen) {
            // Only skip if the gap STARTS within the last 5 minutes — live ticks handle those.
            // If gap starts more than 5 minutes ago, it means the app was closed — fill it!
            const fiveMinAgoMs = nowMs - 5 * 60 * 1000
            if (gapFrom.getTime() >= fiveMinAgoMs) {
              // Very recent gap — live ticks will cover it, skip
              this.activeTickers.delete(gapKey)
              this.activeTickers.delete(ticker)
              this.settlePass(pass, true)
              return
            }
            // Past intra-day gap (app was closed) — fill it even during live market
            console.log(`[BackfillQueue] Intra-day gap fill (app was closed during market): ${ticker} ${gapFrom.toISOString().slice(0, 16)} → ${targetTo.toISOString().slice(0, 16)}`)
          } else {
            // After market close: always allow
            console.log(`[BackfillQueue] Same-day gap fill allowed (market closed): ${ticker} ${gapFrom.toISOString().slice(0, 16)} → ${targetTo.toISOString().slice(0, 16)}`)
          }
        } else if (forceEvenDuringMarket) {
          console.log(`[BackfillQueue] FORCE today-backfill (manual): ${ticker} ${gapFrom.toISOString().slice(0, 16)} → ${targetTo.toISOString().slice(0, 16)}`)
        }

        this.queue.push({
          ticker,
          brokerId,
          brokerToken: resolvedToken,
          targetTo,
          currentFrom: gapFrom,
          retryCount: 0,
          depthDays,
          isGapFill: true,
          gapFrom,
          pass,
          floorMs,
        })

        const existingStatus = backfillStatusMap.get(ticker)
        if (!existingStatus || existingStatus.status !== 'completed' || floorMs !== undefined) {
          backfillStatusMap.set(ticker, {
            ticker,
            brokerId,
            status: 'pending',
            progress: 0,
            candlesFetched: floorMs !== undefined ? 0 : existingStatus?.candlesFetched || 0,
            totalChunks: Math.max(1, Math.ceil(depthDays / this.chunkDaysFor(adapter))),
            completedChunks: 0,
            fromDate: gapFrom.toISOString().split('T')[0],
            toDate: targetTo.toISOString().split('T')[0],
            startedAt: Date.now(),
            retryCount: 0,
          })
        }

        console.log(`[BackfillQueue] Enqueued gap-fill for ${ticker}: ${gapFrom.toISOString().split('T')[0]} → ${targetTo.toISOString().split('T')[0]}`)
        this.emit('backfill_progress', { ticker, ...backfillStatusMap.get(ticker) })
        this.processNext()
      } catch (err) {
        console.error(`[BackfillQueue] Failed to enqueue gap-fill for ${ticker}:`, err)
        this.activeTickers.delete(gapKey)
        this.settlePass(pass, false)
      }
    })
  }

  /**
   * Make history reach back `depthDays`: when the depth setting grows (e.g. 1 → 5 years),
   * download only the older range that is missing, below the oldest stored bar.
   * Returns true if a download was queued.
   */
  public async extendHistory(ticker: string, brokerId: string, brokerToken: string | number, depthDays: number): Promise<boolean> {
    const desiredFromMs = Date.now() - depthDays * DAY_MS
    const floor = getHistoryFloorMs(ticker)
    if (floor !== undefined && floor <= desiredFromMs + DAY_MS) return false   // already asked the broker
    if (!brokerManager.getAdapter(brokerId)) return false
    const oldestSec = await getOldestBarTimestampSec(ticker)
    if (!oldestSec) return false   // nothing stored yet — the normal full backfill covers the whole depth
    const oldestMs = oldestSec * 1000
    if (oldestMs - desiredFromMs < 3 * DAY_MS) {
      setHistoryFloorMs(ticker, desiredFromMs)
      return false
    }
    console.log(`[Backfill] ${ticker} : Extending history back to ${new Date(desiredFromMs).toISOString().slice(0, 10)} (${Math.round((oldestMs - desiredFromMs) / DAY_MS)} days)`)
    this.enqueueGapFill(ticker, brokerId, brokerToken, desiredFromMs, oldestMs, false, undefined, desiredFromMs)
    return true
  }

  /** extendHistory for every tracked symbol (after the depth setting grows, and at startup). */
  public async extendAllHistory(depthDays: number): Promise<number> {
    let queued = 0
    for (const sym of stmts.getSymbols.all() as any[]) {
      const brokerId = sym.brokerId || sym.broker_id
      const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
      if (!brokerId || brokerId === 'orphaned' || !ticker) continue
      // Futures contracts only exist for ~3 months; their depth is capped elsewhere
      if (/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.test(ticker)) continue
      const token = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
      if (await this.extendHistory(ticker, brokerId, token, depthDays)) queued++
    }
    if (queued) console.log(`[Backfill] Downloading older history for ${queued} symbol(s) (depth ${depthDays} days)`)
    return queued
  }

  /**
   * Enqueue every gap found by one detection scan of `ticker` that ended at `scanToMs`.
   * When all of them complete without errors (or there were none), the ticker's coverage
   * watermark advances to `scanToMs` so the next scan starts there.
   */
  public enqueueGapPass(ticker: string, brokerId: string, brokerToken: string | number, gaps: { fromMs: number, toMs: number }[], scanToMs: number) {
    if (gaps.length === 0) {
      setVerifiedThroughMs(ticker, scanToMs)
      return
    }
    const pass: GapPass = { ticker, scanToMs, remaining: gaps.length, ok: true }
    for (const gap of gaps) {
      this.enqueueGapFill(ticker, brokerId, brokerToken, gap.fromMs, gap.toMs, false, pass)
    }
  }

  private settlePass(pass: GapPass | undefined, ok: boolean) {
    if (!pass) return
    if (!ok) pass.ok = false
    pass.remaining--
    if (pass.remaining === 0 && pass.ok) {
      setVerifiedThroughMs(pass.ticker, pass.scanToMs)
    }
  }

  public enqueueBatch(items: { ticker: string; brokerId: string; brokerToken?: string; depthDays?: number }[]) {
    for (const item of items) {
      this.enqueue(item.ticker, item.brokerId, item.brokerToken || '', item.depthDays ?? 365)
    }
  }

  /**
   * AmiBroker is loading this ticker (a chart, scan or exploration): move its downloads to the
   * front and keep them there until done. Cheap when the ticker has nothing queued.
   */
  public prioritize(ticker: string) {
    if (!this.queue.some(t => t.ticker === ticker)) return
    this.priorityTickers.add(ticker)
    const mine = this.queue.filter(t => t.ticker === ticker)
    this.queue = [...mine, ...this.queue.filter(t => t.ticker !== ticker)]
  }

  public cancel(ticker: string) {
    this.priorityTickers.delete(ticker)
    this.queue = this.queue.filter(t => t.ticker !== ticker)
    this.activeTickers.delete(ticker)
    backfillStatusMap.delete(ticker)
    console.log(`[BackfillQueue] Cancelled all pending backfill tasks for ${ticker}`)
  }

  /** Drops every queued download (Clean Database, factory reset). Chunks already in flight finish. */
  public cancelAll() {
    this.queue = []
    this.activeTickers.clear()
    this.priorityTickers.clear()
    backfillStatusMap.clear()
  }

  public getQueueLength(): number {
    return this.queue.length
  }

  public resumeAfterAuth() {
    this.consecutiveAuthErrors = 0
    this.tokenPausedUntil = 0
    this.tokenPermanentlyPaused = false
    console.log('[BackfillQueue] Auth resumed. Restarting queue...')
    this.processNext()
  }

  /**
   * Update all queued tasks from an old brokerId to a new brokerId.
   * Called after OAuth re-authentication so tasks use the fresh token.
   */
  public updateBrokerInQueue(oldBrokerId: string, newBrokerId: string): number {
    let updated = 0
    for (const task of this.queue) {
      if (task.brokerId === oldBrokerId) {
        task.brokerId = newBrokerId
        updated++
      }
    }
    if (updated > 0) {
      console.log(`[BackfillQueue] Migrated ${updated} queue tasks: ${oldBrokerId} → ${newBrokerId}`)
    }
    return updated
  }

  /** Starts workers (up to CONCURRENCY) for queued tasks. Safe to call at any time. */
  private processNext() {
    if (this.queue.length === 0) return

    // Permanently paused — don't retry until manual re-auth (resumeAfterAuth called)
    if (this.tokenPermanentlyPaused) {
      console.warn('[BackfillQueue] Auth permanently failed. Queue stopped. Re-authenticate to resume.')
      return
    }

    // Token pause check: if we got too many auth errors, wait before trying again
    if (Date.now() < this.tokenPausedUntil) {
      const waitMs = this.tokenPausedUntil - Date.now()
      console.warn(`[BackfillQueue] Token paused. Waiting ${Math.round(waitMs/1000)}s before resuming...`)
      this.kickLater(waitMs + 500)
      return
    }

    while (this.workers < this.CONCURRENCY && this.nextRunnable()) {
      this.workers++
      this.runWorker()
        .catch(err => { console.error(`[BackfillQueue] FATAL error in queue execution:`, err); return 'idle' as const })
        .then(result => {
          this.workers--
          if (this.queue.length === 0) return
          if (result === 'stalled') this.kickLater(5000) // broker not connected yet
          else if (result === 'paused') this.kickLater(Math.max(0, this.tokenPausedUntil - Date.now()) + 500)
          else this.kickLater(10)
        })
    }
  }

  private kickLater(ms: number) {
    if (this.kickTimer) return
    this.kickTimer = setTimeout(() => { this.kickTimer = null; this.processNext() }, ms)
  }

  /** First queued task whose ticker isn't already being fetched (one chunk per ticker at a time). */
  private nextRunnable(): BackfillTask | undefined {
    return this.queue.find(t => !this.busyTickers.has(t.ticker))
  }

  private removeTask(task: BackfillTask) {
    const i = this.queue.indexOf(task)
    if (i >= 0) this.queue.splice(i, 1)
  }

  /** Chunk size: the broker's own per-request cap when it declares one, else the setting. */
  private chunkDaysFor(adapter: any): number {
    const settings = getAllSettings() as any
    return Number(adapter?.maxIntradayHistoryDays) || Number(settings?.historyChunkDays) || 30
  }

  private async runWorker(): Promise<'idle' | 'stalled' | 'paused'> {
    for (;;) {
      if (this.tokenPermanentlyPaused || Date.now() < this.tokenPausedUntil) return 'paused'
      const task = this.nextRunnable()
      if (!task) return 'idle'
      this.busyTickers.add(task.ticker)
      try {
        if (!(await this.processChunk(task))) return 'stalled'
      } finally {
        this.busyTickers.delete(task.ticker)
      }
    }
  }

  /** Fetches and stores one chunk of `task`. Returns false if its broker isn't connected. */
  private async processChunk(task: BackfillTask): Promise<boolean> {
    {
      let adapter = brokerManager.getAdapter(task.brokerId)

      if (!adapter) {
        // The symbol may have moved to another broker (broker removed and re-added): follow it.
        // Without this, tasks of a removed broker cycled forever and held the ticker's lock.
        const owner = (stmts.getSymbols.all() as any[]).find(s => s.amiBrokerTicker === task.ticker)?.brokerId
        if (!owner) {
          this._dropTask(task, 'symbol no longer tracked')
          return true
        }
        if (owner !== task.brokerId && owner !== 'orphaned') {
          console.log(`[BackfillQueue] ${task.ticker}: task moved ${task.brokerId} → ${owner}`)
          task.brokerId = owner
          adapter = brokerManager.getAdapter(owner)
        }
      }

      if (!adapter) {
        // Broker not connected yet — move the task to the back; it runs once the adapter connects
        this.removeTask(task)
        this.queue.push(task)
        return false
      }

      const settings = getAllSettings() as any
      const chunkDays = this.chunkDaysFor(adapter)
      const maxRetries = Number(settings?.maxBackfillRetries) || 3

      // Chunk window, newest first: charts get the recent months before the older years
      const currentTo = task.cursorTo ?? task.targetTo
      const chunkFrom = new Date(Math.max(task.currentFrom.getTime(), currentTo.getTime() - chunkDays * DAY_MS))

      try {
      const status = backfillStatusMap.get(task.ticker)
      if (status && status.status !== 'running') {
        backfillStatusMap.set(task.ticker, { ...status, status: 'running', startedAt: status.startedAt || Date.now() })
        this.emit('backfill_progress', { ticker: task.ticker, ...backfillStatusMap.get(task.ticker) })
      }

      const fromStr = chunkFrom.toISOString().split('T')[0]
      const toStr   = currentTo.toISOString().split('T')[0]
      console.log(`[BackfillQueue] Fetching ${task.ticker} (${task.brokerToken}) [${this.queue.length} in queue] from ${fromStr} to ${toStr}...`)

      const bars = ((await adapter.getHistoricalBars(task.brokerToken, '1m', chunkFrom, currentTo)) || []).map(repairBar)

      if (bars && bars.length > 0) {
        const safeTicker = task.ticker.replace(/[^a-zA-Z0-9_-]/g, '_')

        // Validate
        const good = bars.filter(b => validateBar(b.open, b.high, b.low, b.close, b.volume))
        const skipped = bars.length - good.length

        if (skipped > 0) {
          console.warn(`[BackfillQueue] Skipped ${skipped} invalid bars for ${task.ticker}`)
        }

        if (good.length > 0) {
          await upsertBarsToHistory(task.ticker, good)
          learnClosedDays(exchangeOf(task.ticker), task.ticker, chunkFrom.getTime(), currentTo.getTime(), good)

          // Tell AmiBroker after every chunk (not only when the whole task ends), with the
          // oldest bar stored, so an open chart shows each piece of history as it lands
          this.emit('bars_gap_filled', { ticker: task.ticker, fromSec: Math.floor(good[0].ts / 1000) })
        }

        console.log(`[BackfillQueue] Saved ${good.length} bars for ${task.ticker} (${fromStr} to ${toStr})`)

        // Update status
        const existing = backfillStatusMap.get(task.ticker)
        if (existing) {
          const completed = existing.completedChunks + 1
          const progress  = Math.min(99, Math.round((completed / Math.max(existing.totalChunks, 1)) * 100))
          backfillStatusMap.set(task.ticker, {
            ...existing,
            status: 'running',
            progress,
            candlesFetched: existing.candlesFetched + good.length,
            completedChunks: completed,
            retryCount: 0,
          })
          this.emit('backfill_progress', { ticker: task.ticker, ...backfillStatusMap.get(task.ticker) })
        }
      }

      // Next chunk is the one just older than this
      task.cursorTo = chunkFrom
      task.retryCount = 0

      if (chunkFrom > task.currentFrom) {
        // More to fetch: go to the back of the line (unless a chart is waiting for this ticker),
        // so every symbol gets its newest months before any symbol gets its oldest years
        if (!this.priorityTickers.has(task.ticker)) {
          this.removeTask(task)
          this.queue.push(task)
        }
      } else {
        // Task complete
        if (!this.queue.some(t => t !== task && t.ticker === task.ticker)) this.priorityTickers.delete(task.ticker)
        const safeTicker = task.ticker.replace(/[^a-zA-Z0-9_-]/g, '_')
        const depthLabel = task.isGapFill ? 'Gap-fill' : `${task.depthDays}-Day Backfill`
        
        const finalStatus = backfillStatusMap.get(task.ticker)
        const totalFetched = finalStatus ? finalStatus.candlesFetched : 0

        // A gap / older-history range with no bars just means the broker has nothing there
        if (totalFetched === 0 && !task.isGapFill) {
          console.error(`[BackfillQueue] ${depthLabel} for ${task.ticker} FAILED/SKIPPED: Invalid symbol or no data returned (0 bars).`)
          
          if (finalStatus) {
            backfillStatusMap.set(task.ticker, {
              ...finalStatus,
              status: 'failed',
              progress: 0,
              completedAt: Date.now(),
              lastError: 'No data returned (0 bars)'
            })
            this.emit('backfill_failed', { ticker: task.ticker, error: 'No data returned (0 bars)', ...backfillStatusMap.get(task.ticker) })
          }
        } else {
          console.log(`[BackfillQueue] ${depthLabel} for ${task.ticker} completed successfully!`)
          backfilledTickers.add(task.ticker)

          // Final compact pass
          deduplicateAndCompactDiskBars(task.ticker)

          // Detect and enqueue any remaining internal gaps (skip for gap-fills)
          if (!task.isGapFill) {
            const sym = stmts.getSymbols.all().find((s: any) =>
              (s.amiBrokerTicker || s.amibroker_ticker) === task.ticker
            ) as any
            const exchange = sym?.exchange || 'NSE'

          // BUG #11 FIX: Use the ORIGINAL target range for gap detection, not the shifted currentFrom
          // task.currentFrom is now = task.targetTo (backfill just completed)
          // We need to scan from (now - depthDays) to now, not from (currentFrom - depthDays)
          let originalFromMs = task.targetTo.getTime() - task.depthDays * 24 * 60 * 60 * 1000
          
          // For futures contracts, cap gap detection at listing date (contract didn't exist before)
          const futMatch = /^.*?(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.exec(task.ticker)
          if (futMatch) {
            const yearShort = parseInt(futMatch[1], 10)
            const monthMap: Record<string, number> = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 }
            const month = monthMap[futMatch[2].toUpperCase()]
            const expiryDate = new Date(2000 + yearShort, month - 1, 28)
            const listingMs = expiryDate.getTime() - 95 * 24 * 60 * 60 * 1000
            originalFromMs = Math.max(originalFromMs, listingMs)
          } else {
            const oldestSec = await getOldestBarTimestampSec(task.ticker)
            if (oldestSec > 0) {
              originalFromMs = Math.max(originalFromMs, oldestSec * 1000)
            }
          }

          const gaps = await detectGaps(task.ticker, exchange, '1m', safeTicker, originalFromMs, Date.now())
            if (gaps.length > 0) {
              console.log(formatGapSummary(task.ticker, gaps))
            }
            this.enqueueGapPass(task.ticker, task.brokerId, task.brokerToken, gaps, Date.now())
          }

          // Mark complete
          if (finalStatus) {
            backfillStatusMap.set(task.ticker, {
              ...finalStatus,
              status: 'completed',
              progress: 100,
              completedAt: Date.now(),
            })
            this.emit('backfill_completed', { ticker: task.ticker, ...backfillStatusMap.get(task.ticker) })
          }
        }

        if (task.floorMs !== undefined && !task.skippedChunk) setHistoryFloorMs(task.ticker, task.floorMs)
        this.removeTask(task)
        // 0 bars for a gap means the broker has nothing there — still verified, unless a chunk was skipped
        this.settlePass(task.pass, !task.skippedChunk)
        if (task.isGapFill && task.gapFrom) {
          this.activeTickers.delete(`${task.ticker}:gap:${task.gapFrom.getTime()}`)
        }
        if (!this.queue.some(t => t.ticker === task.ticker)) {
          this.activeTickers.delete(task.ticker)
        }
      }

      // Pacing is done by the adapter's shared rate limiter

    } catch (err: any) {
      // ===== Auth Error (-16): Token invalid/expired =====
      const isAuthError = err?.code === -16 ||
        err?.message?.includes('Auth error') ||
        err?.message?.includes('authenticate')

      if (isAuthError) {
        this.consecutiveAuthErrors++

        // Too many total auth failures → permanent stop until re-auth
        if (this.consecutiveAuthErrors >= this.MAX_ABSOLUTE_AUTH_ERRORS) {
          this.tokenPermanentlyPaused = true
          console.error(`[BackfillQueue] Token permanently invalid (${this.consecutiveAuthErrors} auth errors). Queue stopped. Re-authenticate to resume.`)
          return true
        }

        if (this.consecutiveAuthErrors >= this.MAX_CONSECUTIVE_AUTH_ERRORS) {
          this.tokenPausedUntil = Date.now() + this.TOKEN_PAUSE_MS
          console.error(`[BackfillQueue] Token appears invalid (${this.consecutiveAuthErrors} consecutive auth errors). Pausing queue for 60s. Re-authenticate to resume.`)
          return true // workers see the pause and stop — don't burn retries on dead token
        }

        // Brief pause before next attempt
        await new Promise(r => setTimeout(r, 2000))

      // ===== Rate Limit (429) or Network Timeout =====
      } else if (err?.code === 429 ||
        err?.name === 'AbortError' ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('429') ||
        err?.message?.includes('request limit')) {

        this.consecutiveAuthErrors = 0 // Real rate limit or timeout — reset auth error counter
        task.retryCount++
        // The shared limiter already holds every request until the broker's window clears
        const backoffMs = 1000
        console.warn(`[BackfillQueue] Rate limit / timeout for ${task.ticker}. Retrying (#${task.retryCount})`)

        const existing = backfillStatusMap.get(task.ticker)
        if (existing) {
          backfillStatusMap.set(task.ticker, { ...existing, retryCount: task.retryCount })
        }

        // Rate limits are temporary: wait them out instead of skipping data
        if (task.retryCount > Math.max(maxRetries, 8)) {
          console.error(`[BackfillQueue] Rate-limit retries exhausted for ${task.ticker} chunk. Skipping.`)
          task.cursorTo = chunkFrom
          task.retryCount = 0
          task.skippedChunk = true
          if (chunkFrom <= task.currentFrom) {
            this._failTask(task, 'Max retries exceeded (rate limit)')
          }
        }
        await new Promise(r => setTimeout(r, backoffMs))

      // ===== Other errors: retry chunk before skipping =====
      } else {
        console.error(`[BackfillQueue] Error backfilling ${task.ticker}:`, err?.message || err)

        const existing = backfillStatusMap.get(task.ticker)
        if (existing) {
          backfillStatusMap.set(task.ticker, {
            ...existing,
            retryCount: task.retryCount + 1,
            lastError: err?.message || String(err),
          })
        }

        task.retryCount++

        if (task.retryCount > maxRetries) {
          console.error(`[BackfillQueue] Max retries (${maxRetries}) exceeded for general error. Skipping chunk for ${task.ticker}.`)
          task.cursorTo = chunkFrom
          task.retryCount = 0
          task.skippedChunk = true

          if (chunkFrom <= task.currentFrom) {
            this._failTask(task, err?.message || 'Unknown error')
          }
        }

        await new Promise(r => setTimeout(r, 500))
      }
      }
    }
    return true
  }

  /** Removes a task that can never run (its symbol is gone) without reporting a failure. */
  private _dropTask(task: BackfillTask, reason: string) {
    this.removeTask(task)
    if (!this.queue.some(t => t.ticker === task.ticker)) this.priorityTickers.delete(task.ticker)
    this.settlePass(task.pass, false)
    if (task.isGapFill && task.gapFrom) this.activeTickers.delete(`${task.ticker}:gap:${task.gapFrom.getTime()}`)
    if (!this.queue.some(t => t.ticker === task.ticker)) {
      this.activeTickers.delete(task.ticker)
      backfillStatusMap.delete(task.ticker)
    }
    console.log(`[BackfillQueue] Dropped task for ${task.ticker}: ${reason}`)
  }

  private _failTask(task: BackfillTask, error: string) {
    const existing = backfillStatusMap.get(task.ticker)
    if (existing) {
      backfillStatusMap.set(task.ticker, {
        ...existing,
        status: 'failed',
        completedAt: Date.now(),
        lastError: error,
      })
      this.emit('backfill_failed', { ticker: task.ticker, error, ...backfillStatusMap.get(task.ticker) })
    }
    this.removeTask(task)
    if (!this.queue.some(t => t.ticker === task.ticker)) this.priorityTickers.delete(task.ticker)
    this.settlePass(task.pass, false)
    if (task.isGapFill && task.gapFrom) {
      this.activeTickers.delete(`${task.ticker}:gap:${task.gapFrom.getTime()}`)
    }
    if (!this.queue.some(t => t.ticker === task.ticker)) {
      this.activeTickers.delete(task.ticker)
    }
    console.error(`[Error] ${task.ticker} : Failed to fetch data. Reason: ${error}`)
  }
}

export const backfillQueue = new BackfillQueueService()
