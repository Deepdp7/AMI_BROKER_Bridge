/**
 * Symbols the AI suggests adding, with Yes / No buttons. "Add" streams the symbol live into
 * AmiBroker through DataBridge and downloads its history (futures: the last 2 months).
 */
import { useState } from 'react'
import { Plus, X, Check, Loader, PlusCircle } from 'lucide-react'
import { api } from '../../api/apiClient'
import { useAppStore } from '../../store/appStore'
import { toast } from '../ui/Toast'

export interface Suggestion {
  ticker: string
  name: string
  exchange: string
  instrumentType: string
  instrumentId: string
  reason: string
  expiry?: string
  lotSize?: number
}

// Decisions survive page switches within the session
const dismissed = new Set<string>()

export function SuggestionCards({ brokerId, items, title = 'Add to AmiBroker?' }: { brokerId: string; items: Suggestion[]; title?: string }) {
  const tracked = useAppStore(s => s.symbols)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [, force] = useState(0)

  const isAdded = (t: string) => tracked.some(s => s.ticker === t)
  const visible = items.filter(i => !dismissed.has(i.ticker))
  if (visible.length === 0) return null

  const add = async (it: Suggestion) => {
    setBusy(b => ({ ...b, [it.ticker]: true }))
    try {
      await api.addSymbolsToBroker(brokerId, [{ ticker: it.ticker, instrumentId: it.instrumentId, exchange: it.exchange, instrumentType: it.instrumentType }])
      toast.success(`${it.ticker} added`, it.instrumentType === 'FUT'
        ? 'Streaming live into AmiBroker; the last 2 months of history are downloading.'
        : 'Streaming live into AmiBroker; its history is downloading.')
    } catch (e: any) {
      toast.error(`Could not add ${it.ticker}`, String(e?.message || e))
    } finally {
      setBusy(b => ({ ...b, [it.ticker]: false }))
    }
  }

  return (
    <div style={{ marginTop: '0.75rem', border: '1px solid rgba(0,212,170,0.22)', background: 'rgba(0,212,170,0.04)', borderRadius: 12, padding: '0.7rem 0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: 650, color: '#00d4aa', marginBottom: '0.5rem' }}>
        <PlusCircle size={14} /> {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {visible.map(it => {
          const done = isAdded(it.ticker)
          return (
            <div key={it.ticker} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.5rem 0.65rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <b style={{ color: '#eceef2', fontSize: '0.84rem' }}>{it.ticker}</b>
                  <span style={{ fontSize: '0.66rem', color: '#a1a7b0', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '1px 7px' }}>
                    {it.instrumentType === 'FUT' ? `Future · exp ${it.expiry}${it.lotSize ? ` · lot ${it.lotSize}` : ''}` : 'Stock'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#8b9199' }}>{it.name}</span>
                </div>
                <div style={{ fontSize: '0.73rem', color: '#a1a7b0', marginTop: 2, lineHeight: 1.45 }}>{it.reason}</div>
              </div>
              {done ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#22c55e', fontWeight: 600, flexShrink: 0 }}><Check size={14} /> Added</span>
              ) : (
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button className="btn-primary" disabled={busy[it.ticker]} onClick={() => add(it)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}>
                    {busy[it.ticker] ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Yes, add
                  </button>
                  <button className="btn-secondary" disabled={busy[it.ticker]} onClick={() => { dismissed.add(it.ticker); force(n => n + 1) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                    <X size={13} /> No
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
