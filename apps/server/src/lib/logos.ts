/**
 * Company logos for the symbol cards.
 *
 * A symbol's logo is looked for on three servers, in this order, until one has it:
 *   1. Dhan's image server, by NSE symbol (about 98% of NSE stocks, plus ETFs and the main indices)
 *   2. Groww's image server, by the company's ISIN
 *   3. TradingView's image server, by company name ("Kotak Mahindra Bank Limited" → kotak-mahindra-bank)
 * The ISIN and company name come from NSE's public equity list (EQUITY_L.csv), which only the 2nd
 * and 3rd need. Futures and options use their underlying's logo (RELIANCE26NOVFUT → RELIANCE).
 * What no server has (MCX commodities, BSE-only companies) gets a drawn tile in the app.
 *
 * Everything is kept on disk, so a picture is fetched once and the app works offline after that:
 *   <data>/logos/equity_l.csv         NSE's list, renewed after a day (an old copy is used when NSE can't be reached)
 *   <data>/logos/<NAME>.png|svg       the picture
 *   <data>/logos/<NAME>.none          "no picture anywhere" marker, tried again after a week
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../db'

const LIST_URL = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv'
const DHAN_URL = (symbol: string) => `https://images.dhan.co/symbol/${encodeURIComponent(symbol)}.png`
const GROWW_URL = (isin: string) => `https://assets-netstorage.groww.in/stock-assets/logos/${isin}.png`
const TRADINGVIEW_URL = (slug: string) => `https://s3-symbol-logo.tradingview.com/${slug}--big.svg`
const DAY_MS = 86_400_000
const NO_LOGO_MS = 7 * DAY_MS
const ISIN_RE = /^IN[A-Z0-9]{10}$/

const dir = () => path.join(DATA_DIR, 'logos')

const MONTHS = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC'
const FUT_RE = new RegExp(`\\d{2}(${MONTHS})FUT$`)
const OPT_RE = new RegExp(`\\d{2}(${MONTHS}|[1-9OND]\\d{2})\\d+(\\.\\d+)?(CE|PE)$`)

/** DataBridge's index names → the NSE symbol the picture servers use */
const INDEX_SYMBOLS: Record<string, string> = { NIFTY50: 'NIFTY', NIFTYBANK: 'BANKNIFTY' }

export interface Logo { data: Buffer; type: 'image/png' | 'image/svg+xml' }

/** "RELIANCE26NOVFUT" → "RELIANCE"; "TCS" stays "TCS" */
export function underlyingOf(ticker: string): string {
  return ticker.toUpperCase().trim().replace(FUT_RE, '').replace(OPT_RE, '').replace(/-FUT$/, '')
}

export interface EquityList {
  /** SYMBOL → ISIN */
  isin: Map<string, string>
  /** SYMBOL → company name */
  name: Map<string, string>
}

/** NSE's list ("SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, …") */
export function parseEquityList(csv: string): EquityList {
  const out: EquityList = { isin: new Map(), name: new Map() }
  const lines = csv.split(/\r?\n/)
  const head = (lines.shift() || '').split(',').map(h => h.trim().toUpperCase())
  const sym = head.indexOf('SYMBOL')
  const isin = head.findIndex(h => h.startsWith('ISIN'))
  const name = head.findIndex(h => h.startsWith('NAME'))
  if (sym < 0 || isin < 0) return out
  for (const line of lines) {
    const p = line.split(',')
    const s = (p[sym] || '').trim().toUpperCase()
    const i = (p[isin] || '').trim().toUpperCase()
    if (!s || !ISIN_RE.test(i)) continue
    out.isin.set(s, i)
    if (name >= 0 && p[name]) out.name.set(s, p[name].trim())
  }
  return out
}

/** The list's symbol for a ticker: a name with a hyphen is tried whole first ("BAJAJ-AUTO"), a series suffix after ("GOLDSTAR-ST") */
export function listSymbolFor(ticker: string, list: EquityList): string | null {
  const name = underlyingOf(ticker)
  if (!name) return null
  if (list.isin.has(name)) return name
  const bare = name.replace(/-[A-Z0-9]{1,2}$/, '')
  return list.isin.has(bare) ? bare : null
}

/** The ISIN of a ticker's company, or null (index, commodity, not on NSE) */
export function isinFor(ticker: string, list: EquityList): string | null {
  const s = listSymbolFor(ticker, list)
  return s ? list.isin.get(s)! : null
}

/** "Dr. Reddy's Laboratories Limited" → "dr-reddys-laboratories" (TradingView's name for a logo) */
export function slugOf(company: string): string {
  return company.toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/\b(limited|ltd)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The NSE symbol a ticker's logo is looked up by ("NIFTYBANK" → BANKNIFTY, "RELIANCE26NOVFUT" → RELIANCE), or null */
export function logoSymbolFor(ticker: string): string | null {
  const name = underlyingOf(ticker)
  if (!name || !/^[A-Z0-9&_.-]{1,30}$/.test(name)) return null
  return INDEX_SYMBOLS[name] || name
}

/** A file name for a symbol ("M&M" → "M_26M"): reversible, and safe on Windows */
const fileKey = (symbol: string) => symbol.replace(/[^A-Z0-9_.-]/g, c => `_${c.charCodeAt(0).toString(16)}`)

let listPromise: Promise<EquityList> | null = null

async function loadList(): Promise<EquityList> {
  const file = path.join(dir(), 'equity_l.csv')
  let text = ''
  let fresh = false
  try {
    text = await fs.promises.readFile(file, 'utf8')
    fresh = Date.now() - (await fs.promises.stat(file)).mtimeMs < DAY_MS
  } catch { /* not downloaded yet */ }
  if (!fresh) {
    try {
      const res = await fetch(LIST_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) })
      if (res.ok) {
        const body = await res.text()
        if (parseEquityList(body).isin.size > 100) {
          await fs.promises.mkdir(dir(), { recursive: true })
          await fs.promises.writeFile(file, body)
          text = body
        }
      }
    } catch (err: any) {
      console.warn(`[Logos] NSE's list could not be fetched (${err?.message || err})${text ? ', using the saved copy' : ''}`)
    }
  }
  return parseEquityList(text)
}

/** NSE's list, read once per run (and again after a day); an empty answer is not kept */
function equityList(): Promise<EquityList> {
  if (!listPromise) {
    const p = loadList()
    listPromise = p
    p.then(l => {
      if (!l.isin.size) { if (listPromise === p) listPromise = null }
      else setTimeout(() => { if (listPromise === p) listPromise = null }, DAY_MS).unref()
    }, () => { if (listPromise === p) listPromise = null })
  }
  return listPromise
}

/** Every symbol listed on NSE's cash market (empty when the list couldn't be had: then nothing can be checked) */
export async function nseSymbols(): Promise<Set<string>> {
  try {
    return new Set((await equityList()).isin.keys())
  } catch {
    return new Set()
  }
}

type Fetched = Logo | 'none' | 'error'

/** One picture from one server: 'none' when it says it has no such picture, 'error' when it couldn't tell */
async function fetchPicture(url: string, type: Logo['type']): Promise<Fetched> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) })
    if (res.status === 404 || res.status === 403) return 'none'
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return 'error'
    const data = Buffer.from(await res.arrayBuffer())
    // A tiny reply is an error page or a blank pixel, not a logo
    return data.length < 100 ? 'error' : { data, type }
  } catch {
    return 'error' // offline: tried again next time
  }
}

/**
 * "Not now" as opposed to "none": a server or NSE's list couldn't be reached (the engine has just
 * started, the PC is offline). The route answers 503 so the app asks again later, where a 404
 * means the company really has no logo and is final.
 */
export class LogoUnavailable extends Error {}

const inFlight = new Map<string, Promise<Logo | null>>()

/** Looks on each server in turn; null when every one says it has none, throws LogoUnavailable when one couldn't tell */
async function findLogo(symbol: string): Promise<Logo | null> {
  const results: Fetched[] = []
  const dhan = await fetchPicture(DHAN_URL(symbol), 'image/png')
  if (typeof dhan !== 'string') return dhan
  results.push(dhan)

  // The other two need NSE's list (ISIN, company name)
  const list = await equityList()
  if (!list.isin.size) results.push('error')
  else {
    const listed = list.isin.has(symbol) ? symbol : symbol.replace(/-[A-Z0-9]{1,2}$/, '')
    const isin = list.isin.get(listed)
    if (isin) {
      const groww = await fetchPicture(GROWW_URL(isin), 'image/png')
      if (typeof groww !== 'string') return groww
      results.push(groww)
      const slug = slugOf(list.name.get(listed) || '')
      if (slug) {
        const tv = await fetchPicture(TRADINGVIEW_URL(slug), 'image/svg+xml')
        if (typeof tv !== 'string') return tv
        results.push(tv)
      }
    }
    // Not a listed company (a commodity, an index Dhan doesn't have): nothing more to ask
  }
  if (results.some(r => r === 'error')) throw new LogoUnavailable('The logo servers could not be reached')
  return null
}

/** The logo picture of a ticker's company, or null when it has none; throws LogoUnavailable when it can't tell yet */
export async function logoFor(ticker: string): Promise<Logo | null> {
  const symbol = logoSymbolFor(ticker)
  if (!symbol) return null
  const key = fileKey(symbol)
  const png = path.join(dir(), `${key}.png`)
  const svg = path.join(dir(), `${key}.svg`)
  const none = path.join(dir(), `${key}.none`)
  try { return { data: await fs.promises.readFile(png), type: 'image/png' } } catch { /* not saved yet */ }
  try { return { data: await fs.promises.readFile(svg), type: 'image/svg+xml' } } catch { /* not saved yet */ }
  try {
    if (Date.now() - (await fs.promises.stat(none)).mtimeMs < NO_LOGO_MS) return null
  } catch { /* no marker */ }
  const running = inFlight.get(key)
  if (running) return running
  const job = (async () => {
    try {
      const found = await findLogo(symbol)
      await fs.promises.mkdir(dir(), { recursive: true })
      if (found) await fs.promises.writeFile(found.type === 'image/png' ? png : svg, found.data)
      else await fs.promises.writeFile(none, '')
      return found
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, job)
  return job
}
