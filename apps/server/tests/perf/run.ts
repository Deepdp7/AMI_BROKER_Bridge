/**
 * The performance harness: starts the real engine (its HTTP API, the AmiBroker channel, the live feed, the
 * backfill queue, the database) in a throwaway data folder, feeds it simulated prices, plays the part of
 * the AmiBroker plugin, and reports how long each stage of a tick's way took. See
 * docs/engineering/DATABRIDGE_PERFORMANCE_BASELINE.md.
 *
 *   npm run perf --prefix apps/server -- --scenario live500 --seconds 180
 *   scenarios: idle live100 live500 live500_backfill live500_health live500_backpressure restart_storm import500 explain
 *   options:   --seconds N  --symbols N  --rate R (updates per symbol per second)  --dup P  --swap P
 *   DATABRIDGE_PERF=0 runs with the metrics off (to measure what they cost)
 *
 * Nothing here touches the real %APPDATA%\DataBridgePro or any running AmiBroker: the data folder is a new
 * temporary one, the ports are 17990 / 17991, and the engine cannot start child processes (the symbol-details
 * push runs PowerShell against AmiBroker through OLE, which would add the simulated symbols to a real one).
 *
 * This file loads nothing from src until the environment is set up: the engine reads it when it loads.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'
import http from 'http'
import { SYNTH, synthTicker, ensureSyntheticDb } from './syntheticDb'
import { renderReport, type RunResult } from './report'

/**
 * 17990 / 17991 beside a real engine. --real-ports uses 7890 / 7891, where the real plugin DLL looks for the engine:
 * only for trying a rebuilt DLL against this harness (the real engine must not be running then).
 */
const REAL_PORTS = process.argv.includes('--real-ports')
const HTTP_PORT = REAL_PORTS ? 7890 : 17990
const IPC_PORT = REAL_PORTS ? 7891 : 17991
const BROKER = 'sim-1'

interface Scenario {
  symbols: number
  rate: number
  seconds: number
  /** Tickers to download a year of history for at the start (topped up so the load lasts the whole run) */
  backfill?: number
  health?: boolean
  /** The fake plugin asks for recent bars of some ticker every 200 ms */
  catchUps?: boolean
  backpressure?: { afterS: number; forS: number }
  synthetic?: boolean
  importCount?: number
  explain?: boolean
  /** After an engine restart the plugin asks for the last 24 hours of every symbol AmiBroker shows, one after the other (3 passes over the synthetic symbols) */
  storm?: boolean
}

const SCENARIOS: Record<string, Scenario> = {
  idle: { symbols: 0, rate: 0, seconds: 30 },
  live100: { symbols: 100, rate: 2, seconds: 120 },
  live500: { symbols: 500, rate: 2, seconds: 120 },
  live500_backfill: { symbols: 500, rate: 2, seconds: 180, backfill: 50, catchUps: true },
  live500_health: { symbols: 500, rate: 2, seconds: 120, health: true, catchUps: true, synthetic: true },
  live500_backpressure: { symbols: 500, rate: 2, seconds: 60, backpressure: { afterS: 15, forS: 10 } },
  restart_storm: { symbols: 500, rate: 2, seconds: 40, storm: true, synthetic: true },
  import500: { symbols: 0, rate: 0, seconds: 0, importCount: 500 },
  explain: { symbols: 0, rate: 0, seconds: 0, explain: true },
}

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined }
const say = (s: string) => process.stdout.write(s + '\n')
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function portFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
  })
}

async function main() {
  const name = arg('scenario') || 'live100'
  const base = SCENARIOS[name]
  if (!base) { say(`Unknown scenario "${name}". Choose from: ${Object.keys(SCENARIOS).join(', ')}`); process.exit(2) }
  const sc: Scenario = {
    ...base,
    seconds: arg('seconds') !== undefined ? Number(arg('seconds')) : base.seconds,
    symbols: arg('symbols') !== undefined ? Number(arg('symbols')) : base.symbols,
    rate: arg('rate') !== undefined ? Number(arg('rate')) : base.rate,
  }
  if (name === 'import500' && arg('symbols') !== undefined) sc.importCount = Number(arg('symbols'))
  const dup = Number(arg('dup') || 0), swap = Number(arg('swap') || 0)
  const perfOff = process.env.DATABRIDGE_PERF === '0'

  for (const port of [HTTP_PORT, IPC_PORT]) {
    if (!(await portFree(port))) { say(`Port ${port} is in use (another harness run?). Stop it and try again.`); process.exit(2) }
  }

  // The synthetic database is built (once) before this process's environment is changed
  const synthSource = sc.synthetic ? ensureSyntheticDb() : null

  // Data folders of earlier runs could not be deleted by those runs (their database was still open)
  for (const old of fs.readdirSync(os.tmpdir())) {
    if (!old.startsWith('dbp-harness-')) continue
    const p = path.join(os.tmpdir(), old)
    try { if (Date.now() - fs.statSync(p).mtimeMs > 120_000) fs.rmSync(p, { recursive: true, force: true }) } catch { /* still in use */ }
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-harness-'))
  process.env.USERPROFILE = tmp
  process.env.HOME = tmp
  process.env.APPDATA = path.join(tmp, 'AppData', 'Roaming')
  process.env.DATABRIDGE_DB_PATH = path.join(tmp, 'databridge.db')
  process.env.DATABRIDGE_NO_PG_IMPORT = '1'
  process.env.DATABRIDGE_SECRET_KEY = require('crypto').randomBytes(32).toString('hex')
  process.env.PORT = String(HTTP_PORT)
  process.env.DATABRIDGE_IPC_PORT = String(IPC_PORT)
  process.chdir(tmp)   // so no .env file next to the source is picked up
  if (synthSource) fs.copyFileSync(synthSource, process.env.DATABRIDGE_DB_PATH)

  // The engine may not start child processes here (see the header)
  const blocked: string[] = []
  const cp: any = require('child_process')
  const realSpawn = cp.spawn
  for (const fn of ['exec', 'execFile', 'spawn', 'fork', 'execSync', 'execFileSync', 'spawnSync']) {
    cp[fn] = (...args: any[]) => {
      blocked.push(`${fn} ${String(args[0]).slice(0, 40)}`)
      const err = new Error('blocked by the performance harness')
      if (fn.endsWith('Sync')) throw err
      const done = args.find(a => typeof a === 'function')
      if (done) setImmediate(() => done(err, '', ''))
      return { on() { return this }, once() { return this }, unref() {}, kill() {}, stdout: null, stderr: null }
    }
  }

  const { perf } = await import('../../src/system/perf')
  const db = await import('../../src/db')
  await db.syncCachesPromise
  const { app } = await import('../../src/app')
  const { attachRealtime } = await import('../../src/api/realtime')
  const { wireEngineEvents } = await import('../../src/startup')
  const { startAmiBrokerIpc } = await import('../../src/amibroker/ipcServer')
  const { startStallWatch } = await import('../../src/system/stallWatch')
  const { liveFeed } = await import('../../src/market/liveFeed')
  const { brokerManager } = await import('../../src/brokers/BrokerManager')
  const { backfillQueue } = await import('../../src/market/BackfillQueue')
  const { computeHealth } = await import('../../src/market/DataHealth')
  const { backfilledTickers } = await import('../../src/market/state/backfillState')
  const { SimFeed } = await import('./simFeed')
  const { FakePlugin } = await import('./fakePlugin')
  const { makeFakeHistoryAdapter } = await import('./fakeHistory')
  const { explainAll } = await import('./explain')

  // Only the harness's own lines and the engine's one-a-minute [Perf] summary reach the screen
  let consoleLines = 0
  const realLog = console.log.bind(console)
  console.log = (...a: any[]) => {
    consoleLines++
    const s = typeof a[0] === 'string' ? a[0] : ''
    if (s.startsWith('[Perf]')) realLog(...a)
  }

  const machine = `${os.cpus()[0]?.model.trim()} · ${os.cpus().length} threads · ${Math.round(os.totalmem() / 2 ** 30)} GB RAM · Windows ${os.release()} · Node ${process.version}`

  if (sc.explain) {
    say(explainAll(db.sqlite as any))
    scheduleCleanup()
    process.exit(0)
  }

  const server = http.createServer(app)
  attachRealtime(server)
  await new Promise<void>(r => server.listen(HTTP_PORT, '127.0.0.1', r))
  wireEngineEvents()
  const ipc = startAmiBrokerIpc()
  await new Promise<void>(r => (ipc.listening ? r() : ipc.once('listening', () => r())))
  liveFeed.start()
  startStallWatch()

  const fake = makeFakeHistoryAdapter()
  const useFake = !!(sc.backfill || sc.importCount)
  if (useFake) (brokerManager as any).activeAdapters.set(BROKER, fake)

  // ---- symbols ----
  const tickers = Array.from({ length: sc.symbols }, (_, i) => `SIM${String(i + 1).padStart(4, '0')}`)
  const symbolRow = (t: string, exchange: string, type: string) => ({
    broker_id: BROKER, instrument_id: t, amibroker_ticker: t, exchange, instrument_type: type, raw_symbol: t, created_at: Date.now(),
  })
  // MCX: its session is not tied to the 09:15-15:30 clock, so bars build whatever the time of day
  for (const t of tickers) {
    liveFeed.addSymbolByTicker(t, BROKER, 'MCX', 'FUT', t)
    db.stmts.insertSymbol.run(symbolRow(t, 'MCX', 'FUT'))
    // A running engine has these symbols' history already: a request for one must not start a download
    // (the real engine queues one for any symbol it has not downloaded yet)
    backfilledTickers.add(t)
  }

  const plugin = new FakePlugin(IPC_PORT, HTTP_PORT, !process.argv.includes('--old-sync'))
  await plugin.connect()
  const feed = new SimFeed(brokerManager, { brokerId: BROKER, tickers, rate: sc.rate, dup, swap })
  const extra: Record<string, unknown> = {}

  // ---- import500 ----
  if (sc.importCount) {
    db.stmts.insertBroker.run({ id: BROKER, broker_type: 'fyers', label: 'Sim', credential_ref: null, status: 'connected', health_score: 100, reconnect_count_1h: 0, account_id: null, created_at: Date.now(), last_connected_at: null })
    const symbols = Array.from({ length: sc.importCount }, (_, i) => { const t = `IMP${String(i + 1).padStart(4, '0')}`; return { ticker: t, instrumentId: t, exchange: 'NSE', instrumentType: 'EQ' } })
    // The downloads each added symbol queues are held back during the import: the numbers are the import's own
    // (a real import starts them at once; run --with-downloads to see both together)
    if (!process.argv.includes('--with-downloads')) backfillQueue.pause()
    await sleep(500)
    const rssStartImport = Math.round(process.memoryUsage().rss / 1048576)
    perf.reset()
    consoleLines = 0
    const cpu0 = process.cpuUsage()
    const t0 = performance.now()
    const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/api/brokers/${BROKER}/symbols`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbols }) })
    const body: any = await res.json()
    const seconds = (performance.now() - t0) / 1000
    const cpu = process.cpuUsage(cpu0)
    await sleep(300)
    extra['import'] = { symbols: symbols.length, answer: body, totalSeconds: +seconds.toFixed(2), subscribeCalls: fake.stats.subscribeCalls, symbolsSubscribed: fake.stats.subscribedSymbols, consoleLines, queuedForHistory: backfillQueue.getQueueLength() }
    const snap = perf.snapshot().sinceStart
    backfillQueue.cancelAll()
    backfillQueue.resume()
    await finish({ cpuSeconds: (cpu.user + cpu.system) / 1e6, wall: seconds, rssStart: rssStartImport, rssPeak: Math.round(process.memoryUsage().rss / 1048576), snap })
    return
  }

  // ---- live scenarios ----
  const rss: number[] = []
  const rssTimer = setInterval(() => rss.push(process.memoryUsage().rss), 1000)
  const feedStartedAtMs = Date.now()
  feed.start()
  await sleep(3000)   // warm-up: the engine builds its first bars, the JIT settles

  perf.reset()
  plugin.resetMeasures()
  consoleLines = 0
  const cpu0 = process.cpuUsage()
  const t0 = performance.now()
  const rssStart = Math.round(process.memoryUsage().rss / 1048576)
  const timers: NodeJS.Timeout[] = []
  let running = true

  if (sc.backfill) {
    let next = 0
    const addBackfill = (n: number) => {
      for (let k = 0; k < n; k++) {
        const t = `BF${String(++next).padStart(4, '0')}`
        db.stmts.insertSymbol.run(symbolRow(t, 'NSE', 'EQ'))
        backfillQueue.enqueue(t, BROKER, t, 365)
      }
    }
    addBackfill(sc.backfill)
    timers.push(setInterval(() => { if (backfillQueue.getQueueLength() < 20) addBackfill(10) }, 2000))
    extra['backfill'] = () => ({ tickersQueued: next, chunksServed: fake.stats.chunks, barsServed: fake.stats.bars })
  }
  if (sc.catchUps) {
    const catchUpTickers = sc.synthetic ? Array.from({ length: SYNTH.tickers }, (_, i) => synthTicker(i)) : tickers
    plugin.startPollingCatchUps(catchUpTickers, 200)
  }
  if (sc.storm) {
    void (async () => {
      const list = Array.from({ length: SYNTH.tickers }, (_, i) => synthTicker(i))
      const startedAt = performance.now()
      let requests = 0
      for (let pass = 0; pass < 3 && running; pass++) {
        for (const t of list) {
          if (!running) break
          // What AmiBroker has: bars up to the last stored one; the plugin asks for the day before that on, as it does for a connection it has not synced yet
          const newest = Number((await db.stmts.getBarsCsvByTickerAsync.get(t, 1)).split(',')[0])
          await plugin.fetchBars(t, newest - 86_400)
          requests++
        }
      }
      extra['restartStorm'] = { requests, seconds: +((performance.now() - startedAt) / 1000).toFixed(2), msPerRequest: +((performance.now() - startedAt) / Math.max(1, requests)).toFixed(2) }
    })()
  }
  if (sc.health) {
    void (async () => {
      let rounds = 0
      while (running) { await computeHealth(true); rounds++; await sleep(1000) }
      extra['healthRounds'] = rounds
    })()
  }
  if (sc.backpressure) {
    timers.push(setTimeout(() => { say(`[perf-harness] the fake plugin stops reading for ${sc.backpressure!.forS} s`); plugin.pauseFor(sc.backpressure!.forS * 1000) }, sc.backpressure.afterS * 1000))
  }

  say(`[perf-harness] ${name}: ${tickers.length} symbols x ${sc.rate}/s for ${sc.seconds} s (data folder ${tmp})`)
  await sleep(sc.seconds * 1000)

  running = false
  for (const t of timers) clearTimeout(t)
  plugin.stopPollingCatchUps()
  feed.stop()
  clearInterval(rssTimer)
  await sleep(sc.backpressure ? 3000 : 800)   // the last updates reach the plugin and the database
  const cpu = process.cpuUsage(cpu0)
  const wall = (performance.now() - t0) / 1000
  const rssPeak = Math.round(Math.max(...rss, process.memoryUsage().rss) / 1048576)
  const pluginReport = perf.plugin()
  if (pluginReport) extra['plugin report (NOTE|PERF)'] = pluginReport.values
  if (typeof extra['backfill'] === 'function') extra['backfill'] = (extra['backfill'] as () => unknown)()

  // The numbers are taken before the integrity check, which reads every ticker back through the database readers
  const snap = perf.snapshot().sinceStart
  const clean = dup === 0 && swap === 0
  const integrity = await checkIntegrity(clean)
  await finish({ cpuSeconds: (cpu.user + cpu.system) / 1e6, wall, rssStart, rssPeak, snap, integrity })

  // ---- helpers (functions so they can see everything above) ----
  async function checkIntegrity(cleanRun: boolean) {
    db.flushPendingBars()
    // Stored bars from before the first minute of the run are history (the plugin is never sent those)
    const firstMinuteSec = Math.floor(feedStartedAtMs / 60_000) * 60
    const px = (v: number) => Math.round(v * 1e4)
    const mismatches: string[] = []
    let barsChecked = 0, storedNotSeen = 0, volumeMismatches = 0
    const byTicker = new Map<string, Array<[number, any]>>()
    for (const [key, bar] of plugin.state) {
      const bar_ = key.lastIndexOf('|')
      const t = key.slice(0, bar_)
      if (!byTicker.has(t)) byTicker.set(t, [])
      byTicker.get(t)!.push([Number(key.slice(bar_ + 1)), bar])
    }
    for (const t of tickers) {
      const live = liveFeed.getLiveBar(t, BROKER)
      const csv = await db.stmts.getBarsCsvByTickerAsync.get(t, 1_000_000)
      const stored = new Map<number, number[]>()
      for (const line of csv.split('\n')) {
        if (!line) continue
        const p = line.split(',')
        stored.set(Number(p[0]), p.slice(1, 6).map(Number))
      }
      const seen = byTicker.get(t) ?? []
      let volumeSum = 0
      for (const [ts, b] of seen) {
        barsChecked++
        volumeSum += b.volume
        if (live && ts * 1000 === live.bucketMs) {
          if (b.open !== live.open || b.high !== live.high || b.low !== live.low || b.close !== live.close || b.volume !== live.volume) {
            mismatches.push(`${t} minute ${ts} (the live one): plugin ${JSON.stringify(b)} engine ${JSON.stringify({ o: live.open, h: live.high, l: live.low, c: live.close, v: live.volume })}`)
          }
        } else if (!live || ts * 1000 < live.bucketMs) {
          const s = stored.get(ts)
          if (!s) mismatches.push(`${t} minute ${ts}: the plugin has it, the database does not`)
          else if (px(b.open) !== px(s[0]) || px(b.high) !== px(s[1]) || px(b.low) !== px(s[2]) || px(b.close) !== px(s[3]) || Math.round(b.volume) !== s[4]) {
            mismatches.push(`${t} minute ${ts}: plugin ${JSON.stringify(b)} database ${JSON.stringify(s)}`)
          }
        } else {
          mismatches.push(`${t} minute ${ts}: newer than the engine's live bar`)
        }
      }
      const seenTs = new Set(seen.map(([ts]) => ts))
      for (const ts of stored.keys()) if (ts >= firstMinuteSec && !seenTs.has(ts)) storedNotSeen++
      // Every update's volume is in some minute: the minutes together add up to what the feed sent
      const expected = (feed.lastTotal.get(t) ?? 0) - (feed.firstTotal.get(t) ?? 0)
      if (seen.length && volumeSum !== expected) volumeMismatches++
    }
    const ok = mismatches.length === 0 && storedNotSeen === 0 && (!cleanRun || volumeMismatches === 0)
    return { ok, barsChecked, ticks: feed.emitted, duplicatesSent: feed.duplicates, swapsSent: feed.swapped, mismatches, storedNotSeen, volumeMismatches, clean: cleanRun }
  }

  async function finish(o: { cpuSeconds: number; wall: number; rssStart: number; rssPeak: number; snap: ReturnType<typeof perf.snapshot>['sinceStart']; integrity?: Awaited<ReturnType<typeof checkIntegrity>> }) {
    const snap = o.snap
    const perTicker = [...plugin.httpBytes.values()]
    const result: RunResult = {
      scenario: name,
      startedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      seconds: Math.round(o.wall),
      params: sc.importCount ? { symbols: sc.importCount } : { symbols: sc.symbols, 'updates/s each': sc.rate, dup, swap },
      machine,
      perfEnabled: !perfOff,
      hist: snap.hist,
      counters: snap.counters,
      perSec: snap.perSec,
      gauges: snap.gauges,
      fakePlugin: {
        transit: plugin.transit.snapshot(), httpMs: plugin.httpMs.snapshot(),
        lines: plugin.lines, liveLines: plugin.liveLines, quoteLines: plugin.quoteLines, syncLines: plugin.syncLines, lateMinuteLines: plugin.lateMinuteLines,
        httpRequests: plugin.httpRequests, httpFailures: plugin.httpFailures,
        httpBytesPerTicker: { tickers: perTicker.length, meanBytes: perTicker.length ? perTicker.reduce((a, b) => a + b, 0) / perTicker.length : 0, maxBytes: perTicker.length ? Math.max(...perTicker) : 0 },
      },
      process: { cpuSeconds: o.cpuSeconds, cpuPercentOfOneCore: o.wall > 0 ? (o.cpuSeconds / o.wall) * 100 : 0, rssStartMb: o.rssStart, rssPeakMb: o.rssPeak },
      integrity: o.integrity ?? null,
      extra,
      blockedChildProcesses: blocked,
      consoleLines,
    }
    const resultsDir = path.join(__dirname, 'results')
    fs.mkdirSync(resultsDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')
    const file = path.join(resultsDir, `${stamp}-${name}${perfOff ? '-perf0' : ''}.json`)
    fs.writeFileSync(file, JSON.stringify(result, null, 2))
    say('\n' + renderReport(result) + `\n\nSaved: ${file}`)
    plugin.close()
    const failed = o.integrity ? !o.integrity.ok : false
    scheduleCleanup()
    process.exit(failed ? 1 : 0)
  }

  // The database is still open while this process runs (Windows will not delete an open file): a small
  // detached helper removes the data folder a moment after it has exited
  function scheduleCleanup() {
    try {
      realSpawn(process.execPath, ['-e', 'setTimeout(() => { try { require("fs").rmSync(process.argv[1], { recursive: true, force: true }) } catch {} }, 2500)', tmp], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } catch { /* the folder stays in the temp directory */ }
  }
}

main().catch(err => { process.stderr.write(`[perf-harness] failed: ${err?.stack || err}\n`); process.exit(1) })
