/**
 * TCP line protocol to the AmiBroker plugin (127.0.0.1:7891).
 *
 *   engine → plugin  LIVE_BAR|TICKER|ts|o|h|l|c|v|oi  the in-progress 1-minute bar, on every tick
 *                                                     (oi: open interest, 0 when unknown)
 *                    SYNC|TICKER[|fromSec]           stored history changed: re-fetch it over HTTP
 *                    STATUS|level|short|long         the DataBridge light in AmiBroker's status bar
 *                    QUOTE|TICKER|last|open|high|low|prev|vol|oi|bid|ask|tickSec|bidQty|askQty
 *                                                     the day's quote for the Real-time Quote window
 *   plugin → engine  GET_QUOTES TICKER               bars for a symbol (auto-registers unknown ones)
 *                    VIEW|TICKER                     AmiBroker asked for this symbol (live places, liveSlots.ts)
 *                    CMD|REPAIR|T, CMD|TODAY|T, CMD|TODAY_ALL   its right-click menu (pluginStatus.ts)
 *
 * History itself is served over HTTP (/api/feed/bars); this channel only pushes and nudges.
 */
import net = require('net')
import { AMIBROKER_IPC_PORT, HOST } from '../config'
import { getAllSettings, stmts } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { backfillQueue } from '../market/BackfillQueue'
import { backfilledTickers } from '../market/state/backfillState'
import { liveFeed } from '../market/liveFeed'
import { noteViewed } from '../market/liveSlots'
import { setRuntimeProbe } from '../ai/AiAssistant'
import { startSymbolDetailsSync, schedulePush as pushSymbolDetailsSoon } from './symbolDetails'
import { currentPluginStatus, statusLine, runPluginCommand, handlePluginNote } from './pluginStatus'
import { quoteOf, startQuotes } from '../platforms/quotes'

const ipcClients = new Set<net.Socket>()
let lastLiveBarLogAt = 0

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
 * on when known ("SYNC|TICKER|fromSec"). The plugin re-fetches from there and merges the bars
 * in, also into the middle of its chart (a downtime hole), immediately for open charts,
 * otherwise the next time the symbol is viewed. Notices are coalesced per ticker for 1 s, so a
 * multi-chunk download sends one notice with the oldest start instead of one per chunk.
 */
const pendingSyncFrom = new Map<string, number>() // ticker -> oldest fromSec (0 = none given)
let syncFlushTimer: NodeJS.Timeout | null = null
export function notifyAmiBrokerHistoryChanged(ticker: string, fromSec = 0) {
  // Keep the oldest start that was given: a notice without one ("recent bars changed") is
  // already covered by the plugin's default re-read of the last 24 h
  const prev = pendingSyncFrom.get(ticker) ?? 0
  pendingSyncFrom.set(ticker, prev && fromSec ? Math.min(prev, fromSec) : prev || fromSec)
  if (syncFlushTimer) return
  syncFlushTimer = setTimeout(() => {
    syncFlushTimer = null
    const batch = [...pendingSyncFrom]
    pendingSyncFrom.clear()
    const msg = batch.map(([t, from]) => (from > 0 ? `SYNC|${t}|${from}\n` : `SYNC|${t}\n`)).join('')
    ipcClients.forEach(client => {
      try { client.write(msg) } catch {}
    })
  }, 1000)
}

/** Starts the plugin channel: live bars and history notices go out, GET_QUOTES is answered. */
export function startAmiBrokerIpc() {
  setRuntimeProbe(() => ({ amibrokerConnections: ipcClients.size }))
  startQuotes()
  startSymbolDetailsSync(() => ipcClients.size > 0)

  // The DataBridge light in AmiBroker's status bar: sent when it changes (checked every 3 s)
  // and every 30 s anyway
  let lastStatus = ''
  let lastStatusAt = 0
  setInterval(() => {
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
  const pendingLive = new Map<string, string>()
  // Symbols whose quote changed (price, day volume, previous close...): sent after the bars
  const pendingQuotes = new Set<string>()
  let liveFlushQueued = false
  const queueFlush = () => {
    if (liveFlushQueued) return
    liveFlushQueued = true
    setImmediate(flushLive)
  }
  const flushLive = () => {
    liveFlushQueued = false
    if (pendingLive.size === 0 && pendingQuotes.size === 0) return
    let msg = [...pendingLive.values()].join('')
    for (const t of pendingQuotes) msg += quoteMessage(t)
    pendingLive.clear()
    pendingQuotes.clear()
    if (!msg) return
    if (Date.now() - lastLiveBarLogAt > 2000) {
      lastLiveBarLogAt = Date.now()
      console.log(`[IPC_LIVE_BAR] Broadcasted: ${msg.slice(0, msg.indexOf('\n'))}`)
    }
    ipcClients.forEach(client => { try { client.write(msg) } catch {} })
  }

  liveFeed.on('live_bar_updated', (data: { ticker: string, bar: any }) => {
    const { ticker, bar } = data
    if (!bar || !(bar.close > 0) || ipcClients.size === 0) return
    const ts = Math.floor(bar.bucketMs / 1000)
    const key = `${ticker}|${ts}`
    pendingLive.delete(key)   // re-inserted last, so the order stays the order of the updates
    pendingLive.set(key, `LIVE_BAR|${ticker}|${ts}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume}|${bar.oi || 0}\n`)
    queueFlush()
  })

  // The feed's status changes come at most 10 times a second (also price-only updates after the
  // close, and a previous close found later): each becomes a QUOTE line
  liveFeed.on('feed_update', ({ symbols }: { symbols: Array<{ ticker: string }> }) => {
    if (ipcClients.size === 0 || !symbols?.length) return
    for (const s of symbols) pendingQuotes.add(s.ticker)
    queueFlush()
  })

  backfillQueue.on('bars_gap_filled', ({ ticker, fromSec }: { ticker: string, fromSec: number }) => {
    notifyAmiBrokerHistoryChanged(ticker, fromSec)
  })

  // A finished download needs no notice of its own: every chunk that changed bars sent one

  const ipcServer = net.createServer((socket) => {
    ipcClients.add(socket);

    socket.setNoDelay(true) // Disable Nagle's algorithm for sub-millisecond tick latency
    socket.setKeepAlive(true, 15000)
    let socketBuffer = ''

    // Bars stored while AmiBroker was closed: the plugin re-syncs every symbol on each new
    // connection by itself (connection generation in DataClient.cpp)
    // Lot size, tick size and name of every tracked symbol into AmiBroker's Symbol Information
    pushSymbolDetailsSoon(5000)

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
    })

    socket.on('data', async (data) => {
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
            const parts = msg.split(' ')
            const ticker = parts[1]

            // Mark this symbol as STREAMING so the UI shows live status
            if (ticker) liveFeed.setStreaming(ticker)

            let brokerId = ''
            const existing = stmts.getSymbols.all() as any[]
            const symRecord = existing.find(s => {
              const t = s.amiBrokerTicker || s.amibroker_ticker
              if (t !== ticker) return false
              const bId = s.brokerId || s.broker_id
              return brokerManager.getAdapter(bId) !== undefined
            }) || existing.find(s => s.amiBrokerTicker === ticker || s.amibroker_ticker === ticker)
            
            if (!symRecord) {
              // AUTO-REGISTER: Symbol not in DB but AmiBroker is requesting it.
              // This happens when user manually types a symbol directly in AmiBroker.
              // Find the first active broker and auto-add so streaming works.
              const activeBrokers = stmts.getBrokers.all() as any[]
              const activeBroker = activeBrokers.find((b: any) => brokerManager.getAdapter(b.id))
              if (activeBroker && ticker && ticker.trim().length >= 2) {
                const adapter = brokerManager.getAdapter(activeBroker.id)
                if (adapter) {
                  console.log(`[IPC_AUTO_REG] AmiBroker requested unknown symbol "${ticker}" — auto-registering...`)
                  try {
                    const resolvedToken = (adapter as any).resolveSymbol ? await (adapter as any).resolveSymbol(ticker) : ticker
                    const exchMatch = resolvedToken.match(/^([A-Z]+):/)
                    const exchange = exchMatch ? exchMatch[1] : 'NSE'
                    const instrType = /FUT|CE|PE/.test(resolvedToken) ? 'FUT' : 'EQ'

                    stmts.insertSymbol.run({
                      broker_id: activeBroker.id,
                      instrument_id: resolvedToken,
                      amibroker_ticker: ticker,
                      exchange,
                      instrument_type: instrType,
                      raw_symbol: resolvedToken,
                      created_at: Date.now(),
                    })

                    liveFeed.addInstrument({
                      ticker, exchange: exchange as any, instrumentType: instrType as any,
                      basePrice: 0, volatility: 0, avgVolume: 0,
                      brokerId: activeBroker.id, brokerToken: resolvedToken,
                    })

                    await brokerManager.subscribe(activeBroker.id, [resolvedToken])

                    const settings = getAllSettings() as any
                    const backfillDepth = Number(settings?.backfillDepthDays) || 365
                    backfillQueue.enqueue(ticker, activeBroker.id, resolvedToken, backfillDepth)
                    console.log(`[IPC_AUTO_REG] "${ticker}" → "${resolvedToken}" registered, subscribed, backfill queued.`)
                  } catch (autoRegErr) {
                    console.error(`[IPC_AUTO_REG] Failed to auto-register "${ticker}":`, autoRegErr)
                  }
                }
              }
              socket.write('END\n')
              continue
            }

            brokerId = symRecord.brokerId || symRecord.broker_id

            // Fetch real historical data from memory/disk (zero parse CSV)
            let response = await stmts.getBarsCsvByTickerAsync.get(ticker, 100000)
            if (response.length > 0 && !response.endsWith('\n')) {
              response += '\n'
            }
            
            if (!backfilledTickers.has(ticker) && brokerId) {
              const settings = getAllSettings() as any
              const backfillDepth = Number(settings?.backfillDepthDays) || 365
              backfillQueue.enqueue(ticker, brokerId, symRecord.rawSymbol || symRecord.raw_symbol || symRecord.instrumentId || symRecord.instrument_id || ticker, backfillDepth)
            }

            // Append in-progress live bar if available and has a valid price
            const liveBar = liveFeed.getLiveBar(ticker, brokerId)
            if (liveBar && liveBar.close > 0) {
              const ts = Math.floor(liveBar.bucketMs / 1000)
              response += `${ts},${liveBar.open},${liveBar.high},${liveBar.low},${liveBar.close},${liveBar.volume}${liveBar.oi ? `,${liveBar.oi}` : ''}\n`
            }

            if (response.length === 0) {
              socket.write('END\n')
              continue
            }

            socket.write(response + 'END\n')
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
