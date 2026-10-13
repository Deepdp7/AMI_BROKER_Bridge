import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Search, Trash2, Download, Pause, Play, RotateCw, Terminal } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { api, wsManager, type ConsoleLine } from '../api/apiClient'
import { toast } from '../components/Toast'

const MAX_LINES = 3000

const LEVEL_COLORS: Record<ConsoleLine['level'], string> = {
  error: '#f43f5e',
  warn: '#f59e0b',
  info: '#d1d5db',
  log: '#d1d5db',
  debug: '#8b9199',
}

// Plain terminal look: text exactly as the engine prints it; only problems are coloured
function lineColor(l: ConsoleLine): string {
  if (l.level === 'error' || /\b(ERROR|FAILED|Uncaught|Error:)/.test(l.text)) return LEVEL_COLORS.error
  if (l.level === 'warn' || /\bWARN|Rate limit|429/.test(l.text)) return LEVEL_COLORS.warn
  return LEVEL_COLORS[l.level]
}

const isTauri = !!(window as any).__TAURI_INTERNALS__

/**
 * Live output of the background data engine — the same text the old separate
 * terminal window showed. The engine now runs hidden inside the app.
 */
export function ConsolePage() {
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const [search, setSearch] = useState('')
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [hideTicks, setHideTicks] = useState(false)
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(wsManager.isConnected)
  const listRef = useRef<VirtuosoHandle>(null)
  const pausedRef = useRef(paused)
  const bufferedRef = useRef<ConsoleLine[]>([])
  pausedRef.current = paused

  const append = useCallback((incoming: ConsoleLine[]) => {
    if (incoming.length === 0) return
    setLines(prev => {
      const lastSeq = prev.length ? prev[prev.length - 1].seq : 0
      // Engine restarted → its sequence numbers start over from 1; keep history, accept all new lines
      const restarted = incoming[incoming.length - 1].seq < lastSeq
      const fresh = restarted ? incoming : incoming.filter(l => l.seq > lastSeq)
      const next = prev.concat(fresh)
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
    })
  }, [])

  const loadSnapshot = useCallback(async () => {
    try {
      const { lines: snapshot } = await api.getConsole(MAX_LINES)
      setLines(snapshot)
    } catch { /* engine offline — live lines will arrive after reconnect */ }
  }, [])

  useEffect(() => {
    loadSnapshot()
    const offLines = wsManager.on('console_lines', (payload: any) => {
      const incoming: ConsoleLine[] = payload?.lines || []
      if (pausedRef.current) bufferedRef.current.push(...incoming)
      else append(incoming)
    })
    const offOpen = wsManager.on('open', () => { setConnected(true); loadSnapshot() })
    const offClose = wsManager.on('close', () => setConnected(false))
    return () => { offLines(); offOpen(); offClose() }
  }, [append, loadSnapshot])

  useEffect(() => {
    if (!paused && bufferedRef.current.length) {
      append(bufferedRef.current)
      bufferedRef.current = []
    }
  }, [paused, append])

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = lines.filter(l => {
      if (hideTicks && (l.text.startsWith('[Live Tick]') || l.text.startsWith('[IPC_LIVE_BAR]'))) return false
      if (problemsOnly && l.level !== 'error' && l.level !== 'warn' && !/error|fail|warn|429/i.test(l.text)) return false
      return !q || l.text.toLowerCase().includes(q)
    })
    return filtered
  }, [lines, search, problemsOnly, hideTicks])

  const handleSave = () => {
    const text = lines.map(l => `${new Date(l.ts).toISOString()} ${l.text}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `databridge-console-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Console Saved', `${lines.length} lines saved.`)
  }

  const handleRestart = async () => {
    try {
      await invoke('restart_backend')
      toast.info('Restarting Engine', 'The data engine is restarting — data resumes in a few seconds.', 4000)
    } catch (e: any) {
      toast.error('Restart Failed', String(e?.message || e))
    }
  }

  const toggleStyle = (active: boolean) => ({
    background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
    color: active ? '#00d4aa' : '#8b9199',
    border: 'none',
    borderRadius: '6px',
    padding: '0.25rem 0.6rem',
    fontSize: '0.72rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  })

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.72rem', color: connected ? '#00d4aa' : '#f43f5e', flexShrink: 0 }}>
            <Terminal size={14} />
            {connected ? 'Engine running' : 'Engine offline'}
          </div>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
            <input
              type="text"
              placeholder="Filter output (ticker, error, Backfill...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(23,23,23,0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setProblemsOnly(!problemsOnly)} style={toggleStyle(problemsOnly)}>Problems</button>
            <button onClick={() => setHideTicks(!hideTicks)} style={toggleStyle(hideTicks)}>Hide ticks</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setPaused(!paused)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {paused ? <Play size={13} style={{ color: '#00d4aa' }} /> : <Pause size={13} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={() => setLines([])} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Trash2 size={13} />
            Clear
          </button>
          <button onClick={handleSave} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Download size={13} />
            Save
          </button>
          {isTauri && (
            <button onClick={handleRestart} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <RotateCw size={13} />
              Restart engine
            </button>
          )}
        </div>
      </div>

      <div
        className="selectable"
        style={{
          flex: 1,
          minHeight: 0,
          background: '#000000',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '0.75rem 0 0.75rem 1rem',
          fontFamily: 'JetBrains Mono, Consolas, monospace',
          fontSize: '0.78rem',
          lineHeight: 1.45,
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {displayed.length === 0 ? (
          <div style={{ color: '#5b6169', textAlign: 'center', marginTop: '2rem' }}>
            {connected ? 'Waiting for engine output...' : 'Data engine is not reachable — it restarts automatically.'}
          </div>
        ) : (
          // Only the visible rows are in the DOM, so thousands of lines stay smooth
          <Virtuoso
            ref={listRef}
            style={{ height: '100%' }}
            data={displayed}
            computeItemKey={(_, l) => `${l.ts}-${l.seq}`}
            followOutput={autoScroll ? 'auto' : false}
            atBottomStateChange={setAutoScroll}
            atBottomThreshold={40}
            initialTopMostItemIndex={displayed.length - 1}
            increaseViewportBy={400}
            itemContent={(_, l) => (
              <div style={{ color: lineColor(l), whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: '1rem' }}>
                {l.text}
              </div>
            )}
          />
        )}
      </div>
    </div>
  )
}
