/**
 * BackfillStatusBanner
 * History-download progress as a notification card: slides in from the top-right when a
 * download batch starts, shows overall progress, turns green when done and slides away on
 * its own. The ✕ hides it until the next batch. Rendered at the top of the toast stack.
 */
import { useEffect, useRef, useState } from 'react'
import { DownloadCloud, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const DONE_LINGER_MS = 6000
const ANIM_MS = 450

export function BackfillStatusBanner() {
  const backfillStatuses = useAppStore(s => s.backfillStatuses)
  const clearFinished = useAppStore(s => s.clearFinishedBackfills)

  const allItems = Object.values(backfillStatuses) as any[]
  const total = allItems.length
  const completed = allItems.filter(s => s.status === 'completed').length
  const failed = allItems.filter(s => s.status === 'failed').length
  const running = allItems.filter(s => s.status === 'running')
  const pending = allItems.filter(s => s.status === 'pending')
  const activeCount = running.length + pending.length
  const allDone = total > 0 && activeCount === 0
  const primary = running[0] || pending[0]
  const doneCount = completed + failed
  const totalCandles = allItems.reduce((sum, s) => sum + (s.candlesFetched || 0), 0)
  const overallPct = total > 0
    ? Math.round(allItems.reduce((sum, s) => sum + (s.status === 'completed' ? 100 : s.status === 'failed' ? 0 : Math.min(99, s.progress || 0)), 0) / total)
    : 0

  // mounted: in the DOM; shown: slid in. Split so the card can animate out before unmounting.
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const wasActive = useRef(false)

  // A new batch starting re-opens a card the user closed
  useEffect(() => {
    if (activeCount > 0 && !wasActive.current) setDismissed(false)
    wasActive.current = activeCount > 0
  }, [activeCount])

  const wantVisible = total > 0 && !dismissed

  useEffect(() => {
    if (wantVisible) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [wantVisible])

  // Finished: linger, slide out, then forget the batch so the next one starts from zero
  useEffect(() => {
    if (!allDone || !mounted) return
    const t = setTimeout(() => {
      setShown(false)
      setTimeout(() => { clearFinished(); setMounted(false) }, ANIM_MS)
    }, DONE_LINGER_MS)
    return () => clearTimeout(t)
  }, [allDone, mounted, clearFinished])

  const close = () => {
    setShown(false)
    setTimeout(() => {
      setDismissed(true)
      if (allDone) clearFinished()
    }, ANIM_MS)
  }

  if (!mounted) return null

  const hasFailures = allDone && failed > 0
  const accent = allDone ? (hasFailures ? '#f59e0b' : '#22c55e') : '#00d4aa'
  const Icon = allDone ? (hasFailures ? AlertTriangle : CheckCircle2) : DownloadCloud

  return (
    <div
      id="backfill-status-banner"
      role="status"
      style={{
        width: 360,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 14,
        background: 'linear-gradient(160deg, rgba(25,25,25,0.97) 0%, rgba(15,15,15,0.97) 100%)',
        border: `1px solid ${allDone ? `${accent}55` : 'rgba(0,212,170,0.22)'}`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), 0 0 24px ${accent}14`,
        backdropFilter: 'blur(14px)',
        transform: shown ? 'translateX(0)' : 'translateX(calc(100% + 2rem))',
        opacity: shown ? 1 : 0,
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity ${ANIM_MS}ms ease, border-color 0.4s ease`,
      }}
    >
      {/* Accent strip */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, transition: 'background 0.4s ease' }} />

      <div style={{ padding: '0.875rem 0.875rem 0.875rem 1.1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${accent}1f`, border: `1px solid ${accent}40`,
          }}>
            <Icon size={17} color={accent} style={!allDone ? { animation: 'bf-float 1.6s ease-in-out infinite' } : undefined} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 650, color: '#eceef2' }}>
              {allDone ? (hasFailures ? 'History download finished' : 'History up to date') : 'Downloading history'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8b9199', marginTop: 1 }}>
              <b style={{ color: '#d1d5db', fontWeight: 650 }}>{doneCount}</b> of {total} symbols
              {' · '}{totalCandles.toLocaleString()} candles
            </div>
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>{overallPct}%</span>
          <button
            onClick={close}
            aria-label="Dismiss"
            className="bf-close"
            style={{ background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', marginLeft: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress */}
        <div style={{ marginTop: '0.75rem', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${overallPct}%`, borderRadius: 999,
            background: allDone ? accent : 'linear-gradient(90deg, #00d4aa, #0ea5e9)',
            backgroundSize: '200% 100%',
            animation: !allDone ? 'bf-shimmer 1.8s linear infinite' : undefined,
            transition: 'width 0.5s ease, background 0.4s ease',
          }} />
        </div>

        {/* Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem', fontSize: '0.7rem', color: '#8b9199', minHeight: 20 }}>
          {allDone ? (
            <span>{hasFailures ? 'Some symbols could not be downloaded — see Logs.' : `All ${total} symbols are up to date in AmiBroker.`}</span>
          ) : primary ? (
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Now <b style={{ color: '#f3f4f6', fontWeight: 650 }}>{primary.ticker}</b>
              {running.length > 1 && <span> +{running.length - 1} more</span>}
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          {!allDone && pending.length > 0 && (
            <span style={{ color: '#a1a7b0', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 999, padding: '1px 8px' }}>
              {pending.length} queued
            </span>
          )}
          {failed > 0 && (
            <span style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 999, padding: '1px 8px' }}>
              {failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Auto-dismiss countdown once finished */}
      {allDone && shown && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ height: '100%', background: accent, animation: `toast-shrink ${DONE_LINGER_MS}ms linear forwards` }} />
        </div>
      )}

      <style>{`
        @keyframes bf-shimmer { from { background-position: 200% 0; } to { background-position: 0 0; } }
        @keyframes bf-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes toast-shrink { from { width: 100%; } to { width: 0%; } }
        .bf-close:hover { background: rgba(255,255,255,0.06) !important; color: #eceef2 !important; }
      `}</style>
    </div>
  )
}
