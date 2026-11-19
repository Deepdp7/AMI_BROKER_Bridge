/**
 * Live places, when a broker streams fewer symbols than are tracked (Fyers Standard plan: 100
 * per account; 438 symbols left 338 without live prices, their charts moving only when a
 * history refresh reached them).
 *
 * The places go to what is on screen in AmiBroker: the plugin reports every symbol AmiBroker
 * asks it for (VIEW|TICKER, at most every 15 s per symbol), charts every few seconds. A symbol
 * looked at in the last 90 s that has no place takes one from a symbol nobody has looked at for
 * 5 minutes, at most 10 a round, every 10 s. The symbol getting a place has today's bars
 * downloaded once (the minutes it had no live feed); the one giving it up is kept up to date by
 * the history refresh, like every other symbol without a place.
 */
import { stmts } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { liveFeed } from './liveFeed'
import { backfillQueue } from './BackfillQueue'
import { midnightIstMs } from './refreshToday'

/** Looked at within this long: wants a live place */
const WANT_MS = 90_000
/** Looked at within this long: keeps its place */
const KEEP_MS = 5 * 60_000
const MAX_SWAPS_PER_ROUND = 10
const ROUND_MS = 10_000

/** ticker → when AmiBroker last asked for it */
const viewedAt = new Map<string, number>()

/** Per broker: names as subscribed (raw symbols) that stream, and those waiting for a place */
interface Places { live: Set<string>; waiting: Set<string> }
const places = new Map<string, Places>()

/** AmiBroker asked for this symbol (a chart, the quote window, a scan) */
export function noteViewed(ticker: string, nowMs = Date.now()) {
  if (ticker) viewedAt.set(ticker, nowMs)
}

/** raw symbol → ticker, for one broker's symbols */
function tickersByRaw(brokerId: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of stmts.getSymbolsByBroker.all(brokerId) as any[]) {
    const ticker = s.amiBrokerTicker || s.amibroker_ticker
    const raw = s.rawSymbol || s.raw_symbol || s.instrumentId || s.instrument_id || ticker
    if (ticker && raw) out.set(raw, ticker)
  }
  return out
}

/**
 * The broker reported which symbols stream and which it left out. Merged with what is known:
 * a later report covers only what was asked for since, not the symbols already waiting.
 */
export function onLiveCap(brokerId: string, live: string[], waiting: string[]) {
  const prev = places.get(brokerId)
  const p: Places = { live: new Set(live), waiting: new Set([...(prev?.waiting ?? []), ...waiting]) }
  for (const raw of live) p.waiting.delete(raw)
  places.set(brokerId, p)
  const names = tickersByRaw(brokerId)
  for (const raw of p.waiting) liveFeed.setLivePlace(names.get(raw) ?? raw, false)
  for (const raw of p.live) liveFeed.setLivePlace(names.get(raw) ?? raw, true)
}

/** Symbols without a live place, by broker (for the app and the refresh order) */
export function waitingTickers(): Set<string> {
  const out = new Set<string>()
  for (const [brokerId, p] of places) {
    if (!p.waiting.size) continue
    const names = tickersByRaw(brokerId)
    for (const raw of p.waiting) out.add(names.get(raw) ?? raw)
  }
  return out
}

/** When AmiBroker last asked for a symbol (0: not since the engine started) */
export function lastViewedAt(ticker: string): number {
  return viewedAt.get(ticker) ?? 0
}

let rounding = false

/** Moves live places to the symbols on screen (one round) */
export async function rebalance(nowMs = Date.now()) {
  if (rounding) return
  rounding = true
  try {
    for (const [brokerId, p] of places) {
      if (!p.waiting.size || !brokerManager.getAdapter(brokerId)) continue
      const names = tickersByRaw(brokerId)
      // Symbols removed since: no longer part of it
      for (const raw of p.waiting) if (!names.has(raw)) p.waiting.delete(raw)
      for (const raw of p.live) if (!names.has(raw)) p.live.delete(raw)
      const seen = (raw: string) => viewedAt.get(names.get(raw) ?? raw) ?? 0
      const wanted = [...p.waiting].filter(r => nowMs - seen(r) < WANT_MS).sort((a, b) => seen(b) - seen(a))
      if (!wanted.length) continue
      const spare = [...p.live].filter(r => nowMs - seen(r) >= KEEP_MS).sort((a, b) => seen(a) - seen(b))
      const n = Math.min(wanted.length, spare.length, MAX_SWAPS_PER_ROUND)
      if (!n) continue
      const takeIn = wanted.slice(0, n), giveUp = spare.slice(0, n)
      // Places are freed first: the broker counts what streams right now
      await brokerManager.unsubscribe(brokerId, giveUp)
      await brokerManager.subscribe(brokerId, takeIn)
      const midnight = midnightIstMs(nowMs)
      for (const raw of giveUp) {
        p.live.delete(raw); p.waiting.add(raw)
        liveFeed.setLivePlace(names.get(raw) ?? raw, false)
      }
      for (const raw of takeIn) {
        p.waiting.delete(raw); p.live.add(raw)
        const ticker = names.get(raw) ?? raw
        liveFeed.setLivePlace(ticker, true)
        // The minutes it had no live feed (since the last history refresh reached it)
        backfillQueue.enqueueGapFill(ticker, brokerId, raw, midnight, nowMs, true)
      }
      const label = (raws: string[]) => raws.map(r => names.get(r) ?? r).join(', ')
      console.log(`[LiveSlots] ${brokerId}: live prices moved to ${label(takeIn)} (open in AmiBroker) from ${label(giveUp)}`)
    }
  } catch (err) {
    console.error('[LiveSlots] Round failed:', err)
  } finally {
    rounding = false
  }
}

let started = false

/** Listens for brokers' limits and starts the rounds */
export function startLiveSlots() {
  if (started) return
  started = true
  brokerManager.on('live_cap', ({ brokerId, live, waiting }: { brokerId: string; live: string[]; waiting: string[] }) => {
    onLiveCap(brokerId, live, waiting)
  })
  setInterval(() => { rebalance().catch(() => {}) }, ROUND_MS).unref()
}

/** Forget everything (tests) */
export function resetLiveSlots() {
  viewedAt.clear()
  places.clear()
}
