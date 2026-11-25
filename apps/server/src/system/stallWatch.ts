/**
 * Notices the engine being busy for long stretches. Everything it does runs on one thread: while
 * one job holds it, AmiBroker's history requests, the live feed and the app all wait. Once a
 * minute, a stretch of half a second or more is written to the log, so a cause of AmiBroker or
 * the app pausing shows up there instead of being guessed at.
 *
 * Shorter stalls (20-100 ms) are enough to make live ticks arrive in clumps, so they are measured
 * too, two ways:
 *   loop.lag_ms     a worker thread pings the main thread about 70 times a second; the time the
 *                   main thread takes to answer is its lag (accurate to about 0.1 ms).
 *   loop.eld_*_ms   Node's monitorEventLoopDelay, once a minute. On Windows its timer is quantized
 *                   by the 15.6 ms clock tick, so an idle loop reads about 15 ms: only good for
 *                   comparing with itself (the lag probe above is the one to judge by).
 *
 * This is also what ends each performance minute: roll the numbers over and log one summary line.
 */
import { monitorEventLoopDelay } from 'perf_hooks'
import { Worker } from 'worker_threads'
import { perf, formatPerfLine } from './perf'

const REPORT_FROM_MS = 500
const CHECK_EVERY_MS = 60_000
const ELD_RESOLUTION_MS = 10
/** A plugin report older than this is not shown in the minute's line */
const PLUGIN_REPORT_FRESH_MS = 150_000

/** Unix ms with sub-millisecond precision; every thread of the process reads the same clock */
const epochNow = () => performance.timeOrigin + performance.now()

export function describeStall(maxMs: number, p99Ms: number): string | null {
  if (maxMs < REPORT_FROM_MS) return null
  return `[Perf] The engine was busy for ${Math.round(maxMs)} ms at once in the last minute (99% of waits under ${Math.round(p99Ms)} ms); AmiBroker and the app waited meanwhile`
}

// The worker sleeps (Atomics.wait: the clock tick limits how often it wakes, about every 13-16 ms) and
// posts the time. process.timeOrigin is shared by every thread, so both sides read the same clock. While
// the main thread is blocked the pings queue up and are answered one after the other, each with the
// lag it had; that makes the histogram time-weighted: "the lag was under X ms for 99% of the time".
// A plain-JavaScript string, so it also runs from the single packaged .exe (like db/reader.ts).
const LAG_PROBE_SOURCE = String.raw`
const { parentPort } = require('worker_threads')
const sleeper = new Int32Array(new SharedArrayBuffer(4))
;(function ping() {
  Atomics.wait(sleeper, 0, 0, 4)
  parentPort.postMessage(performance.timeOrigin + performance.now())
  setImmediate(ping)
})()
`

let started = false
export function startStallWatch() {
  if (started) return
  started = true
  const h = monitorEventLoopDelay({ resolution: ELD_RESOLUTION_MS })
  h.enable()

  if (perf.enabled) {
    try {
      const worker = new Worker(LAG_PROBE_SOURCE, { eval: true })
      worker.unref()
      worker.on('message', (sentAt: number) => perf.record('loop.lag_ms', Math.max(0, epochNow() - sentAt)))
      worker.on('error', err => console.warn('[Perf] The loop-lag probe stopped:', err?.message || err))
    } catch (err: any) {
      console.warn('[Perf] The loop-lag probe could not start:', err?.message || err)
    }
  }

  setInterval(() => {
    // Histogram values are nanoseconds
    const line = describeStall(h.max / 1e6, h.percentile(99) / 1e6)
    if (line) console.warn(line)
    perf.gauge('loop.eld_p50_ms', h.percentile(50) / 1e6)
    perf.gauge('loop.eld_p99_ms', h.percentile(99) / 1e6)
    perf.gauge('loop.eld_max_ms', h.max / 1e6)
    h.reset()
    const closed = perf.rollMinute()
    if (closed) {
      const plugin = perf.plugin()
      console.log(formatPerfLine(closed, plugin && Date.now() - plugin.at < PLUGIN_REPORT_FRESH_MS ? plugin : null))
    }
  }, CHECK_EVERY_MS).unref()
}
