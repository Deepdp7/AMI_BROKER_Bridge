/**
 * The performance numbers: the histograms, the registry, the once-a-minute line, the plugin's
 * NOTE|PERF report, and that the stages of the live path really record into it.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-perf-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'perf.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

describe('Histogram', () => {
  it('puts a value in a bucket at most 10% wider than it, and the percentile never passes the largest value', async () => {
    const { Histogram, bucketOf } = await import('../src/system/perf')
    expect(bucketOf(0.01)).toBe(0)
    expect(bucketOf(0.05)).toBe(0)
    expect(bucketOf(0.0501)).toBe(1)
    expect(bucketOf(1e9)).toBe(bucketOf(60_000)) // above the range: the last bucket
    const h = new Histogram()
    for (let i = 1; i <= 100; i++) h.record(i) // 1..100 ms
    const s = h.snapshot()
    expect(s.count).toBe(100)
    expect(s.max).toBe(100)
    expect(s.mean).toBeCloseTo(50.5, 3)
    // True percentiles are 50, 95, 99: a bucket's upper edge is within 10% above them
    expect(s.p50).toBeGreaterThanOrEqual(50)
    expect(s.p50).toBeLessThanOrEqual(55)
    expect(s.p95).toBeGreaterThanOrEqual(95)
    expect(s.p95).toBeLessThanOrEqual(100)
    expect(s.p99).toBeLessThanOrEqual(100)
  })

  it('an empty histogram reads zero, and one huge value is kept exactly as the maximum', async () => {
    const { Histogram } = await import('../src/system/perf')
    const h = new Histogram()
    expect(h.snapshot()).toEqual({ count: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 })
    h.record(2)
    h.record(250_000)
    expect(h.snapshot().max).toBe(250_000)
    expect(h.percentile(100)).toBe(250_000)
  })
})

describe('PerfRegistry', () => {
  it('keeps the minute and the total apart; rolling the minute starts the next one empty', async () => {
    const { PerfRegistry } = await import('../src/system/perf')
    const p = new PerfRegistry(true)
    p.record('a_ms', 5)
    p.record('a_ms', 15)
    p.count('lines', 3)
    p.gauge('queue', 7)
    p.gauge('queue', 2)
    const closed = p.rollMinute()!
    expect(closed.hist['a_ms'].count).toBe(2)
    expect(closed.counters.lines).toBe(3)
    expect(closed.gauges.queue).toEqual({ last: 2, max: 7 })
    p.record('a_ms', 1)
    const snap = p.snapshot()
    expect(snap.lastMinute!.hist['a_ms'].count).toBe(2)
    expect(snap.currentMinute.hist['a_ms'].count).toBe(1)
    expect(snap.sinceStart.hist['a_ms'].count).toBe(3)
    expect(snap.sinceStart.counters.lines).toBe(3)
  })

  it('ignores values that are not durations (NaN, negative)', async () => {
    const { PerfRegistry } = await import('../src/system/perf')
    const p = new PerfRegistry(true)
    p.record('x', NaN)
    p.record('x', -3)
    p.gauge('y', Infinity)
    expect(p.snapshot().sinceStart.hist).toEqual({})
    expect(p.snapshot().sinceStart.gauges).toEqual({})
  })

  it('does nothing at all when switched off (DATABRIDGE_PERF=0)', async () => {
    const { PerfRegistry } = await import('../src/system/perf')
    const p = new PerfRegistry(false)
    p.record('a', 5)
    p.count('b')
    p.gauge('c', 1)
    expect(p.rollMinute()).toBeNull()
    const s = p.snapshot()
    expect(s.enabled).toBe(false)
    expect(s.sinceStart.hist).toEqual({})
    expect(s.sinceStart.counters).toEqual({})
    expect(s.sinceStart.gauges).toEqual({})
  })

  it('probes answer on demand and a failing one cannot break the others', async () => {
    const { PerfRegistry } = await import('../src/system/perf')
    const p = new PerfRegistry(true)
    p.probe('queue', () => ({ length: 4 }))
    p.probe('broken', () => { throw new Error('nope') })
    expect(p.probeResults()).toEqual({ queue: { length: 4 }, broken: { unavailable: 'nope' } })
  })
})

describe('the plugin report and the minute line', () => {
  it('reads NOTE|PERF key=value pairs and nothing else', async () => {
    const { parsePluginPerf } = await import('../src/system/perf')
    expect(parsePluginPerf('NOTE|PERF|transit_p50=0.31|transit_p99=1.9|busy=0|lines=1200\r\n'))
      .toEqual({ transit_p50: 0.31, transit_p99: 1.9, busy: 0, lines: 1200 })
    expect(parsePluginPerf('NOTE|PERF|junk|x=abc')).toBeNull()
    expect(parsePluginPerf('NOTE|RELOADS|40|100000')).toBeNull()
    expect(parsePluginPerf('STATUS|0|Live|ok')).toBeNull()
  })

  it('the engine keeps a NOTE|PERF from the plugin and ignores unknown notes as before', async () => {
    const { handlePluginNote } = await import('../src/amibroker/pluginStatus')
    const { perf } = await import('../src/system/perf')
    handlePluginNote('NOTE|PERF|notify_p95=12.5|transit_p99=0.8|busy=2')
    expect(perf.plugin()!.values).toEqual({ notify_p95: 12.5, transit_p99: 0.8, busy: 2 })
    expect(perf.snapshot().sinceStart.gauges['plugin.notify_p95']).toEqual({ last: 12.5, max: 12.5 })
    handlePluginNote('NOTE|SOMETHING_NEW|1|2') // no throw, nothing recorded
  })

  it('one line with only what has data, and the plugin figures when it reported', async () => {
    const { PerfRegistry, formatPerfLine } = await import('../src/system/perf')
    const p = new PerfRegistry(true)
    expect(formatPerfLine(p.rollMinute()!)).toBe('[Perf] no live data in the last minute')
    for (let i = 0; i < 100; i++) { p.record('loop.lag_ms', 0.2); p.record('tick.feed_to_ipc_ms', 1.5) }
    p.record('loop.lag_ms', 42)
    p.record('reader.wait_ms.csv', 3)
    p.record('reader.wait_ms.gaps', 30)
    p.count('ipc.writes', 60)
    const line = formatPerfLine(p.rollMinute()!, { at: Date.now(), values: { notify_p95: 14, transit_p99: 0.5 } })
    expect(line).toMatch(/^\[Perf\] loop lag p99 [\d.]+ ms max 42\.0 ms/)
    expect(line).toContain('feed→ipc p99')
    expect(line).toMatch(/ipc [\d.]+ writes\/s/)
    expect(line).toContain('reader wait p99 30.0 ms (gaps)') // the worst operation
    expect(line).toContain('plugin notify p95 14.0, transit p99 0.50 ms')
    // The app's Activity page turns these words into a "something went wrong" card
    expect(line).not.toMatch(/error|fail|stall|stuck|crash/i)
  })
})

describe('the live path records into it', () => {
  it('a tick: how long it sat before the feed took it, how often the provider sends, how old it is', async () => {
    const { perf } = await import('../src/system/perf')
    const { liveFeed } = await import('../src/market/liveFeed')
    perf.reset()
    liveFeed.addSymbolByTicker('PERFT', 'perf-broker', 'MCX', 'FUT', 'PERFT')
    const now = Date.now()
    const tick = (price: number, total: number) => ({
      instrumentId: 'PERFT', lastPrice: price, volume: 1, totalVolume: total, timestamp: Math.floor(now / 1000) * 1000, rxAt: performance.now() - 2,
    })
    liveFeed.processRealTick(tick(100, 10), 'perf-broker')
    liveFeed.processRealTick(tick(101, 12), 'perf-broker')
    const h = perf.snapshot().sinceStart.hist
    expect(h['tick.rx_to_feed_ms'].count).toBe(2)
    expect(h['tick.rx_to_feed_ms'].p50).toBeGreaterThanOrEqual(1.9) // stamped 2 ms before it was handed over
    expect(h['feed.interarrival_ms.perf-broker'].count).toBe(1) // the second update has a previous one
    expect(h['tick.age_ms'].count).toBe(2)
    // A tick from a feed that does not stamp it (rxAt) is not counted
    liveFeed.processRealTick({ instrumentId: 'PERFT', lastPrice: 102, volume: 1, timestamp: now }, 'perf-broker')
    expect(perf.snapshot().sinceStart.hist['tick.rx_to_feed_ms'].count).toBe(2)
  })

  it('a rate limiter: how long each caller waited for its slot, and how many wait now', async () => {
    const { perf } = await import('../src/system/perf')
    const { RateLimiter, limiterStats } = await import('../src/lib/RateLimiter')
    perf.reset()
    const rl = new RateLimiter(100, 1000, undefined, 'perftest')
    await rl.acquire()
    await rl.acquire()
    expect(perf.snapshot().sinceStart.hist['limiter.wait_ms.perftest'].count).toBe(2)
    const second = new RateLimiter(100, 1000, undefined, 'perftest')
    expect(second.name).toBe('perftest#2')
    expect(limiterStats().map(l => l.name)).toContain('perftest')
    expect(rl.pending).toBe(0)
  })

  it('a reader request: its wait behind others and its run time, from the same clock in both threads', async () => {
    const { perf } = await import('../src/system/perf')
    const db = await import('../src/db')
    perf.reset()
    await db.upsertBarsToHistory('RDRPERF', [{ ts: Date.UTC(2026, 0, 5, 4, 0), open: 1, high: 2, low: 1, close: 2, volume: 5 }])
    await db.stmts.getBarsCsvByTickerAsync.get('RDRPERF', 10)
    const h = perf.snapshot().sinceStart.hist
    expect(h['reader.wait_ms.csv'].count).toBe(1)
    expect(h['reader.exec_ms.csv'].count).toBe(1)
    expect(h['reader.wait_ms.csv'].max).toBeLessThan(5000) // a stamp from the wrong clock would be off by far more
    expect(h['db.history_tx_ms'].count).toBe(1)
    expect(perf.snapshot().sinceStart.counters['db.history_rows']).toBe(1)
  })
})

describe('GET /api/diagnostics/perf', () => {
  it('serves the numbers, the plugin report, the process figures and how full each queue is', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../src/app')
    const { perf } = await import('../src/system/perf')
    perf.record('probe.test_ms', 3)
    const res = await request(app).get('/api/diagnostics/perf')
    expect(res.status).toBe(200)
    expect(res.body.enabled).toBe(true)
    expect(res.body.sinceStart.hist['probe.test_ms'].count).toBe(1)
    expect(res.body.process.rssMb).toBeGreaterThan(0)
    // The database and the rate limiters report their levels on request
    expect(res.body.queues.db).toHaveProperty('pendingLiveBars')
    expect(Array.isArray(res.body.queues.limiters)).toBe(true)
    expect(res.body.queues.backfill).toHaveProperty('queued')
  })
})
