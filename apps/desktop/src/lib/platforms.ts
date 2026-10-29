/**
 * The charting / trading platforms DataBridge Pro feeds (engine: /api/platforms). What each one
 * can take is the platform's own limit: live (AmiBroker, Excel, MetaTrader 5), history files
 * (NinjaTrader, MetaStock, CSV) or symbol lists only (TradingView, Chartink, which use their own data).
 */
import { useEffect, useState, useCallback } from 'react'
import { BASE_URL } from '../api/apiClient'
import amibroker from '../assets/platforms/amibroker.png'
import excel from '../assets/platforms/excel.png'
import metatrader5 from '../assets/platforms/metatrader5.png'
import ninjatrader8 from '../assets/platforms/ninjatrader8.png'
import sierrachart from '../assets/platforms/sierrachart.png'
import tradingview from '../assets/platforms/tradingview.png'
import chartink from '../assets/platforms/chartink.png'

export type PlatformId = 'amibroker' | 'excel' | 'metatrader5' | 'ninjatrader8' | 'sierrachart' | 'metastock' | 'tradingview' | 'chartink' | 'csv'
export type PlatformLevel = 'live' | 'history' | 'watchlist' | 'soon'

export interface PlatformInstance {
  folder: string
  exe?: string
  connectorFolder?: string
  connectorInstalled?: boolean
  label?: string
}

export interface PlatformInfo {
  id: PlatformId
  name: string
  kind: 'desktop' | 'web' | 'file'
  level: PlatformLevel
  gives: string
  installed: boolean
  instances: PlatformInstance[]
  note?: string
  website: string
}

export interface PlatformsState {
  platforms: PlatformInfo[]
  chosen: PlatformId[]
  asked: boolean
  /** The CSV folder is kept up to date every minute */
  csvLive?: boolean
}

/** Websites that open on a symbol's own chart */
export type ChartSite = 'chartink' | 'tradingview'
export const CHART_SITES: ChartSite[] = ['chartink', 'tradingview']
export const CHART_SITE_NAMES: Record<ChartSite, string> = { chartink: 'Chartink', tradingview: 'TradingView' }

/** Whether a site has a chart for this symbol: Chartink is NSE/BSE cash only, TradingView has no NSE options */
export function siteHasChart(site: ChartSite, s: { exchange?: string; instrumentType?: string }): boolean {
  if (site === 'chartink') return (s.exchange || '').toUpperCase() !== 'MCX'
  return (s.instrumentType || '').toUpperCase() !== 'OPT'
}

export const PLATFORM_LOGOS: Partial<Record<PlatformId, string>> = { amibroker, excel, metatrader5, ninjatrader8, sierrachart, tradingview, chartink }

export const LEVEL_LABEL: Record<PlatformLevel, { text: string; color: string; title: string }> = {
  live: { text: 'Live + history', color: 'var(--good)', title: 'Live prices and full history' },
  history: { text: 'History files', color: '#38bdf8', title: 'History exported in its import format' },
  watchlist: { text: 'Symbol lists', color: '#c084fc', title: 'Uses its own data; symbols go back and forth' },
  soon: { text: 'CSV for now', color: '#f59e0b', title: 'Live data needs a protocol DataBridge does not speak yet' },
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/platforms${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

const post = <T,>(path: string, body: object = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const platformsApi = {
  list: (refresh = false) => call<PlatformsState>(refresh ? '?refresh=1' : ''),
  choose: (ids: PlatformId[]) => call<{ chosen: PlatformId[] }>('/chosen', { method: 'PUT', body: JSON.stringify({ ids }) }),
  install: (id: PlatformId, instance = 0) => post<{ ok: true; message: string; platform?: PlatformInfo }>(`/${id}/install`, { instance }),
  open: (id: PlatformId, instance = 0) => post<{ ok: true }>(`/${id}/open`, { instance }),
  /** A website straight on one symbol's chart (chartink.com/stocks-new?symbol=TCS) */
  openChart: (id: ChartSite, ticker: string) => post<{ ok: true; url: string }>(`/${id}/open`, { ticker }),
  liveSheet: () => post<{ ok: true; file: string }>('/excel/sheet'),
  csvLive: (on: boolean) => post<{ ok: true; on: boolean; folder?: string; added: number }>('/csv/live', { on }),
  tradingViewWatchlist: () => post<{ ok: true; file: string; count: number; skipped: string[] }>('/tradingview/watchlist'),
  exportHistory: (id: PlatformId) => post<{ ok: true; folder: string; files: number; bars: number }>(`/${id}/export`),
  importChartink: (brokerId: string, text: string, as: 'EQ' | 'FUT') =>
    post<{ ok: true; found: number; added: number; already: number; noFuture: string[]; unknown?: string[] }>('/chartink/import', { brokerId, text, as }),
  reveal: (path: string) => post<{ ok: true }>('/reveal', { path }),
}

// One copy for the whole app (the sidebar, the page and the first-run picker read the same)
let shared: PlatformsState | null = null
const listeners = new Set<(s: PlatformsState) => void>()
let loading: Promise<PlatformsState> | null = null

export function loadPlatforms(refresh = false): Promise<PlatformsState> {
  if (!refresh && loading) return loading
  loading = platformsApi.list(refresh).then(s => {
    shared = s
    listeners.forEach(l => l(s))
    return s
  }).finally(() => { loading = null })
  return loading
}

/** Updates everyone's copy (after choosing platforms or installing something) */
export function setPlatformsState(update: (s: PlatformsState) => PlatformsState) {
  if (!shared) return
  shared = update(shared)
  listeners.forEach(l => l(shared!))
}

export function usePlatforms() {
  const [state, setState] = useState<PlatformsState | null>(shared)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    listeners.add(setState)
    if (!shared) loadPlatforms().catch(e => setError(String(e?.message || e)))
    return () => { listeners.delete(setState) }
  }, [])
  const refresh = useCallback(() => loadPlatforms(true).then(() => setError(null)).catch(e => setError(String(e?.message || e))), [])
  return { state, error, refresh }
}

/** The chart websites the user chose (Chartink first) */
export function useChartSites(): ChartSite[] {
  const { state } = usePlatforms()
  const chosen = state?.chosen || []
  return CHART_SITES.filter(s => chosen.includes(s))
}
