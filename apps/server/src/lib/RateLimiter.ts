/**
 * RateLimiter.ts
 *
 * Sliding-window limiter shared by every caller of one broker endpoint (backfill workers,
 * auto-refresh, startup fetches), so parallel requests together stay under the broker's
 * per-second and per-minute caps.
 *
 * When the broker still refuses a request as over its limit, limited() waits until the
 * oldest request of the last minute has left the broker's window and lowers the per-minute
 * budget a little; the budget climbs back after a few quiet minutes. Refused requests count
 * against the broker's quota too, so retrying at full speed only gets more of them refused.
 */
export class RateLimiter {
  private starts: number[] = []   // request start times within the last minute
  private pausedUntil = 0
  private tail: Promise<void> = Promise.resolve()
  private budget: number          // current per-minute budget
  private lastLimitedAt = 0

  constructor(
    private readonly perSecond: number,
    private readonly perMinute: number,
    private readonly minPerMinute = Math.ceil(perMinute / 3),
  ) {
    this.budget = perMinute
  }

  /** Resolves when a request may start. Callers are served in arrival order. */
  acquire(): Promise<void> {
    const slot = this.tail.then(() => this.waitForSlot())
    this.tail = slot.catch(() => {})
    return slot
  }

  /** Hold all callers for `ms`. */
  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms)
  }

  /** The broker refused a request as over its limit: back off and send less from now on. */
  limited() {
    const now = Date.now()
    if (now - this.lastLimitedAt > 1000) this.budget = Math.max(this.minPerMinute, Math.floor(this.budget * 0.9))
    this.lastLimitedAt = now
    const oldest = this.starts.find(t => now - t < 60_000) ?? now
    this.pause(Math.max(3000, oldest + 60_000 - now))
  }

  /** Current per-minute budget (for logs) */
  get perMinuteBudget() { return this.budget }

  private async waitForSlot() {
    for (;;) {
      const now = Date.now()
      while (this.starts.length && now - this.starts[0] >= 60_000) this.starts.shift()
      // Recover slowly: +2 per 5 quiet minutes, up to the configured cap
      if (this.budget < this.perMinute && now - this.lastLimitedAt > 5 * 60_000) {
        this.budget = Math.min(this.perMinute, this.budget + 2)
        this.lastLimitedAt = now
      }
      let wait = this.pausedUntil - now
      if (this.starts.length >= this.budget) wait = Math.max(wait, this.starts[0] + 60_000 - now)
      const secondAgoIdx = this.starts.length - this.perSecond
      if (secondAgoIdx >= 0 && now - this.starts[secondAgoIdx] < 1000) wait = Math.max(wait, this.starts[secondAgoIdx] + 1000 - now)
      if (wait <= 0) { this.starts.push(now); return }
      await new Promise(r => setTimeout(r, wait))
    }
  }
}
