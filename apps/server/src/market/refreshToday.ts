/**
 * Re-download today's bars (midnight IST → now), even during the live market: the app's
 * "Refresh today" buttons and AmiBroker's right-click menu on the DataBridge status light.
 */
import { stmts } from '../db'
import { backfillQueue } from './BackfillQueue'

/** Midnight IST of today (UTC ms) */
export function midnightIstMs(nowMs = Date.now()): number {
  const nowIST = new Date(nowMs + 5.5 * 3600 * 1000)
  return Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - (5.5 * 3600 * 1000)
}

/** Re-downloads today's bars for one symbol; a reason when it can't */
export function refreshTodayFor(sym: any, midnightIST: number, nowMs: number): string | null {
  const ticker = String(sym.amiBrokerTicker || sym.amibroker_ticker).toUpperCase()
  const brokerId = sym.brokerId || sym.broker_id
  if (!brokerId || brokerId === 'orphaned') return `Symbol ${ticker} has no active broker.`
  const brokerToken = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
  // Cancel any existing queued tasks for this ticker first, then re-enqueue as a forced gap-fill
  backfillQueue.cancel(ticker)
  backfillQueue.enqueueGapFill(ticker, brokerId, brokerToken, midnightIST, nowMs, true)
  return null
}

/** Today's bars again for these tickers (all symbols when null) */
export function refreshToday(tickers: string[] | null, nowMs = Date.now()): { queued: number; skipped: number } {
  const wanted = tickers ? new Set(tickers.map(t => String(t).toUpperCase())) : null
  const midnight = midnightIstMs(nowMs)
  let queued = 0, skipped = 0
  for (const sym of stmts.getSymbols.all() as any[]) {
    if (wanted && !wanted.has(String(sym.amiBrokerTicker || sym.amibroker_ticker).toUpperCase())) continue
    if (refreshTodayFor(sym, midnight, nowMs)) skipped++
    else queued++
  }
  return { queued, skipped }
}
