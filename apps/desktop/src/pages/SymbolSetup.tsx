import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import type { SymbolFeed } from '../store/appStore'
import { api, BASE_URL } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import Select from '../components/ui/Select'
import { PageHeader } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { Dialog, confirmDialog } from '../components/ui/Dialog'
import { CancelledHistoryNotice, UnknownSymbolsNotice } from '../components/status/CancelledHistoryNotice'
import { SymbolDrawer } from '../components/symbols/SymbolDrawer'
import { VirtualGrid } from '../components/ui/VirtualGrid'
import { useDataHealth, DataHealthSummary, HealthLine, needsAttention, type SymbolHealth } from '../components/status/DataHealth'
import {
  List, Search, Plus, Trash2, TrendingUp, TrendingDown, CheckCircle, X, Loader, Upload, Download,
  LayoutGrid, Rows3, ChevronDown, CheckSquare, RefreshCw, Wrench, FileUp, CornerDownLeft, CalendarClock,
} from 'lucide-react'
import { usePref } from '../hooks/usePref'
import { useThrottledSymbols } from '../hooks/useThrottledSymbols'
import { useSymbolDetails } from '../hooks/useSymbolDetails'
import SymbolLogo from '../components/ui/SymbolLogo'
import { ChartLinkIcons } from '../components/platforms/OpenChart'
import { MonthOfFutures } from '../components/symbols/MonthOfFutures'
import { expiryOf, isExpired, monthLabel, todayIst, type Expiry } from '../lib/expiry'
import { formatPrice, plural } from '../lib/format'

const EXCHANGE_FILTERS = [
  { label: 'ALL', value: 'ALL' },
  { label: 'EQ (NSE)', value: 'NSE-10' },
  { label: 'FUTSTK (NFO)', value: 'NFO-12' },
  { label: 'FUTIDX (NFO)', value: 'NFO-11' },
  { label: 'OPTIDX (NFO)', value: 'NFO-13' },
  { label: 'OPTSTK (NFO)', value: 'NFO-14' },
  { label: 'FUTCOM (MCX)', value: 'MCX-11' },
  { label: 'OPTFUT (MCX)', value: 'MCX-12' },
  { label: 'FUTIDX (MCX)', value: 'MCX-13' },
  { label: 'OPTIDX (MCX)', value: 'MCX-14' },
]

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  EQ:    { bg: 'rgb(var(--accent-rgb) / 0.15)',  color: 'var(--accent)', label: 'EQ' },
  FUT:   { bg: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', label: 'FUT' },
  OPT:   { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'OPT' },
  INDEX: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', label: 'IDX' },
}
const typeBadge = (t: string) => TYPE_BADGE[t] || { bg: 'rgba(255,255,255,0.08)', color: '#8899aa', label: t }

const EXCHANGE_GROUPS = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']

// Tall enough for a long contract name whose "FUT" and "Lot" tags wrap onto a second line
const CARD_HEIGHT = 182
const ROW_HEIGHT = 44
const symKey = (s: SymbolFeed) => s.ticker

type SortBy = 'default' | 'name' | 'change' | 'price' | 'history'
const HISTORY_ORDER: Record<string, number> = { empty: 0, missing: 1, downloading: 2, cancelled: 3, complete: 4 }

function TypeTag({ type }: { type: string }) {
  const b = typeBadge(type)
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 4, background: b.bg, color: b.color, border: `1px solid ${b.color}44` }}>
      {b.label}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'STREAMING' || status === 'RECEIVING' ? 'badge-green' : status === 'STALE' ? 'badge-amber' : status === 'ERROR' ? 'badge-red' : 'badge-gray'
  return <span className={`badge ${cls}`} style={{ fontSize: '0.62rem', padding: '0.12rem 0.5rem', textTransform: 'capitalize' }}>{status.toLowerCase()}</span>
}

/**
 * The entrance animation plays only while the page is opening. Cards are drawn again whenever
 * scrolling brings them back into view, and they must not fade in again every time.
 */
const INTRO_MS = 1400
let introUntil = 0
/** True for cards that mount while the page is still opening (decided once, when the card mounts) */
const useIntro = (index: number) => useState(() => index < 24 && Date.now() < introUntil)[0]

interface CardProps {
  sym: SymbolFeed
  index: number
  isSelected: boolean
  selectionMode: boolean
  health?: SymbolHealth
  healthLoading: boolean
  repairing: boolean
  /** Lot size from the broker's list (0 = not known) */
  lot: number
  onClick: (ticker: string, e: React.MouseEvent) => void
  onRemove: (ticker: string) => void
  onRepair: (ticker: string) => void
}

const SymbolCard = React.memo(({ sym, index, isSelected, selectionMode, health, healthLoading, repairing, lot, onClick, onRemove, onRepair }: CardProps) => {
  const up = sym.changePercent >= 0
  const intro = useIntro(index)
  return (
    <div
      onClick={e => onClick(sym.ticker, e)}
      id={`symbol-chip-${(sym.ticker || 'unknown').replace(' ', '-')}`}
      className={intro ? 'sym-card reveal' : 'sym-card'}
      data-selected={isSelected}
      style={{ ['--i' as any]: Math.min(index, 14) }}
      title={selectionMode ? 'Click to select · Shift-click selects a range' : 'Click for details'}
    >
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        {selectionMode && (
          <span className="sym-check" data-on={isSelected} aria-hidden="true">{isSelected && <CheckCircle size={14} />}</span>
        )}
        <SymbolLogo ticker={sym.ticker} exchange={sym.exchange} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#eceef2', fontSize: '0.9rem', letterSpacing: '0.01em' }}>{sym.ticker}</span>
            <TypeTag type={sym.instrumentType} />
            {lot > 1 && <span className="lot-tag" title="Bought in whole lots only (AmiBroker: Round lot size)">Lot {lot.toLocaleString('en-IN')}</span>}
          </div>
          {sym.rawSymbol && sym.rawSymbol !== sym.ticker && (
            <div style={{ fontSize: '0.64rem', color: '#575d66', marginTop: '0.15rem', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sym.rawSymbol}
            </div>
          )}
          <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem', fontWeight: 650, color: sym.lastPrice ? '#eceef2' : '#575d66' }}>
              {sym.lastPrice > 0 ? formatPrice(sym.lastPrice) : '—'}
            </span>
            {sym.lastPrice > 0 && sym.changePercent !== 0 && (
              <span style={{ fontSize: '0.7rem', fontWeight: 650, color: up ? 'var(--good)' : '#f43f5e', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {up ? '+' : ''}{sym.changePercent.toFixed(2)}%
              </span>
            )}
          </div>
          <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <StatusPill status={sym.status} />
          </div>
          <HealthLine health={health} loading={healthLoading} onRepair={() => onRepair(sym.ticker)} repairing={repairing} />
        </div>
        {!selectionMode && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(sym.ticker) }}
            className="sym-remove"
            title="Remove symbol"
            aria-label={`Remove ${sym.ticker}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {!selectionMode && <ChartLinkIcons sym={sym} />}
    </div>
  )
})

const SymbolRow = React.memo(({ sym, index, isSelected, selectionMode, health, healthLoading, repairing, lot, onClick, onRemove, onRepair }: CardProps) => {
  const up = sym.changePercent >= 0
  const intro = useIntro(index)
  return (
    <div onClick={e => onClick(sym.ticker, e)} className={intro ? 'sym-row reveal' : 'sym-row'} data-selected={isSelected} style={{ ['--i' as any]: Math.min(index, 14) }} id={`symbol-chip-${(sym.ticker || 'unknown').replace(' ', '-')}`}>
      {selectionMode && <span className="sym-check" data-on={isSelected} aria-hidden="true">{isSelected && <CheckCircle size={14} />}</span>}
      <SymbolLogo ticker={sym.ticker} exchange={sym.exchange} size={26} />
      <span style={{ fontWeight: 700, color: '#eceef2', fontSize: '0.84rem', width: 150, marginLeft: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sym.ticker}</span>
      <span style={{ width: 44 }}><TypeTag type={sym.instrumentType} /></span>
      <span style={{ width: 72 }}>{lot > 1 && <span className="lot-tag" title="Bought in whole lots only (AmiBroker: Round lot size)">Lot {lot.toLocaleString('en-IN')}</span>}</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#eceef2', width: 110, textAlign: 'right' }}>{sym.lastPrice > 0 ? formatPrice(sym.lastPrice) : '—'}</span>
      <span style={{ fontSize: '0.74rem', fontWeight: 650, color: sym.changePercent === 0 ? '#6b727c' : up ? 'var(--good)' : '#f43f5e', width: 64, textAlign: 'right' }}>
        {sym.lastPrice > 0 ? `${up ? '+' : ''}${sym.changePercent.toFixed(2)}%` : ''}
      </span>
      <span style={{ width: 86, paddingLeft: 8 }}><StatusPill status={sym.status} /></span>
      <span className="health-line" style={{ flex: 1, minWidth: 180 }}><HealthLine health={health} loading={healthLoading} onRepair={() => onRepair(sym.ticker)} repairing={repairing} /></span>
      {!selectionMode && <ChartLinkIcons sym={sym} size={20} />}
      {!selectionMode && (
        <button onClick={e => { e.stopPropagation(); onRemove(sym.ticker) }} className="sym-remove" title="Remove symbol" aria-label={`Remove ${sym.ticker}`}>
          <X size={14} />
        </button>
      )}
    </div>
  )
})

export function SymbolSetupPage() {
  // Prices at most once a second here: redrawing 500 cards on every tick made the page sluggish
  const symbols = useThrottledSymbols(1000)
  const details = useSymbolDetails()
  const brokers = useAppStore(s => s.brokers)
  const addSymbol = useAppStore(s => s.addSymbol)
  const removeSymbol = useAppStore(s => s.removeSymbol)
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')
  const [localTypeFilter, setLocalTypeFilter] = useState('ALL')
  const [exchangeFilter, setExchangeFilter] = useState('ALL')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [addedThisTime, setAddedThisTime] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const localSearchRef = useRef<HTMLInputElement>(null)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set())
  const lastClicked = useRef<string | null>(null)
  const health = useDataHealth()
  // The cards fade in once while the page opens (see useIntro); scrolling never replays it
  useState(() => { introUntil = Date.now() + INTRO_MS })
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [view, setView] = usePref<'grid' | 'list'>('symbols.view', 'grid')
  const [sortBy, setSortBy] = usePref<SortBy>('symbols.sort', 'default')
  const [collapsed, setCollapsed] = usePref<string[]>('symbols.collapsed', [])
  const [drawer, setDrawer] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState<'today' | 'repair' | 'delete' | null>(null)
  /** Removing many: how far it got */
  const [removed, setRemoved] = useState<{ done: number; total: number } | null>(null)
  /** 'ALL', 'EXPIRED' or a month ("2026-11") */
  const [expiryFilter, setExpiryFilter] = useState('ALL')

  const activeBrokerId = brokers.find(b => b.status === 'connected')?.id || brokers[0]?.id || ''
  const brokerOf = useCallback((ticker: string) => useAppStore.getState().symbols.find(s => s.ticker === ticker)?.brokerId || activeBrokerId, [activeBrokerId])

  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await api.searchSymbols(activeBrokerId, search, exchangeFilter !== 'ALL' ? exchangeFilter : undefined)
        setSearchResults(res || [])
        setActiveResult(0)
      } catch (e) {
        console.error(e)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [search, exchangeFilter, brokers])

  // "/" searches the list; Escape leaves selection mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]')
      if (e.key === '/' && !typing && !showSearch) { e.preventDefault(); localSearchRef.current?.focus() }
      if (e.key === 'Escape' && selectionMode && !showSearch && !drawer) { setSelectionMode(false); setSelectedTickers(new Set()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectionMode, showSearch, drawer])

  const isAdded = (ticker: string) => symbols.some(s => s.ticker === ticker)

  const handleAdd = async (sym: any) => {
    if (!sym.ticker || isAdded(sym.ticker)) return
    if (!activeBrokerId) { toast.error('No Broker', 'Please connect a broker first'); return }
    try {
      await api.addSymbolsToBroker(activeBrokerId, [sym])
      addSymbol({
        ticker: sym.ticker!,
        exchange: sym.exchange as any || 'NSE',
        instrumentType: sym.instrumentType as any || 'EQ',
        brokerId: activeBrokerId,
        lastPrice: sym.lastPrice || 0,
        prevClose: sym.lastPrice || 0,
        lastTickUtcMs: 0,
        barsPerMin: 0,
        internalLatencyMs: 0,
        status: 'SUBSCRIBED',
        change: 0,
        changePercent: 0,
        volume: 0,
      })
      setAddedThisTime(list => [sym.ticker, ...list.filter(t => t !== sym.ticker)].slice(0, 8))
      toast.success('Symbol added', `${sym.ticker} is streaming and its history is downloading.`, 3000)
    } catch (e: any) {
      console.error('Failed to add symbol to broker backend', e)
      toast.error('Add Failed', e.message || 'Could not add symbol to backend')
    }
  }

  /** A whole month of futures was added in the engine: show them right away */
  const addFuturesToList = (list: Array<{ ticker: string; exchange: string }>) => {
    for (const c of list) {
      if (isAdded(c.ticker)) continue
      addSymbol({
        ticker: c.ticker, exchange: (c.exchange || 'NFO') as any, instrumentType: 'FUT' as any, brokerId: activeBrokerId,
        lastPrice: 0, prevClose: 0, lastTickUtcMs: 0, barsPerMin: 0, internalLatencyMs: 0, status: 'SUBSCRIBED',
        change: 0, changePercent: 0, volume: 0,
      })
    }
    setAddedThisTime(prev => [...list.map(c => c.ticker).slice(0, 8), ...prev].slice(0, 8))
  }

  const removeOne = async (ticker: string) => {
    try { await api.removeSymbolFromBroker(brokerOf(ticker), ticker) } catch (e) { console.error('Failed to remove symbol from backend', e) }
    removeSymbol(ticker)
  }

  const handleRemove = useCallback(async (ticker: string) => {
    const ok = await confirmDialog({
      title: `Remove ${ticker}?`,
      message: 'It stops streaming to AmiBroker. Its downloaded history is deleted too.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    await removeOne(ticker)
    setDrawer(d => d === ticker ? null : d)
    toast.success('Removed', `${ticker} was removed.`, 2500)
  }, [brokerOf]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Removes these one after another (each also deletes its stored bars), showing how far it got */
  const removeMany = async (tickers: string[]) => {
    setBulkBusy('delete')
    setRemoved({ done: 0, total: tickers.length })
    try {
      for (let i = 0; i < tickers.length; i++) {
        await removeOne(tickers[i])
        setRemoved({ done: i + 1, total: tickers.length })
      }
    } finally {
      setBulkBusy(null)
      setRemoved(null)
    }
  }

  const handleDeleteSelected = async () => {
    const n = selectedTickers.size
    const ok = await confirmDialog({
      title: `Remove ${plural(n, 'symbol')}?`,
      message: 'They stop streaming to AmiBroker and their downloaded history is deleted.',
      confirmLabel: `Remove ${n}`,
      tone: 'danger',
    })
    if (!ok) return
    await removeMany([...selectedTickers])
    setSelectedTickers(new Set())
    setSelectionMode(false)
    toast.success('Removed', `${plural(n, 'symbol')} removed.`)
  }

  /** Everything the filters show right now (e.g. all October futures, or only RELIANCE's) */
  const handleDeleteFiltered = async () => {
    const tickers = filteredSymbols.map(s => s.ticker)
    const what = expiryFilter === 'EXPIRED' ? 'expired contract' : expiryFilter !== 'ALL' ? `${monthLabel(expiryFilter)} contract` : 'symbol'
    const ok = await confirmDialog({
      title: `Remove ${plural(tickers.length, what)}?`,
      message: `${tickers.slice(0, 6).join(', ')}${tickers.length > 6 ? ` and ${tickers.length - 6} more` : ''} stop streaming to AmiBroker and their downloaded history is deleted.`,
      confirmLabel: `Remove ${tickers.length}`,
      tone: 'danger',
    })
    if (!ok) return
    await removeMany(tickers)
    setSelectedTickers(new Set())
    toast.success('Removed', `${plural(tickers.length, what)} removed.`)
  }

  const handleDeleteAll = async () => {
    const ok = await confirmDialog({
      title: `Remove all ${symbols.length} symbols?`,
      message: 'Everything stops streaming to AmiBroker and all downloaded history is deleted. Export a CSV first if you may want the list back.',
      confirmLabel: 'Remove everything',
      tone: 'danger',
      typeToConfirm: 'DELETE',
    })
    if (!ok) return
    await removeMany(symbols.map(s => s.ticker))
    setSelectionMode(false)
    setSelectedTickers(new Set())
    toast.success('All removed', 'Every symbol has been removed.')
  }

  const refreshSelected = async () => {
    setBulkBusy('today')
    try {
      const r = await api.refreshToday({ tickers: [...selectedTickers] })
      toast.success("Today's bars re-downloading", plural(r.queued ?? 0, 'symbol') + (r.skipped ? ` (${r.skipped} without a broker)` : ''), 5000)
    } catch (e: any) {
      toast.error("Couldn't refresh today", e?.message || String(e))
    } finally { setBulkBusy(null) }
  }

  const repairSelected = async () => {
    setBulkBusy('repair')
    try { await health.repair([...selectedTickers]) } finally { setBulkBusy(null) }
  }

  const handleExport = async () => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    try {
      const res = await fetch(`${BASE_URL}/brokers/${activeBrokerId}/symbols/export`)
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'symbols.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported', `${symbols.length} symbols exported to symbols.csv`)
    } catch (e: any) {
      toast.error('Export Failed', e.message)
    }
  }

  const handleImportFile = async (file: File) => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    if (!/\.(csv|txt)$/i.test(file.name)) return toast.error('Not a CSV file', 'Drop a .csv or .txt file with one symbol per line.')
    setImporting(true)
    try {
      const csv = await file.text()
      const res = await fetch(`${BASE_URL}/brokers/${activeBrokerId}/symbols/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Import Successful', `Added ${data.added} of ${data.total} symbols`)
      window.location.reload()
    } catch (e: any) {
      toast.error('Import Failed', e.message)
    } finally {
      setImporting(false)
    }
  }

  // Drag a CSV file anywhere on the page to import it
  const dragDepth = useRef(0)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true) },
    onDragOver: (e: React.DragEvent) => { if (hasFiles(e)) e.preventDefault() },
    onDragLeave: (e: React.DragEvent) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault(); dragDepth.current = 0; setDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f) handleImportFile(f)
    },
  }

  // ===== What shows =====
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of symbols) m.set(s.instrumentType, (m.get(s.instrumentType) || 0) + 1)
    return m
  }, [symbols])

  // Futures and options by expiry month (the date from the broker list, else from the ticker)
  const expiryOfTicker = useMemo(() => {
    const m = new Map<string, Expiry>()
    for (const s of symbols) {
      const e = expiryOf(s.ticker, details.get(s.ticker)?.expiry)
      if (e) m.set(s.ticker, e)
    }
    return m
  }, [symbols, details])
  const today = todayIst()
  const expiryCounts = useMemo(() => {
    const months = new Map<string, number>()
    let expired = 0
    for (const e of expiryOfTicker.values()) {
      months.set(e.month, (months.get(e.month) || 0) + 1)
      if (isExpired(e, today)) expired++
    }
    return { months: [...months].sort((a, b) => a[0].localeCompare(b[0])), expired }
  }, [expiryOfTicker, today])
  // A month whose symbols were all removed: back to all months
  useEffect(() => {
    if (expiryFilter === 'ALL') return
    if (expiryFilter === 'EXPIRED' ? !expiryCounts.expired : !expiryCounts.months.some(([m]) => m === expiryFilter)) setExpiryFilter('ALL')
  }, [expiryFilter, expiryCounts])

  const filteredSymbols = useMemo(() => {
    const q = localSearch.trim().toLowerCase()
    const matchesExpiry = (ticker: string) => {
      if (expiryFilter === 'ALL') return true
      const e = expiryOfTicker.get(ticker)
      if (!e) return false
      return expiryFilter === 'EXPIRED' ? isExpired(e, today) : e.month === expiryFilter
    }
    const list = symbols.filter(s =>
      (!q || s.ticker.toLowerCase().includes(q) || (s.rawSymbol && s.rawSymbol.toLowerCase().includes(q))) &&
      (localTypeFilter === 'ALL' || s.instrumentType === localTypeFilter) &&
      matchesExpiry(s.ticker) &&
      (!onlyProblems || needsAttention(health.byTicker.get(s.ticker))),
    )
    const by: Record<Exclude<SortBy, 'default'>, (a: SymbolFeed, b: SymbolFeed) => number> = {
      name: (a, b) => a.ticker.localeCompare(b.ticker),
      change: (a, b) => (b.changePercent || 0) - (a.changePercent || 0),
      price: (a, b) => (b.lastPrice || 0) - (a.lastPrice || 0),
      history: (a, b) => (HISTORY_ORDER[health.byTicker.get(a.ticker)?.status ?? 'complete'] - HISTORY_ORDER[health.byTicker.get(b.ticker)?.status ?? 'complete']) || a.ticker.localeCompare(b.ticker),
    }
    // Default: the order they were added in (indices first, as the engine lists them)
    return sortBy === 'default' || !by[sortBy] ? list : list.sort(by[sortBy])
  }, [symbols, localSearch, localTypeFilter, onlyProblems, health.byTicker, sortBy, expiryFilter, expiryOfTicker, today])

  const groups = useMemo(() => {
    const known = EXCHANGE_GROUPS.map(ex => ({ ex, list: filteredSymbols.filter(s => s.exchange === ex) }))
    const other = filteredSymbols.filter(s => !EXCHANGE_GROUPS.includes(s.exchange))
    return [...known, { ex: 'Other', list: other }].filter(g => g.list.length > 0)
  }, [filteredSymbols])
  const visibleOrder = useMemo(() => groups.filter(g => !collapsed.includes(g.ex)).flatMap(g => g.list.map(s => s.ticker)), [groups, collapsed])

  // Stable across updates (reads the latest values from refs), so memoised cards don't redraw
  const visibleOrderRef = useRef(visibleOrder)
  const selectionModeRef = useRef(selectionMode)
  useLayoutEffect(() => { visibleOrderRef.current = visibleOrder; selectionModeRef.current = selectionMode })
  const onCardClick = useCallback((ticker: string, e: React.MouseEvent) => {
    if (!selectionModeRef.current) { setDrawer(ticker); return }
    const visibleOrder = visibleOrderRef.current
    // Read before it moves on: the state update below runs later
    const anchor = e.shiftKey ? lastClicked.current : null
    setSelectedTickers(prev => {
      const next = new Set(prev)
      // Shift-click: everything between the last click and this one
      if (anchor) {
        const a = visibleOrder.indexOf(anchor), b = visibleOrder.indexOf(ticker)
        if (a !== -1 && b !== -1) {
          for (const t of visibleOrder.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(t)
          return next
        }
      }
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
    lastClicked.current = ticker
  }, [])

  const repairOne = useCallback((ticker: string) => { health.repair([ticker]) }, [health.repair])
  const toggleGroup = (ex: string) => setCollapsed(c => c.includes(ex) ? c.filter(x => x !== ex) : [...c, ex])
  const allVisibleSelected = visibleOrder.length > 0 && visibleOrder.every(t => selectedTickers.has(t))

  // Add-symbol dialog: arrows move, Enter adds
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (!searchResults.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveResult(i => Math.min(searchResults.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveResult(i => Math.max(0, i - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); const r = searchResults[activeResult]; if (r) handleAdd(r) }
  }
  useEffect(() => {
    document.getElementById(`search-result-${searchResults[activeResult]?.ticker}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeResult, searchResults])

  const types = ['EQ', 'INDEX', 'FUT', 'OPT'].filter(t => typeCounts.has(t))
  const otherTypes = [...typeCounts.keys()].filter(t => !types.includes(t))

  return (
    <div style={{ width: '100%', flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }} {...dropHandlers}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = '' } }}
      />

      <PageHeader
        icon={List}
        title="Symbol Setup"
        subtitle={`${symbols.length.toLocaleString()} symbols streaming to AmiBroker${brokers.length ? '' : ' · connect a broker to add more'}`}
        actions={
          <>
            <button id="import-symbols-btn" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing} title="Import symbols from a CSV file (or drop the file on this page)">
              {importing ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <button id="export-symbols-btn" className="btn-secondary" onClick={handleExport} disabled={symbols.length === 0} title="Save the symbol list as a CSV file">
              <Upload size={14} /> Export CSV
            </button>
            <button
              className="btn-secondary"
              data-on={selectionMode}
              onClick={() => { setSelectionMode(m => !m); setSelectedTickers(new Set()) }}
              disabled={symbols.length === 0}
              style={selectionMode ? { borderColor: 'rgb(var(--accent-rgb) / 0.45)', color: 'var(--accent)' } : undefined}
            >
              <CheckSquare size={14} /> {selectionMode ? 'Done selecting' : 'Select'}
            </button>
            <button id="add-symbol-btn" className="btn-primary" onClick={() => setShowSearch(true)}>
              <Plus size={15} /> Add Symbol
            </button>
          </>
        }
      />

      <CancelledHistoryNotice />
      <UnknownSymbolsNotice onRemove={removeMany} />

      <div className="reveal" style={{ ['--i' as any]: 1 }}>
        <DataHealthSummary
          list={health.list}
          onRepairAll={() => health.repair()}
          repairing={health.repairingAll}
          onlyProblems={onlyProblems}
          setOnlyProblems={setOnlyProblems}
        />
      </div>

      {/* Toolbar */}
      <div className="glass-card reveal sym-toolbar" style={{ ['--i' as any]: 2 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
          <input
            ref={localSearchRef}
            type="text"
            placeholder="Filter your symbols…"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setLocalSearch(''); (e.target as HTMLInputElement).blur() } }}
            className="input-field"
            style={{ paddingLeft: '2.25rem', paddingRight: '2.2rem', height: 32, fontSize: '0.8rem' }}
          />
          {localSearch
            ? <button onClick={() => setLocalSearch('')} aria-label="Clear filter" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
            : <span className="kbd" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>/</span>}
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button className="chip" data-on={localTypeFilter === 'ALL'} onClick={() => setLocalTypeFilter('ALL')}>All <span className="chip-count">{symbols.length}</span></button>
          {[...types, ...otherTypes].map(t => (
            <button key={t} className="chip" data-on={localTypeFilter === t} onClick={() => setLocalTypeFilter(t)}>
              {t === 'INDEX' ? 'Indices' : t === 'EQ' ? 'Stocks' : t === 'FUT' ? 'Futures' : t === 'OPT' ? 'Options' : t}
              <span className="chip-count">{typeCounts.get(t)}</span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          <Select
            value={sortBy}
            onChange={v => setSortBy(v as SortBy)}
            width={168}
            height={32}
            fontSize="0.78rem"
            options={[
              { value: 'default', label: 'Sort: As added' },
              { value: 'name', label: 'Sort: Name A–Z' },
              { value: 'change', label: 'Sort: Biggest gain' },
              { value: 'price', label: 'Sort: Price' },
              { value: 'history', label: 'Sort: History problems' },
            ]}
          />
          <Segmented
            ariaLabel="Layout"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: <LayoutGrid size={13} />, title: 'Cards' },
              { value: 'list', label: <Rows3 size={13} />, title: 'List' },
            ]}
          />
        </div>
      </div>

      {/* Expiry months: futures / options by month, removed together or picked one by one */}
      {expiryCounts.months.length > 0 && (
        <div className="reveal expiry-bar" style={{ ['--i' as any]: 3 }}>
          <span className="expiry-bar-label"><CalendarClock size={13} /> Expiry</span>
          <button className="chip" data-on={expiryFilter === 'ALL'} onClick={() => setExpiryFilter('ALL')}>All months</button>
          {expiryCounts.expired > 0 && (
            <button className="chip chip-warn" data-on={expiryFilter === 'EXPIRED'} onClick={() => setExpiryFilter('EXPIRED')} title="Contracts whose expiry has passed (they no longer trade)">
              Expired <span className="chip-count">{expiryCounts.expired}</span>
            </button>
          )}
          {expiryCounts.months.map(([m, n]) => (
            <button key={m} className="chip" data-on={expiryFilter === m} onClick={() => setExpiryFilter(m)}>
              {monthLabel(m)} <span className="chip-count">{n}</span>
            </button>
          ))}
          {expiryFilter !== 'ALL' && filteredSymbols.length > 0 && (
            <button
              className="btn-danger"
              style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.76rem' }}
              disabled={bulkBusy !== null}
              onClick={handleDeleteFiltered}
              title={localSearch ? `Only the ones matching "${localSearch}"` : 'Every symbol this filter shows'}
            >
              {bulkBusy === 'delete' && removed
                ? <><Loader size={13} className="animate-spin" /> Removing {removed.done} of {removed.total}…</>
                : <><Trash2 size={13} /> Remove these {filteredSymbols.length}…</>}
            </button>
          )}
        </div>
      )}

      {/* Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingBottom: selectionMode ? '4.5rem' : 0 }}>
        {groups.map(({ ex, list: groupSymbols }) => {
          const open = !collapsed.includes(ex)
          return (
            <div key={ex}>
              <button onClick={() => toggleGroup(ex)} className="group-head" aria-expanded={open}>
                <ChevronDown size={14} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />
                <span className="badge badge-gray" style={{ fontWeight: 700 }}>{ex}</span>
                <span>{plural(groupSymbols.length, 'symbol')}</span>
                {selectionMode && open && (
                  <span
                    role="button"
                    className="chip"
                    style={{ height: 24, marginLeft: 6 }}
                    onClick={e => { e.stopPropagation(); setSelectedTickers(prev => new Set([...prev, ...groupSymbols.map(s => s.ticker)])) }}
                  >
                    Select all {ex}
                  </span>
                )}
              </button>
              <div className="db-collapse" data-open={open}>
                <div>
                  {open && (view === 'grid' ? (
                    <div style={{ paddingTop: '0.75rem' }}>
                      {/* Only the cards on screen are drawn: 500 cards redrawing on each price update was the slow part */}
                      <VirtualGrid
                        items={groupSymbols}
                        minColWidth={220}
                        rowHeight={CARD_HEIGHT}
                        gap={12}
                        getKey={symKey}
                        render={(sym, i) => (
                          <SymbolCard
                          sym={sym}
                          index={i}
                          isSelected={selectedTickers.has(sym.ticker)}
                          selectionMode={selectionMode}
                          health={health.byTicker.get(sym.ticker)}
                          healthLoading={health.list === null}
                          repairing={health.isRepairing(sym.ticker)}
                          lot={details.get(sym.ticker)?.lotSize || 0}
                          onClick={onCardClick}
                          onRemove={handleRemove}
                          onRepair={repairOne}
                        />
                        )}
                      />
                    </div>
                  ) : (
                    <div className="glass-card" style={{ marginTop: '0.75rem', padding: '0.25rem' }}>
                      <VirtualGrid
                        items={groupSymbols}
                        minColWidth={100000 /* one column */}
                        rowHeight={ROW_HEIGHT}
                        gap={0}
                        getKey={symKey}
                        render={(sym, i) => (
                          <SymbolRow
                          sym={sym}
                          index={i}
                          isSelected={selectedTickers.has(sym.ticker)}
                          selectionMode={selectionMode}
                          health={health.byTicker.get(sym.ticker)}
                          healthLoading={health.list === null}
                          repairing={health.isRepairing(sym.ticker)}
                          lot={details.get(sym.ticker)?.lotSize || 0}
                          onClick={onCardClick}
                          onRemove={handleRemove}
                          onRepair={repairOne}
                        />
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {filteredSymbols.length === 0 && (
          <div className="glass-card reveal" style={{ padding: '3rem', textAlign: 'center', color: '#8b9199' }}>
            <div className="pop-in" style={{ width: 66, height: 66, margin: '0 auto 1rem', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.2)' }}>
              {symbols.length ? <Search size={26} color="var(--accent)" /> : <FileUp size={26} color="var(--accent)" />}
            </div>
            <div style={{ fontSize: '0.95rem', color: '#eceef2', fontWeight: 650 }}>{symbols.length ? 'Nothing matches' : 'No symbols yet'}</div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.35rem', lineHeight: 1.55 }}>
              {symbols.length
                ? 'Try another filter.'
                : <>Click <b style={{ color: '#eceef2' }}>Add Symbol</b> to search your broker's list, or drop a CSV file here to add many at once.</>}
            </div>
            {symbols.length > 0 && (
              <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setLocalSearch(''); setLocalTypeFilter('ALL'); setOnlyProblems(false); setExpiryFilter('ALL') }}>Clear filters</button>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.72rem', color: '#575d66' }}>
        Click a symbol for details · <span className="kbd">/</span> to filter · drop a CSV file on this page to import it
      </div>

      {/* Selection bar */}
      {selectionMode && (
        <div className="action-bar" role="toolbar" aria-label="Selected symbols">
          <span style={{ fontSize: '0.82rem', color: '#eceef2', fontWeight: 650, minWidth: 92 }}>
            {selectedTickers.size ? `${selectedTickers.size} selected` : 'Select symbols'}
          </span>
          <button className="icon-btn" onClick={() => setSelectedTickers(allVisibleSelected ? new Set() : new Set(visibleOrder))}>
            {allVisibleSelected ? 'Clear' : `Select all (${visibleOrder.length})`}
          </button>
          <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)' }} />
          <button className="icon-btn" disabled={!selectedTickers.size || bulkBusy !== null} onClick={refreshSelected} title="Download today's bars again for the selected symbols">
            {bulkBusy === 'today' ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh today
          </button>
          <button className="icon-btn" disabled={!selectedTickers.size || bulkBusy !== null} onClick={repairSelected} title="Check the whole history and download missing days">
            {bulkBusy === 'repair' ? <Loader size={13} className="animate-spin" /> : <Wrench size={13} />} Repair history
          </button>
          <button className="btn-danger btn-danger--solid" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }} disabled={!selectedTickers.size || bulkBusy !== null} onClick={handleDeleteSelected}>
            {bulkBusy === 'delete' ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {bulkBusy === 'delete' && removed ? ` Removing ${removed.done} of ${removed.total}…` : ' Remove'}
          </button>
          <button className="icon-btn" onClick={handleDeleteAll} disabled={bulkBusy !== null} title="Remove every symbol" style={{ color: '#fb7185' }}>
            Remove all…
          </button>
          <button className="icon-btn" onClick={() => { setSelectionMode(false); setSelectedTickers(new Set()) }} aria-label="Stop selecting" title="Done (Esc)">
            <X size={14} />
          </button>
        </div>
      )}

      {dragging && (
        <div className="drop-overlay">
          <div>
            <FileUp size={40} color="var(--accent)" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#eceef2' }}>Drop to import symbols</div>
            <div style={{ fontSize: '0.8rem', color: '#8b9199', marginTop: 4 }}>A .csv or .txt file, one symbol per line</div>
          </div>
        </div>
      )}

      <SymbolDrawer ticker={drawer} onClose={() => setDrawer(null)} onRemove={handleRemove} />

      {/* Add symbol */}
      <Dialog open={showSearch} onClose={() => setShowSearch(false)} width={580} top label="Add symbol">
        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)' }} />
              <input
                id="symbol-search-input"
                className="input-field"
                placeholder="Search NSE, NFO, MCX symbols (e.g. RELIANCE, NIFTY)…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                style={{ paddingLeft: '2.4rem', height: 44, fontSize: '0.92rem' }}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button className="icon-btn" onClick={() => setShowSearch(false)} aria-label="Close"><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {EXCHANGE_FILTERS.map(f => (
              <button key={f.value} className="chip" data-on={exchangeFilter === f.value} onClick={() => setExchangeFilter(f.value)} style={{ height: 26, fontSize: '0.7rem' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto', position: 'relative' }}>
          {isSearching && (
            <div style={{ padding: '0.5rem' }}>
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 46, margin: '0.35rem 0.5rem', opacity: 1 - i * 0.2 }} />)}
            </div>
          )}
          {!isSearching && searchResults.length === 0 && search.length >= 2 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8b9199', fontSize: '0.84rem' }}>No matching symbols found.</div>
          )}
          {!isSearching && search.length < 2 && (
            <div style={{ padding: '1.25rem 1.25rem 1.5rem', color: '#8b9199', fontSize: '0.8rem' }}>
              <div style={{ textAlign: 'center' }}>Type a name to search every Indian market contract.</div>
              <MonthOfFutures brokerId={activeBrokerId} isAdded={isAdded} onAdded={addFuturesToList} />
              {addedThisTime.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#575d66', marginBottom: 6 }}>Added just now</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {addedThisTime.map(t => <span key={t} className="badge badge-green pop-in"><CheckCircle size={10} /> {t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
          {!isSearching && searchResults.map((sym, i) => {
            const added = isAdded(sym.ticker!)
            const active = i === activeResult
            return (
              <div
                key={sym.ticker}
                id={`search-result-${sym.ticker}`}
                className="search-result reveal"
                data-active={active}
                data-added={added}
                style={{ ['--i' as any]: Math.min(i, 10) }}
                onMouseEnter={() => setActiveResult(i)}
                onClick={() => !added && handleAdd(sym)}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
                  <SymbolLogo ticker={sym.ticker!} exchange={sym.exchange} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, color: '#eceef2', fontSize: '0.88rem' }}>{sym.ticker}</div>
                    <div style={{ fontSize: '0.72rem', color: '#8b9199', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{sym.exchange || 'NSE'}</span> ·
                      <span>{sym.name || sym.instrumentType}</span>
                      {sym.lotSize > 1 && <span style={{ color: 'var(--accent)', fontWeight: 650 }}> · Lot {Number(sym.lotSize).toLocaleString('en-IN')}</span>}
                      {sym.tickSize > 0 && <span> · Tick {sym.tickSize}</span>}
                    </div>
                  </div>
                </div>
                {added ? (
                  <span className="badge badge-green pop-in" style={{ fontSize: '0.7rem' }}><CheckCircle size={10} /> Added</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {active && <span className="kbd" title="Press Enter to add"><CornerDownLeft size={10} /></span>}
                    <button className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}><Plus size={12} /> Add</button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: '#575d66', display: 'flex', gap: '0.9rem' }}>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
          <span><span className="kbd">Enter</span> add</span>
          <span><span className="kbd">Esc</span> close</span>
          <span style={{ marginLeft: 'auto' }}>Add as many as you like; this stays open</span>
        </div>
      </Dialog>

      <style>{`
        .sym-toolbar { padding: 0.65rem 0.8rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
          position: sticky; top: 0.5rem; z-index: 20; background: rgb(var(--s1-rgb) / 0.97); }
        .sym-card { background: linear-gradient(160deg, rgb(var(--s3-rgb) / 0.7), rgb(var(--s1-rgb) / 0.6)); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px; padding: 0.85rem 0.9rem; cursor: pointer; position: relative; height: 100%; overflow: hidden;
          transition: transform .25s cubic-bezier(.2,.8,.2,1), border-color .2s, box-shadow .25s; }
        .sym-card:hover { transform: translateY(-2px); border-color: rgb(var(--accent-rgb) / 0.25); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
        .sym-card[data-selected="true"], .sym-row[data-selected="true"] { border-color: rgb(var(--accent-rgb) / 0.6); box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.5), 0 0 22px rgb(var(--accent-rgb) / 0.12); background: rgb(var(--accent-rgb) / 0.06); }
        .sym-row { display: flex; align-items: center; gap: 0.8rem; padding: 0 0.8rem; height: 100%; border-radius: 8px; cursor: pointer;
          border: 1px solid transparent; transition: background .15s, border-color .15s; overflow: hidden; }
        .sym-row .health-line > div { margin-top: 0 !important; }
        .sym-row:hover { background: rgb(var(--accent-rgb) / 0.04); }
        .sym-check { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid #575d66; display: inline-flex; align-items: center; justify-content: center;
          color: var(--on-accent); flex-shrink: 0; transition: all .2s cubic-bezier(.34,1.56,.64,1); }
        .sym-check[data-on="true"] { background: var(--accent); border-color: var(--accent); transform: scale(1.08); }
        .sym-remove { background: none; border: none; color: #3e3e3e; cursor: pointer; padding: 3px; border-radius: 6px; display: flex; transition: color .15s, background .15s; }
        .sym-card:hover .sym-remove, .sym-row:hover .sym-remove { color: #8b9199; }
        .sym-remove:hover { color: #fb7185 !important; background: rgba(244,63,94,0.12); }
        .group-head { all: unset; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 650; color: #a1a7b0; padding: 0.2rem 0; }
        .group-head:hover { color: #eceef2; }
        .search-result { padding: 0.7rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
          border-left: 2px solid transparent; cursor: pointer; transition: background .12s, border-color .12s; }
        .search-result[data-active="true"] { background: rgb(var(--accent-rgb) / 0.06); border-left-color: var(--accent); }
        .search-result[data-added="true"] { cursor: default; }
      `}</style>
    </div>
  )
}
