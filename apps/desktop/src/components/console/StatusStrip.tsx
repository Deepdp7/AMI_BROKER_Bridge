/**
 * StatusStrip
 * Four plain answers at the top of the Activity page: is the service running, is the broker
 * connected, are live prices arriving, is history up to date. Green is fine, amber is
 * "will sort itself out", red needs the client to do something.
 */
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'

type Tone = 'good' | 'warn' | 'bad' | 'idle'

const TONE: Record<Tone, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#f43f5e', idle: '#8b9199' }

interface Card {
  label: string
  status: string
  sub: string
  tone: Tone
  action?: { label: string; to: string }
}

function StatusCard({ card }: { card: Card }) {
  const navigate = useNavigate()
  const color = TONE[card.tone]
  return (
    <div className="glass-card" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8b9199', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700, color: '#eceef2' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88`, flexShrink: 0 }} />
        {card.status}
      </div>
      <div style={{ fontSize: '0.76rem', color: '#8b9199', lineHeight: 1.45 }}>{card.sub}</div>
      {card.action && (
        <button className="btn-secondary" onClick={() => navigate(card.action!.to)} style={{ alignSelf: 'flex-start', marginTop: '0.35rem', padding: '0.3rem 0.7rem', fontSize: '0.74rem' }}>
          {card.action.label}
        </button>
      )}
    </div>
  )
}

export function StatusStrip({ engineRunning }: { engineRunning: boolean }) {
  const broker = useAppStore(s => s.brokers[0])
  const brokerCount = useAppStore(s => s.brokers.length)
  const marketStatus = useAppStore(s => s.marketStatus)
  const total = useAppStore(s => s.symbols.length)
  const live = useAppStore(s => s.symbols.filter(x => x.status === 'STREAMING' || x.status === 'RECEIVING').length)
  const paused = useAppStore(s => s.backfillPaused)
  const active = useAppStore(s => Object.values(s.backfillStatuses).filter(b => b.status === 'running' || b.status === 'pending').length)
  const batch = useAppStore(s => Object.keys(s.backfillStatuses).length)
  const percent = useAppStore(s => {
    const all = Object.values(s.backfillStatuses)
    if (all.length === 0) return 0
    return Math.round(all.reduce((n, b) => n + (b.status === 'completed' ? 100 : b.status === 'failed' ? 0 : Math.min(99, b.progress || 0)), 0) / all.length)
  })

  const service: Card = engineRunning
    ? { label: 'DataBridge service', status: 'Running', sub: 'The background service that fetches your data is working.', tone: 'good' }
    : { label: 'DataBridge service', status: 'Not reachable', sub: 'It restarts by itself. If this stays, use Restart data service.', tone: 'bad' }

  let brokerCard: Card
  if (!broker) {
    brokerCard = { label: 'Broker', status: 'Not added yet', sub: 'Add your broker to start receiving data.', tone: 'idle', action: { label: 'Add a broker', to: '/broker-connection' } }
  } else if (broker.status === 'connected') {
    brokerCard = { label: 'Broker', status: 'Connected', sub: `${broker.label}${brokerCount > 1 ? ` and ${brokerCount - 1} more` : ''} is logged in.`, tone: 'good' }
  } else if (broker.status === 'reconnecting') {
    brokerCard = { label: 'Broker', status: 'Reconnecting…', sub: `Trying to reach ${broker.label}. This usually takes a few seconds.`, tone: 'warn' }
  } else if (broker.status === 'auth_required') {
    brokerCard = { label: 'Broker', status: 'Login needed', sub: `${broker.label} asks you to log in again (this happens every morning).`, tone: 'bad', action: { label: 'Log in', to: '/broker-connection' } }
  } else {
    brokerCard = { label: 'Broker', status: 'Not connected', sub: `${broker.label} is not connected right now.`, tone: 'bad', action: { label: 'Open Broker Connection', to: '/broker-connection' } }
  }

  let prices: Card
  if (total === 0) {
    prices = { label: 'Live prices', status: 'No symbols yet', sub: 'Add symbols to see live prices.', tone: 'idle', action: { label: 'Add symbols', to: '/symbol-setup' } }
  } else if (marketStatus === 'closed') {
    prices = { label: 'Live prices', status: 'Market closed', sub: 'Prices stream again when the market opens at 9:15 AM.', tone: 'idle' }
  } else if (live === 0) {
    prices = { label: 'Live prices', status: 'Waiting for prices', sub: `${total.toLocaleString()} symbols are set up.`, tone: 'warn' }
  } else {
    prices = { label: 'Live prices', status: `${live.toLocaleString()} of ${total.toLocaleString()}`, sub: 'symbols are receiving live prices.', tone: live === total ? 'good' : 'warn' }
  }

  let history: Card
  if (paused && active > 0) {
    history = { label: 'History', status: 'Paused', sub: `${active.toLocaleString()} downloads are waiting. Press Resume on the download card.`, tone: 'warn' }
  } else if (active > 0) {
    history = { label: 'History', status: 'Downloading', sub: `${active.toLocaleString()} of ${batch.toLocaleString()} symbols left · ${percent}% done. Charts work meanwhile.`, tone: 'warn' }
  } else {
    history = { label: 'History', status: 'Up to date', sub: 'Nothing is waiting to download.', tone: 'good' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
      {[service, brokerCard, prices, history].map(c => <StatusCard key={c.label} card={c} />)}
    </div>
  )
}
