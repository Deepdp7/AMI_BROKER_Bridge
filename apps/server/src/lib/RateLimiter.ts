/**
 * RateLimiter.ts
 *
 * Sliding-window limiter shared by every caller of one broker endpoint (backfill workers,
 * auto-refresh, startup fetches), so parallel requests together stay under the broker's
 * per-second and per-minute caps.
 *
 * Callers wait in one queue per priority (lib/priority.ts): a request for a symbol AmiBroker is
 * showing goes before an auto-refresh, which goes before a bulk download; inside a class it is
 * first come, first served. So that downloads can't be starved by a steady stream of urgent
 * requests (or the other way round), bulk requests may use only 70% of the minute's budget for a
 * minute after an urgent one had to wait.
 *
 * When the broker still refuses a request as over its limit, limited() waits until the
 * oldest request of the last minute has left the broker's window and lowers the per-minute
 * budget; the budget climbs back after a few quiet minutes. Refused requests count against
 * the broker's quota too, so retrying at full speed only gets more of them refused.
 *
 * A broker can also throttle an account far below its normal limit for hours (Fyers after
 * ~1,000 requests in a day: about 5 a minute). A refusal while few requests were sent is that
 * case, so the budget drops towards what was actually sent (at most halving per refusal), and
 * while lowered, requests are spaced evenly instead of sent in bursts that get refused.
 */
import { perf } from '../system/perf'
import { effectivePriority, type Priority } from './priority'

/** Every limiter by name, for the diagnostics page (a name already taken gets a number added) */
const limiters = new Map<string, RateLimiter>()

export function limiterStats(): Array<{ name: string; pending: number; perMinuteBudget: number; pendingByClass: Record<Priority, number> }> {
  return [...limiters.values()].map(l => ({ name: l.name, pending: l.pending, perMinuteBudget: l.perMinuteBudget, pendingByClass: l.pendingByClass }))
}
perf.probe('limiters', limiterStats)

/** Share of the minute's budget bulk requests may use while urgent ones are waiting for their turn */
const BULK_SHARE = 0.7
/** How long after an urgent request had to wait the bulk share applies */
const URGENT_MEMORY_MS = 60_000

/** An urgent request that waited this long for its slot counts as having had to wait */
const URGENT_WAIT_MS = 20

interface Waiter { resolve: () => void; askedAt: number; askedAtMs: number; cls: Priority }

export class RateLimiter {
  private starts: number[] = []   // request start times within the last minute
  private bulkStarts: number[] = []  // the same for bulk requests only
  private pausedUntil = 0
  private budget: number          // current per-minute budget
  private lastLimitedAt = 0
  private urgentWaitedAt = 0      // the last time an interactive or refresh request had to wait for a slot
  private readonly queues: Record<Priority, Waiter[]> = { interactive: [], refresh: [], bulk: [] }
  private wakeUp: ReturnType<typeof setTimeout> | undefined
  private readonly waitMetric: string
  readonly name: string

  /** `name` labels the limiter in the performance numbers (limiter.wait_ms.<name>) and the diagnostics page */
  constructor(
    private readonly perSecond: number,
    private readonly perMinute: number,
    private readonly minPerMinute = Math.max(2, Math.ceil(perMinute / 20)),
    name = 'other',
  ) {
    this.budget = perMinute
    let unique = name
    for (let i = 2; limiters.has(unique); i++) unique = `${name}#${i}`
    this.name = unique
    limiters.set(unique, this)
    this.waitMetric = `limiter.wait_ms.${unique}`
  }

  /** Resolves when a request may start. The priority is that of the calling context (lib/priority.ts). */
  acquire(): Promise<void> {
    const cls = effectivePriority()
    return new Promise<void>(resolve => {
      this.queues[cls].push({ resolve, askedAt: performance.now(), askedAtMs: Date.now(), cls })
      // A timer set for a bulk request that has to wait must not hold back an urgent one
      if (this.wakeUp !== undefined) { clearTimeout(this.wakeUp); this.wakeUp = undefined }
      this.pump()
    })
  }

  /** Callers waiting for a slot right now */
  get pending() { return this.queues.interactive.length + this.queues.refresh.length + this.queues.bulk.length }

  get pendingByClass(): Record<Priority, number> {
    return { interactive: this.queues.interactive.length, refresh: this.queues.refresh.length, bulk: this.queues.bulk.length }
  }

  /** Hold all callers for `ms`. */
  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms)
  }

  /** The broker refused a request as over its limit: back off and send less from now on. */
  limited() {
    const now = Date.now()
    if (now - this.lastLimitedAt > 1000) {
      // Sent in the last minute, minus the refused one: near the budget it's the normal limit
      // (-10%); far below it the account is throttled and the budget follows (at most halving)
      const sent = this.starts.filter(t => now - t < 60_000).length
      const target = Math.min(Math.floor(this.budget * 0.9), Math.max(sent - 1, Math.floor(this.budget / 2)))
      this.budget = Math.max(this.minPerMinute, target)
    }
    this.lastLimitedAt = now
    const oldest = this.starts.find(t => now - t < 60_000) ?? now
    this.pause(Math.max(3000, oldest + 60_000 - now))
  }

  /** Current per-minute budget (for logs) */
  get perMinuteBudget() { return this.budget }

  /** Lets waiting callers start while there is room, and sets one timer for the time the next one can */
  private pump() {
    if (this.wakeUp !== undefined) return   // the timer will call this again
    for (;;) {
      const q = this.queues
      const cls: Priority | null = q.interactive.length ? 'interactive' : q.refresh.length ? 'refresh' : q.bulk.length ? 'bulk' : null
      if (!cls) return
      const now = Date.now()
      let wait = this.slotWaitMs(now)
      if (wait > 0 && cls !== 'bulk') this.urgentWaitedAt = now
      if (wait <= 0 && cls === 'bulk') wait = this.bulkHoldMs(now)
      if (wait > 0) {
        this.wakeUp = setTimeout(() => { this.wakeUp = undefined; this.pump() }, wait)
        return
      }
      const waiter = q[cls].shift()!
      // It got its slot only now, after waiting for it: the minute that follows is shared with bulk requests (bulkHoldMs)
      if (cls !== 'bulk' && now - waiter.askedAtMs >= URGENT_WAIT_MS) this.urgentWaitedAt = now
      this.starts.push(now)
      if (cls === 'bulk') this.bulkStarts.push(now)
      perf.record(this.waitMetric, performance.now() - waiter.askedAt)
      perf.record(`${this.waitMetric}.${cls}`, performance.now() - waiter.askedAt)
      waiter.resolve()
    }
  }

  /** How long until a request may start under the pacing rules; 0 or less: now. */
  private slotWaitMs(now: number): number {
    // The PC clock was set back (e.g. synced after running fast): request times "in the future"
    // would hold every request until the clock caught up with them
    if (this.starts.length && this.starts[this.starts.length - 1] > now) {
      this.starts = this.starts.filter(t => t <= now)
      this.bulkStarts = this.bulkStarts.filter(t => t <= now)
    }
    if (this.pausedUntil > now + 2 * 60_000) this.pausedUntil = now + 60_000
    while (this.starts.length && now - this.starts[0] >= 60_000) this.starts.shift()
    while (this.bulkStarts.length && now - this.bulkStarts[0] >= 60_000) this.bulkStarts.shift()
    // Recover: +25% per 3 quiet minutes, up to the configured cap (5 → 48 in about half an hour)
    if (this.budget < this.perMinute && now - this.lastLimitedAt > 3 * 60_000) {
      this.budget = Math.min(this.perMinute, Math.ceil(this.budget * 1.25) + 1)
      this.lastLimitedAt = now
    }
    let wait = this.pausedUntil - now
    if (this.starts.length >= this.budget) wait = Math.max(wait, this.starts[0] + 60_000 - now)
    // Lowered budget: even spacing (a burst of the minute's requests is what gets refused)
    const last = this.starts[this.starts.length - 1]
    if (this.budget < this.perMinute && last !== undefined) wait = Math.max(wait, last + 60_000 / this.budget - now)
    const secondAgoIdx = this.starts.length - this.perSecond
    if (secondAgoIdx >= 0 && now - this.starts[secondAgoIdx] < 1000) wait = Math.max(wait, this.starts[secondAgoIdx] + 1000 - now)
    return wait
  }

  /**
   * How long a bulk request has to hold back although there is a slot: after an urgent request had to
   * wait, bulk requests use at most BULK_SHARE of the budget, so the rest is there for urgent ones.
   */
  private bulkHoldMs(now: number): number {
    if (now - this.urgentWaitedAt >= URGENT_MEMORY_MS) return 0
    const allowed = Math.max(1, Math.floor(this.budget * BULK_SHARE))
    if (this.bulkStarts.length < allowed) return 0
    return Math.max(1, this.bulkStarts[this.bulkStarts.length - allowed] + 60_000 - now)
  }
}
