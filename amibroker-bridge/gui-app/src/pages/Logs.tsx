import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { LogLevel } from '../store/appStore'
import { Search, Trash2, Download, AlertCircle, AlertTriangle, Info, Bug, Pause, Play } from 'lucide-react'
import { toast } from '../components/Toast'

const LEVEL_ICONS: Record<LogLevel, React.ElementType> = {
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
  debug: Bug,
}
const LEVEL_COLORS: Record<LogLevel, string> = {
  error: '#f43f5e',
  warn: '#f59e0b',
  info: '#94a3b8',
  debug: '#6b8099',
}

export function LogsPage() {
  const { logs, clearLogs } = useAppStore()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [componentFilter, setComponentFilter] = useState('All')
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [displayCount] = useState(300)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [frozenLogs, setFrozenLogs] = useState(logs)

  useEffect(() => {
    if (!paused) {
      setFrozenLogs(logs)
    }
  }, [logs, paused])

  useEffect(() => {
    if (autoScroll && !paused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [frozenLogs, autoScroll, paused])

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(isAtBottom)
  }, [])

  const filtered = frozenLogs.filter(l => {
    const matchSearch = l.message.toLowerCase().includes(search.toLowerCase()) ||
      l.component.toLowerCase().includes(search.toLowerCase())
    const matchLevel = levelFilter === 'all' || l.level === levelFilter
    const matchComponent = componentFilter === 'All' || l.component === componentFilter
    return matchSearch && matchLevel && matchComponent
  })

  const displayed = filtered.slice(-displayCount)

  const handleExport = () => {
    const text = logs.map(l => `[${new Date(l.ts).toISOString()}] [${l.level.toUpperCase()}] [${l.component}] ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `databridge-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Logs Exported', `Saved ${logs.length} log entries.`)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-IN', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '1rem' }}>
      {/* Top Controls Card */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b8099' }} />
            <input
              type="text"
              placeholder="Search logs by message or ticker..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
            />
          </div>

          {/* Quick Level Filter */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(10,22,40,0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['all', 'info', 'warn', 'error'] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                style={{
                  background: levelFilter === lvl ? (lvl === 'error' ? 'rgba(244,63,94,0.2)' : 'rgba(0,212,170,0.15)') : 'transparent',
                  color: levelFilter === lvl ? (lvl === 'error' ? '#f43f5e' : '#00d4aa') : '#6b8099',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.72rem',
                  fontWeight: levelFilter === lvl ? 700 : 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setPaused(!paused)}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {paused ? <Play size={13} style={{ color: '#00d4aa' }} /> : <Pause size={13} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={clearLogs}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Trash2 size={13} />
            Clear
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Terminal View Log Console */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          background: 'rgba(5, 12, 20, 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '1rem',
          overflowY: 'auto',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.78rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {displayed.length === 0 ? (
          <div style={{ color: '#475569', textAlign: 'center', marginTop: '2rem' }}>
            No log entries matching current filter.
          </div>
        ) : (
          displayed.map((l, i) => {
            const color = LEVEL_COLORS[l.level] || '#94a3b8'
            return (
              <div
                key={l.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  lineHeight: 1.6,
                  padding: '2px 0',
                }}
              >
                <span style={{ color: '#475569', flexShrink: 0, fontSize: '0.72rem' }}>
                  {formatTime(l.ts)}
                </span>
                <span style={{
                  color,
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}>
                  {l.level}
                </span>
                <span style={{ color: '#38bdf8', fontWeight: 600, flexShrink: 0 }}>
                  [{l.component}]
                </span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>
                  {l.message}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
