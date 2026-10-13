/**
 * RateLimiter.ts
 *
 * Sliding-window limiter shared by every caller of one broker endpoint (backfill workers,
 * auto-refresh, startup fetches), so parallel requests together stay under the broker's
 * per-second and per-minute caps. A 429 pauses everyone briefly via pause().
 */
export class RateLimiter {
  private starts: number[] = []   // request start times within the last minute
  private pausedUntil = 0
  private tail: Promise<void> = Promise.resolve()

  constructor(private readonly perSecond: number, private readonly perMinute: number) {}

  /** Resolves when a request may start. Callers are served in arrival order. */
  acquire(): Promise<void> {
    const slot = this.tail.then(() => this.waitForSlot())
    this.tail = slot.catch(() => {})
    return slot
  }

  /** Hold all callers for `ms` (e.g. after the broker answered 429). */
  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms)
  }

  private async waitForSlot() {
    for (;;) {
      const now = Date.now()
      while (this.starts.length && now - this.starts[0] >= 60_000) this.starts.shift()
      let wait = this.pausedUntil - now
      if (this.starts.length >= this.perMinute) wait = Math.max(wait, this.starts[0] + 60_000 - now)
      const secondAgoIdx = this.starts.length - this.perSecond
      if (secondAgoIdx >= 0 && now - this.starts[secondAgoIdx] < 1000) wait = Math.max(wait, this.starts[secondAgoIdx] + 1000 - now)
      if (wait <= 0) { this.starts.push(now); return }
      await new Promise(r => setTimeout(r, wait))
    }
  }
}
