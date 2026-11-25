/**
 * TCP line protocol to the AmiBroker plugin (127.0.0.1:7891).
 *
 *   engine → plugin  LIVE_BAR|TICKER|ts|o|h|l|c|v|oi|sendMs  the in-progress 1-minute bar, on every tick
 *                                                     (oi: open interest, 0 when unknown; sendMs: the
 *                                                     engine's clock in unix ms when the line was written,
 *                                                     for the plugin's transit timing; older plugins stop
 *                                                     reading at oi and ignore it)
 *                    SYNC|TICKER[|fromSec]           stored history changed: re-fetch it over HTTP
 *                    STATUS|level|short|long         the DataBridge light in AmiBroker's status bar
 *                    QUOTE|TICKER|last|open|high|low|prev|vol|oi|bid|ask|tickSec|bidQty|askQty
 *                                                     the day's quote for the Real-time Quote window
 *   plugin → engine  GET_QUOTES TICKER               not served any more (the first plugin versions asked for bars here): answered END
 *                    VIEW|TICKER                     AmiBroker asked for this symbol (live places, liveSlots.ts)
 *                    CMD|REPAIR|T, CMD|TODAY|T, CMD|TODAY_ALL   its right-click menu (pluginStatus.ts)
 *
 * History itself is served over HTTP (/api/feed/bars); this channel only pushes and nudges.
 */
import net = require('net')
import { AMIBROKER_IPC_PORT, HOST } from '../config'
import { backfillQueue } from '../market/BackfillQueue'
import { liveFeed } from '../market/liveFeed'
import { noteViewed } from '../market/liveSlots'
import { setRuntimeProbe } from '../ai/AiAssistant'
import { perf } from '../system/perf'
import { startSymbolDetailsSync, schedulePush as pushSymbolDetailsSoon } from './symbolDetails'
import { currentPluginStatus, statusLine, runPluginCommand, handlePluginNote } from './pluginStatus'
import { quoteOf, startQuotes } from '../platforms/quotes'

const ipcClients = new Set<net.Socket>()
let lastLiveBarLogAt = 0
let warnedGetQuotes = false

/** A client whose socket holds this much unsent data is not written to until it has taken it (see flushLive) */
const CONGESTED_BYTES = 1_048_576
/** A client that has taken nothing for this long, or has this many updates waiting, is disconnected: the plugin reconnects at once and fetches what it missed */
const CONGESTED_GIVE_UP_MS = 60_000
const MAX_PENDING_LIVE = 200_000

/**
 * QUOTE|TICKER|last|open|high|low|prevClose|volume|oi|bid|ask|tickSec|bidQty|askQty for AmiBroker's Real-time
 * Quote window: the day's open/high/low and volume, not the current minute's ('' when the symbol
 * has no price yet). 0 = not known.
 */
export function quoteMessage(ticker: string, nowMs = Date.now()): string {
  const q = quoteOf(ticker, nowMs)
  if (!q || !(q.status.lastPrice > 0)) return ''
  const s = q.status
  const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(+v.toFixed(4)) : '0')
  return `QUOTE|${ticker}|${n(s.lastPrice)}|${n(q.open)}|${n(q.high)}|${n(q.low)}|${n(s.prevClose)}|${n(s.volume)}|${n(s.openInterest)}|${n(s.bid)}|${n(s.ask)}|${Math.floor((s.lastTickUtcMs || 0) / 1000)}|${n(s.bidQty)}|${n(s.askQty)}\n`
}

// New history reaches AmiBroker through SYNC notices only (the plugin merges the bars in).
// There used to be an OLE RefreshAll() after every finished download and on connect too; it
// never actually ran (PowerShell can't call AmiBroker's objects by "$ab.RefreshAll()"), and a
// working one would redraw everything in the middle of running scans.

/**
 * Tell the AmiBroker plugin that new historical bars were stored for `ticker`, from `fromSec`
 * on when known ("SYNC|TICKER|fromSec"), up to `toSec` when that is known too
 * ("SYNC|TICKER|fromSec|toSec"). The plugin re-fetches that range and merges the bars in, also
 * into the middle of its chart (a downtime hole), immediately for open charts, otherwise the
 * next time the symbol is viewed. Notices are coalesced per ticker for 1 s, so a multi-chunk
 * download sends one notice with the oldest start and the newest end instead of one per chunk.
 * (A plugin that doesn't know the end reads "from|to" as "from" and fetches up to now, as before.)
 */
interface PendingSync { from: number; to: number; open: boolean }
const pendingSync = new Map<string, PendingSync>() // from: oldest start (0 = none given); to: newest end; open: a notice without an end was among them
let syncFlushTimer: NodeJS.Timeout | null = null
export function notifyAmiBrokerHistoryChanged(ticker: string, fromSec = 0, toSec = 0) {
  // Keep the oldest start that was given: a notice without one ("recent bars changed") is
  // already covered by the plugin's default re-read of the last 24 h. A notice without an end
  // means "up to now", which no end of another notice can narrow.
  const prev = pendingSync.get(ticker)
  if (!prev) {
    pendingSync.set(ticker, { from: fromSec, to: toSec, open: !(toSec > 0) })
  } else {
    prev.from = prev.from && fromSec ? Math.min(prev.from, fromSec) : prev.from || fromSec
    if (toSec > 0) prev.to = Math.max(prev.to, toSec)
    else prev.open = true
  }
  if (syncFlushTimer) return
  syncFlushTimer = setTimeout(() => {
    syncFlushTimer = null
    const batch = [...pendingSync]
    pendingSync.clear()
    perf.count('sync.notices')
    perf.count('sync.tickers', batch.length)
    const msg = batch.map(([t, s]) => {
      if (!(s.from > 0)) return `SYNC|${t}\n`
      return !s.open && s.to >= s.from ? `SYNC|${t}|${s.from}|${s.to}\n` : `SYNC|${t}|${s.from}\n`
    }).join('')
    ipcClients.forEach(client => {
      try { client.write(msg) } catch {}
    })
  }, 1000)
}

/** Starts the plugin channel: live bars, quotes and history notices go out; the plugin's VIEW, NOTE and CMD lines come in. */
export function startAmiBrokerIpc() {
  setRuntimeProbe(() => ({ amibrokerConnections: ipcClients.size }))
  startQuotes()
  startSymbolDetailsSync(() => ipcClients.size > 0)

  // The DataBridge light in AmiBroker's status bar: sent when it changes (checked every 3 s)
  // and every 30 s anyway
  let lastStatus = ''
  let lastStatusAt = 0
  setInterval(() => {
    for (const [socket, c] of liveClients) if (c.congestedSince) dropIfStuck(socket, c)
    if (ipcClients.size === 0) return
    let line: string
    try { line = statusLine(currentPluginStatus()) } catch { return }
    if (line === lastStatus && Date.now() - lastStatusAt < 30_000) return
    lastStatus = line
    lastStatusAt = Date.now()
    ipcClients.forEach(client => { try { client.write(line) } catch {} })
  }, 3000).unref()

  // Live bars go out in one write per event-loop turn (a broker packet carries many ticks), with
  // the newest state of each symbol's minute. Keyed by minute, not only symbol: the last update
  // of a minute that just ended is always sent, before the first one of the next minute.
  //
  // What waits to go out is kept per client. The plugin keeps only the newest state of each minute, so while
  // a client's socket is backed up (AmiBroker stopped, a debugger on it) nothing is lost by holding the
  // updates back and sending the newest state of each minute once it catches up: memory stays at one
  // entry per symbol and minute instead of every update ever sent.
  // `at` is when the oldest unsent update of this minute was ready (performance.now()): the time from
  // then to the write is how long a live bar waited in the engine (tick.feed_to_ipc_ms)
  interface LiveClient {
    pendingLive: Map<string, { line: string; at: number }>
    /** Symbols whose quote changed (price, day volume, previous close...): sent after the bars */
    pendingQuotes: Set<string>
    /** Since when its socket has held CONGESTED_BYTES or more (Date.now()); 0 = it is being written to */
    congestedSince: number
  }
  const liveClients = new Map<net.Socket, LiveClient>()
  let liveFlushQueued = false

  // A symbol's QUOTE (the day's figures for the Real-time Quote window) goes out at most every QUOTE_EVERY_MS: a busy
  // symbol changes its quote with every tick, and the window shows it a few times a second at best. What waits is
  // sent with the symbol's newest figures when its time comes (one timer, set for the earliest). LIVE_BAR is not limited.
  const QUOTE_EVERY_MS = 250
  const lastQuoteAt = new Map<string, number>()
  let quoteTimer: NodeJS.Timeout | null = null
  let quoteTimerDue = 0
  const armQuoteTimer = (dueMs: number) => {
    if (quoteTimer && quoteTimerDue <= dueMs) return
    if (quoteTimer) clearTimeout(quoteTimer)
    quoteTimerDue = dueMs
    quoteTimer = setTimeout(() => { quoteTimer = null; quoteTimerDue = 0; queueFlush() }, Math.max(1, dueMs - Date.now()))
    quoteTimer.unref()
  }
  // Sent at the end of the current task (one write per feed packet), not in the next turn of the event loop:
  // that turn first runs everything else that is waiting (a history chunk takes 40-60 ms), and live bars waited
  // behind it (measured: p99 from a bar being ready to its write 181 ms during downloads, 0.7 ms now).
  // DATABRIDGE_IPC_FLUSH=immediate brings the old timing back.
  const flushAtEndOfTask = process.env.DATABRIDGE_IPC_FLUSH !== 'immediate'
  const queueFlush = () => {
    if (liveFlushQueued) return
    liveFlushQueued = true
    if (flushAtEndOfTask) queueMicrotask(flushLive)
    else setImmediate(flushLive)
  }
  const dropIfStuck = (socket: net.Socket, c: LiveClient) => {
    const stuckMs = Date.now() - c.congestedSince
    if (stuckMs <= CONGESTED_GIVE_UP_MS && c.pendingLive.size <= MAX_PENDING_LIVE) return
    console.warn(`[IPC] AmiBroker's channel has taken nothing for ${Math.round(stuckMs / 1000)} s (${c.pendingLive.size} bars waiting): closing it. The plugin reconnects and fetches what it missed.`)
    perf.count('ipc.gave_up')
    socket.destroy()
  }
  const flushLive = () => {
    liveFlushQueued = false
    const now = performance.now()
    const sendMs = Date.now()
    const quotes = new Map<string, string>()   // one quote line per symbol, however many clients
    const quoted = new Set<string>()           // symbols whose quote went out in this flush
    let nextQuoteDue = Infinity                // the earliest time a quote that had to wait may go
    for (const [socket, c] of liveClients) {
      if (c.pendingLive.size === 0 && c.pendingQuotes.size === 0) continue
      perf.gauge('ipc.pending_live', c.pendingLive.size)
      if (c.congestedSince) { dropIfStuck(socket, c); continue }   // it gets the newest state of everything when it drains
      let msg = ''
      for (const e of c.pendingLive.values()) {
        msg += `${e.line}|${sendMs}\n`
        perf.record('tick.feed_to_ipc_ms', now - e.at)
      }
      let lines = c.pendingLive.size
      for (const t of c.pendingQuotes) {
        const due = (lastQuoteAt.get(t) ?? 0) + QUOTE_EVERY_MS
        if (due > sendMs) {   // sent a moment ago: it stays queued and goes out, with its newest figures, when due
          nextQuoteDue = Math.min(nextQuoteDue, due)
          continue
        }
        let q = quotes.get(t)
        if (q === undefined) quotes.set(t, q = quoteMessage(t))
        c.pendingQuotes.delete(t)
        if (q) { msg += q; lines++; quoted.add(t) }
      }
      c.pendingLive.clear()
      if (!msg) continue
      // A sample line once a minute: it said "the feed reaches AmiBroker" every 2 s, which was 30 of the 31 lines a minute an idle session wrote
      if (Date.now() - lastLiveBarLogAt > 60_000) {
        lastLiveBarLogAt = Date.now()
        console.log(`[IPC_LIVE_BAR] Broadcasted: ${msg.slice(0, msg.indexOf('\n'))}`)
      }
      try { socket.write(msg) } catch {}
      perf.count('ipc.writes')
      perf.count('ipc.lines', lines)
      perf.count('ipc.bytes', msg.length)
      perf.gauge('ipc.writable_hwm', socket.writableLength)
      if (socket.writableLength >= CONGESTED_BYTES) {
        c.congestedSince = Date.now()
        perf.count('ipc.congestions')
        socket.once('drain', () => { c.congestedSince = 0; queueFlush() })
      }
    }
    for (const t of quoted) lastQuoteAt.set(t, sendMs)
    if (nextQuoteDue !== Infinity) armQuoteTimer(nextQuoteDue)
  }

  liveFeed.on('live_bar_updated', (data: { ticker: string, bar: any, at?: number }) => {
    const { ticker, bar } = data
    if (!bar || !(bar.close > 0) || liveClients.size === 0) return
    const ts = Math.floor(bar.bucketMs / 1000)
    const key = `${ticker}|${ts}`
    const line = `LIVE_BAR|${ticker}|${ts}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume}|${bar.oi || 0}`
    const readyAt = data.at ?? performance.now()
    for (const c of liveClients.values()) {
      const waiting = c.pendingLive.get(key)
      c.pendingLive.delete(key)   // re-inserted last, so the order stays the order of the updates
      c.pendingLive.set(key, { line, at: waiting ? waiting.at : readyAt })
    }
    queueFlush()
  })

  // What /api/diagnostics/perf shows about this channel
  perf.probe('ipc', () => ({
    clients: ipcClients.size,
    writableLength: [...ipcClients].map(c => c.writableLength),
    pendingLive: [...liveClients.values()].map(c => c.pendingLive.size),
    pendingQuotes: [...liveClients.values()].map(c => c.pendingQuotes.size),
    congestedForMs: [...liveClients.values()].map(c => (c.congestedSince ? Date.now() - c.congestedSince : 0)),
    flush: flushAtEndOfTask ? 'microtask' : 'immediate',
  }))

  // The feed's status changes come at most 10 times a second (also price-only updates after the
  // close, and a previous close found later): each becomes a QUOTE line
  liveFeed.on('feed_update', ({ symbols }: { symbols: Array<{ ticker: string }> }) => {
    if (liveClients.size === 0 || !symbols?.length) return
    for (const c of liveClients.values()) {
      for (const sym of symbols) {
        // A quote that was already waiting (held back by its 250 ms, or not sent yet) takes this newer state: one line instead of two
        if (c.pendingQuotes.has(sym.ticker)) perf.count('ipc.quotes_coalesced')
        else c.pendingQuotes.add(sym.ticker)
      }
    }
    queueFlush()
  })

  backfillQueue.on('bars_gap_filled', ({ ticker, fromSec, toSec }: { ticker: string, fromSec: number, toSec?: number }) => {
    notifyAmiBrokerHistoryChanged(ticker, fromSec, toSec)
  })

  // A finished download needs no notice of its own: every chunk that changed bars sent one

  const ipcServer = net.createServer((socket) => {
    ipcClients.add(socket);
    liveClients.set(socket, { pendingLive: new Map(), pendingQuotes: new Set(), congestedSince: 0 })

    socket.setNoDelay(true) // Disable Nagle's algorithm for sub-millisecond tick latency
    socket.setKeepAlive(true, 15000)
    let socketBuffer = ''

    // Bars stored while AmiBroker was closed: the plugin re-syncs every symbol on each new
    // connection by itself (connection generation in DataClient.cpp)
    // Lot size, tick size and name of every tracked symbol into AmiBroker's Symbol Information
    pushSymbolDetailsSoon(5000, 'connect')

    // The status light right away, not only at the next change
    try { socket.write(statusLine(currentPluginStatus())) } catch {}
    // Every symbol's quote, so the Real-time Quote window is filled before the first tick
    try {
      const quotes = liveFeed.getFeedStatuses().map(s => quoteMessage(s.ticker)).join('')
      if (quotes) socket.write(quotes)
    } catch {}

    socket.on('error', (err) => {
      console.error('[IPC Error]', err.message)
    })
    
    socket.on('close', () => {
      // BUG #12 FIX: Remove socket from set to prevent memory leak and write errors on dead sockets
      ipcClients.delete(socket)
      liveClients.delete(socket)
    })

    socket.on('data', (data) => {
      try {
        socketBuffer += data.toString()
        const lines = socketBuffer.split('\n')
        socketBuffer = lines.pop() || ''

        for (const line of lines) {
          const msg = line.trim()
          if (msg.startsWith('NOTE|')) { handlePluginNote(msg); continue }
          // A symbol AmiBroker is showing (charts report it every 15 s): it gets a live place first
          if (msg.startsWith('VIEW|')) { noteViewed(msg.slice(5).trim()); continue }
          if (msg.startsWith('CMD|')) {
            // AmiBroker's right-click menu on the DataBridge light
            runPluginCommand(msg)
              .then(done => console.log(`[AmiBroker] ${msg.split('|').slice(1).join(' ')}: ${done}`))
              .catch(err => console.warn(`[AmiBroker] ${msg} failed: ${err?.message || err}`))
            continue
          }
          if (msg.startsWith('GET_QUOTES')) {
            // The first plugin versions asked for a symbol's bars here (and added unknown symbols). Nothing built from
            // this repository has sent it since: history is read over HTTP (/api/feed/bars). Answering it with bars would
            // put up to 100,000 lines into the live socket, in front of every tick behind them.
            if (!warnedGetQuotes) {
              warnedGetQuotes = true
              console.warn('[IPC] A plugin sent GET_QUOTES (an old DataBridgePro.dll?). It is not served any more: install the DLL that came with this version.')
            }
            socket.write('END\n')
            continue
          }
        }
      } catch (err) {
        console.error('[IPC Data Error]', err)
      }
    })
  })
  ipcServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[IPC] Port ${AMIBROKER_IPC_PORT} is already in use. Assuming another instance is running and exiting gracefully.`)
      process.exit(0)
    } else {
      console.error('[IPC Server Error]', err)
    }
  })
  ipcServer.listen(AMIBROKER_IPC_PORT, HOST, () => {
    console.log(`[IPC] AmiBroker TCP Server listening on ${HOST}:${AMIBROKER_IPC_PORT}`)
  })

  return ipcServer
}
