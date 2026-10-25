/**
 * Engine startup: wires the services' events to the app's WebSocket and connects the brokers.
 */
import { getAllSettings, stmts, upsertBarsToHistory } from './db'
import { brokerManager } from './brokers/BrokerManager'
import { activateBroker, openBrokerLogin } from './brokers/BrokerLifecycle'
import { liveFeed } from './market/liveFeed'
import { backfillQueue } from './market/BackfillQueue'
import { autoRefresh } from './market/AutoRefresh'
import { morningBrief } from './ai/MorningBrief'
import { broadcast } from './api/realtime'
import { notifyAmiBrokerHistoryChanged } from './amibroker/ipcServer'
import type { AppSettings } from './types'

/** Forwards service events to the app (WebSocket) and broker ticks into the live feed. Call once. */
export function wireEngineEvents() {
  // Live feed → app
  liveFeed.on('feed_update', (payload) => {
    broadcast('feed_update', payload)
  })

  liveFeed.on('log_entry', (entry) => {
    broadcast('log_entry', entry)
  })

  liveFeed.on('broker_status', (status) => {
    broadcast('broker_status', status)
  })

  brokerManager.on('tick', (tick: any) => {
    liveFeed.processRealTick(tick, tick.brokerId)
  })

  brokerManager.on('broker_status', (status) => {
    broadcast('broker_status', status)
  })

  brokerManager.on('log_entry', (entry) => {
    broadcast('log_entry', entry)
  })

  brokerManager.on('master_sync_progress', (data) => broadcast('master_sync_progress', data))
  brokerManager.on('master_sync_complete', (data) => broadcast('master_sync_complete', data))
  brokerManager.on('master_sync_error', (data) => broadcast('master_sync_error', data))
  brokerManager.on('symbol_resolved', (data: any) => {
    const existing = stmts.getSymbols.all() as any[]
    const symRecord = existing.find(s => (s.rawSymbol || s.raw_symbol) === data.raw && (s.brokerId || s.broker_id) === data.brokerId)
    if (symRecord) {
      const ticker = symRecord.amiBrokerTicker || symRecord.amibroker_ticker
      liveFeed.updateResolvedToken(data.brokerId, ticker, data.resolved)
    }
  })

  // ===== Wire up BackfillQueue events to WebSocket =====
  backfillQueue.on('backfill_progress', (payload) => broadcast('backfill_progress', payload))
  backfillQueue.on('backfill_completed', (payload) => broadcast('backfill_completed', payload))
  backfillQueue.on('backfill_failed', (payload) => broadcast('backfill_failed', payload))
  autoRefresh.on('status', (payload) => broadcast('auto_refresh', payload))
  morningBrief.on('status', (payload) => broadcast('morning_brief', payload))

  // Auto-open the login page when the token dies while streaming (deduped per broker)
  brokerManager.on('auth_required', (brokerId: string) => {
    openBrokerLogin(brokerId, 'Live stream token expired')
    broadcast('broker_status', { id: brokerId, status: 'auth_required' })
  })
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function forEachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => { while (next < items.length) await fn(items[next++]) }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// Helper: fetch just today's bars for a ticker (incremental update)
async function fetchTodayBars(adapter: any, ticker: string) {
  try {
    const symRecord = (stmts.getSymbols.all() as any[]).find((s: any) => (s.amiBrokerTicker || s.amibroker_ticker) === ticker);
    const brokerToken = adapter.resolveSymbol ? await adapter.resolveSymbol(ticker, symRecord?.exchange) : ticker
    
    // Instead of doing timezone shifts manually which can fail depending on system timezone,
    // let's pass exact Date objects and let FyersAdapter handle formatting.
    const to = new Date()
    // Make from midnight IST today
    const from = new Date(to)
    from.setHours(0, 0, 0, 0)
    
    broadcast('log_entry', { level: 'info', component: 'Backfill', message: `Fetching today's bars for ${ticker} (${brokerToken})...` })
    
    const bars = await adapter.getHistoricalBars(brokerToken, '1m', from, to)
    if (bars && bars.length > 0) {
      await upsertBarsToHistory(ticker, bars)
      console.log(`[Init] Incremental update: added ${bars.length} bars for ${ticker} (today)`)
      notifyAmiBrokerHistoryChanged(ticker, Math.floor(bars[0].ts / 1000))
      broadcast('log_entry', { level: 'success', component: 'Backfill', message: `Added ${bars.length} bars for ${ticker} (today)` })
    } else {
      broadcast('log_entry', { level: 'warn', component: 'Backfill', message: `No bars returned for ${ticker} today.` })
    }
  } catch (e: any) {
    if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
      throw e // rethrow for rate limiting
    }
    if (e?.code === -300 || e?.message?.includes('Invalid symbol')) {
      console.error(`[Init] Invalid symbol (expired?): ${ticker}`)
      throw e
    }
    console.error(`[Init] Failed incremental update for ${ticker}:`, e)
    broadcast('log_entry', { level: 'error', component: 'Backfill', message: `Failed backfill for ${ticker}: ${e.message}` })
  }
}

/**
 * Loads the symbol list into the live feed, connects every broker with its saved token
 * (activateBroker: subscribe live ticks + queue the catch-up for the time the app was closed),
 * opens the login page for expired tokens and, during market hours, refreshes today's bars.
 */
export async function startEngine() {
  try {
    const settings = getAllSettings() as unknown as AppSettings
    console.log(`[Init] Log level: ${settings.logLevel}`)
    
    // Re-hydrate liveFeed with existing symbols from DB (skip orphaned)
    const symbols = stmts.getSymbols.all() as any[]
    symbols.forEach(sym => {
      const brokerId = sym.brokerId || sym.broker_id
      const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
      const brokerToken = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
      if (brokerId !== 'orphaned') {
        liveFeed.addSymbolByTicker(ticker, brokerId, sym.exchange, sym.instrumentType, brokerToken)
      }
    })

    // Auto-connect real brokers using saved credentials. A working connection takes over the
    // symbol list, subscribes live ticks and queues the catch-up (missed days) — see
    // BrokerLifecycle. An expired token opens the login page once; the OAuth callback then
    // does the same activation, so the catch-up runs as soon as the user has logged in.
    const brokers = [...(stmts.getBrokers.all() as any[])]
    const needLogin: any[] = []
    for (const b of brokers) {
      if (!stmts.getBrokerById.get(b.id)) continue // merged into an account activated above
      const creds = stmts.getCredentials.get(b.id)
      if (!creds?.accessToken) continue
      console.log(`[Init] Auto-connecting broker ${b.id}...`)
      try {
        await brokerManager.connectBroker(b.id, b.broker_type, {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret || '',
          clientId: b.account_id || undefined,
          accessToken: creds.accessToken
        })
      } catch (err: any) {
        console.error(`[Init] Failed to auto-connect broker ${b.id}:`, err?.message || err)
        needLogin.push(b)
        continue
      }
      await activateBroker(b.id, b.broker_type)
    }
    // Only accounts still needed: one merged into a connected account needs no login
    for (const b of needLogin) {
      if (!stmts.getBrokerById.get(b.id)) continue
      openBrokerLogin(b.id, 'Saved token expired')
      broadcast('broker_status', { id: b.id, status: 'auth_required' })
    }

    // === Startup today-bar fetch ===
    // After gap detection, always fetch today's bars for every symbol.
    // This ensures that if the app was closed during or after market hours,
    // all candles for today are loaded into RAM (the DB backfill queue handles DB storage).
    const todayFetchDelay = 5000  // wait 5s for broker connection to be ready
    setTimeout(async () => {
      const nowIST = new Date(Date.now() + 5.5 * 3600 * 1000)
      const istHHMM = nowIST.getUTCHours() * 100 + nowIST.getUTCMinutes()
      // Only run after market open (9:15 IST) — before that, no today bars exist
      if (istHHMM < 915) return

      const allSyms = stmts.getSymbols.all() as any[]
      const started = Date.now()
      // Parallel; the broker adapter's shared rate limiter keeps requests within its limits
      await forEachLimit(allSyms, 6, async (sym: any) => {
        if ((sym.brokerId || sym.broker_id) === 'orphaned') return
        const brokerId = sym.brokerId || sym.broker_id
        const adapter = brokerManager.getAdapter(brokerId)
        if (!adapter) return
        const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
        try {
          await fetchTodayBars(adapter, ticker)
        } catch (e: any) {
          // 429s already pause the shared limiter; -300 already logged in fetchTodayBars — just skip
          if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
            console.warn(`[Init] Rate limit 429 hit during startup fetch for ${ticker}.`)
          }
        }
      })
      console.log(`[Init] Startup today-bar fetch complete in ${((Date.now() - started) / 1000).toFixed(1)}s.`)
    }, todayFetchDelay)

    // Auto-start with mock data for demonstration (only runs if no real ticks)
    liveFeed.start()
  } catch (e) {
    console.error('[Init] Error starting simulator:', e)
  }
}
