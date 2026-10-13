/**
 * AiAssistant.ts
 *
 * Built-in market assistant: answers plain-English questions ("How is TCS doing
 * today?", "Which of my stocks are oversold?", "Why is AmiBroker empty?") by
 * calling read-only tools over the bridge's own live feed and stored history.
 *
 * Two providers share the prompt and tools below: Claude (this file's streaming tool
 * loop) and Groq (GroqAssistant.ts). Numbers come from tools only.
 */
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import {
  TIMEFRAMES, SCAN_CRITERIA, type Timeframe, type ScanCriterion,
  listSymbols, resolveSymbol, analyze, getQuote, scan, isMarketOpenNow, istString,
} from './marketData'
import { feedSimulator } from '../feedSimulator'
import { backfillQueue } from '../BackfillQueue'
import { stmts } from '../../db'
import { getConsoleLines } from '../ConsoleCapture'
import { fetchNews, readArticle, fetchWatchlistNews } from './news'
import { newsTerms, companyName } from './companyNames'
import { findInstruments, instrumentByTicker, isTracked, futuresOf, optionChainSummary, type Instrument } from './fno'
import { brokerManager } from '../BrokerManager'

const MODEL = process.env.DATABRIDGE_AI_MODEL || 'claude-opus-5-5'
const MAX_CONVERSATIONS = 50
const MAX_TOOL_ROUNDS = 8

type Msg = Anthropic.Beta.BetaMessageParam

export type AssistantEvent =
  | { type: 'conversation'; id: string }
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; label: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'suggestion'; brokerId: string; items: SuggestionItem[] }

/** A symbol the assistant proposes to add (the user confirms with Add / No in the chat). */
export interface SuggestionItem {
  ticker: string
  name: string
  exchange: string
  instrumentType: string
  instrumentId: string
  reason: string
  expiry?: string
  lotSize?: number
}

/** Passed to tools that talk to the user's screen (suggestion cards). */
export interface ToolContext { emit?: (e: AssistantEvent) => void }

// ===== Runtime probe (set by server.ts: things only the server knows) =====
let runtimeProbe: () => { amibrokerConnections: number } = () => ({ amibrokerConnections: 0 })
export function setRuntimeProbe(fn: typeof runtimeProbe) { runtimeProbe = fn }

export type AiProvider = 'anthropic' | 'groq'

/** Provider whose key is set; DATABRIDGE_AI_PROVIDER (written when a key is saved) wins if both are. */
export function getAiProvider(): AiProvider | null {
  const hasClaude = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  const hasGroq = !!process.env.GROQ_API_KEY
  const preferred = process.env.DATABRIDGE_AI_PROVIDER
  if (preferred === 'groq' && hasGroq) return 'groq'
  if (preferred === 'anthropic' && hasClaude) return 'anthropic'
  return hasClaude ? 'anthropic' : hasGroq ? 'groq' : null
}

export function isAiConfigured(): boolean {
  return getAiProvider() !== null
}

export const CLAUDE_MODEL = MODEL

// ===== System prompt (frozen: no timestamps, so the tools+system prefix caches) =====
export const SYSTEM_PROMPT = `You are the market assistant built into DataBridge Pro, a desktop app that streams live data from the user's broker (e.g. Fyers) into AmiBroker for Indian markets (NSE/BSE equities, indices, F&O).

You have tools over the user's own live feed and stored 1-minute history. Use them for every price, level or indicator you mention — never quote a number from memory, and say "as of <time> IST" using the asOfIST the tools return. If a tool reports missing data, say so plainly instead of guessing.

How to answer:
- Reply in the same language and tone the user writes in (simple English, Hinglish, etc.). Keep it short and scannable: a one-line verdict first, then key numbers (price, change, support/resistance, RSI/MACD/trend), then what to watch. Use ₹ for prices. Small markdown tables are fine for comparisons.
- Map casual timeframes: "today/intraday" → 5m or 15m plus the quote, "swing/this week" → 1h or 1d, "long term/positional" → 1d.
- For "signals", give the technical bias the tools compute (bullish/bearish/neutral), the reasons, the nearest support and resistance, and an ATR-based reference for a stop distance. Present this as technical analysis, never as a certainty or a promise of profit; end such answers with one short line noting it is not investment advice. Don't repeat that disclaimer anywhere else.
- If a symbol isn't tracked, say so and tell the user to add it in Symbol Setup (list_symbols shows what is tracked; suggest close matches).
- You can't see the user's AmiBroker screen or drawings — your analysis uses the same data feed AmiBroker receives.
- For news ("any news on X?", "why is X up/down today?", "stocks to watch today", "what's happening in the market?"), call get_news — by company name for a stock; with no query (and/or 'stocks to watch today') for market-wide news. When the user wants details or the full story, or asks which stocks are in a "stocks to watch" list, call read_article on the 2–3 most relevant readable stories and give the specifics they contain (what happened, numbers, dates, who, and what it means for the stock). Lead with the most recent and important items, say how long ago each was published (IST) and its source, and group duplicates of the same story. Report only what the news says — never invent details, numbers or causes; if nothing came up in the window, say so and offer a longer lookback. Combine with get_quote when price reaction matters.
- For "which stocks to buy/sell", "trade ideas", "position on my stocks": call get_watchlist_signals, then read_article for the 1–2 news items that matter most. Give a stance per stock in three groups — Bullish / buy-on-dips candidates, Bearish / avoid or sell candidates, Neutral / wait — each with the reason (the news and the technical bias together), a reference entry zone near support or a breakout level, and an ATR-based stop distance. Strong news overrides weak technicals only when the story is material (results, orders, management change, regulatory action). Be explicit when news and technicals disagree. These are ideas, not certainties; keep the single not-investment-advice line at the end.
- News filters: the user may start a message with "[News filter: ...]". "All stocks" = normal news. "F&O stocks only" = use get_news with scope "fno", and talk about F&O stocks, futures and options (use get_futures_view and get_option_chain). "Intraday" = use get_news with scope "intraday" and give intraday ideas (15m/1h technicals, today's movers).
- Futures and options: for "futures outlook/prediction" on an underlying, combine get_futures_view (price, basis, tracked technicals), get_option_chain (PCR, max call/put OI strikes as resistance/support, OI additions, VIX, ATM straddle as the expected move) and get_news with scope "fno". Give a clear stance — bullish / bearish / range-bound — with the levels that would change it, and say which pieces of evidence agree or disagree. It is a reasoned view from today's data, never a forecast or a guarantee. Note option data are live Fyers data only when the market is open.
- Adding symbols: the user decides. When news or analysis points to a stock/future they don't track, or they ask to add one, call search_instruments to get the exact ticker, then you MUST call propose_add_symbols with a one-line reason each — the Yes/No cards appear ONLY if you call that tool, so never tell the user cards are waiting unless you called it (suggest at most the stock plus the near-month future, not every contract). Never claim a symbol was added. Futures history is limited to the last 2 months (a contract lists about 3 months before expiry); cash stocks follow the user's History Depth setting.
- For app problems ("chart empty", "no data", "broker disconnected"), call get_system_status and give concrete steps inside DataBridge Pro or AmiBroker (Broker Connection → Re-Login; Symbol Setup; AmiBroker File → Database Settings → Data source "DataBridge Pro API Plugin", base interval 1 Minute; right-click chart → Refresh).`

// ===== Tools =====
export const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'list_symbols',
    description: 'List every symbol the user tracks in DataBridge, with live price, change % and feed status. Use it to discover tickers, resolve names ("Tata Consultancy" → TCS) or answer portfolio-wide questions.',
    input_schema: { type: 'object', properties: {} },
    eager_input_streaming: true,
  },
  {
    name: 'get_quote',
    description: "Live quote for one tracked symbol: last price, change vs previous close, today's open/high/low/volume, 52-week high/low, feed status and market open/closed.",
    input_schema: {
      type: 'object',
      properties: { ticker: { type: 'string', description: 'Tracked ticker exactly as in DataBridge, e.g. TCS, RELIANCE, NIFTY26OCTFUT' } },
      required: ['ticker'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_technical_analysis',
    description: 'Technical analysis for one symbol on a timeframe, computed from stored candles: EMA9/21, SMA20/50/200, RSI14, MACD (with recent crossover), Bollinger Bands, ATR14, session VWAP (intraday), volume vs average, swing support/resistance, a rule-based bias, plain-language signals and the last 8 candles.',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Tracked ticker, e.g. TCS' },
        timeframe: { type: 'string', enum: [...TIMEFRAMES], description: 'Candle size. 5m/15m for intraday, 1h for swing, 1d for positional.' },
      },
      required: ['ticker', 'timeframe'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'scan_symbols',
    description: 'Scan ALL tracked symbols and return those matching a condition, best matches first. Use for questions like "which stocks are oversold", "top gainers", "volume spikes", "bullish crossovers".',
    input_schema: {
      type: 'object',
      properties: {
        criterion: { type: 'string', enum: [...SCAN_CRITERIA] },
        timeframe: { type: 'string', enum: [...TIMEFRAMES], description: 'Timeframe for the indicators (default 1d).' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max results (default 10).' },
      },
      required: ['criterion'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_news',
    description: "Latest business/market news: headlines with source, IST time and hours ago, an optional summary, and an id. Searches Google News, Bing News and the market feeds of Economic Times, Livemint, Business Standard and CNBC-TV18. With a query: news about a company, sector, the market or any topic (search by company NAME, e.g. 'Nazara Technologies', not 'NAZARA'). With no query: the newest market stories from the business portals (stocks to watch, results, brokerage calls, IPOs, F&O, global cues). Call several times in parallel for several companies.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "What to search, e.g. 'Nazara Technologies', 'stocks to watch today', 'Q2 results', 'RBI policy'. Omit for the latest market news." },
        hours: { type: 'integer', minimum: 1, maximum: 720, description: 'How far back to look. Default 24 (today). Use 72–168 for "this week".' },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'Max headlines (default 12).' },
        scope: { type: 'string', enum: ['all', 'fno', 'intraday'], description: "'all' (default): any news. 'fno': only stories about F&O (futures and options) stocks or derivatives topics (OI build-up, expiry, F&O ban); each headline lists the F&O stocks it mentions. 'intraday': today's trading-day stories: intraday picks, buzzing stocks, movers." },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: 'read_article',
    description: 'Full text of one news story returned by get_news (pass its id; only items with canRead: true). Use it whenever the user wants details, the full story, numbers, or the list of stocks inside a "stocks to watch" article. Read the 2–3 most relevant stories, not all of them.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The id of a headline from get_news' } },
      required: ['id'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_watchlist_signals',
    description: "One sweep over ALL tracked symbols combining today's news with technicals: for each, price, day change %, technical bias/score, RSI, ATR, nearest support/resistance and up to 2 matching headlines (with ids for read_article). Returns the most interesting symbols first (news + strongest bias). Use for 'which stocks to buy/sell', 'trade ideas for today', 'position on all my stocks', 'what does the news say about my watchlist'.",
    input_schema: {
      type: 'object',
      properties: {
        timeframe: { type: 'string', enum: [...TIMEFRAMES], description: 'Timeframe for the technicals. Default 1d (positional); use 15m or 1h for intraday.' },
        hours: { type: 'integer', minimum: 1, maximum: 168, description: 'News lookback in hours (default 24).' },
        limit: { type: 'integer', minimum: 5, maximum: 50, description: 'Max symbols returned (default 20).' },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: 'search_instruments',
    description: "Find tradable instruments on NSE by company name or ticker: equities and futures (near/next month). Says whether each is already tracked in DataBridge (and therefore visible in AmiBroker). Use it before suggesting a symbol to add, and to find the exact ticker of a futures contract (e.g. RELIANCE26OCTFUT).",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Name or ticker, e.g. 'Polycab', 'reliance', 'NIFTY'" },
        kind: { type: 'string', enum: ['equity', 'future'], description: 'Restrict to cash stocks or futures; omit for both.' },
      },
      required: ['query'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'propose_add_symbols',
    description: "Show the user cards asking whether to add symbols to DataBridge (so they stream live into AmiBroker and their history downloads). The user answers Yes/No with buttons; you do NOT add anything yourself. Call it when news or analysis points to a stock or future the user does not track, or when they ask to add something; only propose untracked symbols, at most 5. Use tickers exactly as returned by search_instruments. Afterwards say briefly that the cards are waiting for their decision.",
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array', maxItems: 5,
          items: {
            type: 'object',
            properties: {
              ticker: { type: 'string', description: 'AmiBroker ticker, e.g. POLYCAB or RELIANCE26OCTFUT' },
              reason: { type: 'string', description: 'One short sentence: why it is worth tracking (the news / setup).' },
            },
            required: ['ticker', 'reason'],
          },
        },
      },
      required: ['items'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_option_chain',
    description: "Live option-chain summary for an index (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY) or an F&O stock: futures price and basis, India VIX, put-call ratio, the strikes with the most call OI (resistance) and put OI (support), the biggest OI additions today, the ATM straddle (expected move) and strikes around the money with LTP/OI/OI change. Use for questions about options, OI, PCR, expected range and option-based views on direction.",
    input_schema: {
      type: 'object',
      properties: {
        underlying: { type: 'string', description: "Index or stock ticker, e.g. 'NIFTY', 'BANKNIFTY', 'RELIANCE'" },
        expiry_index: { type: 'integer', minimum: 0, maximum: 3, description: '0 = nearest expiry (default), 1 = next, and so on.' },
      },
      required: ['underlying'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_futures_view',
    description: "Futures view of an underlying: near / next / far month contracts with live price, day change, volume, basis vs spot (premium or discount), whether each contract is tracked in DataBridge, and for tracked contracts the technical analysis. Combine with get_news (scope fno) and get_option_chain to give a futures outlook (bullish / bearish / range) with levels. This is a reasoned technical + news view, not a forecast.",
    input_schema: {
      type: 'object',
      properties: { underlying: { type: 'string', description: "Ticker of the underlying, e.g. 'RELIANCE', 'NIFTY', 'BANKNIFTY'" } },
      required: ['underlying'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_system_status',
    description: 'Health of DataBridge itself: broker connection, whether AmiBroker is connected to the plugin, market open/closed, symbol and live-tick counts, history download progress/failures and recent engine errors. Use for troubleshooting questions.',
    input_schema: { type: 'object', properties: {} },
    eager_input_streaming: true,
  },
]

// ===== Tool execution (inputs are validated here — eager streaming skips server validation) =====
const isTf = (v: unknown): v is Timeframe => typeof v === 'string' && (TIMEFRAMES as readonly string[]).includes(v)
const isCriterion = (v: unknown): v is ScanCriterion => typeof v === 'string' && (SCAN_CRITERIA as readonly string[]).includes(v)

export function toolLabel(name: string, input: any): string {
  switch (name) {
    case 'list_symbols': return 'Reading your symbol list'
    case 'get_quote': return `Getting live quote for ${input?.ticker ?? ''}`
    case 'get_technical_analysis': return `Analysing ${input?.ticker ?? ''} (${input?.timeframe ?? ''})`
    case 'scan_symbols': return `Scanning all symbols: ${String(input?.criterion ?? '').replace(/_/g, ' ')}`
    case 'get_news': return input?.query ? `Searching news: ${input.query}` : 'Reading the latest market news'
    case 'read_article': return 'Reading the full article'
    case 'search_instruments': return `Looking up instruments: ${input?.query ?? ''}`
    case 'propose_add_symbols': return 'Preparing symbols for you to add'
    case 'get_option_chain': return `Reading the ${input?.underlying ?? ''} option chain`
    case 'get_futures_view': return `Checking ${input?.underlying ?? ''} futures`
    case 'get_watchlist_signals': return 'Checking news + technicals for all your symbols'
    case 'get_system_status': return 'Checking DataBridge status'
    default: return name
  }
}

export async function runTool(name: string, input: any, ctx: ToolContext = {}): Promise<{ content: string; isError?: boolean }> {
  const ok = (v: unknown) => ({ content: JSON.stringify(v) })
  const fail = (msg: string) => ({ content: msg, isError: true })
  if (input === null || typeof input !== 'object') return fail('INVALID_JSON: tool input must be an object')

  const needSymbol = () => {
    if (typeof input.ticker !== 'string' || !input.ticker.trim()) return { err: fail('ticker (string) is required') }
    const { symbol, suggestions } = resolveSymbol(input.ticker)
    if (!symbol) return { err: fail(`"${input.ticker}" is not tracked in DataBridge.${suggestions.length ? ' Close matches: ' + suggestions.join(', ') : ''} The user can add it in Symbol Setup.`) }
    return { symbol }
  }

  switch (name) {
    case 'list_symbols': {
      const feeds = new Map(feedSimulator.getFeedStatuses().map(f => [f.ticker, f]))
      return ok({
        asOfIST: istString(Date.now()), marketOpen: isMarketOpenNow(),
        symbols: listSymbols().map(s => {
          const f = feeds.get(s.ticker)
          return { ticker: s.ticker, exchange: s.exchange, type: s.instrumentType, lastPrice: f?.lastPrice || null, feedStatus: f?.status ?? 'UNKNOWN' }
        }),
      })
    }
    case 'get_quote': {
      const r = needSymbol(); if (r.err) return r.err
      return ok(await getQuote(r.symbol!))
    }
    case 'get_technical_analysis': {
      const r = needSymbol(); if (r.err) return r.err
      if (!isTf(input.timeframe)) return fail(`timeframe must be one of ${TIMEFRAMES.join(', ')}`)
      return ok(await analyze(r.symbol!, input.timeframe))
    }
    case 'scan_symbols': {
      if (!isCriterion(input.criterion)) return fail(`criterion must be one of ${SCAN_CRITERIA.join(', ')}`)
      const tf = input.timeframe === undefined ? '1d' : input.timeframe
      if (!isTf(tf)) return fail(`timeframe must be one of ${TIMEFRAMES.join(', ')}`)
      const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), 50) : 10
      return ok(await scan(input.criterion, tf, limit))
    }
    case 'get_news': {
      if (input.query !== undefined && typeof input.query !== 'string') return fail('query must be a string')
      const hours = Number.isInteger(input.hours) ? input.hours : 24
      const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), 30) : 12
      try {
        // A bare NSE ticker ("POLYCAB") is searched by its company name ("Polycab India")
        const q = typeof input.query === 'string' && /^[A-Z0-9&-]{2,20}$/.test(input.query.trim())
          ? (companyName(input.query.trim()) ?? input.query) : input.query
        const scope = input.scope === 'fno' || input.scope === 'intraday' ? input.scope : 'all'
        const headlines = await fetchNews(q, hours, limit, scope)
        return ok({ nowIST: istString(Date.now()), query: input.query || '(latest market news)', scope, lookbackHours: hours, count: headlines.length, headlines })
      } catch (err: any) {
        return fail(`News is unavailable right now (${err?.message || err}). Check the internet connection.`)
      }
    }
    case 'read_article': {
      if (typeof input.id !== 'string' || !input.id.trim()) return fail('id (string) is required')
      try {
        return ok(await readArticle(input.id.trim()))
      } catch (err: any) {
        return fail(`Could not read that article: ${err?.message || err}. Try another headline with canRead: true.`)
      }
    }
    case 'search_instruments': {
      if (typeof input.query !== 'string' || !input.query.trim()) return fail('query (string) is required')
      const kind = input.kind === 'equity' || input.kind === 'future' ? input.kind : undefined
      const found = findInstruments(input.query, kind, 8)
      if (!found.length) return ok({ query: input.query, matches: [], note: 'No NSE instrument matched. Try the full company name.' })
      return ok({ query: input.query, matches: found.map(i => ({ ticker: i.ticker, name: i.name, type: i.instrumentType, exchange: i.exchange, expiry: i.expiry, lotSize: i.lotSize, tracked: i.tracked })), next: 'This only looked them up. To let the user add an untracked match, call propose_add_symbols now (the Yes/No cards appear only then).' })
    }
    case 'propose_add_symbols': {
      if (!Array.isArray(input.items) || !input.items.length) return fail('items (array) is required')
      const brokerId = (stmts.getBrokers.all() as any[]).map(b => b.id).find(id => brokerManager.getAdapter(id))
      if (!brokerId) return fail('No broker is connected, so symbols cannot be added right now.')
      const items: SuggestionItem[] = []
      const skipped: string[] = []
      for (const it of input.items.slice(0, 5)) {
        const inst: Instrument | undefined = typeof it?.ticker === 'string' ? instrumentByTicker(it.ticker.trim()) : undefined
        if (!inst) { skipped.push(`${it?.ticker} (unknown: use search_instruments)`); continue }
        if (isTracked(inst.ticker)) { skipped.push(`${inst.ticker} (already tracked)`); continue }
        items.push({
          ticker: inst.ticker, name: inst.name, exchange: inst.exchange, instrumentType: inst.instrumentType,
          instrumentId: inst.instrumentId, reason: String(it.reason || '').slice(0, 200), expiry: inst.expiry, lotSize: inst.lotSize,
        })
      }
      if (items.length) ctx.emit?.({ type: 'suggestion', brokerId, items })
      return ok({ shownToUser: items.map(i => i.ticker), skipped, note: 'The user will choose Yes/No on each card. Nothing has been added yet; do not say it was added.' })
    }
    case 'get_option_chain': {
      if (typeof input.underlying !== 'string' || !input.underlying.trim()) return fail('underlying (string) is required')
      const idx = Number.isInteger(input.expiry_index) ? input.expiry_index : 0
      try {
        const r: any = await optionChainSummary(input.underlying, idx, 8)
        return r.error ? fail(r.error) : ok(r)
      } catch (err: any) {
        return fail(`Option chain unavailable: ${err?.message || err}`)
      }
    }
    case 'get_futures_view': {
      if (typeof input.underlying !== 'string' || !input.underlying.trim()) return fail('underlying (string) is required')
      const u = input.underlying.trim().toUpperCase()
      const contracts = futuresOf(u, 3)
      if (!contracts.length) return fail(`${u} has no futures (not in the F&O segment). Use search_instruments to check the name.`)
      const adapter: any = brokerManager.getAllAdapters().find((a: any) => typeof a?.dataApi === 'function')
      const quotes = new Map<string, any>()
      if (adapter) {
        try {
          const syms = [...contracts.map(c => c.instrumentId), `NSE:${u}-EQ`].join(',')
          const q = await adapter.dataApi(`quotes?symbols=${encodeURIComponent(syms)}`)
          for (const row of q.d || []) if (row.s === 'ok') quotes.set(row.n, row.v)
        } catch { /* quotes are optional */ }
      }
      const spot = quotes.get(`NSE:${u}-EQ`)?.lp ?? null
      const view = await Promise.all(contracts.map(async c => {
        const q = quotes.get(c.instrumentId)
        const tracked = isTracked(c.ticker)
        let technicals: any = null
        if (tracked) {
          const sym = listSymbols().find(s => s.ticker === c.ticker)
          if (sym) {
            const a: any = await analyze(sym, '1h', 200).catch(() => null)
            if (a && !a.error) technicals = { bias: a.technicalBias, score: a.biasScore, rsi14: a.indicators.rsi14, atr14: a.indicators.atr14, ...a.levels }
          }
        }
        return {
          ticker: c.ticker, expiry: c.expiry, lotSize: c.lotSize, tracked,
          price: q?.lp ?? null, dayChangePct: q?.chp ?? null, volume: q?.volume ?? null, high: q?.high_price ?? null, low: q?.low_price ?? null,
          basis: spot != null && q?.lp ? Math.round((q.lp - spot) * 100) / 100 : null,
          basisPct: spot != null && q?.lp ? Math.round(((q.lp - spot) / spot) * 10000) / 100 : null,
          technicals,
        }
      }))
      return ok({ underlying: u, asOfIST: istString(Date.now()), marketOpen: isMarketOpenNow(), spot, contracts: view, hint: 'Untracked contracts can be offered with propose_add_symbols (futures history = last 2 months). For OI/PCR levels call get_option_chain.' })
    }
    case 'get_watchlist_signals': {
      const tf = input.timeframe === undefined ? '1d' : input.timeframe
      if (!isTf(tf)) return fail(`timeframe must be one of ${TIMEFRAMES.join(', ')}`)
      const hours = Number.isInteger(input.hours) ? input.hours : 24
      const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 5), 50) : 20
      const syms = listSymbols()

      const techRows: any[] = []
      const queue = [...syms]
      const techTask = Promise.all(Array.from({ length: 4 }, async () => {
        for (let sym = queue.shift(); sym; sym = queue.shift()) {
          try {
            const a: any = await analyze(sym, tf, 220)
            if (a.error) continue
            const daily = tf === '1d' ? a.lastCandles : null
            const prev = daily ? daily.at(-2)?.close : null
            techRows.push({
              ticker: a.ticker, price: a.price,
              dayChangePct: prev ? Math.round(((a.price - prev) / prev) * 10000) / 100 : null,
              bias: a.technicalBias, score: a.biasScore, rsi: a.indicators.rsi14, atr: a.indicators.atr14,
              support: a.levels.support?.[0] ?? null, resistance: a.levels.resistance?.[0] ?? null,
            })
          } catch { /* skip symbol */ }
        }
      }))
      const newsTask = fetchWatchlistNews(syms.map(s => ({ ticker: s.ticker, ...newsTerms(s.ticker) })), hours, 2)
        .catch(() => null)
      const [, newsMap] = await Promise.all([techTask, newsTask])

      const rows = techRows.map(r => ({
        ...r,
        news: (newsMap?.get(r.ticker) || []).map(n => ({ id: n.id, title: n.title, source: n.source, hoursAgo: n.hoursAgo, canRead: n.canRead })),
      }))
      rows.sort((a, b) => (b.news.length ? 3 : 0) + Math.abs(b.score) - ((a.news.length ? 3 : 0) + Math.abs(a.score)))
      return ok({
        asOfIST: istString(Date.now()), marketOpen: isMarketOpenNow(), timeframe: tf, newsLookbackHours: hours,
        newsAvailable: newsMap !== null,
        symbolsScanned: syms.length, symbolsWithNews: rows.filter(r => r.news.length).length,
        results: rows.slice(0, limit),
        // Everything not in results, compactly, so a "position for each stock" covers the whole list
        others: rows.slice(limit).map(r => `${r.ticker} ${r.bias} (score ${r.score}, RSI ${r.rsi ?? '—'}, day ${r.dayChangePct ?? '—'}%)`),
      })
    }
    case 'get_system_status': {
      const feeds = feedSimulator.getFeedStatuses()
      const statuses = backfillQueue.getAllStatuses()
      return ok({
        asOfIST: istString(Date.now()),
        marketOpen: isMarketOpenNow(),
        brokers: (stmts.getBrokers.all() as any[]).map(b => ({ broker: b.broker_type, status: b.status })),
        amibrokerPluginConnected: runtimeProbe().amibrokerConnections > 0,
        symbolsTracked: feeds.length,
        symbolsReceivingLiveTicks: feeds.filter(f => f.status === 'RECEIVING').length,
        historyDownload: {
          queued: backfillQueue.getQueueLength(),
          running: statuses.filter(s => s.status === 'running').map(s => s.ticker),
          failed: statuses.filter(s => s.status === 'failed').map(s => ({ ticker: s.ticker, error: s.lastError })),
        },
        recentEngineErrors: getConsoleLines(3000)
          .filter(l => (l.level === 'error' || l.level === 'warn' || /\b(error|failed)\b/i.test(l.text)) && !l.text.startsWith('[Live Tick]'))
          .slice(-10)
          .map(l => `${istString(l.ts)} ${l.text.slice(0, 200)}`),
      })
    }
    default:
      return fail(`Unknown tool ${name}`)
  }
}

// ===== Conversations (append-only history, so thinking blocks stay valid) =====
const conversations = new Map<string, Msg[]>()

export function resetConversation(id: string) { conversations.delete(id) }

/**
 * Answer one user message, streaming events through `emit`. A turn that fails part-way is
 * discarded (history only grows by complete turns). Abort via `signal` (client disconnected / Stop).
 */
export async function chat(conversationId: string | undefined, userText: string, emit: (e: AssistantEvent) => void, signal: AbortSignal) {
  const id = conversationId && conversations.has(conversationId) ? conversationId : randomUUID()
  emit({ type: 'conversation', id })

  const messages: Msg[] = [...(conversations.get(id) ?? []), { role: 'user', content: userText }]
  const client = new Anthropic()
  let jsonRetries = 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      // Opus 5.5: thinking is always adaptive; effort set explicitly (its default is medium)
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // Re-run a classifier-declined request on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Caches tools + system + conversation so far
      cache_control: { type: 'ephemeral' },
      system: SYSTEM_PROMPT,
      tools,
      messages,
    }, { signal })

    stream.on('text', (delta) => emit({ type: 'text', text: delta }))

    let message: Anthropic.Beta.BetaMessage
    try {
      message = await stream.finalMessage()
      jsonRetries = 0
    } catch (err) {
      if (signal.aborted) return
      // With eager input streaming a tool input can arrive as unparseable JSON:
      // re-issue the turn (it was never appended). API errors are real failures.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err
      continue
    }

    if (message.stop_reason === 'refusal') {
      emit({ type: 'error', message: 'The assistant declined to answer this request. Try rephrasing it.' })
      return
    }

    messages.push({ role: 'assistant', content: message.content })
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')

    if (toolUses.length === 0) {
      // Commit the completed turn
      conversations.delete(id)
      conversations.set(id, messages)
      while (conversations.size > MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value!)
      emit({ type: 'done' })
      return
    }
    if (message.stop_reason === 'max_tokens') throw new Error('Response was cut off (max_tokens) while calling a tool.')

    // Run this round's tools in parallel; all results go back in one user message
    for (const t of toolUses) emit({ type: 'tool', name: t.name, label: toolLabel(t.name, t.input) })
    const results = await Promise.all(toolUses.map(async (t): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
      try {
        const r = await runTool(t.name, t.input, { emit })
        return { type: 'tool_result', tool_use_id: t.id, content: r.content, is_error: r.isError }
      } catch (err: any) {
        return { type: 'tool_result', tool_use_id: t.id, content: `Tool failed: ${err?.message || err}`, is_error: true }
      }
    }))
    if (signal.aborted) return
    messages.push({ role: 'user', content: results })
  }
  emit({ type: 'error', message: 'Stopped after too many tool calls. Please ask a more specific question.' })
}

/** One tool-free completion with Claude (e.g. writing the morning brief from pre-gathered data). */
export async function writeTextClaude(system: string, user: string, signal: AbortSignal): Promise<string> {
  const client = new Anthropic()
  const message = await client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: user }],
  }, { signal }).finalMessage()
  if (message.stop_reason === 'refusal') throw new Error('The assistant declined to write the brief.')
  return message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('')
}
