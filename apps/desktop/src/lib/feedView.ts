/**
 * Feed Status table: which rows show and in what order (search, quick filters, sorting,
 * pinned symbols first). Kept apart from the page so it can be tested on its own.
 */
import type { SymbolFeed } from '../store/appStore'

export type FeedFilter = 'all' | 'streaming' | 'stale' | 'gainers' | 'losers' | 'pinned'
export type SortKey = 'ticker' | 'exchange' | 'price' | 'change' | 'lastTick' | 'barsPerMin' | 'latency' | 'status'
export interface SortState { key: SortKey | null; dir: 1 | -1 }

export const isLive = (s: SymbolFeed) => s.status === 'STREAMING' || s.status === 'RECEIVING'

const MATCH: Record<FeedFilter, (s: SymbolFeed, pinned: Set<string>) => boolean> = {
  all: () => true,
  streaming: s => isLive(s),
  stale: s => s.status === 'STALE',
  gainers: s => s.changePercent > 0,
  losers: s => s.changePercent < 0,
  pinned: (s, pinned) => pinned.has(s.ticker),
}

/** How many symbols each quick filter would show */
export function filterCounts(symbols: SymbolFeed[], pinned: Set<string>): Record<FeedFilter, number> {
  const counts = { all: 0, streaming: 0, stale: 0, gainers: 0, losers: 0, pinned: 0 } as Record<FeedFilter, number>
  for (const s of symbols) for (const f of Object.keys(MATCH) as FeedFilter[]) if (MATCH[f](s, pinned)) counts[f]++
  return counts
}

// Live first, then the ones waiting for data, then problems
const STATUS_ORDER: Record<string, number> = { STREAMING: 0, RECEIVING: 1, SUBSCRIBED: 2, STALE: 3, CLOSED: 4, ERROR: 5 }

const VALUE: Record<SortKey, (s: SymbolFeed) => number | string> = {
  ticker: s => s.ticker || '',
  exchange: s => s.exchange || '',
  price: s => s.lastPrice || 0,
  change: s => s.changePercent || 0,
  lastTick: s => s.lastTickUtcMs || 0,
  barsPerMin: s => s.barsPerMin || 0,
  latency: s => s.internalLatencyMs || 0,
  status: s => STATUS_ORDER[s.status] ?? 9,
}

export function viewRows(symbols: SymbolFeed[], opts: {
  search: string
  filter: FeedFilter
  exchange: string
  sort: SortState
  pinned: Set<string>
}): SymbolFeed[] {
  const q = opts.search.trim().toLowerCase()
  const rows = symbols.filter(s =>
    (!q || (s.ticker || '').toLowerCase().includes(q) || (s.exchange || '').toLowerCase() === q || (s.rawSymbol || '').toLowerCase().includes(q)) &&
    (opts.exchange === 'ALL' || s.exchange === opts.exchange) &&
    MATCH[opts.filter](s, opts.pinned),
  )
  const { key, dir } = opts.sort
  const get = key ? VALUE[key] : null
  // Pinned symbols stay on top; inside each part the chosen column decides (stable otherwise)
  return rows
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const pa = opts.pinned.has(a.s.ticker) ? 0 : 1, pb = opts.pinned.has(b.s.ticker) ? 0 : 1
      if (pa !== pb) return pa - pb
      if (get) {
        const va = get(a.s), vb = get(b.s)
        const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
        if (c !== 0) return c * dir
      }
      return a.i - b.i
    })
    .map(x => x.s)
}

/** Clicking a column: first ascending (descending for numbers people rank, like change), then reversed, then off */
export function nextSort(cur: SortState, key: SortKey): SortState {
  const firstDir: 1 | -1 = key === 'ticker' || key === 'exchange' || key === 'status' ? 1 : -1
  if (cur.key !== key) return { key, dir: firstDir }
  if (cur.dir === firstDir) return { key, dir: (firstDir * -1) as 1 | -1 }
  return { key: null, dir: 1 }
}

/** Advancers / decliners / unchanged, and the biggest movers */
export function breadth(symbols: SymbolFeed[]) {
  let up = 0, down = 0, flat = 0
  let best: SymbolFeed | null = null, worst: SymbolFeed | null = null
  for (const s of symbols) {
    if (!s.lastPrice) continue
    if (s.changePercent > 0) up++
    else if (s.changePercent < 0) down++
    else flat++
    if (s.changePercent > 0 && (!best || s.changePercent > best.changePercent)) best = s
    if (s.changePercent < 0 && (!worst || s.changePercent < worst.changePercent)) worst = s
  }
  return { up, down, flat, best, worst }
}

/** Per-ticker price history for the trend column: one sample per second at most, last 20 */
const trend = new Map<string, { t: number; v: number[] }>()
export function trendOf(ticker: string, price: number, now = Date.now()): number[] {
  let rec = trend.get(ticker)
  if (!rec) { rec = { t: 0, v: [] }; trend.set(ticker, rec) }
  if (price > 0 && now - rec.t >= 1000) {
    rec.v.push(price)
    if (rec.v.length > 20) rec.v.shift()
    rec.t = now
  }
  return rec.v
}
