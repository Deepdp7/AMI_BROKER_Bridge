/**
 * Charting / trading platforms (see platforms/registry.ts):
 *
 *   GET  /api/platforms                  every platform, what was found on this PC, the user's choice
 *   PUT  /api/platforms/chosen           {ids} the platforms the user works with
 *   GET  /api/platforms/quotes           every symbol's quote as lines (the Excel connector reads it)
 *   GET  /api/platforms/bars             ?ticker&tf&n: bars of a timeframe, newest first (Excel's BAR cells)
 *   POST /api/platforms/:id/install      {instance?} puts DataBridge's plugin / connector in place
 *   POST /api/platforms/:id/open         {instance?} starts the platform; {ticker} opens a website on that symbol's chart
 *   POST /api/platforms/excel/sheet      writes the live sheet and opens it in Excel
 *   POST /api/platforms/csv/live         {on} keeps the CSV folder up to date every minute
 *   POST /api/platforms/tradingview/watchlist   writes the TradingView watchlist file
 *   POST /api/platforms/:id/export       ninjatrader8 | metastock | csv: 1-minute history files
 *   POST /api/platforms/chartink/import  {brokerId, text, as: 'EQ' | 'FUT'} adds a scan's stocks
 *   GET  /api/platforms/links/:ticker    the symbol's TradingView and Chartink pages
 *   POST /api/platforms/reveal           {path} shows a file DataBridge wrote, in Explorer
 */
import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { execFile, spawn } from 'child_process'
import { getAllSettings, upsertSettings, stmts, DATA_DIR } from '../../db'
import { brokerManager } from '../../brokers/BrokerManager'
import { addSymbolsToBroker } from '../../brokers/addSymbols'
import { detectPlatforms, PLATFORM_IDS, type PlatformInfo, type PlatformId } from '../../platforms/registry'
import { quoteLines } from '../../platforms/quotes'
import { barLines, timeframeOf } from '../../platforms/bars'
import { liveCsvOn, setLiveCsv, startLiveCsv, updateCsvFiles } from '../../platforms/liveCsv'
import { installExcelConnector, writeLiveSheet } from '../../platforms/excel'
import { installMt5Connector, setMt5Targets } from '../../platforms/mt5'
import { writeTradingViewWatchlist, exportHistory, parseChartinkSymbols, symbolLinks, storedSymbols } from '../../platforms/exports'
import { connectorSource } from '../../platforms/files'
import { documentsDir } from '../../platforms/windows'
import { nseSymbols } from '../../lib/logos'
import { isKnownIndexName } from '../../brokers/adapters/symbolKey'

const router = Router()

// Looking through the registry and drives takes a second or two: kept for a while. Once it is a
// minute old the old answer is still given at once while a new look runs behind it (nothing waits
// on reg.exe), unless a new look is asked for ("Look again", install).
let cache: { at: number; list: Promise<PlatformInfo[]>; ready: boolean } | null = null
export function platformsCached(refresh = false): Promise<PlatformInfo[]> {
  const stale = !cache || Date.now() - cache.at > 60_000
  if (refresh || stale) {
    const previous = cache
    const list = detectPlatforms()
    const entry = { at: Date.now(), list, ready: false }
    list.then(l => { entry.ready = true; applyBridges(l) }, () => {})
    if (!refresh && previous?.ready) {
      // Swapped in only once it has an answer
      list.then(() => { if (cache === previous) cache = entry }, () => { if (cache === previous) previous.at = Date.now() })
      previous.at = Date.now() // one new look at a time
      return previous.list
    }
    cache = entry
    list.catch(() => { if (cache === entry) cache = null })
  }
  return cache!.list
}

/** Turns the file bridges on for platforms that have DataBridge's connector */
function applyBridges(list: PlatformInfo[]) {
  const mt5 = list.find(p => p.id === 'metatrader5')
  setMt5Targets((mt5?.instances || []).filter(i => i.connectorInstalled && i.connectorFolder).map(i => i.connectorFolder!))
}

/** At engine start (and every 10 minutes): which platforms need files kept current */
export function startPlatformBridges() {
  startLiveCsv()
  // NSE's company list (for symbol logos) is fetched now, so the first cards don't wait for it
  void nseSymbols()
  setTimeout(() => { platformsCached(true).catch(() => {}) }, 10_000).unref()
  setInterval(() => { platformsCached(true).catch(() => {}) }, 10 * 60_000).unref()
}

const chosen = (): PlatformId[] => {
  const v = (getAllSettings() as any).platforms
  return Array.isArray(v) ? v.filter((id: string) => (PLATFORM_IDS as string[]).includes(id)) : []
}

router.get('/', async (req, res) => {
  try {
    const platforms = await platformsCached(req.query.refresh === '1')
    const settings = getAllSettings() as any
    res.json({ platforms, chosen: chosen(), asked: Array.isArray(settings.platforms), csvLive: liveCsvOn() })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

router.put('/chosen', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: any) => (PLATFORM_IDS as string[]).includes(id)) : null
  if (!ids) return res.status(400).json({ error: 'ids[] required' })
  upsertSettings({ platforms: ids } as any)
  res.json({ chosen: ids })
})

// Polled twice a second by Excel: plain text, and not written to the request log (app.ts)
router.get('/quotes', (_req, res) => {
  res.type('text/plain').send(quoteLines())
})

// Bars of any timeframe, newest first (Excel's =RTD(…,"BAR",…) cells); not logged either
router.get('/bars', async (req, res) => {
  const tf = timeframeOf(String(req.query.tf || '1m'))
  if (!tf) return res.status(400).type('text/plain').send('Timeframe: 1m, 5m, 15m, 30m, 1h or 1d')
  try {
    const lines = await barLines(String(req.query.ticker || ''), tf, Number(req.query.n) || 100)
    if (lines === null) return res.status(404).type('text/plain').send('Not in DataBridge')
    res.type('text/plain').send(lines)
  } catch (e: any) {
    res.status(500).type('text/plain').send(e?.message || String(e))
  }
})

function instanceOf(list: PlatformInfo[], id: string, index: unknown): { p?: PlatformInfo; inst?: PlatformInfo['instances'][number] } {
  const p = list.find(x => x.id === id)
  if (!p) return {}
  const i = Number(index) || 0
  return { p, inst: p.instances[i] || p.instances[0] }
}

/** Copies a file, asking Windows for administrator rights when the folder needs them (Program Files) */
async function copyMaybeElevated(source: string, target: string): Promise<'copied' | 'elevated'> {
  try {
    await fs.promises.copyFile(source, target)
    return 'copied'
  } catch (err: any) {
    if (err?.code === 'EBUSY') throw new Error('The file is in use: close the program first, then try again')
    if (err?.code !== 'EPERM' && err?.code !== 'EACCES') throw err
  }
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  const inner = `Copy-Item -LiteralPath ${q(source)} -Destination ${q(target)} -Force`
  const outer = `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',${q(inner)}`
  await new Promise<void>((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', outer], { windowsHide: true, timeout: 120_000 },
    err => err ? reject(new Error('Windows did not allow the copy (administrator permission was refused)')) : resolve()))
  if (!fs.existsSync(target) || fs.statSync(target).size !== fs.statSync(source).size) throw new Error('The copy did not happen (administrator permission was refused?)')
  return 'elevated'
}

router.post('/:id/install', async (req, res) => {
  try {
    const list = await platformsCached(true)
    const { p, inst } = instanceOf(list, req.params.id, req.body?.instance)
    if (!p) return res.status(404).json({ error: 'Unknown platform' })
    if (!inst) return res.status(400).json({ error: `${p.name} was not found on this PC` })
    let message = ''
    if (p.id === 'amibroker') {
      const source = connectorSource('DataBridgePro.dll')
      if (!source) return res.status(400).json({ error: 'The AmiBroker plugin is not in this DataBridge Pro installation; reinstall DataBridge Pro' })
      const target = path.join(inst.connectorFolder || path.join(inst.folder, 'Plugins'), 'DataBridgePro.dll')
      await copyMaybeElevated(source, target)
      message = `Plugin installed in ${path.dirname(target)}. Restart AmiBroker, then File → Database Settings → Data source: DataBridge Pro.`
    } else if (p.id === 'excel') {
      const bits = /32/.test(inst.label || p.note || '') ? 32 : 64
      await installExcelConnector(bits)
      message = 'Live prices installed for Excel. In any cell: =RTD("DataBridge.RTD",,"RELIANCE","LTP")'
    } else if (p.id === 'metatrader5') {
      await installMt5Connector(inst)
      message = 'Connector installed. In MetaTrader 5: Navigator → Services → DataBridge → Start (once). Your symbols appear under Custom\\DataBridge.'
    } else {
      return res.status(400).json({ error: `${p.name} has nothing to install` })
    }
    const fresh = await platformsCached(true)
    res.json({ ok: true, message, platform: fresh.find(x => x.id === p.id) })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

router.post('/:id/open', async (req, res) => {
  try {
    // A symbol's chart on a website: nothing on the PC to look for, so opened at once
    const site = req.params.id
    if (req.body?.ticker && (site === 'chartink' || site === 'tradingview')) {
      const ticker = String(req.body.ticker)
      const link = symbolLinks(symbolFor(ticker))[site]
      if (!link) return res.status(400).json({ error: `${site === 'chartink' ? 'Chartink' : 'TradingView'} has no chart for ${ticker}` })
      openUrl(link)
      return res.json({ ok: true, url: link })
    }
    const list = await platformsCached()
    const { p, inst } = instanceOf(list, req.params.id, req.body?.instance)
    if (!p) return res.status(404).json({ error: 'Unknown platform' })
    if (p.kind === 'web') {
      openUrl(p.website)
      return res.json({ ok: true, url: p.website })
    }
    if (!inst?.exe) return res.status(400).json({ error: `${p.name} was not found on this PC` })
    spawn(inst.exe, [], { cwd: inst.folder, detached: true, stdio: 'ignore' }).unref()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

/**
 * Opens a web page in the default browser. Not explorer.exe: it reads "?" as a file wildcard, so
 * chartink.com/stocks-new?symbol=TCS opened the Documents folder instead.
 */
export function openUrl(url: string) {
  if (!/^https:\/\//i.test(url)) throw new Error('Not a web address')
  spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

/** Opens a file with its program (Excel for .xlsx) */
const openFile = (file: string) => spawn('explorer.exe', [file], { detached: true, stdio: 'ignore' }).unref()

router.post('/excel/sheet', async (_req, res) => {
  try {
    const file = await writeLiveSheet()
    if (_req.body?.open !== false) openFile(file)
    res.json({ ok: true, file })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

// {on}: keep Documents\DataBridge Pro\CSV up to date every minute (on: brought up to date now)
router.post('/csv/live', async (req, res) => {
  try {
    const on = req.body?.on === true
    setLiveCsv(on)
    const r = on ? await updateCsvFiles() : null
    res.json({ ok: true, on, folder: r?.folder, added: r?.added ?? 0 })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

router.post('/tradingview/watchlist', async (_req, res) => {
  try {
    res.json({ ok: true, ...(await writeTradingViewWatchlist()) })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

router.post('/:id/export', async (req, res) => {
  const kind = req.params.id === 'ninjatrader8' ? 'ninjatrader8' : req.params.id === 'csv' || req.params.id === 'metastock' || req.params.id === 'sierrachart' ? 'csv' : null
  if (!kind) return res.status(400).json({ error: 'Nothing to export for this platform' })
  try {
    const tickers = Array.isArray(req.body?.tickers) ? req.body.tickers.map(String) : undefined
    res.json({ ok: true, ...(await exportHistory(kind, tickers)) })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

router.post('/chartink/import', async (req, res) => {
  try {
    const { brokerId, text, as } = req.body || {}
    const parsed = parseChartinkSymbols(String(text || ''))
    if (!parsed.length) return res.status(400).json({ error: 'No symbols found. Paste Chartink\'s scan CSV (Download csv) or a list of symbols.' })
    // Only real NSE names (or an index): words of pasted text ("TICKER", "TYPE") are not symbols,
    // and once added they were streamed and downloaded and the broker refused them every time
    const listed = await nseSymbols()
    const names = listed.size ? parsed.filter(n => listed.has(n) || isKnownIndexName(n)) : parsed
    const unknown = parsed.filter(n => !names.includes(n))
    if (!names.length) {
      return res.status(400).json({
        error: unknown.length
          ? `None of these is an NSE symbol: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}. Paste Chartink's scan CSV (Download csv) or symbols like TCS, RELIANCE.`
          : 'No symbols found. Paste Chartink\'s scan CSV (Download csv) or a list of symbols.',
        unknown,
      })
    }
    const broker = stmts.getBrokerById.get(String(brokerId || '')) as any
    if (!broker) return res.status(400).json({ error: 'Choose the broker account to add them to' })
    const have = new Set(storedSymbols().map(s => s.ticker))
    let symbols: Array<{ ticker: string; instrumentId?: string; exchange: string; instrumentType: string }>
    const missing: string[] = []
    if (as === 'FUT') {
      // This month's future of each stock (the nearest one not yet expired)
      const adapter = brokerManager.getAdapter(broker.id) as any
      if (!adapter?.listFutures) return res.status(400).json({ error: 'This broker can\'t list its futures; connect it first' })
      const futures = (await adapter.listFutures('stock')).concat(await adapter.listFutures('index'))
      const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10)
      symbols = []
      for (const name of names) {
        // The contract's own name (NAME + YY + MON + FUT), the same at every broker
        const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{2}[A-Z]{3}FUT$`)
        const near = futures
          .filter((f: any) => re.test(String(f.ticker || '').toUpperCase()) && (f.expiry || '') >= today)
          .sort((a: any, b: any) => a.expiry.localeCompare(b.expiry))[0]
        if (near) symbols.push({ ticker: near.ticker, instrumentId: near.instrumentId, exchange: near.exchange, instrumentType: 'FUT' })
        else missing.push(name)
      }
    } else {
      symbols = names.map(n => ({ ticker: n, exchange: 'NSE', instrumentType: 'EQ' }))
    }
    const fresh = symbols.filter(s => !have.has(s.ticker))
    const result = fresh.length ? await addSymbolsToBroker(broker.id, fresh) : { added: 0, total: 0 }
    res.json({ ok: true, found: names.length, added: result.added, already: symbols.length - fresh.length, noFuture: missing, unknown })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

/** A tracked symbol (its exchange and type), or an NSE share by that name */
const symbolFor = (ticker: string) =>
  storedSymbols().find(x => x.ticker === ticker) || { ticker: ticker.toUpperCase(), exchange: 'NSE', type: 'EQ' }

router.get('/links/:ticker', (req, res) => {
  res.json(symbolLinks(symbolFor(req.params.ticker)))
})

// Only files DataBridge itself writes (Documents\DataBridge Pro, its data folder)
router.post('/reveal', async (req, res) => {
  try {
    const target = path.resolve(String(req.body?.path || ''))
    const allowed = [path.join(await documentsDir(), 'DataBridge Pro'), DATA_DIR].map(p => path.resolve(p).toLowerCase())
    if (!allowed.some(a => target.toLowerCase().startsWith(a)) || !fs.existsSync(target)) return res.status(400).json({ error: 'Not a DataBridge file' })
    const isDir = fs.statSync(target).isDirectory()
    spawn('explorer.exe', isDir ? [target] : [`/select,${target}`], { detached: true, stdio: 'ignore' }).unref()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) })
  }
})

export default router
