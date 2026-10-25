/**
 * TCP line protocol to the AmiBroker plugin (127.0.0.1:7891).
 *
 *   engine → plugin  LIVE_BAR|TICKER|ts|o|h|l|c|v   the in-progress 1-minute bar, on every tick
 *                    SYNC|TICKER[|fromSec]           stored history changed: re-fetch it over HTTP
 *   plugin → engine  GET_QUOTES TICKER               bars for a symbol (auto-registers unknown ones)
 *
 * History itself is served over HTTP (/api/feed/bars); this channel only pushes and nudges.
 */
import net = require('net')
import { exec } from 'child_process'
import { AMIBROKER_IPC_PORT, HOST } from '../config'
import { getAllSettings, stmts } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { backfillQueue } from '../market/BackfillQueue'
import { backfilledTickers } from '../market/state/backfillState'
import { liveFeed } from '../market/liveFeed'
import { setRuntimeProbe } from '../ai/AiAssistant'

const ipcClients = new Set<net.Socket>()
let lastLiveBarLogAt = 0
// Track last time we fired a connect-refresh so we don't spam it
let lastABConnectRefreshAt = 0

// After gap-fill saves bars, trigger a debounced AmiBroker RefreshAll().
// This forces AmiBroker to pull the historical data correctly via the HTTP plugin 
// rather than pushing them as LIVE_BARs (which causes chart gaps).
let abRefreshTimeout: NodeJS.Timeout | null = null;

/** Asks a running AmiBroker to re-read every chart (COM). Only called while the plugin is connected:
 *  COM activation would otherwise launch a hidden AmiBroker. */
function refreshAmiBroker() {
  const psScript = 'try { $ab = New-Object -ComObject Broker.Application; $ab.RefreshAll() } catch { }'
  exec(`powershell -Command "${psScript}"`, () => {})
}

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

  liveFeed.on('live_bar_updated', (data: { ticker: string, bar: any }) => {
    const { ticker, bar } = data;
    if (!bar || bar.close === 0) return;

    const ts = Math.floor(bar.bucketMs / 1000);
    const msg = `LIVE_BAR|${ticker}|${ts}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume}\n`;
    
    if (Date.now() - lastLiveBarLogAt > 2000) {
      lastLiveBarLogAt = Date.now();
      console.log(`[IPC_LIVE_BAR] Broadcasted: ${msg.trim()}`);
    }

    ipcClients.forEach(client => {
      try {
        client.write(msg);
      } catch (e) {}
    });
  });

  backfillQueue.on('bars_gap_filled', ({ ticker, fromSec }: { ticker: string, fromSec: number }) => {
    notifyAmiBrokerHistoryChanged(ticker, fromSec)
  })

  backfillQueue.on('backfill_completed', ({ ticker }: { ticker: string }) => {
    notifyAmiBrokerHistoryChanged(ticker)
    // Only refresh via COM when AmiBroker is running with our plugin connected —
    // COM activation would otherwise LAUNCH a hidden AmiBroker instance.
    if (ipcClients.size === 0) return
    console.log(`[IPC_GAP_PUSH] Backfill completed for ${ticker}. Scheduling AmiBroker refresh...`);

    if (abRefreshTimeout) clearTimeout(abRefreshTimeout);
    abRefreshTimeout = setTimeout(() => {
      if (ipcClients.size === 0) return
      console.log('[IPC_GAP_PUSH] Executing debounced AmiBroker RefreshAll()...');
      refreshAmiBroker()
    }, 3000); // 3-second debounce
  })

  const ipcServer = net.createServer((socket) => {
    ipcClients.add(socket);

    socket.setNoDelay(true) // Disable Nagle's algorithm for sub-millisecond tick latency
    socket.setKeepAlive(true, 15000)
    let socketBuffer = ''

    // When AmiBroker (re)connects, trigger a RefreshAll() after a short delay.
    // This ensures AmiBroker pulls any bars that were backfilled while it was closed.
    const nowMs = Date.now()
    if (nowMs - lastABConnectRefreshAt > 30_000) { // at most once every 30 seconds
      lastABConnectRefreshAt = nowMs
      console.log('[IPC_CONNECT] AmiBroker connected — scheduling RefreshAll() in 5 seconds to sync backfilled data...')
      setTimeout(() => {
        if (ipcClients.size === 0) return // AmiBroker closed again; don't COM-launch it
        console.log('[IPC_CONNECT] Executing RefreshAll() for AmiBroker reconnect...')
        refreshAmiBroker()
      }, 5000)
    }

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
              response += `${ts},${liveBar.open},${liveBar.high},${liveBar.low},${liveBar.close},${liveBar.volume}\n`
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
