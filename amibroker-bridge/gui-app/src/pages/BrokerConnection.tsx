import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { BrokerAccount } from '../store/appStore'
import {
  Wifi, WifiOff, RefreshCw, AlertCircle, Plus, Trash2,
  ChevronRight, Shield, Key, Clock, CheckCircle, ExternalLink
} from 'lucide-react'
import { isApiAvailable, BASE_URL } from '../api/apiClient'
import { toast } from '../components/Toast'


const BROKER_INFO: Record<string, { name: string; tag: string; color: string; description: string; authType: string; apiUrl: string }> = {
  zerodha_kite: {
    name: 'Zerodha Kite',
    tag: 'ZK',
    color: '#387ED1',
    description: "India's largest discount broker. WebSocket streaming, tick-level data.",
    authType: 'OAuth2 + TOTP',
    apiUrl: 'https://kite.trade',
  },
  angel_one: { name: 'Angel One', tag: 'AO', color: '#E87722', description: 'SmartAPI WebSocket.', authType: 'OAuth2', apiUrl: 'https://smartapi.angelbroking.com' },
  upstox: { name: 'Upstox', tag: 'UP', color: '#6C35DE', description: 'Upstox v2 API.', authType: 'OAuth2', apiUrl: 'https://upstox.com' },
  fyers: { name: 'Fyers', tag: 'FY', color: '#FF6600', description: 'Fyers API v3. 1-minute historical data + tick stream.', authType: 'OAuth2', apiUrl: 'https://fyers.in' },
  dhan: { name: 'Dhan', tag: 'DH', color: '#0052FF', description: 'DhanHQ API.', authType: 'API Key + Auth Token', apiUrl: 'https://dhanhq.co' },
  flattrade: { name: 'Flattrade', tag: 'FT', color: '#00A859', description: 'Flattrade (Fasttrade) API.', authType: 'API Key', apiUrl: 'https://flattrade.in' },
  shoonya: { name: 'Shoonya', tag: 'SH', color: '#1A365D', description: 'Finvasia Shoonya API.', authType: 'User + Password + TOTP', apiUrl: 'https://shoonya.com' },
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    connected: { cls: 'badge-green', label: 'Connected', icon: CheckCircle },
    reconnecting: { cls: 'badge-amber', label: 'Reconnecting...', icon: RefreshCw },
    auth_required: { cls: 'badge-red', label: 'Auth Required', icon: AlertCircle },
    disconnected: { cls: 'badge-gray', label: 'Disconnected', icon: WifiOff },
    error: { cls: 'badge-red', label: 'Error', icon: AlertCircle },
  }
  const { cls, label, icon: Icon } = map[status?.toLowerCase()] || map.disconnected
  return (
    <span className={`badge ${cls}`} style={{ gap: '0.375rem' }}>
      <Icon size={11} className={status === 'reconnecting' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

function BrokerCard({ broker, onRemove }: { broker: BrokerAccount; onRemove: () => void }) {
  const info = BROKER_INFO[broker.brokerType]
  const [expanded, setExpanded] = useState(false)
  const [reauthing, setReauthing] = useState(false)

  const formatTime = (ms?: number) => {
    if (!ms) return 'Never'
    const d = new Date(ms)
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const handleReAuth = async () => {
    setReauthing(true)
    try {
      const res = await fetch(`${BASE_URL}/brokers/${broker.id}/reauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Re-auth failed')
      try {
        const { open } = await import('@tauri-apps/plugin-shell')
        await open(data.loginUrl)
      } catch {
        window.open(data.loginUrl, '_blank')
      }
      toast.success('Browser Opened', 'Please log in to complete token refresh.')
    } catch (e: any) {
      toast.error('Re-Login Failed', e.message)
    } finally {
      setReauthing(false)
    }
  }

  return (
    <div id={`broker-card-${broker.id}`} className="glass-card glass-card-hover" style={{ padding: '1.25rem' }}>
      {/* Daily Re-Login Banner */}
      {broker.status === 'auth_required' && (
        <div style={{
          background: 'rgba(251,146,60,0.12)',
          border: '1px solid rgba(251,146,60,0.4)',
          borderRadius: '0.625rem',
          padding: '0.875rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <AlertCircle size={18} style={{ color: '#fb923c', flexShrink: 0 }} />
            <div>
              <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>Daily Re-Login Required</div>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>Tokens expire daily per SEBI rules. Click below to reconnect in 5 seconds.</div>
            </div>
          </div>
          <button
            id={`reauth-broker-${broker.id}`}
            onClick={handleReAuth}
            disabled={reauthing}
            style={{
              background: 'linear-gradient(135deg, #fb923c, #f97316)',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.8rem',
              padding: '0.5rem 1rem',
              cursor: reauthing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              whiteSpace: 'nowrap',
              opacity: reauthing ? 0.7 : 1,
              boxShadow: '0 0 12px rgba(251,146,60,0.4)',
            }}
          >
            {reauthing ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
            {reauthing ? 'Opening...' : '🔐 Re-Login Now'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'rgba(56, 126, 209, 0.15)',
            border: '1px solid rgba(56,126,209,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0
          }}>
            {(info as any).tag || 'BR'}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#e2eaf4', marginBottom: '0.25rem' }}>{info.name}</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="status-dot" style={{
                background: broker.status === 'connected' ? '#00d4aa' : broker.status === 'reconnecting' ? '#f59e0b' : '#f43f5e',
                width: 8, height: 8,
                boxShadow: broker.status === 'connected' ? '0 0 8px rgba(0,212,170,0.8)' : undefined,
                animation: broker.status === 'connected' ? 'pulse-green 2s infinite' : undefined,
              }} />
              <StatusBadge status={broker.status} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            id={`expand-broker-${broker.id}`}
            onClick={() => setExpanded(!expanded)}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
          >
            Details
            <ChevronRight size={13} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
          </button>
          <button
            id={`remove-broker-${broker.id}`}
            onClick={onRemove}
            className="btn-danger"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { icon: Key, label: 'Account ID', value: broker.accountId || 'N/A' },
            { icon: Clock, label: 'Last Connected', value: formatTime(broker.lastConnectedAt) },
            { icon: Shield, label: 'Auth Method', value: info.authType },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ background: 'rgba(10,22,40,0.4)', borderRadius: '0.5rem', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#6b8099', fontSize: '0.72rem', marginBottom: '0.375rem' }}>
                <Icon size={11} />
                {label}
              </div>
              <div style={{ color: '#e2eaf4', fontSize: '0.8rem', fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddBrokerModal({ onClose }: { onClose: () => void }) {
  const { addBroker } = useAppStore()
  const [selectedBrokerType, setSelectedBrokerType] = useState('zerodha_kite')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [step, setStep] = useState<'credentials' | 'authenticating' | 'success'>('credentials')

  const handleConnect = async () => {
    setStep('authenticating')
    try {
      if (await isApiAvailable()) {
        const response = await fetch(`${BASE_URL}/brokers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brokerType: selectedBrokerType,
            label: BROKER_INFO[selectedBrokerType].name,
            apiKey,
            apiSecret,
            redirectUrl: 'http://127.0.0.1:7890/api/callback/' + selectedBrokerType
          })
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to initiate connection')
        }
        
        const { broker, loginUrl } = await response.json()
        addBroker(broker)
        
        // Open the login URL in the user's default browser using Tauri shell plugin
        // Since we are in the browser context, we can just use window.open if Tauri plugin is not available
        try {
          const { open } = await import('@tauri-apps/plugin-shell')
          await open(loginUrl)
        } catch (e) {
          window.open(loginUrl, '_blank')
        }

        // Start polling for connection success
        const pollInterval = setInterval(async () => {
          // Check if it's connected now
          const res = await fetch(`${BASE_URL}/brokers`)
          const brokers = await res.json()
          const b = brokers.find((br: any) => br.id === broker.id)
          if (b && b.status === 'connected') {
            clearInterval(pollInterval)
            setStep('success')
            setTimeout(() => onClose(), 1500)
          } else if (b && b.status === 'error') {
            clearInterval(pollInterval)
            setStep('credentials')
            toast.error('Authentication Failed', 'Check your credentials')
          }
        }, 2000)

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000)

      } else {
        throw new Error('API Offline')
      }
    } catch (e: any) {
      toast.error('Connection Failed', e.message)
      setStep('credentials')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(5, 13, 26, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        className="glass-card animate-fade-in"
        style={{ width: '440px', padding: '1.75rem', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>Add Broker</h2>
            <p style={{ fontSize: '0.78rem', color: '#6b8099', margin: '0.25rem 0 0' }}>Configure Automatic Connection</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b8099', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
        </div>

        {step === 'credentials' && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.375rem' }}>Select Broker</label>
              <select
                value={selectedBrokerType}
                onChange={e => setSelectedBrokerType(e.target.value)}
                className="input-field"
                style={{ width: '100%', appearance: 'none' }}
              >
                {Object.entries(BROKER_INFO).map(([key, info]) => (
                  <option key={key} value={key}>{(info as any).tag || 'BR'} {info.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.375rem' }}>API Key</label>
                <input
                  id="kite-api-key"
                  className="input-field"
                  placeholder="xxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  type="text"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '0.375rem' }}>API Secret</label>
                <input
                  id="kite-api-secret"
                  className="input-field"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={apiSecret}
                  onChange={e => setApiSecret(e.target.value)}
                  type="password"
                />
              </div>
            </div>

            <div style={{ background: 'rgba(0,168,89,0.1)', borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1.25rem', border: '1px solid rgba(0,168,89,0.2)' }}>
              <div style={{ color: '#00d4aa', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Redirect URL (Mandatory)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                Copy and paste this exact URL into your Kite Developer App settings for automatic login:
              </div>
              <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', color: '#e2eaf4', fontSize: '0.8rem', userSelect: 'all', wordBreak: 'break-all' }}>
                http://127.0.0.1:7890/api/callback/{selectedBrokerType}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button
                id="connect-broker-btn"
                onClick={handleConnect}
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={!apiKey || !apiSecret}
              >
                <Wifi size={14} />
                Save & Login
              </button>
            </div>
          </>
        )}

        {step === 'authenticating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
            <div className="animate-spin" style={{ color: '#387ED1', marginBottom: '1rem' }}>
              <RefreshCw size={32} />
            </div>
            <h3 style={{ color: '#e2eaf4', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Waiting for Authentication...</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              A browser window has opened.<br />Please log in to your broker account to complete the setup.
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={32} style={{ color: '#00d4aa', margin: '0 auto 1rem' }} />
            <div style={{ color: '#00d4aa', fontWeight: 600 }}>Connected Successfully!</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function BrokerConnectionPage() {
  const { brokers, removeBroker } = useAppStore()
  const [showModal, setShowModal] = useState(false)

  return (
    <div style={{ width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {showModal && <AddBrokerModal onClose={() => setShowModal(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2eaf4', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={20} style={{ color: '#00d4aa' }} />
            Broker Connection
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#6b8099', margin: '0.25rem 0 0' }}>
            Manage broker accounts and authentication
          </p>
        </div>
        <button
          id="add-broker-btn"
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus size={15} />
          Add Broker
        </button>
      </div>

      {/* Security Notice */}
      <div style={{
        background: 'rgba(0,212,170,0.04)',
        border: '1px solid rgba(0,212,170,0.12)',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
      }}>
        <Shield size={16} style={{ color: '#00d4aa', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2eaf4', marginBottom: '0.25rem' }}>Secure by Design</div>
          <div style={{ fontSize: '0.75rem', color: '#6b8099', lineHeight: 1.6 }}>
            All credentials are protected via Windows DPAPI (per-user encryption). Tokens are never stored in plaintext,
            never logged, and never transmitted outside your machine. DataBridge Pro only connects to the broker's official API endpoints over TLS 1.3.
          </div>
        </div>
      </div>

      {/* Broker Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {brokers.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <WifiOff size={36} style={{ color: '#3d5068', margin: '0 auto 1rem' }} />
            <div style={{ color: '#6b8099', marginBottom: '1rem' }}>No broker accounts configured</div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={14} />
              Add Your First Broker
            </button>
          </div>
        ) : (
          brokers.map(b => (
            <BrokerCard key={b.id} broker={b} onRemove={async () => {
              removeBroker(b.id)
              try {
                await fetch(`http://127.0.0.1:7890/api/brokers/${b.id}`, { method: 'DELETE' })
                // toast.success('Broker Removed', 'Broker has been successfully removed.')
              } catch (e: any) {
                // toast.error('Failed to remove from server', e.message)
              }
            }} />
          ))
        )}
      </div>

      {/* Supported Brokers */}
      <div>
        <div style={{ fontSize: '0.75rem', color: '#3d5068', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Supported Brokers
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { name: 'Zerodha Kite', emoji: '🟢', status: 'Available', cls: 'badge-green' },
            { name: 'Fyers', emoji: '🟠', status: 'Available', cls: 'badge-green' },
            { name: 'Dhan', emoji: '🪙', status: 'Available', cls: 'badge-green' },
            { name: 'Flattrade', emoji: '⚡', status: 'Coming Soon', cls: 'badge-gray' },
            { name: 'Shoonya', emoji: '⭕', status: 'Coming Soon', cls: 'badge-gray' },
            { name: 'Upstox', emoji: '🟣', status: 'Coming Soon', cls: 'badge-gray' },
            { name: 'Angel One', emoji: '🔵', status: 'Coming Soon', cls: 'badge-gray' },
          ].map(b => (
            <div key={b.name} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span>{b.emoji}</span>
              <span style={{ fontSize: '0.8rem', color: '#e2eaf4', fontWeight: 500 }}>{b.name}</span>
              <span className={`badge ${b.cls}`} style={{ fontSize: '0.68rem' }}>{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
