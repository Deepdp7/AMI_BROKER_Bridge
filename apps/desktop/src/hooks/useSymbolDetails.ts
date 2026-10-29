/**
 * Lot size, tick size, name and expiry of the tracked symbols, from their brokers' lists.
 * Read once and kept for the session; asked again when symbols are added, at most once a minute.
 */
import { useEffect, useState } from 'react'
import { api, type SymbolDetail } from '../api/apiClient'
import { useAppStore } from '../store/appStore'

let known = new Map<string, SymbolDetail>()
let fetchedFor = -1
let fetchedAt = 0
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function load(count: number) {
  if (inflight || (count === fetchedFor && Date.now() - fetchedAt < 60_000)) return
  inflight = Promise.resolve()
    .then(() => api.getSymbolDetails())
    .then(rows => {
      known = new Map(rows.map(r => [r.ticker, r]))
      fetchedFor = count
      fetchedAt = Date.now()
      listeners.forEach(l => l())
    })
    .catch(() => { /* engine busy or older: details just stay hidden */ })
    .finally(() => { inflight = null })
}

export function useSymbolDetails(): Map<string, SymbolDetail> {
  const count = useAppStore(s => s.symbols.length)
  const [, redraw] = useState(0)
  useEffect(() => {
    const l = () => redraw(n => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  useEffect(() => { load(count) }, [count])
  return known
}

/** Rupees one lot costs at this price (MCX: price × what one lot earns per rupee of move) */
export function lotValue(d: SymbolDetail, price: number): number {
  return price * d.lotSize * (d.pointValue || 1)
}

export function resetSymbolDetailsForTest() {
  known = new Map(); fetchedFor = -1; fetchedAt = 0; inflight = null
}
