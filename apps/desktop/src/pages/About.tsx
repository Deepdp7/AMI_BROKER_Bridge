import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { Shield, Lightbulb } from 'lucide-react'
import appIcon from '../assets/brand/app-icon.png'

const BROKERS = ['Zerodha Kite', 'Fyers', 'Dhan', 'Upstox', 'Angel One', 'Flattrade', 'Shoonya']

const FACTS = [
  { value: String(BROKERS.length), label: 'Brokers supported', sub: 'Pick the one you already trade with' },
  { value: '1 minute', label: 'Bars in AmiBroker', sub: 'Live ticks plus your broker\'s history' },
  { value: '10 years', label: 'History, at most', sub: 'As far back as your broker allows' },
  { value: 'This PC', label: 'Where your data lives', sub: 'No DataBridge cloud account' },
]

const STEPS = [
  { title: 'Connect your broker', desc: 'Open Broker Connection, add your broker with its API key and secret, then log in on the broker\'s page that opens. Most brokers ask for a new login each morning.' },
  { title: 'Add your symbols', desc: 'Open Symbol Setup and search for a symbol, or use Import CSV to add a whole list at once (columns: ticker, exchange, type).' },
  { title: 'Set up AmiBroker', desc: 'The DataBridge installer copies the plugin (DataBridgePro.dll) into AmiBroker\'s Plugins folder. Restart AmiBroker once, then in File → Database Settings choose DataBridge Pro as the data source with a 1 minute base interval.' },
  { title: 'Open a chart', desc: 'Type any symbol you added. Live prices appear straight away; older history downloads in the background, and the card at the top right shows its progress.' },
]

const TIPS = [
  'Keep DataBridge Pro open while AmiBroker is running. Closing its window stops the live feed.',
  'How fast history downloads is set by your broker\'s limits, not by this PC. A long symbol list can take a while the first time; after that only the newest bars are fetched. Pause or Cancel from the download card whenever you like.',
  'Your data and settings are in %APPDATA%\\DataBridgePro on this PC.',
]

const SECURITY = [
  'Broker keys and tokens are encrypted with Windows (DPAPI)',
  'Your data stays on this PC; there is no DataBridge cloud account',
  'The data engine only accepts connections from this PC',
  'Calls to your broker use HTTPS',
]

const sectionTitle = {
  fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em',
} as const

export function AboutPage() {
  // From the root package.json, through tauri.conf.json
  const [version, setVersion] = useState('')
  useEffect(() => {
    getVersion().then(setVersion).catch(() => {})
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        padding: '2rem',
        background: 'linear-gradient(135deg, rgb(var(--accent-rgb) / 0.1) 0%, rgba(56,126,209,0.1) 100%)',
        border: '1px solid rgb(var(--accent-rgb) / 0.2)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: '-20px', top: '-20px',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgb(var(--accent-rgb) / 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.75rem' }}>
          <img
            src={appIcon}
            alt=""
            width={48}
            height={48}
            draggable={false}
            style={{ borderRadius: '12px', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 20px rgb(var(--accent-rgb) / 0.3)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#eceef2', letterSpacing: '-0.02em' }}>DataBridge Pro</span>
              {version && (
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', background: 'rgb(var(--accent-rgb) / 0.12)', border: '1px solid rgb(var(--accent-rgb) / 0.25)', borderRadius: 999, padding: '1px 9px' }}>
                  v{version}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Market data bridge for AmiBroker
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.875rem', color: '#a1a7b0', lineHeight: 1.6, maxWidth: '580px' }}>
          Live prices and 1-minute history from your Indian broker, straight into your AmiBroker charts.
        </p>
      </div>

      {/* Facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        {FACTS.map(f => (
          <div key={f.label} className="metric-card" style={{ textAlign: 'center' }}>
            <div className="gradient-text" style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{f.value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a1a7b0', marginTop: '0.25rem' }}>{f.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#6b727c', marginTop: '0.2rem' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ ...sectionTitle, marginBottom: '0.75rem' }}>About</div>
        <p style={{ fontSize: '0.875rem', color: '#a1a7b0', lineHeight: 1.7, margin: 0 }}>
          DataBridge Pro connects your broker account to AmiBroker through AmiBroker's own data plugin interface.
          It streams live prices, builds 1-minute bars from them, and fills in the history your broker provides,
          so charts, scans and backtests in AmiBroker use the same data.
        </p>
        <p style={{ fontSize: '0.875rem', color: '#a1a7b0', lineHeight: 1.7, marginTop: '0.75rem', marginBottom: 0 }}>
          It is <strong style={{ color: '#eceef2' }}>not a trading terminal</strong>: it only brings market data in, and never places orders.
        </p>
      </div>

      {/* Getting started */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ ...sectionTitle, marginBottom: '1.25rem' }}>Getting started</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {STEPS.map((item, idx) => (
            <div key={item.title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', background: 'rgb(var(--accent-rgb) / 0.15)',
                color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
              }}>
                {idx + 1}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#eceef2', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#a1a7b0', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Good to know */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <Lightbulb size={16} style={{ color: 'var(--accent)' }} />
          <div style={sectionTitle}>Good to know</div>
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 1.1rem', listStyle: 'disc', fontSize: '0.8rem', color: '#a1a7b0', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {TIPS.map(t => <li key={t}>{t}</li>)}
        </ul>
      </div>

      {/* Security & brokers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <Shield size={16} style={{ color: 'var(--accent)' }} />
            <div style={sectionTitle}>Security</div>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1rem', listStyle: 'disc', fontSize: '0.8rem', color: '#a1a7b0', lineHeight: 1.8 }}>
            {SECURITY.map(s => <li key={s}>{s}</li>)}
          </ul>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ ...sectionTitle, marginBottom: '0.75rem' }}>Supported brokers</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {BROKERS.map(b => (
              <span key={b} style={{ fontSize: '0.78rem', color: '#d1d5db', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '3px 11px' }}>
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#6b727c', paddingBottom: '1rem' }}>
        DataBridge Pro{version && ` v${version}`} · © 2026 · Proprietary software, all rights reserved
      </div>
    </div>
  )
}
