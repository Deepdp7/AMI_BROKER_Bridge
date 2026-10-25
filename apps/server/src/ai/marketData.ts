/**
 * marketData.ts
 *
 * Read-only market data + technical indicators for the AI assistant's tools.
 * Every number the assistant quotes comes from here (computed from the bars the
 * bridge already stores), never from the model's own memory.
 *
 * Candles are resampled (on a database reader thread) from the stored 1-minute bars:
 *   intraday buckets are anchored at the NSE open (09:15 IST), daily buckets at IST midnight.
 * The in-progress live bar (not yet persisted) is merged on top.
 */
import { stmts } from '../db'
import { readCandles, readHighLow } from '../db/reader'
import { liveFeed } from '../market/liveFeed'

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '1d'] as const
export type Timeframe = typeof TIMEFRAMES[number]

const IST_OFFSET_MS = 5.5 * 3600 * 1000
const NSE_OPEN_UTC_MS = (3 * 60 + 45) * 60 * 1000 // 09:15 IST = 03:45 UTC

const TF: Record<Timeframe, { ms: number; origin: number; sessionMinutes: number }> = {
  '1m':  { ms: 60_000,     origin: 0,               sessionMinutes: 1 },
  '5m':  { ms: 300_000,    origin: NSE_OPEN_UTC_MS, sessionMinutes: 5 },
  '15m': { ms: 900_000,    origin: NSE_OPEN_UTC_MS, sessionMinutes: 15 },
  '30m': { ms: 1_800_000,  origin: NSE_OPEN_UTC_MS, sessionMinutes: 30 },
  '1h':  { ms: 3_600_000,  origin: NSE_OPEN_UTC_MS, sessionMinutes: 60 },
  '1d':  { ms: 86_400_000, origin: -IST_OFFSET_MS,  sessionMinutes: 375 },
}

export interface Candle { t: number; open: number; high: number; low: number; close: number; volume: number }

export interface SymbolRecord { ticker: string; brokerId: string; exchange: string; instrumentType: string }

// ===== Helpers =====

const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100)

export function istString(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ')
}

function istDate(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function isMarketOpenNow(): boolean {
  const ist = new Date(Date.now() + IST_OFFSET_MS)
  const day = ist.getUTCDay()
  const min = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return day !== 0 && day !== 6 && min >= 9 * 60 + 15 && min < 15 * 60 + 30
}

export function listSymbols(): SymbolRecord[] {
  return (stmts.getSymbols.all() as any[])
    .map(s => ({
      ticker: s.amiBrokerTicker || s.amibroker_ticker,
      brokerId: s.brokerId || s.broker_id,
      exchange: s.exchange || 'NSE',
      instrumentType: s.instrumentType || s.instrument_type || 'EQ',
    }))
    .filter(s => s.ticker && s.brokerId && s.brokerId !== 'orphaned')
}

/** Exact (case-insensitive) match, or null plus suggestions. */
export function resolveSymbol(input: string): { symbol: SymbolRecord | null; suggestions: string[] } {
  const q = input.trim().toUpperCase().replace(/^(NSE|BSE):/, '').replace(/-EQ$/, '')
  const all = listSymbols()
  const exact = all.find(s => s.ticker.toUpperCase() === q)
  if (exact) return { symbol: exact, suggestions: [] }
  const suggestions = all.filter(s => s.ticker.toUpperCase().includes(q) || q.includes(s.ticker.toUpperCase())).map(s => s.ticker).slice(0, 8)
  return { symbol: null, suggestions }
}

// ===== Candles =====

/** Calendar lookback that comfortably covers `count` candles of a timeframe (weekends + holidays). */
function lookbackMs(tf: Timeframe, count: number): number {
  const tradingMinutes = count * TF[tf].sessionMinutes
  const tradingDays = Math.ceil(tradingMinutes / 375)
  const calendarDays = Math.ceil(tradingDays * 1.6) + 5
  return calendarDays * 86_400_000
}

export async function getCandles(sym: SymbolRecord, tf: Timeframe, count: number): Promise<Candle[]> {
  const { ms, origin } = TF[tf]
  const fromMs = Date.now() - lookbackMs(tf, count)
  const candles: Candle[] = await readCandles(sym.ticker, fromMs, ms, origin, count)

  // Merge the in-progress live bar (current minute, not yet persisted)
  const live = liveFeed.getLiveBar(sym.ticker, sym.brokerId)
  if (live && live.close > 0) {
    const bucket = Math.floor((live.bucketMs - origin) / ms) * ms + origin
    const last = candles[candles.length - 1]
    if (last && last.t === bucket) {
      if (tf === '1m') {
        Object.assign(last, { open: live.open, high: live.high, low: live.low, close: live.close, volume: live.volume })
      } else {
        last.high = Math.max(last.high, live.high)
        last.low = Math.min(last.low, live.low)
        last.close = live.close
        last.volume += live.volume
      }
    } else if (!last || bucket > last.t) {
      candles.push({ t: bucket, open: live.open, high: live.high, low: live.low, close: live.close, volume: live.volume })
      if (candles.length > count) candles.shift()
    }
  }
  return candles
}

// ===== Indicators =====

function sma(v: number[], n: number): number | null {
  if (v.length < n) return null
  let s = 0
  for (let i = v.length - n; i < v.length; i++) s += v[i]
  return s / n
}

function emaSeries(v: number[], n: number): number[] {
  const out: number[] = new Array(v.length).fill(NaN)
  if (v.length < n) return out
  const k = 2 / (n + 1)
  let prev = 0
  for (let i = 0; i < n; i++) prev += v[i]
  prev /= n
  out[n - 1] = prev
  for (let i = n; i < v.length; i++) {
    prev = v[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function rsi(c: number[], n = 14): number | null {
  if (c.length < n + 1) return null
  let gain = 0, loss = 0
  for (let i = 1; i <= n; i++) {
    const d = c[i] - c[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  gain /= n; loss /= n
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
}

function macd(c: number[]) {
  const e12 = emaSeries(c, 12), e26 = emaSeries(c, 26)
  const line: number[] = []
  for (let i = 0; i < c.length; i++) if (Number.isFinite(e12[i]) && Number.isFinite(e26[i])) line.push(e12[i] - e26[i])
  if (line.length < 9) return null
  const sig = emaSeries(line, 9)
  const n = line.length
  // Crossover within the last 3 candles
  let crossover: 'bullish' | 'bearish' | null = null
  for (let i = Math.max(9, n - 3); i < n; i++) {
    const prevDiff = line[i - 1] - sig[i - 1], diff = line[i] - sig[i]
    if (Number.isFinite(prevDiff) && prevDiff <= 0 && diff > 0) crossover = 'bullish'
    if (Number.isFinite(prevDiff) && prevDiff >= 0 && diff < 0) crossover = 'bearish'
  }
  return { macd: line[n - 1], signal: sig[n - 1], histogram: line[n - 1] - sig[n - 1], crossover }
}

function atr(c: Candle[], n = 14): number | null {
  if (c.length < n + 1) return null
  const tr: number[] = []
  for (let i = 1; i < c.length; i++) {
    tr.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close)))
  }
  let a = tr.slice(0, n).reduce((s, x) => s + x, 0) / n
  for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n
  return a
}

function bollinger(c: number[], n = 20, k = 2) {
  const mid = sma(c, n)
  if (mid === null) return null
  const slice = c.slice(-n)
  const sd = Math.sqrt(slice.reduce((s, x) => s + (x - mid) ** 2, 0) / n)
  return { upper: mid + k * sd, middle: mid, lower: mid - k * sd }
}

/** Swing highs/lows (pivot with 3 candles each side) nearest to the current price. */
function supportResistance(c: Candle[], price: number) {
  const recent = c.slice(-150)
  const highs: number[] = [], lows: number[] = []
  for (let i = 3; i < recent.length - 3; i++) {
    const w = recent.slice(i - 3, i + 4)
    if (recent[i].high === Math.max(...w.map(x => x.high))) highs.push(recent[i].high)
    if (recent[i].low === Math.min(...w.map(x => x.low))) lows.push(recent[i].low)
  }
  const support = [...new Set(lows.filter(l => l < price))].sort((a, b) => b - a).slice(0, 2)
  const resistance = [...new Set(highs.filter(h => h > price))].sort((a, b) => a - b).slice(0, 2)
  return { support: support.map(r2), resistance: resistance.map(r2) }
}

export async function analyze(sym: SymbolRecord, tf: Timeframe, bars = 250) {
  const candles = await getCandles(sym, tf, Math.max(bars, 60))
  if (candles.length < 20) {
    return { ticker: sym.ticker, timeframe: tf, error: `Only ${candles.length} ${tf} candles stored — history may still be downloading.` }
  }
  const closes = candles.map(c => c.close)
  const last = candles[candles.length - 1]
  const price = last.close

  const ema9 = emaSeries(closes, 9).at(-1)!
  const ema21 = emaSeries(closes, 21).at(-1)!
  const sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma200 = sma(closes, 200)
  const rsi14 = rsi(closes)
  const m = macd(closes)
  const atr14 = atr(candles)
  const bb = bollinger(closes)
  // Compare the last *completed* candle's volume — the forming one would always look tiny
  const forming = last.t + TF[tf].ms > Date.now()
  const volIdx = forming ? candles.length - 2 : candles.length - 1
  const avgVol20 = volIdx >= 20 ? sma(candles.slice(volIdx - 20, volIdx).map(c => c.volume), 20) : null
  const volumeRatio = avgVol20 ? candles[volIdx].volume / avgVol20 : null
  const periodHigh = Math.max(...candles.map(c => c.high))
  const periodLow = Math.min(...candles.map(c => c.low))
  const levels = supportResistance(candles, price)

  // Session VWAP for intraday timeframes
  let vwap: number | null = null
  if (tf !== '1d') {
    const today = istDate(last.t)
    const session = candles.filter(c => istDate(c.t) === today)
    const vol = session.reduce((s, c) => s + c.volume, 0)
    if (vol > 0) vwap = session.reduce((s, c) => s + ((c.high + c.low + c.close) / 3) * c.volume, 0) / vol
  }

  // Rule-based reading — gives the model facts to explain, not a verdict to invent
  const signals: string[] = []
  let score = 0
  if (Number.isFinite(ema9) && Number.isFinite(ema21)) {
    if (ema9 > ema21) { score++; signals.push('EMA9 above EMA21 (short-term momentum up)') }
    else { score--; signals.push('EMA9 below EMA21 (short-term momentum down)') }
  }
  if (sma50 !== null) { if (price > sma50) { score++; signals.push('Price above SMA50') } else { score--; signals.push('Price below SMA50') } }
  if (sma200 !== null) { if (price > sma200) { score++; signals.push('Price above SMA200 (long-term uptrend)') } else { score--; signals.push('Price below SMA200 (long-term downtrend)') } }
  if (rsi14 !== null) {
    if (rsi14 >= 70) signals.push(`RSI ${r2(rsi14)} — overbought`)
    else if (rsi14 <= 30) signals.push(`RSI ${r2(rsi14)} — oversold`)
    else if (rsi14 > 55) { score++; signals.push(`RSI ${r2(rsi14)} — bullish zone`) }
    else if (rsi14 < 45) { score--; signals.push(`RSI ${r2(rsi14)} — bearish zone`) }
  }
  if (m) {
    if (m.histogram > 0) score++; else score--
    if (m.crossover) signals.push(`MACD ${m.crossover} crossover in the last 3 candles`)
  }
  if (vwap !== null) signals.push(price > vwap ? 'Trading above session VWAP' : 'Trading below session VWAP')
  if (bb) {
    if (price > bb.upper) signals.push('Closed above upper Bollinger Band (stretched up)')
    if (price < bb.lower) signals.push('Closed below lower Bollinger Band (stretched down)')
  }
  if (volumeRatio !== null && volumeRatio >= 2) signals.push(`Volume ${r2(volumeRatio)}x the 20-candle average`)
  if (price >= periodHigh * 0.99) signals.push('Within 1% of the period high')
  if (price <= periodLow * 1.01) signals.push('Within 1% of the period low')

  const bias = score >= 3 ? 'bullish' : score >= 1 ? 'mildly bullish' : score <= -3 ? 'bearish' : score <= -1 ? 'mildly bearish' : 'neutral'

  return {
    ticker: sym.ticker,
    exchange: sym.exchange,
    timeframe: tf,
    asOfIST: istString(last.t),
    candlesUsed: candles.length,
    price: r2(price),
    changeOverPeriodPct: r2(((price - candles[0].close) / candles[0].close) * 100),
    technicalBias: bias,
    biasScore: score,
    signals,
    indicators: {
      ema9: r2(ema9), ema21: r2(ema21), sma20: r2(sma20), sma50: r2(sma50), sma200: r2(sma200),
      rsi14: r2(rsi14),
      macd: m ? { macd: r2(m.macd), signal: r2(m.signal), histogram: r2(m.histogram), crossover: m.crossover } : null,
      bollinger: bb ? { upper: r2(bb.upper), middle: r2(bb.middle), lower: r2(bb.lower) } : null,
      atr14: r2(atr14),
      vwap: r2(vwap),
      volumeVs20Avg: r2(volumeRatio),
    },
    levels: { ...levels, periodHigh: r2(periodHigh), periodLow: r2(periodLow) },
    lastCandles: candles.slice(-8).map(c => ({
      timeIST: istString(c.t), open: r2(c.open), high: r2(c.high), low: r2(c.low), close: r2(c.close), volume: Math.round(c.volume),
    })),
  }
}

export async function getQuote(sym: SymbolRecord) {
  const daily = await getCandles(sym, '1d', 2)
  const todayStr = istDate(Date.now())
  const today = daily.length && istDate(daily[daily.length - 1].t) === todayStr ? daily[daily.length - 1] : null
  const prev = today ? daily[daily.length - 2] : daily[daily.length - 1]
  const status = liveFeed.getFeedStatus(sym.ticker)
  const live = liveFeed.getLiveBar(sym.ticker, sym.brokerId)
  const price = live && live.close > 0 ? live.close : (today ?? prev)?.close
  if (!price) return { ticker: sym.ticker, error: 'No data stored yet for this symbol — history may still be downloading.' }

  const yr = await readHighLow(sym.ticker, Date.now() - 365 * 86_400_000)
  const prevClose = prev?.close ?? null
  return {
    ticker: sym.ticker,
    exchange: sym.exchange,
    asOfIST: istString(status?.lastTickUtcMs || Date.now()),
    marketOpen: isMarketOpenNow(),
    feedStatus: status?.status ?? 'UNKNOWN',
    lastPrice: r2(price),
    previousClose: r2(prevClose),
    change: prevClose ? r2(price - prevClose) : null,
    changePct: prevClose ? r2(((price - prevClose) / prevClose) * 100) : null,
    today: today ? { open: r2(today.open), high: r2(Math.max(today.high, price)), low: r2(Math.min(today.low, price)), volume: Math.round(today.volume) } : null,
    week52: { high: r2(yr.hi), low: r2(yr.lo) },
  }
}

// ===== Scanner =====

export const SCAN_CRITERIA = [
  'top_gainers', 'top_losers', 'oversold', 'overbought', 'volume_spike',
  'bullish_macd_crossover', 'bearish_macd_crossover', 'near_period_high', 'near_period_low',
  'above_sma200', 'below_sma200', 'strongest_bullish', 'strongest_bearish',
] as const
export type ScanCriterion = typeof SCAN_CRITERIA[number]

export async function scan(criterion: ScanCriterion, tf: Timeframe, limit: number) {
  const symbols = listSymbols()
  const rows: any[] = []
  const queue = [...symbols]
  // A few at a time so the pool stays free for AmiBroker / live writes
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let sym = queue.shift(); sym; sym = queue.shift()) {
      try {
        const a: any = await analyze(sym, tf, 220)
        if (a.error) continue
        const q: any = tf === '1d' ? null : await getQuote(sym)
        rows.push({
          ticker: a.ticker, price: a.price,
          dayChangePct: tf === '1d' ? r2(((a.lastCandles.at(-1).close - a.lastCandles.at(-2)?.close) / a.lastCandles.at(-2)?.close) * 100) : q?.changePct ?? null,
          rsi14: a.indicators.rsi14, bias: a.technicalBias, biasScore: a.biasScore,
          volumeVs20Avg: a.indicators.volumeVs20Avg, macdCrossover: a.indicators.macd?.crossover ?? null,
          sma200: a.indicators.sma200, periodHigh: a.levels.periodHigh, periodLow: a.levels.periodLow,
        })
      } catch { /* skip symbol */ }
    }
  }))

  const by = (f: (r: any) => number | null, desc = true) => (a: any, b: any) => ((f(desc ? b : a) ?? -Infinity) - (f(desc ? a : b) ?? -Infinity))
  let out: any[]
  switch (criterion) {
    case 'top_gainers': out = rows.filter(r => r.dayChangePct !== null).sort(by(r => r.dayChangePct)); break
    case 'top_losers': out = rows.filter(r => r.dayChangePct !== null).sort(by(r => r.dayChangePct, false)); break
    case 'oversold': out = rows.filter(r => r.rsi14 !== null && r.rsi14 <= 30).sort(by(r => r.rsi14, false)); break
    case 'overbought': out = rows.filter(r => r.rsi14 !== null && r.rsi14 >= 70).sort(by(r => r.rsi14)); break
    case 'volume_spike': out = rows.filter(r => (r.volumeVs20Avg ?? 0) >= 2).sort(by(r => r.volumeVs20Avg)); break
    case 'bullish_macd_crossover': out = rows.filter(r => r.macdCrossover === 'bullish'); break
    case 'bearish_macd_crossover': out = rows.filter(r => r.macdCrossover === 'bearish'); break
    case 'near_period_high': out = rows.filter(r => r.price >= r.periodHigh * 0.98).sort(by(r => r.price / r.periodHigh)); break
    case 'near_period_low': out = rows.filter(r => r.price <= r.periodLow * 1.02).sort(by(r => r.price / r.periodLow, false)); break
    case 'above_sma200': out = rows.filter(r => r.sma200 !== null && r.price > r.sma200); break
    case 'below_sma200': out = rows.filter(r => r.sma200 !== null && r.price < r.sma200); break
    case 'strongest_bullish': out = rows.sort(by(r => r.biasScore)); break
    case 'strongest_bearish': out = rows.sort(by(r => r.biasScore, false)); break
  }
  return {
    criterion, timeframe: tf, asOfIST: istString(Date.now()),
    symbolsScanned: symbols.length, matches: out.length,
    results: out.slice(0, limit),
  }
}
