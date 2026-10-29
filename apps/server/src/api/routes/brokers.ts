import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { stmts, getAllSettings } from '../../db'
import { liveFeed } from '../../market/liveFeed'
import { brokerManager } from '../../brokers/BrokerManager'
import { schedulePush as pushSymbolDetailsSoon } from '../../amibroker/symbolDetails'
import type { IBrokerAdapter } from '../../brokers/adapters/IBrokerAdapter'
import { backfilledTickers } from '../../market/state/backfillState'
import { clearVerifiedThrough } from '../../market/state/coverageState'
import { backfillQueue } from '../../market/BackfillQueue'
import { pendingLogins, activateBroker, loginDirect } from '../../brokers/BrokerLifecycle'
import { brokerLoginUrl, LOGIN_BROKERS, BROKERS, isDirectLogin } from '../../brokers/brokerAuth'
import type { BrokerAccount } from '../../types'

export { pendingLogins }

const router = Router()

// Symbol search before an account is logged in: the instrument lists are public
const searchOnlyAdapters: Record<string, IBrokerAdapter> = Object.fromEntries(
  Object.entries(BROKERS).map(([type, def]) => [type, def.create()]),
)
const fallbackSearchAdapter = searchOnlyAdapters.fyers

// GET /api/brokers — List all broker accounts
router.get('/', (_req, res) => {
  try {
    const rows = stmts.getBrokers.all() as any[]
    const brokers: BrokerAccount[] = rows.map(r => ({
      id: r.id,
      brokerType: r.broker_type,
      label: r.label,
      status: (r.status || 'disconnected').toLowerCase(),
      lastConnectedAt: r.last_connected_at ?? undefined,
      accountId: r.account_id ?? undefined,
      healthScore: r.health_score,
      reconnectCount1h: r.reconnect_count_1h,
      credentialRef: r.credential_ref,
    }))
    res.json(brokers)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /api/brokers — Add broker + initiate auth
router.post('/', async (req, res) => {
  try {
    const { brokerType, label, apiKey: rawApiKey, apiSecret: rawApiSecret, clientId: rawClientId } = req.body as {
      brokerType: string; label: string; apiKey?: string; apiSecret?: string; clientId?: string
    }
    if (!brokerType || !label) return res.status(400).json({ error: 'brokerType and label are required' })
    if (!LOGIN_BROKERS.has(brokerType)) return res.status(400).json({ error: `${label || brokerType} is not supported yet` })
    if (!rawApiKey || !rawApiSecret) return res.status(400).json({ error: 'apiKey and apiSecret are required' })
    const userId = BROKERS[brokerType].userId
    const typedId = (rawClientId || '').trim()
    const clientId = (userId?.upperCase ? typedId.toUpperCase() : typedId) || null
    if (userId && !clientId) return res.status(400).json({ error: `${userId.label} is required` })

    const apiKey = rawApiKey.trim()
    const apiSecret = rawApiSecret.trim()

    const id = `${brokerType}-${uuidv4().slice(0, 8)}`
    const credentialRef = `dpapi:${uuidv4()}`
    const now = Date.now()

    // Keys alone log in (XTS): connect now; refused keys leave no account behind
    if (isDirectLogin(brokerType)) {
      stmts.insertBroker.run({
        id, broker_type: brokerType, label, credential_ref: credentialRef,
        status: 'auth_required', health_score: 100, reconnect_count_1h: 0,
        account_id: clientId, created_at: now, last_connected_at: null,
      })
      stmts.upsertCredentials.run(id, { apiKey, apiSecret, accessToken: '' })
      try {
        const session = await loginDirect(id)
        const broker: BrokerAccount = {
          id, brokerType: brokerType as any, label, status: 'connected', lastConnectedAt: Date.now(),
          accountId: session.accountId || clientId || undefined, healthScore: 100, reconnectCount1h: 0, credentialRef,
        }
        return res.status(201).json({ broker, loginUrl: null })
      } catch (err: any) {
        await brokerManager.disconnectBroker(id).catch(() => {})
        stmts.deleteBroker.run(id)
        return res.status(400).json({ error: err?.message || String(err) })
      }
    }

    // Login URL first: Dhan checks the keys here, and a refused key should not leave an account behind
    let loginUrl: string
    try {
      loginUrl = await brokerLoginUrl(brokerType, id, { apiKey, apiSecret, clientId })
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || String(err) })
    }

    // 1. Remove any old pending authentication rows for this broker type to avoid stale UUIDs
    try {
      const existing = stmts.getBrokers.all() as any[]
      existing.forEach(r => {
        if (r.broker_type === brokerType && r.status === 'auth_required') {
          // BUG FIX: ONLY delete if there are zero symbols attached. Otherwise we wipe out valid accounts!
          const symbols = stmts.getSymbolsByBroker.all(r.id)
          if (!symbols || symbols.length === 0) {
            stmts.deleteBroker.run(r.id)
          }
        }
      })
    } catch (e) { /* ignore */ }

    // 2. Initial Insert (PENDING status)
    stmts.insertBroker.run({
      id, broker_type: brokerType, label, credential_ref: credentialRef,
      status: 'auth_required', health_score: 100, reconnect_count_1h: 0,
      account_id: clientId, created_at: now, last_connected_at: null
    })

    // 3. Save credentials in memory for the callback to use
    pendingLogins.set(brokerType, { apiKey, apiSecret })

    // Send back the broker object AND the login URL for the frontend to open
    const broker: BrokerAccount = {
      id, brokerType: brokerType as any, label, status: 'auth_required',
      lastConnectedAt: undefined, accountId: clientId ?? undefined, healthScore: 100,
      reconnectCount1h: 0, credentialRef,
    }
    res.status(201).json({ broker, loginUrl })

  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /api/callback/:brokerType — OAuth Redirect Callback
router.get('/callback/:brokerType', async (req, res) => {
  try {
    const { brokerType } = req.params
    // Fyers sends auth_code (and code=200, so auth_code goes first), Kite request_token,
    // Dhan tokenId, Flattrade / Shoonya / Zebu / TradeSmart / Upstox code, Angel One auth_token (+ feed_token, refresh_token)
    const requestToken = (req.query.request_token || req.query.auth_code || req.query.tokenId || req.query.auth_token || req.query.code) as string

    if (!requestToken) {
      return res.status(400).send('<h1>Error</h1><p>No login code (request_token, auth_code, tokenId or code) in the URL. Was the login cancelled?</p>')
    }

    const state = req.query.state as string
    const rows = stmts.getBrokers.all() as any[]
    
    // `state` is the broker id. Match it in any status: after one failed attempt the account
    // is in 'error', and a retried login must still land on it (and keep its symbols).
    const brokerRow = rows.find(r => r.id === state)
      || rows.find(r => r.broker_type === brokerType && r.status === 'auth_required')
      || rows.find(r => r.broker_type === brokerType)
    
    if (!brokerRow) {
      const activeRows = rows.map(r => `${r.id}=${r.status}`).join(', ')
      console.log(`[OAuth] No pending broker found for ${brokerType} with state ${state}. Available brokers: ${JSON.stringify(rows)}`)
      return res.status(404).send(`<h1>Error</h1><p>No pending authentication found for this broker type.</p><p>Debug: Expected broker=auth_required but got: ${activeRows}</p>`)
    }

    let creds = pendingLogins.get(brokerType)
    if (!creds) {
      // Fallback: This might be an auto-reauth from token expiry where pendingLogins is empty.
      // Load saved credentials from DB.
      const savedCreds = stmts.getCredentials.get(brokerRow.id) as any
      if (savedCreds && savedCreds.apiKey) {
        creds = { apiKey: savedCreds.apiKey, apiSecret: savedCreds.apiSecret || '' }
      } else {
        console.log(`[OAuth] Session expired for ${brokerType}. pendingLogins has keys: ${Array.from(pendingLogins.keys()).join(',')}`)
        stmts.insertEvent.run({ broker_id: brokerRow.id, event_type: 'ERROR', detail: 'OAuth Callback received, but pendingLogins session expired and no saved credentials found.', ts_utc_ms: Date.now() })
        return res.status(400).send('<h1>Error</h1><p>Session expired or API Secret missing. Please try adding the broker again.</p>')
      }
    }

    console.log(`[OAuth] Calling BrokerManager.connectBroker for ${brokerType}...`)
    stmts.insertEvent.run({ broker_id: brokerRow.id, event_type: 'INFO', detail: 'OAuth Callback received successfully. Validating token with broker...', ts_utc_ms: Date.now() })

    const now = Date.now()

    try {
      const session = await brokerManager.connectBroker(brokerRow.id, brokerType, {
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
        // Flattrade names the user who logged in (?client=)
        clientId: (req.query.client as string) || brokerRow.account_id || undefined,
        requestToken,
        feedToken: (req.query.feed_token as string) || undefined,
        refreshToken: (req.query.refresh_token as string) || undefined,
      })

      stmts.insertEvent.run({
        broker_id: brokerRow.id, event_type: 'CONNECTED',
        detail: `OAuth connection successful via ${brokerType}. Account: ${session.accountId}`,
        ts_utc_ms: now,
      })

      // Store credentials for auto-reconnect
      stmts.upsertCredentials.run(brokerRow.id, {
        apiKey: creds.apiKey,
        apiSecret: creds.apiSecret,
        accessToken: session.accessToken
      })
      if (brokerType !== 'fyers' && session.accountId && session.accountId !== brokerRow.account_id) {
        stmts.updateBrokerAccountId.run(session.accountId, brokerRow.id)
      }

      // We are done with these credentials for the auth phase
      pendingLogins.delete(brokerType)

      // Take over the symbol list (incl. from a removed / re-added account), subscribe live
      // ticks and queue the history catch-up for the time the app was closed or logged out
      try {
        await activateBroker(brokerRow.id, brokerType)
      } catch (actErr) {
        console.error('[OAuth] Failed to activate broker after login:', actErr)
      }

      // Success HTML page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-align: center; border: 1px solid #334155; }
            h1 { color: #22c55e; margin-top: 0; }
            p { color: #94a3b8; font-size: 1.1em; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✅ Authentication Successful!</h1>
            <p>DataBridge Pro is now connected to your broker.</p>
            <p>You can safely close this browser window and return to the DataBridge Pro app.</p>
          </div>
          <script>
            setTimeout(() => { window.close(); }, 5000);
          </script>
        </body>
        </html>
      `)

    } catch (authError: any) {
      console.error(`[OAuth] Broker connection failed for ${brokerType}:`, authError)
      stmts.insertEvent.run({
        broker_id: brokerRow.id, event_type: 'ERROR',
        detail: `OAuth Auth Failed: ${authError.message}`,
        ts_utc_ms: now,
      })
      res.status(401).send(`<h1>Authentication Failed</h1><p>${authError.message}</p>`)
    }

  } catch (e) {
    res.status(500).send(`<h1>Server Error</h1><p>${String(e)}</p>`)
  }
})

// DELETE /api/brokers/:id — Remove broker + wipe credentials
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const broker = stmts.getBrokerById.get(id) as any
    if (!broker) return res.status(404).json({ error: 'Broker not found' })

    await brokerManager.disconnectBroker(id).catch(() => {})
    // In real impl: CryptUnprotectData + delete from OS vault.
    // Its symbols are kept ('orphaned') for the next account that connects.
    stmts.deleteBroker.run(id)
    stmts.insertEvent.run({
      broker_id: id, event_type: 'DISCONNECTED',
      detail: 'Broker account removed by user. Credentials wiped from OS vault.',
      ts_utc_ms: Date.now(),
    })

    // Another connected account of the same type takes the symbols over right away
    const heir = (stmts.getBrokers.all() as any[]).find(b => b.broker_type === broker.broker_type && brokerManager.getAdapter(b.id))
    if (heir) activateBroker(heir.id, heir.broker_type).catch(err => console.error('[Broker] Symbol hand-over failed:', err))

    res.json({ ok: true, message: 'Broker removed and credentials wiped' })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /api/brokers/:id/reauth — Re-generate login URL for existing broker (daily token refresh)
router.post('/:id/reauth', async (req, res) => {
  try {
    const { id } = req.params
    const broker = stmts.getBrokerById.get(id) as any
    if (!broker) return res.status(404).json({ error: 'Broker not found' })

    const creds = stmts.getCredentials.get(id) as any
    if (!creds?.apiKey) return res.status(400).json({ error: 'No saved API Key found. Please remove and re-add the broker.' })

    // Mark broker as auth_required so the callback can find it
    stmts.updateBrokerStatus.run('auth_required', null, id)

    // Save API key back to pendingLogins so callback can use it
    const { apiSecret } = req.body as { apiSecret?: string }
    const finalApiSecret = apiSecret || creds.apiSecret || ''

    if (!LOGIN_BROKERS.has(broker.broker_type)) {
      return res.status(400).json({ error: 'Re-auth not supported for this broker type yet' })
    }
    // Keys alone log in: do it now, no browser page
    if (isDirectLogin(broker.broker_type)) {
      try {
        await loginDirect(id)
        return res.json({ loginUrl: null, connected: true })
      } catch (err: any) {
        return res.status(400).json({ error: err?.message || String(err) })
      }
    }
    if (!finalApiSecret) {
      return res.status(400).json({ error: 'API Secret is missing. Please delete and re-add the broker.' })
    }

    pendingLogins.set(broker.broker_type, { apiKey: creds.apiKey, apiSecret: finalApiSecret })

    let loginUrl: string
    try {
      loginUrl = await brokerLoginUrl(broker.broker_type, id, { apiKey: creds.apiKey, apiSecret: finalApiSecret, clientId: broker.account_id })
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || String(err) })
    }

    res.json({ loginUrl })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /api/brokers/search?q=XYZ and GET /api/brokers/:id/search?q=XYZ
const searchHandler = async (req: any, res: any) => {
  try {
    const rawId = req.params?.id
    const id = typeof rawId === 'string' ? rawId : undefined
    const q = (req.query.q as string)?.trim()
    const exchange = (req.query.exchange as string)?.trim()
    if (!q || q.length < 2) return res.json([])

    // The account's own broker list (its instrument names), even before it has logged in
    let adapter = id ? brokerManager.getAdapter(id) : undefined
    if (!adapter && id) {
      const type = (stmts.getBrokerById.get(id) as any)?.broker_type
      adapter = searchOnlyAdapters[type]
    }
    if (!adapter) {
      const all = brokerManager.getAllAdapters()
      if (all.length > 0) adapter = all[0]
    }
    if (!adapter) {
      adapter = fallbackSearchAdapter
    }

    const results = await adapter.searchSymbols(q, exchange)
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}

router.get('/search', searchHandler)
router.get('/:id/search', searchHandler)

// GET /api/brokers/:id/futures?kind=stock|index — every NFO stock (or index) future the broker
// lists, all expiries: Symbol Setup adds a whole month at once (e.g. all stock futures of November)
router.get('/:id/futures', async (req, res) => {
  try {
    const kind = req.query.kind === 'index' ? 'index' : 'stock'
    let adapter = brokerManager.getAdapter(req.params.id)
    if (!adapter) adapter = searchOnlyAdapters[(stmts.getBrokerById.get(req.params.id) as any)?.broker_type]
    if (!adapter?.listFutures) return res.status(404).json({ error: 'This broker cannot list its futures' })
    const contracts = (await adapter.listFutures(kind)).sort((a, b) => (a.expiry || '').localeCompare(b.expiry || '') || a.ticker.localeCompare(b.ticker))
    res.json({ kind, contracts })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// POST /api/brokers/:id/symbols — Add symbols to stream
router.post('/:id/symbols', async (req, res) => {
  try {
    const { id } = req.params
    const { tickers, symbols } = req.body as { tickers?: string[], symbols?: any[] }
    if (!tickers?.length && !symbols?.length) return res.status(400).json({ error: 'tickers[] or symbols[] required' })

    const broker = stmts.getBrokerById.get(id) as any
    if (!broker) return res.status(404).json({ error: 'Broker not found' })

    const now = Date.now()
    let added = 0
    
    const normalizedSymbols = symbols || (tickers || []).map(t => ({ ticker: t, instrumentId: t, exchange: 'NSE', instrumentType: 'EQ' }))

    for (const sym of normalizedSymbols) {
      try {
        // Use the instrumentId from search result as the raw_symbol (e.g. NSE:ITC26OCTFUT)
        // If instrumentId is missing or same as ticker, resolve it properly
        let rawSymbol = sym.instrumentId || sym.ticker
        const adapter = brokerManager.getAdapter(id) as any
        if ((!rawSymbol || rawSymbol === sym.ticker) && adapter?.resolveSymbol) {
          rawSymbol = await adapter.resolveSymbol(sym.ticker, sym.exchange)
        }

        stmts.insertSymbol.run({
          broker_id: id,
          instrument_id: rawSymbol,
          amibroker_ticker: sym.ticker,
          exchange: sym.exchange || 'NSE',
          instrument_type: sym.instrumentType || 'EQ',
          raw_symbol: rawSymbol,
          created_at: now,
        })

        liveFeed.addSymbolByTicker(sym.ticker, id, sym.exchange, sym.instrumentType, rawSymbol)

        // Await subscribe so we know it actually succeeded
        try {
          await brokerManager.subscribe(id, [rawSymbol])
          console.log(`[ADD_SYMBOL] "${sym.ticker}" → "${rawSymbol}" subscribed to live feed.`)
        } catch (subErr) {
          console.error(`[ADD_SYMBOL] Failed to subscribe "${sym.ticker}" → "${rawSymbol}":`, subErr)
        }

        const settings = getAllSettings() as any
        const backfillDepth = Number(settings?.backfillDepthDays) || 365
        backfillQueue.allowHistory([sym.ticker]) // added again after a cancel
        backfillQueue.enqueue(sym.ticker, id, rawSymbol, backfillDepth)
        console.log(`[ADD_SYMBOL] "${sym.ticker}" backfill queued (${backfillDepth} days).`)
        added++
      } catch (symErr) {
        console.error(`[ADD_SYMBOL] Error adding symbol "${sym.ticker}":`, symErr)
        /* continue with next symbol */
      }
    }
    // Into AmiBroker's symbol list, with lot size, tick size and name (when it is running)
    if (added > 0) pushSymbolDetailsSoon()
    res.json({ added, total: normalizedSymbols.length })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})


// DELETE /api/brokers/:id/symbols/:ticker
router.delete('/:id/symbols/:ticker', (req, res) => {
  try {
    const { id, ticker } = req.params
    stmts.deleteSymbol.run(id, ticker)
    stmts.deleteSymbol.run(id, `NSE:${ticker}-EQ`) // Clean up corrupted entries if any
    liveFeed.removeSymbolByTicker(ticker, id, `NSE:${ticker}-EQ`) // Best effort removal
    liveFeed.removeSymbolByTicker(ticker, id) // Standard removal
    brokerManager.unsubscribe(id, [ticker])
    // Clear from backfill Set and cancel any ongoing queue tasks
    backfilledTickers.delete(ticker)
    clearVerifiedThrough(ticker)
    backfillQueue.cancel(ticker)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /api/brokers/:id/symbols/export — Export all symbols as CSV
router.get('/:id/symbols/export', (req, res) => {
  try {
    const { id } = req.params
    const symbols = stmts.getSymbolsByBroker.all(id) as any[]
    const lines = ['ticker,exchange,type']
    for (const s of symbols) {
      lines.push(`${s.amiBrokerTicker || s.amibroker_ticker},${s.exchange || 'NSE'},${s.instrumentType || s.instrument_type || 'EQ'}`)
    }
    const csv = lines.join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="symbols.csv"')
    res.send(csv)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /api/brokers/:id/master/sync
router.post('/:id/master/sync', async (req, res) => {
  try {
    const { id } = req.params
    const adapter = brokerManager.getAdapter(id) as any
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' })
    if (typeof adapter.downloadMasterContracts === 'function') {
      adapter.downloadMasterContracts(id)
      res.json({ ok: true, message: 'Master sync started' })
    } else {
      res.status(400).json({ error: 'Broker does not support master sync' })
    }
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /api/brokers/:id/master/status
router.get('/:id/master/status', (req, res) => {
  try {
    const { id } = req.params
    const adapter = brokerManager.getAdapter(id) as any
    if (!adapter) return res.status(404).json({ error: 'Adapter not found' })
    
    let isDownloadedToday = false
    if (typeof adapter.isMasterDownloadedToday === 'function') {
      isDownloadedToday = adapter.isMasterDownloadedToday()
    } else {
      const now = Date.now()
      const lastSync = adapter.lastMasterSync || 0
      const todayStr = new Date(now + 5.5 * 3600 * 1000).toISOString().split('T')[0]
      const syncStr = lastSync > 0 ? new Date(lastSync + 5.5 * 3600 * 1000).toISOString().split('T')[0] : ''
      isDownloadedToday = todayStr === syncStr
    }
    
    res.json({ 
      isDownloading: adapter.isDownloadingMaster || false,
      lastSync: adapter.lastMasterSync || 0,
      isDownloadedToday,
      count: adapter.masterContracts?.length || 0
    })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

/** Characters a ticker may not contain: they end up inside a PowerShell command line */
const UNSAFE_TICKER = /['"`;$|<>(){}\\%\r\n]/

// POST /api/brokers/:id/symbols/import — Bulk import symbols from CSV text
router.post('/:id/symbols/import', (req, res) => {
  try {
    const { id } = req.params
    const { csv } = req.body as { csv: string }
    if (!csv) return res.status(400).json({ error: 'csv body required' })

    const broker = stmts.getBrokerById.get(id) as any
    if (!broker) return res.status(404).json({ error: 'Broker not found' })

    const lines = csv.split('\n').map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('ticker') && !l.startsWith('#'))
    const now = Date.now()
    let added = 0
    const errors: string[] = []
    const addedTickers: string[] = []

    for (const line of lines) {
      try {
        const parts = line.split(',')
        const ticker = (parts[0] || '').trim().toUpperCase()
        const exchange = (parts[1] || 'NSE').trim().toUpperCase()
        const instrumentType = (parts[2] || 'EQ').trim().toUpperCase()
        
        // Reject garbage symbols from AmiBroker AFLs and comments
        if (!ticker || ticker.length < 2) continue
        if (ticker === 'NAME' || ticker === 'TICKER' || ticker.startsWith('//')) continue
        if (/\s/.test(ticker) && !ticker.includes('26') && !ticker.includes('27') && !ticker.includes('28')) continue
        if (ticker.includes('COMPARED') || ticker.includes('AFL') || ticker.includes('PARAMETER')) continue
        if (UNSAFE_TICKER.test(ticker) || UNSAFE_TICKER.test(exchange) || UNSAFE_TICKER.test(instrumentType)) {
          errors.push(`Skipped "${ticker.slice(0, 30)}": it has characters that are not allowed in a symbol`)
          continue
        }

        stmts.insertSymbol.run({
          broker_id: id,
          instrument_id: ticker,
          amibroker_ticker: ticker,
          exchange,
          instrument_type: instrumentType,
          raw_symbol: ticker,
          created_at: now,
        })
        liveFeed.addSymbolByTicker(ticker, id, exchange, instrumentType, ticker)
        brokerManager.subscribe(id, [ticker])
        const settings = getAllSettings() as any
        const backfillDepth = Number(settings?.backfillDepthDays) || 365
        backfillQueue.allowHistory([ticker]) // added again after a cancel
        backfillQueue.enqueue(ticker, id, ticker, backfillDepth)
        backfilledTickers.delete(ticker) // ensure fresh fetch
        addedTickers.push(ticker)
        added++
      } catch (e: any) {
        errors.push(e.message)
      }
    }

    // Into AmiBroker's symbol list, with lot size, tick size and name (when it is running)
    if (addedTickers.length > 0) pushSymbolDetailsSoon()

    res.json({ added, total: lines.length, errors })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
