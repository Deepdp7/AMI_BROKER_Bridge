import {
  Activity, Wifi, List, Settings, FileText, Info,
  Zap, ChevronRight, RefreshCw, AlertCircle, Heart
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useNavigate, useLocation } from 'react-router-dom'
import clsx from 'clsx'

const NAV_ITEMS = [
  { id: 'feed-status', label: 'Feed Status', icon: Activity },
  { id: 'broker-connection', label: 'Broker Connection', icon: Wifi },
  { id: 'symbol-setup', label: 'Symbol Setup', icon: List },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'logs', label: 'Logs & Diagnostics', icon: FileText },
  { id: 'about', label: 'About', icon: Info },
]

function StatusIcon({ status }: { status: string }) {
  if (status === 'connected') return <span className="status-dot connected" />
  if (status === 'reconnecting') return <RefreshCw size={10} style={{ color: '#f59e0b', animation: 'spin-slow 1s linear infinite' }} />
  if (status === 'auth_required') return <AlertCircle size={10} style={{ color: '#fb7185' }} />
  return <span className="status-dot disconnected" />
}

export function Sidebar() {
  const { brokers, coreStats } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.replace('/', '') || 'feed-status'
  
  const primaryBroker = brokers[0]

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
        background: 'rgba(8, 18, 35, 0.98)',
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
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #00d4aa 0%, #006655 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,170,0.35)',
            flexShrink: 0,
          }}>
            <Zap size={16} fill="#050d1a" color="#050d1a" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#e2eaf4', letterSpacing: '-0.02em', lineHeight: 1 }}>
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
        <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#2e3d54', letterSpacing: '0.1em', padding: '0.375rem 0.375rem 0.5rem', textTransform: 'uppercase' }}>
          Navigation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => navigate(`/${item.id}`)}
                className={clsx('nav-link', isActive && 'active')}
                style={{ background: 'none', border: isActive ? undefined : 'none', width: '100%', textAlign: 'left' }}
              >
                <Icon size={15} />
                <span style={{ fontSize: '0.8375rem' }}>{item.label}</span>
                {isActive && <ChevronRight size={11} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Broker Status Card */}
      {primaryBroker ? (
        <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <StatusIcon status={primaryBroker.status} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2eaf4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {
                  {
                    fyers: 'Fyers',
                    zerodha_kite: 'Zerodha Kite',
                    dhan: 'Dhan',
                    angel_one: 'Angel One',
                    upstox: 'Upstox',
                    flattrade: 'Flattrade',
                    shoonya: 'Shoonya'
                  }[primaryBroker.brokerType] || 'Broker'
                }
              </span>
              <span style={{ fontSize: '0.65rem', color: primaryBroker.status === 'connected' ? '#00d4aa' : '#6b8099' }}>
                {primaryBroker.status === 'connected' ? 'Live' : primaryBroker.status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
              <div style={{ background: 'rgba(0,212,170,0.06)', borderRadius: '0.375rem', padding: '0.375rem' }}>
                <div style={{ fontSize: '0.58rem', color: '#6b8099', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPU</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00d4aa', fontFamily: 'JetBrains Mono, monospace' }}>{coreStats.cpuPercent}%</div>
              </div>
              <div style={{ background: 'rgba(0,212,170,0.06)', borderRadius: '0.375rem', padding: '0.375rem' }}>
                <div style={{ fontSize: '0.58rem', color: '#6b8099', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RAM</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00d4aa', fontFamily: 'JetBrains Mono, monospace' }}>{coreStats.ramMb}MB</div>
              </div>
            </div>
            <div style={{ fontSize: '0.63rem', color: '#3d5068', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
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
