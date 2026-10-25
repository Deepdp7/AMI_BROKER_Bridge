import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Send, Square, Plus, KeyRound, Loader, Activity, TrendingUp, TrendingDown, Search, Stethoscope, BarChart3, Newspaper, Globe } from 'lucide-react'
import { BASE_URL } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import { useEngineRefresh } from '../hooks/useApiSync'
import { MorningBriefPanel } from '../components/assistant/MorningBriefPanel'
import { SuggestionCards, type Suggestion } from '../components/assistant/SuggestionCards'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  steps: string[]
  error?: string
  pending?: boolean
  suggestions?: { brokerId: string; items: Suggestion[] }[]
}

type NewsScope = 'all' | 'fno' | 'intraday'
const SCOPES: { id: NewsScope; label: string; hint: string }[] = [
  { id: 'all', label: 'All stocks', hint: 'News and ideas on any stock' },
  { id: 'fno', label: 'F&O stocks', hint: 'Futures & options stocks: F&O news, futures view, option chain' },
  { id: 'intraday', label: 'Intraday', hint: "Today's intraday picks, movers and short-timeframe setups" },
]
const SCOPE_PREFIX: Record<NewsScope, string> = {
  all: '',
  fno: '[News filter: F&O stocks only] ',
  intraday: '[News filter: Intraday] ',
}
let savedScope: NewsScope = 'all'

const FNO_SUGGESTIONS = [
  { icon: Activity, text: 'Nifty futures and options view for today: OI levels, PCR, expected range' },
  { icon: BarChart3, text: 'Bank Nifty option chain: support, resistance and what the OI is saying' },
  { icon: Newspaper, text: 'Which F&O stocks are in the news today and what is the derivatives angle?' },
  { icon: TrendingUp, text: 'Reliance futures outlook with news, basis and OI' },
  { icon: Search, text: 'Suggest F&O stocks worth adding to my watchlist from today\'s news' },
  { icon: Globe, text: 'Futures long build-up and short build-up stocks today' },
]
const INTRADAY_SUGGESTIONS = [
  { icon: Newspaper, text: 'Intraday stocks to watch today with the news behind each' },
  { icon: TrendingUp, text: 'Top intraday movers in my list and why they are moving' },
  { icon: Search, text: 'Any volume spikes or fresh MACD crossovers on the 15-minute chart?' },
  { icon: BarChart3, text: 'Give me an intraday plan for Reliance with levels' },
  { icon: Globe, text: 'Suggest intraday stocks to add to my watchlist from the news' },
  { icon: TrendingDown, text: 'Which of my stocks look weak intraday?' },
]
const SUGGESTIONS = [
  { icon: Newspaper, text: 'Stocks to watch today — which stocks and why?' },
  { icon: Newspaper, text: "Give me full details of today's news on Nazara Technologies" },
  { icon: Globe, text: 'Why is the stock market moving today? Top news and what Nifty is doing' },
  { icon: Activity, text: 'How is TCS doing today?' },
  { icon: BarChart3, text: 'Give me a 15-minute technical view of RELIANCE with support and resistance' },
  { icon: TrendingUp, text: 'Top 5 gainers and losers in my list today' },
  { icon: TrendingDown, text: 'Which of my stocks are oversold right now?' },
  { icon: Search, text: 'Any stocks with a volume spike or fresh bullish MACD crossover?' },
  { icon: Stethoscope, text: 'Why is AmiBroker not showing data? Check the system for me.' },
]

// Survives page switches within the session
let saved: { messages: ChatMessage[]; conversationId?: string } = { messages: [] }

type View = 'chat' | 'brief'
let savedView: View = 'chat'
/** Open the Assistant page on a given tab (used by the "brief ready" notification). */
export function setAssistantView(v: View) { savedView = v; window.dispatchEvent(new CustomEvent('assistant-view', { detail: v })) }

export function AssistantPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(saved.messages)
  const [scope, setScopeState] = useState<NewsScope>(savedScope)
  const setScope = (v: NewsScope) => { savedScope = v; setScopeState(v) }
  const [view, setViewState] = useState<View>(savedView)
  const setView = (v: View) => { savedView = v; setViewState(v) }
  useEffect(() => {
    const on = (e: Event) => setViewState((e as CustomEvent).detail)
    window.addEventListener('assistant-view', on)
    return () => window.removeEventListener('assistant-view', on)
  }, [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const conversationRef = useRef<string | undefined>(saved.conversationId)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { saved = { messages, conversationId: conversationRef.current } }, [messages])

  const loadStatus = () => fetch(`${BASE_URL}/ai/status`).then(r => r.json()).then(s => {
    setConfigured(!!s.configured)
    setModel(s.model || '')
  }).catch(() => setConfigured(c => c ?? false))
  useEffect(() => { loadStatus() }, [])
  useEngineRefresh(loadStatus)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages(prev => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)))

  const saveKey = async () => {
    const res = await fetch(`${BASE_URL}/ai/key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error('Key not saved', body.error || 'Unknown error'); return }
    setApiKey('')
    setShowKeyForm(false)
    setConfigured(true)
    if (body.model) setModel(body.model)
    toast.success('AI Assistant ready', 'Ask anything about your symbols.')
  }

  const send = useCallback(async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', text: question, steps: [] }, { role: 'assistant', text: '', steps: [], pending: true }])

    const abort = new AbortController()
    abortRef.current = abort
    try {
      const res = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: SCOPE_PREFIX[scope] + question, conversationId: conversationRef.current }),
        signal: abort.signal,
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }

      // Server-Sent Events: "data: {json}\n\n"
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''
        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue
          const ev = JSON.parse(frame.slice(6))
          if (ev.type === 'conversation') conversationRef.current = ev.id
          else if (ev.type === 'text') updateLast(m => ({ ...m, text: m.text + ev.text }))
          else if (ev.type === 'tool') updateLast(m => ({ ...m, steps: [...m.steps, ev.label] }))
          else if (ev.type === 'suggestion') updateLast(m => ({ ...m, suggestions: [...(m.suggestions || []), { brokerId: ev.brokerId, items: ev.items }] }))
          else if (ev.type === 'error') updateLast(m => ({ ...m, error: ev.message }))
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') updateLast(m => ({ ...m, error: err?.message || String(err) }))
    } finally {
      updateLast(m => ({ ...m, pending: false }))
      abortRef.current = null
      setBusy(false)
      inputRef.current?.focus()
    }
  }, [busy])

  const newChat = () => {
    abortRef.current?.abort()
    if (conversationRef.current) fetch(`${BASE_URL}/ai/conversation/${conversationRef.current}`, { method: 'DELETE' }).catch(() => {})
    conversationRef.current = undefined
    setMessages([])
  }

  // ===== Setup screen =====
  if (configured === null) {
    return <div style={{ padding: '2rem', color: '#8b9199' }}><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
  }
  const keyForm = (
    <div className="glass-card" style={{ padding: '1.5rem', maxWidth: 560, margin: '2rem auto', width: 'calc(100% - 3rem)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <KeyRound size={18} style={{ color: '#00d4aa' }} />
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#eceef2' }}>Connect the AI Assistant</h2>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#a1a7b0', lineHeight: 1.6, margin: '0 0 1rem' }}>
        Paste a <b style={{ color: '#eceef2' }}>Groq</b> key (free at <b style={{ color: '#eceef2' }}>console.groq.com</b> → API Keys, starts with gsk_)
        or an <b style={{ color: '#eceef2' }}>Anthropic</b> key (console.anthropic.com, starts with sk-ant-). The key type picks the provider.
        It is stored only on this PC (in %APPDATA%\DataBridgePro\.env).
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="password" className="input-field" placeholder="gsk_...  or  sk-ant-..." value={apiKey}
          onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()}
          style={{ flex: 1, height: 38 }}
        />
        <button className="btn-primary" onClick={saveKey} disabled={!apiKey.trim()}>Save</button>
        {configured && <button className="btn-secondary" onClick={() => setShowKeyForm(false)}>Cancel</button>}
      </div>
    </div>
  )
  if (!configured || showKeyForm) return keyForm

  // ===== Chat =====
  return (
    <div style={{ flex: 1, minHeight: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 1000, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={20} style={{ color: '#00d4aa' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#eceef2' }}>AI Market Assistant</div>
          <div style={{ fontSize: '0.75rem', color: '#8b9199', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '1px 8px', color: '#a1a7b0' }}>{model}</span>
            <span>Uses your live feed and stored history · technical analysis, not investment advice</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(23,23,23,0.6)', padding: 3, borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)' }}>
          {([['chat', 'Chat'], ['brief', 'Pre-market brief']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                background: view === v ? 'rgba(0,212,170,0.15)' : 'transparent', color: view === v ? '#00d4aa' : '#a1a7b0',
                border: 'none', borderRadius: 7, padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: view === v ? 700 : 500, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => setShowKeyForm(true)} title="Change API key" style={{ padding: '0.4rem 0.6rem' }}><KeyRound size={14} /></button>
        {view === 'chat' && <button className="btn-secondary" onClick={newChat} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
          <Plus size={14} /> New chat
        </button>}
      </div>

      {view === 'brief' ? <MorningBriefPanel /> : (<>
      <div ref={scrollRef} className="ai-chat selectable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', width: '100%', maxWidth: 760 }}>
            <div style={{ textAlign: 'center', color: '#a1a7b0', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Ask anything about your symbols — trend, levels, signals, scans — or about DataBridge itself.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.625rem' }}>
              {(scope === 'fno' ? FNO_SUGGESTIONS : scope === 'intraday' ? INTRADAY_SUGGESTIONS : SUGGESTIONS).map(({ icon: Icon, text }) => (
                <button key={text} onClick={() => send(text)} className="glass-card ai-suggestion"
                  style={{ textAlign: 'left', padding: '0.875rem', display: 'flex', gap: '0.625rem', alignItems: 'flex-start', cursor: 'pointer', color: '#d1d5db', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Icon size={16} style={{ color: '#00d4aa', flexShrink: 0, marginTop: 1 }} />
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((m, i) => m.role === 'user' ? (
          <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '75%', background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)', color: '#eceef2', padding: '0.625rem 0.875rem', borderRadius: '12px 12px 2px 12px', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
            {m.text}
          </div>
        ) : (
          <div key={i} className="glass-card" style={{ alignSelf: 'flex-start', maxWidth: '92%', padding: '0.875rem 1rem', borderRadius: '2px 12px 12px 12px' }}>
            {m.steps.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: m.text ? '0.625rem' : 0 }}>
                {m.steps.map((s, j) => (
                  <span key={j} style={{ fontSize: '0.7rem', color: '#7dd3fc', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '2px 8px' }}>{s}</span>
                ))}
              </div>
            )}
            {m.text && <div className="ai-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown></div>}
            {m.pending && !m.text && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b9199', fontSize: '0.8rem' }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
              </div>
            )}
            {m.suggestions?.map((g, k) => <SuggestionCards key={k} brokerId={g.brokerId} items={g.items} />)}
            {m.error && <div style={{ color: '#fb7185', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠ {m.error}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#8b9199' }}>News filter</span>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(10,22,40,0.6)', padding: 3, borderRadius: 9, border: '1px solid rgba(255,255,255,0.06)' }}>
          {SCOPES.map(sc => (
            <button key={sc.id} onClick={() => setScope(sc.id)} title={sc.hint}
              style={{
                background: scope === sc.id ? 'rgba(0,212,170,0.15)' : 'transparent', color: scope === sc.id ? '#00d4aa' : '#a1a7b0',
                border: 'none', borderRadius: 7, padding: '0.28rem 0.7rem', fontSize: '0.74rem', fontWeight: scope === sc.id ? 700 : 500, cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}>
              {sc.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.7rem', color: '#6b7078' }}>{SCOPES.find(x => x.id === scope)?.hint}</span>
      </div>

      <div className="glass-card ai-composer" style={{ padding: '0.5rem 0.5rem 0.5rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, borderRadius: 14 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask about any symbol… e.g. “Is INFY bullish on the 1-hour chart?”"
          rows={1}
          style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: '#eceef2', fontSize: '0.9rem', padding: '0.5rem', fontFamily: 'inherit', maxHeight: 140 }}
        />
        {busy ? (
          <button className="btn-secondary" onClick={() => abortRef.current?.abort()} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Square size={13} /> Stop
          </button>
        ) : (
          <button className="btn-primary" onClick={() => send(input)} disabled={!input.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Send size={14} /> Ask
          </button>
        )}
      </div>

      </>)}

      <style>{`
        .ai-composer:focus-within { border-color: rgba(0,212,170,0.4) !important; }
        .ai-suggestion:hover { border-color: rgba(0,212,170,0.35) !important; color: #eceef2 !important; }
        .ai-md { color: #e1e4e9; font-size: 0.875rem; line-height: 1.65; }
        .ai-md p { margin: 0 0 0.6rem; }
        .ai-md p:last-child { margin-bottom: 0; }
        .ai-md h1, .ai-md h2, .ai-md h3 { font-size: 0.95rem; color: #eceef2; margin: 0.75rem 0 0.4rem; }
        .ai-md ul, .ai-md ol { margin: 0 0 0.6rem; padding-left: 1.25rem; }
        .ai-md li { margin: 0.15rem 0; }
        .ai-md strong { color: #ffffff; }
        .ai-md code { background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; font-size: 0.8rem; }
        .ai-md table { border-collapse: collapse; margin: 0.5rem 0 0.75rem; font-size: 0.8rem; }
        .ai-md th, .ai-md td { border: 1px solid rgba(255,255,255,0.08); padding: 4px 10px; text-align: left; }
        .ai-md th { background: rgba(255,255,255,0.04); color: #a1a7b0; font-weight: 600; }
      `}</style>
    </div>
  )
}
