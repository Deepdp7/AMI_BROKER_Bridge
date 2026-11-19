/**
 * Every tracked symbol's current quote as plain lines, for the platforms that poll it (the Excel
 * live-price connector reads it twice a second, MetaTrader's connector gets it as a file):
 *
 *   TICKER|ltp|open|high|low|prevClose|change|change%|volume|oi|bid|ask|lastTickMs|lot|status
 *
 * The live feed knows the last price, change, volume and OI; the day's open, high and low are
 * kept here from the live 1-minute bars, and filled from the stored bars of today the first time
 * a symbol is asked for (after a restart the live feed starts from nothing).
 */
import { liveFeed } from '../market/liveFeed'
import { readCandles } from '../db/reader'
import { symbolDetailsCached } from '../amibroker/symbolDetails'
import type { SymbolFeedStatus } from '../types'

const IST_MS = 19_800_000
const DAY_MS = 86_400_000

/** IST midnight (as unix ms) of the day `ms` falls on */
export const istMidnight = (ms: number) => Math.floor((ms + IST_MS) / DAY_MS) * DAY_MS - IST_MS

export interface DayStats { day: number; open: number; high: number; low: number }

/** Folds one 1-minute bar into the day's stats (a new IST day starts over) */
export function foldBar(prev: DayStats | undefined, bar: { bucketMs: number; open: number; high: number; low: number }): DayStats {
  const day = istMidnight(bar.bucketMs)
  if (!prev || prev.day !== day || !(prev.open > 0)) return { day, open: bar.open, high: bar.high, low: bar.low }
  return { day, open: prev.open, high: Math.max(prev.high, bar.high), low: prev.low > 0 ? Math.min(prev.low, bar.low) : bar.low }
}

const dayStats = new Map<string, DayStats>()
const seeded = new Map<string, number>()   // ticker → day seeded from the database
let lots = new Map<string, number>()
let lotsAt = 0
let started = false

/** Starts keeping the day's open/high/low from live bars (and the stored ones, once a day) */
export function startQuotes() {
  if (started) return
  started = true
  liveFeed.on('live_bar_updated', ({ ticker, bar }: { ticker: string; bar: any }) => {
    if (!(bar?.open > 0) || !bar.bucketMs) return
    dayStats.set(ticker, foldBar(dayStats.get(ticker), bar))
    if (seeded.get(ticker) !== istMidnight(bar.bucketMs)) seedFromDatabase(ticker, bar.bucketMs)
  })
}
const start = startQuotes

/** One symbol's quote with today's open/high/low (asks the database once a day for what's missing) */
export function quoteOf(ticker: string, nowMs = Date.now()) {
  start()
  const s = liveFeed.getFeedStatus(ticker)
  if (!s) return undefined
  if (seeded.get(ticker) !== istMidnight(nowMs)) seedFromDatabase(ticker, nowMs)
  const d = dayStats.get(ticker)
  const today = d && d.day === istMidnight(nowMs) ? d : undefined
  // The last price is part of the day's range even before its bar reached the stats
  const last = s.lastPrice > 0 && s.lastTickUtcMs >= istMidnight(nowMs) ? s.lastPrice : 0
  const high = Math.max(today?.high ?? 0, last)
  const low = today?.low && last ? Math.min(today.low, last) : (today?.low || last)
  return { status: s, open: today?.open || last, high, low }
}

/**
 * Once per day per symbol, from the stored bars: today's open/high/low so far (earlier minutes
 * the live feed missed), and the previous session's close. Most broker feeds don't send that
 * close (Fyers, Kite and Dhan do, and theirs is used instead); without it the change was shown
 * as 0.00% everywhere. From bars it is the session's last traded price, which can differ a
 * little from the exchange's official close (an average of the last half hour on NSE).
 */
function seedFromDatabase(ticker: string, nowMs: number) {
  const day = istMidnight(nowMs)
  if (seeded.get(ticker) === day) return
  seeded.set(ticker, day)
  // Daily candles of the last two weeks (long holidays included), buckets on IST days
  readCandles(ticker, day - 14 * DAY_MS, DAY_MS, day, 15).then(rows => {
    const before = rows.filter(r => r.t < day)
    const prev = before[before.length - 1]
    if (prev?.close > 0) liveFeed.setPrevClose(ticker, prev.close, Math.round((day + IST_MS) / DAY_MS))
    const c = rows[rows.length - 1]
    if (!c || istMidnight(c.t) !== day) return
    const live = dayStats.get(ticker)
    if (!live || live.day !== day) dayStats.set(ticker, { day, open: c.open, high: c.high, low: c.low })
    // The stored day began earlier than the live bars: its open wins, highs and lows combine
    else dayStats.set(ticker, { day, open: c.open, high: Math.max(c.high, live.high), low: Math.min(c.low, live.low) })
  }).catch(() => seeded.delete(ticker))
}

function refreshLots(nowMs: number) {
  if (nowMs - lotsAt < 5 * 60_000) return
  lotsAt = nowMs
  symbolDetailsCached(nowMs).then(rows => {
    lots = new Map(rows.filter(r => r.details?.lotSize).map(r => [r.ticker, r.details!.lotSize]))
  }).catch(() => { lotsAt = 0 })
}

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? String(+v.toFixed(4)) : '0')

/** One line per quote (pure: the route and tests share it) */
export function quoteLine(s: SymbolFeedStatus, day: DayStats | undefined, lot: number | undefined, nowMs: number): string {
  const today = day && day.day === istMidnight(nowMs) ? day : undefined
  const clean = (t: string) => String(t ?? '').replace(/[|\r\n]/g, ' ')
  return [
    clean(s.ticker), num(s.lastPrice), num(today?.open), num(today?.high), num(today?.low), num(s.prevClose),
    num(s.change), num(s.changePercent), num(s.volume), num(s.openInterest), num(s.bid), num(s.ask),
    String(s.lastTickUtcMs || 0), num(lot), clean(String(s.status || '')),
  ].join('|')
}

/** Every tracked symbol's quote */
export function quoteLines(nowMs = Date.now()): string {
  start()
  refreshLots(nowMs)
  const out: string[] = []
  for (const s of liveFeed.getFeedStatuses()) {
    if (!dayStats.has(s.ticker) || dayStats.get(s.ticker)!.day !== istMidnight(nowMs)) seedFromDatabase(s.ticker, nowMs)
    out.push(quoteLine(s, dayStats.get(s.ticker), lots.get(s.ticker), nowMs))
  }
  return out.join('\n')
}
