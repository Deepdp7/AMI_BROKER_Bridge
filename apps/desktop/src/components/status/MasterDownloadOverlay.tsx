/**
 * "Updating symbol list" card (bottom right). Once a day, the first time a broker is
 * connected, the engine downloads that broker's list of instruments (search and symbol
 * names need it; the Fyers lists take about 5-15 s).
 *
 * Progress comes over the WebSocket (master_sync_* events). The status endpoint is also asked
 * every 2 s while the card is open, so the card always ends, even if an event was missed
 * (window reloaded, WebSocket reconnecting). A failure stays on screen with a Try again button.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, wsManager } from '../../api/apiClient'
import { useAppStore } from '../../store/appStore'
import { CheckCircle, AlertCircle, RotateCw, X } from 'lucide-react'

type Phase = 'downloading' | 'complete' | 'error'

interface SyncState {
  brokerId: string
  label: string
  phase: Phase
  progress: number
  text: string
}

const POLL_MS = 2000
/** No progress at all for this long: the download is reported as stuck */
const STUCK_MS = 3 * 60_000

export function MasterDownloadOverlay() {
  const { brokers } = useAppStore()
  const [sync, setSync] = useState<SyncState | null>(null)
  const checked = useRef<Set<string>>(new Set())
  const lastChange = useRef(Date.now())

  const update = useCallback((patch: Partial<SyncState>) => {
    lastChange.current = Date.now()
    setSync(s => (s ? { ...s, ...patch } : s))
  }, [])

  const finish = useCallback((text: string) => {
    update({ phase: 'complete', progress: 100, text })
    setTimeout(() => setSync(s => (s?.phase === 'complete' ? null : s)), 2500)
  }, [update])

  const start = useCallback(async (brokerId: string, label: string) => {
    lastChange.current = Date.now()
    setSync({ brokerId, label, phase: 'downloading', progress: 5, text: `Downloading the ${label} symbol list...` })
    try {
      await api.syncMaster(brokerId)
    } catch (e: any) {
      update({ phase: 'error', text: e?.message || 'The data engine did not answer.' })
    }
  }, [update])

  // Once per broker and app start: download today's list if it isn't there yet
  useEffect(() => {
    const run = async () => {
      for (const b of brokers.filter(b => b.status === 'connected')) {
        if (checked.current.has(b.id)) continue
        checked.current.add(b.id)
        try {
          const st = await api.getMasterStatus(b.id)
          const label = b.label || b.brokerType
          if (st.isDownloading) {
            lastChange.current = Date.now()
            setSync({ brokerId: b.id, label, phase: 'downloading', progress: 10, text: `Downloading the ${label} symbol list...` })
            return // one card at a time; the next broker is checked when this one ends
          }
          if (!st.isDownloadedToday) {
            await start(b.id, label)
            return
          }
        } catch (err) {
          console.error('Symbol list check failed for', b.id, err)
          checked.current.delete(b.id)
        }
      }
    }
    if (!sync || sync.phase === 'complete') run()
  }, [brokers, sync, start])

  // Live progress from the engine
  useEffect(() => {
    const mine = (p: any) => !p?.brokerId || p.brokerId === sync?.brokerId
    const offs = [
      wsManager.on('master_sync_progress', (p: any) => {
        if (!mine(p)) return
        update({ phase: 'downloading', progress: Math.max(0, Math.min(100, Number(p.progress) || 0)), text: p.text || 'Downloading...' })
      }),
      wsManager.on('master_sync_complete', (p: any) => { if (mine(p)) finish(p.text || 'Symbol list up to date.') }),
      wsManager.on('master_sync_error', (p: any) => { if (mine(p)) update({ phase: 'error', text: p.error || 'The symbol list could not be downloaded.' }) }),
    ]
    return () => offs.forEach(off => off())
  }, [sync?.brokerId, update, finish])

  // Backup: ask the engine directly while the card is open
  useEffect(() => {
    if (sync?.phase !== 'downloading') return
    const { brokerId } = sync
    const t = setInterval(async () => {
      try {
        const st = await api.getMasterStatus(brokerId)
        if (st.isDownloading) {
          if (Date.now() - lastChange.current > STUCK_MS) {
            update({ phase: 'error', text: 'The download is not moving. Check the internet connection, then try again.' })
          }
          return
        }
        // Finished without us hearing about it
        if (st.isDownloadedToday) finish('Symbol list up to date.')
        else update({ phase: 'error', text: 'The download stopped before it finished. Check the internet connection, then try again.' })
      } catch { /* engine restarting: try again next time */ }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [sync?.phase, sync?.brokerId, update, finish])

  if (!sync) return null
  const { phase, progress, text, label } = sync
  const R = 18
  const C = 2 * Math.PI * R

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl p-4 w-80 flex items-start gap-3.5">
        <div className="shrink-0 w-10 h-10 flex items-center justify-center">
          {phase === 'downloading' ? (
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 44 44" className="w-10 h-10 -rotate-90">
                <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" className="stroke-slate-700/70" />
                <circle
                  cx="22" cy="22" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
                  className="stroke-teal-400"
                  strokeDasharray={C}
                  strokeDashoffset={C - (C * progress) / 100}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-200 tabular-nums">
                {progress}%
              </span>
            </div>
          ) : phase === 'complete' ? (
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle size={22} />
            </div>
          ) : (
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <AlertCircle size={22} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200">
            {phase === 'complete' ? 'Symbol list updated' : phase === 'error' ? 'Symbol list not updated' : `Updating ${label} symbols`}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{text}</p>
          {phase === 'downloading' && (
            <p className="text-[11px] text-slate-500 mt-1">Once a day, usually under 15 seconds. You can keep working.</p>
          )}
          {phase === 'error' && (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 hover:text-teal-200"
              onClick={() => start(sync.brokerId, label)}
            >
              <RotateCw size={13} /> Try again
            </button>
          )}
        </div>

        {phase !== 'downloading' && (
          <button type="button" className="shrink-0 text-slate-500 hover:text-slate-300" title="Close" onClick={() => setSync(null)}>
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
