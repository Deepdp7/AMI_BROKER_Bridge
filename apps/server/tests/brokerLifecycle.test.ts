/**
 * DataBridge Pro — broker re-login / re-add regression tests
 *
 * Covers the failure where an expired token at startup, then removing and re-adding the
 * broker, left AmiBroker with no symbols, no live ticks and no backfill.
 * Runs against its own SQLite file in a temp home folder — never the user's real data.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-test-'))
// Before any engine module loads: db.ts opens its file once, coverage/backfill state live under the home dir
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'lifecycle.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let lifecycle: typeof import('../src/brokers/BrokerLifecycle')
let fyers: typeof import('../src/brokers/adapters/fyers/FyersAdapter')
let brokerManager: any

const nowSec = () => Math.floor(Date.now() / 1000)
function jwt(expSec: number) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${part({ alg: 'HS256' })}.${part({ exp: expSec, hsm_key: 'k' })}.sig`
}

function addBroker(id: string) {
  db.stmts.insertBroker.run({
    id, broker_type: 'fyers', label: 'Fyers', credential_ref: 'dpapi:test', status: 'auth_required',
    health_score: 100, reconnect_count_1h: 0, account_id: null, created_at: Date.now(), last_connected_at: null,
  })
}

function addSymbol(brokerId: string, ticker: string) {
  db.stmts.insertSymbol.run({
    broker_id: brokerId, instrument_id: `NSE:${ticker}-EQ`, amibroker_ticker: ticker,
    exchange: 'NSE', instrument_type: 'EQ', raw_symbol: `NSE:${ticker}-EQ`, created_at: Date.now(),
  })
}

const ownerOf = (ticker: string) => (db.stmts.getSymbols.all() as any[]).find(s => s.amiBrokerTicker === ticker)?.brokerId

function dbOwners(tickers: string[]): Record<string, string> {
  const rows = db.sqlite.prepare(`SELECT amibroker_ticker, broker_id FROM symbols WHERE amibroker_ticker IN (${tickers.map(() => '?').join(',')})`).all(...tickers) as any[]
  return Object.fromEntries(rows.map(r => [r.amibroker_ticker, r.broker_id]))
}

function fakeAdapter() {
  return {
    maxIntradayHistoryDays: 95,
    on() {},
    subscribe: vi.fn(async (_tokens: string[]) => {}),
    unsubscribe: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    resolveSymbol: async (t: string) => t,
    getHistoricalBars: vi.fn(async (_token: string, _interval: string, _from: Date, _to: Date) => [] as any[]),
  }
}

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  lifecycle = await import('../src/brokers/BrokerLifecycle')
  fyers = await import('../src/brokers/adapters/fyers/FyersAdapter')
  brokerManager = (await import('../src/brokers/BrokerManager')).brokerManager
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Fyers token handling', () => {
  it('detects an expired access token', () => {
    expect(fyers.isFyersTokenExpired(jwt(nowSec() - 3600))).toBe(true)
    expect(fyers.isFyersTokenExpired(`APPID-100:${jwt(nowSec() - 10)}`)).toBe(true)
    expect(fyers.isFyersTokenExpired(jwt(nowSec() + 3600))).toBe(false)
    expect(fyers.isFyersTokenExpired('not-a-jwt')).toBe(false)
  })

  it('an expired saved token fails the connect instead of registering a dead adapter', async () => {
    addBroker('fyers-expired')
    await expect(brokerManager.connectBroker('fyers-expired', 'fyers', {
      apiKey: 'APPID-100', apiSecret: 'secret', accessToken: jwt(nowSec() - 3600),
    })).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(brokerManager.getAdapter('fyers-expired')).toBeUndefined()
    db.stmts.deleteBroker.run('fyers-expired')
  })

  it('reports the token dying while the app runs (06:00 IST), not only at the next start', async () => {
    const adapter: any = new fyers.FyersAdapter()
    adapter.accessToken = jwt(nowSec() + 1)
    const died = new Promise<void>(resolve => adapter.once('auth_failed', resolve))
    adapter.scheduleExpiry()
    await expect(Promise.race([died.then(() => 'expired'), new Promise(r => setTimeout(() => r('timeout'), 3000))])).resolves.toBe('expired')
  })
})

describe('Fyers history errors', () => {
  const adapter = () => Object.assign(new fyers.FyersAdapter(), { accessToken: 'token', appId: 'APPID-100' })
  const from = new Date(Date.now() - 5 * 86400_000), to = new Date()
  const reply = (body: object) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))))

  it('rejects on a broker error instead of returning "no bars"', async () => {
    reply({ s: 'error', code: -300, message: 'Invalid symbol' })
    await expect(adapter().getHistoricalBars('NSE:TCS-EQ', '1m', from, to)).rejects.toMatchObject({ code: -300 })
  })

  it('treats the Standard-plan limit (-360) as a rate limit', async () => {
    reply({ s: 'error', code: -360, message: "You've reached the Standard plan limit of 5 requests/second." })
    await expect(adapter().getHistoricalBars('NSE:TCS-EQ', '1m', from, to)).rejects.toMatchObject({ code: 429 })
  })
})

describe('Removing and re-adding a broker', () => {
  it('keeps the symbol list when the broker is removed', () => {
    addBroker('fyers-old')
    addSymbol('fyers-old', 'ZZTCS')
    addSymbol('fyers-old', 'ZZINFY')
    db.stmts.deleteBroker.run('fyers-old')

    expect(db.stmts.getBrokerById.get('fyers-old')).toBeUndefined()
    expect(ownerOf('ZZTCS')).toBe('orphaned')
    expect(ownerOf('ZZINFY')).toBe('orphaned')
    expect(dbOwners(['ZZTCS', 'ZZINFY'])).toEqual({ ZZTCS: 'orphaned', ZZINFY: 'orphaned' })
  })

  it('the next connected account takes the symbols over, subscribes them and queues the missed history', async () => {
    // ZZTCS has history up to 10 days ago (app was closed since); ZZINFY has none
    const lastBarSec = Math.floor((Date.now() - 10 * 86400_000) / 60_000) * 60
    await db.upsertBarsToHistory('ZZTCS', [0, 60, 120].map(d => `${lastBarSec - 120 + d},100,101,99,100,10`))

    addBroker('fyers-new')
    const fake = fakeAdapter()
    ;(brokerManager as any).activeAdapters.set('fyers-new', fake)
    await lifecycle.activateBroker('fyers-new', 'fyers')

    expect(ownerOf('ZZTCS')).toBe('fyers-new')
    expect(ownerOf('ZZINFY')).toBe('fyers-new')
    expect(dbOwners(['ZZTCS', 'ZZINFY'])).toEqual({ ZZTCS: 'fyers-new', ZZINFY: 'fyers-new' })
    expect(fake.subscribe).toHaveBeenCalledWith(expect.arrayContaining(['NSE:ZZTCS-EQ', 'NSE:ZZINFY-EQ']))

    await vi.waitFor(() => {
      const tokens = fake.getHistoricalBars.mock.calls.map(c => c[0])
      expect(tokens).toContain('NSE:ZZTCS-EQ')
      expect(tokens).toContain('NSE:ZZINFY-EQ')
    }, { timeout: 10_000 })

    // Already-backfilled symbol: only the missed days after its last bar, not a full re-download
    const tcsFrom = fake.getHistoricalBars.mock.calls.find(c => c[0] === 'NSE:ZZTCS-EQ')![2] as Date
    expect(tcsFrom.getTime()).toBeGreaterThanOrEqual((lastBarSec - 60) * 1000)
    // Symbol without history: full download, newest chunk first
    const infyCalls = fake.getHistoricalBars.mock.calls.filter(c => c[0] === 'NSE:ZZINFY-EQ')
    expect((infyCalls[0][3] as Date).getTime()).toBeGreaterThan(Date.now() - 86400_000)
  })

  it('merges an unconnected account of the same broker type into the connected one', async () => {
    addBroker('fyers-stale')
    addSymbol('fyers-stale', 'ZZWIPRO')
    await lifecycle.activateBroker('fyers-new', 'fyers')

    expect(db.stmts.getBrokerById.get('fyers-stale')).toBeUndefined()
    expect(ownerOf('ZZWIPRO')).toBe('fyers-new')
    expect(dbOwners(['ZZWIPRO'])).toEqual({ ZZWIPRO: 'fyers-new' })
  })
})
