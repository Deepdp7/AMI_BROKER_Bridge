/**
 * Everything about one symbol in a panel that slides in from the right: live price, where it
 * streams from, how complete its history is, and the actions for it.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Star, RefreshCw, Copy, Wrench, Loader, TrendingUp, TrendingDown, Clock, Gauge, Layers, Hash, Database, Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { api, type SymbolHealth } from '../../api/apiClient'
import { toast } from '../ui/Toast'
import { useExitAnimation } from '../ui/Dialog'
import { Sparkline } from '../ui/Sparkline'
import BrokerLogo, { BROKER_NAMES } from '../ui/BrokerLogo'
import { formatAgo, formatPrice, formatCompact } from '../../lib/format'
import { trendOf } from '../../lib/feedView'

const HEALTH_TEXT: Record<SymbolHealth['status'], { color: string; label: string }> = {
  complete: { color: '#22c55e', label: 'History complete' },
  missing: { color: '#f59e0b', label: 'Some history missing' },
  downloading: { color: '#38bdf8', label: 'Downloading history…' },
  cancelled: { color: '#8b9199', label: 'History download cancelled' },
  empty: { color: '#f43f5e', label: 'No history yet' },
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.6rem 0.7rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: '#6b727c', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 650 }}>
        <Icon size={11} /> {label}
      </div>
      <div style={{ marginTop: 4, fontSize: '0.82rem', color: '#eceef2', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

export function SymbolDrawer({ ticker, onClose, pinned, onTogglePin, onRemove }: {
  ticker: string | null
  onClose: () => void
  pinned?: boolean
  onTogglePin?: () => void
  /** Symbol Setup offers Remove here */
  onRemove?: (ticker: string) => void
}) {
  const { mounted, closing } = useExitAnimation(!!ticker, 220)
  // Keep showing the last symbol while the panel slides out
  const last = useRef<string | null>(null)
  if (ticker) last.current = ticker
  const shown = ticker ?? last.current
  const sym = useAppStore(s => s.symbols.find(x => x.ticker === shown))
  const brokers = useAppStore(s => s.brokers)
  const [health, setHealth] = useState<SymbolHealth | null | undefined>(undefined)
  const [busy, setBusy] = useState<'today' | 'repair' | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!ticker) return
    setHealth(undefined)
    let alive = true
    api.getSymbolHealth().then(r => { if (alive) setHealth(r.symbols.find(h => h.ticker === ticker) ?? null) }).catch(() => alive && setHealth(null))
    const t = setInterval(() => setNow(Date.now()), 1000)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { alive = false; clearInterval(t); window.removeEventListener('keydown', onKey) }
  }, [ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !shown) return null

  const broker = brokers.find(b => b.id === sym?.brokerId)
  const up = (sym?.changePercent ?? 0) >= 0
  const trend = sym ? trendOf(sym.ticker, sym.lastPrice, now) : []

  const refreshToday = async () => {
    setBusy('today')
    try {
      await api.refreshToday({ ticker: shown })
      toast.success("Today's bars re-downloading", `${shown}: AmiBroker gets them in a moment.`, 4000)
    } catch (e: any) {
      toast.error("Couldn't refresh today", e?.message || String(e))
    } finally { setBusy(null) }
  }
  const repair = async () => {
    setBusy('repair')
    try {
      const r = await api.repairSymbols([shown])
      if (r.queued) toast.success('Repair started', `Downloading what is missing for ${shown}.`, 5000)
      else if (r.noBroker) toast.error('Nothing could be repaired', 'Its broker is not connected.', 6000)
      else toast.info('Already complete', 'Nothing is missing that the broker can provide.', 4000)
      setHealth(h => h ? { ...h, status: r.queued ? 'downloading' : h.status } : h)
    } catch (e: any) {
      toast.error('Repair failed', e?.message || String(e))
    } finally { setBusy(null) }
  }
  const copy = () => {
    navigator.clipboard?.writeText(shown).then(() => toast.success('Copied', `${shown} is on the clipboard.`, 2000)).catch(() => {})
  }

  const look = health ? HEALTH_TEXT[health.status] : null
  return createPortal(
    <>
      <div className="drawer-backdrop" data-closing={closing} onClick={onClose} />
      <aside className="drawer" data-closing={closing} role="dialog" aria-label={`${shown} details`}>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#eceef2', letterSpacing: '-0.02em' }}>{shown}</span>
                {sym && <span className="badge badge-gray" style={{ fontSize: '0.66rem', padding: '0.1rem 0.45rem' }}>{sym.instrumentType}</span>}
                {sym && <span className="badge badge-gray" style={{ fontSize: '0.66rem', padding: '0.1rem 0.45rem' }}>{sym.exchange}</span>}
              </div>
              {sym?.rawSymbol && sym.rawSymbol !== shown && (
                <div style={{ fontSize: '0.72rem', color: '#6b727c', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>{sym.rawSymbol}</div>
              )}
            </div>
            {onTogglePin && (
              <button className="icon-btn" data-on={pinned} onClick={onTogglePin} title={pinned ? 'Unpin' : 'Pin to the top of Feed Status'} aria-label={pinned ? 'Unpin' : 'Pin'}>
                <Star size={14} fill={pinned ? 'currentColor' : 'none'} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>

          {/* Price */}
          {sym && (
            <div className="reveal" style={{ ['--i' as any]: 1, padding: '1rem', borderRadius: 14, background: `linear-gradient(135deg, ${up ? 'rgb(var(--good-rgb) / 0.1)' : 'rgba(244,63,94,0.1)'}, rgba(255,255,255,0.02))`, border: `1px solid ${up ? 'rgb(var(--good-rgb) / 0.2)' : 'rgba(244,63,94,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 750, color: '#eceef2', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.04em' }}>
                    {sym.lastPrice ? formatPrice(sym.lastPrice) : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: up ? 'var(--good)' : '#fb7185', fontSize: '0.85rem', fontWeight: 650 }}>
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {up ? '+' : ''}{(sym.change || 0).toFixed(2)} ({up ? '+' : ''}{(sym.changePercent || 0).toFixed(2)}%)
                  </div>
                </div>
                <Sparkline data={trend} color={up ? 'var(--good)' : '#f43f5e'} width={130} height={46} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#8b9199', marginTop: '0.6rem' }}>
                {sym.prevClose ? `Previous close ${formatPrice(sym.prevClose)} · ` : ''}Status <b style={{ color: '#eceef2' }}>{sym.status.toLowerCase()}</b>
              </div>
            </div>
          )}

          {/* Details */}
          {sym && (
            <div className="reveal" style={{ ['--i' as any]: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Detail icon={Layers} label="Broker" value={broker ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BrokerLogo brokerType={broker.brokerType} size={16} />{BROKER_NAMES[broker.brokerType] || broker.label}</span> : 'Not connected'} />
              <Detail icon={Clock} label="Last tick" value={sym.lastTickUtcMs ? formatAgo(sym.lastTickUtcMs, now) : 'None yet'} />
              <Detail icon={Hash} label="Bars per minute" value={sym.barsPerMin || 0} />
              <Detail icon={Gauge} label="Delay" value={`${sym.internalLatencyMs || 0} ms`} />
              <Detail icon={Database} label="Volume" value={sym.volume ? formatCompact(sym.volume) : '—'} />
              <Detail icon={Layers} label="Exchange" value={`${sym.exchange} · ${sym.instrumentType}`} />
            </div>
          )}

          {/* History */}
          <div className="reveal" style={{ ['--i' as any]: 3, padding: '0.9rem', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.55rem' }}>1-minute history</div>
            {health === undefined ? (
              <div className="skeleton" style={{ height: 34 }} />
            ) : !health || !look ? (
              <div style={{ fontSize: '0.8rem', color: '#8b9199' }}>Not known yet.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 650, color: look.color }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: look.color, boxShadow: `0 0 8px ${look.color}` }} />
                  {look.label}{health.status === 'missing' && health.missingDays ? ` (${health.missingDays} day${health.missingDays === 1 ? '' : 's'})` : ''}
                </div>
                {health.firstDay && (
                  <div style={{ fontSize: '0.76rem', color: '#a1a7b0', marginTop: 6 }}>
                    {health.firstDay} → {health.lastDay} · {health.bars.toLocaleString('en-IN')} bars
                  </div>
                )}
                {health.missingSample.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: 4 }}>Missing: {health.missingSample.slice(0, 5).join(', ')}{health.missingDays > 5 ? ' …' : ''}</div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="reveal" style={{ ['--i' as any]: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={refreshToday} disabled={busy !== null} style={{ justifyContent: 'center' }}>
              {busy === 'today' ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh today
            </button>
            <button className="btn-secondary" onClick={repair} disabled={busy !== null || health?.status === 'downloading'} style={{ justifyContent: 'center' }}>
              {busy === 'repair' ? <Loader size={14} className="animate-spin" /> : <Wrench size={14} />} Repair history
            </button>
            <button className="btn-secondary" onClick={copy} style={{ justifyContent: 'center' }}>
              <Copy size={14} /> Copy name
            </button>
            {onRemove && (
              <button className="btn-danger" onClick={() => onRemove(shown)} style={{ justifyContent: 'center' }}>
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#575d66', lineHeight: 1.5 }}>
            Refresh today downloads today's 1-minute bars again from the broker. Repair checks the whole history and downloads any days that are missing.
          </div>
        </div>
      </aside>
    </>,
    document.body,
  )
}
