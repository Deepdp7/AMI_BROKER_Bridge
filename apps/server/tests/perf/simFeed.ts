/**
 * A broker feed that sends prices on a schedule: N symbols, R updates a second each, stamped with
 * whole-second exchange times like the real feeds. The updates go in through brokerManager's 'tick'
 * event, the same door every broker adapter uses, so everything after it is the engine's real path.
 *
 * Optionally some updates are sent twice (--dup) or two updates of one symbol are swapped (--swap),
 * to see what the engine does with them.
 */
import type { EventEmitter } from 'events'

export interface SimFeedOptions {
  brokerId: string
  tickers: string[]
  /** Updates per symbol per second */
  rate: number
  /** Chance (0-1) that an update is sent twice */
  dup: number
  /** Chance (0-1) that an update swaps places with the symbol's next one */
  swap: number
}

interface SimTick {
  instrumentId: string
  brokerId: string
  lastPrice: number
  volume: number
  totalVolume: number
  timestamp: number
  rxAt: number
}

export class SimFeed {
  emitted = 0
  duplicates = 0
  swapped = 0
  /** Day volume of each symbol's first update (the engine takes it as the baseline) and the highest sent */
  readonly firstTotal = new Map<string, number>()
  readonly lastTotal = new Map<string, number>()
  private price: number[]
  private total: number[]
  private held = new Map<number, SimTick>()
  private timer: NodeJS.Timeout | null = null
  private startedAt = 0
  private planned = 0

  constructor(private bus: EventEmitter, private opts: SimFeedOptions) {
    this.price = opts.tickers.map((_, i) => 100 + i * 0.5)
    this.total = opts.tickers.map(() => 1_000_000)
  }

  start() {
    this.startedAt = performance.now()
    this.timer = setInterval(() => this.pump(), 10)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const t of this.held.values()) this.send(t)
    this.held.clear()
  }

  private pump() {
    const n = this.opts.tickers.length
    if (!n) return
    const target = Math.floor(((performance.now() - this.startedAt) / 1000) * n * this.opts.rate)
    while (this.planned < target) this.update(this.planned++ % n)
  }

  private update(i: number) {
    const ticker = this.opts.tickers[i]
    this.price[i] = Math.max(1, Math.round((this.price[i] + (Math.random() - 0.5) * 0.2) * 20) / 20)
    this.total[i] += 1 + Math.floor(Math.random() * 30)
    const tick: SimTick = {
      instrumentId: ticker,
      brokerId: this.opts.brokerId,
      lastPrice: this.price[i],
      volume: 1,
      totalVolume: this.total[i],
      timestamp: Math.floor(Date.now() / 1000) * 1000,
      rxAt: performance.now(),
    }
    const held = this.held.get(i)
    if (held) {
      // This symbol's previous update was kept back: the newer one overtakes it
      this.held.delete(i)
      this.send(tick)
      this.send(held)
      this.swapped++
      return
    }
    if (this.opts.swap > 0 && Math.random() < this.opts.swap) { this.held.set(i, tick); return }
    this.send(tick)
    if (this.opts.dup > 0 && Math.random() < this.opts.dup) { this.send({ ...tick }); this.duplicates++ }
  }

  private send(tick: SimTick) {
    if (!this.firstTotal.has(tick.instrumentId)) this.firstTotal.set(tick.instrumentId, tick.totalVolume)
    if (tick.totalVolume > (this.lastTotal.get(tick.instrumentId) ?? 0)) this.lastTotal.set(tick.instrumentId, tick.totalVolume)
    this.bus.emit('tick', tick)
    this.emitted++
  }
}
