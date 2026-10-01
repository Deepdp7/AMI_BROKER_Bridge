import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { stmts } from '../db'
import { feedSimulator } from '../services/feedSimulator'
import { brokerManager } from '../services/BrokerManager'
import { FyersAdapter } from '../services/adapters/FyersAdapter'
import { backfilledTickers } from '../shared/backfillState'
import { backfillQueue } from '../services/BackfillQueue'
import type { BrokerAccount } from '../types'

const router = Router()
const fallbackSearchAdapter = new FyersAdapter()

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

// In-memory store for credentials pending OAuth callback
export const pendingLogins = new Map<string, { apiKey: string; apiSecret: string }>()

// POST /api/brokers — Add broker + initiate auth
router.post('/', async (req, res) => {
  try {
    const { brokerType, label, apiKey: rawApiKey, apiSecret: rawApiSecret, redirectUrl } = req.body as {
      brokerType: string; label: string; apiKey?: string; apiSecret?: string; redirectUrl?: string
    }
    if (!brokerType || !label) return res.status(400).json({ error: 'brokerType and label are required' })
    if (!rawApiKey || !rawApiSecret) return res.status(400).json({ error: 'apiKey and apiSecret are required' })

    const apiKey = rawApiKey.trim()
    const apiSecret = rawApiSecret.trim()

    const id = `${brokerType}-${uuidv4().slice(0, 8)}`
    const credentialRef = `dpapi:${uuidv4()}` 
    const now = Date.now()

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
      account_id: null, created_at: now, last_connected_at: null
    })

    // 2. Save credentials in memory for the callback to use
    pendingLogins.set(brokerType, { apiKey, apiSecret })

    // 3. Generate the Login URL
    let loginUrl = ''
    if (brokerType === 'zerodha_kite') {
      loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`
    } else if (brokerType === 'fyers') {
      const rUrl = redirectUrl || `http://127.0.0.1:7890/api/callback/fyers`
      loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${apiKey}&redirect_uri=${encodeURIComponent(rUrl)}&response_type=code&state=${id}`
    } else {
      // Fallback or other brokers
      loginUrl = `https://example.com/login?api_key=${apiKey}`
    }
    
    // Send back the broker object AND the login URL for the frontend to open
    const broker: BrokerAccount = {
      id, brokerType: brokerType as any, label, status: 'auth_required',
      lastConnectedAt: undefined, accountId: undefined, healthScore: 100,
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
    // Fyers uses auth_code, Zerodha uses request_token
    const requestToken = req.query.request_token as string || req.query.auth_code as string
    
    if (!requestToken) {
      return res.status(400).send('<h1>Error</h1><p>No request_token or auth_code provided in the URL.</p>')
    }

    const state = req.query.state as string
    const rows = stmts.getBrokers.all() as any[]
    
    let brokerRow = rows.find(r => r.id === state && r.status === 'auth_required')
    if (!brokerRow) {
      brokerRow = rows.find(r => r.broker_type === brokerType && r.status === 'auth_required')
    }
    
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

    const { brokerManager } = require('../services/BrokerManager')
    const now = Date.now()

    try {
      const session = await brokerManager.connectBroker(brokerRow.id, brokerType, {
        apiKey: creds.apiKey, 
        apiSecret: creds.apiSecret, 
        requestToken
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

      // Resubscribe to all configured symbols for this broker
      const syms = stmts.getSymbolsByBroker.all(brokerRow.id) as any[]
      if (syms.length > 0) {
        const brokerSyms = syms.map((s: any) => s.rawSymbol || s.raw_symbol || s.instrumentId || s.instrument_id)
        console.log(`[OAuth] Resubscribing ${brokerSyms.length} symbols for ${brokerType}...`)
        brokerManager.subscribe(brokerRow.id, brokerSyms).catch((e: any) => {
          console.error(`[OAuth] Error resubscribing symbols:`, e)
        })
      }

      // Adopt any orphaned symbols from a previously deleted broker of the same type
      // This restores the symbol list when user deletes and re-adds the broker
      const adoptedCount = stmts.adoptOrphanedSymbols.run(brokerRow.id)
      if (adoptedCount > 0) {
        console.log(`[OAuth] Restored ${adoptedCount} orphaned symbols to new broker ${brokerRow.id}`)
        // Fetch the newly adopted symbols from DB and subscribe
        const adoptedSymbols = stmts.getSymbolsByBroker.all(brokerRow.id) as any[]
        const rawSymbols = adoptedSymbols.map(s => s.rawSymbol).filter(Boolean)
        
        if (rawSymbols.length > 0) {
          console.log(`[OAuth] Re-subscribing to ${rawSymbols.length} adopted symbols for ${brokerRow.id}`)
          try {
            await brokerManager.subscribe(brokerRow.id, rawSymbols)
            const { feedSimulator } = require('../server') // Ensure we get the active simulator
            for (const s of adoptedSymbols) {
              const bToken = s.instrumentId || s.instrument_id || s.rawSymbol || s.raw_symbol || s.amiBrokerTicker || s.amibroker_ticker
              if (feedSimulator && s.amiBrokerTicker) feedSimulator.addSymbolByTicker(s.amiBrokerTicker, brokerRow.id, s.exchange, s.instrumentType, bToken)
            }
          } catch (e) {
            console.error('[OAuth] Failed to subscribe adopted symbols:', e)
          }
        }
      }

      // We are done with these credentials for the auth phase
      pendingLogins.delete(brokerType)

      // Trigger backfill for ALL symbols of this broker now that we are connected
      try {
        const { backfillQueue } = require('../services/BackfillQueue')
        const { backfilledTickers } = require('../shared/backfillState')
        const { getLastBarTimestampSec, getAllSettings } = require('../db')
        const bsettings = getAllSettings() as any
        const backfillDepth = Number(bsettings?.backfillDepthDays) || 365
        const allSyms = stmts.getSymbols.all() as any[]
        const brokerSyms = allSyms.filter((s: any) => {
          const bid = s.brokerId || s.broker_id
          return bid === brokerRow.id && bid !== 'orphaned'
        })
        let queuedCount = 0
        // BUG #6 FIX: getLastBarTimestampSec is async but was called without await
        // Use Promise.all to handle async calls inside the loop correctly
        const backfillPromises = brokerSyms.map(async (sym: any) => {
          const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
          const brokerToken = sym.instrumentId || sym.instrument_id || sym.rawSymbol || sym.raw_symbol || ticker
          if (!ticker) return
          
          let needsFullBackfill = true
          const safeTicker = ticker.replace(/[^a-zA-Z0-9_-]/g, '_')
          
          if (backfilledTickers.has(ticker)) {
            needsFullBackfill = false
          } else {
            // Software restarted, check DB if we already have deep history
            const { getOldestBarTimestampSec } = require('../db')
            const oldestTsSec = await getOldestBarTimestampSec(safeTicker)
            if (oldestTsSec > 0) {
              const oldestDays = Math.ceil((Math.floor(Date.now() / 1000) - oldestTsSec) / 86400)
              // If we have data older than 75% of our backfill depth, consider it fully backfilled
              if (oldestDays >= (backfillDepth * 0.75)) {
                needsFullBackfill = false
                backfilledTickers.add(ticker) // Cache it so we don't check DB again
              }
            }
          }

          if (needsFullBackfill) {
            // ALWAYS run full backfill if it has never completed a full backfill
            backfillQueue.enqueue(ticker, brokerRow.id, brokerToken, backfillDepth)
            queuedCount++
          } else {
            // Already fully backfilled; just catch up from last known bar
            const lastTsSec = await getLastBarTimestampSec(safeTicker)  // BUG #6 FIX: added await
            if (lastTsSec > 0) {
              const diffDays = Math.ceil((Math.floor(Date.now() / 1000) - lastTsSec) / 86400)
              if (diffDays > 0) {
                backfillQueue.enqueue(ticker, brokerRow.id, brokerToken, diffDays + 1)
                queuedCount++
              }
            }
          }
        })
        await Promise.all(backfillPromises)
        console.log(`[OAuth] Triggered backfill for ${queuedCount} symbols after ${brokerType} connect`)

        // Migrate any stale queue tasks from old broker IDs to the new one.
        // This fixes the case where broker is deleted+re-authed while queue is running:
        // old tasks still hold the old brokerId and its expired token → -16 errors.
        const allBrokersForMigration = stmts.getBrokers.all() as any[]
        const oldBrokerIds = allBrokersForMigration
          .filter(b => b.broker_type === brokerType && b.id !== brokerRow.id)
          .map(b => b.id)
        for (const oldId of oldBrokerIds) {
          backfillQueue.updateBrokerInQueue(oldId, brokerRow.id)
        }

        // Resume queue in case it was paused due to token expiry
        backfillQueue.resumeAfterAuth()

      } catch (bfErr) {
        console.error('[OAuth] Failed to trigger backfill:', bfErr)
      }
      
      // Subscribe to all raw symbols for live ticks
      try {
        const allSyms = stmts.getSymbols.all() as any[]
        const rawSymbols = allSyms
          .filter((s: any) => (s.brokerId || s.broker_id) === brokerRow.id)
          .map((s: any) => s.rawSymbol || s.raw_symbol)
          .filter(Boolean)
        if (rawSymbols.length > 0) {
          await brokerManager.subscribe(brokerRow.id, rawSymbols)
          console.log(`[OAuth] Subscribed to ${rawSymbols.length} symbols for live ticks`)
        }
      } catch (subErr) {
        console.error('[OAuth] Failed to subscribe symbols:', subErr)
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
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const broker = stmts.getBrokerById.get(id) as any
    if (!broker) return res.status(404).json({ error: 'Broker not found' })

    // In real impl: CryptUnprotectData + delete from OS vault
    stmts.deleteBroker.run(id)
    stmts.insertEvent.run({
      broker_id: id, event_type: 'DISCONNECTED',
      detail: 'Broker account removed by user. Credentials wiped from OS vault.',
      ts_utc_ms: Date.now(),
    })

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
    
    if (broker.broker_type === 'fyers' && !finalApiSecret) {
      return res.status(400).json({ error: 'API Secret is missing. Please delete and re-add the broker.' })
    }

    pendingLogins.set(broker.broker_type, { apiKey: creds.apiKey, apiSecret: finalApiSecret })

    let loginUrl = ''
    const redirectUrl = `http://127.0.0.1:7890/api/callback/${broker.broker_type}`
    if (broker.broker_type === 'fyers') {
      loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${creds.apiKey}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&state=${id}`
    } else if (broker.broker_type === 'zerodha_kite') {
      loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${creds.apiKey}`
    } else {
      return res.status(400).json({ error: 'Re-auth not supported for this broker type yet' })
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

    let adapter = id ? brokerManager.getAdapter(id) : undefined
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

// POST /api/brokers/:id/symbols — Add symbols to stream
router.post('/:id/symbols', (req, res) => {
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
        stmts.insertSymbol.run({
          broker_id: id,
          instrument_id: sym.instrumentId || sym.ticker,
          amibroker_ticker: sym.ticker,
          exchange: sym.exchange || 'NSE',
          instrument_type: sym.instrumentType || 'EQ',
          raw_symbol: sym.instrumentId || sym.ticker,
          created_at: now,
        })
        feedSimulator.addSymbolByTicker(sym.ticker, id, sym.exchange, sym.instrumentType, sym.instrumentId || sym.ticker)
        brokerManager.subscribe(id, [sym.instrumentId || sym.ticker])
        const settings = require('../db').getAllSettings() as any
        const backfillDepth = Number(settings?.backfillDepthDays) || 365
        require('../services/BackfillQueue').backfillQueue.enqueue(sym.ticker, id, sym.instrumentId || sym.ticker, backfillDepth)
        added++
        
        const psScript = `
          try {
            $ab = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Broker.Application')
            if ($null -ne $ab) {
              $ab.Stocks.Add('${sym.ticker}')
              $ab.RefreshAll()
            }
          } catch {}
          exit 0
        `
        exec(`powershell -Command "${psScript.replace(/\n/g, ';')}"`, (err) => {
          // ignore OLE errors if AmiBroker is closed
        })
      } catch { /* ignore dups */ }
    }
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
    feedSimulator.removeSymbolByTicker(ticker, id, `NSE:${ticker}-EQ`) // Best effort removal
    feedSimulator.removeSymbolByTicker(ticker, id) // Standard removal
    brokerManager.unsubscribe(id, [ticker])
    // Clear from backfill Set and cancel any ongoing queue tasks
    backfilledTickers.delete(ticker)
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
    const { brokerManager } = require('../services/BrokerManager')
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
    const { brokerManager } = require('../services/BrokerManager')
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

        stmts.insertSymbol.run({
          broker_id: id,
          instrument_id: ticker,
          amibroker_ticker: ticker,
          exchange,
          instrument_type: instrumentType,
          raw_symbol: ticker,
          created_at: now,
        })
        feedSimulator.addSymbolByTicker(ticker, id, exchange, instrumentType, ticker)
        brokerManager.subscribe(id, [ticker])
        const settings = require('../db').getAllSettings() as any
        const backfillDepth = Number(settings?.backfillDepthDays) || 365
        require('../services/BackfillQueue').backfillQueue.enqueue(ticker, id, ticker, backfillDepth)
        backfilledTickers.delete(ticker) // ensure fresh fetch
        added++
      } catch (e: any) {
        errors.push(e.message)
      }
    }

    res.json({ added, total: lines.length, errors })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
