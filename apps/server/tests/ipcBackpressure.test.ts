/**
 * The channel to the AmiBroker plugin when the plugin stops reading (AmiBroker suspended, a debugger on it):
 * what waits to be sent is held per symbol and minute, so memory stays bounded, and when the plugin reads
 * again it gets the newest state of every minute: nothing is lost, because the plugin keeps only the newest
 * state of a minute anyway. A client that takes nothing for a minute is disconnected (it reconnects and
 * fetches what it missed over HTTP).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-ipcbp-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'ipcbp.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

vi.mock('../src/config', async (orig) => ({ ...(await orig<any>()), AMIBROKER_IPC_PORT: 17893 }))
vi.mock('../src/amibroker/symbolDetails', () => ({ startSymbolDetailsSync() {}, schedulePush() {} }))

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const MINUTE0 = 1_788_000_000_000   // ms, a whole number of minutes

async function startEngineSide() {
  const { startAmiBrokerIpc } = await import('../src/amibroker/ipcServer')
  const { liveFeed } = await import('../src/market/liveFeed')
  const { perf } = await import('../src/system/perf')
  const server = startAmiBrokerIpc()
  await new Promise<void>(r => server.listening ? r() : server.once('listening', () => r()))
  return { server, liveFeed, perf }
}

async function connectClient() {
  const client = net.connect(17893, '127.0.0.1')
  await new Promise<void>(r => client.once('connect', () => r()))
  await sleep(50)
  return client
}

const bar = (minute: number, close: number) => ({ open: 1, high: close, low: 1, close, volume: 1, bucketMs: MINUTE0 + minute * 60_000 })

afterEach(() => { vi.useRealTimers() })

describe('a plugin that stops reading', () => {
  it('holds only the newest state per symbol and minute, and delivers every minute\'s last state when it reads again', async () => {
    const { server, liveFeed, perf } = await startEngineSide()
    const client = await connectClient()
    client.pause()                                    // the plugin stops reading

    const TICKERS = 3000, MINUTES = 14
    const expected = new Map<string, number>()        // "ticker|minuteSec" -> the last close sent
    let highest = 0
    for (let m = 0; m < MINUTES; m++) {
      for (let i = 0; i < TICKERS; i++) {
        const ticker = `T${String(i).padStart(4, '0')}`
        // two updates of the minute: only the second may be what is finally seen
        liveFeed.emit('live_bar_updated', { ticker, bar: bar(m, 10 + i) })
        liveFeed.emit('live_bar_updated', { ticker, bar: bar(m, 100 + m * 10_000 + i) })
        expected.set(`${ticker}|${(MINUTE0 + m * 60_000) / 1000}`, 100 + m * 10_000 + i)
      }
      await new Promise(r => setImmediate(r))
      await sleep(10)
      const probe: any = perf.probeResults().ipc
      highest = Math.max(highest, probe.writableLength[0] ?? 0)
    }

    const probe: any = perf.probeResults().ipc
    expect(perf.snapshot().sinceStart.counters['ipc.congestions']).toBeGreaterThanOrEqual(1)   // it did back up
    expect(probe.pendingLive[0]).toBeGreaterThan(0)                                            // and the rest is waiting here, not in the socket
    // A flush is at most one minute's worth (3000 lines, ~190 KB) beyond the limit
    expect(highest).toBeLessThan(1_048_576 + 400_000)

    // The plugin reads again
    let received = ''
    client.on('data', d => { received += d.toString() })
    client.resume()
    await vi.waitFor(async () => {
      const before = received.length
      await sleep(150)
      expect(received.length).toBe(before)            // nothing more is coming
      expect(((perf.probeResults().ipc as any).pendingLive[0])).toBe(0)
    }, { timeout: 15_000, interval: 50 })

    const last = new Map<string, number>()
    for (const line of received.split('\n')) {
      const f = line.split('|')
      if (f[0] === 'LIVE_BAR') last.set(`${f[1]}|${f[2]}`, Number(f[6]))
    }
    expect(last.size).toBe(TICKERS * MINUTES)         // every symbol's every minute arrived
    let wrong = 0
    for (const [key, close] of expected) if (last.get(key) !== close) wrong++
    expect(wrong).toBe(0)                             // each with its newest state

    client.destroy()
    await new Promise<void>(r => server.close(() => r()))
  }, 60_000)
})

describe('a plugin that takes nothing for a minute', () => {
  it('is disconnected, so it reconnects and fetches what it missed', async () => {
    vi.resetModules()
    const { server, liveFeed, perf } = await startEngineSide()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = await connectClient()
    client.pause()
    let closed = false
    client.on('close', () => { closed = true })

    for (let m = 0; m < 12; m++) {                    // enough to back the socket up
      for (let i = 0; i < 3000; i++) liveFeed.emit('live_bar_updated', { ticker: `U${String(i).padStart(4, '0')}`, bar: bar(m, 50 + i) })
      await new Promise(r => setImmediate(r))
      await sleep(10)
    }
    expect(perf.snapshot().sinceStart.counters['ipc.congestions']).toBeGreaterThanOrEqual(1)
    expect(closed).toBe(false)                        // not yet: it has only just stopped

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 61_000)             // a minute later, still unread
    liveFeed.emit('live_bar_updated', { ticker: 'U0000', bar: bar(13, 7) })
    await new Promise(r => setImmediate(r))
    client.resume()
    await vi.waitFor(() => expect(closed).toBe(true), { timeout: 5000 })
    expect(warn.mock.calls.some(c => String(c[0]).includes("has taken nothing for"))).toBe(true)
    expect(perf.snapshot().sinceStart.counters['ipc.gave_up']).toBe(1)
    await new Promise<void>(r => server.close(() => r()))
  }, 60_000)
})

describe('when the updates go out', () => {
  it('by default at the end of the current task; with DATABRIDGE_IPC_FLUSH=immediate in the next turn of the event loop', async () => {
    for (const mode of ['microtask', 'immediate'] as const) {
      vi.resetModules()
      if (mode === 'immediate') process.env.DATABRIDGE_IPC_FLUSH = 'immediate'; else delete process.env.DATABRIDGE_IPC_FLUSH
      const { server, liveFeed, perf } = await startEngineSide()
      const client = await connectClient()
      let received = ''
      client.on('data', d => { received += d.toString() })

      liveFeed.emit('live_bar_updated', { ticker: 'MODE1', bar: bar(0, 5) })
      liveFeed.emit('live_bar_updated', { ticker: 'MODE2', bar: bar(0, 6) })
      await Promise.resolve()                         // one microtask turn
      const pending = (perf.probeResults().ipc as any).pendingLive[0]
      expect(pending, mode).toBe(mode === 'microtask' ? 0 : 2)
      await vi.waitFor(() => expect(received.split('\n').filter(l => l.startsWith('LIVE_BAR|MODE')).length).toBe(2), { timeout: 3000 })

      client.destroy()
      await new Promise<void>(r => server.close(() => r()))
    }
    delete process.env.DATABRIDGE_IPC_FLUSH
  }, 30_000)
})
