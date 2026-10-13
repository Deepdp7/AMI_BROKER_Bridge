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
    case 'get_system_status': return 'Checking DataBridge status'
    default: return name
  }
}

export async function runTool(name: string, input: any): Promise<{ content: string; isError?: boolean }> {
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
        const r = await runTool(t.name, t.input)
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
