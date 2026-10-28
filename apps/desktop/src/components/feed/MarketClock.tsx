/** Header pill: market open with a session progress bar and time to close, or when it opens next */
import { useEffect, useState } from 'react'
import { sessionInfo, formatCountdown } from '../../lib/marketClock'

export function MarketClock({ status }: { status: 'open' | 'closed' | 'unknown' }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (status === 'unknown') return null

  const info = sessionInfo(now)
  const open = status === 'open'
  const color = open ? 'var(--accent)' : '#f59e0b'
  // The engine says closed during normal hours: a holiday or no data yet, so no countdown
  const detail = open
    ? (info.inSession ? `closes in ${formatCountdown(info.msToNext)}` : '')
    : info.inSession ? 'opens next trading day' : `opens ${info.nextOpenDay === 'Today' ? 'today' : info.nextOpenDay === 'Tomorrow' ? 'tomorrow' : info.nextOpenDay} 09:15 · in ${formatCountdown(info.msToNext)}`

  return (
    <div
      title="NSE trading hours are 09:15 to 15:30 IST, Monday to Friday"
      style={{
        position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        height: 32, padding: '0 0.75rem', borderRadius: 10, fontSize: '0.74rem',
        background: open ? 'rgb(var(--accent-rgb) / 0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${open ? 'rgb(var(--accent-rgb) / 0.3)' : 'rgba(245,158,11,0.3)'}`,
      }}
    >
      <span className={open ? 'breathe' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: open ? `0 0 8px ${color}` : 'none' }} />
      <b style={{ color }}>{open ? 'Market open' : 'Market closed'}</b>
      {detail && <span style={{ color: '#a1a7b0', fontVariantNumeric: 'tabular-nums' }}>{detail}</span>}
      {open && info.inSession && (
        <span style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${info.progress * 100}%`, background: `linear-gradient(90deg, transparent, ${color})`, transition: 'width 1s linear' }} />
      )}
    </div>
  )
}
