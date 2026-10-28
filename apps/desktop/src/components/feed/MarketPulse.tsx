/** Market breadth for the watched symbols: how many are up, down or flat, and the biggest movers */
import { memo, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { SymbolFeed } from '../../store/appStore'
import { breadth } from '../../lib/feedView'

function Mover({ s, up, onOpen }: { s: SymbolFeed; up: boolean; onOpen: (ticker: string) => void }) {
  return (
    <button
      onClick={() => onOpen(s.ticker)}
      className="chip"
      title={`Open ${s.ticker}`}
      style={{ color: up ? 'var(--good)' : '#fb7185', borderColor: up ? 'rgb(var(--good-rgb) / 0.25)' : 'rgba(244,63,94,0.25)' }}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span style={{ color: '#eceef2' }}>{s.ticker}</span>
      {up ? '+' : ''}{s.changePercent.toFixed(2)}%
    </button>
  )
}

export const MarketPulse = memo(function MarketPulse({ symbols, onOpen }: { symbols: SymbolFeed[]; onOpen: (ticker: string) => void }) {
  const b = useMemo(() => breadth(symbols), [symbols])
  const total = b.up + b.down + b.flat
  if (!total) return null
  const pct = (n: number) => `${(n / total) * 100}%`

  return (
    <div className="glass-card reveal" style={{ ['--i' as any]: 5, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Market pulse</div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
          <span title={`${b.up} up`} style={{ width: pct(b.up), background: 'linear-gradient(90deg,var(--good-lo),var(--good))', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
          <span title={`${b.flat} unchanged`} style={{ width: pct(b.flat), background: '#3e3e3e', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
          <span title={`${b.down} down`} style={{ width: pct(b.down), background: 'linear-gradient(90deg,#f43f5e,#e11d48)', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.9rem', marginTop: 6, fontSize: '0.72rem', color: '#8b9199', fontVariantNumeric: 'tabular-nums' }}>
          <span><b style={{ color: 'var(--good)' }}>{b.up}</b> up</span>
          <span><b style={{ color: '#a1a7b0' }}>{b.flat}</b> unchanged</span>
          <span><b style={{ color: '#fb7185' }}>{b.down}</b> down</span>
        </div>
      </div>
      {(b.best || b.worst) && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#6b727c' }}>Top movers</span>
          {b.best && <Mover s={b.best} up onOpen={onOpen} />}
          {b.worst && <Mover s={b.worst} up={false} onOpen={onOpen} />}
        </div>
      )}
    </div>
  )
})
