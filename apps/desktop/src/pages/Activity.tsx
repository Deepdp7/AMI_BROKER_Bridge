import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, RotateCw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { api, wsManager, type ConsoleLine } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import { buildActivity } from '../lib/activity'
import { StatusStrip } from '../components/console/StatusStrip'
import { ActivityFeed } from '../components/console/ActivityFeed'
import { RawConsole } from '../components/console/RawConsole'

const MAX_LINES = 3000
const VIEW_KEY = 'databridge-activity-view'

type View = 'simple' | 'technical'

const isTauri = !!(window as any).__TAURI_INTERNALS__

function savedView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'technical' ? 'technical' : 'simple' } catch { return 'simple' }
}

const segment = (active: boolean) => ({
  background: active ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent',
  color: active ? 'var(--accent)' : '#8b9199',
  border: 'none',
  borderRadius: '6px',
  padding: '0.3rem 0.85rem',
  fontSize: '0.78rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
})

/**
 * What DataBridge Pro is doing, for everyone: four status cards and a plain-language activity
 * list. The Technical tab keeps the engine's raw output for support.
 */
export function ActivityPage() {
  const [lines, setLines] = useState<ConsoleLine[]>([])
  // Live updates arrive over the WebSocket; the engine also counts as running while it answers HTTP
  const [wsConnected, setConnected] = useState(wsManager.isConnected)
  const [answers, setAnswers] = useState(false)
  const connected = wsConnected || answers
  const [view, setView] = useState<View>(savedView)

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
      setAnswers(true)
    } catch {
      setAnswers(false) // engine offline — live lines will arrive after reconnect
    }
  }, [])

  useEffect(() => {
    loadSnapshot()
    const offLines = wsManager.on('console_lines', (payload: any) => append(payload?.lines || []))
    const offOpen = wsManager.on('open', () => { setConnected(true); loadSnapshot() })
    const offClose = wsManager.on('close', () => setConnected(false))
    return () => { offLines(); offOpen(); offClose() }
  }, [append, loadSnapshot])

  // Without the live connection, keep the page fresh by asking every few seconds
  useEffect(() => {
    if (wsConnected) return
    const t = setInterval(loadSnapshot, 5000)
    return () => clearInterval(t)
  }, [wsConnected, loadSnapshot])

  const changeView = (v: View) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private window: the choice just isn't remembered */ }
  }

  const events = useMemo(() => buildActivity(lines), [lines])

  const handleSave = () => {
    const text = lines.map(l => `${new Date(l.ts).toISOString()} ${l.text}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `databridge-log-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Log saved', 'Send this file to support if you need help.')
  }

  const handleRestart = async () => {
    try {
      await invoke('restart_backend')
      toast.info('Restarting', 'The data service is restarting. Data resumes in a few seconds.', 4000)
    } catch (e: any) {
      toast.error('Restart failed', String(e?.message || e))
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#eceef2', margin: 0 }}>Activity</h1>
          <p style={{ fontSize: '0.8rem', color: '#8b9199', margin: '0.25rem 0 0' }}>What DataBridge Pro is doing right now, in plain words.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div role="tablist" style={{ display: 'flex', gap: '0.25rem', background: 'rgb(var(--s1-rgb) / 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button role="tab" aria-selected={view === 'simple'} onClick={() => changeView('simple')} style={segment(view === 'simple')}>Simple</button>
            <button role="tab" aria-selected={view === 'technical'} onClick={() => changeView('technical')} style={segment(view === 'technical')}>Technical</button>
          </div>
          <button onClick={handleSave} className="btn-secondary" title="Save everything the service printed to a file, to send to support" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Download size={13} />
            Save log for support
          </button>
          {isTauri && (
            <button onClick={handleRestart} className="btn-secondary" title="Restart the background data service" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <RotateCw size={13} />
              Restart data service
            </button>
          )}
        </div>
      </div>

      <StatusStrip engineRunning={connected} />

      {view === 'simple'
        ? <ActivityFeed events={events} connected={connected} />
        : <RawConsole lines={lines} connected={connected} />}
    </div>
  )
}
