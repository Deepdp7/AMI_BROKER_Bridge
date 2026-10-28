/**
 * DataHealth.ts
 *
 * One line per symbol for Symbol Setup: is its history complete, how many trading days are
 * missing, is it downloading, was it cancelled. Days are counted against the trading calendar
 * (weekends, known and learned holidays are not "missing"), from the first stored day up to
 * the last finished trading day. Computed in one database pass on a reader thread.
 */
import { stmts, getAllSettings } from '../db'
import { readDayCounts } from '../db/reader'
import { backfillQueue, backfillStatusMap } from './BackfillQueue'
import { getHistoryFloorMs } from './state/coverageState'
import { isWeekend, isClosedDay } from './MarketCalendar'

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
  const nowMs = Date.now()
  const depthDays = Number((getAllSettings() as any)?.backfillDepthDays) || 365
  const fromMs = nowMs - depthDays * DAY_MS
  const fromDay = Math.floor((fromMs + IST_MS) / DAY_MS)
  const lastDay = lastFinishedDay(nowMs)
  const counts = await readDayCounts(Math.floor(fromMs / 1000))

  const result: SymbolHealth[] = []
  for (const sym of stmts.getSymbols.all() as any[]) {
    const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
    if (!ticker) continue
    const exchange = sym.exchange || 'NSE'
    const c = counts[ticker]
    const days = new Set(c?.days ?? [])
    const first = c?.days.length ? Math.min(...c.days) : null
    const last = c?.days.length ? Math.max(...c.days) : null

    const missing: number[] = []
    if (first !== null) {
      for (let d = first; d <= lastDay; d++) {
        if (days.has(d)) continue
        const noon = noonOf(d)
        if (isWeekend(noon) || isClosedDay(noon, exchange)) continue
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
      bars: c?.bars ?? 0,
    })
  }
  if (startedGeneration === generation) cache = { at: Date.now(), result }
  return result
}

/** Forget the cached result (after a repair, so the next look is fresh) */
export function invalidateHealth() {
  generation++
  cache = null
}
