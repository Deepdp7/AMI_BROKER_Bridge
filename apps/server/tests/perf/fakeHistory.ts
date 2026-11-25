/**
 * A broker that serves history: stands in for an adapter in brokerManager, so the real BackfillQueue,
 * rate limiter and database writes run against it. Each chunk (95 days of 1-minute bars, about 25,000
 * of them) is a JSON text that has to be parsed on the engine's one thread, as a real answer does.
 *
 * Only whole past days are served (never today), so nothing here can overwrite a bar the live feed built.
 */
import { RateLimiter } from '../../src/lib/RateLimiter'
import { perf } from '../../src/system/perf'

const DAY_MS = 86_400_000
const SESSION_START_MIN_UTC = 3 * 60 + 45   // 09:15 IST
const SESSION_MINUTES = 375                  // to 15:29 IST

export interface FakeHistoryOptions {
  /** Network time of one answer */
  latencyMs?: number
  /** Requests a minute the limiter allows (the real brokers allow 45-240) */
  perMinute?: number
}

/** The JSON text of whole past weekdays from `fromDay` to `toDay` (UTC day numbers), one candle [ts, o, h, l, c, v] a minute */
const textCache = new Map<string, string>()
function candlesText(fromDay: number, toDay: number): string {
  const key = `${fromDay}-${toDay}`
  let text = textCache.get(key)
  if (text) return text
  const todayDay = Math.floor(Date.now() / DAY_MS)
  const candles: number[][] = []
  for (let day = fromDay; day <= Math.min(toDay, todayDay - 1); day++) {
    const weekday = new Date(day * DAY_MS).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    let prev = 100 + (day % 40)
    for (let m = 0; m < SESSION_MINUTES; m++) {
      const open = prev
      const close = Math.round((open + Math.sin((day + m) / 17) * 0.3) * 100) / 100
      candles.push([(day * DAY_MS + (SESSION_START_MIN_UTC + m) * 60_000) / 1000, open, Math.max(open, close) + 0.05, Math.min(open, close) - 0.05, close, 100 + (m % 50)])
      prev = close
    }
  }
  text = JSON.stringify({ s: 'ok', candles })
  textCache.set(key, text)
  return text
}

export function makeFakeHistoryAdapter(opts: FakeHistoryOptions = {}) {
  const latencyMs = opts.latencyMs ?? 40
  const limiter = new RateLimiter(10, opts.perMinute ?? 600, undefined, 'sim')
  const stats = { chunks: 0, bars: 0, subscribeCalls: 0, subscribedSymbols: 0, unsubscribeCalls: 0 }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  return {
    stats,
    /** Fyers' own cap per request */
    maxIntradayHistoryDays: 95,
    historyRequestsPerMinute: () => limiter.perMinuteBudget,
    async resolveSymbol(token: string) { return token },
    // Instant, like the real adapters' subscribe (it hands the names to the feed's socket and returns): a timer here
    // would be rounded up to Windows' 15.6 ms tick and make every symbol of an import wait for nothing
    async subscribe(instruments: string[]) { stats.subscribeCalls++; stats.subscribedSymbols += instruments.length },
    async unsubscribe() { stats.unsubscribeCalls++ },
    async disconnect() {},
    on() { return this },
    async getHistoricalBars(_token: string, _interval: string, from: Date, to: Date) {
      await limiter.acquire()
      await sleep(latencyMs)
      const text = candlesText(Math.floor(from.getTime() / DAY_MS), Math.floor(to.getTime() / DAY_MS))
      // What a real answer costs the engine's thread: parse the JSON and make bar objects of it
      const parseStartedAt = performance.now()
      const data = JSON.parse(text)
      const bars = data.candles.map((c: number[]) => ({ ts: c[0] * 1000, open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }))
      perf.record('history.parse_ms', performance.now() - parseStartedAt)
      stats.chunks++
      stats.bars += bars.length
      return bars
    },
  }
}
