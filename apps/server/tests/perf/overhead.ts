/**
 * What the instrumentation costs: the time of one perf.record() call (metrics on and off) and of one performance.now(),
 * and what that comes to per live update. A full harness run compared with metrics off is too noisy to show it
 * (identical runs differ by 2x in CPU per update on a desktop), so the pieces are timed directly.
 *   npx tsx tests/perf/overhead.ts
 */
import { PerfRegistry } from '../../src/system/perf'
const N = 3_000_000
function time(label: string, fn: () => void) {
  const runs: number[] = []
  for (let r = 0; r < 7; r++) { const t = process.hrtime.bigint(); fn(); runs.push(Number(process.hrtime.bigint() - t) / N) }
  runs.sort((a, b) => a - b)
  console.log(label.padEnd(44), `median ${runs[3].toFixed(1)} ns  best ${runs[0].toFixed(1)} ns`)
  return runs[3]
}
const on = new PerfRegistry(true), off = new PerfRegistry(false)
let sink = 0
const base = time('empty loop', () => { for (let i = 0; i < N; i++) sink += i & 3 })
const now = time('performance.now()', () => { for (let i = 0; i < N; i++) sink += performance.now() })
const rec = time('perf.record(name, v)  metrics ON', () => { for (let i = 0; i < N; i++) on.record('tick.feed_to_ipc_ms', 0.05 + (i % 997) * 0.01) })
const recOff = time('perf.record(name, v)  metrics OFF', () => { for (let i = 0; i < N; i++) off.record('tick.feed_to_ipc_ms', 0.05 + (i % 997) * 0.01) })
console.log('\nPer live update the engine makes about 4 record() calls (rx→feed, inter-arrival, age, feed→ipc) and 5 performance.now() calls')
const perUpdateOn = 4 * (rec - base) + 5 * (now - base), perUpdateOff = 4 * (recOff - base) + 5 * (now - base)
console.log(`metrics ON : ~${(perUpdateOn / 1000).toFixed(2)} µs per update`)
console.log(`metrics OFF: ~${(perUpdateOff / 1000).toFixed(2)} µs per update (the timestamps are still taken)`)
console.log(sink > 0 ? '' : '')
