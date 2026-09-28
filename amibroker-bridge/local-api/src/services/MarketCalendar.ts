/**
 * MarketCalendar.ts
 *
 * Trading calendar utilities for Indian exchanges (NSE, BSE, NFO, MCX, etc.).
 * Determines whether a given timestamp falls within a valid market session,
 * and whether a gap between two bars is due to market closure (not a real gap).
 *
 * Design principles:
 * - Uses the exchangeRegistry from db.ts as the single source of truth for timings.
 * - Does NOT import any external dependencies (no holidays DB needed for now).
 * - Holiday awareness is future-extensible via the `knownHolidays` set.
 * - All timestamps are treated as UTC; IST offset (+5:30 = +19800s) is applied internally.
 */

import { exchangeRegistry } from '../db'

// IST offset in milliseconds (+5:30)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

// Interval in seconds → standard trading interval seconds
export const INTERVAL_SECONDS: Record<string, number> = {
  '1m':  60,
  '2m':  120,
  '3m':  180,
  '5m':  300,
  '10m': 600,
  '15m': 900,
  '30m': 1800,
  '1h':  3600,
  '1d':  86400,
}

/**
 * Known NSE/BSE trading holidays (YYYY-MM-DD in IST).
 * This is a lightweight static set that avoids a DB dependency.
 * Add new holidays annually. These are NSE equity segment holidays.
 */
const NSE_HOLIDAYS_2025 = new Set([
  '2025-01-26', // Republic Day
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr (Ramzan Id)
  '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Gandhi Jayanti
  '2025-10-02', // Dussehra
  '2025-10-21', // Diwali Laxmi Pujan
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Prakash Gurpurb Sri Guru Nanak Dev Ji
  '2025-12-25', // Christmas
])

const NSE_HOLIDAYS_2026 = new Set([
  '2026-01-26', // Republic Day
  '2026-03-20', // Holi
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  '2026-10-21', // Diwali
  '2026-11-11', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
])

const ALL_NSE_HOLIDAYS = new Set([...NSE_HOLIDAYS_2025, ...NSE_HOLIDAYS_2026])

/**
 * Returns the IST date string (YYYY-MM-DD) for a UTC millisecond timestamp.
 */
export function toISTDateStr(utcMs: number): string {
  const ist = new Date(utcMs + IST_OFFSET_MS)
  return ist.toISOString().split('T')[0]
}

/**
 * Returns the IST hours and minutes for a UTC millisecond timestamp.
 */
export function toISTHHMM(utcMs: number): { h: number; m: number } {
  const ist = new Date(utcMs + IST_OFFSET_MS)
  return { h: ist.getUTCHours(), m: ist.getUTCMinutes() }
}

/**
 * Returns true if the given UTC ms timestamp falls on a weekend (Sat/Sun).
 * Uses IST date (Indian exchanges close Sat/Sun).
 */
export function isWeekend(utcMs: number): boolean {
  // Day-of-week in IST
  const ist = new Date(utcMs + IST_OFFSET_MS)
  const dow = ist.getUTCDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

/**
 * Returns true if the IST date for the given timestamp is a known NSE holiday.
 */
export function isNSEHoliday(utcMs: number): boolean {
  return ALL_NSE_HOLIDAYS.has(toISTDateStr(utcMs))
}

/**
 * Parses a "HH:MM" string into { h, m }.
 */
function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

const exchangeSessionCache = new Map<string, { open: { h: number, m: number }, close: { h: number, m: number } } | null>()

/**
 * Returns the market session open/close for the given exchange in UTC ms
 * for the trading day containing `utcMs`.
 *
 * Returns null if the exchange is not in the registry.
 */
export function getSessionWindowMs(
  utcMs: number,
  exchange: string
): { openMs: number; closeMs: number } | null {
  const ex = exchange.toUpperCase()
  
  let sessionTimes = exchangeSessionCache.get(ex)
  if (sessionTimes === undefined) {
    const reg = exchangeRegistry.find(r => r.exchangeCode === ex)
    if (reg) {
      sessionTimes = { open: parseHHMM(reg.sessionOpenLocal), close: parseHHMM(reg.sessionCloseLocal) }
    } else {
      sessionTimes = null
    }
    exchangeSessionCache.set(ex, sessionTimes)
  }

  if (!sessionTimes) return null

  // Midnight IST in UTC for the day of utcMs
  const istMs = utcMs + IST_OFFSET_MS
  const ist = new Date(istMs)
  // Midnight UTC for the IST day (remove time portion, then subtract IST offset)
  const istMidnightUTC = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS

  const openMs  = istMidnightUTC + (sessionTimes.open.h  * 3600 + sessionTimes.open.m  * 60) * 1000
  const closeMs = istMidnightUTC + (sessionTimes.close.h * 3600 + sessionTimes.close.m * 60) * 1000

  return { openMs, closeMs }
}

/**
 * Returns true if the timestamp falls within a valid trading session for the exchange.
 *
 * A valid session means:
 * - Not a weekend
 * - Not a known holiday
 * - Within the session open/close window
 */
export function isMarketSession(utcMs: number, exchange: string): boolean {
  if (isWeekend(utcMs)) return false

  // Use NSE holidays for all NSE-based exchanges (NSE, BSE, NFO, BFO)
  const ex = exchange.toUpperCase()
  if (['NSE', 'BSE', 'NFO', 'BFO', 'CDS'].includes(ex) && isNSEHoliday(utcMs)) return false

  const session = getSessionWindowMs(utcMs, exchange)
  if (!session) return true // Unknown exchange — assume always open

  return utcMs >= session.openMs && utcMs < session.closeMs
}

/**
 * Scans a gap and returns the true missing market hours.
 * Uses fast-forward jumps to avoid iterating over weekends and nights.
 * Returns null if the gap is fully explained by market closures.
 */
export function getTrueGapRange(
  prevTsMs: number,
  nextTsMs: number,
  intervalSec: number,
  exchange: string
): { fromMs: number, toMs: number } | null {
  const stepMs = intervalSec * 1000
  let cursor = prevTsMs + stepMs

  let firstMissingMs: number | null = null
  let lastMissingMs: number | null = null

  while (cursor < nextTsMs) {
    if (isWeekend(cursor) || (['NSE', 'BSE', 'NFO', 'BFO', 'CDS'].includes(exchange.toUpperCase()) && isNSEHoliday(cursor))) {
      // Jump to next day midnight UTC
      const istMs = cursor + IST_OFFSET_MS
      const istDate = new Date(istMs)
      const nextMidnightIstMs = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate() + 1)
      cursor = nextMidnightIstMs - IST_OFFSET_MS
      continue
    }

    const session = getSessionWindowMs(cursor, exchange)
    if (!session) {
      // Unknown exchange, assume always open
      if (firstMissingMs === null) firstMissingMs = cursor
      lastMissingMs = cursor
      cursor += stepMs
      continue
    }

    if (cursor < session.openMs) {
      // Jump forward to session open
      cursor = session.openMs
      continue
    }

    if (cursor >= session.closeMs) {
      // Jump to next day midnight UTC (session close is exclusive — last valid bar opens BEFORE closeMs)
      const istMs = cursor + IST_OFFSET_MS
      const istDate = new Date(istMs)
      const nextMidnightIstMs = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate() + 1)
      cursor = nextMidnightIstMs - IST_OFFSET_MS
      continue
    }

    // Inside market session
    if (firstMissingMs === null) firstMissingMs = cursor
    lastMissingMs = cursor
    cursor += stepMs
  }

  if (firstMissingMs !== null && lastMissingMs !== null && firstMissingMs <= lastMissingMs) {
    return { fromMs: firstMissingMs, toMs: lastMissingMs }
  }

  return null
}

/**
 * Returns the next expected candle timestamp after `afterMs` that is within
 * a valid trading session for the given exchange and interval.
 * Returns null if none found within 7 days.
 */
export function getNextTradingSlot(
  afterMs: number,
  intervalSec: number,
  exchange: string
): number | null {
  const stepMs = intervalSec * 1000
  const maxMs = afterMs + 7 * 24 * 3600 * 1000
  let cursor = afterMs + stepMs

  while (cursor <= maxMs) {
    if (isMarketSession(cursor, exchange)) return cursor
    cursor += stepMs
  }

  return null
}
