/**
 * Stage 8d: a broker's token dies while the engine runs (Fyers: 06:00 IST every day). The adapter reports it
 * (auth_failed), the engine drops the adapter (so downloads wait instead of failing), marks the broker "auth required"
 * and opens the login page once, however many times the dead token is reported. The daily re-login at 08:50 IST
 * (a separate path) still opens its page.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'

// The login page is opened with `start "" "<url>"`: never run here
const exec = vi.hoisted(() => vi.fn((_cmd: string, cb?: (err: Error | null) => void) => { cb?.(null) }))
vi.mock('child_process', async orig => ({ ...(await orig<typeof import('child_process')>()), exec }))

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-expiry-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'expiry.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let db: typeof import('../src/db')
let manager: any
let lifecycle: typeof import('../src/brokers/BrokerLifecycle')
let daily: typeof import('../src/brokers/DailyReloginService')
let BROKERS: typeof import('../src/brokers/brokerAuth').BROKERS

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

class FakeFyers extends EventEmitter {
  disconnected = false
  async connect() { return { accessToken: 'live-token', accountId: 'AC1' } }
  async disconnect() { this.disconnected = true }
  async subscribe() {}
  async unsubscribe() {}
}

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  manager = (await import('../src/brokers/BrokerManager')).brokerManager
  lifecycle = await import('../src/brokers/BrokerLifecycle')
  daily = await import('../src/brokers/DailyReloginService')
  BROKERS = (await import('../src/brokers/brokerAuth')).BROKERS
  const { wireEngineEvents } = await import('../src/startup')
  wireEngineEvents()                                         // listens for auth_required: opens the login page

  db.stmts.insertBroker.run({ id: 'fy-exp', broker_type: 'fyers', label: 'Fyers', credential_ref: 'x', status: 'connected', health_score: 100, reconnect_count_1h: 0, account_id: 'AC1', created_at: 1, last_connected_at: 1 })
  db.stmts.upsertCredentials.run('fy-exp', { apiKey: 'APPID-100', apiSecret: 'secret', accessToken: '' })
})
afterAll(() => { vi.restoreAllMocks(); try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })
afterEach(() => { vi.useRealTimers() })

describe('the token dies while the engine runs', () => {
  it('drops the adapter, marks the broker "auth required" and opens the login page once, however often it is reported', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fake = new FakeFyers()
    vi.spyOn(BROKERS.fyers, 'create').mockReturnValue(fake as any)
    await manager.connectBroker('fy-exp', 'fyers', { apiKey: 'APPID-100', apiSecret: 'secret', accessToken: 'live-token' })
    expect(manager.getAdapter('fy-exp')).toBe(fake)

    const required: string[] = []
    manager.on('auth_required', (id: string) => required.push(id))
    exec.mockClear()

    // The expiry timer and the live feed's own refusal can both report the dead token
    fake.emit('auth_failed')
    fake.emit('auth_failed')
    await vi.waitFor(() => expect(exec).toHaveBeenCalledTimes(1), { timeout: 3000 })
    await sleep(200)

    expect(exec).toHaveBeenCalledTimes(1)                                    // one login page
    expect(String(exec.mock.calls[0][0])).toMatch(/^start "" "https?:\/\/[^"]*fyers/i)
    expect(required).toEqual(['fy-exp'])                                      // announced once
    expect(manager.getAdapter('fy-exp')).toBeUndefined()                      // downloads wait for the next login
    expect(fake.disconnected).toBe(true)
    expect((db.stmts.getBrokerById.get('fy-exp') as any).status).toBe('auth_required')

    // A later report within a few minutes does not open a second page (two pages make two codes, and the older fails)
    expect(lifecycle.openBrokerLogin('fy-exp', 'again')).toBe(false)
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('a report from an adapter that is no longer the live one is ignored', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const old = new FakeFyers(), current = new FakeFyers()
    const create = vi.spyOn(BROKERS.fyers, 'create')
    create.mockReturnValueOnce(old as any)
    await manager.connectBroker('fy-exp', 'fyers', { apiKey: 'APPID-100', apiSecret: 'secret', accessToken: 'a' })
    create.mockReturnValueOnce(current as any)
    await manager.connectBroker('fy-exp', 'fyers', { apiKey: 'APPID-100', apiSecret: 'secret', accessToken: 'b' })   // logged in again
    exec.mockClear()
    old.emit('auth_failed')                                                   // the first session's token dying late
    await sleep(200)
    expect(manager.getAdapter('fy-exp')).toBe(current)                        // the new session is not dropped
    expect(exec).not.toHaveBeenCalled()
    await manager.disconnectBroker('fy-exp')
  })
})

describe('the daily re-login', () => {
  it('opens the login page at the set time (08:50 IST), once for the day', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    db.upsertSettings({ dailyReloginEnabled: true, dailyReloginTime: '08:50' })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T08:50:20+05:30'))
    exec.mockClear()

    daily.startDailyReloginScheduler()                                       // checks at once
    await vi.waitFor(() => expect(exec).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(String(exec.mock.calls[0][0])).toMatch(/^start "" "https?:\/\/[^"]*fyers/i)
    expect((db.stmts.getBrokerById.get('fy-exp') as any).status).toBe('auth_required')   // so the callback accepts the code

    // Checked again in the same minute (a restart of the scheduler): not again
    daily.stopDailyReloginScheduler()
    daily.startDailyReloginScheduler()
    await sleep(200)
    expect(exec).toHaveBeenCalledTimes(1)
    daily.stopDailyReloginScheduler()
  })
})
