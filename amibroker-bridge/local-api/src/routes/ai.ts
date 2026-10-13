/**
 * routes/ai.ts — built-in AI market assistant
 *
 *   GET    /api/ai/status            — { configured, provider, model }
 *   POST   /api/ai/key               — { apiKey } Groq (gsk_…) or Anthropic (sk-ant-…) key, saved to %APPDATA%\DataBridgePro\.env
 *   POST   /api/ai/chat              — { message, conversationId? } → Server-Sent Events stream
 *   DELETE /api/ai/conversation/:id  — forget a conversation
 */
import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { DATA_DIR } from '../db'
import { chat, getAiProvider, resetConversation, CLAUDE_MODEL, type AssistantEvent } from '../services/ai/AiAssistant'
import { chatGroq, getGroqModel, resetGroqConversation, verifyGroqKey, GroqError } from '../services/ai/GroqAssistant'

const router = Router()

router.get('/status', (_req, res) => {
  const provider = getAiProvider()
  res.json({ configured: provider !== null, provider, model: provider === 'groq' ? getGroqModel() : CLAUDE_MODEL })
})

/** Writes KEY=value lines into the .env the engine loads at startup (see db.ts loadEnv), keeping other lines. */
function saveEnv(values: Record<string, string>) {
  const envPath = path.join(DATA_DIR, '.env')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []
  const kept = lines.filter(l => !Object.keys(values).some(k => l.startsWith(`${k}=`)))
  while (kept.length && kept[kept.length - 1] === '') kept.pop()
  for (const [k, v] of Object.entries(values)) { kept.push(`${k}=${v}`); process.env[k] = v }
  kept.push('')
  fs.writeFileSync(envPath, kept.join('\n'), 'utf8')
}

router.post('/key', async (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim()
  try {
    if (/^gsk_\w{20,}$/.test(apiKey)) {
      let model: string
      try {
        model = await verifyGroqKey(apiKey)
      } catch (err: any) {
        if (err instanceof GroqError && err.status === 401) return res.status(400).json({ error: 'Groq rejected this API key. Copy it again from console.groq.com → API Keys.' })
        throw err
      }
      saveEnv({ GROQ_API_KEY: apiKey, DATABRIDGE_AI_PROVIDER: 'groq' })
      console.log(`[AI] Groq API key saved (model ${model}).`)
      return res.json({ ok: true, provider: 'groq', model })
    }
    if (/^sk-ant-[\w-]{20,}$/.test(apiKey)) {
      saveEnv({ ANTHROPIC_API_KEY: apiKey, DATABRIDGE_AI_PROVIDER: 'anthropic' })
      console.log('[AI] Anthropic API key saved.')
      return res.json({ ok: true, provider: 'anthropic', model: CLAUDE_MODEL })
    }
    res.status(400).json({ error: 'That does not look like a Groq key (gsk_…) or an Anthropic key (sk-ant-…).' })
  } catch (err: any) {
    res.status(500).json({ error: `Could not save the key: ${err?.message || err}` })
  }
})

router.delete('/conversation/:id', (req, res) => {
  resetConversation(req.params.id)
  resetGroqConversation(req.params.id)
  res.json({ ok: true })
})

router.post('/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim()
  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined
  if (!message) return res.status(400).json({ error: 'message is required' })
  const provider = getAiProvider()
  if (!provider) return res.status(400).json({ error: 'AI assistant is not set up — add your Groq or Anthropic API key first.' })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  const emit = (e: AssistantEvent) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`) }

  // Stop button / window closed → cancel the AI request
  const abort = new AbortController()
  res.on('close', () => abort.abort())

  try {
    if (provider === 'groq') await chatGroq(conversationId, message, emit, abort.signal)
    else await chat(conversationId, message, emit, abort.signal)
  } catch (err: any) {
    let msg = err?.message || String(err)
    if (err instanceof Anthropic.AuthenticationError) msg = 'Your Anthropic API key was rejected. Re-enter it in the AI Assistant settings.'
    else if (err instanceof Anthropic.RateLimitError) msg = 'Rate limited by the AI service — wait a moment and try again.'
    else if (err instanceof Anthropic.APIConnectionError) msg = 'Could not reach the AI service. Check your internet connection.'
    else if (err instanceof Anthropic.APIError) msg = `AI service error ${err.status}: ${err.message}`
    else if (err instanceof GroqError) {
      if (err.status === 401) msg = 'Your Groq API key was rejected. Re-enter it in the AI Assistant settings.'
      else if (err.status === 429) msg = 'Groq rate limit reached (free tier allows only a few requests per minute) — wait a minute and try again.'
      else msg = `Groq error ${err.status}: ${err.message}`
    } else if (err?.name === 'TypeError' && /fetch/i.test(msg)) msg = 'Could not reach the AI service. Check your internet connection.'
    console.error('[AI] Chat failed:', msg)
    emit({ type: 'error', message: msg })
  } finally {
    if (!res.writableEnded) res.end()
  }
})

export default router
