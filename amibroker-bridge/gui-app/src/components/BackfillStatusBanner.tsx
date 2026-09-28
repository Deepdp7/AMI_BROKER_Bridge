/**
 * BackfillStatusBanner
 * Redesigned: Shows overall backfill progress across all symbols.
 * Format: "Backfilling 127 / 400 symbols · 32% · RELIANCE → 450 candles · +273 in queue"
 */
import { useAppStore } from '../store/appStore'

export function BackfillStatusBanner() {
  const backfillStatuses = useAppStore(s => s.backfillStatuses)

  const allItems = Object.values(backfillStatuses) as any[]

  const completed  = allItems.filter(s => s.status === 'completed').length
  const failed     = allItems.filter(s => s.status === 'failed').length
  const running    = allItems.filter(s => s.status === 'running')
  const pending    = allItems.filter(s => s.status === 'pending')
  const active     = [...running, ...pending]
  const total      = allItems.length

  if (total === 0) return null

  const primary = running[0] || pending[0]
  const doneCount = completed + failed

  // Overall progress: weighted average of each symbol's own progress (0–100)
  // Completed = 100, failed = 0 (penalize), running/pending = their chunk %
  const overallPct = total > 0
    ? Math.round(allItems.reduce((sum, s) => {
        if (s.status === 'completed') return sum + 100
        if (s.status === 'failed')    return sum + 0
        return sum + Math.min(99, s.progress || 0)
      }, 0) / total)
    : 0
  const totalCandles = allItems.reduce((sum, s) => sum + (s.candlesFetched || 0), 0)
  const queueSize   = active.length

  // If everything is done
  const allDone = queueSize === 0 && total > 0

  return (
    <div
      id="backfill-status-banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, rgba(6,15,35,0.98) 0%, rgba(8,22,50,0.98) 100%)',
        borderTop: '1.5px solid rgba(0,212,170,0.25)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Main bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '7px 18px',
        fontSize: '0.72rem',
        minHeight: 36,
      }}>

        {/* Pulse dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: allDone ? '#22c55e' : '#00d4aa',
          boxShadow: `0 0 8px ${allDone ? '#22c55e' : '#00d4aa'}`,
          animation: !allDone ? 'bfpulse 1.2s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }} />

        {/* Label */}
        <span style={{ color: '#00d4aa', fontWeight: 700, flexShrink: 0, letterSpacing: '0.03em' }}>
          BACKFILL
        </span>

        {/* X / Y symbols */}
        <span style={{ color: '#e2e8f0', fontWeight: 600, flexShrink: 0, fontSize: '0.78rem' }}>
          <span style={{ color: '#38bdf8', fontWeight: 800 }}>{doneCount}</span>
          <span style={{ color: '#475569' }}> / </span>
          <span style={{ color: '#cbd5e1' }}>{total}</span>
          <span style={{ color: '#64748b', fontWeight: 400 }}> symbols</span>
        </span>

        {/* Separator */}
        <span style={{ color: '#1e3a5f', fontSize: '1rem' }}>|</span>

        {/* Big progress bar */}
        <div style={{
          flex: 1,
          height: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          maxWidth: 280,
        }}>
          <div style={{
            height: '100%',
            width: `${overallPct}%`,
            background: allDone
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #00d4aa, #0ea5e9)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Percentage */}
        <span style={{
          color: allDone ? '#22c55e' : '#00d4aa',
          fontWeight: 800,
          fontSize: '0.82rem',
          minWidth: 36,
          flexShrink: 0,
        }}>
          {overallPct}%
        </span>

        {/* Separator */}
        {primary && <span style={{ color: '#1e3a5f', fontSize: '1rem' }}>|</span>}

        {/* Current ticker being processed */}
        {primary && (
          <span style={{ color: '#94a3b8', flexShrink: 0, fontSize: '0.7rem' }}>
            <span style={{ color: '#64748b' }}>Now: </span>
            <span style={{ color: '#f8fafc', fontWeight: 700 }}>{primary.ticker}</span>
            <span style={{ color: '#475569' }}> ({Math.min(100, primary.progress || 0)}%)</span>
          </span>
        )}

        {/* Separator */}
        <span style={{ color: '#1e3a5f', fontSize: '1rem' }}>|</span>

        {/* Total candles */}
        <span style={{ color: '#64748b', flexShrink: 0, fontSize: '0.7rem' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700 }}>{totalCandles.toLocaleString()}</span>
          <span style={{ color: '#475569' }}> candles</span>
        </span>

        {/* Queue badge */}
        {queueSize > 1 && (
          <span style={{
            color: '#94a3b8',
            background: 'rgba(56,189,248,0.08)',
            padding: '2px 10px',
            borderRadius: 10,
            border: '1px solid rgba(56,189,248,0.15)',
            flexShrink: 0,
            fontSize: '0.7rem',
          }}>
            +{queueSize - 1} queued
          </span>
        )}

        {/* Failed badge */}
        {failed > 0 && (
          <span style={{
            color: '#f87171',
            background: 'rgba(248,113,113,0.08)',
            padding: '2px 10px',
            borderRadius: 10,
            border: '1px solid rgba(248,113,113,0.15)',
            flexShrink: 0,
            fontSize: '0.7rem',
          }}>
            {failed} failed
          </span>
        )}

        {/* Done state */}
        {allDone && (
          <span style={{ color: '#22c55e', marginLeft: 'auto', flexShrink: 0, fontWeight: 600 }}>
            ✓ All {total} symbols up-to-date
          </span>
        )}
      </div>

      {/* Thin animated progress line at very bottom */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, height: '100%',
          width: `${overallPct}%`,
          background: allDone
            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
            : 'linear-gradient(90deg, #00d4aa, #0ea5e9, #8b5cf6)',
          transition: 'width 0.5s ease',
          boxShadow: '0 0 6px rgba(0,212,170,0.6)',
        }} />
      </div>

      <style>{`
        @keyframes bfpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
