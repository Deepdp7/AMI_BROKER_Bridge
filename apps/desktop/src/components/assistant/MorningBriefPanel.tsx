/**
 * Pre-market brief: written automatically by the AI before the open each trading day
 * (market mood, today's events, stocks in the news and why, the watchlist's news + stance).
 */
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sunrise, RefreshCw, Loader, Clock } from 'lucide-react'
import { BASE_URL, wsManager } from '../../api/apiClient'
import { toast } from '../ui/Toast'
import { useEngineRefresh } from '../../hooks/useApiSync'
import { SuggestionCards, type Suggestion } from './SuggestionCards'

interface Brief { date: string; generatedAt: number; provider: string; scope?: 'all' | 'fno'; text: string; suggestions?: Suggestion[]; brokerId?: string }
export interface BriefStatus { enabled: boolean; time: string; scope: 'all' | 'fno'; generating: boolean; latest: Brief | null; lastError: string | null }

const TIMES = ['08:00', '08:15', '08:30', '08:45', '09:00']
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
const fmt = (ms: number) => new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export function MorningBriefPanel() {
  const [st, setSt] = useState<BriefStatus | null>(null)

  const load = () => fetch(`${BASE_URL}/ai/brief`).then(r => r.json()).then(setSt).catch(() => {})
  useEffect(() => {
    load()
    const off = wsManager.on('morning_brief', (p: any) => setSt(p))
    return () => { off() }
  }, [])
  useEngineRefresh(load)

  const generate = async () => {
    const res = await fetch(`${BASE_URL}/ai/brief`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error('Could not start the brief', body.error || `HTTP ${res.status}`)
      return
    }
    setSt(s => (s ? { ...s, generating: true, lastError: null } : s))
  }

  const configure = (body: { enabled?: boolean; time?: string; scope?: 'all' | 'fno' }) =>
    fetch(`${BASE_URL}/ai/brief/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json()).then(setSt).catch(() => {})

  if (!st) return <div style={{ padding: '2rem', color: '#8b9199' }}><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>

  const latest = st.latest
  const isToday = latest?.date === todayIST()

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Controls */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Sunrise size={18} style={{ color: '#f59e0b' }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 650, color: '#eceef2' }}>Pre-market brief</div>
          <div style={{ fontSize: '0.72rem', color: '#8b9199' }}>
            {st.generating ? 'Reading the morning news and your watchlist… (about 1–2 minutes)'
              : latest ? `${isToday ? "Today's" : 'Last'} brief · ${fmt(latest.generatedAt)} · ${latest.provider}`
              : 'No brief yet'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(10,22,40,0.6)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }} title="Which stocks the news focuses on">
          {([['all', 'All stocks'], ['fno', 'F&O stocks']] as const).map(([v, label]) => (
            <button key={v} onClick={() => configure({ scope: v })}
              style={{
                background: st.scope === v ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent', color: st.scope === v ? 'var(--accent)' : '#8b9199',
                border: 'none', borderRadius: 6, padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: st.scope === v ? 700 : 500, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#a1a7b0', cursor: 'pointer' }}>
          <input type="checkbox" checked={st.enabled} onChange={e => configure({ enabled: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
          Auto every trading day at
        </label>
        <div style={{ display: 'flex', gap: 2, background: 'rgb(var(--s1-rgb) / 0.6)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          {TIMES.map(t => (
            <button key={t} onClick={() => configure({ time: t })} disabled={!st.enabled}
              style={{
                background: st.time === t ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent', color: st.time === t ? 'var(--accent)' : '#8b9199',
                border: 'none', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: st.time === t ? 700 : 500,
                cursor: st.enabled ? 'pointer' : 'default', opacity: st.enabled ? 1 : 0.5,
              }}>
              {t}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={generate} disabled={st.generating}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}>
          {st.generating ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {st.generating ? 'Generating…' : latest && isToday ? 'Refresh brief' : 'Generate now'}
        </button>
      </div>

      {st.lastError && !st.generating && (
        <div style={{ fontSize: '0.78rem', color: '#fb7185', padding: '0 0.25rem' }}>⚠ Last attempt failed: {st.lastError}</div>
      )}

      {/* Brief */}
      <div className="glass-card" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.1rem 1.25rem' }}>
        {latest ? (
          <>
            {!isToday && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.75rem' }}>
                <Clock size={13} /> This brief is from {latest.date}. Today's will be written at {st.time} IST on a trading day, or press Generate now.
              </div>
            )}
            <div className="ai-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{latest.text}</ReactMarkdown></div>
            {latest.brokerId && latest.suggestions && latest.suggestions.length > 0 && (
              <SuggestionCards brokerId={latest.brokerId} items={latest.suggestions} title="In today's news but not in your list: add to AmiBroker?" />
            )}
          </>
        ) : (
          <div style={{ color: '#8b9199', fontSize: '0.85rem', lineHeight: 1.7, maxWidth: 620 }}>
            Every trading day at <b style={{ color: '#eceef2' }}>{st.time} IST</b> the assistant reads the morning's market news
            (Economic Times, Mint, Business Standard, CNBC-TV18 and more) and your watchlist, and writes:
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>market mood and global cues for the open</li>
              <li>today's events — results, policy, IPOs</li>
              <li>stocks in the news, what exactly happened, and the likely impact</li>
              <li>your watchlist stocks with news, plus their technical stance</li>
            </ul>
            <div style={{ marginTop: '0.75rem' }}>Press <b style={{ color: '#eceef2' }}>Generate now</b> to make one immediately.</div>
          </div>
        )}
      </div>
    </div>
  )
}
