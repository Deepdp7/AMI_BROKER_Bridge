import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { SymbolFeed } from '../store/appStore'
import { Activity, TrendingUp, TrendingDown, Minus, Search, Cpu, HardDrive, Clock, Zap, Radio, Globe } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { TableVirtuoso } from 'react-virtuoso'
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
      <div style={{ fontWeight: 600, fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace', color: '#e2eaf4' }}>
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
  if (!ms || ms === 0) return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#6b8099' }}>—</span>
  const diff = Math.floor((Date.now() - ms) / 1000)
  const color = diff < 3 ? '#00d4aa' : diff < 15 ? '#f59e0b' : '#6b8099'
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
          <div style={{ fontSize: '0.72rem', color: '#6b8099', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            {label}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em' }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: '0.72rem', color: '#4b6078', marginTop: '0.25rem' }}>{sub}</div>}
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2eaf4', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: '#00d4aa' }} />
            Live Market Feed Status
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#6b8099', margin: '0.25rem 0 0' }}>
            {marketStatus === 'open'
              ? `Market is OPEN — live data streaming via ${brokerName}`
              : marketStatus === 'closed'
              ? 'Market is CLOSED — historical data available. Streaming resumes at 09:15 IST.'
              : `Real-time market data streaming via ${brokerName}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b8099' }} />
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
                color: filter === f ? '#00d4aa' : '#94a3b8',
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
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#6b8099' }}>
            <Activity size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>No matching symbols in feed</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Add symbols in Symbol Setup or adjust your search filter.</div>
          </div>
        ) : (
          <div style={{ height: '560px', width: '100%' }}>
            <TableVirtuoso
              data={filtered}
              fixedHeaderContent={() => (
                <tr style={{ background: 'rgba(5, 12, 20, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '22%' }}>Symbol</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%' }}>Exchange</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '16%' }}>LTP / Change</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%' }}>20s Trend</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '12%' }}>Last Tick</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '8%' }}>Bars/Min</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '8%' }}>Latency</th>
                  <th style={{ padding: '0.75rem 1.25rem', color: '#6b8099', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%', textAlign: 'right' }}>Status</th>
                </tr>
              )}
              itemContent={(index, sym) => (
                <>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#e2eaf4' }}>
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
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: sym.barsPerMin > 0 ? '#00d4aa' : '#6b8099' }}>
                      {sym.barsPerMin || 0}/m
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: sym.internalLatencyMs < 50 ? '#00d4aa' : '#f59e0b' }}>
                      {sym.internalLatencyMs || 0}ms
                    </span>
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
