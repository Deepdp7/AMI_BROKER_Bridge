/**
 * Which month a futures / options symbol expires in, for the Symbol Setup expiry filter.
 *
 * The broker's list gives the exact date while a contract trades; once it has expired the
 * contract is gone from the list, so the month is read from the ticker itself:
 *   RELIANCE26OCTFUT, NIFTY26NOV24000CE  → monthly contracts (YY + month)
 *   NIFTY26O2117350CE                    → weekly options (YY, month 1-9/O/N/D, day)
 */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MONTHLY = /(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:FUT|\d+(?:\.\d+)?(?:CE|PE))$/
const WEEKLY = /(\d{2})([1-9OND])(\d{2})\d+(?:\.\d+)?(?:CE|PE)$/

export interface Expiry {
  /** "2026-11": the filter key */
  month: string
  /** "2026-11-24" when the day is known */
  date?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** From the broker list's date ("2026-11-24") or else the ticker; null for cash and indices */
export function expiryOf(ticker: string, listDate?: string): Expiry | null {
  if (listDate && /^\d{4}-\d{2}-\d{2}$/.test(listDate)) return { month: listDate.slice(0, 7), date: listDate }
  const t = ticker.toUpperCase().replace(/^[A-Z]+:/, '')
  const m = MONTHLY.exec(t)
  if (m) return { month: `20${m[1]}-${pad(MONTHS.indexOf(m[2]) + 1)}` }
  const w = WEEKLY.exec(t)
  if (w) {
    const month = w[2] === 'O' ? 10 : w[2] === 'N' ? 11 : w[2] === 'D' ? 12 : Number(w[2])
    const day = Number(w[3])
    if (day >= 1 && day <= 31) return { month: `20${w[1]}-${pad(month)}`, date: `20${w[1]}-${pad(month)}-${pad(day)}` }
  }
  return null
}

/** Today in India (YYYY-MM-DD): contracts expire on Indian dates */
export function todayIst(nowMs = Date.now()): string {
  return new Date(nowMs + 19_800_000).toISOString().slice(0, 10)
}

/** Certainly expired: the day has passed, or (day not known) the whole month has */
export function isExpired(e: Expiry, today = todayIst()): boolean {
  return e.date ? e.date < today : e.month < today.slice(0, 7)
}

/** "Nov 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[m - 1][0]}${MONTHS[m - 1].slice(1).toLowerCase()} ${y}`
}
