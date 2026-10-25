/**
 * NorenInstruments.ts
 *
 * Symbol lists of the brokers on the Noren platform (Flattrade, Shoonya). Both publish one
 * CSV per exchange with the same columns, spelled differently ("Lotsize" / "LotSize",
 * "Strike" / "StrikePrice"), so columns are found by name. Reduced to NSE/BSE cash, indices,
 * NSE F&O and MCX, with contract names built the NSE / Kite way (Noren's own are
 * "TATAELXSI23NOV26F" and "NIFTY09NOV26C28200").
 */
import { splitCsvLine, type MasterRecord, type InstrumentCategory } from '../InstrumentMaster'
import {
  INDEX_UNDERLYINGS, NSE_SHARE_SERIES, BSE_SHARE_GROUPS, indexKey, indexName, isKnownIndexName, futureSymbol, optionSymbol,
  lastExpiryByMonth, isMonthlyExpiry, parseDayMonYear,
} from '../symbolKey'

const COLUMNS: Record<string, string[]> = {
  exchange: ['exchange'],
  token: ['token'],
  lot: ['lotsize'],
  symbol: ['symbol'],
  tsym: ['tradingsymbol'],
  instrument: ['instrument'],
  expiry: ['expiry'],
  strike: ['strike', 'strikeprice'],
  optType: ['optiontype'],
  tick: ['ticksize'],
}

/** "23-NOV-2026" → "2026-11-23", '' if it isn't such a date */
export const norenExpiry = parseDayMonYear

interface Row {
  exchange: string; token: string; lot: number; symbol: string; tsym: string
  instrument: string; expiry: string; strike: number; optType: string; tick: number
}

function readRows(csv: string): Row[] {
  const lines = csv.split('\n')
  const header = splitCsvLine(lines[0].trim()).map(h => h.trim().toLowerCase())
  const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, header.findIndex(h => names.includes(h))]))
  const get = (p: string[], k: string) => (idx[k] >= 0 ? (p[idx[k]] || '').trim() : '')
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const p = splitCsvLine(line)
    const token = get(p, 'token')
    const tsym = get(p, 'tsym')
    if (!token || !tsym) continue // the lists carry empty placeholder rows
    rows.push({
      exchange: get(p, 'exchange').toUpperCase(), token, tsym,
      lot: Number(get(p, 'lot')) || 1,
      symbol: get(p, 'symbol') || tsym,
      instrument: get(p, 'instrument').toUpperCase(),
      expiry: norenExpiry(get(p, 'expiry')),
      strike: Number(get(p, 'strike')) || 0,
      optType: get(p, 'optType').toUpperCase(),
      tick: Number(get(p, 'tick')) || 0.05,
    })
  }
  return rows
}

/** Index name in key form. The two columns swap between lists ("NIFTY" / "Nifty 50",
 *  "Nifty 50" / "NIFTY INDEX"), so the one the alias table knows wins. */
function indexTicker(r: Row): string {
  const known = [r.symbol, r.tsym].find(isKnownIndexName)
  return indexName(known || r.symbol)
}

/** Parses one or more of a broker's per-exchange CSV files into one list */
export function parseNorenInstruments(...csvFiles: string[]): MasterRecord[] {
  const rows = csvFiles.flatMap(readRows)

  // A month's monthly option expiry is the last one of the month; earlier ones are weeklies
  const monthly = lastExpiryByMonth(rows.filter(r => r.instrument.startsWith('OPT')).map(r => ({ group: `${r.exchange}|${r.symbol.toUpperCase()}`, expiry: r.expiry })))

  const byKey = new Map<string, MasterRecord>()
  const add = (rec: MasterRecord) => { if (!byKey.has(rec.key)) byKey.set(rec.key, rec) }

  for (const r of rows) {
    const ref = `${r.exchange}|${r.token}`
    const base = { name: r.symbol, lot: r.lot, tick: r.tick, ref }

    if (r.exchange === 'NSE' || r.exchange === 'BSE') {
      if (r.instrument === 'INDEX' || r.instrument === 'UNDIND') {
        const name = indexTicker(r)
        add({ ...base, key: indexKey(r.exchange, name), ticker: name, exchange: r.exchange, cat: 'INDEX', lot: 1, tick: 0.05, expiry: '' })
      } else if (r.exchange === 'NSE' && NSE_SHARE_SERIES.has(r.instrument)) {
        const ticker = r.instrument === 'EQ' ? r.tsym.replace(/-EQ$/, '') : r.tsym
        add({ ...base, key: `NSE:${ticker}`, ticker, exchange: 'NSE', cat: 'EQ', expiry: '' })
      } else if (r.exchange === 'BSE' && BSE_SHARE_GROUPS.has(r.instrument)) {
        add({ ...base, key: `BSE:${r.tsym}`, ticker: r.tsym, exchange: 'BSE', cat: 'EQ', expiry: '' })
      }
      continue
    }

    if (r.exchange !== 'NFO' && r.exchange !== 'MCX') continue
    if (!r.expiry) continue
    const underlying = r.symbol.toUpperCase()
    const isIndex = INDEX_UNDERLYINGS.has(underlying) || r.instrument === 'FUTIDX' || r.instrument === 'OPTIDX'
    const mcx = r.exchange === 'MCX'
    let ticker: string
    let cat: InstrumentCategory

    if (r.instrument.startsWith('FUT')) {
      ticker = futureSymbol(underlying, r.expiry)
      cat = isIndex ? 'FUTIDX' : mcx ? 'FUTCOM' : 'FUTSTK'
    } else if (r.instrument.startsWith('OPT') && (r.optType === 'CE' || r.optType === 'PE')) {
      const weekly = !mcx && !isMonthlyExpiry(monthly, `${r.exchange}|${underlying}`, r.expiry)
      ticker = optionSymbol(underlying, r.expiry, r.strike, r.optType, weekly)
      cat = isIndex ? 'OPTIDX' : mcx ? 'OPTFUT' : 'OPTSTK'
    } else continue

    add({ ...base, key: `${r.exchange}:${ticker}`, ticker, exchange: r.exchange, cat, expiry: r.expiry })
  }
  return [...byKey.values()]
}
