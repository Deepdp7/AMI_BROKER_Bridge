/**
 * Symbol lists and history for platforms that can't take a live feed:
 *
 *   TradingView  watchlist file: plain text, "NSE:RELIANCE,NSE:TCS" (its own spelling: "-" and "&"
 *                become "_", indices have their own names, a future is its continuous contract
 *                "RELIANCE1!" (front month), "RELIANCE2!" (next)). Imported there from the
 *                watchlist menu → Import list. Options are left out (TradingView has no NSE
 *                option contracts by these names).
 *   Chartink     a scan's "Download CSV" (columns Sr., Stock Name, Symbol, Links, % Chg, Price,
 *                Volume) → the symbols, to add to DataBridge
 *   NinjaTrader  <SYMBOL>.Last.txt, one 1-minute bar per line: "yyyyMMdd HHmmss;open;high;low;close;volume",
 *                time = the bar's end, India time. Tools → Import → Historical Data.
 *   CSV          Date,Time,Open,High,Low,Close,Volume,OI (India time, bar start) for anything else
 *                (MetaStock's Downloader, Investar, Python…)
 */
import fs from 'fs'
import path from 'path'
import { stmts } from '../db'
import { readBarsCsv } from '../db/reader'
import { MONTHS } from '../brokers/adapters/symbolKey'
import { splitCsvLine } from '../brokers/adapters/InstrumentMaster'
import { userFolder, safeFileName } from './files'

const IST_MS = 19_800_000

interface StoredSymbol { ticker: string; exchange: string; type: string }

export function storedSymbols(): StoredSymbol[] {
  const seen = new Set<string>()
  const out: StoredSymbol[] = []
  for (const s of stmts.getSymbols.all() as any[]) {
    const ticker = s.amiBrokerTicker
    if (!ticker || seen.has(ticker)) continue
    seen.add(ticker)
    out.push({ ticker, exchange: String(s.exchange || 'NSE').toUpperCase(), type: String(s.instrumentType || 'EQ').toUpperCase() })
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

// ---- TradingView ----

const TV_INDICES: Record<string, string> = {
  NIFTY50: 'NSE:NIFTY', NIFTY: 'NSE:NIFTY', NIFTYBANK: 'NSE:BANKNIFTY', BANKNIFTY: 'NSE:BANKNIFTY',
  FINNIFTY: 'NSE:CNXFINANCE', MIDCPNIFTY: 'NSE:NIFTY_MID_SELECT', NIFTYNXT50: 'NSE:NIFTYJR',
  INDIAVIX: 'NSE:INDIAVIX', SENSEX: 'BSE:SENSEX', BANKEX: 'BSE:BANKEX',
}

const FUT_RE = /^(.+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/
const OPT_RE = /\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[1-9OND]\d{2})\d+(?:\.\d+)?(?:CE|PE)$/

/** Last Tuesday of a month (NSE's monthly F&O expiry), as an IST date number YYYYMMDD */
function lastTuesday(year: number, month0: number): number {
  const last = new Date(Date.UTC(year, month0 + 1, 0))
  const back = (last.getUTCDay() - 2 + 7) % 7
  return year * 10000 + (month0 + 1) * 100 + (last.getUTCDate() - back)
}

/** "RELIANCE26NOVFUT" → "RELIANCE1!" (front month), "RELIANCE2!"…; null when expired */
export function tvContinuous(ticker: string, nowMs = Date.now()): string | null {
  const m = FUT_RE.exec(ticker)
  if (!m) return null
  const ist = new Date(nowMs + IST_MS)
  const year = ist.getUTCFullYear(), month0 = ist.getUTCMonth()
  const today = year * 10000 + (month0 + 1) * 100 + ist.getUTCDate()
  // After this month's expiry the next month is the front one
  const frontIndex = year * 12 + month0 + (today > lastTuesday(year, month0) ? 1 : 0)
  const contractIndex = (2000 + Number(m[2])) * 12 + MONTHS.indexOf(m[3])
  const n = contractIndex - frontIndex + 1
  return n >= 1 ? `${m[1]}${n}!` : null
}

/** TradingView's name for a DataBridge symbol, or null when TradingView has no such symbol */
export function tradingViewSymbol(s: StoredSymbol, nowMs = Date.now()): string | null {
  const tv = (name: string) => name.replace(/[-&]/g, '_')
  if (s.type === 'INDEX' || TV_INDICES[s.ticker]) return TV_INDICES[s.ticker] || `${s.exchange === 'BSE' ? 'BSE' : 'NSE'}:${tv(s.ticker)}`
  if (OPT_RE.test(s.ticker) || s.type === 'OPT') return null
  if (FUT_RE.test(s.ticker) || s.type === 'FUT') {
    const cont = tvContinuous(s.ticker, nowMs)
    if (!cont) return null
    const exchange = s.exchange === 'MCX' ? 'MCX' : s.exchange === 'BFO' ? 'BSE' : 'NSE'
    return `${exchange}:${tv(cont)}`
  }
  return `${s.exchange === 'BSE' ? 'BSE' : 'NSE'}:${tv(s.ticker)}`
}

export function tradingViewWatchlist(symbols: StoredSymbol[], nowMs = Date.now()): { text: string; skipped: string[] } {
  const names: string[] = []
  const skipped: string[] = []
  for (const s of symbols) {
    const name = tradingViewSymbol(s, nowMs)
    if (name) { if (!names.includes(name)) names.push(name) } else skipped.push(s.ticker)
  }
  return { text: names.join(','), skipped }
}

export async function writeTradingViewWatchlist(): Promise<{ file: string; count: number; skipped: string[] }> {
  const { text, skipped } = tradingViewWatchlist(storedSymbols())
  const file = path.join(await userFolder('TradingView'), 'DataBridge watchlist.txt')
  await fs.promises.writeFile(file, text)
  return { file, count: text ? text.split(',').length : 0, skipped }
}

/** Chartink's name for a symbol: cash market only, so a future or option opens its underlying; no MCX */
export function chartinkSymbol(s: StoredSymbol): string | null {
  if (s.exchange === 'MCX') return null
  const base = s.ticker.toUpperCase().replace(OPT_RE, '').replace(/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/, '').replace(/-FUT$/, '')
  return ({ NIFTY50: 'NIFTY', NIFTYBANK: 'BANKNIFTY' } as Record<string, string>)[base] || base || null
}

/** A symbol's chart page on each website (null where the site doesn't have it) */
export function symbolLinks(s: StoredSymbol): { tradingview: string | null; chartink: string | null } {
  const tv = tradingViewSymbol(s)
  const ck = chartinkSymbol(s)
  return {
    tradingview: tv ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}` : null,
    chartink: ck ? `https://chartink.com/stocks-new?symbol=${encodeURIComponent(ck)}` : null,
  }
}

// ---- Chartink ----

/** Symbols in a Chartink scan export (its CSV), or in pasted text (one per line or comma-separated) */
export function parseChartinkSymbols(text: string): string[] {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  const header = splitCsvLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const col = header.findIndex(h => h === 'symbol' || h === 'nsecode' || h === 'nse code')
  const out: string[] = []
  const add = (s: string) => {
    const clean = s.trim().replace(/^"|"$/g, '').replace(/^NSE:/i, '').toUpperCase()
    if (/^[A-Z0-9&\-_.]{1,30}$/.test(clean) && !out.includes(clean)) out.push(clean)
  }
  if (col >= 0) {
    for (const line of lines.slice(1)) add(splitCsvLine(line)[col] || '')
  } else {
    // Not Chartink's CSV: symbols as typed or pasted
    for (const line of lines) for (const part of line.split(/[,\t;\s]+/)) if (part) add(part)
  }
  return out
}

// ---- History files ----

/** India date and time of a unix second: ["20261027", "091500"] */
function istParts(sec: number): [string, string] {
  const iso = new Date(sec * 1000 + IST_MS).toISOString()
  return [iso.slice(0, 10).replace(/-/g, ''), iso.slice(11, 19).replace(/:/g, '')]
}

const MAX_BARS = 2_000_000

/** NinjaTrader 8 lines from the engine's bar CSV ("ts,o,h,l,c,v[,oi]") */
export function ninjaLines(barsCsv: string): string {
  const out: string[] = []
  for (const line of barsCsv.split('\n')) {
    const f = line.split(',')
    if (f.length < 6) continue
    const [d, t] = istParts(Number(f[0]) + 60) // NinjaTrader stamps a bar at its end
    out.push(`${d} ${t};${f[1]};${f[2]};${f[3]};${f[4]};${Math.round(Number(f[5]) || 0)}`)
  }
  return out.join('\n')
}

/** Plain CSV lines with a header */
export function csvLines(barsCsv: string): string {
  const out = ['Date,Time,Open,High,Low,Close,Volume,OI']
  for (const line of barsCsv.split('\n')) {
    const f = line.split(',')
    if (f.length < 6) continue
    const [d, t] = istParts(Number(f[0]))
    out.push(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)},${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4)},${f[1]},${f[2]},${f[3]},${f[4]},${f[5]},${f[6] || 0}`)
  }
  return out.join('\n')
}

/** Writes every symbol's 1-minute history for `kind`; returns the folder and the file count */
export async function exportHistory(kind: 'ninjatrader8' | 'csv', tickers?: string[]): Promise<{ folder: string; files: number; bars: number }> {
  const folder = await userFolder(kind === 'ninjatrader8' ? 'NinjaTrader' : 'CSV')
  const wanted = tickers?.length ? new Set(tickers) : null
  let files = 0, bars = 0
  for (const s of storedSymbols()) {
    if (wanted && !wanted.has(s.ticker)) continue
    const csv = await readBarsCsv(s.ticker, 0, MAX_BARS)
    if (!csv) continue
    const body = kind === 'ninjatrader8' ? ninjaLines(csv) : csvLines(csv)
    const name = kind === 'ninjatrader8' ? `${safeFileName(s.ticker)}.Last.txt` : `${safeFileName(s.ticker)}.csv`
    await fs.promises.writeFile(path.join(folder, name), body)
    files++
    bars += csv.split('\n').length
  }
  return { folder, files, bars }
}
