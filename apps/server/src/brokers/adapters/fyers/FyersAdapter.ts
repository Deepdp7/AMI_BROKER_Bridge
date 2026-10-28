import { encode, decode } from '@msgpack/msgpack';
import { stmts, DATA_DIR } from '../../../db';
import { EventEmitter } from 'events'
import { IBrokerAdapter, BrokerCredentials, SessionInfo, InstrumentInfo, Bar, NormalizedTick } from '../IBrokerAdapter'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { FyersHSMClient } from './FyersHSMClient'
import { RateLimiter } from '../../../lib/RateLimiter'
import { SEARCH_FILTERS, category, type InstrumentCategory } from '../InstrumentMaster'

/**
 * A Fyers symbol-list row's category, from its exchange and Fyers' instrument type code
 * (column 3 of the public lists). Codes checked against the lists themselves: cash market
 * 0 equity, 9 ETF, 10 index; NSE F&O 11 index futures, 13 stock futures, 14 index options,
 * 15 stock options; MCX 11 index futures, 14 index options, 30 commodity futures, 31 options
 * on commodity futures. The symbol's own ending decides when a code is new to us.
 */
export function fyersCategory(exchange: string, code: number, id: string): InstrumentCategory {
  const option = /(CE|PE)$/.test(id)
  if (exchange === 'NSE' || exchange === 'BSE') return code === 10 || id.endsWith('-INDEX') ? 'INDEX' : 'EQ'
  if (exchange === 'MCX') {
    if (code === 11) return 'FUTIDX'
    if (code === 14) return 'OPTIDX'
    return option ? 'OPTFUT' : 'FUTCOM'
  }
  // NSE F&O
  if (code === 11 || code === 12) return 'FUTIDX'
  if (code === 13) return 'FUTSTK'
  if (code === 14) return 'OPTIDX'
  if (code === 15) return 'OPTSTK'
  return option ? 'OPTSTK' : 'FUTSTK'
}

// Fyers history API, Standard plan (measured 2026-10-25): bursts of 5/s pass, but no more than
// 50 requests are accepted in any 60 s; past that it answers -360 ("5 requests/second"). Shared
// by every caller (backfill workers, auto-refresh, startup fetches).
const historyLimiter = new RateLimiter(4, 48)

/** Fyers' "too many requests" answers: classic 429 and the plan limit (-360, "5 requests/second") */
function isFyersRateLimit(data: any): boolean {
  return data?.code === 429 || data?.code === -360 || /request limit|requests\/second|plan limit/i.test(String(data?.message || ''))
}

/** Expiry time (UTC ms) from the access token's JWT `exp`, or null if it can't be read. */
export function fyersTokenExpiryMs(accessToken: string): number | null {
  try {
    const jwt = accessToken.includes(':') ? accessToken.split(':')[1] : accessToken
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null // not a JWT we can read — let the broker decide
  }
}

/** True when the access token has expired (or is within a minute of it). */
export function isFyersTokenExpired(accessToken: string): boolean {
  const exp = fyersTokenExpiryMs(accessToken)
  return exp !== null && exp < Date.now() + 60_000
}

/** Longest one symbol-list file may take to download (the biggest is about 10 MB) */
const MASTER_DOWNLOAD_TIMEOUT_MS = 120_000

export class FyersAdapter extends EventEmitter implements IBrokerAdapter {
  /** Fyers serves at most 100 days of intraday candles per history request */
  readonly maxIntradayHistoryDays = 95
  /** History requests per minute allowed right now (the download queue picks the fastest broker) */
  historyRequestsPerMinute() { return historyLimiter.perMinuteBudget }
  private connected = false
  private accessToken: string = ''
  private appId: string = ''
  private hsmClient: FyersHSMClient | null = null
  private masterContracts: InstrumentInfo[] | null = null
  private masterCache: Map<string, { id: string, hsm: string }> | null = null;
  private loadMasterCachePromise: Promise<void> | null = null;
  private expiryTimer: NodeJS.Timeout | null = null

  /**
   * Fyers tokens die at a fixed time (06:00 IST the next morning). Report it the moment it
   * happens: nothing else notices while the market is closed, and the app kept showing
   * "Connected" with a dead token until the user found no data at 09:15.
   */
  private scheduleExpiry() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = null
    const exp = fyersTokenExpiryMs(this.accessToken)
    if (exp === null) return
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null
      console.log('[FyersAdapter] Access token expired')
      this.emit('auth_failed')
    }, Math.min(Math.max(0, exp - Date.now()), 2 ** 31 - 1))
    this.expiryTimer.unref()
  }

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    const cleanApiKey = credentials.apiKey ? credentials.apiKey.trim() : ''
    const cleanApiSecret = credentials.apiSecret ? credentials.apiSecret.trim() : ''

    const startConcurr = async () => {
      await new Promise(r => setTimeout(r, 100))
      console.log(`[LIVE_BACKFILL_CONCURRENCY] liveWorker=${this.hsmClient?.authenticated ? 'connected_idle' : 'connecting'} backfillWorker=running`)
    }

    if (credentials.accessToken) {
      // Fyers tokens die every day. Fail here so the caller marks the broker auth_required
      // instead of registering an adapter whose history calls and stream can never work.
      if (isFyersTokenExpired(credentials.accessToken)) {
        const err: any = new Error('Token expired — log in to Fyers again')
        err.code = 'TOKEN_EXPIRED'
        throw err
      }
      this.appId = cleanApiKey
      this.accessToken = credentials.accessToken

      if (!this.hsmClient) {
        this.hsmClient = new FyersHSMClient(this.accessToken)
        this.hsmClient.on('log_entry', (msg) => (this as any).emit('log_entry', msg))
        this.hsmClient.on('auth_failed', () => (this as any).emit('auth_failed'))
        this.hsmClient.on('tick', (tick) => (this as any).emit('tick', tick))
        this.hsmClient.on('connected', () => {
          (this as any).emit('connection_state', 'CONNECTED')
          this.connected = true
          startConcurr()
        })
        this.hsmClient.on('disconnected', () => {
          (this as any).emit('connection_state', 'DISCONNECTED')
          this.connected = false
        })
        this.hsmClient.connect()
      } else {
        this.hsmClient.connect()
      }
      this.scheduleExpiry()

      return { accountId: 'FYERS_USER', accessToken: this.accessToken }
    }

    if (!cleanApiKey || !cleanApiSecret || !credentials.requestToken) {
      throw new Error(`Fyers auth missing parameters. API Key: ${!!cleanApiKey}, API Secret: ${!!cleanApiSecret}, requestToken: ${!!credentials.requestToken}`)
    }
    
    this.appId = cleanApiKey
    
    // Fyers API v3 hash requires the FULL App ID (including the -100 suffix)
    // Fyers format: SHA256(appId + ":" + apiSecret)
    const appIdHash = crypto
      .createHash('sha256')
      .update(`${cleanApiKey}:${cleanApiSecret}`)
      .digest('hex')
    console.log(`[FyersAdapter] Using full apiKey="${cleanApiKey}" for hash`)

    // Exchange auth_code for access_token
    const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        appIdHash,
        code: credentials.requestToken
      })
    })

    const data = (await response.json()) as any
    
    if (data.s !== 'ok' || !data.access_token) {
      throw new Error(data.message || 'Failed to validate Fyers auth code')
    }

    console.log(`[FyersAdapter DEBUG] OAuth Flow. cleanApiKey is: "${cleanApiKey}"`)
    this.accessToken = data.access_token
    this.appId = cleanApiKey
    
    if (!this.hsmClient) {
      this.hsmClient = new FyersHSMClient(this.accessToken)
      this.hsmClient.on('log_entry', (msg) => (this as any).emit('log_entry', msg))
      this.hsmClient.on('auth_failed', () => (this as any).emit('auth_failed'))
      this.hsmClient.on('tick', (tick) => (this as any).emit('tick', tick))
      this.hsmClient.on('connected', () => {
        (this as any).emit('connection_state', 'CONNECTED')
        this.connected = true
        startConcurr()
      })
      this.hsmClient.on('disconnected', () => {
        (this as any).emit('connection_state', 'DISCONNECTED')
        this.connected = false
      })
      this.hsmClient.connect()
    } else {
      this.hsmClient.connect()
    }
    this.scheduleExpiry()

    return { accountId: 'FYERS_USER', accessToken: this.accessToken }
  }

  async disconnect(): Promise<void> {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = null
    if (this.hsmClient) {
      this.hsmClient.disconnect()
    }
    this.connected = false
    this.emit('connection_state', 'DISCONNECTED')
  }

  async downloadInstruments(): Promise<void> {
    // Fyers mapping is mostly static, but we can pre-fetch if needed.
    // For now, no-op since resolveSymbol handles it statically.
  }

  async getNearestExpiryFuture(underlying: string): Promise<string | null> {
    const masterDir = path.join(DATA_DIR, 'fyers_master');
    const filePath = path.join(masterDir, 'NSE_FO.csv');
    if (!fs.existsSync(filePath)) return null;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
      });
      const futures: any[] = [];
      const q = underlying.toUpperCase();

      rl.on('line', (line) => {
        if (!line) return;
        const parts = line.split(',');
        if (parts.length >= 14) {
          const sym = parts[13]?.trim().toUpperCase();
          const brokerSymbol = parts[9]?.trim();
          if (sym === q && brokerSymbol && brokerSymbol.endsWith('FUT')) {
             const expStr = parts[8]?.trim();
             const expUnix = parseInt(expStr);
             if (expUnix && !isNaN(expUnix)) {
                futures.push({ symbol: brokerSymbol, exp: expUnix });
             }
          }
        }
      });
      rl.on('close', () => {
        const nowUnix = Math.floor(Date.now() / 1000);
        const active = futures.filter(f => f.exp >= nowUnix);
        active.sort((a, b) => a.exp - b.exp);
        if (active.length > 0) resolve(active[0].symbol);
        else resolve(null);
      });
    });
  }

  async resolveSymbol(ticker: string, dbExchange?: string): Promise<string> {
    const t = ticker.toUpperCase().trim().replace(/\s+/g, '');
    let resolved = t;

    let exch = dbExchange;
    if (!exch) {
      try {
        const symRecord = (stmts.getSymbols.all() as any[]).find((s: any) => (s.amiBrokerTicker || s.amibroker_ticker) === ticker);
        if (symRecord) exch = symRecord.exchange;
      } catch (e) {
        // Ignore DB error
      }
    }

    // Fyers uses NSE: prefix for NFO symbols
    if (resolved.startsWith('NFO:') || exch === 'NFO' || resolved.endsWith('-FUT')) {
      let underlying = resolved.startsWith('NFO:') ? resolved.substring(4) : resolved;
      underlying = underlying.replace(/-FUT$/, '');
      
      const nearestFut = await this.getNearestExpiryFuture(underlying);
      if (nearestFut) {
        resolved = nearestFut;
      } else {
        resolved = 'NSE:' + underlying;
      }
    } else if (resolved.includes(':') && (resolved.includes('-') || /FUT$/.test(resolved) || /\d+[CP]E$/.test(resolved))) {
      // It's already in a valid Fyers format
    } else {
      const clean = resolved.replace(/-NSC$/, '').replace(/\.NS$/, '').replace(/-EQ$/, '');
      if (clean === 'NIFTY50' || clean === 'NIFTY') resolved = 'NSE:NIFTY50-INDEX';
      else if (clean === 'BANKNIFTY' || clean === 'NIFTYBANK') resolved = 'NSE:NIFTYBANK-INDEX';
      else if (clean === 'FINNIFTY') resolved = 'NSE:FINNIFTY-INDEX';
      else if (clean === 'MIDCPNIFTY') resolved = 'NSE:MIDCPNIFTY-INDEX';
      else if (clean === 'NIFTYNXT50') resolved = 'NSE:NIFTYNXT50-INDEX';
      else if (clean === 'NIFTYFPI') resolved = 'NSE:NIFTYFPI150-INDEX';
      else if (clean === 'SENSEX') resolved = 'BSE:SENSEX-INDEX';
      else if (clean === 'BANKEX') resolved = 'BSE:BANKEX-INDEX';
      else if (clean === 'INDIAVIX') resolved = 'NSE:INDIAVIX-INDEX';
      else if (clean.includes(':')) {
        const [exch, sym] = clean.split(':');
        if (exch === 'MCX') resolved = `MCX:${sym}`;
        else if (exch === 'NFO') resolved = `NSE:${sym}`;
        else if (exch === 'BSE') resolved = `BSE:${sym}-EQ`;
        else if (/FUT$/.test(sym) || /\d+[CP]E$/.test(sym)) resolved = `NSE:${sym}`;
        else resolved = `NSE:${sym}-EQ`;
      } else if (/FUT$/.test(clean) || /\d+[CP]E$/.test(clean)) {
        resolved = `NSE:${clean}`;
      } else if (/^(GOLD|SILVER|CRUDE|CRUDEOIL|NATURALGAS|COPPER|ZINC|LEAD|ALUMINIUM|NICKEL|MCXBULLDEX|MCXENRGDEX|COTTON|MENTHAOIL)/i.test(clean)) {
        resolved = `MCX:${clean}`;
      } else {
        resolved = `NSE:${clean}-EQ`;
      }
    }

    if (resolved !== ticker) {
      ;(this as any).emit('symbol_resolved', { original: ticker, resolved });
    }
    return resolved;
  }

  // --- Master Contract Download Logic ---
  public isDownloadingMaster = false
  public lastMasterSync: number = 0

  public isMasterDownloadedToday(): boolean {
    const masterDir = path.join(DATA_DIR, 'fyers_master')
    if (!fs.existsSync(masterDir)) return false
    const required = ['NSE_CM.csv', 'NSE_FO.csv', 'MCX_COM.csv', 'BSE_CM.csv']
    const todayStr = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0]
    
    for (const file of required) {
      const filePath = path.join(masterDir, file)
      if (!fs.existsSync(filePath)) return false
      try {
        const stat = fs.statSync(filePath)
        if (stat.size < 1000) return false // Empty or corrupted
        const fileDate = new Date(stat.mtimeMs + 5.5 * 3600 * 1000).toISOString().split('T')[0]
        if (fileDate !== todayStr) return false
      } catch {
        return false
      }
    }
    return true
  }

  public async downloadMasterContracts(brokerId?: string): Promise<void> {
    if (this.isDownloadingMaster) return
    this.isDownloadingMaster = true

    const bId = brokerId || 'fyers'

    try {
      this.masterContracts = [] // keep array empty to avoid memory leak
      this.emit('master_sync_progress', { brokerId: bId, progress: 10, text: 'Starting symbol download...' })

      const sources = [
        { file: 'NSE_CM.csv', url: 'https://public.fyers.in/sym_details/NSE_CM.csv', ex: 'NSE' },
        { file: 'NSE_FO.csv', url: 'https://public.fyers.in/sym_details/NSE_FO.csv', ex: 'NFO' },
        { file: 'MCX_COM.csv', url: 'https://public.fyers.in/sym_details/MCX_COM.csv', ex: 'MCX' },
        { file: 'BSE_CM.csv', url: 'https://public.fyers.in/sym_details/BSE_CM.csv', ex: 'BSE' },
      ]
      
      const masterDir = path.join(DATA_DIR, 'fyers_master')
      if (!fs.existsSync(masterDir)) fs.mkdirSync(masterDir, { recursive: true })

      // All four at once (about 12 s one after another); each file is written to a .part file
      // first and renamed when complete, so a cut-off download never counts as today's list
      let done = 0
      const failed: string[] = []
      const report = () => this.emit('master_sync_progress', {
        brokerId: bId,
        progress: 15 + Math.round((done / sources.length) * 80),
        text: done < sources.length ? `Downloading symbol lists (${done} of ${sources.length})...` : 'Saving symbol lists...',
      })
      report()
      await Promise.all(sources.map(async src => {
        let lastError = ''
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch(src.url, { signal: AbortSignal.timeout(MASTER_DOWNLOAD_TIMEOUT_MS) })
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
            const buffer = Buffer.from(await res.arrayBuffer())
            if (buffer.length < 1000) throw new Error(`only ${buffer.length} bytes`)
            const filePath = path.join(masterDir, src.file)
            await fs.promises.writeFile(filePath + '.part', buffer)
            await fs.promises.rename(filePath + '.part', filePath)
            this.emit('log_entry', { level: 'info', component: 'FyersAdapter', message: `Saved ${src.ex} contracts (${Math.round(buffer.length / 1024)} KB) to disk.` })
            done++
            report()
            return
          } catch (e: any) {
            lastError = e?.name === 'TimeoutError' ? 'timed out' : e?.message || String(e)
            console.error(`Failed to download ${src.ex} contracts (attempt ${attempt} of 3): ${lastError}`)
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
          }
        }
        failed.push(`${src.ex} (${lastError})`)
      }))
      if (failed.length) {
        throw new Error(`Could not download the Fyers symbol list for ${failed.join(', ')}. Check the internet connection, then try again.`)
      }

      this.lastMasterSync = Date.now()
      this.emit('master_sync_progress', { brokerId: bId, progress: 100, text: 'Symbols sync complete.' })
      this.emit('master_sync_complete', { brokerId: bId, count: 0, text: 'Symbols database up to date.' })

    } catch (e: any) {
      this.emit('master_sync_error', { brokerId: bId, error: e.message })
      this.emit('log_entry', { level: 'error', component: 'FyersAdapter', message: `Master contract download failed: ${e.message}` })
    } finally {
      this.isDownloadingMaster = false
    }
  }

  async searchSymbols(query: string, exchange?: string): Promise<InstrumentInfo[]> {
    const masterDir = path.join(DATA_DIR, 'fyers_master')
    if (!fs.existsSync(masterDir) || fs.readdirSync(masterDir).length === 0) {
      await this.downloadMasterContracts()
    }

    const q = query.toLowerCase()
    let results: InstrumentInfo[] = []
    
    // The app's filter chips ("NFO-12" = stock futures…) name instrument categories, not Fyers'
    // own type codes, so each row's code is turned into a category first (fyersCategory)
    let exFilter: string | null = null
    let catFilter: InstrumentCategory[] | null = null
    if (exchange && exchange !== 'ALL') {
      exFilter = exchange.split('-')[0]
      catFilter = SEARCH_FILTERS[exchange] ?? null
    }

    const sources = [
      { file: 'NSE_CM.csv', ex: 'NSE', type: 'EQ', tickerCol: 13, idCol: 9, nameCol: 1 },
      { file: 'NSE_FO.csv', ex: 'NFO', type: 'FUT', tickerCol: 13, idCol: 9, nameCol: 1 },
      { file: 'MCX_COM.csv', ex: 'MCX', type: 'COMM', tickerCol: 13, idCol: 9, nameCol: 1 },
      { file: 'BSE_CM.csv', ex: 'BSE', type: 'EQ', tickerCol: 13, idCol: 9, nameCol: 1 },
    ]

    for (const src of sources) {
      if (exFilter && exFilter !== src.ex) continue

      const filePath = path.join(masterDir, src.file)
      if (!fs.existsSync(filePath)) continue

      const fileStream = fs.createReadStream(filePath)
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })
      
      let fileCount = 0

      for await (const line of rl) {
        if (!line) continue
        
        // Fast pre-check before expensive split
        if (line.toLowerCase().includes(q)) {
          const parts = line.split(',')
          if (parts.length >= 14) {
             const sym = parts[src.tickerCol]?.trim()
             const id = parts[src.idCol]?.trim()
             
             const name = parts[src.nameCol || 1]?.trim() || ''
             if (sym && id) {
               if (sym.toLowerCase().includes(q) || id.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
                 const cat = fyersCategory(src.ex, parseInt(parts[2]) || 0, id)
                 if (catFilter && !catFilter.includes(cat)) continue
                 const cleanId = id.replace(/^[A-Z]+:/, '')

                 results.push({
                   instrumentId: id,
                   exchange: src.ex,
                   ticker: src.type === 'EQ' ? sym : cleanId,
                   instrumentType: category(cat),
                   lotSize: parseInt(parts[3]) || 1,
                   tickSize: parseFloat(parts[4]) || 0.05
                 })
                 fileCount++
               }
             }
          }
        }
        if (fileCount >= 100) break
      }
      rl.close()
    }
    
    // Sort exact matches to top
    results.sort((a, b) => {
      const aExact = a.ticker.toLowerCase() === q ? -1 : 1
      const bExact = b.ticker.toLowerCase() === q ? -1 : 1
      if (aExact !== bExact) return aExact - bExact
      return a.ticker.localeCompare(b.ticker)
    })

    return results
  }


  /** Authenticated GET on the Fyers data API (option chain, quotes…), under the shared rate limit. */
  async dataApi(pathAndQuery: string): Promise<any> {
    if (!this.accessToken) throw new Error('Fyers is not connected — log in again from Broker Connection')
    await historyLimiter.acquire()
    const res = await fetch(`https://api-t1.fyers.in/data/${pathAndQuery}`, {
      headers: { Authorization: `${this.appId}:${this.accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    const data: any = await res.json().catch(() => ({}))
    if (res.status === 429 || data?.code === 429) {
      historyLimiter.pause(3000)
      throw Object.assign(new Error('Fyers rate limit — try again in a moment'), { code: 429 })
    }
    if (!res.ok || (data?.code && data.code !== 200 && data.s !== 'ok')) throw new Error(data?.message || `Fyers data API error ${res.status}`)
    return data
  }

  async getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]> {
    if (!this.accessToken) return []

    let safeToken = instrumentToken
    if (safeToken.startsWith('NSE:') && !safeToken.includes('-') && !/FUT$/.test(safeToken) && !/\d+[CP]E$/.test(safeToken)) {
      safeToken = safeToken + '-EQ'
    }
    if (!safeToken.includes(':')) {
      safeToken = await this.resolveSymbol(safeToken)
    }

    let resolution = '1'
    if (interval.endsWith('m')) resolution = interval.replace('m', '')
    else if (interval === '1d' || interval === '1D') resolution = 'D'

    const formatIST = (d: Date) => {
      const ist = new Date(d.getTime() + 5.5 * 3600 * 1000)
      return ist.toISOString().split('T')[0]
    }
    
    const fromStr = formatIST(from)
    const toStr = formatIST(to)

    await historyLimiter.acquire()
    const url = `https://api-t1.fyers.in/data/history?symbol=${encodeURIComponent(safeToken)}&resolution=${resolution}&date_format=1&range_from=${fromStr}&range_to=${toStr}&cont_flag=0`

    try {
      const controller = new AbortController()
      // 100-day 1-minute chunks are ~25k candles; give them time to arrive
      const timeout = setTimeout(() => controller.abort(), 30000)

      const res = await fetch(url, {
        headers: {
          'Authorization': `${this.appId}:${this.accessToken}`
        },
        signal: controller.signal
      })
      clearTimeout(timeout)
      
      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch (err) {
          console.error(`[FyersAdapter] History API returned non-JSON (${res.status} ${res.statusText}) for ${instrumentToken}. First 100 chars:`, text.substring(0, 100))
          if (res.status === 429 || res.status === 401 || res.status === 403 || res.status === 400) {
            const fetchErr = new Error(`HTTP ${res.status}: ${res.statusText}`) as any;
            fetchErr.code = res.status === 429 ? 429 : -16;
            if (res.status === 429) historyLimiter.limited();
            throw fetchErr;
          }
          return []
        }
      
      if (data.s === 'ok' && data.candles) {
        return data.candles.map((c: any) => ({
          ts: c[0] * 1000,
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5]
        }))
      } else if (data.s === 'no_data') {
        return []
      } else if (isFyersRateLimit(data)) {
        historyLimiter.limited()
        console.warn(`[FyersAdapter] Rate limit reached for ${instrumentToken} (${data.code} ${data.message || ''}): pausing, now ${historyLimiter.perMinuteBudget} requests/min`)
        const err: any = new Error(`429 request limit reached: ${data.message || ''}`)
        err.code = 429
        throw err
      } else {
        console.error(`[FyersAdapter] History API returned error for ${instrumentToken}:`, data)
          if (data.code === -16 || (data.message && String(data.message).toLowerCase().includes('authenticate'))) {
            const err = new Error(`Auth Error: ${data.message || ''}`) as any;
            err.code = -16;
            throw err;
          }
          const genericErr = new Error(`Fyers API Error: ${data.message || ''}`) as any;
          genericErr.code = data.code || -1;
          genericErr.fromApi = true;
          throw genericErr;
        }
    } catch (e: any) {
        if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
          throw e;
        }
        // A broker error is not "no data": returning [] made gap-fills mark the range verified
        // and never fetch it again. The caller retries, and leaves the range open if it gives up.
        if (e?.fromApi) throw e
        if (e?.code === -16 || e?.message?.includes('Auth') || e?.message?.includes('authenticate')) {
          throw e;
        }
        // Timeouts / network drops must be retried by the caller, not treated as "no data"
        // (that would silently skip the whole chunk)
        if (e?.name === 'AbortError') throw Object.assign(new Error(`timeout fetching history for ${instrumentToken}`), { name: 'AbortError' })
        if (e?.name === 'TypeError' || e?.code === 'ECONNRESET' || e?.cause) throw e
      console.error(`[FyersAdapter] Error fetching historical bars for ${instrumentToken}:`, e)
      return []
    }
  }

  private async loadMasterCache(): Promise<void> {
    if (this.masterCache) return;
    if (this.loadMasterCachePromise) return this.loadMasterCachePromise;

    this.loadMasterCachePromise = (async () => {
      this.masterCache = new Map();
    const masterDir = path.join(DATA_DIR, 'fyers_master');
    const sources = [
      { file: 'NSE_CM.csv', ex: 'NSE', type: 'EQ', hsmSegment: 'nse_cm', idCol: 9, tickerCol: 13 },
      { file: 'NSE_IDX.csv', ex: 'NSE', type: 'INDEX', hsmSegment: 'nse_idx', idCol: 9, tickerCol: 13 },
      { file: 'NSE_FO.csv', ex: 'NFO', type: 'FUT', hsmSegment: 'nse_fo', idCol: 9, tickerCol: 13 },
      { file: 'MCX_COM.csv', ex: 'MCX', type: 'COMM', hsmSegment: 'mcx_fo', idCol: 9, tickerCol: 13 },
      { file: 'BSE_CM.csv', ex: 'BSE', type: 'EQ', hsmSegment: 'bse_cm', idCol: 9, tickerCol: 13 },
    ];

    for (const src of sources) {
      const filePath = path.join(masterDir, src.file);
      if (!fs.existsSync(filePath)) continue;

      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 14) {
          const id = parts[src.idCol]?.trim();
          const ticker = parts[src.tickerCol]?.trim();
          const tokenStr = parts[12]?.trim();
          
          if (id && tokenStr) {
            // NSE options (~90k) are left out to save memory; the ones you actually add are
            // looked up when they are subscribed (addOptionsToCache)
            if (src.file === 'NSE_FO.csv' && !id.endsWith('FUT')) {
              continue;
            }

            const prefix = src.type === 'INDEX' ? 'if' : 'sf';
            const hsm = `${prefix}|${src.hsmSegment}|${tokenStr}`;
            const entry = { id, hsm };
            this.masterCache!.set(id, entry);
            if (ticker && ticker !== id) {
              this.masterCache!.set(ticker, entry);
            }
          }
        }
      }
      rl.close();
    }
    console.log(`[FyersAdapter] Master CSV cache loaded with ${this.masterCache!.size} symbols.`);
    })();
    
    await this.loadMasterCachePromise;
  }

  /** Finds these NSE option symbols in the F&O list (one pass) and adds them to the live-feed map */
  private async addOptionsToCache(ids: string[]): Promise<void> {
    const filePath = path.join(DATA_DIR, 'fyers_master', 'NSE_FO.csv');
    if (!fs.existsSync(filePath)) return;
    const wanted = new Set(ids);
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!wanted.size) break;
      const parts = line.split(',');
      const id = parts[9]?.trim();
      const token = parts[12]?.trim();
      if (id && token && wanted.has(id)) {
        const entry = { id, hsm: `sf|nse_fo|${token}` };
        // By full symbol only: column 14 is the underlying ("NIFTY"), shared by every contract
        this.masterCache!.set(id, entry);
        wanted.delete(id);
      }
    }
    rl.close();
  }

  private async getHsmTokens(tickers: string[]): Promise<string[]> {
    await this.loadMasterCache();
    const results: string[] = [];
    let mapped = 0;
    const unmapped: string[] = [];

    const missingOptions = tickers.filter(t => !this.masterCache!.has(t) && /^NSE:.+\d(CE|PE)$/.test(t));
    if (missingOptions.length) await this.addOptionsToCache(missingOptions);

    for (const t of tickers) {
      const entry = this.masterCache!.get(t);
      if (entry) {
        // mapping is set in subscribe() with original amibroker ticker
        results.push(entry.hsm);
        mapped++;
      } else {
        unmapped.push(t);
      }
    }

    if (unmapped.length > 0) {
      console.log(`[HSM_MAPPING] ${unmapped.length} symbols could not be mapped to HSM tokens (e.g. ${unmapped.slice(0, 5).join(', ')}).`);
    }
    return results;
  }

  async subscribe(instruments: string[]): Promise<void> {
    try {
      // Build pairs of original amibroker ticker → resolved Fyers symbol
      const pairs = await Promise.all(instruments.map(async i => ({
        original: i,
        resolved: await this.resolveSymbol(i)
      })));
      const resolvedInstruments = pairs.map(p => p.resolved);
      if (this.hsmClient) {
        await this.getHsmTokens(resolvedInstruments);
        // CRITICAL FIX: Map HSM token → ORIGINAL amibroker ticker (e.g. "BPCL")
        // NOT the resolved Fyers format (e.g. "NSE:BPCL-EQ")
        // This ensures processRealTick() can look up "brokerId:BPCL" in instruments map
        for (const pair of pairs) {
          const entry = this.masterCache?.get(pair.resolved);
          if (entry && this.hsmClient) {
            this.hsmClient.setSymbolMapping(pair.original, entry.hsm);
          }
        }
        this.hsmClient.subscribe(pairs.map(p => p.original));
      }
    } catch (e: any) {
      console.error('[FyersAdapter] subscribe error', e)
    }
  }

  async unsubscribe(instruments: string[]): Promise<void> {
    try {
      const resolvedInstruments = await Promise.all(instruments.map(i => this.resolveSymbol(i)))
      if (this.hsmClient) {
        this.hsmClient.unsubscribe(resolvedInstruments)
      }
    } catch (e: any) {
      console.error('[FyersAdapter] unsubscribe error', e)
    }
  }

  getCapabilities() {
    return { supportsTickData: true, supports1sBars: false, supportsDepth: true }
  }
}
