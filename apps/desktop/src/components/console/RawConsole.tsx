/**
 * RawConsole
 * The engine's output exactly as it prints it: the Technical tab of the Activity page,
 * for support and troubleshooting. Only problems are coloured.
 */
import { useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Search, Trash2, Pause, Play } from 'lucide-react'
import type { ConsoleLine } from '../../api/apiClient'

const LEVEL_COLORS: Record<ConsoleLine['level'], string> = {
  error: '#f43f5e',
  warn: '#f59e0b',
  info: '#d1d5db',
  log: '#d1d5db',
  debug: '#8b9199',
}

function lineColor(l: ConsoleLine): string {
  if (l.level === 'error' || /\b(ERROR|FAILED|Uncaught|Error:)/.test(l.text)) return LEVEL_COLORS.error
  if (l.level === 'warn' || /\bWARN|Rate limit|429/.test(l.text)) return LEVEL_COLORS.warn
  return LEVEL_COLORS[l.level]
}

const toggleStyle = (active: boolean) => ({
  background: active ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent',
  color: active ? 'var(--accent)' : '#8b9199',
  border: 'none',
  borderRadius: '6px',
  padding: '0.25rem 0.6rem',
  fontSize: '0.72rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
})

export function RawConsole({ lines, connected }: { lines: ConsoleLine[]; connected: boolean }) {
  const [search, setSearch] = useState('')
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [hideTicks, setHideTicks] = useState(true)
  const [frozen, setFrozen] = useState<ConsoleLine[] | null>(null)
  const [clearedTs, setClearedTs] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<VirtuosoHandle>(null)

  // Paused: the screen keeps the lines it had, new ones are not lost, they show after Resume
  const source = frozen ?? lines

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    return source.filter(l => {
      if (l.ts <= clearedTs) return false
      if (hideTicks && (l.text.startsWith('[Live Tick]') || l.text.startsWith('[IPC_LIVE_BAR]'))) return false
      if (problemsOnly && l.level !== 'error' && l.level !== 'warn' && !/error|fail|warn|429/i.test(l.text)) return false
      return !q || l.text.toLowerCase().includes(q)
    })
  }, [source, search, problemsOnly, hideTicks, clearedTs])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
          <input
            type="text"
            placeholder="Filter the output (a symbol name, error, Backfill...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.8rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgb(var(--s1-rgb) / 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setProblemsOnly(!problemsOnly)} style={toggleStyle(problemsOnly)}>Problems only</button>
          <button onClick={() => setHideTicks(!hideTicks)} style={toggleStyle(hideTicks)}>Hide price ticks</button>
        </div>
        <button onClick={() => setFrozen(frozen ? null : lines)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {frozen ? <Play size={13} style={{ color: 'var(--accent)' }} /> : <Pause size={13} />}
          {frozen ? 'Resume' : 'Freeze'}
        </button>
        <button onClick={() => setClearedTs(Date.now())} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Trash2 size={13} />
          Clear screen
        </button>
      </div>

      <div
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
            {connected ? 'Nothing to show.' : 'The data service is not reachable. It restarts automatically.'}
          </div>
        ) : (
          // Only the visible rows are in the DOM, so thousands of lines stay smooth
          <Virtuoso
            ref={listRef}
            style={{ height: '100%' }}
            data={displayed}
            computeItemKey={(_, l) => `${l.ts}-${l.seq}`}
            followOutput={autoScroll && !frozen ? 'auto' : false}
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
