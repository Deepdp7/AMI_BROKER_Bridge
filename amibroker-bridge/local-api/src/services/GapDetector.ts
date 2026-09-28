/**
 * GapDetector.ts
 *
 * Detects missing candle ranges inside the local _history.csv files.
 * Uses MarketCalendar to skip weekends, holidays and market-closed periods.
 *
 * A "gap" is a consecutive range of candle timestamps that should exist
 * (based on the exchange session and interval) but are absent from the local data.
 *
 * Usage:
 *   const gaps = await detectGaps('RELIANCE', 'NSE', '1m', safeTicker)
 *   for (const gap of gaps) {
 *     // enqueue backfill from gap.fromMs to gap.toMs
 *   }
 */

import path from 'path'
import fs from 'fs'
import { BARS_DIR, pool } from '../db'
import { getTrueGapRange, INTERVAL_SECONDS } from './MarketCalendar'

export interface GapRange {
  fromMs: number   // start of gap (first missing candle timestamp, UTC ms)
  toMs: number     // end of gap (last missing candle timestamp, UTC ms)
}

/**
 * Fetch all timestamps from PostgreSQL for a given symbol.
 * Returns sorted ascending array of Unix seconds.
 */
async function readHistoryTimestamps(safeTicker: string, originalTicker: string): Promise<number[]> {
  try {
    // amibroker_ticker might have been replaced to safeTicker in arguments, so we should query originalTicker
    // Actually, gap detector uses safeTicker primarily for files, but PG needs amibroker_ticker.
    const res = await pool.query(`
      SELECT ts_utc_ms FROM bars_1s 
      WHERE amibroker_ticker = $1 
      ORDER BY ts_utc_ms ASC
    `, [originalTicker])
    
    return res.rows.map(r => Math.floor(Number(r.ts_utc_ms) / 1000))
  } catch (err) {
    console.error(`[GapDetector] Failed to read timestamps from postgres for ${originalTicker}:`, err)
    return []
  }
}

/**
 * Detect internal gaps in the local history CSV for a given symbol.
 *
 * @param ticker        AmiBroker ticker (e.g. "RELIANCE")
 * @param exchange      Exchange code (e.g. "NSE")
 * @param interval      Candle interval string (e.g. "1m")
 * @param safeTicker    Filesystem-safe ticker name (special chars replaced with _)
 * @param maxGaps       Max number of gap ranges to return (default 20, avoids flooding queue)
 * @returns Array of GapRange objects, sorted ascending by fromMs
 */
export async function detectGaps(
  ticker: string,
  exchange: string,
  interval: string,
  safeTicker: string,
  targetFromMs?: number,
  targetToMs?: number,
  maxGaps = 100
): Promise<GapRange[]> {
  const intervalSec = INTERVAL_SECONDS[interval] ?? 60
  let timestamps = await readHistoryTimestamps(safeTicker, ticker)

  if (targetFromMs && targetToMs) {
    const fromSec = Math.floor(targetFromMs / 1000)
    const toSec = Math.floor(targetToMs / 1000)

    timestamps = timestamps.filter(ts => ts >= fromSec && ts <= toSec)

    if (timestamps.length > 0) {
      if (timestamps[0] > fromSec) timestamps.unshift(fromSec)
      if (timestamps[timestamps.length - 1] < toSec) timestamps.push(toSec)
    } else {
      timestamps = [fromSec, toSec]
    }

    // Re-sort after injection (guards against any ordering edge cases)
    // and deduplicate to avoid zero-length gaps when injected boundary = existing bar
    timestamps.sort((a, b) => a - b)
    timestamps = timestamps.filter((ts, i) => i === 0 || ts !== timestamps[i - 1])
  }

  if (timestamps.length < 2) return []

  const gaps: GapRange[] = []

  for (let i = 0; i < timestamps.length - 1 && gaps.length < maxGaps; i++) {
    // Yield every 5000 iterations to prevent blocking the event loop on huge arrays
    if (i % 5000 === 0) {
      await new Promise(r => setTimeout(r, 0))
    }

    const prevSec = timestamps[i]
    const nextSec = timestamps[i + 1]
    const prevMs = prevSec * 1000
    const nextMs = nextSec * 1000

    // More than 1 interval apart?
    if (nextSec - prevSec <= intervalSec) continue

    const trueGap = getTrueGapRange(prevMs, nextMs, intervalSec, exchange)
    if (trueGap) {
      gaps.push(trueGap)
    }
  }

  const MAX_MERGE_DISTANCE_MS = 60 * 24 * 3600 * 1000; // 60 days
  const MAX_MERGE_SPAN_MS = 90 * 24 * 3600 * 1000; // 90 days (Fyers limit is 100 days)

  const mergedGaps: GapRange[] = []
  for (const gap of gaps) {
    if (mergedGaps.length === 0) {
      mergedGaps.push(gap)
      continue
    }
    const last = mergedGaps[mergedGaps.length - 1]
    const distanceMs = gap.fromMs - last.toMs
    const newSpanMs = gap.toMs - last.fromMs

    if (distanceMs <= MAX_MERGE_DISTANCE_MS && newSpanMs <= MAX_MERGE_SPAN_MS) {
      last.toMs = gap.toMs
    } else {
      mergedGaps.push(gap)
    }
  }

  return mergedGaps
}

/**
 * Returns the number of days covered by a gap (rounded up).
 * Used to enqueue backfill with the correct depthDays.
 */
export function gapToDays(gap: GapRange): number {
  return Math.max(1, Math.ceil((gap.toMs - gap.fromMs) / (24 * 3600 * 1000)))
}

/**
 * Summarise all gaps found for a ticker into a log-friendly string.
 */
export function formatGapSummary(ticker: string, gaps: GapRange[]): string {
  if (gaps.length === 0) return `[GapDetector] ${ticker}: No gaps found.`
  const parts = gaps.map(g => {
    const from = new Date(g.fromMs).toISOString().slice(0, 16)
    const to   = new Date(g.toMs).toISOString().slice(0, 16)
    return `${from}→${to}`
  })
  return `[GapDetector] ${ticker}: ${gaps.length} gap(s): ${parts.join(', ')}`
}
