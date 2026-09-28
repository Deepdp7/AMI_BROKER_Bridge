import { Zap, ExternalLink, Shield, Cpu, Activity, Database, Code } from 'lucide-react'

const STACK = [
  { icon: Cpu, label: 'Tauri v2 + Rust', sub: 'Native desktop container & IPC' },
  { icon: Activity, label: 'React 19 + TypeScript', sub: 'Modern reactive dashboard UI' },
  { icon: Database, label: 'High-Speed SQLite (WAL)', sub: '1-second bar storage & ring buffer' },
  { icon: Code, label: 'AmiBroker C++ ADK', sub: 'Native C++ in-process charting plugin' },
]

export function AboutPage() {
  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        padding: '2rem',
        background: 'linear-gradient(135deg, rgba(0,212,170,0.1) 0%, rgba(56,126,209,0.1) 100%)',
        border: '1px solid rgba(0,212,170,0.2)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: '-20px', top: '-20px',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,170,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #00d4aa, #0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,212,170,0.4)',
          }}>
            <Zap size={22} style={{ color: '#050c14' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e2eaf4', letterSpacing: '-0.02em' }}>
              DataBridge Pro
            </div>
            <div style={{ fontSize: '0.75rem', color: '#00d4aa', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              High-Frequency Market Data Bridge for AmiBroker
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '580px' }}>
          Ultra-low latency desktop bridge delivering tick-level streaming and 1-minute historical OHLCV data from top Indian brokers directly into AmiBroker.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'End-to-end Latency', value: '<150ms', sub: 'p50 target' },
          { label: 'Symbols Supported', value: '200+', sub: 'High concurrency' },
          { label: 'CPU Usage', value: '<8%', sub: 'Core engine' },
          { label: 'Memory Usage', value: '<250MB', sub: 'Optimized RAM cache' },
        ].map(stat => (
          <div key={stat.label} className="metric-card" style={{ textAlign: 'center' }}>
            <div className="gradient-text" style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginTop: '0.25rem' }}>{stat.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#3d5068', marginTop: '0.2rem' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          About
        </div>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
          DataBridge Pro is a high-performance Windows desktop application that connects your broker account to AmiBroker.
          It uses the official AmiBroker Data Plugin (ADK) interface — the same mechanism used by commercial institutional data vendors —
          to feed live 1-second bars and tick data directly into AmiBroker's charting engine in real time.
        </p>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.7, marginTop: '0.75rem', marginBottom: 0 }}>
          The bridge is <strong style={{ color: '#e2eaf4' }}>not a trading terminal</strong>; it is pure market data infrastructure,
          designed for sustained low-latency throughput: many symbols, continuous 1-second bars, flat memory over 8+ hour sessions.
        </p>
      </div>

      {/* How to Use Instructions */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
          Step-by-Step Guide
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {[
            { step: '1', title: 'Add Your Broker', desc: 'Go to the Broker Connection tab, click Connect Broker, select your broker (e.g. Fyers or Zerodha), enter your API credentials and complete 1-click login.' },
            { step: '2', title: 'Configure Symbols', desc: 'Go to Symbol Setup and search for symbols or click the quick preset buttons (e.g. NIFTY 50, BANKNIFTY, RELIANCE) to add them to your live feed.' },
            { step: '3', title: 'Start AmiBroker', desc: 'Open AmiBroker. Ensure the AmiBroker plugin (DataBridgePro.dll) is in your AmiBroker/Plugins directory.' },
            { step: '4', title: 'Set Time Interval', desc: 'In AmiBroker, go to Database Settings and select DataBridge Pro as the data source with 1 Minute base interval.' },
            { step: '5', title: 'Stream Live Data', desc: 'Open a chart in AmiBroker and type any added symbol (e.g. NIFTY 50 or RELIANCE) to view real-time streaming charts and 1-year historical backfill.' },
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,212,170,0.15)',
                color: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
              }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2eaf4', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
          Technology Stack
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          {STACK.map(({ icon: Icon, label, sub }) => (
            <div key={label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(0,212,170,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} style={{ color: '#00d4aa' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2eaf4' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b8099' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & License */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <Shield size={16} style={{ color: '#00d4aa' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Security</div>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.8 }}>
            <li>Windows DPAPI credential encryption</li>
            <li>Zero plaintext token storage</li>
            <li>TLS 1.3 for all broker API calls</li>
            <li>Localhost-only IPC channels</li>
            <li>No cloud backend required</li>
          </ul>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            License & Links
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Proprietary Software — All Rights Reserved</div>
            {[
              { label: 'Documentation', href: '#' },
              { label: 'AmiBroker ADK (Official)', href: 'https://amibroker.com/devsite.html' },
              { label: 'Fyers API Documentation', href: 'https://myapi.fyers.in/docsv3' },
              { label: 'Zerodha Kite API', href: 'https://kite.trade' },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: '#00d4aa', textDecoration: 'none' }}>
                <ExternalLink size={12} />
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#3d5068', paddingBottom: '1rem' }}>
        DataBridge Pro v1.0.0 — Built with Tauri, React, Rust — © 2026
      </div>
    </div>
  )
}
