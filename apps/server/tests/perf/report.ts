/**
 * Turns one harness run into text: a markdown table to paste into DATABRIDGE_PERFORMANCE_BASELINE.md.
 * No imports from src, so run.ts can load it before the environment is set up.
 */
export interface HistRow { count: number; p50: number; p95: number; p99: number; max: number; mean: number }

export interface RunResult {
  scenario: string
  startedAt: string
  seconds: number
  params: Record<string, unknown>
  machine: string
  perfEnabled: boolean
  hist: Record<string, HistRow>
  counters: Record<string, number>
  perSec: Record<string, number>
  gauges: Record<string, { last: number; max: number }>
  fakePlugin: null | {
    transit: HistRow
    httpMs: HistRow
    lines: number
    liveLines: number
    quoteLines: number
    syncLines: number
    lateMinuteLines: number
    httpRequests: number
    httpFailures: number
    httpBytesPerTicker: { tickers: number; meanBytes: number; maxBytes: number }
  }
  process: { cpuSeconds: number; cpuPercentOfOneCore: number; rssStartMb: number; rssPeakMb: number }
  integrity: null | { ok: boolean; barsChecked: number; ticks: number; duplicatesSent: number; swapsSent: number; mismatches: string[]; storedNotSeen: number; volumeMismatches: number; clean: boolean }
  extra: Record<string, unknown>
  blockedChildProcesses: string[]
  consoleLines: number
}

const f = (v: number) => (v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3))
const row = (name: string, h: HistRow) => `| ${name} | ${h.count} | ${f(h.p50)} | ${f(h.p95)} | ${f(h.p99)} | ${f(h.max)} |`

/** Metrics worth reading first, in this order; anything else recorded follows, sorted */
const FIRST = [
  'loop.lag_ms', 'tick.rx_to_feed_ms', 'tick.feed_to_ipc_ms', 'tick.age_ms', 'db.live_flush_ms', 'db.history_tx_ms',
  'history.parse_ms', 'backfill.chunk_cpu_ms', 'http.feed_bars_ms', 'health.compute_ms', 'health.scan_ms',
]

export function renderReport(r: RunResult): string {
  const out: string[] = []
  out.push(`### ${r.scenario} (${Object.entries(r.params).map(([k, v]) => `${k} ${v}`).join(', ')}, ${r.seconds} s) at ${r.startedAt}`)
  out.push(`Machine: ${r.machine}${r.perfEnabled ? '' : ' · metrics OFF (DATABRIDGE_PERF=0)'}`)
  out.push('')
  const names = [...FIRST.filter(n => r.hist[n]), ...Object.keys(r.hist).filter(n => !FIRST.includes(n)).sort()]
  if (names.length) {
    out.push('| Metric (ms unless named otherwise) | samples | p50 | p95 | p99 | max |', '|---|---|---|---|---|---|')
    for (const n of names) out.push(row(n, r.hist[n]))
    out.push('')
  }
  const counters = Object.keys(r.counters).sort()
  if (counters.length) out.push(`Counters (total, per second): ${counters.map(k => `${k} ${r.counters[k]} (${r.perSec[k]}/s)`).join(' · ')}`, '')
  const gauges = Object.keys(r.gauges).sort()
  if (gauges.length) out.push(`Levels (last, highest): ${gauges.map(k => `${k} ${f(r.gauges[k].last)}, ${f(r.gauges[k].max)}`).join(' · ')}`, '')
  if (r.fakePlugin) {
    const p = r.fakePlugin
    out.push(`Fake plugin: ${p.lines} lines (${p.liveLines} LIVE_BAR, ${p.quoteLines} QUOTE, ${p.syncLines} SYNC, ${p.lateMinuteLines} late-minute) · transit ms p50 ${f(p.transit.p50)} p99 ${f(p.transit.p99)} max ${f(p.transit.max)}`)
    if (p.httpRequests) out.push(`History requests: ${p.httpRequests} (${p.httpFailures} failed) · answer ms p50 ${f(p.httpMs.p50)} p99 ${f(p.httpMs.p99)} max ${f(p.httpMs.max)} · bytes per ticker: mean ${Math.round(p.httpBytesPerTicker.meanBytes)} max ${p.httpBytesPerTicker.maxBytes} over ${p.httpBytesPerTicker.tickers} tickers`)
    out.push('')
  }
  out.push(`Process: CPU ${r.process.cpuPercentOfOneCore.toFixed(1)}% of one core (${r.process.cpuSeconds.toFixed(2)} s) · RSS ${r.process.rssStartMb} → peak ${r.process.rssPeakMb} MB`)
  for (const [k, v] of Object.entries(r.extra)) out.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  if (r.blockedChildProcesses.length) out.push(`Child processes the engine tried to start (blocked): ${r.blockedChildProcesses.join('; ')}`)
  if (r.integrity) {
    const i = r.integrity
    out.push(`Integrity: ${i.ok ? 'OK' : 'FAILED'} · ${i.barsChecked} bars checked, ${i.ticks} updates sent (${i.duplicatesSent} sent twice, ${i.swapsSent} swapped) · ${i.mismatches.length} state mismatches, ${i.storedNotSeen} stored bars the plugin never saw, ${i.volumeMismatches} volume mismatches${i.clean ? '' : ' (volume is informational when updates are duplicated or swapped)'}`)
    for (const m of i.mismatches.slice(0, 5)) out.push(`  - ${m}`)
  }
  return out.join('\n')
}
