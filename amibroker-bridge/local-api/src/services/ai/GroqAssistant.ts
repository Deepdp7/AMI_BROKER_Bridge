/**
 * GroqAssistant.ts
 *
 * Groq-backed version of the market assistant. Same system prompt and read-only tools
 * as the Claude assistant (AiAssistant.ts), over Groq's OpenAI-compatible
 * chat-completions API with streaming and function calling.
 */
import { randomUUID } from 'crypto'
import { SYSTEM_PROMPT, tools, runTool, toolLabel, type AssistantEvent } from './AiAssistant'

const BASE_URL = 'https://api.groq.com/openai/v1'
// First of these that the account can use; GROQ_MODEL overrides
const PREFERRED_MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b']
const MAX_CONVERSATIONS = 50
const MAX_TOOL_ROUNDS = 8

type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type Msg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export class GroqError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}

const groqTools = tools.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}))

let resolvedModel: string | null = null

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || resolvedModel || PREFERRED_MODELS[0]
}

async function groqFetch(pathname: string, init: RequestInit, apiKey = process.env.GROQ_API_KEY): Promise<Response> {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}))
    const message: string = body?.error?.message || `HTTP ${res.status}`
    const err = new GroqError(res.status, message, body?.error?.code)
    // Groq says when the per-minute window frees up, in the header and/or the message ("try again in 12.5s")
    const fromMsg = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message)
    ;(err as any).retryAfterSec = Number(res.headers.get('retry-after')) || (fromMsg ? Number(fromMsg[1] || 0) * 60 + Number(fromMsg[2]) : 0)
    throw err
  }
  return res
}

/** Checks a key against Groq and picks the model to use. Throws GroqError (401) for a bad key. */
export async function verifyGroqKey(apiKey: string): Promise<string> {
  const res = await groqFetch('/models', { method: 'GET' }, apiKey)
  const body: any = await res.json()
  const ids: string[] = (body?.data || []).filter((m: any) => m?.active !== false).map((m: any) => m.id)
  resolvedModel = PREFERRED_MODELS.find(m => ids.includes(m))
    || ids.find(id => !/whisper|guard|tts|playai|orpheus|prompt-guard|compound/i.test(id))
    || PREFERRED_MODELS[0]
  return resolvedModel
}

const conversations = new Map<string, Msg[]>()

export function resetGroqConversation(id: string) { conversations.delete(id) }

/** One streamed completion. Returns the assistant message (text + tool calls) and finish reason. */
async function complete(model: string, messages: Msg[], emit: (e: AssistantEvent) => void, signal: AbortSignal) {
  const body: Record<string, unknown> = {
    model,
    messages,
    tools: groqTools,
    tool_choice: 'auto',
    stream: true,
    max_completion_tokens: 4096,
    temperature: 0.3,
  }
  // gpt-oss models reason before answering; keep their reasoning out of the reply
  // Low effort keeps reasoning tokens (which count toward Groq's per-minute token limit) small
  if (model.startsWith('openai/gpt-oss')) { body.reasoning_effort = 'low'; body.include_reasoning = false }

  const res = await groqFetch('/chat/completions', { method: 'POST', body: JSON.stringify(body), signal })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = '', text = '', finish = ''
  const calls: ToolCall[] = []

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      const chunk = JSON.parse(data)
      if (chunk.error) throw new GroqError(500, chunk.error.message || 'Groq stream error')
      const choice = chunk.choices?.[0]
      if (!choice) continue
      const delta = choice.delta || {}
      if (delta.content) { text += delta.content; emit({ type: 'text', text: delta.content }) }
      // Tool-call arguments arrive in pieces keyed by index
      for (const tc of delta.tool_calls || []) {
        const c = calls[tc.index] ||= { id: '', type: 'function', function: { name: '', arguments: '' } }
        if (tc.id) c.id = tc.id
        if (tc.function?.name) c.function.name += tc.function.name
        if (tc.function?.arguments) c.function.arguments += tc.function.arguments
      }
      if (choice.finish_reason) finish = choice.finish_reason
    }
  }
  return { text, calls: calls.filter(Boolean), finish }
}

/** Same contract as the Claude `chat`: streams events; only complete turns are kept in history. */
export async function chatGroq(conversationId: string | undefined, userText: string, emit: (e: AssistantEvent) => void, signal: AbortSignal) {
  const id = conversationId && conversations.has(conversationId) ? conversationId : randomUUID()
  emit({ type: 'conversation', id })

  // Earlier turns' tool output is already summarised in the answers; shorten it so every
  // request stays well inside the free tier's per-minute token budget
  const history = (conversations.get(id) ?? [{ role: 'system', content: SYSTEM_PROMPT } as Msg])
    .map(m => (m.role === 'tool' && m.content.length > 400 ? { ...m, content: m.content.slice(0, 400) + '…(truncated)' } : m))
  const messages: Msg[] = [...history, { role: 'user', content: userText }]
  if (!resolvedModel && !process.env.GROQ_MODEL) await verifyGroqKey(process.env.GROQ_API_KEY || '').catch(() => {})
  const model = getGroqModel()
  let retries = 0

  // Rate-limit waits and malformed-call retries don't use up tool rounds
  for (let round = 0; round < MAX_TOOL_ROUNDS;) {
    let result: Awaited<ReturnType<typeof complete>>
    try {
      result = await complete(model, messages, emit, signal)
    } catch (err: any) {
      if (signal.aborted) return
      // Model produced a malformed tool call, or the per-minute token budget is used up:
      // wait for Groq's window to reset (up to ~1 min) and retry the round
      const waitSec = err instanceof GroqError && err.status === 429 ? Math.ceil((err as any).retryAfterSec || 15) : 0
      const retryable = err instanceof GroqError && (err.code === 'tool_use_failed' || (err.status === 429 && waitSec <= 65))
      if (!retryable || retries++ >= 3) throw err
      if (waitSec) {
        emit({ type: 'tool', name: 'rate_limit', label: `Groq free-tier limit — continuing in ${waitSec}s` })
        await new Promise<void>(resolve => {
          const t = setTimeout(resolve, waitSec * 1000)
          signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
        })
        if (signal.aborted) return
      }
      continue
    }

    round++
    retries = 0
    messages.push({ role: 'assistant', content: result.text || null, ...(result.calls.length ? { tool_calls: result.calls } : {}) })

    if (result.calls.length === 0) {
      conversations.delete(id)
      conversations.set(id, messages)
      while (conversations.size > MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value!)
      emit({ type: 'done' })
      return
    }
    if (result.finish === 'length') throw new Error('Response was cut off while calling a tool.')

    const parsed = result.calls.map(c => {
      try { return { c, input: c.function.arguments ? JSON.parse(c.function.arguments) : {} } } catch { return { c, input: null } }
    })
    for (const { c, input } of parsed) emit({ type: 'tool', name: c.function.name, label: toolLabel(c.function.name, input) })
    const outputs = await Promise.all(parsed.map(async ({ c, input }) => {
      try {
        const r = await runTool(c.function.name, input, { emit })
        return r.isError ? `ERROR: ${r.content}` : r.content
      } catch (err: any) {
        return `ERROR: Tool failed: ${err?.message || err}`
      }
    }))
    if (signal.aborted) return
    parsed.forEach(({ c }, i) => messages.push({ role: 'tool', tool_call_id: c.id, content: outputs[i] }))
  }
  emit({ type: 'error', message: 'Stopped after too many tool calls. Please ask a more specific question.' })
}

/** One tool-free completion (e.g. writing the morning brief from pre-gathered data). Waits out short rate limits. */
export async function writeTextGroq(system: string, user: string, signal: AbortSignal): Promise<string> {
  if (!resolvedModel && !process.env.GROQ_MODEL) await verifyGroqKey(process.env.GROQ_API_KEY || '').catch(() => {})
  const model = getGroqModel()
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_completion_tokens: 4000,
    temperature: 0.2,
  }
  // A single call, so it can afford more reasoning than the tool loop (better faithfulness)
  if (model.startsWith('openai/gpt-oss')) { body.reasoning_effort = 'medium'; body.include_reasoning = false }
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await groqFetch('/chat/completions', { method: 'POST', body: JSON.stringify(body), signal })
      const data: any = await res.json()
      return String(data?.choices?.[0]?.message?.content || '')
    } catch (err: any) {
      const waitSec = err instanceof GroqError && err.status === 429 ? Math.ceil((err as any).retryAfterSec || 15) : 0
      if (!waitSec || waitSec > 65 || attempt >= 3 || signal.aborted) throw err
      await new Promise(r => setTimeout(r, waitSec * 1000))
    }
  }
}
