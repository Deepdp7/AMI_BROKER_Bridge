import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/appStore'
import type { SymbolFeed } from '../store/appStore'
import { Activity, TrendingUp, TrendingDown, Minus, Search, Cpu, HardDrive, Clock, Zap, Radio, Globe, RefreshCw, ChevronDown, Check } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { TableVirtuoso } from 'react-virtuoso'
import { wsManager } from '../api/apiClient'
import { useEngineRefresh } from '../hooks/useApiSync'

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
function AutoRefreshControl({ api }: { api: string }) {
  const [st, setSt] = useState<AutoRefreshStatus | null>(null)

  const load = () => fetch(`${api}/api/backfill/auto`).then(r => r.json()).then(setSt).catch(() => {})
  useEffect(() => {
    load()
    const off = wsManager.on('auto_refresh', (p: any) => setSt(p))
    return () => { off() }
  }, [api])
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
    fetch(`${api}/api/backfill/auto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
  const dotColor = st.lastError ? '#f59e0b' : on ? '#00d4aa' : '#5b6169'

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
          background: rgba(28,28,28, 0.7); border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(8px); transition: border-color .2s, background .2s; }
        .ar-pill[data-on="true"] { border-color: rgba(0,212,170,0.28);
          background: linear-gradient(135deg, rgba(0,212,170,0.10), rgba(56,189,248,0.05)); }
        .ar-switch { position: relative; width: 30px; height: 18px; border-radius: 999px; border: none; padding: 0;
          cursor: pointer; background: #3a3a3a; transition: background .2s; flex-shrink: 0; }
        .ar-switch[data-on="true"] { background: linear-gradient(135deg, #00d4aa, #0ea5a0); }
        .ar-switch span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
          background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35); transition: transform .2s cubic-bezier(.4,0,.2,1); }
        .ar-switch[data-on="true"] span { transform: translateX(12px); }
        .ar-label { font-weight: 600; color: #eceef2; letter-spacing: -0.01em; }
        .ar-pill[data-on="false"] .ar-label { color: #a1a7b0; }
        .ar-trigger { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.04); color: #eceef2;
          font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s; }
        .ar-trigger:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(0,212,170,0.4); }
        .ar-trigger:disabled { opacity: .45; cursor: not-allowed; }
        .ar-menu { position: fixed; transform: translateX(-50%); z-index: 9999;
          min-width: 140px; padding: 4px; border-radius: 10px; background: #1b1b1b; opacity: 1;
          border: 1px solid rgba(255,255,255,0.09); box-shadow: 0 12px 32px rgba(0,0,0,.55);
          animation: ar-pop .12s ease-out; }
        .ar-menu-title { padding: 6px 10px 4px; font-size: 0.62rem; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #5b6169; }
        .ar-option { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px;
          padding: 6px 10px; border: none; border-radius: 6px; background: transparent; color: #d1d5db;
          font-size: 0.78rem; cursor: pointer; text-align: left; }
        .ar-option:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .ar-option[data-active="true"] { background: rgba(0,212,170,0.14); color: #00d4aa; font-weight: 600; }
        .ar-status { display: inline-flex; align-items: center; gap: 6px; color: #8b9199; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ar-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ar-dot[data-pulse="true"] { animation: ar-pulse 1s ease-in-out infinite; }
        @keyframes ar-pop { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes ar-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
      `}</style>
    </div>
  )
}
// Mini sparkline data store
const sparkData: Record<string, number[]> = {}

function getSparkData(ticker: string, price: number): number[] {
  if (!sparkData[ticker]) sparkData[ticker] = []
  sparkData[ticker].push(price)
  if (sparkData[ticker].length > 20) sparkData[ticker].shift()
  return [...sparkData[ticker]]
}

function PriceCell({ sym }: { sym: SymbolFeed }) {
  const isUp = sym.change >= 0
  const Icon = isUp ? TrendingUp : sym.change === 0 ? Minus : TrendingDown
  const color = isUp ? '#00d4aa' : '#f43f5e'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ fontWeight: 600, fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace', color: '#eceef2' }}>
        ₹{sym.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color }}>
        <Icon size={11} />
        {isUp ? '+' : ''}{sym.changePercent.toFixed(2)}%
      </div>
    </div>
  )
}

function SparkLine({ ticker, price }: { ticker: string; price: number }) {
  const data = getSparkData(ticker, price)
  if (data.length < 2) return <div style={{ width: 80, height: 28 }} />
  
  const isUp = data[data.length - 1] >= data[0]
  const color = isUp ? '#00d4aa' : '#f43f5e'
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  const width = 80
  const height = 24
  
  const points = data.map((v, i) => {
    const x = (i / (Math.max(20, data.length) - 1)) * width
    const y = height - ((v - min) / range) * height + 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height + 4} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      {(status === 'STREAMING' || status === 'RECEIVING' || status === 'SUBSCRIBED') && <span className={`status-dot ${status !== 'SUBSCRIBED' ? 'connected' : ''}`} style={{ width: 6, height: 6, backgroundColor: status === 'SUBSCRIBED' ? '#3b82f6' : undefined }} />}
      {label}
    </span>
  )
}

function LastTickTime({ ms }: { ms: number }) {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (!ms || ms === 0) return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#8b9199' }}>—</span>
  const diff = Math.floor((Date.now() - ms) / 1000)
  const color = diff < 3 ? '#00d4aa' : diff < 15 ? '#f59e0b' : '#8b9199'
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color, fontWeight: 500 }}>
      {diff < 1 ? 'Just now' : `${diff}s ago`}
    </span>
  )
}

function StatCard({ label, value, sub, icon: Icon, color = '#00d4aa' }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string
}) {
  return (
    <div className="metric-card animate-fade-in" style={{ flex: 1, minWidth: '160px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#8b9199', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {label}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em' }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: '0.72rem', color: '#5b6169', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
        <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  )
}

export function FeedStatusPage() {
  const { symbols, coreStats, brokers, marketStatus } = useAppStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'streaming' | 'stale'>('all')
  const [refreshingToday, setRefreshingToday] = useState<Record<string, boolean>>({})
  const [refreshAllBusy, setRefreshAllBusy] = useState(false)

  const API = 'http://127.0.0.1:7890'

  async function refreshToday(ticker: string) {
    setRefreshingToday(prev => ({ ...prev, [ticker]: true }))
    try {
      await fetch(`${API}/api/backfill/today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })
    } catch (e) { /* ignore */ } finally {
      setTimeout(() => setRefreshingToday(prev => ({ ...prev, [ticker]: false })), 2000)
    }
  }

  async function refreshAllToday() {
    setRefreshAllBusy(true)
    try {
      for (const sym of symbols) {
        if (!sym.ticker) continue
        await fetch(`${API}/api/backfill/today`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: sym.ticker }),
        })
        await new Promise(r => setTimeout(r, 100)) // small delay between calls
      }
    } catch (e) { /* ignore */ } finally {
      setTimeout(() => setRefreshAllBusy(false), 2000)
    }
  }

  const filtered = symbols.filter(s => {
    const matchSearch = (s.ticker || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.exchange || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'streaming' && (s.status === 'STREAMING' || s.status === 'RECEIVING')) || (filter === 'stale' && s.status === 'STALE')
    return matchSearch && matchFilter
  })

  const streamingCount = symbols.filter(s => s.status === 'STREAMING' || s.status === 'RECEIVING').length

  const activeBroker = brokers.find(b => b.status === 'connected') || brokers[0]
  const brokerName = activeBroker?.label || activeBroker?.brokerType?.toUpperCase() || 'Broker'

  return (
    <div style={{ width: '100%', flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#eceef2', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: '#00d4aa' }} />
            Live Market Feed Status
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#8b9199', margin: '0.25rem 0 0' }}>
            {marketStatus === 'open'
              ? `Market is OPEN — live data streaming via ${brokerName}`
              : marketStatus === 'closed'
              ? 'Market is CLOSED — historical data available. Streaming resumes at 09:15 IST.'
              : `Real-time market data streaming via ${brokerName}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Market status badge */}
          {marketStatus !== 'unknown' && (
            <span
              className={`badge ${marketStatus === 'open' ? 'badge-green' : 'badge-amber'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
            >
              <span
                className="status-dot"
                style={{
                  width: 7, height: 7,
                  background: marketStatus === 'open' ? '#00d4aa' : '#f59e0b',
                  boxShadow: marketStatus === 'open' ? '0 0 6px #00d4aa' : 'none',
                  animation: marketStatus === 'open' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
              Market {marketStatus === 'open' ? 'Open' : 'Closed'}
            </span>
          )}
          <span className={`badge ${streamingCount > 0 ? 'badge-green' : 'badge-gray'}`}>
            <span className={`status-dot ${streamingCount > 0 ? 'connected' : ''}`} style={{ width: 6, height: 6 }} />
            {streamingCount} / {symbols.length} Streaming
          </span>
          <AutoRefreshControl api={API} />
          {/* Global Refresh All Today button */}
          <button
            onClick={refreshAllToday}
            disabled={refreshAllBusy}
            title="Force-fetch today's bars for ALL symbols (fixes gaps from app restarts)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.35rem 0.85rem', borderRadius: '6px', fontSize: '0.74rem',
              fontWeight: 700, cursor: refreshAllBusy ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.12)',
              color: '#38bdf8', transition: 'all 0.15s', opacity: refreshAllBusy ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshAllBusy ? 'spin 1s linear infinite' : 'none' }} />
            {refreshAllBusy ? 'Refreshing...' : '↻ Refresh All Today'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <StatCard
          label="Active Symbols"
          value={String(symbols.length)}
          sub={`${streamingCount} receiving ticks`}
          icon={Radio}
          color="#00d4aa"
        />
        <StatCard
          label="Engine Throughput"
          value={`${coreStats.messagesPerSec || 0}/s`}
          sub="Live ticks & 1s bars"
          icon={Zap}
          color="#38bdf8"
        />
        <StatCard
          label="CPU Usage"
          value={`${coreStats.cpuPercent || 0}%`}
          sub="Core engine process"
          icon={Cpu}
          color="#a78bfa"
        />
        <StatCard
          label="Memory (RAM)"
          value={`${coreStats.ramMb || 0}MB`}
          sub={`Uptime: ${Math.floor((coreStats.uptimeSec || 0) / 60)}m`}
          icon={HardDrive}
          color={coreStats.ramMb < 250 ? '#00d4aa' : '#f59e0b'}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
          <input
            type="text"
            placeholder="Search live symbols by ticker or exchange..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.25rem', height: '34px', fontSize: '0.8rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {(['all', 'streaming', 'stale'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.04)',
                border: filter === f ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,255,255,0.06)',
                color: filter === f ? '#00d4aa' : '#a1a7b0',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Table Container */}
      <div className="glass-card" style={{ flex: 1, minHeight: '420px', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#8b9199' }}>
            <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <div style={{ fontSize: '0.9rem', color: '#a1a7b0', fontWeight: 600 }}>No matching symbols in feed</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Add symbols in Symbol Setup or adjust your search filter.</div>
          </div>
        ) : (
          <div style={{ height: '560px', width: '100%' }}>
            <TableVirtuoso
              data={filtered}
              fixedHeaderContent={() => (
                <tr style={{ background: 'rgba(12,12,12, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '20%' }}>Symbol</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '8%' }}>Exchange</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%' }}>LTP / Change</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '12%' }}>20s Trend</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%' }}>Last Tick</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '7%' }}>Bars/Min</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '7%' }}>Latency</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'center' }}>↻ Today</th>
                  <th style={{ padding: '0.75rem 1.25rem', color: '#8b9199', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '12%', textAlign: 'right' }}>Status</th>
                </tr>
              )}
              itemContent={(index, sym) => (
                <>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#eceef2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.88rem' }}>{sym.ticker || 'Unknown Symbol'}</span>
                      <span className="badge badge-gray" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                        {sym.instrumentType || 'EQ'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="badge badge-gray" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                      {sym.exchange || 'NSE'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <PriceCell sym={sym} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <SparkLine ticker={sym.ticker} price={sym.lastPrice} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <LastTickTime ms={sym.lastTickUtcMs} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: sym.barsPerMin > 0 ? '#00d4aa' : '#8b9199' }}>
                      {sym.barsPerMin || 0}/m
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: sym.internalLatencyMs < 50 ? '#00d4aa' : '#f59e0b' }}>
                      {sym.internalLatencyMs || 0}ms
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                    <button
                      onClick={() => refreshToday(sym.ticker)}
                      disabled={!!refreshingToday[sym.ticker]}
                      title={`Force-fetch today's bars for ${sym.ticker}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.7rem',
                        fontWeight: 700, cursor: refreshingToday[sym.ticker] ? 'not-allowed' : 'pointer',
                        border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)',
                        color: '#38bdf8', transition: 'all 0.15s',
                        opacity: refreshingToday[sym.ticker] ? 0.5 : 1,
                      }}
                    >
                      <RefreshCw size={10} style={{ animation: refreshingToday[sym.ticker] ? 'spin 1s linear infinite' : 'none' }} />
                      {refreshingToday[sym.ticker] ? '...' : 'Today'}
                    </button>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <StatusBadge status={sym.status} />
                  </td>
                </>
              )}
              components={{
                Table: ({ style, ...props }) => <table {...props} style={{ ...style, width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }} />,
                TableRow: ({ item, ...props }) => (
                  <tr
                    {...props}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  />
                )
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
