import { encode, decode } from '@msgpack/msgpack';
import { stmts, DATA_DIR } from '../../db';
import { EventEmitter } from 'events'
import { IBrokerAdapter, BrokerCredentials, SessionInfo, InstrumentInfo, Bar, NormalizedTick } from './IBrokerAdapter'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { FyersHSMClient } from './FyersHSMClient'

export class FyersAdapter extends EventEmitter implements IBrokerAdapter {
  private connected = false
  private accessToken: string = ''
  private appId: string = ''
  private hsmClient: FyersHSMClient | null = null
  private masterContracts: InstrumentInfo[] | null = null
  private masterCache: Map<string, { id: string, hsm: string }> | null = null;
  private loadMasterCachePromise: Promise<void> | null = null;

  async connect(credentials: BrokerCredentials): Promise<SessionInfo> {
    const cleanApiKey = credentials.apiKey ? credentials.apiKey.trim() : ''
    const cleanApiSecret = credentials.apiSecret ? credentials.apiSecret.trim() : ''

    const startConcurr = async () => {
      await new Promise(r => setTimeout(r, 100))
      console.log(`[LIVE_BACKFILL_CONCURRENCY] liveWorker=${this.hsmClient?.authenticated ? 'connected_idle' : 'connecting'} backfillWorker=running`)
    }

    if (credentials.accessToken) {
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
    
    return { accountId: 'FYERS_USER', accessToken: this.accessToken }
  }

  async disconnect(): Promise<void> {
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

      let totalProgress = 15
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        let retries = 3
        while (retries > 0) {
          try {
            this.emit('master_sync_progress', { brokerId: bId, progress: totalProgress, text: `Downloading ${src.ex} symbols...` })
            this.emit('log_entry', { level: 'info', component: 'FyersAdapter', message: `Downloading ${src.ex} contracts to disk...` })
            
            const res = await fetch(src.url)
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer())
              const filePath = path.join(masterDir, src.file)
              await fs.promises.writeFile(filePath, buffer)
              totalProgress += 25
              this.emit('master_sync_progress', { brokerId: bId, progress: totalProgress, text: `Updated ${src.ex} symbols.` })
              this.emit('log_entry', { level: 'info', component: 'FyersAdapter', message: `Saved ${src.ex} contracts (${Math.round(buffer.length / 1024)} KB) to disk.` })
              break // Success, exit retry loop
            } else {
              console.error(`Failed to fetch ${src.ex} CSV: ${res.statusText}`)
              retries--
              if (retries === 0) throw new Error(`HTTP ${res.status} ${res.statusText}`)
            }
          } catch (e) {
            console.error(`Failed to download ${src.ex} contracts (retries left: ${retries - 1}):`, e)
            retries--
            if (retries > 0) await new Promise(r => setTimeout(r, 2000))
          }
        }
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
    
    let exFilter: string | null = null
    let instTypeFilter: number | null = null
    if (exchange && exchange !== 'ALL') {
      if (exchange.includes('-')) {
        const parts = exchange.split('-')
        exFilter = parts[0]
        instTypeFilter = parseInt(parts[1])
      } else {
        exFilter = exchange
      }
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
                 const rawInstType = parseInt(parts[2]) || 0
                 
                 if (instTypeFilter !== null && rawInstType !== instTypeFilter) continue
                 
                 let instType = src.type
                 const cleanId = id.replace(/^[A-Z]+:/, '')
                 if (src.ex === 'NFO') {
                   if (cleanId.endsWith('CE') || cleanId.endsWith('PE')) instType = 'OPT'
                   else instType = 'FUT'
                 }
                 
                 results.push({
                   instrumentId: id,
                   exchange: src.ex,
                   ticker: src.type === 'EQ' ? sym : cleanId,
                   instrumentType: instType as any,
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

    const url = `https://api-t1.fyers.in/data/history?symbol=${encodeURIComponent(safeToken)}&resolution=${resolution}&date_format=1&range_from=${fromStr}&range_to=${toStr}&cont_flag=0`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

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
      } else if (data.code === 429 || (data.message && String(data.message).includes('request limit'))) {
        console.warn(`[FyersAdapter] Rate limit 429 reached for ${instrumentToken}`)
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
          throw genericErr;
        }
    } catch (e: any) {
        if (e?.code === 429 || e?.message?.includes('429') || e?.message?.includes('request limit')) {
          throw e;
        }
        if (e?.code === -16 || e?.message?.includes('Auth') || e?.message?.includes('authenticate')) {
          throw e;
        }
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
            // Only add Future contracts from NSE_FO.csv (ignore Options)
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

  private async getHsmTokens(tickers: string[]): Promise<string[]> {
    await this.loadMasterCache();
    const results: string[] = [];
    let mapped = 0;
    const unmapped: string[] = [];

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
