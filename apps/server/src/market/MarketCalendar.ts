/**
 * MarketCalendar.ts
 *
 * Trading calendar utilities for Indian exchanges (NSE, BSE, NFO, MCX, etc.).
 * Determines whether a given timestamp falls within a valid market session,
 * and whether a gap between two bars is due to market closure (not a real gap).
 *
 * Design principles:
 * - Uses the exchangeRegistry from db.ts as the single source of truth for timings.
 * - Holidays: a static NSE list plus closed days learned from broker history (closed_days.json).
 * - All timestamps are treated as UTC; IST offset (+5:30 = +19800s) is applied internally.
 */

import fs from 'fs'
import path from 'path'
import { exchangeRegistry, DATA_DIR } from '../db'

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

// NSE circular list plus the 15 Jan election holiday. Every date up to 2026-10-23 checked against
// Fyers 1-minute history: no bars on any of 60 symbols. A missing holiday here shows up as a
// "gap" in every symbol and costs a re-download of up to 90 days each.
const NSE_HOLIDAYS_2026 = new Set([
  '2026-01-15', // Municipal Corporation elections (Maharashtra)
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-26', // Shri Ram Navami
  '2026-03-31', // Shri Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-28', // Bakri Id
  '2026-06-26', // Muharram
  '2026-09-14', // Ganesh Chaturthi
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Prakash Gurpurb Sri Guru Nanak Dev Ji
  '2026-12-25', // Christmas
])

const ALL_NSE_HOLIDAYS = new Set([...NSE_HOLIDAYS_2025, ...NSE_HOLIDAYS_2026])

/** Exchanges that close on NSE's holidays */
const NSE_CALENDAR = ['NSE', 'BSE', 'NFO', 'BFO', 'CDS']

/** Calendar an exchange follows: the NSE group shares one, every other exchange has its own */
function calendarOf(exchange: string): string {
  const ex = (exchange || 'NSE').toUpperCase()
  return NSE_CALENDAR.includes(ex) ? 'NSE' : ex
}

// ===== Closed days learned from broker history =====
// The static list above needs adding to every year; a missed holiday shows up as a gap in every
// symbol and costs a re-download of up to 90 days each. So the calendar also learns: a weekday
// is closed when broker history for 2 different symbols has bars before and after it but none
// on it. One response with bars on a day marks it as traded for good, which also overrides a
// wrong entry in the static list.
const CLOSED_DAYS_FILE = path.join(DATA_DIR, 'closed_days.json')
/** Symbols needed to agree before a day counts as closed (one illiquid symbol can skip a day) */
const CLOSED_CONFIRMATIONS = 2

interface LearnedCalendar { closed: Map<string, Set<string>>; traded: Set<string> }
let learned: Map<string, LearnedCalendar> | null = null

function learnedCalendars(): Map<string, LearnedCalendar> {
  if (learned) return learned
  learned = new Map()
  try {
    const obj = JSON.parse(fs.readFileSync(CLOSED_DAYS_FILE, 'utf8'))
    for (const [cal, v] of Object.entries<any>(obj)) {
      learned.set(cal, {
        closed: new Map(Object.entries<string[]>(v.closed || {}).map(([d, t]) => [d, new Set(t)])),
        traded: new Set(v.traded || []),
      })
    }
  } catch { /* no file yet */ }
  return learned
}

function learnedFor(cal: string): LearnedCalendar {
  const all = learnedCalendars()
  let c = all.get(cal)
  if (!c) all.set(cal, c = { closed: new Map(), traded: new Set() })
  return c
}

function saveLearned() {
  const obj: Record<string, { closed: Record<string, string[]>; traded: string[] }> = {}
  for (const [cal, c] of learnedCalendars()) {
    obj[cal] = { closed: Object.fromEntries([...c.closed].map(([d, t]) => [d, [...t]])), traded: [...c.traded].sort() }
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(CLOSED_DAYS_FILE + '.part', JSON.stringify(obj), 'utf8')
    fs.renameSync(CLOSED_DAYS_FILE + '.part', CLOSED_DAYS_FILE)
  } catch (err) {
    console.error('[MarketCalendar] Failed to save learned closed days:', err)
  }
}

/** True when `dateStr` (IST YYYY-MM-DD) is a known or learned closed day for the exchange */
function isClosedDate(dateStr: string, exchange: string): boolean {
  const cal = calendarOf(exchange)
  const c = learnedCalendars().get(cal)
  if (c?.traded.has(dateStr)) return false
  if (cal === 'NSE' && ALL_NSE_HOLIDAYS.has(dateStr)) return true
  return (c?.closed.get(dateStr)?.size ?? 0) >= CLOSED_CONFIRMATIONS
}

/** True when the IST day of `utcMs` is a holiday (known or learned) for the exchange; weekends aside */
export function isClosedDay(utcMs: number, exchange: string): boolean {
  return isClosedDate(toISTDateStr(utcMs), exchange)
}

/** Bars spread over at least this long make a day a full trading day; Diwali's Muhurat session is 1 hour */
const FULL_DAY_SPAN_MS = 3 * 3600_000

/**
 * Learns closed days from one broker history response for `ticker` covering fromMs..toMs.
 * Only weekdays between the response's first and last bar day are judged, so a range that
 * starts before listing or ends today teaches nothing. A day with only a short special
 * session (Muhurat trading) counts as closed: its few bars are no reason to look for gaps.
 */
export function learnClosedDays(exchange: string, ticker: string, fromMs: number, toMs: number, bars: { ts: number }[]) {
  if (bars.length === 0) return
  const cal = calendarOf(exchange)
  const c = learnedFor(cal)
  const spans = new Map<string, { first: number; last: number }>()
  let first = Infinity, last = -Infinity
  for (const b of bars) {
    if (b.ts < fromMs || b.ts > toMs) continue
    const d = toISTDateStr(b.ts)
    const s = spans.get(d)
    if (!s) spans.set(d, { first: b.ts, last: b.ts })
    else { if (b.ts < s.first) s.first = b.ts; if (b.ts > s.last) s.last = b.ts }
    if (b.ts < first) first = b.ts
    if (b.ts > last) last = b.ts
  }
  if (spans.size === 0) return
  const fullDays = new Set([...spans].filter(([, s]) => s.last - s.first >= FULL_DAY_SPAN_MS).map(([d]) => d))

  let changed = false
  // Traded days: forget a wrong closure and never learn it again
  for (const d of fullDays) {
    if (c.traded.has(d)) continue
    if (c.closed.has(d) || (cal === 'NSE' && ALL_NSE_HOLIDAYS.has(d))) {
      c.closed.delete(d)
      c.traded.add(d)
      changed = true
    }
  }
  // Empty (or special-session-only) weekdays strictly inside the response
  const firstDay = toISTDateStr(first), lastDay = toISTDateStr(last)
  for (let t = Date.parse(firstDay) + 86400_000; ; t += 86400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    if (d >= lastDay) break
    const dow = new Date(t).getUTCDay()
    if (dow === 0 || dow === 6 || fullDays.has(d) || c.traded.has(d)) continue
    if (cal === 'NSE' && ALL_NSE_HOLIDAYS.has(d)) continue
    let who = c.closed.get(d)
    if (!who) c.closed.set(d, who = new Set())
    if (who.size < CLOSED_CONFIRMATIONS && !who.has(ticker)) {
      who.add(ticker)
      changed = true
      if (who.size === CLOSED_CONFIRMATIONS) console.log(`[MarketCalendar] Learned ${cal} closed day ${d} (no trading in ${[...who].join(', ')})`)
    }
  }
  if (changed) saveLearned()
}

/** Forget everything learned (tests) */
export function resetLearnedClosedDays() {
  learned = new Map()
  try { fs.unlinkSync(CLOSED_DAYS_FILE) } catch {}
}

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
  return isClosedDate(toISTDateStr(utcMs), 'NSE')
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

  // NSE-group exchanges share NSE's holidays; others use what was learned for them
  const ex = exchange.toUpperCase()
  if (isClosedDay(utcMs, ex)) return false

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
    if (isWeekend(cursor) || isClosedDay(cursor, exchange)) {
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
