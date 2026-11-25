/**
 * Stands in for the AmiBroker plugin on the engine's channel: reads the lines the engine pushes, keeps
 * the final state of every ticker's minute (the last LIVE_BAR for it wins, as in the real plugin),
 * times how long each line took to arrive, and can ask for history over HTTP like the plugin does.
 *
 * It can stop reading for a while (to see what the engine does with a plugin that is not keeping up).
 */
import net from 'net'
import http from 'http'
import { Histogram } from '../../src/system/perf'

export interface PluginBar { open: number; high: number; low: number; close: number; volume: number }

export class FakePlugin {
  /** `${ticker}|${minuteSec}` → the last state received */
  readonly state = new Map<string, PluginBar>()
  transit = new Histogram()
  httpMs = new Histogram()
  lines = 0
  liveLines = 0
  quoteLines = 0
  syncLines = 0
  /** A minute's line that came after a newer minute's for the same ticker (a late update of the minute before) */
  lateMinuteLines = 0
  httpRequests = 0
  httpFailures = 0
  /** Bytes of history answers, per ticker */
  readonly httpBytes = new Map<string, number>()
  readonly syncBy = new Set<string>()
  private socket: net.Socket | null = null
  private pending = ''
  private newestMinute = new Map<string, number>()
  private catchUpQueue: Array<{ ticker: string; since: number; until: number }> = []
  private catchUpBusy = false
  private catchUpTimer: NodeJS.Timeout | null = null
  private agent = new http.Agent({ keepAlive: true, maxSockets: 4 })

  /** `rangeSync` off: behaves like the plugin of before Stage 3 (a SYNC fetch always runs to now) */
  constructor(private ipcPort: number, private httpPort: number, private rangeSync = true) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = net.connect(this.ipcPort, '127.0.0.1')
      this.socket = s
      s.setNoDelay(true)
      s.once('connect', () => resolve())
      s.once('error', reject)
      s.on('data', d => this.onData(d.toString()))
    })
  }

  close() {
    if (this.catchUpTimer) clearInterval(this.catchUpTimer)
    this.socket?.destroy()
    this.agent.destroy()
  }

  /** Forgets the numbers so far (the timed window starts here); the minutes seen are kept for the integrity check */
  resetMeasures() {
    this.transit = new Histogram()
    this.httpMs = new Histogram()
    this.lines = this.liveLines = this.quoteLines = this.syncLines = this.lateMinuteLines = 0
    this.httpRequests = this.httpFailures = 0
    this.httpBytes.clear()
  }

  /** Stops reading from the socket for `ms`: the engine's writes pile up meanwhile */
  pauseFor(ms: number) {
    this.socket?.pause()
    setTimeout(() => this.socket?.resume(), ms).unref()
  }

  private onData(text: string) {
    const rxMs = Date.now()
    this.pending += text
    let nl: number
    while ((nl = this.pending.indexOf('\n')) !== -1) {
      const line = this.pending.slice(0, nl)
      this.pending = this.pending.slice(nl + 1)
      this.lines++
      if (line.startsWith('LIVE_BAR|')) this.onLiveBar(line, rxMs)
      else if (line.startsWith('QUOTE|')) this.quoteLines++
      else if (line.startsWith('SYNC|')) this.onSync(line)
    }
  }

  private onLiveBar(line: string, rxMs: number) {
    // LIVE_BAR|ticker|ts|o|h|l|c|v|oi|sendMs
    const f = line.split('|')
    if (f.length < 8) return
    this.liveLines++
    const ticker = f[1], ts = Number(f[2])
    if (f[9]) this.transit.record(rxMs - Number(f[9]))
    this.state.set(`${ticker}|${ts}`, { open: Number(f[3]), high: Number(f[4]), low: Number(f[5]), close: Number(f[6]), volume: Number(f[7]) })
    const newest = this.newestMinute.get(ticker) ?? 0
    if (ts < newest) this.lateMinuteLines++
    else this.newestMinute.set(ticker, ts)
  }

  /**
   * SYNC|ticker|fromSec[|toSec]: what the engine says changed. The plugin of Stage 3 fetches just that range; the
   * plugin of before (and this one with `rangeSync` off) fetches from there to now.
   */
  private onSync(line: string) {
    this.syncLines++
    const [, ticker, from, to] = line.split('|')
    this.syncBy.add(ticker)
    const fromSec = Number(from) || Math.floor(Date.now() / 1000) - 86400
    const until = this.rangeSync && Number(from) > 0 && Number(to) >= Number(from) ? Number(to) + 60 : 0
    this.catchUpQueue.push({ ticker, since: Math.max(0, fromSec - 60), until })
    this.drainCatchUps()
  }

  /** Asks for the bars of a ticker newer than `since` (unix s) and, if `until` > 0, not newer than that, as the plugin's catch-up does; resolves when answered */
  fetchBars(ticker: string, since: number, until = 0): Promise<number> {
    return new Promise(resolve => {
      const started = performance.now()
      this.httpRequests++
      const url = `/api/feed/bars?ticker=${encodeURIComponent(ticker)}&limit=100000&since=${since}${until > 0 ? `&until=${until}` : ''}`
      const req = http.get({ host: '127.0.0.1', port: this.httpPort, path: url, agent: this.agent, timeout: 4000 }, res => {
        let bytes = 0
        res.on('data', d => { bytes += d.length })
        res.on('end', () => {
          this.httpMs.record(performance.now() - started)
          this.httpBytes.set(ticker, (this.httpBytes.get(ticker) ?? 0) + bytes)
          resolve(bytes)
        })
      })
      req.on('timeout', () => { this.httpFailures++; req.destroy(); resolve(-1) })
      req.on('error', () => { this.httpFailures++; resolve(-1) })
    })
  }

  private async drainCatchUps() {
    if (this.catchUpBusy) return
    this.catchUpBusy = true
    try {
      for (let job = this.catchUpQueue.shift(); job; job = this.catchUpQueue.shift()) await this.fetchBars(job.ticker, job.since, job.until)
    } finally { this.catchUpBusy = false }
  }

  /** A request for the last half hour of one ticker every `everyMs`, round robin over `tickers` */
  startPollingCatchUps(tickers: string[], everyMs: number) {
    let i = 0
    this.catchUpTimer = setInterval(() => {
      if (!tickers.length) return
      void this.fetchBars(tickers[i++ % tickers.length], Math.floor(Date.now() / 1000) - 1800)
    }, everyMs)
    this.catchUpTimer.unref()
  }

  stopPollingCatchUps() {
    if (this.catchUpTimer) clearInterval(this.catchUpTimer)
    this.catchUpTimer = null
  }
}
