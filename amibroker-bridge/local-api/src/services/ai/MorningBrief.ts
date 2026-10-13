/**
 * MorningBrief.ts — automatic pre-market news brief.
 *
 * Every trading day at the configured time (default 08:45 IST, before NSE pre-open at
 * 09:00) the assistant reads the morning's market news and the user's watchlist and writes
 * a brief: market mood and global cues, today's events, stocks in the news and why, and the
 * watchlist stocks with news plus their technical stance. Saved per day in
 * %APPDATA%\DataBridgePro\briefs and pushed to the app. Can also be generated on demand.
 */
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { DATA_DIR, getAllSettings, upsertSettings } from '../../db'
import { isWeekend, isNSEHoliday } from '../MarketCalendar'
import { getAiProvider, runTool, writeTextClaude, type SuggestionItem } from './AiAssistant'
import { allEquities, isTracked, futuresOf, isFnoStock } from './fno'
import { stmts } from '../../db'
import { brokerManager } from '../BrokerManager'
import { writeTextGroq } from './GroqAssistant'

export interface Brief {
  date: string          // IST trading date, YYYY-MM-DD
  generatedAt: number   // UTC ms
  provider: string
  scope: 'all' | 'fno'
  text: string          // markdown
  /** Untracked stocks the news mentions, offered with Add / No buttons */
  suggestions: SuggestionItem[]
  brokerId?: string
}

export interface BriefStatus {
  enabled: boolean
  time: string          // HH:MM IST
  scope: 'all' | 'fno'  // news filter: all stocks, or F&O stocks only
  generating: boolean
  latest: Brief | null
  lastError: string | null
}

const BRIEF_DIR = path.join(DATA_DIR, 'briefs')
const IST_OFFSET_MS = 5.5 * 3600 * 1000

const istDate = (ms = Date.now()) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
const istMinutes = (ms = Date.now()) => { const d = new Date(ms + IST_OFFSET_MS); return d.getUTCHours() * 60 + d.getUTCMinutes() }

const SYSTEM = `You write the pre-market brief for an Indian stock trader (NSE/BSE) who uses DataBridge Pro with AmiBroker. You are given today's gathered news headlines (with source and hours ago), one full "stocks to watch" article and technical readings for the trader's watchlist.

Accuracy rules — the trader acts on this, so they are strict:
- Use only facts present in the data. Every number (prices, targets, profits, order values, percentages) must appear in the data exactly; if a headline gives no number, don't add one.
- Never add clock times or dates that the data doesn't state. Give news age as "N h ago" from the data, not as a time of day.
- Use the exact date given in the data for the title.
- Name the source for each news claim. If something is unclear or only implied by a headline, say "headline only".
- Don't contradict yourself: a stock listed as having news must not be described as "without news".`


const BRIEF_FORMAT = `Write the brief in markdown with exactly these sections:
## Market mood
2–3 lines: overall tone for today's open, global cues (US/Asia, GIFT Nifty, crude, rupee) and any big macro/policy item.
## Key events today
Bullets: results, board meetings, policy/data releases, IPOs, F&O expiry — with dates/times when given.
## Stocks in the news
Table: Stock | What happened (specific: order size, result numbers, management change, brokerage call + target…) | Likely impact (Positive / Negative / Watch) | Source, time. 8–15 rows, most important first; include stocks outside the watchlist.
## My watchlist
Table of watchlist stocks that have news: Stock | News in one line | Technical stance (bias, RSI, support/resistance). Then one line naming the strongest bullish and bearish technical setups without news.
## F&O view
Only when the data has an "F&O" block: Nifty and Bank Nifty from the option data (PCR, the strikes with the most call OI = resistance and put OI = support, India VIX, ATM straddle as the expected range, futures basis) and the F&O stocks in the news with the likely derivatives angle. Skip this section when there is no F&O block.
## What to watch at the open
3–5 bullets.
End with one line: "News summary and technical analysis — not investment advice."`

type Json = Record<string, any>
const parse = (r: { content: string; isError?: boolean }): Json | null => {
  if (r.isError) return null
  try { return JSON.parse(r.content) } catch { return null }
}
const headlineLines = (res: Json | null) => (res?.headlines || []).map((h: Json) =>
  `- [${h.hoursAgo}h ago, ${h.source}] ${h.title}${h.summary && !h.title.includes(h.summary.slice(0, 30)) ? ` — ${String(h.summary).slice(0, 120)}` : ''}`).join('\n') || '(none found)'

/** Gather everything the brief needs in code (a few small requests) and compact it to ~3–4k tokens. */
async function gatherBriefData(date: string, scope: 'all' | 'fno'): Promise<{ data: string; newsTitles: string[] }> {
  const [market, watch, global, signals] = await Promise.all([
    runTool('get_news', { hours: 18, limit: 15, scope }).then(parse),
    runTool('get_news', { query: 'stocks to watch today', hours: 18, limit: 8, scope }).then(parse),
    runTool('get_news', { query: 'GIFT Nifty global markets', hours: 14, limit: 8 }).then(parse),
    runTool('get_watchlist_signals', { timeframe: '1d', hours: 18, limit: 15 }).then(parse),
  ])
  if (!market && !watch && !global) throw new Error('News could not be fetched — check the internet connection')

  let article = ''
  const readable = (watch?.headlines || []).find((h: Json) => h.canRead)
  if (readable) {
    const a = parse(await runTool('read_article', { id: readable.id }))
    if (a?.text) article = `"${a.title}" (${a.source}, ${a.publishedIST} IST):
${String(a.text).slice(0, 2500)}`
  }

  const watchlist = (signals?.results || []).map((r: Json) => {
    const news = (r.news || []).map((n: Json) => `${n.title} (${n.source}, ${n.hoursAgo}h ago)`).join(' | ')
    return `- ${r.ticker} ₹${r.price} day ${r.dayChangePct ?? '—'}% | ${r.bias} (score ${r.score}), RSI ${r.rsi ?? '—'} | S ${r.support ?? '—'} / R ${r.resistance ?? '—'}${news ? ` | news: ${news}` : ''}`
  }).join('\n')

  // F&O scope: Nifty / Bank Nifty option-chain levels for the opening view
  let fnoBlock = ''
  if (scope === 'fno') {
    const chains = await Promise.all(['NIFTY', 'BANKNIFTY'].map(u => runTool('get_option_chain', { underlying: u }).then(parse)))
    fnoBlock = chains.filter(Boolean).map((c: any) =>
      `- ${c.underlying} (expiry ${c.expiry}): spot ${c.spot} (${c.spotChangePct}%), futures ${c.futuresPrice} basis ${c.basis}, India VIX ${c.indiaVix}, PCR ${c.pcr}, `
      + `resistance from call OI ${c.resistanceFromCallOi?.strike} (OI ${c.resistanceFromCallOi?.oi}), support from put OI ${c.supportFromPutOi?.strike} (OI ${c.supportFromPutOi?.oi}), `
      + `ATM ${c.atmStrike} straddle ${c.atmStraddle}`).join('\n')
  }

  const newsTitles = [market, watch, global].flatMap(r => (r?.headlines || []).map((h: Json) => `${h.title}`))
  const data = [
    `Date: ${date} (IST). Now: ${signals?.asOfIST || ''} IST. News filter: ${scope === 'fno' ? 'F&O stocks only' : 'all stocks'}.`,
    `### Latest market news (business portals)
${headlineLines(market)}`,
    `### "Stocks to watch" headlines
${headlineLines(watch)}`,
    article ? `### Full "stocks to watch" article
${article}` : '',
    `### Global cues / GIFT Nifty
${headlineLines(global)}`,
    `### Watchlist (technicals on daily candles + matching news)
${watchlist || '(no data)'}`,
    signals?.others?.length ? `Other watchlist symbols: ${signals.others.join('; ')}` : '',
    fnoBlock ? `### F&O (option-chain data, live)\n${fnoBlock}` : '',
  ].filter(Boolean).join('\n\n')
  return { data, newsTitles }
}

// Equity name phrases (first two words of the company name), built once
let namePatterns: { ticker: string; name: string; re: RegExp }[] | null = null
const GENERIC_FIRST = new Set(['tata', 'hdfc', 'icici', 'bajaj', 'adani', 'state', 'bharat', 'hindustan', 'indian', 'india', 'jsw', 'larsen', 'national', 'oil', 'axis', 'kotak', 'mahindra', 'apollo', 'sun', 'life', 'power', 'bank'])

/**
 * Untracked stocks the morning news talks about, most-mentioned first. In F&O scope an F&O stock
 * is offered as its near-month futures contract. Each comes with the headline as the reason.
 */
function suggestFromNews(titles: string[], scope: 'all' | 'fno', max = 5): SuggestionItem[] {
  namePatterns ||= allEquities().flatMap(e => {
    const words = e.name.split(' ').filter(Boolean)
    if (words.length < 2 || e.name.length < 8) return []
    const phrase = words.slice(0, 2).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (GENERIC_FIRST.has(words[0].toLowerCase()) && words[1].length < 5) return []
    return [{ ticker: e.ticker, name: e.name, re: new RegExp('\\b' + phrase + '\\b', 'i') }]
  })
  const hits = new Map<string, { name: string; n: number; title: string }>()
  for (const title of titles) {
    for (const p of namePatterns) {
      if (!p.re.test(title)) continue
      const h = hits.get(p.ticker) || { name: p.name, n: 0, title }
      h.n++
      hits.set(p.ticker, h)
    }
  }
  const out: SuggestionItem[] = []
  for (const [ticker, h] of [...hits.entries()].sort((a, b) => b[1].n - a[1].n)) {
    if (out.length >= max) break
    if (scope === 'fno' && !isFnoStock(ticker)) continue
    const fut = scope === 'fno' ? futuresOf(ticker, 1)[0] : undefined
    const target = fut ?? allEquities().find(e => e.ticker === ticker)!
    if (isTracked(target.ticker)) continue
    out.push({
      ticker: target.ticker, name: target.name, exchange: target.exchange, instrumentType: target.instrumentType,
      instrumentId: target.instrumentId, reason: h.title.slice(0, 200), expiry: target.expiry, lotSize: target.lotSize,
    })
  }
  return out
}

class MorningBriefService extends EventEmitter {
  private status: BriefStatus = { enabled: true, time: '08:45', scope: 'all', generating: false, latest: null, lastError: null }
  private timer: NodeJS.Timeout | null = null
  private abort: AbortController | null = null
  private retryAfter = 0

  start() {
    const s = getAllSettings() as any
    if (s.morningBriefEnabled !== undefined) this.status.enabled = String(s.morningBriefEnabled) !== 'false'
    if (/^\d{2}:\d{2}$/.test(String(s.morningBriefTime || ''))) this.status.time = String(s.morningBriefTime)
    if (s.morningBriefScope === 'fno' || s.morningBriefScope === 'all') this.status.scope = s.morningBriefScope
    this.status.latest = this.loadLatest()
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30_000)
    // Started after the brief time (PC was off at 08:45): catch up shortly after startup
    setTimeout(() => this.tick(), 20_000)
  }

  getStatus(): BriefStatus { return { ...this.status } }

  configure(opts: { enabled?: boolean; time?: string; scope?: string }) {
    if (opts.scope !== undefined) {
      if (opts.scope !== 'all' && opts.scope !== 'fno') throw new Error("scope must be 'all' or 'fno'")
      this.status.scope = opts.scope
      upsertSettings('morningBriefScope', opts.scope)
    }
    if (typeof opts.enabled === 'boolean') {
      this.status.enabled = opts.enabled
      upsertSettings('morningBriefEnabled', String(opts.enabled))
    }
    if (opts.time !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(opts.time)) throw new Error('time must be HH:MM (24h, IST)')
      this.status.time = opts.time
      upsertSettings('morningBriefTime', opts.time)
    }
    this.publish()
  }

  /** Generate now (manual "Generate brief" button or the schedule). */
  async generate(reason: 'scheduled' | 'manual' | 'catch-up'): Promise<Brief> {
    if (this.status.generating) throw new Error('A brief is already being generated')
    const provider = getAiProvider()
    if (!provider) throw new Error('AI assistant is not set up — add a Groq or Anthropic API key first.')

    this.status.generating = true
    this.status.lastError = null
    this.publish()
    console.log(`[MorningBrief] Generating ${reason} brief with ${provider}...`)
    const started = Date.now()
    const date = istDate()
    this.abort = new AbortController()
    try {
      const scope = this.status.scope
      const { data, newsTitles } = await gatherBriefData(date, scope)
      const user = `${data}

${BRIEF_FORMAT}`
      const write = provider === 'groq' ? writeTextGroq : writeTextClaude
      const text = await write(SYSTEM, user, this.abort.signal)
      if (text.trim().length < 50) throw new Error('The assistant returned an empty brief')
      const brokerId = (stmts.getBrokers.all() as any[]).map(b => b.id).find(id => brokerManager.getAdapter(id))
      const suggestions = brokerId ? suggestFromNews(newsTitles, scope) : []
      const brief: Brief = { date, generatedAt: Date.now(), provider, scope, text: text.trim(), suggestions, brokerId }
      this.save(brief)
      this.status.latest = brief
      console.log(`[MorningBrief] Brief for ${date} ready in ${Math.round((Date.now() - started) / 1000)}s`)
      this.emit('ready', brief)
      return brief
    } catch (err: any) {
      this.status.lastError = err?.message || String(err)
      console.error('[MorningBrief] Failed:', this.status.lastError)
      throw err
    } finally {
      this.status.generating = false
      this.abort = null
      this.publish()
    }
  }

  private tick() {
    if (!this.status.enabled || this.status.generating || !getAiProvider()) return
    const now = Date.now()
    if (now < this.retryAfter) return
    if (isWeekend(now) || isNSEHoliday(now)) return
    const today = istDate(now)
    if (this.status.latest?.date === today) return
    const [h, m] = this.status.time.split(':').map(Number)
    const mins = istMinutes(now)
    // From the brief time until the close; after that a "pre-market" brief is pointless
    if (mins < h * 60 + m || mins >= 15 * 60 + 30) return
    const reason = mins > h * 60 + m + 5 ? 'catch-up' : 'scheduled'
    // After a failure (logged), wait 10 minutes before trying again instead of every 30 s
    this.generate(reason).catch(() => { this.retryAfter = Date.now() + 10 * 60_000 })
  }

  private publish() { this.emit('status', this.getStatus()) }

  private save(brief: Brief) {
    try {
      fs.mkdirSync(BRIEF_DIR, { recursive: true })
      fs.writeFileSync(path.join(BRIEF_DIR, `${brief.date}.json`), JSON.stringify(brief, null, 2), 'utf8')
    } catch (err) {
      console.error('[MorningBrief] Could not save brief:', err)
    }
  }

  private loadLatest(): Brief | null {
    try {
      if (!fs.existsSync(BRIEF_DIR)) return null
      const files = fs.readdirSync(BRIEF_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
      if (!files.length) return null
      return JSON.parse(fs.readFileSync(path.join(BRIEF_DIR, files[files.length - 1]), 'utf8'))
    } catch {
      return null
    }
  }
}

export const morningBrief = new MorningBriefService()
