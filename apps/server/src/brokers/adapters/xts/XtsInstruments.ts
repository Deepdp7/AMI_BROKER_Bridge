/**
 * XtsInstruments.ts
 *
 * Symbol lists of the brokers on Symphony's XTS platform (Compositedge, 5paisa XTS, Jainam,
 * IndiaBulls, Rmoney). Public, no login: POST <md>/instruments/master {exchangeSegmentList:
 * ["NSECM"]} answers {type:"success", result:"<row>\n<row>…"} with "|"-separated rows, and
 * GET <md>/instruments/indexlist?exchangeSegment=1|11 lists the indices ("NIFTY 50_26000").
 *
 * Row columns (checked against the live lists, Oct 2026):
 *   0 segment, 1 instrument id, 2 type (1 future, 2 option, 4 calendar spread, 8 cash,
 *   16 MCX spot / index), 3 name, 4 description, 5 series (EQ / BE… / FUTSTK / OPTIDX…),
 *   11 tick size, 12 lot size, 16 expiry ("2026-11-23T14:30:00");
 *   options only: 17 strike, 18 option type (3 = CE, 4 = PE).
 *
 * Contract names are built the NSE / Kite way (symbolKey.ts), so a symbol list keeps working
 * when an account moves between brokers. The broker reference is "<segment>|<instrument id>".
 */
import type { MasterRecord, InstrumentCategory } from '../InstrumentMaster'
import {
  INDEX_UNDERLYINGS, NSE_SHARE_SERIES, BSE_SHARE_GROUPS, indexKey, indexName, futureSymbol, optionSymbol,
  lastExpiryByMonth, isMonthlyExpiry,
} from '../symbolKey'

/** XTS segment names and the numbers the subscription API uses */
export const XTS_SEGMENT_IDS: Record<string, number> = { NSECM: 1, NSEFO: 2, NSECD: 3, BSECM: 11, BSEFO: 12, MCXFO: 51 }
const SEGMENT_EXCHANGE: Record<string, string> = { NSECM: 'NSE', BSECM: 'BSE', NSEFO: 'NFO', MCXFO: 'MCX' }

const FUTURE = 1, OPTION = 2, CASH = 8

interface Row {
  segment: string; id: string; type: number; name: string; description: string; series: string
  tick: number; lot: number; expiry: string; strike: number; optType: string
}

function readRows(text: string): Row[] {
  const rows: Row[] = []
  for (const line of text.split('\n')) {
    const p = line.trim().split('|')
    // The exchanges' own test contracts ("131NSETEST") are listed too
    if (p.length < 13 || !p[1] || /NSETEST|BSETEST/i.test(p[3])) continue
    const type = Number(p[2])
    const option = type === OPTION
    rows.push({
      segment: p[0], id: p[1], type, name: p[3].toUpperCase(), description: p[4], series: p[5].toUpperCase(),
      tick: Number(p[11]) || 0.05, lot: Number(p[12]) || 1,
      expiry: /^\d{4}-\d{2}-\d{2}/.test(p[16] || '') ? p[16].slice(0, 10) : '',
      strike: option ? Number(p[17]) || 0 : 0,
      optType: option ? (p[18] === '3' ? 'CE' : p[18] === '4' ? 'PE' : '') : '',
    })
  }
  return rows
}

/**
 * Reads the per-segment lists (NSECM, BSECM, NSEFO, MCXFO answers, any order) and the index
 * lists into one list.
 */
export function parseXtsInstruments(segmentTexts: string[], indexLists: { segment: 'NSECM' | 'BSECM'; names: string[] }[]): MasterRecord[] {
  const rows = segmentTexts.flatMap(readRows)
  const byKey = new Map<string, MasterRecord>()
  const add = (rec: MasterRecord) => { if (!byKey.has(rec.key)) byKey.set(rec.key, rec) }

  for (const { segment, names } of indexLists) {
    const exchange = SEGMENT_EXCHANGE[segment]
    for (const entry of names) {
      const cut = entry.lastIndexOf('_')
      if (cut <= 0) continue
      const name = indexName(entry.slice(0, cut))
      add({ key: indexKey(exchange, name), ticker: name, name: entry.slice(0, cut), exchange, cat: 'INDEX', lot: 1, tick: 0.05, expiry: '', ref: `${segment}|${entry.slice(cut + 1)}` })
    }
  }

  // A month's monthly option expiry is the last one of the month; earlier ones are weeklies
  const monthly = lastExpiryByMonth(rows.filter(r => r.type === OPTION).map(r => ({ group: `${r.segment}|${r.name}`, expiry: r.expiry })))

  for (const r of rows) {
    const exchange = SEGMENT_EXCHANGE[r.segment]
    if (!exchange) continue
    const base = { name: r.name, lot: r.lot, tick: r.tick, ref: `${r.segment}|${r.id}` }

    if (r.type === CASH) {
      if (exchange === 'NSE' && NSE_SHARE_SERIES.has(r.series)) {
        const ticker = r.series === 'EQ' ? r.name : `${r.name}-${r.series}`
        add({ ...base, key: `NSE:${ticker}`, ticker, exchange: 'NSE', cat: 'EQ', expiry: '' })
      } else if (exchange === 'BSE' && BSE_SHARE_GROUPS.has(r.series)) {
        add({ ...base, key: `BSE:${r.name}`, ticker: r.name, exchange: 'BSE', cat: 'EQ', expiry: '' })
      }
      continue
    }

    // Spreads (type 4) and MCX spot rows (16) are not tradable contracts
    if ((exchange !== 'NFO' && exchange !== 'MCX') || !r.expiry) continue
    const mcx = exchange === 'MCX'
    const isIndex = INDEX_UNDERLYINGS.has(r.name) || r.series === 'FUTIDX' || r.series === 'OPTIDX'
    let ticker: string
    let cat: InstrumentCategory
    if (r.type === FUTURE) {
      ticker = futureSymbol(r.name, r.expiry)
      cat = isIndex ? 'FUTIDX' : mcx ? 'FUTCOM' : 'FUTSTK'
    } else if (r.type === OPTION && r.optType) {
      const weekly = !mcx && !isMonthlyExpiry(monthly, `${r.segment}|${r.name}`, r.expiry)
      ticker = optionSymbol(r.name, r.expiry, r.strike, r.optType as 'CE' | 'PE', weekly)
      cat = isIndex ? 'OPTIDX' : mcx ? 'OPTFUT' : 'OPTSTK'
    } else continue
    add({ ...base, key: `${exchange}:${ticker}`, ticker, exchange, cat, expiry: r.expiry })
  }
  return [...byKey.values()]
}
