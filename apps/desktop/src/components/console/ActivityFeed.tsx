/**
 * ActivityFeed
 * What DataBridge Pro has been doing, newest first, in plain sentences. Problems carry a
 * button that leads to the fix. "Needs attention" shows only warnings and errors.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Power, Plug, Wifi, Download, CheckCircle2, Clock, AlertTriangle, KeyRound, LineChart,
  PlusCircle, PauseCircle, StopCircle, CalendarDays, List, Zap, Inbox, type LucideIcon,
} from 'lucide-react'
import type { ActivityEvent, ActivityIcon, Tone } from '../../lib/activity'

const ICONS: Record<ActivityIcon, LucideIcon> = {
  power: Power, plug: Plug, wifi: Wifi, download: Download, check: CheckCircle2, clock: Clock, alert: AlertTriangle,
  key: KeyRound, chart: LineChart, plus: PlusCircle, pause: PauseCircle, stop: StopCircle, calendar: CalendarDays, list: List, zap: Zap,
}

const TONE: Record<Tone, { color: string; bg: string }> = {
  good: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  info: { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
  warn: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  bad: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
}

const FIXED_TONE = { color: '#6b727c', bg: 'rgba(255,255,255,0.05)' }

const MAX_SHOWN = 150

const FIX_TARGET = { broker: { to: '/broker-connection', label: 'Open Broker Connection' } } as const

function dayLabel(ts: number): string {
  const d = new Date(ts), now = new Date()
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, now)) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (same(d, y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const chip = (active: boolean) => ({
  background: active ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent',
  color: active ? 'var(--accent)' : '#8b9199',
  border: 'none',
  borderRadius: '6px',
  padding: '0.3rem 0.75rem',
  fontSize: '0.76rem',
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
})

export function ActivityFeed({ events, connected }: { events: ActivityEvent[]; connected: boolean }) {
  const navigate = useNavigate()
  const [onlyProblems, setOnlyProblems] = useState(false)

  const newestFirst = useMemo(() => [...events].sort((a, b) => b.ts - a.ts), [events])
  // A problem that has since been fixed no longer needs attention
  const problems = useMemo(() => newestFirst.filter(e => (e.tone === 'warn' || e.tone === 'bad') && e.fixedAt === undefined), [newestFirst])
  const shown = (onlyProblems ? problems : newestFirst).slice(0, MAX_SHOWN)

  return (
    <div className="glass-card" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.9rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent activity</div>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgb(var(--s1-rgb) / 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setOnlyProblems(false)} style={chip(!onlyProblems)}>Everything</button>
          <button onClick={() => setOnlyProblems(true)} style={chip(onlyProblems)}>
            Needs attention{problems.length > 0 ? ` (${problems.length})` : ''}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.4rem 0.6rem 0.8rem' }}>
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#8b9199' }}>
            <Inbox size={30} style={{ color: '#575d66', marginBottom: '0.6rem' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db' }}>
              {!connected ? 'The data service is not reachable' : onlyProblems ? 'Nothing needs your attention' : 'Nothing to show yet'}
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
              {!connected
                ? 'It restarts automatically. This page fills in again once it is back.'
                : onlyProblems
                  ? 'Everything is working. Problems show up here with a way to fix them.'
                  : 'What DataBridge Pro does appears here as it happens.'}
            </div>
          </div>
        ) : shown.map((e, i) => {
          const fixed = e.fixedAt !== undefined
          // A fixed problem is shown quietly, in grey, with what fixed it
          const tone = fixed ? FIXED_TONE : TONE[e.tone]
          const Icon = ICONS[e.icon]
          const showDay = i === 0 || dayLabel(e.ts) !== dayLabel(shown[i - 1].ts)
          return (
            <div key={e.id}>
              {showDay && (
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b727c', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.9rem 0.5rem 0.35rem' }}>
                  {dayLabel(e.ts)}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', padding: '0.65rem 0.5rem', borderRadius: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} style={{ color: tone.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: fixed ? '#8b9199' : '#eceef2', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {e.title}
                    {e.count > 1 && (
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, color: '#a1a7b0', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '0 7px' }}>×{e.count}</span>
                    )}
                  </div>
                  {fixed ? (
                    <div style={{ fontSize: '0.78rem', color: '#22c55e', lineHeight: 1.5, marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 size={13} />
                      Fixed at {timeLabel(e.fixedAt!)}: {e.fixedBy}
                    </div>
                  ) : e.detail && <div style={{ fontSize: '0.78rem', color: '#8b9199', lineHeight: 1.5, marginTop: 2 }}>{e.detail}</div>}
                  {e.fix && (
                    <button className="btn-secondary" onClick={() => navigate(FIX_TARGET[e.fix!].to)} style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.74rem' }}>
                      {FIX_TARGET[e.fix].label}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b727c', flexShrink: 0, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>{timeLabel(e.ts)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
