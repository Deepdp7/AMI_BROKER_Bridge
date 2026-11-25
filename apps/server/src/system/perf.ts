/**
 * Latency, rate and queue numbers for the live path.
 *
 * "Where does a tick wait?" used to be guessed at: the engine only noticed stalls of half a
 * second or more. Everything the buffering audit needs is recorded here instead, cheaply: how long
 * a tick spends at each stage, how busy the engine's thread is, how deep each queue gets.
 *
 * Histograms use fixed geometric buckets (each 10% wider than the one before), so recording is
 * O(1) with no allocation and a percentile is within 10% of the true value. Two windows are kept:
 * the current minute (rolled once a minute, with one summary line in the log) and everything since
 * the engine started. DATABRIDGE_PERF=0 turns every call into a no-op, to measure the overhead.
 *
 * No imports from the rest of src: the database layer and the reader workers use this too.
 */

const MIN_MS = 0.05
const MAX_MS = 60_000
const RATIO = 1.1
const LOG_RATIO = Math.log(RATIO)
/** The last bucket holds everything above MAX_MS */
const BUCKETS = Math.ceil(Math.log(MAX_MS / MIN_MS) / LOG_RATIO) + 1

/** The bucket a value falls in: bucket i holds (MIN_MS * RATIO^(i-1), MIN_MS * RATIO^i], bucket 0 everything up to MIN_MS */
export function bucketOf(ms: number): number {
  if (ms <= MIN_MS) return 0
  const i = Math.ceil(Math.log(ms / MIN_MS) / LOG_RATIO)
  return i >= BUCKETS ? BUCKETS - 1 : i
}

const round = (v: number) => Math.round(v * 1000) / 1000

export interface HistSnapshot { count: number; p50: number; p95: number; p99: number; max: number; mean: number }

/** Values are milliseconds by convention, but any number from 0.05 to 60,000 fits (rows per commit, bytes per answer) */
export class Histogram {
  private buckets = new Uint32Array(BUCKETS)
  count = 0
  sum = 0
  max = 0

  record(value: number) { this.recordAt(bucketOf(value), value) }

  /** `idx` is bucketOf(value): lets a caller that feeds two windows work it out once */
  recordAt(idx: number, value: number) {
    this.buckets[idx]++
    this.count++
    this.sum += value
    if (value > this.max) this.max = value
  }

  /** The upper edge of the bucket holding the p-th percentile (never above the largest value seen) */
  percentile(p: number): number {
    if (this.count === 0) return 0
    const target = Math.max(1, Math.ceil((p / 100) * this.count))
    let seen = 0
    for (let i = 0; i < BUCKETS; i++) {
      seen += this.buckets[i]
      if (seen >= target) return i === BUCKETS - 1 ? this.max : Math.min(MIN_MS * Math.pow(RATIO, i), this.max)
    }
    return this.max
  }

  snapshot(): HistSnapshot {
    return {
      count: this.count,
      p50: round(this.percentile(50)), p95: round(this.percentile(95)), p99: round(this.percentile(99)),
      max: round(this.max), mean: round(this.count ? this.sum / this.count : 0),
    }
  }
}

export interface GaugeSnapshot { last: number; max: number }

export interface WindowSnapshot {
  startedAt: number
  seconds: number
  hist: Record<string, HistSnapshot>
  counters: Record<string, number>
  /** counters divided by the window's length */
  perSec: Record<string, number>
  gauges: Record<string, GaugeSnapshot>
}

class Window {
  readonly startedAt = Date.now()
  hists = new Map<string, Histogram>()
  counters = new Map<string, number>()
  gauges = new Map<string, GaugeSnapshot>()

  hist(name: string): Histogram {
    let h = this.hists.get(name)
    if (!h) this.hists.set(name, h = new Histogram())
    return h
  }

  snapshot(now = Date.now()): WindowSnapshot {
    const seconds = Math.max(0.001, (now - this.startedAt) / 1000)
    const hist: Record<string, HistSnapshot> = {}
    for (const [k, h] of this.hists) hist[k] = h.snapshot()
    const counters: Record<string, number> = {}
    const perSec: Record<string, number> = {}
    for (const [k, v] of this.counters) { counters[k] = v; perSec[k] = round(v / seconds) }
    const gauges: Record<string, GaugeSnapshot> = {}
    for (const [k, g] of this.gauges) gauges[k] = { last: round(g.last), max: round(g.max) }
    return { startedAt: this.startedAt, seconds: round(seconds), hist, counters, perSec, gauges }
  }
}

export interface PluginPerf { at: number; values: Record<string, number> }

export class PerfRegistry {
  private minute = new Window()
  private total = new Window()
  private lastMinute: WindowSnapshot | null = null
  private pluginPerf: PluginPerf | null = null
  private probeFns = new Map<string, () => unknown>()
  private readonly startedAt = Date.now()

  constructor(readonly enabled = true) {}

  /** One duration (ms) or size */
  record(name: string, value: number) {
    if (!this.enabled || !(value >= 0)) return   // also drops NaN
    const idx = bucketOf(value)
    this.minute.hist(name).recordAt(idx, value)
    this.total.hist(name).recordAt(idx, value)
  }

  /** A running total (events, bytes, rows) */
  count(name: string, n = 1) {
    if (!this.enabled) return
    this.minute.counters.set(name, (this.minute.counters.get(name) ?? 0) + n)
    this.total.counters.set(name, (this.total.counters.get(name) ?? 0) + n)
  }

  /** A level (queue depth, buffer size): the last value and the highest in each window */
  gauge(name: string, value: number) {
    if (!this.enabled || !Number.isFinite(value)) return
    for (const w of [this.minute, this.total]) {
      const g = w.gauges.get(name)
      if (g) { g.last = value; if (value > g.max) g.max = value } else w.gauges.set(name, { last: value, max: value })
    }
  }

  /** Closes the current minute and starts the next; returns the closed one (null when metrics are off) */
  rollMinute(): WindowSnapshot | null {
    if (!this.enabled) return null
    const closed = this.minute.snapshot()
    this.lastMinute = closed
    this.minute = new Window()
    return closed
  }

  /** Forgets everything (the test harness starts its timed window this way) */
  reset() {
    this.minute = new Window()
    this.total = new Window()
    this.lastMinute = null
  }

  snapshot() {
    return {
      enabled: this.enabled,
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      currentMinute: this.minute.snapshot(),
      lastMinute: this.lastMinute,
      sinceStart: this.total.snapshot(),
    }
  }

  /** What the AmiBroker plugin last reported about itself (NOTE|PERF) */
  setPlugin(values: Record<string, number>) { this.pluginPerf = { at: Date.now(), values } }
  plugin(): PluginPerf | null { return this.pluginPerf }

  /** A module that owns a queue or a buffer says how full it is when /api/diagnostics/perf asks */
  probe(name: string, fn: () => unknown) { this.probeFns.set(name, fn) }
  probeResults(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [name, fn] of this.probeFns) {
      try { out[name] = fn() } catch (err: any) { out[name] = { unavailable: String(err?.message || err) } }
    }
    return out
  }
}

export const perf = new PerfRegistry(process.env.DATABRIDGE_PERF !== '0')

/** "NOTE|PERF|transit_p50=0.31|busy=0|…" from the plugin; null when there is nothing numeric in it */
export function parsePluginPerf(line: string): Record<string, number> | null {
  const parts = line.trim().split('|')
  if (parts[0] !== 'NOTE' || parts[1] !== 'PERF') return null
  const values: Record<string, number> = {}
  for (const kv of parts.slice(2)) {
    const eq = kv.indexOf('=')
    if (eq <= 0) continue
    const v = Number(kv.slice(eq + 1))
    if (Number.isFinite(v)) values[kv.slice(0, eq)] = v
  }
  return Object.keys(values).length ? values : null
}

/**
 * The once-a-minute summary line for the log. Only what has data is shown. Kept free of the words
 * the app's Activity page turns into a "something went wrong" card.
 */
export function formatPerfLine(w: WindowSnapshot, plugin: PluginPerf | null = null): string {
  const parts: string[] = []
  const ms = (v: number) => (v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
  const h = (name: string) => w.hist[name]

  const lag = h('loop.lag_ms')
  if (lag) parts.push(`loop lag p99 ${ms(lag.p99)} ms max ${ms(lag.max)} ms`)

  const rx = h('tick.rx_to_feed_ms'), out = h('tick.feed_to_ipc_ms')
  if (rx || out) {
    parts.push(`tick rx→feed p99 ${rx ? ms(rx.p99) : '-'} ms, feed→ipc p99 ${out ? ms(out.p99) : '-'} ms (${w.perSec['ipc.lines'] ?? 0} lines/s)`)
  }
  if (w.counters['ipc.writes']) parts.push(`ipc ${w.perSec['ipc.writes']} writes/s`)

  const hist = h('db.history_tx_ms'), live = h('db.live_flush_ms')
  if (hist || live) parts.push(`db history tx p99 ${hist ? ms(hist.p99) : '-'} ms, live flush p99 ${live ? ms(live.p99) : '-'} ms`)

  let worstReader: { op: string; p99: number } | null = null
  for (const name of Object.keys(w.hist)) {
    if (!name.startsWith('reader.wait_ms.')) continue
    const p99 = w.hist[name].p99
    if (!worstReader || p99 > worstReader.p99) worstReader = { op: name.slice('reader.wait_ms.'.length), p99 }
  }
  if (worstReader) parts.push(`reader wait p99 ${ms(worstReader.p99)} ms (${worstReader.op})`)

  const bars = h('http.feed_bars_ms')
  if (bars) parts.push(`feed/bars p99 ${ms(bars.p99)} ms (${bars.count})`)

  if (plugin) {
    const v = plugin.values
    const bit = (label: string, key: string) => (key in v ? `${label} ${ms(v[key])}` : '')
    const p = [bit('notify p95', 'notify_p95'), bit('transit p99', 'transit_p99'), bit('sendmsg p99', 'sendmsg_p99')].filter(Boolean)
    if (p.length) parts.push(`plugin ${p.join(', ')} ms`)
  }
  return `[Perf] ${parts.length ? parts.join(' | ') : 'no live data in the last minute'}`
}
