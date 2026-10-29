/**
 * Bars of any timeframe for the platforms that poll them (Excel's =RTD(…,"BAR",…) cells):
 *
 *   GET /api/platforms/bars?ticker=TCS&tf=5m&n=100
 *   unixSec|open|high|low|close|volume      one line per bar, NEWEST FIRST (line 1 = the forming bar)
 *
 * Built from the stored 1-minute bars with the live (not yet stored) minute on top, so the newest
 * bar moves with every tick. Intraday buckets start at 09:15 IST, days at IST midnight.
 */
import { getCandles, listSymbols, TIMEFRAMES, type Timeframe } from '../ai/marketData'

export const MAX_BARS = 2000

/** "5", "5M", "5min" → 5m; "60", "1H", "H" → 1h; "D", "DAY", "1D" → 1d; null when not one of ours */
export function timeframeOf(raw: string): Timeframe | null {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '').replace(/(mins?|minutes?)$/, 'm')
  const aliases: Record<string, Timeframe> = {
    '1': '1m', '1m': '1m', 'm': '1m',
    '5': '5m', '5m': '5m', '15': '15m', '15m': '15m', '30': '30m', '30m': '30m',
    '60': '1h', '60m': '1h', '1h': '1h', 'h': '1h', 'hour': '1h',
    'd': '1d', '1d': '1d', 'day': '1d', 'daily': '1d',
  }
  const tf = aliases[s]
  return tf && (TIMEFRAMES as readonly string[]).includes(tf) ? tf : null
}

/** The newest `n` bars of a tracked symbol, newest first, as lines; null when it isn't tracked */
export async function barLines(ticker: string, tf: Timeframe, n: number): Promise<string | null> {
  const sym = listSymbols().find(s => s.ticker.toUpperCase() === ticker.toUpperCase())
  if (!sym) return null
  const count = Math.max(1, Math.min(MAX_BARS, Math.floor(n) || 1))
  const candles = await getCandles(sym, tf, count)
  const num = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 10_000) / 10_000) : '0')
  return candles.slice(-count).reverse()
    .map(c => [Math.floor(c.t / 1000), num(c.open), num(c.high), num(c.low), num(c.close), String(Math.round(c.volume || 0))].join('|'))
    .join('\n')
}
