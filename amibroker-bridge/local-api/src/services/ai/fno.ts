/**
 * fno.ts — Futures & Options support for the AI assistant.
 *
 *  - Instrument catalogue from the Fyers master files: find equities and futures by name or
 *    ticker, and say whether each is already tracked in DataBridge.
 *  - Futures: current/next contracts per underlying, F&O stock list.
 *  - Options: live option-chain summary (PCR, max-OI strikes = support/resistance, OI build-up).
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR, stmts } from '../../db'
import { brokerManager } from '../BrokerManager'
import { companyName } from './companyNames'
import { istString } from './marketData'

export interface Instrument {
  ticker: string          // AmiBroker ticker (RELIANCE, RELIANCE26OCTFUT)
  name: string
  exchange: 'NSE' | 'NFO'
  instrumentType: 'EQ' | 'FUT'
  instrumentId: string    // broker symbol (NSE:RELIANCE-EQ, NSE:RELIANCE26OCTFUT)
  underlying?: string     // futures only
  expiry?: string         // futures only, YYYY-MM-DD
  lotSize?: number
}

const INDEX_UNDERLYINGS = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50'])
const INDEX_SPOT: Record<string, string> = {
  NIFTY: 'NSE:NIFTY50-INDEX', BANKNIFTY: 'NSE:NIFTYBANK-INDEX', FINNIFTY: 'NSE:FINNIFTY-INDEX',
  MIDCPNIFTY: 'NSE:MIDCPNIFTY-INDEX', NIFTYNXT50: 'NSE:NIFTYNXT50-INDEX',
}

let equities: Instrument[] | null = null
let futures: Instrument[] | null = null

function readMaster(file: string): string[] {
  const p = path.join(DATA_DIR, 'fyers_master', file)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : []
}

function loadEquities(): Instrument[] {
  if (equities) return equities
  const out = new Map<string, Instrument>()
  for (const line of readMaster('NSE_CM.csv')) {
    const c = line.split(',')
    if (c.length < 14 || !c[9]?.endsWith('-EQ')) continue
    const ticker = c[13].trim()
    out.set(ticker, { ticker, name: companyName(ticker) || c[1].trim(), exchange: 'NSE', instrumentType: 'EQ', instrumentId: c[9].trim(), lotSize: 1 })
  }
  return (equities = [...out.values()])
}

function loadFutures(): Instrument[] {
  if (futures) return futures
  const now = Date.now()
  const out: Instrument[] = []
  for (const line of readMaster('NSE_FO.csv')) {
    const c = line.split(',')
    if (c.length < 14 || !c[9]?.endsWith('FUT')) continue
    const expiryMs = Number(c[8]) * 1000
    if (!expiryMs || expiryMs < now - 86_400_000) continue
    const id = c[9].trim()
    out.push({
      ticker: id.replace(/^NSE:/, ''), name: c[1].trim(), exchange: 'NFO', instrumentType: 'FUT', instrumentId: id,
      underlying: c[13].trim(), expiry: new Date(expiryMs).toISOString().slice(0, 10), lotSize: parseInt(c[3]) || 1,
    })
  }
  out.sort((a, b) => a.expiry!.localeCompare(b.expiry!))
  return (futures = out)
}

export const allEquities = () => loadEquities()

export const isTracked = (ticker: string) =>
  (stmts.getSymbols.all() as any[]).some(s => (s.amiBrokerTicker || s.amibroker_ticker) === ticker)

/** Underlyings that have futures (= the F&O segment): stocks and indices. */
export function fnoUnderlyings(): { underlying: string; isIndex: boolean }[] {
  const seen = new Set<string>()
  for (const f of loadFutures()) seen.add(f.underlying!)
  return [...seen].map(u => ({ underlying: u, isIndex: INDEX_UNDERLYINGS.has(u) }))
}

export const isFnoStock = (ticker: string) => loadFutures().some(f => f.underlying === ticker.toUpperCase())

/** Near, next (and far) month futures contracts of an underlying, nearest first. */
export function futuresOf(underlying: string, count = 3): Instrument[] {
  return loadFutures().filter(f => f.underlying === underlying.toUpperCase()).slice(0, count)
}

/** Look up instruments by ticker or name. kind: 'equity' | 'future' | undefined (both). */
export function findInstruments(query: string, kind?: 'equity' | 'future', limit = 8): (Instrument & { tracked: boolean })[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const score = (i: Instrument) => {
    const t = (i.underlying || i.ticker).toLowerCase(), n = i.name.toLowerCase()
    if (t === q) return 0
    if (t.startsWith(q)) return 1
    if (n.startsWith(q)) return 2
    if (n.includes(q) || t.includes(q)) return 3
    return 9
  }
  const pool: Instrument[] = []
  if (kind !== 'future') pool.push(...loadEquities())
  // Only contracts expiring within ~70 days (near and next month) — the ones worth tracking
  const horizon = new Date(Date.now() + 70 * 86_400_000).toISOString().slice(0, 10)
  if (kind !== 'equity') pool.push(...loadFutures().filter(f => f.expiry! <= horizon))
  return pool
    .map(i => ({ i, s: score(i) }))
    .filter(x => x.s < 9)
    .sort((a, b) => a.s - b.s || (a.i.expiry || '').localeCompare(b.i.expiry || '') || a.i.ticker.localeCompare(b.i.ticker))
    .slice(0, limit)
    .map(x => ({ ...x.i, tracked: isTracked(x.i.ticker) }))
}

export function instrumentByTicker(ticker: string): Instrument | undefined {
  return loadEquities().find(i => i.ticker === ticker) || loadFutures().find(i => i.ticker === ticker)
}

// ===== Option chain =====

function fyersAdapter(): any {
  for (const a of brokerManager.getAllAdapters() as any[]) if (typeof a?.dataApi === 'function') return a
  return null
}

const r2 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100)

/**
 * Option-chain summary for an index or F&O stock: futures price/basis, India VIX, PCR, the
 * strikes with the most open interest (call OI = resistance, put OI = support), the biggest
 * OI additions today and the at-the-money straddle.
 */
export async function optionChainSummary(underlying: string, expiryIndex = 0, strikes = 8) {
  const u = underlying.trim().toUpperCase()
  if (!INDEX_UNDERLYINGS.has(u) && !isFnoStock(u)) {
    return { error: `${u} is not in the F&O segment (no futures/options). Use search_instruments to check the name.` }
  }
  const adapter = fyersAdapter()
  if (!adapter) return { error: 'The option chain needs the Fyers broker connected.' }
  const spot = INDEX_SPOT[u] || `NSE:${u}-EQ`

  const first = await adapter.dataApi(`options-chain-v3?symbol=${encodeURIComponent(spot)}&strikecount=${strikes}`)
  const expiries: { date: string; expiry: string }[] = first.data?.expiryData || []
  let data = first.data
  const chosen = expiries[Math.min(Math.max(expiryIndex, 0), expiries.length - 1)]
  if (chosen && expiryIndex > 0) {
    const again = await adapter.dataApi(`options-chain-v3?symbol=${encodeURIComponent(spot)}&strikecount=${strikes}&timestamp=${chosen.expiry}`)
    data = again.data
  }

  const rows: any[] = data?.optionsChain || []
  const under = rows.find(r => r.option_type === '')
  const options = rows.filter(r => r.option_type === 'CE' || r.option_type === 'PE')
  if (!under || options.length === 0) return { error: 'No option chain data returned right now (market may be closed).' }

  const byStrike = new Map<number, { ce?: any; pe?: any }>()
  for (const o of options) {
    const e = byStrike.get(o.strike_price) || {}
    if (o.option_type === 'CE') e.ce = o; else e.pe = o
    byStrike.set(o.strike_price, e)
  }
  const strikesSorted = [...byStrike.entries()].sort((a, b) => a[0] - b[0])
  const spotPrice: number = under.ltp
  const atm = strikesSorted.reduce((best, cur) => (Math.abs(cur[0] - spotPrice) < Math.abs(best[0] - spotPrice) ? cur : best))
  const maxBy = (side: 'ce' | 'pe') => strikesSorted.map(([k, v]) => ({ strike: k, oi: v[side]?.oi ?? 0 })).sort((a, b) => b.oi - a.oi)[0]
  const topAdds = options
    .filter(o => (o.oich ?? 0) > 0)
    .sort((a, b) => b.oich - a.oich)
    .slice(0, 4)
    .map(o => ({ strike: o.strike_price, type: o.option_type, oi: o.oi, oiChange: o.oich, oiChangePct: r2(o.oichp), ltp: r2(o.ltp) }))
  const callOi = Number(data.callOi) || 0, putOi = Number(data.putOi) || 0

  return {
    underlying: u, asOfIST: istString(Date.now()),
    expiry: chosen?.date ?? null, availableExpiries: expiries.slice(0, 4).map(e => e.date),
    spot: r2(spotPrice), spotChangePct: r2(under.ltpchp),
    futuresPrice: r2(under.fp), basis: r2(under.fp - spotPrice), basisPct: r2(((under.fp - spotPrice) / spotPrice) * 100),
    indiaVix: r2(data.indiavixData?.ltp), indiaVixChangePct: r2(data.indiavixData?.ltpchp),
    pcr: callOi ? r2(putOi / callOi) : null, totalCallOi: callOi, totalPutOi: putOi,
    resistanceFromCallOi: maxBy('ce'), supportFromPutOi: maxBy('pe'),
    atmStrike: atm[0], atmStraddle: r2((atm[1].ce?.ltp ?? 0) + (atm[1].pe?.ltp ?? 0)),
    biggestOiAdditions: topAdds,
    strikes: strikesSorted.map(([k, v]) => ({
      strike: k,
      ce: v.ce ? { ltp: r2(v.ce.ltp), oi: v.ce.oi, oiChange: v.ce.oich, volume: v.ce.volume } : null,
      pe: v.pe ? { ltp: r2(v.pe.ltp), oi: v.pe.oi, oiChange: v.pe.oich, volume: v.pe.volume } : null,
    })),
  }
}
