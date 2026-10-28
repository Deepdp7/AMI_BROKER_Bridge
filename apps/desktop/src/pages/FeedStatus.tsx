import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/appStore'
import type { SymbolFeed } from '../store/appStore'
import {
  Activity, TrendingUp, TrendingDown, Minus, Search, RefreshCw, ChevronDown, Check, Star,
  ArrowUp, ArrowDown, Columns3, Pause, Play, X, Rows3, Rows4, ChevronsUpDown,
} from 'lucide-react'
import { TableVirtuoso } from 'react-virtuoso'
import { api, wsManager } from '../api/apiClient'
import { useEngineRefresh } from '../hooks/useApiSync'
import { usePref } from '../hooks/usePref'
import { toast } from '../components/ui/Toast'
import { PageHeader } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import Select from '../components/ui/Select'
import { Sparkline } from '../components/ui/Sparkline'
import { MarketClock } from '../components/feed/MarketClock'
import { StatCards } from '../components/feed/StatCards'
import { MarketPulse } from '../components/feed/MarketPulse'
import { SymbolDrawer } from '../components/symbols/SymbolDrawer'
import { viewRows, filterCounts, nextSort, isLive, trendOf, type FeedFilter, type SortKey, type SortState } from '../lib/feedView'
import { formatAgo, formatPrice } from '../lib/format'
import { useNow } from '../lib/clock'

interface AutoRefreshStatus {
  enabled: boolean
  intervalMin: number
  running: boolean
  lastRunAt: number | null
  lastRunSymbols: number
  nextRunAt: number | null
  lastError: string | null
  progressDone?: number
  progressTotal?: number
  waitingFor?: 'history-download' | null
}

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

/** On/off + interval for the automatic "Refresh All Today" that runs during market hours. */
function AutoRefreshControl({ api: apiUrl }: { api: string }) {
  const [st, setSt] = useState<AutoRefreshStatus | null>(null)

  const load = () => fetch(`${apiUrl}/api/backfill/auto`).then(r => r.json()).then(setSt).catch(() => {})
  useEffect(() => {
    load()
    const off = wsManager.on('auto_refresh', (p: any) => setSt(p))
    return () => { off() }
  }, [apiUrl])
  // Engine restarted / window refocused: reload instead of showing a stale schedule
  useEngineRefresh(load)

  // Re-evaluate the label as time passes (e.g. a due sync that hasn't reported yet)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  // Close the interval menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const update = (body: Partial<Pick<AutoRefreshStatus, 'enabled' | 'intervalMin'>>) =>
    fetch(`${apiUrl}/api/backfill/auto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json()).then(setSt).catch(() => {})

  if (!st) return null
  const on = st.enabled
  const intervalLabel = (m: number) => (m === 1 ? '1 min' : `${m} min`)
  const detail = !on ? 'Paused'
    : st.running ? (st.progressTotal ? `Syncing ${st.progressDone ?? 0}/${st.progressTotal}…` : 'Syncing…')
    : st.waitingFor === 'history-download' ? 'Waiting for history download…'
    : st.nextRunAt && st.nextRunAt < now - 15_000 ? 'Syncing shortly…'
    : st.nextRunAt ? `${st.lastRunAt ? `Synced ${fmtTime(st.lastRunAt)} · ` : ''}next ${fmtTime(st.nextRunAt)}`
    : 'Starts at market open'
  const dotColor = st.lastError ? '#f59e0b' : on ? 'var(--accent)' : '#5b6169'

  return (
    <div
      className="ar-pill"
      title={st.lastError ? `Last error: ${st.lastError}` : "Automatically re-downloads today's exact 1-minute bars from the broker for all symbols during market hours and updates AmiBroker"}
      data-on={on}
    >
      <button className="ar-switch" data-on={on} onClick={() => update({ enabled: !on })} aria-pressed={on} aria-label="Toggle auto-refresh">
        <span />
      </button>
      <span className="ar-label">Auto-refresh</span>

      <div style={{ position: 'relative' }}>
        <button ref={triggerRef} className="ar-trigger" disabled={!on} onClick={() => {
          const r = triggerRef.current?.getBoundingClientRect()
          if (r) setMenuPos({ top: r.bottom + 6, left: r.left + r.width / 2 })
          setMenuOpen(o => !o)
        }} aria-haspopup="listbox" aria-expanded={menuOpen}>
          {intervalLabel(st.intervalMin)}
          <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
        {menuOpen && createPortal(
          <div ref={menuRef} className="ar-menu" role="listbox" style={{ top: menuPos.top, left: menuPos.left }}>
            <div className="ar-menu-title">Refresh every</div>
            {[1, 2, 3, 5, 10, 15, 30].map(m => (
              <button
                key={m}
                role="option"
                aria-selected={m === st.intervalMin}
                className="ar-option"
                data-active={m === st.intervalMin}
                onClick={() => { update({ intervalMin: m }); setMenuOpen(false) }}
              >
                {intervalLabel(m)}
                {m === st.intervalMin && <Check size={13} />}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      <span className="ar-status">
        <span className="ar-dot" data-pulse={on && st.running} style={{ background: dotColor, boxShadow: on ? `0 0 6px ${dotColor}` : 'none' }} />
        {detail}
      </span>

      <style>{`
        .ar-pill { display: inline-flex; align-items: center; gap: 0.6rem; height: 32px; padding: 0 0.7rem 0 0.45rem;
          border-radius: 10px; font-size: 0.74rem; color: #a1a7b0;
          background: rgb(var(--s2-rgb) / 0.7); border: 1px solid rgba(255,255,255,0.07);
          transition: border-color .2s, background .2s; }
        .ar-pill[data-on="true"] { border-color: rgb(var(--accent-rgb) / 0.28);
          background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.10), rgba(56,189,248,0.05)); }
        .ar-switch { position: relative; width: 30px; height: 18px; border-radius: 999px; border: none; padding: 0;
          cursor: pointer; background: #3a3a3a; transition: background .2s; flex-shrink: 0; }
        .ar-switch[data-on="true"] { background: linear-gradient(135deg, var(--accent), #0ea5a0); }
        .ar-switch span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
          background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35); transition: transform .3s cubic-bezier(.34,1.56,.64,1); }
        .ar-switch[data-on="true"] span { transform: translateX(12px); }
        .ar-label { font-weight: 600; color: #eceef2; letter-spacing: -0.01em; }
        .ar-pill[data-on="false"] .ar-label { color: #a1a7b0; }
        .ar-trigger { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); color: #eceef2;
          font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s; }
        .ar-trigger:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgb(var(--accent-rgb) / 0.4); }
        .ar-trigger:disabled { opacity: .45; cursor: not-allowed; }
        .ar-menu { position: fixed; transform: translateX(-50%); z-index: 9999;
          min-width: 140px; padding: 4px; border-radius: 10px; background: rgb(var(--s2-rgb)); opacity: 1;
          border: 1px solid rgba(255,255,255,0.09); box-shadow: 0 12px 32px rgba(0,0,0,.55);
          animation: ar-pop .12s ease-out; }
        .ar-menu-title { padding: 6px 10px 4px; font-size: 0.62rem; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #5b6169; }
        .ar-option { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px;
          padding: 6px 10px; border: none; border-radius: 6px; background: transparent; color: #d1d5db;
          font-size: 0.78rem; cursor: pointer; text-align: left; }
        .ar-option:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .ar-option[data-active="true"] { background: rgb(var(--accent-rgb) / 0.14); color: var(--accent); font-weight: 600; }
        .ar-status { display: inline-flex; align-items: center; gap: 6px; color: #8b9199; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ar-dot[data-pulse="true"] { animation: ar-pulse 1s ease-in-out infinite; }
        @keyframes ar-pop { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes ar-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
      `}</style>
    </div>
  )
}

// ===== Table cells =====

/** Price that flashes green or red when it moves */
function PriceCell({ sym }: { sym: SymbolFeed }) {
  const prev = useRef(sym.lastPrice)
  const [flash, setFlash] = useState<{ dir: 'up' | 'down'; n: number } | null>(null)
  useEffect(() => {
    if (sym.lastPrice && prev.current && sym.lastPrice !== prev.current) {
      setFlash({ dir: sym.lastPrice > prev.current ? 'up' : 'down', n: Date.now() })
    }
    prev.current = sym.lastPrice
  }, [sym.lastPrice])

  const isUp = sym.changePercent > 0
  const Icon = sym.changePercent === 0 ? Minus : isUp ? TrendingUp : TrendingDown
  const color = sym.changePercent === 0 ? '#8b9199' : isUp ? 'var(--good)' : '#f43f5e'
  return (
    <div key={flash?.n} className={flash ? `flash-${flash.dir}` : undefined} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, padding: '2px 6px', margin: '-2px -6px', borderRadius: 6 }}>
      <span style={{ fontWeight: 600, fontSize: '0.86rem', fontFamily: 'JetBrains Mono, monospace', color: '#eceef2' }}>
        {sym.lastPrice ? formatPrice(sym.lastPrice) : '—'}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color }}>
        <Icon size={11} />
        {isUp ? '+' : ''}{(sym.changePercent || 0).toFixed(2)}%
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: SymbolFeed['status'] }) {
  const map: Record<SymbolFeed['status'], { cls: string; label: string }> = {
    STREAMING: { cls: 'badge-green', label: 'Streaming' },
    RECEIVING: { cls: 'badge-green', label: 'Receiving' },
    SUBSCRIBED: { cls: 'badge-blue', label: 'Subscribed' },
    STALE: { cls: 'badge-amber', label: 'Stale' },
    CLOSED: { cls: 'badge-gray', label: 'Closed' },
    ERROR: { cls: 'badge-red', label: 'Error' },
  }
  const { cls, label } = map[status] || { cls: 'badge-gray', label: status }
  return (
    <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {(status === 'STREAMING' || status === 'RECEIVING') && <span className="status-dot connected" style={{ width: 6, height: 6 }} />}
      {status === 'SUBSCRIBED' && <span className="status-dot" style={{ width: 6, height: 6, background: '#3b82f6' }} />}
      {label}
    </span>
  )
}

/** "42s ago", moving on by itself each second (only this label redraws) */
function TickAge({ ms }: { ms: number }) {
  const now = useNow()
  const age = ms ? (now - ms) / 1000 : Infinity
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem', color: age < 3 ? 'var(--good)' : age < 15 ? '#f59e0b' : '#8b9199' }}>
      {formatAgo(ms, now)}
    </span>
  )
}

// ===== Columns =====

type ColKey = 'exchange' | 'trend' | 'lastTick' | 'barsPerMin' | 'latency' | 'today'
const COLUMN_LABELS: Record<ColKey, string> = {
  exchange: 'Exchange', trend: 'Trend', lastTick: 'Last tick', barsPerMin: 'Bars/min', latency: 'Delay', today: 'Refresh today',
}
const DEFAULT_COLS: Record<ColKey, boolean> = { exchange: true, trend: true, lastTick: true, barsPerMin: true, latency: true, today: true }

function ColumnsMenu({ cols, setCols }: { cols: Record<ColKey, boolean>; setCols: (c: Record<ColKey, boolean>) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="icon-btn" data-on={open} onClick={() => setOpen(o => !o)} aria-expanded={open} title="Choose columns">
        <Columns3 size={14} /> Columns
      </button>
      {open && (
        <div className="select-menu" style={{ position: 'absolute', top: 38, right: 0, minWidth: 190, zIndex: 50 }}>
          <div className="ar-menu-title" style={{ padding: '6px 10px 4px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b6169' }}>Show columns</div>
          {(Object.keys(COLUMN_LABELS) as ColKey[]).map(k => (
            <label key={k} className="select-option" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={cols[k] !== false} onChange={e => setCols({ ...cols, [k]: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
              <span className="select-label">{COLUMN_LABELS[k]}</span>
            </label>
          ))}
          <button className="select-option" style={{ width: '100%', border: 'none', background: 'none', color: '#8b9199', fontSize: '0.76rem' }} onClick={() => setCols(DEFAULT_COLS)}>
            Show all
          </button>
        </div>
      )}
    </div>
  )
}

interface TableContext { pinned: Set<string>; open: (ticker: string) => void }
// Defined once: new components on every render would remount every row (and lose the price flashes)
const TABLE_COMPONENTS = {
  Table: ({ style, context: _c, ...props }: any) => <table {...props} style={{ ...style, width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }} />,
  TableRow: ({ item, context, ...props }: any) => (
    <tr
      {...props}
      className="feed-row"
      data-pinned={(context as TableContext).pinned.has(item.ticker)}
      onClick={() => (context as TableContext).open(item.ticker)}
      title={`Open ${item.ticker}`}
    />
  ),
}

const FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All', streaming: 'Streaming', stale: 'Stale', gainers: 'Gainers', losers: 'Losers', pinned: 'Pinned',
}

export function FeedStatusPage() {
  // One selector each: the page redraws only for what it shows
  const liveSymbols = useAppStore(s => s.symbols)
  const coreStats = useAppStore(s => s.coreStats)
  const brokers = useAppStore(s => s.brokers)
  const marketStatus = useAppStore(s => s.marketStatus)
  const [frozen, setFrozen] = useState<{ at: number; symbols: SymbolFeed[] } | null>(null)
  const symbols = frozen?.symbols ?? liveSymbols

  const [search, setSearch] = useState('')
  const [filter, setFilter] = usePref<FeedFilter>('feed.filter', 'all')
  const [exchange, setExchange] = useState('ALL')
  const [sort, setSort] = usePref<SortState>('feed.sort', { key: null, dir: 1 })
  const [density, setDensity] = usePref<'comfortable' | 'compact'>('feed.density', 'comfortable')
  const [cols, setCols] = usePref<Record<ColKey, boolean>>('feed.columns', DEFAULT_COLS)
  const [pinnedList, setPinnedList] = usePref<string[]>('feed.pinned', [])
  const pinned = useMemo(() => new Set(pinnedList), [pinnedList])
  const [drawer, setDrawer] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({})
  const [refreshAllBusy, setRefreshAllBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const API = 'http://127.0.0.1:7890'

  // "/" jumps to the search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]')
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const togglePin = useCallback((ticker: string) => {
    setPinnedList(list => list.includes(ticker) ? list.filter(t => t !== ticker) : [...list, ticker])
  }, [setPinnedList])

  async function refreshToday(ticker: string) {
    setRefreshing(prev => ({ ...prev, [ticker]: true }))
    try {
      await api.refreshToday({ ticker })
    } catch (e: any) {
      toast.error("Couldn't refresh today", e?.message || String(e))
    } finally {
      setTimeout(() => setRefreshing(prev => ({ ...prev, [ticker]: false })), 1500)
    }
  }

  async function refreshAllToday() {
    setRefreshAllBusy(true)
    try {
      const r = await api.refreshToday({ all: true })
      toast.success("Today's bars re-downloading", `${r.queued ?? 0} symbols${r.skipped ? ` (${r.skipped} have no connected broker)` : ''}. AmiBroker updates as each one arrives.`, 6000)
    } catch (e: any) {
      toast.error("Couldn't refresh today", e?.message || String(e))
    } finally {
      setTimeout(() => setRefreshAllBusy(false), 1500)
    }
  }

  const exchanges = useMemo(() => Array.from(new Set(symbols.map(s => s.exchange).filter(Boolean))).sort(), [symbols])
  const counts = useMemo(() => filterCounts(symbols, pinned), [symbols, pinned])
  const rows = useMemo(() => viewRows(symbols, { search, filter, exchange, sort, pinned }), [symbols, search, filter, exchange, sort, pinned])
  const streamingCount = useMemo(() => liveSymbols.filter(isLive).length, [liveSymbols])

  const activeBroker = brokers.find(b => b.status === 'connected') || brokers[0]
  const brokerName = activeBroker?.label || activeBroker?.brokerType?.toUpperCase() || 'your broker'
  const tableContext = useMemo<TableContext>(() => ({ pinned, open: setDrawer }), [pinned])
  const compact = density === 'compact'
  const cellPad = compact ? '0.45rem 1rem' : '0.8rem 1rem'

  const Th = ({ k, label, width, align }: { k?: SortKey; label: string; width?: string; align?: 'left' | 'center' | 'right' }) => {
    const active = k && sort.key === k
    return (
      <th style={{ padding: '0.7rem 1rem', width, textAlign: align || 'left', color: active ? 'var(--accent)' : '#8b9199', fontWeight: 650, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {k ? (
          <button
            onClick={() => setSort(nextSort(sort, k))}
            title={`Sort by ${label.toLowerCase()}`}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {label}
            {active ? (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />}
          </button>
        ) : label}
      </th>
    )
  }

  return (
    <div style={{ width: '100%', flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <PageHeader
        icon={Activity}
        title="Live Market Feed"
        subtitle={marketStatus === 'open'
          ? `Prices are streaming from ${brokerName} into AmiBroker`
          : marketStatus === 'closed'
            ? 'The market is closed. History is available; live prices resume at 09:15 IST.'
            : `Real-time prices from ${brokerName}`}
        actions={
          <>
            <MarketClock status={marketStatus} />
            <AutoRefreshControl api={API} />
            <button
              className="icon-btn"
              onClick={refreshAllToday}
              disabled={refreshAllBusy || symbols.length === 0}
              title="Download today's 1-minute bars again for every symbol (fixes gaps after a restart)"
              style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.35)', background: 'rgba(56,189,248,0.1)' }}
            >
              <RefreshCw size={13} style={{ animation: refreshAllBusy ? 'spin 1s linear infinite' : 'none' }} />
              {refreshAllBusy ? 'Refreshing…' : 'Refresh all today'}
            </button>
          </>
        }
      />

      <StatCards stats={coreStats} total={liveSymbols.length} live={streamingCount} />

      <MarketPulse symbols={symbols} onOpen={setDrawer} />

      {/* Toolbar */}
      <div className="glass-card reveal" style={{ ['--i' as any]: 6, padding: '0.7rem 0.8rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200, maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search symbols…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); (e.target as HTMLInputElement).blur() } }}
            className="input-field"
            style={{ paddingLeft: '2.25rem', paddingRight: '2.2rem', height: 32, fontSize: '0.8rem' }}
          />
          {search
            ? <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
            : <span className="kbd" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>/</span>}
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {(Object.keys(FILTER_LABELS) as FeedFilter[]).filter(f => f !== 'pinned' || counts.pinned > 0 || filter === 'pinned').map(f => (
            <button key={f} className="chip" data-on={filter === f} onClick={() => setFilter(f)}>
              {f === 'pinned' && <Star size={11} fill="currentColor" />}
              {FILTER_LABELS[f]}
              <span className="chip-count">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {exchanges.length > 1 && (
            <Select
              value={exchange}
              onChange={setExchange}
              width={130}
              height={32}
              fontSize="0.78rem"
              options={[{ value: 'ALL', label: 'All exchanges' }, ...exchanges.map(e => ({ value: e, label: e }))]}
            />
          )}
          <Segmented
            ariaLabel="Row size"
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: <Rows3 size={13} />, title: 'Roomy rows' },
              { value: 'compact', label: <Rows4 size={13} />, title: 'Compact rows (more on screen)' },
            ]}
          />
          <ColumnsMenu cols={cols} setCols={setCols} />
          <button
            className="icon-btn"
            data-on={!!frozen}
            onClick={() => setFrozen(f => f ? null : { at: Date.now(), symbols: liveSymbols })}
            title={frozen ? 'Show live prices again' : 'Hold the table still to read it. AmiBroker keeps getting every tick.'}
          >
            {frozen ? <Play size={13} /> : <Pause size={13} />} {frozen ? 'Resume' : 'Pause view'}
          </button>
        </div>
      </div>

      {frozen && (
        <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.9rem', borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', fontSize: '0.78rem', color: '#a1a7b0' }}>
          <Pause size={14} color="#38bdf8" />
          <span><b style={{ color: '#eceef2' }}>View paused at {new Date(frozen.at).toLocaleTimeString('en-IN')}.</b> Live data still flows to AmiBroker; only this table is holding still.</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setFrozen(null)}><Play size={12} /> Resume</button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card reveal" style={{ ['--i' as any]: 7, flex: 1, minHeight: 420, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {rows.length === 0 ? (
          <div style={{ margin: 'auto', padding: '3.5rem', textAlign: 'center', color: '#8b9199' }}>
            <div className="pop-in" style={{ width: 64, height: 64, margin: '0 auto 1rem', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.2)' }}>
              <Activity size={28} color="var(--accent)" />
            </div>
            <div style={{ fontSize: '0.95rem', color: '#eceef2', fontWeight: 650 }}>
              {symbols.length === 0 ? 'No symbols yet' : 'Nothing matches'}
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
              {symbols.length === 0 ? 'Add symbols in Symbol Setup and they appear here with live prices.' : 'Try another search or filter.'}
            </div>
            {symbols.length > 0 && (search || filter !== 'all' || exchange !== 'ALL') && (
              <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setSearch(''); setFilter('all'); setExchange('ALL') }}>Clear filters</button>
            )}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0 }}>
            <TableVirtuoso
              style={{ height: '100%' }}
              data={rows}
              computeItemKey={(_, s) => s.ticker}
              fixedHeaderContent={() => (
                <tr style={{ background: 'rgb(var(--s0-rgb))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Th k="ticker" label="Symbol" width="22%" />
                  {cols.exchange !== false && <Th k="exchange" label="Exchange" width="9%" />}
                  <Th k="change" label="Price / change" width="15%" />
                  {cols.trend !== false && <Th label="Trend" width="11%" />}
                  {cols.lastTick !== false && <Th k="lastTick" label="Last tick" width="11%" />}
                  {cols.barsPerMin !== false && <Th k="barsPerMin" label="Bars/min" width="8%" />}
                  {cols.latency !== false && <Th k="latency" label="Delay" width="8%" />}
                  {cols.today !== false && <Th label="Today" width="8%" align="center" />}
                  <Th k="status" label="Status" width="10%" align="right" />
                </tr>
              )}
              itemContent={(_, sym) => {
                const isPinned = pinned.has(sym.ticker)
                const trend = trendOf(sym.ticker, sym.lastPrice)
                const trendUp = trend.length > 1 && trend[trend.length - 1] >= trend[0]
                return (
                  <>
                    <td style={{ padding: cellPad, fontWeight: 600, color: '#eceef2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={e => { e.stopPropagation(); togglePin(sym.ticker) }}
                          className="pin-btn"
                          data-on={isPinned}
                          aria-label={isPinned ? `Unpin ${sym.ticker}` : `Pin ${sym.ticker}`}
                          title={isPinned ? 'Unpin' : 'Pin to the top'}
                        >
                          <Star size={13} fill={isPinned ? 'currentColor' : 'none'} />
                        </button>
                        <span style={{ fontSize: '0.86rem' }}>{sym.ticker || 'Unknown'}</span>
                        <span className="badge badge-gray" style={{ fontSize: '0.64rem', padding: '0.05rem 0.4rem' }}>{sym.instrumentType || 'EQ'}</span>
                      </div>
                    </td>
                    {cols.exchange !== false && (
                      <td style={{ padding: cellPad }}>
                        <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>{sym.exchange || 'NSE'}</span>
                      </td>
                    )}
                    <td style={{ padding: cellPad }}><PriceCell sym={sym} /></td>
                    {cols.trend !== false && (
                      <td style={{ padding: cellPad }}>
                        {trend.length > 1
                          ? <Sparkline data={trend} color={trendUp ? 'var(--good)' : '#f43f5e'} width={84} height={compact ? 18 : 24} />
                          : <span style={{ display: 'block', width: 84, height: 1, background: 'rgba(255,255,255,0.08)' }} />}
                      </td>
                    )}
                    {cols.lastTick !== false && (
                      <td style={{ padding: cellPad }}><TickAge ms={sym.lastTickUtcMs} /></td>
                    )}
                    {cols.barsPerMin !== false && (
                      <td style={{ padding: cellPad, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: sym.barsPerMin > 0 ? 'var(--good)' : '#6b727c' }}>
                        {sym.barsPerMin || 0}/m
                      </td>
                    )}
                    {cols.latency !== false && (
                      <td style={{ padding: cellPad, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: (sym.internalLatencyMs || 0) < 50 ? 'var(--good)' : '#f59e0b' }}>
                        {sym.internalLatencyMs || 0}ms
                      </td>
                    )}
                    {cols.today !== false && (
                      <td style={{ padding: cellPad, textAlign: 'center' }}>
                        <button
                          className="today-btn"
                          onClick={e => { e.stopPropagation(); refreshToday(sym.ticker) }}
                          disabled={!!refreshing[sym.ticker]}
                          title={`Download today's bars for ${sym.ticker} again`}
                        >
                          <RefreshCw size={10} style={{ animation: refreshing[sym.ticker] ? 'spin 1s linear infinite' : 'none' }} />
                          {refreshing[sym.ticker] ? '…' : 'Today'}
                        </button>
                      </td>
                    )}
                    <td style={{ padding: cellPad, textAlign: 'right' }}>
                      <StatusBadge status={sym.status} />
                    </td>
                  </>
                )
              }}
              context={tableContext}
              components={TABLE_COMPONENTS}
            />
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.72rem', color: '#575d66', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <span>Showing {rows.length.toLocaleString()} of {symbols.length.toLocaleString()}</span>
        <span>Click a row for details · <span className="kbd">/</span> to search · ★ pins a symbol to the top</span>
      </div>

      <SymbolDrawer ticker={drawer} onClose={() => setDrawer(null)} pinned={drawer ? pinned.has(drawer) : false} onTogglePin={drawer ? () => togglePin(drawer) : undefined} />

      <style>{`
        .feed-row { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s ease; cursor: pointer; }
        .feed-row:hover { background: rgb(var(--accent-rgb) / 0.045); }
        .feed-row[data-pinned="true"] { background: linear-gradient(90deg, rgba(250,204,21,0.06), transparent 40%); }
        .pin-btn { background: none; border: none; padding: 2px; cursor: pointer; color: #3e3e3e; display: inline-flex; transition: color .15s, transform .2s cubic-bezier(.34,1.56,.64,1); }
        .feed-row:hover .pin-btn { color: #6b727c; }
        .pin-btn:hover { color: #facc15 !important; transform: scale(1.2); }
        .pin-btn[data-on="true"] { color: #facc15; }
        .today-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.7rem;
          font-weight: 700; cursor: pointer; border: 1px solid rgba(56,189,248,0.3); background: rgba(56,189,248,0.08); color: #38bdf8; transition: all 0.15s; }
        .today-btn:hover:not(:disabled) { background: rgba(56,189,248,0.18); box-shadow: 0 0 10px rgba(56,189,248,0.25); }
        .today-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
