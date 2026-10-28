/** The four numbers at the top of Feed Status, each counting to its value with a small trend line */
import { memo, useEffect, type ElementType } from 'react'
import { Radio, Zap, Cpu, HardDrive } from 'lucide-react'
import type { CoreEngineStats } from '../../store/appStore'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { Sparkline } from '../ui/Sparkline'
import { formatDuration } from '../../lib/format'

// Kept outside the page so the lines continue when you come back to it
const history = { mps: [] as number[], cpu: [] as number[], ram: [] as number[] }
let lastPushed: CoreEngineStats | null = null

function useStatHistory(stats: CoreEngineStats) {
  useEffect(() => {
    if (stats === lastPushed) return
    lastPushed = stats
    const push = (arr: number[], v: number) => { arr.push(v || 0); if (arr.length > 40) arr.shift() }
    push(history.mps, stats.messagesPerSec)
    push(history.cpu, stats.cpuPercent)
    push(history.ram, stats.ramMb)
  }, [stats])
  return history
}

function Card({ i, label, icon: Icon, color, children, sub, trend }: {
  i: number; label: string; icon: ElementType; color: string; children: React.ReactNode; sub: React.ReactNode; trend?: number[]
}) {
  return (
    <div className="metric-card reveal lift sheen" style={{ ['--i' as any]: i, padding: '1.1rem 1.2rem', minHeight: 116 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 650 }}>{label}</div>
        <span style={{ padding: '0.45rem', borderRadius: 10, background: `${color}18`, border: `1px solid ${color}35`, display: 'inline-flex' }}>
          <Icon size={16} color={color} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.2rem' }}>
        <div>
          <div style={{ fontSize: '1.65rem', fontWeight: 750, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
            {children}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: '0.3rem' }}>{sub}</div>
        </div>
        {trend && <Sparkline data={trend} color={color} width={92} height={30} />}
      </div>
    </div>
  )
}

/** Ring that fills with the share of symbols receiving ticks */
function Ring({ value, total, color }: { value: number; total: number; color: string }) {
  const r = 15, c = 2 * Math.PI * r
  const k = total ? value / total : 0
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${c * k} ${c}`} transform="rotate(-90 20 20)"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  )
}

export const StatCards = memo(function StatCards({ stats, total, live }: { stats: CoreEngineStats; total: number; live: number }) {
  const h = useStatHistory(stats)
  const ramColor = stats.ramMb < 250 ? 'var(--accent)' : '#f59e0b'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      <div className="metric-card reveal lift sheen" style={{ ['--i' as any]: 1, padding: '1.1rem 1.2rem', minHeight: 116 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.7rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 650 }}>Active symbols</div>
          <span style={{ padding: '0.45rem', borderRadius: 10, background: 'rgb(var(--accent-rgb) / 0.09)', border: '1px solid rgb(var(--accent-rgb) / 0.21)', display: 'inline-flex' }}>
            <Radio size={16} color="var(--accent)" />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 750, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              <AnimatedNumber value={total} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: '0.3rem' }}>
              <AnimatedNumber value={live} /> receiving ticks
            </div>
          </div>
          <Ring value={live} total={total} color="var(--good)" />
        </div>
      </div>
      <Card i={2} label="Live messages" icon={Zap} color="#38bdf8" sub="Ticks and bars per second" trend={h.mps}>
        <AnimatedNumber value={stats.messagesPerSec || 0} />/s
      </Card>
      <Card i={3} label="CPU" icon={Cpu} color="#a78bfa" sub="Data engine" trend={h.cpu}>
        <AnimatedNumber value={stats.cpuPercent || 0} format={n => n.toFixed(1)} />%
      </Card>
      <Card i={4} label="Memory" icon={HardDrive} color={ramColor} sub={`Running for ${formatDuration(stats.uptimeSec || 0)}`} trend={h.ram}>
        <AnimatedNumber value={stats.ramMb || 0} /> MB
      </Card>
    </div>
  )
})
