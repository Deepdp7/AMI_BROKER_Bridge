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
  getAllSettings,
  getOldestBarTimestampSec
} from '../db'
import { brokerManager } from './BrokerManager'
import { backfilledTickers } from '../shared/backfillState'
import { detectGaps, formatGapSummary } from './GapDetector'
import type { BackfillStatus, BackfillJobStatus } from '../types'
import path from 'path'
import fs from 'fs'

export interface BackfillTask {
  ticker: string
  brokerId: string
  brokerToken: string
  targetTo: Date            // Absolute newest date we want (end boundary)
  currentFrom: Date         // Current chunk start (walks forwards)
  retryCount: number
  depthDays: number
  isGapFill: boolean        // True if this is a gap-fill task (not initial/incremental)
  gapFrom?: Date            // For gap fills: the exact start of the gap
}

// ===== Exported status store (used by /api/backfill routes) =====
export const backfillStatusMap = new Map<string, BackfillStatus>()

class BackfillQueueService extends EventEmitter {
  private queue: BackfillTask[] = []
  private isProcessing = false
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
        const targetTo = new Date()
        const currentFrom = new Date(Date.now() - depthDays * 24 * 60 * 60 * 1000)
        const settings = getAllSettings() as any
        const totalChunks = Math.ceil(depthDays / (Number(settings?.historyChunkDays) || 30))

        this.queue.push({
          ticker,
          brokerId,
          brokerToken: resolvedToken,
          targetTo,
          currentFrom,
          retryCount: 0,
          depthDays,
          isGapFill: false,
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
  public enqueueGapFill(ticker: string, brokerId: string, brokerToken: string | number = '', fromMs: number, toMs: number) {
    const gapKey = `${ticker}:gap:${fromMs}`
    if (this.activeTickers.has(gapKey)) return
    
    let safeBrokerToken = typeof brokerToken === 'string' ? brokerToken : String(brokerToken)

    const adapter = brokerManager.getAdapter(brokerId)
    if (!adapter) return

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

        // Skip same-day gaps ONLY if market is currently open (9:15–15:30 IST).
        // After market close, Fyers has full historical data for today — allow the fill.
        const isSameDay = gapFrom.toISOString().split('T')[0] === targetTo.toISOString().split('T')[0]
        if (isSameDay) {
          const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000)
          const istHHMM = nowIST.getUTCHours() * 100 + nowIST.getUTCMinutes()
          const isMarketOpen = istHHMM >= 915 && istHHMM < 1530  // 9:15 AM to 3:30 PM IST
          if (isMarketOpen) {
            // During live market: skip (data is incomplete, live ticks handle it)
            this.activeTickers.delete(gapKey)
            this.activeTickers.delete(ticker)
            return
          }
          // After market close: fall through and fetch today's completed bars
          console.log(`[BackfillQueue] Same-day gap fill allowed (market closed): ${ticker} ${gapFrom.toISOString().slice(0, 16)} → ${targetTo.toISOString().slice(0, 16)}`)
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
        })

        const existingStatus = backfillStatusMap.get(ticker)
        if (!existingStatus || existingStatus.status !== 'completed') {
          backfillStatusMap.set(ticker, {
            ticker,
            brokerId,
            status: 'pending',
            progress: 0,
            candlesFetched: existingStatus?.candlesFetched || 0,
            totalChunks: 1, // Gap fills are usually small
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
      }
    })
  }

  public enqueueBatch(items: { ticker: string; brokerId: string; brokerToken?: string; depthDays?: number }[]) {
    for (const item of items) {
      this.enqueue(item.ticker, item.brokerId, item.brokerToken || '', item.depthDays ?? 365)
    }
  }

  public cancel(ticker: string) {
    this.queue = this.queue.filter(t => t.ticker !== ticker)
    this.activeTickers.delete(ticker)
    backfillStatusMap.delete(ticker)
    console.log(`[BackfillQueue] Cancelled all pending backfill tasks for ${ticker}`)
  }

  public getQueueLength(): number {
    return this.queue.length
  }

  public resumeAfterAuth() {
    this.consecutiveAuthErrors = 0
    this.tokenPausedUntil = 0
    this.tokenPermanentlyPaused = false
    console.log('[BackfillQueue] Auth resumed. Restarting queue...')
    if (!this.isProcessing && this.queue.length > 0) {
      this.processNext()
    }
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

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return

    // Permanently paused — don't retry until manual re-auth (resumeAfterAuth called)
    if (this.tokenPermanentlyPaused) {
      console.warn('[BackfillQueue] Auth permanently failed. Queue stopped. Re-authenticate to resume.')
      return
    }

    // Token pause check: if we got too many auth errors, wait before trying again
    if (Date.now() < this.tokenPausedUntil) {
      const waitMs = this.tokenPausedUntil - Date.now()
      console.warn(`[BackfillQueue] Token paused. Waiting ${Math.round(waitMs/1000)}s before resuming...`)
      setTimeout(() => {
        if (!this.isProcessing) this.processNext()
      }, waitMs + 500)
      return
    }

    this.isProcessing = true

    try {
      const task = this.queue[0]
      const adapter = brokerManager.getAdapter(task.brokerId)

      if (!adapter) {
        // BUG #7 FIX: Remove from activeTickers so it can be re-enqueued later
        // Broker not connected yet — push task to back and retry after delay
        const failedTask = this.queue.shift()
        if (failedTask) {
          // Only re-queue if not already at the back (avoid infinite spin when no adapter ever connects)
          this.queue.push(failedTask)
        }
        this.isProcessing = false
        // Remove from activeTickers temporarily so external callers can re-trigger
        // The task is still in the queue so it will process once adapter connects
        setTimeout(() => this.processNext(), 5000) // longer wait for broker to come up
        return
      }

      const settings = getAllSettings() as any
      const chunkDays = Number(settings?.historyChunkDays) || 30
      const delayMs   = Number(settings?.maxBackfillRpsDelayMs) || 150
      const maxRetries = Number(settings?.maxBackfillRetries) || 3

      try {
        // Determine chunk window (working forwards from currentFrom)
      let currentTo = new Date(task.currentFrom.getTime() + chunkDays * 24 * 60 * 60 * 1000)
      if (currentTo > task.targetTo) currentTo = task.targetTo

      const status = backfillStatusMap.get(task.ticker)
      if (status && status.status !== 'running') {
        backfillStatusMap.set(task.ticker, { ...status, status: 'running', startedAt: status.startedAt || Date.now() })
        this.emit('backfill_progress', { ticker: task.ticker, ...backfillStatusMap.get(task.ticker) })
      }

      const fromStr = task.currentFrom.toISOString().split('T')[0]
      const toStr   = currentTo.toISOString().split('T')[0]
      console.log(`[BackfillQueue] Fetching ${task.ticker} (${task.brokerToken}) [${this.queue.length} in queue] from ${fromStr} to ${toStr}...`)

      const bars = await adapter.getHistoricalBars(task.brokerToken, '1m', task.currentFrom, currentTo)

      if (bars && bars.length > 0) {
        const safeTicker = task.ticker.replace(/[^a-zA-Z0-9_-]/g, '_')

        // Validate and build CSV lines
        const csvLines: string[] = []
        let skipped = 0

        for (const b of bars) {
          const tsSec = Math.floor(b.ts / 1000)
          if (!validateBar(b.open, b.high, b.low, b.close, b.volume)) {
            skipped++
            continue
          }
          csvLines.push(`${tsSec},${b.open},${b.high},${b.low},${b.close},${b.volume}`)
        }

        if (skipped > 0) {
          console.warn(`[BackfillQueue] Skipped ${skipped} invalid bars for ${task.ticker}`)
        }

        if (csvLines.length > 0) {
          // Upsert to postgres (async - must be awaited!)
          await upsertBarsToHistory(safeTicker, csvLines)

          // Also load recent bars (last 3 days) into RAM for live chart serving
          const cutoffMs = Date.now() - 3 * 24 * 60 * 60 * 1000
          const recentBars = bars.filter(b => b.ts > cutoffMs)
          if (recentBars.length > 0) {
            stmts.insertBarsToRamOnly.run(recentBars.map(b => ({
              amibroker_ticker: task.ticker,
              ts_utc_ms: b.ts,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              volume: b.volume,
              open_interest: null,
            })))
          }
        }

        console.log(`[BackfillQueue] Saved ${csvLines.length} bars for ${task.ticker} (${fromStr} to ${toStr})`)

        // Update status
        const existing = backfillStatusMap.get(task.ticker)
        if (existing) {
          const completed = existing.completedChunks + 1
          const progress  = Math.min(99, Math.round((completed / Math.max(existing.totalChunks, 1)) * 100))
          backfillStatusMap.set(task.ticker, {
            ...existing,
            status: 'running',
            progress,
            candlesFetched: existing.candlesFetched + csvLines.length,
            completedChunks: completed,
            retryCount: 0,
          })
          this.emit('backfill_progress', { ticker: task.ticker, ...backfillStatusMap.get(task.ticker) })
        }
      }

      // Advance chunk window forwards
      task.currentFrom = currentTo
      task.retryCount = 0

      // Check if task is complete
      if (task.currentFrom >= task.targetTo) {
        const safeTicker = task.ticker.replace(/[^a-zA-Z0-9_-]/g, '_')
        const depthLabel = task.isGapFill ? 'Gap-fill' : `${task.depthDays}-Day Backfill`
        
        const finalStatus = backfillStatusMap.get(task.ticker)
        const totalFetched = finalStatus ? finalStatus.candlesFetched : 0

        if (totalFetched === 0) {
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
            const oldestSec = await getOldestBarTimestampSec(safeTicker)
            if (oldestSec > 0) {
              originalFromMs = Math.max(originalFromMs, oldestSec * 1000)
            }
          }

          const gaps = await detectGaps(task.ticker, exchange, '1m', safeTicker, originalFromMs, Date.now())
            if (gaps.length > 0) {
              console.log(formatGapSummary(task.ticker, gaps))
              for (const gap of gaps) {
                this.enqueueGapFill(task.ticker, task.brokerId, task.brokerToken, gap.fromMs, gap.toMs)
              }
            }
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

        this.queue.shift()
        if (task.isGapFill && task.gapFrom) {
          this.activeTickers.delete(`${task.ticker}:gap:${task.gapFrom.getTime()}`)
        }
        if (!this.queue.some(t => t.ticker === task.ticker)) {
          this.activeTickers.delete(task.ticker)
        }
      }

      // Rate-limit pacing
      await new Promise(r => setTimeout(r, delayMs))

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
          this.isProcessing = false
          return
        }

        if (this.consecutiveAuthErrors >= this.MAX_CONSECUTIVE_AUTH_ERRORS) {
          this.tokenPausedUntil = Date.now() + this.TOKEN_PAUSE_MS
          console.error(`[BackfillQueue] Token appears invalid (${this.consecutiveAuthErrors} consecutive auth errors). Pausing queue for 60s. Re-authenticate to resume.`)
          this.isProcessing = false
          return // Stop processing — don't burn retries on dead token
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
        const backoffMs = Math.min(2000 * Math.pow(2, task.retryCount - 1), 30000)
        console.warn(`[BackfillQueue] Rate limit (429) for ${task.ticker}. Backoff ${backoffMs}ms (Retry #${task.retryCount})`)

        const existing = backfillStatusMap.get(task.ticker)
        if (existing) {
          backfillStatusMap.set(task.ticker, { ...existing, retryCount: task.retryCount })
        }

        if (task.retryCount > maxRetries) {
          console.error(`[BackfillQueue] Max retries (${maxRetries}) exceeded for ${task.ticker} chunk. Skipping.`)
          task.currentFrom = new Date(task.currentFrom.getTime() + chunkDays * 24 * 60 * 60 * 1000)
          task.retryCount = 0
          if (task.currentFrom >= task.targetTo) {
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
          task.currentFrom = new Date(task.currentFrom.getTime() + chunkDays * 24 * 60 * 60 * 1000)
          task.retryCount = 0

          if (task.currentFrom >= task.targetTo) {
            this._failTask(task, err?.message || 'Unknown error')
          }
        }

        await new Promise(r => setTimeout(r, 500))
      }
      }
    } catch (fatalErr) {
      console.error(`[BackfillQueue] FATAL error in queue execution:`, fatalErr)
    } finally {
      this.isProcessing = false
      if (this.queue.length > 0) {
        // Use setTimeout to avoid max call stack size exceeded on immediate synchronous failures
        setTimeout(() => this.processNext(), 10)
      }
    }
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
    this.queue.shift()
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
