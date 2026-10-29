/**
 * Fyers' live feed refusing a login (2026-10-29): it answers with message type 1 whatever the
 * outcome, and the client took that as success, then looped every 6 seconds with no prices.
 * Also: the feed statistics are measured, not made up.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-fyers-auth-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'auth.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

// Captured from Fyers on 2026-10-29 for a token whose REST calls still worked
const REFUSED = Buffer.from('0021010201001561757468656e7469636174696f6e206661696c656402000400000000', 'hex')
// A taken login: first field "K"
const TAKEN = Buffer.from('000a01020100014b02000400000000', 'hex')

afterEach(() => { vi.useRealTimers() })

describe("Fyers' answer to the live-feed login", () => {
  it('reads "authentication failed" as refused and "K" as taken', async () => {
    const { hsmAuthAnswer } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    expect(hsmAuthAnswer(REFUSED)).toEqual({ refused: true, text: 'authentication failed' })
    expect(hsmAuthAnswer(TAKEN)).toEqual({ refused: false, text: 'K' })
    expect(hsmAuthAnswer(Buffer.from('000301', 'hex')).refused).toBe(false)   // too short: not a refusal
  })

  it('a refusal is not "Auth successful": no subscribe; one retry, then it stops and asks for a new login', async () => {
    vi.useFakeTimers()
    const { FyersHSMClient } = await import('../src/brokers/adapters/fyers/FyersHSMClient')
    const client: any = new FyersHSMClient('APPID:x.y.z')
    const logs: string[] = []
    client.on('log_entry', (e: any) => logs.push(e.message))
    let authFailed = 0
    client.on('auth_failed', () => { authFailed++ })
    const connect = vi.spyOn(client, 'connect').mockImplementation(() => {})
    const sent: Buffer[] = []
    const fakeSocket = () => ({ readyState: 1, send: (b: Buffer) => sent.push(b), removeAllListeners() {}, close() {} })
    client.setSymbolMapping('ADANIPORTS', 'sf|nse_cm|15083')
    client.subscribe(['ADANIPORTS'])            // queued until the login is taken (and starts the socket)
    connect.mockClear()

    client.ws = fakeSocket()
    client.parseBinaryMessage(REFUSED)
    expect(client.authenticated).toBe(false)
    expect(sent).toHaveLength(0)                // nothing subscribed on a refused login
    expect(logs.some(l => l.includes('Auth successful'))).toBe(false)
    expect(logs.some(l => l.includes('refused the live price login: "authentication failed"'))).toBe(true)
    expect(authFailed).toBe(0)                  // once may be a hiccup
    await vi.advanceTimersByTimeAsync(6000)
    expect(connect).toHaveBeenCalledTimes(1)    // one more try

    client.ws = fakeSocket()
    client.parseBinaryMessage(REFUSED)
    expect(authFailed).toBe(1)                  // twice: the app shows "log in again"
    await vi.advanceTimersByTimeAsync(120_000)
    expect(connect).toHaveBeenCalledTimes(1)    // and no more reconnecting every 6 seconds

    // A taken login still works as before
    client.ws = fakeSocket()
    client.parseBinaryMessage(TAKEN)
    expect(client.authenticated).toBe(true)
    expect(sent.length).toBeGreaterThan(0)      // the queued symbol is subscribed now
    client.disconnect()
  })
})

describe('feed statistics are measured', () => {
  it('RAM is the process memory, delay is the price age, a symbol without ticks has no "last tick"', async () => {
    const { liveFeed } = await import('../src/market/liveFeed')
    liveFeed.addSymbolByTicker('STATX', 'b-stat', 'NSE', 'EQ', 'NSE:STATX-EQ')
    const before = liveFeed.getFeedStatus('STATX')!
    expect(before.lastTickUtcMs).toBe(0)
    expect(before.internalLatencyMs).toBe(0)

    liveFeed.processRealTick({ instrumentId: 'NSE:STATX-EQ', lastPrice: 100, volume: 1, timestamp: Date.now() - 1500 }, 'b-stat')
    const after = liveFeed.getFeedStatus('STATX')!
    expect(after.internalLatencyMs).toBeGreaterThanOrEqual(1500)
    expect(after.internalLatencyMs).toBeLessThan(3000)

    const a = liveFeed._getCoreStats(), b = liveFeed._getCoreStats()
    const rss = Math.round(process.memoryUsage().rss / 1048576)
    expect(Math.abs(a.ramMb - rss)).toBeLessThan(50)
    expect(a.cpuPercent).toBe(b.cpuPercent)     // no random wobble between two looks
    expect(a.cpuPercent).toBeGreaterThanOrEqual(0)
  })
})
