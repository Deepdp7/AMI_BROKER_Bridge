/**
 * DataBridge Pro — API Integration Tests
 * Tests all Express routes against the local API server
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app, server } from '../src/server'
import { db } from '../src/db'

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:'

beforeAll(async () => {
  // Give the server time to initialize
  await new Promise(resolve => setTimeout(resolve, 100))
})

afterAll(async () => {
  server.close()
  db.close()
})

// ===== Settings Tests =====
describe('GET /api/settings', () => {
  it('returns default settings object', async () => {
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('amiBrokerPath')
    expect(res.body).toHaveProperty('autoStartWithWindows')
    expect(res.body).toHaveProperty('logLevel')
    expect(res.body).toHaveProperty('backfillDepthDays')
  })
})

describe('PUT /api/settings', () => {
  it('updates settings and returns updated object', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ logLevel: 'debug', backfillDepthDays: 45 })
    expect(res.status).toBe(200)
    expect(res.body.logLevel).toBe('debug')
    expect(res.body.backfillDepthDays).toBe(45)
  })

  it('rejects null payload with 400', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send(null)
      .set('Content-Type', 'application/json')
    expect(res.status).toBe(400)
  })
})

// ===== Broker Tests =====
describe('GET /api/brokers', () => {
  it('returns array (may be empty)', async () => {
    const res = await request(app).get('/api/brokers')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/brokers', () => {
  let brokerId: string

  it('adds a broker account successfully', async () => {
    const res = await request(app)
      .post('/api/brokers')
      .send({ brokerType: 'zerodha_kite', label: 'Test Kite', apiKey: 'testkey123', apiSecret: 'testsecret456' })
    expect(res.status).toBe(201)
    const broker = res.body.broker || res.body
    expect(broker).toHaveProperty('id')
    expect(broker.brokerType).toBe('zerodha_kite')
    expect(broker).not.toHaveProperty('apiKey') // credential never returned
    brokerId = broker.id
  })

  it('rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/brokers')
      .send({ brokerType: 'zerodha_kite', label: 'No Creds' })
    expect(res.status).toBe(400)
  })

  it('rejects missing brokerType', async () => {
    const res = await request(app)
      .post('/api/brokers')
      .send({ label: 'Missing Type', apiKey: 'k', apiSecret: 's' })
    expect(res.status).toBe(400)
  })

  it('appears in broker list after addition', async () => {
    const res = await request(app).get('/api/brokers')
    expect(res.status).toBe(200)
    const found = res.body.find((b: any) => b.id === brokerId)
    expect(found).toBeDefined()
    expect(found.label).toBe('Test Kite')
  })

  it('adds symbols to broker', async () => {
    const res = await request(app)
      .post(`/api/brokers/${brokerId}/symbols`)
      .send({ tickers: ['RELIANCE', 'TCS', 'INFY'] })
    expect(res.status).toBe(200)
    expect(res.body.added).toBeGreaterThan(0)
  })

  it('rejects symbol add for unknown broker', async () => {
    const res = await request(app)
      .post('/api/brokers/nonexistent/symbols')
      .send({ tickers: ['RELIANCE'] })
    expect(res.status).toBe(404)
  })

  it('removes broker and returns ok', async () => {
    const res = await request(app).delete(`/api/brokers/${brokerId}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('broker is gone after removal', async () => {
    const res = await request(app).get('/api/brokers')
    const found = res.body.find((b: any) => b.id === brokerId)
    expect(found).toBeUndefined()
  })

  it('returns 404 for already-deleted broker', async () => {
    const res = await request(app).delete(`/api/brokers/${brokerId}`)
    expect(res.status).toBe(404)
  })
})

// ===== Status Tests =====
describe('GET /api/status/feed', () => {
  it('returns feed status object', async () => {
    const res = await request(app).get('/api/status/feed')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('symbols')
    expect(res.body).toHaveProperty('coreEngine')
    expect(res.body).toHaveProperty('timestamp')
    expect(Array.isArray(res.body.symbols)).toBe(true)
  })

  it('coreEngine has required fields', async () => {
    const res = await request(app).get('/api/status/feed')
    const { coreEngine } = res.body
    expect(coreEngine).toHaveProperty('cpuPercent')
    expect(coreEngine).toHaveProperty('ramMb')
    expect(coreEngine).toHaveProperty('uptimeSec')
    expect(coreEngine).toHaveProperty('messagesPerSec')
  })
})

describe('GET /api/status/health', () => {
  it('returns health response', async () => {
    const res = await request(app).get('/api/status/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('brokers')
    expect(res.body).toHaveProperty('coreEngine')
    expect(res.body).toHaveProperty('uptimeSec')
  })
})

// ===== Logs Tests =====
describe('GET /api/logs', () => {
  it('returns array of log entries', async () => {
    const res = await request(app).get('/api/logs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('filters by level', async () => {
    const res = await request(app).get('/api/logs?level=info')
    expect(res.status).toBe(200)
    res.body.forEach((l: any) => expect(l.level).toBe('info'))
  })

  it('respects limit parameter', async () => {
    const res = await request(app).get('/api/logs?limit=5')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeLessThanOrEqual(5)
  })

  it('limits max results to 2000', async () => {
    const res = await request(app).get('/api/logs?limit=99999')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeLessThanOrEqual(2000)
  })
})

// ===== Diagnostics Tests =====
describe('POST /api/diagnostics/export', () => {
  it('generates diagnostics bundle', async () => {
    const res = await request(app).post('/api/diagnostics/export')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('filename')
    expect(res.body.filename).toMatch(/\.json$/)
  })
})

// ===== Security Tests =====
describe('Security checks', () => {
  it('GET /api/logs never contains raw API keys', async () => {
    const res = await request(app).get('/api/logs')
    const content = JSON.stringify(res.body)
    expect(content).not.toMatch(/apikey=\w+/i)
    expect(content).not.toMatch(/token=\w{8,}/i)
  })

  it('GET /api/brokers never returns actual credential values', async () => {
    // Add and retrieve a broker
    await request(app)
      .post('/api/brokers')
      .send({ brokerType: 'zerodha_kite', label: 'SecTest', apiKey: 'SUPER_SECRET_KEY', apiSecret: 'SUPER_SECRET_SECRET' })
    const res = await request(app).get('/api/brokers')
    const content = JSON.stringify(res.body)
    expect(content).not.toContain('SUPER_SECRET_KEY')
    expect(content).not.toContain('SUPER_SECRET_SECRET')
  })

  it('API ping responds correctly', async () => {
    const res = await request(app).get('/api/ping')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/nonexistent')
    expect(res.status).toBe(404)
  })
})
