/**
 * KotakInstruments.ts
 *
 * Kotak Neo's symbol lists. Public, no login: GET
 * https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/<YYYY-MM-DD>/transformed[-v1]/<segment>[-v1].csv
 * (the logged-in API also hands out these addresses, /script-details/1.0/masterscrip/file-paths).
 *
 * Columns used (the header has stray spaces and a trailing ";" on some names, trimmed here):
 *   pSymbol    the instrument token (nse_cm|2885), also what history and the live feed take
 *   pSymbolName  RELIANCE / NIFTY, pGroup  EQ / BE… (cash; empty for an index), pISIN (empty for an index)
 *   pInstType  FUTSTK / FUTIDX / OPTSTK / OPTIDX (F&O)   pOptionType  XX future, CE, PE
 *   lLotSize, dTickSize (paise, /100), dStrikePrice (paise, /100)
 *   lExpiryDate  seconds since 1980-01-01 on the IST clock: + 315513000 gives unix time (the UTC
 *                date is the expiry date; checked against pScripRefKey on all 666 NFO futures)
 *
 * Names are built the NSE / Kite way (symbolKey.ts) so a symbol list survives a change of broker.
 * MCX and currency are left out: Kotak serves no history for them, only live quotes. BSE F&O keeps
 * the index contracts only.
 */
import type { MasterRecord, InstrumentCategory } from '../InstrumentMaster'
import { splitCsvLine } from '../InstrumentMaster'
import {
  INDEX_UNDERLYINGS, NSE_SHARE_SERIES, BSE_SHARE_GROUPS, indexKey, indexName, futureSymbol, optionSymbol,
  lastExpiryByMonth, isMonthlyExpiry,
} from '../symbolKey'

/** Kotak's segment names, as the live feed and history call them */
export const KOTAK_SEGMENTS = ['nse_cm', 'bse_cm', 'nse_fo', 'bse_fo'] as const
export type KotakSegment = typeof KOTAK_SEGMENTS[number]

const SEGMENT_EXCHANGE: Record<KotakSegment, string> = { nse_cm: 'NSE', bse_cm: 'BSE', nse_fo: 'NFO', bse_fo: 'BFO' }
/** Seconds from the FO list's clock to unix time */
const FO_EXPIRY_OFFSET_SEC = 315_513_000

/** Public symbol-list address for one segment on a day */
export function kotakListUrl(segment: KotakSegment, day: string): string {
  const cash = segment === 'nse_cm' || segment === 'bse_cm'
  return `https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/${day}/${cash ? 'transformed-v1' : 'transformed'}/${segment}${cash ? '-v1' : ''}.csv`
}

/** Expiry (YYYY-MM-DD) of an F&O row from its lExpiryDate, '' when it has none */
export function kotakExpiry(raw: string): string {
  const v = Number(raw)
  if (!(v > 0)) return ''
  return new Date((v + FO_EXPIRY_OFFSET_SEC) * 1000).toISOString().slice(0, 10)
}

interface Row {
  token: string; name: string; group: string; isin: string; instType: string; optType: string
  lot: number; tick: number; strike: number; expiry: string
}

function readRows(text: string): Row[] {
  const lines = text.split(/\r?\n/)
  const header = splitCsvLine(lines[0] || '').map(h => h.trim().replace(/;$/, ''))
  const col = (name: string) => header.indexOf(name)
  const c = {
    token: col('pSymbol'), name: col('pSymbolName'), group: col('pGroup'), isin: col('pISIN'), instType: col('pInstType'),
    optType: col('pOptionType'), lot: col('lLotSize'), tick: col('dTickSize'), strike: col('dStrikePrice'), expiry: col('lExpiryDate'),
  }
  if (c.token < 0 || c.name < 0) throw new Error('unexpected symbol list columns')
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const p = splitCsvLine(line)
    const token = (p[c.token] || '').trim()
    if (!token) continue
    rows.push({
      token,
      name: (p[c.name] || '').trim().toUpperCase(),
      group: (p[c.group] || '').trim().toUpperCase(),
      isin: (p[c.isin] || '').trim(),
      instType: (p[c.instType] || '').trim().toUpperCase(),
      optType: (p[c.optType] || '').trim().toUpperCase(),
      lot: Number(p[c.lot]) > 0 ? Number(p[c.lot]) : 1,
      // Prices in these lists are in paise; -1 means "none"
      tick: Number(p[c.tick]) > 0 ? Number(p[c.tick]) / 100 : 0.05,
      strike: Number(p[c.strike]) > 0 ? Number(p[c.strike]) / 100 : 0,
      expiry: c.expiry >= 0 ? kotakExpiry(p[c.expiry]) : '',
    })
  }
  return rows
}

/** The four lists (any order is fine; each is told by its segment) → one list of instruments */
export function parseKotakInstruments(lists: Partial<Record<KotakSegment, string>>): MasterRecord[] {
  const byKey = new Map<string, MasterRecord>()
  const add = (rec: MasterRecord) => { if (!byKey.has(rec.key)) byKey.set(rec.key, rec) }

  for (const segment of KOTAK_SEGMENTS) {
    const text = lists[segment]
    if (!text) continue
    const exchange = SEGMENT_EXCHANGE[segment]
    const rows = readRows(text)
    const ref = (r: Row) => `${segment}|${r.token}`

    if (segment === 'nse_cm' || segment === 'bse_cm') {
      for (const r of rows) {
        const base = { name: r.name, lot: 1, tick: r.tick, ref: ref(r), expiry: '' }
        if (!r.isin) {
          // Indices have no ISIN. Kotak's own names ("Nifty 50") are what the live feed wants, so
          // the symbol name is kept as the record's name; the key uses the common spelling
          const name = indexName(r.name)
          add({ ...base, key: indexKey(exchange, name), ticker: name, exchange, cat: 'INDEX', tick: 0.05 })
        } else if (exchange === 'NSE' && NSE_SHARE_SERIES.has(r.group)) {
          const ticker = r.group === 'EQ' ? r.name : `${r.name}-${r.group}`
          add({ ...base, key: `NSE:${ticker}`, ticker, exchange, cat: 'EQ' })
        } else if (exchange === 'BSE' && BSE_SHARE_GROUPS.has(r.group)) {
          add({ ...base, key: `BSE:${r.name}`, ticker: r.name, exchange, cat: 'EQ' })
        }
      }
      continue
    }

    // A month's monthly option expiry is the last one of the month; earlier ones are weeklies
    const monthly = lastExpiryByMonth(rows.filter(r => r.optType === 'CE' || r.optType === 'PE').map(r => ({ group: `${segment}|${r.name}`, expiry: r.expiry })))
    for (const r of rows) {
      if (!r.expiry) continue
      const isIndex = INDEX_UNDERLYINGS.has(r.name) || r.instType === 'FUTIDX' || r.instType === 'OPTIDX'
      // BSE's stock derivatives (40,000 rows nobody tracks) are left out; its index ones (Sensex, Bankex) stay
      if (segment === 'bse_fo' && !isIndex) continue
      const base = { name: r.name, lot: r.lot, tick: r.tick, ref: ref(r), expiry: r.expiry, exchange }
      let ticker: string
      let cat: InstrumentCategory
      if (r.optType === 'XX' || r.instType.startsWith('FUT')) {
        ticker = futureSymbol(r.name, r.expiry)
        cat = isIndex ? 'FUTIDX' : 'FUTSTK'
      } else if ((r.optType === 'CE' || r.optType === 'PE') && r.strike > 0) {
        ticker = optionSymbol(r.name, r.expiry, r.strike, r.optType, !isMonthlyExpiry(monthly, `${segment}|${r.name}`, r.expiry))
        cat = isIndex ? 'OPTIDX' : 'OPTSTK'
      } else continue
      add({ ...base, key: `${exchange}:${ticker}`, ticker, cat })
    }
  }
  return [...byKey.values()]
}

/** Downloads today's lists (the dated address falls back to yesterday's before the day's file is out) */
export async function downloadKotakInstruments(now = Date.now()): Promise<MasterRecord[]> {
  const day = (ms: number) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10)
  const get = async (segment: KotakSegment) => {
    let lastError = ''
    for (const d of [day(now), day(now - 86_400_000)]) {
      try {
        const res = await fetch(kotakListUrl(segment, d), { signal: AbortSignal.timeout(120_000) })
        const text = res.ok ? await res.text() : ''
        if (text.trim()) return text
        lastError = `HTTP ${res.status}`
      } catch (err: any) {
        lastError = err?.message || String(err)
      }
    }
    throw new Error(`${segment}: ${lastError}`)
  }
  const texts = await Promise.all(KOTAK_SEGMENTS.map(get))
  return parseKotakInstruments(Object.fromEntries(KOTAK_SEGMENTS.map((s, i) => [s, texts[i]])))
}
