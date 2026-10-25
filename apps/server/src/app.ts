/**
 * The engine's HTTP API (Express): middleware and route mounting. Started by index.ts;
 * tests use it directly with supertest.
 */
import express = require('express')
import cors = require('cors')
import brokersRouter from './api/routes/brokers'
import statusRouter from './api/routes/status'
import settingsRouter from './api/routes/settings'
import logsRouter from './api/routes/logs'
import systemRouter from './api/routes/system'
import backfillRouter from './api/routes/backfill'
import aiRouter from './api/routes/ai'
import feedRouter from './api/routes/feed'
import symbolsRouter from './api/routes/symbols'

export const app = express()

// ===== Middleware =====
// CORS: Allow localhost and ngrok for dev
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('ngrok-free.dev') || origin.includes('tauri.localhost') || origin.startsWith('tauri://')) {
      callback(null, true)
    } else {
      console.error(`[Server Error] CORS blocked origin: ${origin}`);
      callback(new Error('CORS: Only localhost/tauri origins allowed'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Convert JSON parse errors to 400
app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  next(err)
})

// Structured request logger (filters high-frequency feed polling from flooding stdout)
app.use((req, _res, next) => {
  if (req.path !== '/api/feed/bars') {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
    }))
  }
  next()
})

// ===== Routes =====
// Alias for OAuth callbacks (redirects to the correct route)
app.use('/api/callback', (req, res) => {
  res.redirect(req.originalUrl.replace('/api/callback', '/api/brokers/callback'))
})

app.use('/api/brokers', brokersRouter)
app.use('/api/status', statusRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/logs', logsRouter)
app.use('/api/diagnostics', logsRouter) // export endpoint also on this prefix
app.use('/api/system', systemRouter)
app.use('/api/backfill', backfillRouter)
app.use('/api/ai', aiRouter)
app.use('/api/feed', feedRouter)
app.use('/api/symbols', symbolsRouter)

// Health check (used by the app to detect that the engine is up)
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', ts: Date.now() })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message)
  res.status(500).json({ error: err.message })
})
