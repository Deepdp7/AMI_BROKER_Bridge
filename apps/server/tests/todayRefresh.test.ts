/**
 * DataBridge Pro — "Today" re-downloads (Feed Status buttons, Symbol Setup selection) and the
 * broker shown next to each symbol's live status.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { stmts } from '../src/db'
import { backfillQueue } from '../src/market/BackfillQueue'

const add = (broker: string, ticker: string) => stmts.insertSymbol.run({
  broker_id: broker, instrument_id: `NSE:${ticker}-EQ`, amibroker_ticker: ticker, exchange: 'NSE',
  instrument_type: 'EQ', raw_symbol: `NSE:${ticker}-EQ`, created_at: Date.now(),
})

describe('POST /api/backfill/today', () => {
  const queued: string[] = []
  beforeAll(() => {
    vi.spyOn(backfillQueue, 'enqueueGapFill').mockImplementation(((ticker: string) => { queued.push(ticker) }) as any)
    add('fyers-t', 'TDA')
    add('fyers-t', 'TDB')
    add('orphaned', 'TDC')
  })

  it('all: queues every symbol that has a broker in one call, and counts the rest', async () => {
    queued.length = 0
    const res = await request(app).post('/api/backfill/today').send({ all: true })
    expect(res.status).toBe(200)
    expect(queued).toEqual(expect.arrayContaining(['TDA', 'TDB']))
    expect(queued).not.toContain('TDC')
    expect(res.body.queued).toBe(queued.length)
    expect(res.body.skipped).toBeGreaterThanOrEqual(1)
  })

  it('tickers: only the chosen symbols', async () => {
    queued.length = 0
    const res = await request(app).post('/api/backfill/today').send({ tickers: ['tdb'] })
    expect(res.body).toMatchObject({ ok: true, queued: 1, skipped: 0 })
    expect(queued).toEqual(['TDB'])
  })

  it('ticker: one symbol, as before; a symbol without a broker is refused', async () => {
    queued.length = 0
    expect((await request(app).post('/api/backfill/today').send({ ticker: 'TDA' })).body.ticker).toBe('TDA')
    expect(queued).toEqual(['TDA'])
    const orphan = await request(app).post('/api/backfill/today').send({ ticker: 'TDC' })
    expect(orphan.status).toBe(400)
    expect((await request(app).post('/api/backfill/today').send({})).status).toBe(400)
  })
})
