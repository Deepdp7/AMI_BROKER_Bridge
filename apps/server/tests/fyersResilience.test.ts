/**
 * The Fyers live feed and history download recovering from network trouble (Stage 1):
 *  - it keeps reconnecting however long the outage lasts (it used to stop after 10 tries, ~6 min)
 *  - a silent socket is noticed in 30-60 s, not 5-6 min
 *  - a drop is reported once, so the catch-up for the missed minutes runs after the feed is back
 *  - a history answer whose body stalls is given up on (the deadline used to end with the headers)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { WebSocketServer } from 'ws'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-fyers-resilience-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'resilience.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

// Whether it is trading time is the calendar's answer: the tests set it
const session = vi.hoisted(() => ({ open: true }))
vi.mock('../src/market/MarketCalendar', async (orig) => ({ ...(await orig<any>()), isMarketSession: () => session.open }))

// A taken login: first field "K" (captured from Fyers, see fyersAuth.test.ts)
const TAKEN = Buffer.from('000a01020100014b02000400000000', 'hex')
const REFUSED = Buffer.from('0021010201001561757468656e7469636174696f6e206661696c656402000400000000', 'hex')

/** "APPID:header.payload.signature": the client reads hsm_key and exp from the payload */
function token(expSecFromNow = 3600): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `APPID:${b64({ alg: 'HS256' })}.${b64({ hsm_key: 'hsm-key', exp: Math.floor(Date.now() / 1000) + expSecFromNow })}.sig`
}

const fakeSocket = () => ({ readyState: 1, send() {}, ping() {}, removeAllListeners() {}, close() {}, terminate: vi.fn() })

const clients: any[] = []
async function newClient(opts?: { url?: string }) {
  const { FyersHSMClient } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
  const c: any = new FyersHSMClient(token(), opts)
  clients.push(c)
  return c
}
afterEach(() => {
  for (const c of clients.splice(0)) { c.disconnect(); clearInterval(c.statsTimer) }
  vi.useRealTimers()
  vi.restoreAllMocks()
  session.open = true
})

describe('reconnecting', () => {
  it('the wait grows from 5 s to a 30 s ceiling and is spread +-20%', async () => {
    const { reconnectDelayMs } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    expect(reconnectDelayMs(1, 0.5)).toBe(5000)
    expect(reconnectDelayMs(2, 0.5)).toBe(7500)
    expect(reconnectDelayMs(50, 0.5)).toBe(30_000)
    expect(reconnectDelayMs(1, 0)).toBe(4000)
    expect(reconnectDelayMs(1, 1)).toBeCloseTo(6000, 6)
    expect(reconnectDelayMs(50, 1)).toBeCloseTo(36_000, 6)
  })

  it('never gives up: the 15th attempt is made as surely as the 1st', async () => {
    vi.useFakeTimers()
    const client = await newClient()
    const connect = vi.spyOn(client, 'connect').mockImplementation(() => {})
    client.activeSubscriptions.add('RELIANCE')
    for (let attempt = 1; attempt <= 15; attempt++) {
      client.triggerReconnect()
      await vi.advanceTimersByTimeAsync(36_001)   // longer than any wait
      expect(connect).toHaveBeenCalledTimes(attempt)
    }
  })

  it('a symbol added while the socket is down starts a connection, but not while one is already on its way', async () => {
    const client = await newClient()
    const connect = vi.spyOn(client, 'connect').mockImplementation(() => {})
    client.setSymbolMapping('TCS', 'sf|nse_cm|11536')

    client.ws = { ...fakeSocket(), readyState: 3 } // a closed socket is still held (the close handler leaves it)
    client.subscribe(['TCS'])
    expect(connect).toHaveBeenCalledTimes(1)

    client.reconnectTimer = setTimeout(() => {}, 60_000)   // a reconnect is already scheduled
    client.subscribe(['TCS'])
    expect(connect).toHaveBeenCalledTimes(1)
    clearTimeout(client.reconnectTimer); client.reconnectTimer = null

    client.ws = fakeSocket()                       // open, login pending
    client.subscribe(['TCS'])
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('a taken login, not an open socket, ends the backoff', async () => {
    const client = await newClient()
    client.reconnectAttempts = 7
    client.ws = fakeSocket()
    client.parseBinaryMessage(TAKEN)
    expect(client.reconnectAttempts).toBe(0)
  })
})

describe('a silent socket', () => {
  it('limits: 30 s once pings are answered; otherwise 60 s in the session and 5 min outside it', async () => {
    const { silenceLimitMs } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    expect(silenceLimitMs(true, true)).toBe(30_000)
    expect(silenceLimitMs(true, false)).toBe(30_000)
    expect(silenceLimitMs(false, true)).toBe(60_000)
    expect(silenceLimitMs(false, false)).toBe(300_000)
  })

  async function silentClient(silentForMs: number, opts: { pong?: boolean; pongAgoMs?: number } = {}) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T05:00:00Z'))
    const client = await newClient()
    vi.spyOn(client, 'connect').mockImplementation(() => {})
    const sock = fakeSocket()
    client.ws = sock
    client.authenticated = true
    client.dropReported = false
    client.activeSubscriptions.add('RELIANCE')
    client.lastMessageTime = Date.now() - silentForMs
    if (opts.pong) { client.pongSeen = true; client.lastPongAt = Date.now() - (opts.pongAgoMs ?? silentForMs) }
    return { client, sock }
  }

  it('in the session, without ping answers: alive at 59 s, dead at 61 s', async () => {
    const alive = await silentClient(59_000)
    expect(alive.client.checkSocketAlive()).toBe(false)
    expect(alive.sock.terminate).not.toHaveBeenCalled()

    const { client, sock } = await silentClient(61_000)
    const drops: number[] = []
    client.on('disconnected', () => drops.push(1))
    expect(client.checkSocketAlive()).toBe(true)
    expect(sock.terminate).toHaveBeenCalledTimes(1)
    expect(client.ws).toBeNull()
    expect(client.authenticated).toBe(false)
    expect(client.pendingSubscriptions.has('RELIANCE')).toBe(true)   // asked for again after the reconnect
    expect(client.reconnectTimer).not.toBeNull()
    expect(drops).toHaveLength(1)
  })

  it('outside the session, a quiet minute is normal: dead only after 5 minutes', async () => {
    session.open = false
    expect((await silentClient(120_000)).client.checkSocketAlive()).toBe(false)
    expect((await silentClient(301_000)).client.checkSocketAlive()).toBe(true)
  })

  it('once Fyers answers pings, 30 s without an answer or a message is dead; a recent answer keeps it alive without data', async () => {
    const alive = await silentClient(200_000, { pong: true, pongAgoMs: 10_000 })
    expect(alive.client.checkSocketAlive()).toBe(false)
    expect((await silentClient(40_000, { pong: true })).client.checkSocketAlive()).toBe(true)
  })

  it('does nothing while no login is taken', async () => {
    const { client, sock } = await silentClient(600_000)
    client.authenticated = false
    expect(client.checkSocketAlive()).toBe(false)
    expect(sock.terminate).not.toHaveBeenCalled()
  })
})

describe('a login that is never answered', () => {
  it('the socket is closed after 30 s and the next attempt is scheduled (it used to hang until a restart)', async () => {
    const server = new WebSocketServer({ port: 0 })                        // opens the socket, answers nothing
    await new Promise<void>(r => server.once('listening', () => r()))
    const client = await newClient({ url: `ws://127.0.0.1:${(server.address() as any).port}` })
    client.setSymbolMapping('TCS', 'sf|nse_cm|11536')
    client.activeSubscriptions.add('TCS')
    client.connect()
    await vi.waitFor(() => expect(client.ws?.readyState).toBe(1), { timeout: 3000 })

    client.checkSocketAlive(Date.now() + 29_000)
    expect(client.ws.readyState).toBe(1)                                   // still has time
    client.checkSocketAlive(Date.now() + 31_000)
    await vi.waitFor(() => expect(client.reconnectTimer).not.toBeNull(), { timeout: 3000 })
    expect(client.isConnecting).toBe(false)                                // the next connect() is not refused
    client.disconnect()
    for (const ws of server.clients) ws.terminate()
    await new Promise<void>(r => server.close(() => r()))
  })

  it('a handshake that hangs is given up the same way, without an unhandled error', async () => {
    const net = await import('net')
    const held: any[] = []
    const server = net.createServer(s => { held.push(s); s.on('error', () => {}) })   // takes the connection, never upgrades it
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
    const client = await newClient({ url: `ws://127.0.0.1:${(server.address() as any).port}` })
    client.activeSubscriptions.add('TCS')
    client.connect()
    await vi.waitFor(() => expect(held.length).toBe(1), { timeout: 3000 })
    expect(client.ws.readyState).toBe(0)
    client.checkSocketAlive(Date.now() + 31_000)
    await vi.waitFor(() => expect(client.reconnectTimer).not.toBeNull(), { timeout: 3000 })
    expect(client.isConnecting).toBe(false)

    // Logging out in the middle of a handshake leaves no error behind either
    clearTimeout(client.reconnectTimer); client.reconnectTimer = null
    client.connect()
    client.disconnect()
    await new Promise(r => setTimeout(r, 50))
    for (const s of held) s.destroy()
    await new Promise<void>(r => server.close(() => r()))
  })
})

describe("reporting the drop (the catch-up for the missed minutes depends on it)", () => {
  it('a real socket: connected, then disconnected exactly once when the server goes away', async () => {
    const server = new WebSocketServer({ port: 0 })
    server.on('connection', ws => ws.on('message', () => ws.send(TAKEN)))   // takes any login
    await new Promise<void>(r => server.once('listening', () => r()))
    const client = await newClient({ url: `ws://127.0.0.1:${(server.address() as any).port}` })
    const events: string[] = []
    client.on('connected', () => events.push('connected'))
    client.on('disconnected', () => events.push('disconnected'))
    client.setSymbolMapping('TCS', 'sf|nse_cm|11536')
    client.activeSubscriptions.add('TCS')

    client.connect()
    await vi.waitFor(() => expect(events).toEqual(['connected']), { timeout: 3000 })

    for (const ws of server.clients) ws.terminate()                       // the network drops
    await vi.waitFor(() => expect(events).toEqual(['connected', 'disconnected']), { timeout: 3000 })
    await new Promise(r => setTimeout(r, 100))
    expect(events).toEqual(['connected', 'disconnected'])                 // not twice
    client.disconnect()
    await new Promise<void>(r => server.close(() => r()))
  })

  it('a feed that was never up reports nothing; a login refused after it was up does', async () => {
    const client = await newClient()
    const drops: number[] = []
    client.on('disconnected', () => drops.push(1))
    vi.spyOn(client, 'connect').mockImplementation(() => {})

    client.ws = fakeSocket(); client.parseBinaryMessage(REFUSED)   // refused before any success
    expect(drops).toHaveLength(0)

    client.ws = fakeSocket(); client.parseBinaryMessage(TAKEN)     // up
    client.ws = fakeSocket(); client.parseBinaryMessage(REFUSED)   // then refused
    expect(drops).toHaveLength(1)
  })

  it('the adapter turns it into a DISCONNECTED state, and the lifecycle then catches up 150 s after the feed returns', async () => {
    const { FyersHSMClient } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    vi.spyOn(FyersHSMClient.prototype, 'connect').mockImplementation(() => {})
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const adapter: any = new FyersAdapter()
    const states: string[] = []
    adapter.on('connection_state', (s: string) => states.push(s))
    await adapter.connect({ apiKey: 'APP-100', apiSecret: '', accessToken: token() })
    clients.push(adapter.hsmClient)
    adapter.hsmClient.emit('connected')
    adapter.hsmClient.emit('disconnected')
    expect(states).toEqual(['CONNECTED', 'DISCONNECTED'])
    await adapter.disconnect()

    vi.useFakeTimers()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { startPeriodicCatchUp } = await import('../src/brokers/BrokerLifecycle')
    const { brokerManager } = await import('../src/brokers/BrokerManager')
    startPeriodicCatchUp()
    brokerManager.emit('broker_status', { brokerId: 'fyers-x', status: 'disconnected' })
    brokerManager.emit('broker_status', { brokerId: 'fyers-x', status: 'connected' })
    await vi.advanceTimersByTimeAsync(149_000)
    expect(log.mock.calls.some(c => String(c[0]).includes('live feed is back'))).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(log.mock.calls.some(c => String(c[0]).includes('fyers-x: live feed is back'))).toBe(true)
  })
})

describe('a history download whose body stalls', () => {
  it('is given up after 60 s (the deadline covers the body, not only the headers)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: { signal: AbortSignal }) => Promise.resolve({
      status: 200,
      statusText: 'OK',
      // The headers came; the body never does (until the request is aborted)
      text: () => new Promise((_resolve, reject) =>
        init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')))),
    })))
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const a: any = new FyersAdapter()
    Object.assign(a, { accessToken: 'tok', appId: 'APP-100' })

    let outcome: any = 'pending'
    a.getHistoricalBars('NSE:TCS-EQ', '1m', new Date(Date.now() - 86_400_000), new Date()).then(
      (v: any) => { outcome = v }, (e: any) => { outcome = e })
    await vi.advanceTimersByTimeAsync(59_000)
    expect(outcome).toBe('pending')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(outcome).toBeInstanceOf(Error)
    expect(outcome.name).toBe('AbortError')                   // the download queue retries it
    expect(String(outcome.message)).toContain('timeout fetching history')
    vi.unstubAllGlobals()
  })
})
