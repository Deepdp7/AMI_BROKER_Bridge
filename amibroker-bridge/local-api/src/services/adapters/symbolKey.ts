/**
 * symbolKey.ts
 *
 * One broker-neutral name per instrument, so a symbol list survives switching broker
 * (symbols of a removed account are adopted by whichever broker connects next).
 *
 *   NSE:TCS                 equity (NSE / BSE), series other than EQ kept: NSE:GOLDSTAR-ST
 *   NSE:NIFTY50-INDEX       index (same as Fyers)
 *   NFO:TATAELXSI26OCTFUT   future: underlying + YY + MON + FUT (NSE / Kite / Fyers style)
 *   NFO:NIFTY26OCT22600CE   monthly option; weekly: NIFTY26N0922600CE (YY + M + DD)
 *   MCX:CRUDEOIL26NOVFUT
 *
 * parseSymbol() also reads the names other brokers store — Fyers "NSE:TCS-EQ",
 * "NSE:TATAELXSI26OCTFUT" (Fyers lists F&O under NSE:), plain AmiBroker tickers, and
 * continuous "TATAELXSI-FUT" (nearest expiry).
 */

export type SymbolKind = 'EQ' | 'INDEX' | 'FUT' | 'OPT' | 'NEAREST_FUT'

export interface ParsedSymbol {
  /** Canonical key, e.g. "NFO:TATAELXSI26OCTFUT"; for NEAREST_FUT the underlying, e.g. "NFO:TATAELXSI" */
  key: string
  exchange: string
  kind: SymbolKind
}

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** NSE weekly-option month codes: 1-9 for Jan-Sep, then O, N, D */
const WEEKLY_MONTH_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'O', 'N', 'D']

/** Index names as each broker spells them (spaces removed) → the Fyers-style name used in keys */
const INDEX_ALIASES: Record<string, string> = {
  NIFTY: 'NIFTY50', NIFTY50: 'NIFTY50',
  BANKNIFTY: 'NIFTYBANK', NIFTYBANK: 'NIFTYBANK',
  FINNIFTY: 'FINNIFTY', NIFTYFINSERVICE: 'FINNIFTY',
  MIDCPNIFTY: 'MIDCPNIFTY', NIFTYMIDSELECT: 'MIDCPNIFTY',
  NIFTYNXT50: 'NIFTYNXT50', NIFTYNEXT50: 'NIFTYNXT50',
  INDIAVIX: 'INDIAVIX',
  SENSEX: 'SENSEX', BANKEX: 'BANKEX',
}

/** Underlyings whose futures and options are index derivatives (FUTIDX / OPTIDX) */
export const INDEX_UNDERLYINGS = new Set([
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50', 'SENSEX', 'BANKEX', 'SENSEX50', 'NIFTYFPI',
  'MCXBULLDEX', 'MCXMETLDEX', 'MCXENRGDEX', 'MCXCOMPDEX',
])

/** Plain AmiBroker tickers that mean an MCX commodity (nearest future). Whole names only:
 *  GOLDBEES / SILVERBEES are NSE ETFs. */
const MCX_UNDERLYING_RE = /^(GOLD|GOLDM|GOLDPETAL|GOLDGUINEA|GOLDTEN|SILVER|SILVERM|SILVERMIC|CRUDE|CRUDEOIL|CRUDEOILM|NATURALGAS|NATGASMINI|COPPER|ZINC|ZINCMINI|LEAD|LEADMINI|ALUMINIUM|ALUMINI|NICKEL|MCXBULLDEX|MCXENRGDEX|MCXMETLDEX|COTTON|COTTONCNDY|MENTHAOIL)(-FUT)?$/

const FUT_RE = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/
const OPT_RE = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[1-9OND]\d{2})\d+(\.\d+)?(CE|PE)$/

/** Index name in key form: spaces removed, broker spellings unified ("NIFTY BANK" → NIFTYBANK) */
export function indexName(name: string): string {
  const compact = name.toUpperCase().replace(/\s+/g, '')
  return INDEX_ALIASES[compact] || compact
}

export function indexKey(exchange: 'NSE' | 'BSE' | string, name: string): string {
  return `${exchange}:${indexName(name)}-INDEX`
}

/** F&O exchange for a cash-market exchange name (Fyers keeps NSE F&O under "NSE:") */
function derivativeExchange(exchange: string): string {
  if (exchange === 'NSE') return 'NFO'
  if (exchange === 'BSE') return 'BFO'
  return exchange
}

/** "26OCT" part of a futures / monthly option name for an expiry date (YYYY-MM-DD) */
export function monthlyCode(expiry: string): string {
  return `${expiry.slice(2, 4)}${MONTHS[Number(expiry.slice(5, 7)) - 1]}`
}

/** "26N09" part of a weekly option name for an expiry date (YYYY-MM-DD) */
export function weeklyCode(expiry: string): string {
  return `${expiry.slice(2, 4)}${WEEKLY_MONTH_CODES[Number(expiry.slice(5, 7)) - 1]}${expiry.slice(8, 10)}`
}

export function futureSymbol(underlying: string, expiry: string): string {
  return `${underlying}${monthlyCode(expiry)}FUT`
}

export function optionSymbol(underlying: string, expiry: string, strike: number, type: 'CE' | 'PE', weekly: boolean): string {
  return `${underlying}${weekly ? weeklyCode(expiry) : monthlyCode(expiry)}${formatStrike(strike)}${type}`
}

function formatStrike(strike: number): string {
  return Number.isInteger(strike) ? String(strike) : String(+strike.toFixed(2))
}

/**
 * Reads any stored symbol name into its canonical key. `exchangeHint` / `typeHint` are the
 * symbol's exchange and instrument type columns, used when the name itself has no prefix.
 */
export function parseSymbol(raw: string, exchangeHint?: string, typeHint?: string): ParsedSymbol {
  let s = String(raw || '').trim().toUpperCase()
  let exchange = (exchangeHint || '').toUpperCase()
  const colon = s.indexOf(':')
  if (colon > 0) {
    exchange = s.slice(0, colon)
    s = s.slice(colon + 1)
  }
  s = s.replace(/\.NS$/, '').replace(/-NSC$/, '')
  if (!exchange) exchange = 'NSE'
  const type = (typeHint || '').toUpperCase()
  const derivative = exchange === 'NFO' || exchange === 'BFO' || exchange === 'MCX' || type === 'FUT' || type === 'OPT'

  // Index: "-INDEX" (Fyers), a known index name ("NIFTY", "BANKNIFTY"), or a name with
  // spaces ("NIFTY 50", "NIFTY IT" — Kite; equity symbols never contain spaces)
  const indexBody = s.replace(/-INDEX$/, '')
  if (s.endsWith('-INDEX') || type === 'INDEX' || (!derivative && (INDEX_ALIASES[indexBody] || /\s/.test(indexBody)))) {
    const name = indexName(indexBody)
    const ex = exchange === 'BSE' || name === 'SENSEX' || name === 'BANKEX' ? 'BSE' : 'NSE'
    return { key: indexKey(ex, name), exchange: ex, kind: 'INDEX' }
  }

  if (FUT_RE.test(s)) {
    const ex = derivativeExchange(exchange)
    return { key: `${ex}:${s}`, exchange: ex, kind: 'FUT' }
  }
  if (OPT_RE.test(s)) {
    const ex = derivativeExchange(exchange)
    return { key: `${ex}:${s}`, exchange: ex, kind: 'OPT' }
  }

  // Continuous future: "TATAELXSI-FUT", an NFO/MCX ticker without expiry, or a bare commodity name
  if (s.endsWith('-FUT')) {
    const ex = exchange === 'MCX' || MCX_UNDERLYING_RE.test(s) ? 'MCX' : derivativeExchange(exchange)
    return { key: `${ex}:${s.slice(0, -4)}`, exchange: ex, kind: 'NEAREST_FUT' }
  }
  const bareCommodity = colon < 0 && exchange === 'NSE' && !type && MCX_UNDERLYING_RE.test(s)
  if (derivative || type === 'COMM' || bareCommodity) {
    const ex = bareCommodity ? 'MCX' : derivativeExchange(exchange)
    return { key: `${ex}:${s}`, exchange: ex, kind: 'NEAREST_FUT' }
  }

  // Equity: Fyers adds the series ("-EQ"; BSE groups "-A", "-B", "-T"…); NSE series other
  // than EQ (-BE, -ST, …) are part of the Kite / Dhan name and stay
  const ex = exchange === 'BSE' ? 'BSE' : 'NSE'
  const name = ex === 'BSE' ? s.replace(/-(EQ|A|B|T|X|XT|Z|M|MT)$/, '') : s.replace(/-EQ$/, '')
  return { key: `${ex}:${name}`, exchange: ex, kind: 'EQ' }
}

/** AmiBroker ticker for a canonical key: "NSE:TCS" → TCS, "NSE:NIFTY50-INDEX" → NIFTY50 */
export function tickerFromKey(key: string): string {
  return key.slice(key.indexOf(':') + 1).replace(/-INDEX$/, '')
}

/** Date-time in IST as "YYYY-MM-DD HH:MM:SS" (Kite and Dhan history ranges are exchange time) */
export function formatIstDateTime(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

/** Next 06:00 IST after `fromMs` — when Kite (and Fyers) access tokens die */
export function next0600IstMs(fromMs: number = Date.now()): number {
  const IST = 5.5 * 3600 * 1000
  const ist = new Date(fromMs + IST)
  let t = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 0, 0) - IST
  if (t <= fromMs) t += 24 * 3600 * 1000
  return t
}

/** Expiry time (UTC ms) from a JWT `exp`, or null if it can't be read */
export function jwtExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/** Claims of a JWT (unverified), or {} */
export function jwtPayload(token: string): Record<string, any> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) || {}
  } catch {
    return {}
  }
}
