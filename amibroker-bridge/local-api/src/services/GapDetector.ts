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

import { readGapCandidates as readStoredGaps } from '../dbReader'
import { getTrueGapRange, INTERVAL_SECONDS } from './MarketCalendar'

export interface GapRange {
  fromMs: number   // start of gap (first missing candle timestamp, UTC ms)
  toMs: number     // end of gap (last missing candle timestamp, UTC ms)
}

/**
 * Adjacent stored bars more than `intervalSec` apart, plus the first/last bar in range.
 * Computed in SQLite (primary-key range scan + LAG) on a reader thread, so multi-year
 * histories never load every timestamp into the engine.
 */
async function readGapCandidates(ticker: string, fromMs: number, toMs: number, intervalSec: number) {
  try {
    return await readStoredGaps(ticker, Math.floor(fromMs / 1000), Math.floor(toMs / 1000), intervalSec)
  } catch (err) {
    console.error(`[GapDetector] Failed to read gaps for ${ticker}:`, err)
    return null
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
  const ranged = !!(targetFromMs && targetToMs)
  const fromSec = ranged ? Math.floor(targetFromMs! / 1000) : 0
  const toSec = ranged ? Math.floor(targetToMs! / 1000) : Math.floor(Date.now() / 1000) + 86400

  const found = await readGapCandidates(ticker, fromSec * 1000, toSec * 1000, intervalSec)
  if (!found) return []

  // Candidate holes: before the first bar, between bars, after the last bar (range edges only when ranged)
  const pairs: [number, number][] = []
  if (found.firstSec === null) {
    if (ranged) pairs.push([fromSec, toSec])
  } else {
    if (ranged && found.firstSec > fromSec) pairs.push([fromSec, found.firstSec])
    pairs.push(...found.pairs)
    if (ranged && found.lastSec! < toSec) pairs.push([found.lastSec!, toSec])
  }

  const gaps: GapRange[] = []
  for (const [prevSec, nextSec] of pairs) {
    if (gaps.length >= maxGaps) break
    // More than 1 interval apart?
    if (nextSec - prevSec <= intervalSec) continue
    const trueGap = getTrueGapRange(prevSec * 1000, nextSec * 1000, intervalSec, exchange)
    if (trueGap) gaps.push(trueGap)
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
