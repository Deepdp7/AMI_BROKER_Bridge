import {
  Activity, Wifi, List, Settings, FileText, Info,
  ChevronRight, RefreshCw, AlertCircle, ListChecks, Sparkles, CandlestickChart, Loader2
} from 'lucide-react'
import { openAmiBroker, canOpenAmiBroker, folderOf } from '../../lib/amibroker'
import { toast } from '../ui/Toast'
import appIcon from '../../assets/brand/app-icon.png'
import { useAppStore } from '../../store/appStore'
import BrokerLogo, { BROKER_NAMES } from '../ui/BrokerLogo'
import { useNavigate, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useLayoutEffect, useRef, useState } from 'react'

const NAV_ITEMS = [
  { id: 'feed-status', label: 'Feed Status', icon: Activity },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'broker-connection', label: 'Broker Connection', icon: Wifi },
  { id: 'symbol-setup', label: 'Symbol Setup', icon: List },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs & Diagnostics', icon: FileText },
  { id: 'console', label: 'Activity', icon: ListChecks },
  { id: 'about', label: 'About', icon: Info },
]

export function OpenAmiBrokerButton() {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    try {
      const r = await openAmiBroker()
      if (!r.alreadyOpen) toast.success('AmiBroker opened', r.path ? `From ${r.path}` : undefined, 3500)
      if (r.path && !r.pluginInstalled) {
        toast.info('DataBridge plugin not found in this AmiBroker', `Copy DataBridgePro.dll into ${folderOf(r.path)}\\Plugins, then restart AmiBroker. The installer does this for you.`, 9000)
      }
    } catch (err: any) {
      toast.error("Couldn't open AmiBroker", String(err?.message || err), 8000)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ padding: '0 0.625rem 0.625rem' }}>
      <button id="open-amibroker" className="open-ab-btn" onClick={click} disabled={busy} title="Open AmiBroker, or bring it to the front if it is open">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <CandlestickChart size={15} />}
        <span>{busy ? 'Opening AmiBroker…' : 'Open AmiBroker'}</span>
      </button>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'connected') return <span className="status-dot connected" />
  if (status === 'reconnecting') return <RefreshCw size={10} style={{ color: '#f59e0b', animation: 'spin-slow 1s linear infinite' }} />
  if (status === 'auth_required') return <AlertCircle size={10} style={{ color: '#fb7185' }} />
  return <span className="status-dot disconnected" />
}

export function Sidebar() {
  const brokers = useAppStore(s => s.brokers)
  const coreStats = useAppStore(s => s.coreStats)
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.replace('/', '') || 'feed-status'
  
  const primaryBroker = brokers.find(b => b.status === 'connected') || brokers[0]

  // The highlight glides to the open page
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState<{ top: number; height: number; animate: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = itemRefs.current[activePage]
    setIndicator(prev => el ? { top: el.offsetTop, height: el.offsetHeight, animate: prev !== null } : null)
  }, [activePage])

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h}h ${m}m`
  }

  return (
    <aside
      style={{
        width: '232px',
        minWidth: '232px',
        background: 'rgb(var(--s1-rgb) / 0.98)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '1.125rem 1rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <img
            src={appIcon}
            alt=""
            width={32}
            height={32}
            draggable={false}
            style={{ borderRadius: '8px', flexShrink: 0, boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 16px rgb(var(--accent-rgb) / 0.25)' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#eceef2', letterSpacing: '-0.02em', lineHeight: 1 }}>
              DataBridge
            </div>
            <div className="gradient-text" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', marginTop: '2px' }}>
              PRO
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '0.625rem', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#3e3e3e', letterSpacing: '0.1em', padding: '0.375rem 0.375rem 0.5rem', textTransform: 'uppercase' }}>
          Navigation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', position: 'relative' }}>
          {indicator && (
            <span
              className="nav-indicator"
              aria-hidden="true"
              style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height, transition: indicator.animate ? undefined : 'none' }}
            />
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                ref={el => { itemRefs.current[item.id] = el }}
                id={`nav-${item.id}`}
                onClick={() => navigate(`/${item.id}`)}
                className={clsx('nav-link', isActive && 'active')}
                style={{ width: '100%', textAlign: 'left', position: 'relative', zIndex: 1 }}
              >
                <Icon size={15} />
                <span style={{ fontSize: '0.8375rem' }}>{item.label}</span>
                {isActive && <ChevronRight size={11} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Open AmiBroker: found anywhere on the PC the first time, then opened at once */}
      {canOpenAmiBroker() && <OpenAmiBrokerButton />}

      {/* Broker Status Card */}
      {primaryBroker ? (
        <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <StatusIcon status={primaryBroker.status} />
              <BrokerLogo brokerType={primaryBroker.brokerType} size={20} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#eceef2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {BROKER_NAMES[primaryBroker.brokerType] || 'Broker'}
              </span>
              <span style={{ fontSize: '0.65rem', color: primaryBroker.status === 'connected' ? 'var(--good)' : '#8b9199' }}>
                {primaryBroker.status === 'connected' ? 'Live' : primaryBroker.status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
              <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', borderRadius: '0.375rem', padding: '0.375rem' }}>
                <div style={{ fontSize: '0.58rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPU</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{coreStats.cpuPercent}%</div>
              </div>
              <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', borderRadius: '0.375rem', padding: '0.375rem' }}>
                <div style={{ fontSize: '0.58rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RAM</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{coreStats.ramMb}MB</div>
              </div>
            </div>
            <div style={{ fontSize: '0.63rem', color: '#575d66', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Uptime: {formatUptime(coreStats.uptimeSec)}</span>
              <span>{coreStats.messagesPerSec} msg/s</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#fb7185' }}>No broker connected</div>
          </div>
        </div>
      )}
    </aside>
  )
}
