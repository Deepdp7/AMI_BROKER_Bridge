import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { BrokerAccount } from '../store/appStore'
import {
  Wifi, WifiOff, RefreshCw, AlertCircle, Plus, Trash2, ChevronDown, Shield, Key, Clock, CheckCircle,
  ExternalLink, Copy, Eye, EyeOff, Zap, Link2, Gauge, Sparkles, Lock, ArrowRight,
} from 'lucide-react'
import { isApiAvailable, BASE_URL } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import Select from '../components/ui/Select'
import BrokerLogo from '../components/ui/BrokerLogo'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogHeader, confirmDialog } from '../components/ui/Dialog'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { BROKER_INFO, BROKER_ORDER, SPEED_LABEL, SPEED_COLOR, redirectUrlFor } from '../lib/brokers'
import { formatAgo } from '../lib/format'
import { useThrottledSymbols } from '../hooks/useThrottledSymbols'

async function openExternal(url: string) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    window.open(url, '_blank')
  }
}

/** Opens the broker's login page again (a fresh token for the day) */
async function startRelogin(broker: BrokerAccount) {
  const res = await fetch(`${BASE_URL}/brokers/${broker.id}/reauth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Re-login failed')
  // Brokers that log in with their keys alone are already logged in again: no page to open
  if (data.loginUrl) await openExternal(data.loginUrl)
  else toast.success('Logged in again', `${BROKER_INFO[broker.brokerType]?.name || 'The broker'} is connected with your saved keys.`)
}

const STATUS_LOOK: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  connected: { color: 'var(--good)', label: 'Connected', icon: CheckCircle },
  reconnecting: { color: '#f59e0b', label: 'Reconnecting…', icon: RefreshCw },
  auth_required: { color: '#fb923c', label: 'Login needed', icon: AlertCircle },
  disconnected: { color: '#8b9199', label: 'Disconnected', icon: WifiOff },
  error: { color: '#f43f5e', label: 'Error', icon: AlertCircle },
}

/** Five bars for how fast history downloads from a broker */
export function SpeedMeter({ speed, showLabel = true }: { speed: number; showLabel?: boolean }) {
  const color = SPEED_COLOR[speed] || '#8b9199'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} aria-label={`History speed: ${SPEED_LABEL[speed]}`}>
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} style={{ width: 4, height: 4 + n * 1.6, borderRadius: 1.5, background: n <= speed ? color : 'rgba(255,255,255,0.1)', boxShadow: n <= speed ? `0 0 6px ${color}55` : 'none', transition: 'background .3s' }} />
        ))}
      </span>
      {showLabel && <span style={{ fontSize: '0.72rem', fontWeight: 650, color }}>{SPEED_LABEL[speed]}</span>}
    </span>
  )
}

function BrokerCard({ broker, index, symbolCount, onRemove }: { broker: BrokerAccount; index: number; symbolCount: number; onRemove: () => void }) {
  const info = BROKER_INFO[broker.brokerType]
  const [expanded, setExpanded] = useState(false)
  const [reauthing, setReauthing] = useState(false)
  const look = STATUS_LOOK[broker.status?.toLowerCase()] || STATUS_LOOK.disconnected
  const StatusIcon = look.icon

  const handleReAuth = async () => {
    setReauthing(true)
    try {
      await startRelogin(broker)
      if (!info?.direct) toast.success('Browser opened', `Log in to ${info?.name || 'your broker'} there; DataBridge Pro picks up the new login by itself.`)
    } catch (e: any) {
      toast.error('Re-login failed', e.message)
    } finally {
      setReauthing(false)
    }
  }

  return (
    <div id={`broker-card-${broker.id}`} className="glass-card reveal lift" style={{ ['--i' as any]: index + 2, padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* Status glow along the top edge */}
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${look.color}, transparent)`, opacity: 0.8 }} />

      {broker.status === 'auth_required' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.1rem', background: 'linear-gradient(90deg, rgba(251,146,60,0.14), rgba(251,146,60,0.04))', borderBottom: '1px solid rgba(251,146,60,0.25)' }}>
          <AlertCircle size={18} style={{ color: '#fb923c', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.84rem' }}>Daily login needed</div>
            <div style={{ color: '#a1a7b0', fontSize: '0.74rem', marginTop: 2 }}>Broker logins expire every day (SEBI rule). It takes a few seconds.</div>
          </div>
          <button
            id={`reauth-broker-${broker.id}`}
            onClick={handleReAuth}
            disabled={reauthing}
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #fb923c, #f97316)', color: '#fff', padding: '0.45rem 0.9rem', fontSize: '0.78rem', boxShadow: '0 0 14px rgba(251,146,60,0.35)' }}
          >
            {reauthing ? <RefreshCw size={13} className="animate-spin" /> : <ExternalLink size={13} />}
            {reauthing ? 'Opening…' : 'Log in now'}
          </button>
        </div>
      )}

      <div style={{ padding: '1.1rem 1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <span style={{ position: 'relative', display: 'inline-flex', borderRadius: 14, boxShadow: `0 0 0 2px ${look.color}55, 0 0 22px ${look.color}30` }}>
            <BrokerLogo brokerType={broker.brokerType} size={50} />
            <span className={broker.status === 'connected' ? 'breathe' : ''} style={{ position: 'absolute', right: -3, bottom: -3, width: 13, height: 13, borderRadius: '50%', background: look.color, border: '2px solid rgb(var(--s2-rgb))', boxShadow: `0 0 8px ${look.color}` }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#eceef2' }}>{info?.name || broker.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.76rem', color: look.color, fontWeight: 600 }}>
              <StatusIcon size={12} className={broker.status === 'reconnecting' ? 'animate-spin' : ''} />
              {look.label}
              {broker.accountId && <span style={{ color: '#6b727c', fontWeight: 500 }}>· {broker.accountId}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
          {[
            { icon: Link2, label: 'Symbols', value: <AnimatedNumber value={symbolCount} /> },
            { icon: Clock, label: 'Last login', value: broker.lastConnectedAt ? formatAgo(broker.lastConnectedAt) : 'Never' },
            { icon: Gauge, label: 'History speed', value: info ? <SpeedMeter speed={info.speed} /> : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.55rem 0.65rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.64rem', color: '#6b727c', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 650 }}>
                <Icon size={11} /> {label}
              </div>
              <div style={{ marginTop: 4, fontSize: '0.86rem', color: '#eceef2', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="db-collapse" data-open={expanded}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
              {[
                { icon: Key, label: 'Account ID', value: broker.accountId || 'Shown after login' },
                { icon: Shield, label: 'Login method', value: info?.authType || '—' },
                { icon: Clock, label: 'Last connected', value: broker.lastConnectedAt ? new Date(broker.lastConnectedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never' },
                { icon: Zap, label: 'History', value: info?.speedNote || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ background: 'rgb(var(--s0-rgb) / 0.5)', borderRadius: 10, padding: '0.6rem 0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b727c', fontSize: '0.68rem', marginBottom: 4 }}><Icon size={11} />{label}</div>
                  <div style={{ color: '#d1d5db', fontSize: '0.76rem', lineHeight: 1.45 }}>{value}</div>
                </div>
              ))}
            </div>
            {info?.apiUrl && (
              <button className="icon-btn" style={{ marginTop: '0.6rem' }} onClick={() => openExternal(info.apiUrl)}>
                <ExternalLink size={12} /> {info.name} API website
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.9rem', alignItems: 'center' }}>
          <button id={`expand-broker-${broker.id}`} onClick={() => setExpanded(!expanded)} className="icon-btn" data-on={expanded} aria-expanded={expanded}>
            Details
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />
          </button>
          {broker.status !== 'auth_required' && (
            <button className="icon-btn" onClick={handleReAuth} disabled={reauthing} title="Open the broker's login page to get a fresh login">
              {reauthing ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />} Log in again
            </button>
          )}
          <button
            id={`remove-broker-${broker.id}`}
            onClick={onRemove}
            className="icon-btn remove-btn"
            style={{ marginLeft: 'auto' }}
            title="Remove this broker"
            aria-label={`Remove ${info?.name || 'broker'}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

const STEPS = ['Keys', 'Log in', 'Done']

function AddBrokerModal({ open, initialType, onClose }: { open: boolean; initialType: string; onClose: () => void }) {
  const addBroker = useAppStore(s => s.addBroker)
  const [selectedBrokerType, setSelectedBrokerType] = useState(initialType)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [clientId, setClientId] = useState('')
  const [secretParts, setSecretParts] = useState<string[]>([])
  const [showSecret, setShowSecret] = useState(false)
  const [step, setStep] = useState<'credentials' | 'authenticating' | 'success'>('credentials')
  const [pastedUrl, setPastedUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const timers = useRef<{ poll?: ReturnType<typeof setInterval>; stop?: ReturnType<typeof setTimeout> }>({})
  const info = BROKER_INFO[selectedBrokerType]
  const clientIdField = info?.userId
  const needsClientId = !!clientIdField
  const partFields = info?.secretParts
  // Several secret fields (Kotak) are sent as one value, joined with "|"
  const secretValue = partFields ? partFields.map((_, i) => (secretParts[i] || '').trim().replace(/\|/g, '')).join('|') : apiSecret
  const secretComplete = partFields ? partFields.every((_, i) => (secretParts[i] || '').trim()) : !!apiSecret
  const redirectUrl = redirectUrlFor(selectedBrokerType)

  const stopPolling = () => {
    if (timers.current.poll) clearInterval(timers.current.poll)
    if (timers.current.stop) clearTimeout(timers.current.stop)
    timers.current = {}
  }
  useEffect(() => stopPolling, [])

  // Fresh form each time it opens
  useEffect(() => {
    if (!open) return
    setSelectedBrokerType(initialType)
    setApiKey(''); setApiSecret(''); setClientId(''); setSecretParts([]); setPastedUrl(''); setShowSecret(false)
    setStep('credentials')
  }, [open, initialType])

  const close = () => { stopPolling(); onClose() }

  // Shoonya, Zebu and TradeSmart may show their own page after login instead of returning here: the code in that
  // page's address completes the login the same way the redirect would
  const submitPastedUrl = async () => {
    const text = pastedUrl.trim()
    let code = ''
    try { code = new URL(text).searchParams.get('code') || '' } catch { code = /^[\w-]+$/.test(text) ? text : '' }
    if (!code) { toast.error('No Login Code', 'Paste the full address of the page you landed on (it contains code=…).'); return }
    const res = await fetch(`${BASE_URL}/callback/${selectedBrokerType}?code=${encodeURIComponent(code)}`)
    if (!res.ok) toast.error('Login Failed', (await res.text()).replace(/<[^>]+>/g, ' ').trim().slice(0, 200))
  }

  const copyRedirect = () => {
    navigator.clipboard?.writeText(redirectUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  const handleConnect = async () => {
    setStep('authenticating')
    try {
      if (!(await isApiAvailable())) throw new Error('API Offline')
      const response = await fetch(`${BASE_URL}/brokers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerType: selectedBrokerType,
          label: BROKER_INFO[selectedBrokerType].name,
          apiKey,
          apiSecret: secretValue,
          clientId: needsClientId ? clientId.trim() : undefined,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to initiate connection')
      }
      const { broker, loginUrl } = await response.json()
      addBroker(broker)
      // Brokers that log in with their keys alone are connected already
      if (!loginUrl) {
        setStep('success')
        setTimeout(() => onClose(), 1800)
        return
      }
      await openExternal(loginUrl)

      // Wait for the login to come back (up to 2 minutes)
      stopPolling()
      timers.current.poll = setInterval(async () => {
        try {
          const brokers = await (await fetch(`${BASE_URL}/brokers`)).json()
          const b = brokers.find((br: any) => br.id === broker.id)
          if (b && b.status === 'connected') {
            stopPolling()
            setStep('success')
            setTimeout(() => onClose(), 1800)
          } else if (b && b.status === 'error') {
            stopPolling()
            setStep('credentials')
            toast.error('Authentication Failed', 'Check your credentials')
          }
        } catch { /* engine busy; try again */ }
      }, 2000)
      timers.current.stop = setTimeout(stopPolling, 120000)
    } catch (e: any) {
      toast.error('Connection Failed', e.message)
      setStep('credentials')
    }
  }

  const stepIndex = step === 'credentials' ? 0 : step === 'authenticating' ? 1 : 2
  const label = { fontSize: '0.76rem', color: '#a1a7b0', display: 'block', marginBottom: '0.35rem', fontWeight: 600 } as const

  return (
    <Dialog open={open} onClose={close} width={480} label="Add broker">
      <DialogHeader
        title="Connect a broker"
        subtitle="Your keys stay on this PC, encrypted for your Windows account."
        icon={<span className="page-icon"><Wifi size={18} /></span>}
        onClose={close}
      />

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '1rem 1.25rem 0' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800,
              background: i <= stepIndex ? 'linear-gradient(135deg,var(--accent),var(--accent-lo))' : 'rgba(255,255,255,0.06)', color: i <= stepIndex ? 'rgb(var(--s0-rgb))' : '#6b727c',
              boxShadow: i === stepIndex ? '0 0 0 4px rgb(var(--accent-rgb) / 0.15)' : 'none', transition: 'all .35s',
            }}>{i < stepIndex ? '✓' : i + 1}</span>
            <span style={{ fontSize: '0.74rem', fontWeight: 650, color: i <= stepIndex ? '#eceef2' : '#6b727c' }}>{s}</span>
            {i < STEPS.length - 1 && (
              <span style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: i < stepIndex ? '100%' : '0%', background: 'var(--accent)', transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} />
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '1.1rem 1.25rem 1.25rem' }}>
        {step === 'credentials' && (
          <div key="cred" className="reveal">
            <div style={{ marginBottom: '1rem' }}>
              <label style={label}>Broker</label>
              <Select
                value={selectedBrokerType}
                onChange={setSelectedBrokerType}
                options={BROKER_ORDER.map(key => ({
                  value: key,
                  label: BROKER_INFO[key].name,
                  leading: <BrokerLogo brokerType={key} size={24} />,
                }))}
              />
              {info && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.72rem', color: '#8b9199' }}>
                  <SpeedMeter speed={info.speed} /> <span>{info.speedNote}</span>
                </div>
              )}
              {info?.setup && <div style={{ fontSize: '0.74rem', color: '#8b9199', lineHeight: 1.55, marginTop: '0.5rem' }}>{info.setup}</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
              {clientIdField && (
                <div>
                  <label style={label} htmlFor="broker-client-id">{clientIdField.label}</label>
                  <input id="broker-client-id" className="input-field" placeholder={clientIdField.placeholder} value={clientId} onChange={e => setClientId(e.target.value)} type="text" />
                </div>
              )}
              <div>
                <label style={label} htmlFor="kite-api-key">{info?.keyLabel || 'API Key'}</label>
                <input id="kite-api-key" className="input-field" placeholder="xxxxxxxxxxxxxxxx" value={apiKey} onChange={e => setApiKey(e.target.value)} type="text" autoComplete="off" spellCheck={false} />
              </div>
              {partFields ? partFields.map((f, i) => (
                <div key={f.label}>
                  <label style={label} htmlFor={`broker-secret-part-${i}`}>{f.label}</label>
                  <input id={`broker-secret-part-${i}`} className="input-field" placeholder={f.placeholder} value={secretParts[i] || ''} onChange={e => setSecretParts(p => { const n = [...p]; n[i] = e.target.value; return n })} type={f.hidden && !showSecret ? 'password' : 'text'} autoComplete="off" spellCheck={false} />
                </div>
              )) : (
              <div>
                <label style={label} htmlFor="kite-api-secret">{info?.secretLabel || 'API Secret'}</label>
                <div style={{ position: 'relative' }}>
                  <input id="kite-api-secret" className="input-field" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={apiSecret} onChange={e => setApiSecret(e.target.value)} type={showSecret ? 'text' : 'password'} autoComplete="off" spellCheck={false} style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowSecret(s => !s)} aria-label={showSecret ? 'Hide secret' : 'Show secret'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', display: 'flex' }}>
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              )}
            </div>

            {info?.direct ? (
              <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', borderRadius: 10, padding: '0.8rem', marginBottom: '1.1rem', border: '1px solid rgb(var(--accent-rgb) / 0.18)', fontSize: '0.74rem', color: '#a1a7b0', lineHeight: 1.5 }}>
                No browser login: DataBridge Pro logs in with these details right away, and again by itself whenever the session ends.
              </div>
            ) : (
            <div style={{ background: 'rgb(var(--accent-rgb) / 0.06)', borderRadius: 10, padding: '0.8rem', marginBottom: '1.1rem', border: '1px solid rgb(var(--accent-rgb) / 0.18)' }}>
              <div style={{ color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Link2 size={12} /> Redirect URL (required)
              </div>
              <div style={{ fontSize: '0.73rem', color: '#a1a7b0', marginBottom: '0.5rem', lineHeight: 1.45 }}>
                Paste this exact address into your {info?.name || 'broker'} API app settings:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <code style={{ flex: 1, display: 'block', background: 'rgba(0,0,0,0.35)', padding: '0.5rem 0.6rem', borderRadius: 7, color: '#eceef2', fontSize: '0.76rem', wordBreak: 'break-all' }}>
                  {redirectUrl}
                </code>
                <button type="button" className="icon-btn" data-on={copied} onClick={copyRedirect}>
                  {copied ? <CheckCircle size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            )}

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button onClick={close} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button
                id="connect-broker-btn"
                onClick={handleConnect}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={!apiKey || !secretComplete || (needsClientId && !clientId.trim())}
              >
                <Wifi size={14} /> {info?.direct ? 'Save & connect' : 'Save & log in'}
              </button>
            </div>
          </div>
        )}

        {step === 'authenticating' && (
          <div key="auth" className="reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0.5rem 0.5rem', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 72, height: 72, marginBottom: '1rem' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgb(var(--accent-rgb) / 0.12)', borderTopColor: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <span style={{ position: 'absolute', inset: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BrokerLogo brokerType={selectedBrokerType} size={40} /></span>
            </div>
            <h3 style={{ color: '#eceef2', margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Waiting for your login…</h3>
            <p style={{ color: '#a1a7b0', fontSize: '0.82rem', margin: 0, lineHeight: 1.55 }}>
              Your browser opened {info?.name || 'the broker'}'s login page.<br />Log in there; this window finishes by itself.
            </p>
            {info?.pasteFallback && (
              <div style={{ width: '100%', marginTop: '1.25rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.74rem', color: '#8b9199', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  Did {info.name} leave you on its own page after logging in? Copy that page's address from the browser and paste it here:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input id="broker-pasted-url" className="input-field" placeholder="https://…?code=…" value={pastedUrl} onChange={e => setPastedUrl(e.target.value)} type="text" />
                  <button className="btn-secondary" onClick={submitPastedUrl} disabled={!pastedUrl.trim()}>Finish</button>
                </div>
              </div>
            )}
            <button className="btn-secondary" style={{ marginTop: '1.25rem' }} onClick={() => { stopPolling(); setStep('credentials') }}>Back</button>
          </div>
        )}

        {step === 'success' && (
          <div key="ok" style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
            <svg width="76" height="76" viewBox="0 0 76 76" className="pop-in" style={{ margin: '0 auto', display: 'block' }}>
              <circle cx="38" cy="38" r="34" fill="rgb(var(--good-rgb) / 0.12)" stroke="var(--good)" strokeWidth="3" />
              <path d="M24 39 l9 9 l19 -20" fill="none" stroke="var(--good)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
            </svg>
            <div style={{ color: 'var(--good)', fontWeight: 700, fontSize: '1.05rem', marginTop: '0.9rem' }}>Connected</div>
            <div style={{ color: '#8b9199', fontSize: '0.8rem', marginTop: 4 }}>{info?.name} is streaming. Add symbols in Symbol Setup.</div>
          </div>
        )}
      </div>
      <style>{`
        .draw-check { stroke-dasharray: 48; stroke-dashoffset: 48; animation: drawCheck .5s .2s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes drawCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </Dialog>
  )
}

export function BrokerConnectionPage() {
  const brokers = useAppStore(s => s.brokers)
  const removeBroker = useAppStore(s => s.removeBroker)
  const historyUseAllBrokers = useAppStore(s => s.settings.historyUseAllBrokers)
  // Only counts are shown here: once a second is plenty
  const symbols = useThrottledSymbols(2000)
  const [modal, setModal] = useState<{ open: boolean; type: string }>({ open: false, type: 'dhan' })
  const [showSecurity, setShowSecurity] = useState(false)
  const added = new Set<string>(brokers.map(b => b.brokerType))
  // Starts on the fastest broker not added yet
  const openAdd = (type = BROKER_ORDER.find(t => !added.has(t)) || 'dhan') => setModal({ open: true, type })

  const connected = brokers.filter(b => b.status === 'connected')
  const needLogin = brokers.filter(b => b.status === 'auth_required')
  const symbolsPer = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of symbols) if (s.brokerId) m.set(s.brokerId, (m.get(s.brokerId) || 0) + 1)
    return m
  }, [symbols])
  const linked = useMemo(() => symbols.filter(s => s.brokerId && brokers.some(b => b.id === s.brokerId)).length, [symbols, brokers])
  const fastest = connected.map(b => BROKER_INFO[b.brokerType]).filter(Boolean).sort((a, b) => b.speed - a.speed)[0]
  const sharing = connected.length > 1 && historyUseAllBrokers !== false

  const remove = async (b: BrokerAccount) => {
    const name = BROKER_INFO[b.brokerType]?.name || b.label
    const n = symbolsPer.get(b.id) || 0
    const ok = await confirmDialog({
      title: `Remove ${name}?`,
      message: `Its login and keys are deleted from this PC. ${n ? `Your ${n} symbol${n === 1 ? '' : 's'} and all downloaded history stay; they stream again as soon as you connect a broker.` : 'Your symbols and history stay.'}`,
      confirmLabel: 'Remove broker',
      tone: 'danger',
    })
    if (!ok) return
    removeBroker(b.id)
    try {
      await fetch(`${BASE_URL}/brokers/${b.id}`, { method: 'DELETE' })
      toast.success(`${name} removed`, undefined, 3000)
    } catch { /* already gone */ }
  }

  const reloginAll = async () => {
    for (const b of needLogin) {
      try { await startRelogin(b) } catch (e: any) { toast.error('Re-login failed', `${BROKER_INFO[b.brokerType]?.name}: ${e.message}`) }
    }
    toast.info('Browser opened', `Log in to ${needLogin.length} broker${needLogin.length === 1 ? '' : 's'}; each one reconnects by itself.`, 5000)
  }

  return (
    <div style={{ width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <AddBrokerModal open={modal.open} initialType={modal.type} onClose={() => setModal(m => ({ ...m, open: false }))} />

      <PageHeader
        icon={Wifi}
        title="Broker Connections"
        subtitle={brokers.length === 0
          ? 'Connect a broker account to stream prices and download history'
          : `${connected.length} of ${brokers.length} connected${needLogin.length ? ` · ${needLogin.length} need${needLogin.length === 1 ? 's' : ''} a login` : ''}`}
        actions={
          <>
            {needLogin.length > 1 && (
              <button className="icon-btn" onClick={reloginAll} style={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.1)', height: 38 }}>
                <ExternalLink size={13} /> Log in to all ({needLogin.length})
              </button>
            )}
            <button id="add-broker-btn" onClick={() => openAdd()} className="btn-primary">
              <Plus size={15} /> Add Broker
            </button>
          </>
        }
      />

      {/* Summary */}
      {brokers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem' }}>
          <div className="metric-card reveal" style={{ ['--i' as any]: 1 }}>
            <div style={{ fontSize: '0.7rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 650 }}>Connected</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 750, color: connected.length ? 'var(--good)' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
              <AnimatedNumber value={connected.length} /><span style={{ fontSize: '0.95rem', color: '#6b727c' }}> / {brokers.length}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: 2 }}>{needLogin.length ? `${needLogin.length} waiting for today's login` : 'All logins are current'}</div>
          </div>
          <div className="metric-card reveal" style={{ ['--i' as any]: 2 }}>
            <div style={{ fontSize: '0.7rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 650 }}>Symbols linked</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 750, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
              <AnimatedNumber value={linked} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: 2 }}>{symbols.length - linked > 0 ? `${symbols.length - linked} waiting for a broker` : 'Every symbol has a broker'}</div>
          </div>
          <div className="metric-card reveal" style={{ ['--i' as any]: 3 }}>
            <div style={{ fontSize: '0.7rem', color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 650 }}>History downloads</div>
            <div style={{ marginTop: 8 }}>{fastest ? <SpeedMeter speed={fastest.speed} /> : <span style={{ color: '#6b727c', fontSize: '0.85rem' }}>No broker connected</span>}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b727c', marginTop: 6 }}>
              {sharing ? `Shared across ${connected.length} brokers for speed` : fastest ? `From ${fastest.name}` : 'Connect a broker to download'}
            </div>
          </div>
        </div>
      )}

      {/* Broker cards */}
      {brokers.length === 0 ? (
        <div className="glass-card reveal" style={{ ['--i' as any]: 1, padding: '3rem 2rem', textAlign: 'center' }}>
          <div className="pop-in" style={{ width: 72, height: 72, margin: '0 auto 1rem', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.22)', boxShadow: '0 0 40px rgb(var(--accent-rgb) / 0.12)' }}>
            <WifiOff size={30} color="var(--accent)" />
          </div>
          <div style={{ color: '#eceef2', fontWeight: 700, fontSize: '1.05rem' }}>No broker connected yet</div>
          <div style={{ color: '#8b9199', fontSize: '0.82rem', margin: '0.4rem auto 1.25rem', maxWidth: 420, lineHeight: 1.55 }}>
            Connect the broker you trade with. For the fastest history downloads, Dhan is recommended.
          </div>
          <button className="btn-primary" onClick={() => openAdd()}><Plus size={14} /> Add your first broker</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          {brokers.map((b, i) => (
            <BrokerCard key={b.id} broker={b} index={i} symbolCount={symbolsPer.get(b.id) || 0} onRemove={() => remove(b)} />
          ))}
        </div>
      )}

      {/* Security */}
      <div className="reveal" style={{ ['--i' as any]: 5, background: 'rgb(var(--accent-rgb) / 0.035)', border: '1px solid rgb(var(--accent-rgb) / 0.12)', borderRadius: 12, padding: '0.75rem 1rem' }}>
        <button onClick={() => setShowSecurity(s => !s)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }} aria-expanded={showSecurity}>
          <Lock size={15} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 650, color: '#eceef2' }}>Your keys are encrypted on this PC</span>
          <span style={{ fontSize: '0.74rem', color: '#6b727c' }}>How it works</span>
          <ChevronDown size={14} color="#8b9199" style={{ marginLeft: 'auto', transform: showSecurity ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }} />
        </button>
        <div className="db-collapse" data-open={showSecurity}>
          <div>
            <div style={{ fontSize: '0.76rem', color: '#8b9199', lineHeight: 1.6, padding: '0.6rem 0 0 1.6rem' }}>
              Credentials are protected with Windows DPAPI (encryption tied to your Windows account). Tokens are never stored in plain text and never written to logs.
              DataBridge Pro talks only to your broker's official API.
            </div>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="reveal" style={{ ['--i' as any]: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#8b9199', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {brokers.length ? 'Add another broker' : 'Supported brokers'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#575d66' }}>More brokers connected = faster history downloads</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
          {BROKER_ORDER.map((type, i) => {
            const info = BROKER_INFO[type]
            const isAdded = added.has(type)
            const live = brokers.some(b => b.brokerType === type && b.status === 'connected')
            return (
              <button
                key={type}
                onClick={() => isAdded ? document.getElementById(`broker-card-${brokers.find(b => b.brokerType === type)?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : openAdd(type)}
                className="glass-card lift sheen gallery-card reveal"
                style={{ ['--i' as any]: i + 7, padding: '0.9rem', textAlign: 'left', cursor: 'pointer', position: 'relative', border: type === 'dhan' ? '1px solid rgb(var(--accent-rgb) / 0.3)' : undefined, color: 'inherit', font: 'inherit' }}
                title={isAdded ? 'Already added: show it above' : `Connect ${info.name}`}
              >
                {type === 'dhan' && (
                  <span style={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 800, color: 'var(--on-accent)', background: 'linear-gradient(135deg,var(--accent),var(--accent-hi2))', padding: '2px 7px', borderRadius: 999, letterSpacing: '0.04em' }}>
                    <Sparkles size={10} /> RECOMMENDED
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <BrokerLogo brokerType={type} size={34} />
                  <div>
                    <div style={{ fontSize: '0.86rem', color: '#eceef2', fontWeight: 650 }}>{info.name}</div>
                    <SpeedMeter speed={info.speed} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#8b9199', lineHeight: 1.5, marginTop: '0.6rem', minHeight: '2.2em' }}>{info.speedNote}</div>
                <div style={{ marginTop: '0.6rem', fontSize: '0.74rem', fontWeight: 650, display: 'flex', alignItems: 'center', gap: 5, color: live ? 'var(--good)' : isAdded ? '#fb923c' : '#a1a7b0' }}>
                  {live ? <><CheckCircle size={13} /> Connected</> : isAdded ? <><AlertCircle size={13} /> Added · needs today's login</> : <>Connect <ArrowRight size={13} className="gallery-arrow" /></>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <style>{`
        .remove-btn:hover:not(:disabled) { color: #fb7185 !important; border-color: rgba(244,63,94,0.4) !important; background: rgba(244,63,94,0.1) !important; }
        .gallery-arrow { transition: transform .25s cubic-bezier(.34,1.56,.64,1); }
        .gallery-card:hover .gallery-arrow { transform: translateX(4px); }
      `}</style>
    </div>
  )
}
