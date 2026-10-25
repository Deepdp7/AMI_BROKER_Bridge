import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { BrokerAccount } from '../store/appStore'
import {
  Wifi, WifiOff, RefreshCw, AlertCircle, Plus, Trash2,
  ChevronRight, Shield, Key, Clock, CheckCircle, ExternalLink
} from 'lucide-react'
import { isApiAvailable, BASE_URL } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import Select from '../components/ui/Select'
import BrokerLogo from '../components/ui/BrokerLogo'


const BROKER_INFO: Record<string, {
  name: string; tag: string; color: string; description: string; authType: string; apiUrl: string
  /** Connectable in this version */
  supported?: boolean
  /** Where the client creates the API key, shown in the Add Broker dialog */
  setup?: string
  keyLabel?: string
  secretLabel?: string
}> = {
  zerodha_kite: {
    name: 'Zerodha Kite',
    tag: 'ZK',
    color: '#387ED1',
    description: 'Kite Connect v3. 1-minute history (60 days per request) + WebSocket tick stream.',
    authType: 'Browser login (API Key + Secret)',
    apiUrl: 'https://kite.trade',
    supported: true,
    setup: 'Create an app on developers.kite.trade (the paid Kite Connect plan — the free Personal plan has no market data). Copy its API key and API secret.',
  },
  angel_one: {
    name: 'Angel One', tag: 'AO', color: '#E87722', description: 'Angel One SmartAPI. 1-minute history (30 days per request) + WebSocket 2.0 feed.', authType: 'Browser login (SmartAPI key)', apiUrl: 'https://smartapi.angelone.in',
    supported: true,
    setup: 'On smartapi.angelone.in → My Apps, create an app with the redirect URL below and copy its API Key and Secret Key. You log in on Angel One\'s own page; no PIN or TOTP is typed here.',
    keyLabel: 'API Key', secretLabel: 'Secret Key',
  },
  upstox: {
    name: 'Upstox', tag: 'UP', color: '#6C35DE', description: 'Upstox API v3. 1-minute history since 2022 + market data feed.', authType: 'Browser login (API Key + Secret)', apiUrl: 'https://upstox.com',
    supported: true,
    setup: 'On account.upstox.com/developer/apps, create an app with the redirect URL below and copy its API Key and API Secret.',
  },
  fyers: {
    name: 'Fyers', tag: 'FY', color: '#FF6600', description: 'Fyers API v3. 1-minute historical data + tick stream.', authType: 'Browser login (App ID + Secret)', apiUrl: 'https://fyers.in',
    supported: true,
    setup: 'Create an app on myapi.fyers.in → Dashboard → Create App. Its App ID (ends in -100) is the API Key, its Secret ID the API Secret.',
    keyLabel: 'App ID (API Key)', secretLabel: 'Secret ID (API Secret)',
  },
  dhan: {
    name: 'Dhan', tag: 'DH', color: '#0052FF', description: 'DhanHQ v2. 1-minute history (5 years) + live market feed.', authType: 'Browser login (API Key + Secret)', apiUrl: 'https://dhanhq.co',
    supported: true,
    setup: 'On web.dhan.co → My Profile → Access DhanHQ APIs, choose "API key" and create one. History and live data need Dhan\'s Data API plan.',
  },
  flattrade: {
    name: 'Flattrade', tag: 'FT', color: '#00A859', description: 'Flattrade Pi API (v2). 1-minute history + live touchline feed.', authType: 'Browser login (API Key + Secret)', apiUrl: 'https://flattrade.in',
    supported: true,
    setup: 'On wall.flattrade.in → Pi → API (v2), create an API key with the redirect URL below and your static IP, wait for approval, then copy the API key and secret key.',
    keyLabel: 'API Key', secretLabel: 'Secret Key',
  },
  shoonya: {
    name: 'Shoonya', tag: 'SH', color: '#1A365D', description: 'Finvasia Shoonya API. 1-minute history + live touchline feed.', authType: 'Browser login (OAuth Client ID + Secret)', apiUrl: 'https://shoonya.com',
    supported: true,
    setup: 'On trade.shoonya.com → profile → API Key, set the redirect URL below and register this PC\'s internet (static) IP address (Shoonya refuses API calls from other IPs). Copy the Client ID and Secret Code.',
    keyLabel: 'Client ID (OAuth)', secretLabel: 'Secret Code',
  },
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
              <div style={{ color: '#a1a7b0', fontSize: '0.75rem', marginTop: '0.15rem' }}>Tokens expire daily per SEBI rules. Click below to reconnect in 5 seconds.</div>
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
          <BrokerLogo brokerType={broker.brokerType} size={44} />
          <div>
            <div style={{ fontWeight: 600, color: '#eceef2', marginBottom: '0.25rem' }}>{info.name}</div>
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
            <div key={label} style={{ background: 'rgba(23,23,23,0.4)', borderRadius: '0.5rem', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#8b9199', fontSize: '0.72rem', marginBottom: '0.375rem' }}>
                <Icon size={11} />
                {label}
              </div>
              <div style={{ color: '#eceef2', fontSize: '0.8rem', fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
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
  const [clientId, setClientId] = useState('')
  const [step, setStep] = useState<'credentials' | 'authenticating' | 'success'>('credentials')
  const info = BROKER_INFO[selectedBrokerType]
  const [pastedUrl, setPastedUrl] = useState('')
  const needsClientId = selectedBrokerType === 'dhan' || selectedBrokerType === 'shoonya'
  const clientIdField = selectedBrokerType === 'shoonya'
    ? { label: 'Shoonya User ID', placeholder: 'Your Shoonya login ID, e.g. FA12345' }
    : { label: 'Dhan Client ID', placeholder: '10-digit Client ID from your Dhan profile' }

  // Shoonya may show its own page after login instead of returning here: the code in that
  // page's address completes the login the same way the redirect would
  const submitPastedUrl = async () => {
    const text = pastedUrl.trim()
    let code = ''
    try { code = new URL(text).searchParams.get('code') || '' } catch { code = /^[\w-]+$/.test(text) ? text : '' }
    if (!code) { toast.error('No Login Code', 'Paste the full address of the page you landed on (it contains code=…).'); return }
    const res = await fetch(`${BASE_URL}/callback/${selectedBrokerType}?code=${encodeURIComponent(code)}`)
    if (!res.ok) toast.error('Login Failed', (await res.text()).replace(/<[^>]+>/g, ' ').trim().slice(0, 200))
  }

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
            clientId: needsClientId ? clientId.trim() : undefined,
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
      background: 'rgba(14,14,14, 0.85)',
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
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#eceef2', margin: 0 }}>Add Broker</h2>
            <p style={{ fontSize: '0.78rem', color: '#8b9199', margin: '0.25rem 0 0' }}>Configure Automatic Connection</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
        </div>

        {step === 'credentials' && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.78rem', color: '#a1a7b0', display: 'block', marginBottom: '0.375rem' }}>Select Broker</label>
              <Select
                value={selectedBrokerType}
                onChange={setSelectedBrokerType}
                options={Object.entries(BROKER_INFO).filter(([, b]) => b.supported).map(([key, b]) => ({
                  value: key,
                  label: b.name,
                  leading: <BrokerLogo brokerType={key} size={24} />,
                }))}
              />
              {info?.setup && (
                <div style={{ fontSize: '0.74rem', color: '#8b9199', lineHeight: 1.5, marginTop: '0.5rem' }}>{info.setup}</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              {needsClientId && (
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#a1a7b0', display: 'block', marginBottom: '0.375rem' }}>{clientIdField.label}</label>
                  <input
                    id="broker-client-id"
                    className="input-field"
                    placeholder={clientIdField.placeholder}
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    type="text"
                  />
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.78rem', color: '#a1a7b0', display: 'block', marginBottom: '0.375rem' }}>{info?.keyLabel || 'API Key'}</label>
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
                <label style={{ fontSize: '0.78rem', color: '#a1a7b0', display: 'block', marginBottom: '0.375rem' }}>{info?.secretLabel || 'API Secret'}</label>
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
              <div style={{ fontSize: '0.75rem', color: '#a1a7b0', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                Copy and paste this exact URL into your {BROKER_INFO[selectedBrokerType]?.name || 'broker'} API app settings for automatic login:
              </div>
              <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', color: '#eceef2', fontSize: '0.8rem', userSelect: 'all', wordBreak: 'break-all' }}>
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
                disabled={!apiKey || !apiSecret || (needsClientId && !clientId.trim())}
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
            <h3 style={{ color: '#eceef2', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Waiting for Authentication...</h3>
            <p style={{ color: '#a1a7b0', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              A browser window has opened.<br />Please log in to your broker account to complete the setup.
            </p>
            {selectedBrokerType === 'shoonya' && (
              <div style={{ width: '100%', marginTop: '1.25rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.74rem', color: '#8b9199', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  Did Shoonya leave you on its own page after logging in? Copy that page's address from the browser and paste it here:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="broker-pasted-url"
                    className="input-field"
                    placeholder="https://…?code=…"
                    value={pastedUrl}
                    onChange={e => setPastedUrl(e.target.value)}
                    type="text"
                  />
                  <button className="btn-secondary" onClick={submitPastedUrl} disabled={!pastedUrl.trim()}>Finish</button>
                </div>
              </div>
            )}
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#eceef2', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={20} style={{ color: '#00d4aa' }} />
            Broker Connection
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#8b9199', margin: '0.25rem 0 0' }}>
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
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#eceef2', marginBottom: '0.25rem' }}>Secure by Design</div>
          <div style={{ fontSize: '0.75rem', color: '#8b9199', lineHeight: 1.6 }}>
            All credentials are protected via Windows DPAPI (per-user encryption). Tokens are never stored in plaintext,
            never logged, and never transmitted outside your machine. DataBridge Pro only connects to the broker's official API endpoints over TLS 1.3.
          </div>
        </div>
      </div>

      {/* Broker Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {brokers.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <WifiOff size={36} style={{ color: '#575d66', margin: '0 auto 1rem' }} />
            <div style={{ color: '#8b9199', marginBottom: '1rem' }}>No broker accounts configured</div>
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
        <div style={{ fontSize: '0.75rem', color: '#575d66', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Supported Brokers
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { name: 'Zerodha Kite', type: 'zerodha_kite', status: 'Available', cls: 'badge-green' },
            { name: 'Fyers', type: 'fyers', status: 'Available', cls: 'badge-green' },
            { name: 'Dhan', type: 'dhan', status: 'Available', cls: 'badge-green' },
            { name: 'Flattrade', type: 'flattrade', status: 'Available', cls: 'badge-green' },
            { name: 'Shoonya', type: 'shoonya', status: 'Available', cls: 'badge-green' },
            { name: 'Upstox', type: 'upstox', status: 'Available', cls: 'badge-green' },
            { name: 'Angel One', type: 'angel_one', status: 'Available', cls: 'badge-green' },
          ].map(b => (
            <div key={b.name} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <BrokerLogo brokerType={b.type} size={26} />
              <span style={{ fontSize: '0.8rem', color: '#eceef2', fontWeight: 500 }}>{b.name}</span>
              <span className={`badge ${b.cls}`} style={{ fontSize: '0.68rem' }}>{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
