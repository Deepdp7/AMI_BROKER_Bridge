/**
 * Notices the engine being busy for long stretches. Everything it does runs on one thread: while
 * one job holds it, AmiBroker's history requests, the live feed and the app all wait. Once a
 * minute, a stretch of half a second or more is written to the log, so a cause of AmiBroker or
 * the app pausing shows up there instead of being guessed at.
 */
import { monitorEventLoopDelay } from 'perf_hooks'

const REPORT_FROM_MS = 500
const CHECK_EVERY_MS = 60_000

export function describeStall(maxMs: number, p99Ms: number): string | null {
  if (maxMs < REPORT_FROM_MS) return null
  return `[Perf] The engine was busy for ${Math.round(maxMs)} ms at once in the last minute (99% of waits under ${Math.round(p99Ms)} ms); AmiBroker and the app waited meanwhile`
}

let started = false
export function startStallWatch() {
  if (started) return
  started = true
  const h = monitorEventLoopDelay({ resolution: 20 })
  h.enable()
  setInterval(() => {
    // Histogram values are nanoseconds
    const line = describeStall(h.max / 1e6, h.percentile(99) / 1e6)
    if (line) console.warn(line)
    h.reset()
  }, CHECK_EVERY_MS).unref()
}
