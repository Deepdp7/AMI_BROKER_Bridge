/**
 * DataHealth.ts
 *
 * One line per symbol for Symbol Setup: is its history complete, how many trading days are
 * missing, is it downloading, was it cancelled. Days are counted against the trading calendar
 * (weekends, known and learned holidays, and days the broker itself has no trades for in that
 * symbol are not "missing"), from the first stored day up to
 * the last finished trading day.
 *
 * The bars of each symbol are counted per day once (on a reader thread, a symbol at a time), and
 * from then on only the days that were written since are counted again (the database says what it
 * wrote: barWrites). A look at the page after the first costs milliseconds, not a pass over the
 * whole bars table, and the counts never compete with the plugin's history requests (own lane).
 */
import { stmts, getAllSettings, barWrites } from '../db'
import { readDayCountsRanges } from '../db/reader'
import { backfillQueue, backfillStatusMap } from './BackfillQueue'
import { getHistoryFloorMs } from './state/coverageState'
import { isWeekend, isClosedDay, isQuietDay } from './MarketCalendar'
import { perf } from '../system/perf'

export type HealthStatus = 'complete' | 'missing' | 'downloading' | 'cancelled' | 'empty'

export interface SymbolHealth {
  ticker: string
  status: HealthStatus
  /** Trading days with no bars at all, between the first stored day and the last finished one */
  missingDays: number
  /** A few of those days (YYYY-MM-DD), oldest first */
  missingSample: string[]
  /** The requested history depth reaches further back than what is stored */
  olderMissing: boolean
  /** First and last day with bars (YYYY-MM-DD) */
  firstDay: string | null
  lastDay: string | null
  bars: number
}

const DAY_MS = 86_400_000
const IST_MS = 19_800_000
/** Stored history may start this many days after the requested depth before "older history" counts as missing */
const OLDER_SLACK_DAYS = 7

const dayLabel = (d: number) => new Date(d * DAY_MS).toISOString().slice(0, 10)
/** Noon IST of IST day number d, as UTC ms (safe for weekday/holiday checks) */
const noonOf = (d: number) => d * DAY_MS - IST_MS + 12 * 3600_000

/** The last IST day whose session is over: today after 15:30 IST, otherwise yesterday */
function lastFinishedDay(nowMs: number): number {
  const istMs = nowMs + IST_MS
  const today = Math.floor(istMs / DAY_MS)
  const minutes = Math.floor((istMs % DAY_MS) / 60_000)
  return minutes >= 15 * 60 + 30 ? today : today - 1
}

// ---- What the database holds, per symbol and IST day ----
const DAY_SEC = 86_400
const IST_SEC = 19_800
const NO_END_SEC = 9e15
/** Day numbers (days since 1970 in IST) the counts start at: older days are not tracked */
let baseDay: number | null = null
/** How many days from baseDay each ticker's counts hold (grows as the days go by) */
let spanDays = 0
/** ticker → bars on each IST day since baseDay (index = day - baseDay). A ticker listed here has been counted. */
const counts = new Map<string, Uint16Array>()
/** ticker → [fromSec, toSec]: written since it was counted (the union of what changed) */
const dirty = new Map<string, [number, number]>()
/** Bumped when counts can no longer be trusted mid-flight (a symbol was removed, everything was reset) */
let epoch = 0

const dayOfSec = (sec: number) => Math.floor((sec + IST_SEC) / DAY_SEC)
const startOfDaySec = (day: number) => day * DAY_SEC - IST_SEC

barWrites.on('changed', (ticker: string, fromSec: number, toSec: number) => {
  const d = dirty.get(ticker)
  if (!d) dirty.set(ticker, [fromSec, toSec])
  else { if (fromSec < d[0]) d[0] = fromSec; if (toSec > d[1]) d[1] = toSec }
})
barWrites.on('removed', (ticker: string) => { counts.delete(ticker); dirty.delete(ticker); epoch++ })
barWrites.on('reset', () => { forgetHealthState() })

/** Forget every count: the next picture counts everything again (after the data was wiped or replaced) */
export function forgetHealthState() {
  counts.clear(); dirty.clear(); baseDay = null; spanDays = 0; epoch++
}

function ensureSpan(days: number) {
  if (days <= spanDays) return
  const size = days + 30   // headroom: the next month needs no new arrays
  for (const [t, a] of counts) { const b = new Uint16Array(size); b.set(a); counts.set(t, b) }
  spanDays = size
}

/** Moves the start of the counts forward (the window slides with the clock) */
function slideBase(newBase: number) {
  const shift = newBase - baseDay!
  for (const [t, a] of counts) { const b = new Uint16Array(spanDays); b.set(a.subarray(shift)); counts.set(t, b) }
  baseDay = newBase
}

/** Counts the days of `from`..`to` day ranges of some tickers and stores them, replacing what was there */
async function countRanges(tasks: Array<{ ticker: string; fromDay: number; toDay: number }>) {
  const reads = tasks.map(t => ({ ticker: t.ticker, fromSec: startOfDaySec(t.fromDay), toSec: t.toDay >= 1e9 ? NO_END_SEC : startOfDaySec(t.toDay + 1) }))
  const startedAt = performance.now()
  const rows = await readDayCountsRanges(reads)
  perf.record('health.scan_ms', performance.now() - startedAt)
  perf.count('health.ranges_read', tasks.length)
  return { tasks, rows }
}

function applyCounts(t: { ticker: string; fromDay: number; toDay: number }, rows: Array<[number, number]>) {
  let a = counts.get(t.ticker)
  if (!a) { a = new Uint16Array(spanDays); counts.set(t.ticker, a) }
  const lo = Math.max(t.fromDay, baseDay!), hi = Math.min(t.toDay, baseDay! + spanDays - 1)
  for (let d = lo; d <= hi; d++) a[d - baseDay!] = 0
  for (const [d, n] of rows) if (d >= baseDay! && d - baseDay! < spanDays) a[d - baseDay!] = Math.min(n, 65535)
}

/**
 * Brings the counts up to date with the database: every symbol not counted yet is counted over the whole
 * window (a symbol at a time on the bulk reader lane), the others only over the days that were written
 * since. Returns false when something was removed or reset meanwhile (the caller starts over).
 */
async function refreshCounts(fromDay: number, todayDay: number, tickers: string[]): Promise<boolean> {
  const started = epoch
  if (baseDay === null || fromDay < baseDay) { counts.clear(); baseDay = fromDay; spanDays = 0 }   // first time, or a deeper history was asked for
  else if (fromDay > baseDay) slideBase(fromDay)
  ensureSpan(todayDay - baseDay + 2)

  const wanted = new Set(tickers)
  for (const t of [...counts.keys()]) if (!wanted.has(t)) { counts.delete(t); dirty.delete(t) }   // a symbol that is gone

  const work: Array<{ ticker: string; fromDay: number; toDay: number; whole: boolean }> = []
  for (const ticker of tickers) {
    if (!counts.has(ticker)) {
      dirty.delete(ticker)   // what is written from here on is dirty again (and may already be in this count: harmless)
      work.push({ ticker, fromDay: baseDay, toDay: 1e9, whole: true })
    } else {
      const d = dirty.get(ticker)
      if (!d) continue
      dirty.delete(ticker)
      const dFrom = Math.max(dayOfSec(d[0]), baseDay), dTo = dayOfSec(d[1])
      if (dTo >= dFrom) work.push({ ticker, fromDay: dFrom, toDay: dTo, whole: false })
    }
  }
  if (!work.length) return true

  // Whole-window counts are read one symbol per request (each is a long range); small ones in groups of 50
  const batches: typeof work[] = []
  let cur: typeof work = []
  for (const w of work) {
    if (w.whole) { batches.push([w]); continue }
    cur.push(w)
    if (cur.length >= 50) { batches.push(cur); cur = [] }
  }
  if (cur.length) batches.push(cur)

  const waiting = new Set(work)   // not counted yet: whatever stops this pass, these days are still to be counted

  // Two requests at a time: the bulk lane has two workers
  let next = 0
  let failed: unknown = null
  const lane = async () => {
    while (next < batches.length && !failed) {
      const batch = batches[next++]
      try {
        const { rows } = await countRanges(batch)
        if (epoch !== started) return
        batch.forEach((t, i) => { applyCounts(t, rows[i]); waiting.delete(t) })
      } catch (err) {
        failed = err
      }
    }
  }
  await Promise.all([lane(), lane()])
  // Counted again at the next look (a read failed, or a symbol was removed while the others were being counted)
  for (const t of waiting) { if (t.whole) counts.delete(t.ticker); else markDirtyDays(t.ticker, t.fromDay, t.toDay) }
  if (failed) throw failed
  return epoch === started
}

function markDirtyDays(ticker: string, fromDay: number, toDay: number) {
  const lo = startOfDaySec(fromDay), hi = startOfDaySec(toDay + 1) - 1
  const d = dirty.get(ticker)
  if (!d) dirty.set(ticker, [lo, hi])
  else { d[0] = Math.min(d[0], lo); d[1] = Math.max(d[1], hi) }
}

let cache: { at: number; result: SymbolHealth[] } | null = null
/** An answer this young is used as it is */
const CACHE_MS = 30_000
/** An older answer (up to this age) is still handed out at once while a new one is worked out */
const STALE_OK_MS = 5 * 60_000
let inflight: Promise<SymbolHealth[]> | null = null
/** Bumped by invalidateHealth, so a check that began before a repair can't store its old picture */
let generation = 0

/**
 * The picture of every symbol's history. Reading all the stored days takes a few seconds, so a
 * recent answer is handed out immediately (the page then shows its health lines at once instead
 * of seconds later) and a refresh runs in the background; two checks never run at the same time.
 */
export async function computeHealth(force = false): Promise<SymbolHealth[]> {
  const age = cache ? Date.now() - cache.at : Infinity
  if (!force && cache && age < CACHE_MS) return cache.result
  if (!force && cache && age < STALE_OK_MS) {
    recompute().catch(() => {})
    return cache.result
  }
  if (force && inflight) await inflight.catch(() => {}) // that one may predate what the caller just did
  return recompute()
}

/** How old the stored answer is (the page asks again soon when it got an old one) */
export function healthAgeMs(): number {
  return cache ? Date.now() - cache.at : Infinity
}

/** Work the picture out ahead of the first look (called shortly after the engine starts) */
export function warmHealth() {
  computeHealth().catch(() => {})
}

function recompute(): Promise<SymbolHealth[]> {
  inflight ??= compute().finally(() => { inflight = null })
  return inflight
}

async function compute(): Promise<SymbolHealth[]> {
  const startedGeneration = generation
  const computeStartedAt = performance.now()
  const nowMs = Date.now()
  const depthDays = Number((getAllSettings() as any)?.backfillDepthDays) || 365
  const fromMs = nowMs - depthDays * DAY_MS
  const fromDay = Math.floor((fromMs + IST_MS) / DAY_MS)
  const lastDay = lastFinishedDay(nowMs)
  const symbols = (stmts.getSymbols.all() as any[]).filter(s => s.amiBrokerTicker || s.amibroker_ticker)
  // Something removed or reset while counting: count again (rare, and the second time nothing interrupts)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await refreshCounts(fromDay, Math.floor((nowMs + IST_MS) / DAY_MS), symbols.map(s => s.amiBrokerTicker || s.amibroker_ticker))) break
  }

  const result: SymbolHealth[] = []
  for (const sym of symbols) {
    const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
    const exchange = sym.exchange || 'NSE'
    const c = counts.get(ticker)
    const base = baseDay ?? fromDay
    let first: number | null = null, last: number | null = null, total = 0
    if (c) {
      for (let i = 0; i < c.length; i++) {
        if (c[i] === 0) continue
        if (first === null) first = base + i
        last = base + i
        total += c[i]
      }
    }
    const hasDay = (d: number) => !!c && d >= base && d - base < c.length && c[d - base] > 0

    const missing: number[] = []
    if (first !== null) {
      for (let d = first; d <= lastDay; d++) {
        if (hasDay(d)) continue
        const noon = noonOf(d)
        if (isWeekend(noon) || isClosedDay(noon, exchange) || isQuietDay(noon, exchange, ticker)) continue
        missing.push(d)
      }
    }
    // History starts well after the requested depth, and the broker hasn't been asked that far back
    const floor = getHistoryFloorMs(ticker)
    const olderMissing = first !== null && first > fromDay + OLDER_SLACK_DAYS && !(floor !== undefined && floor <= fromMs + DAY_MS)

    const st = backfillStatusMap.get(ticker)?.status
    let status: HealthStatus
    if (st === 'pending' || st === 'running') status = 'downloading'
    else if (backfillQueue.isSkipped(ticker)) status = 'cancelled'
    else if (first === null) status = 'empty'
    else if (missing.length > 0 || olderMissing) status = 'missing'
    else status = 'complete'

    result.push({
      ticker, status,
      missingDays: missing.length,
      missingSample: missing.slice(0, 5).map(dayLabel),
      olderMissing,
      firstDay: first === null ? null : dayLabel(first),
      lastDay: last === null ? null : dayLabel(last),
      bars: total,
    })
  }
  if (startedGeneration === generation) cache = { at: Date.now(), result }
  perf.record('health.compute_ms', performance.now() - computeStartedAt)
  return result
}

/** Forget the cached result (after a repair, so the next look is fresh) */
export function invalidateHealth() {
  generation++
  cache = null
}
