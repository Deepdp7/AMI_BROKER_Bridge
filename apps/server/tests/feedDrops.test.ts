/**
 * Every live feed tells the engine when it drops and when it is back (the adapter turns that into
 * connection_state DISCONNECTED / CONNECTED, and the lifecycle looks for the minutes the feed missed 150 s
 * after it is back). This drives the feeds of Dhan, Kite, Angel One and Upstox through an outage with a socket
 * that can be opened and dropped by hand: one DISCONNECTED for the outage however many times it fails to come
 * back, one CONNECTED when it does, and the next outage is reported again.
 *
 * (Noren, XTS and Kotak guard the same way with "was it up" flags: Fyers is tested in fyersResilience.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

const ws = vi.hoisted(() => {
  const { EventEmitter } = require('events') as typeof import('events')
  class FakeWS extends EventEmitter {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static all: FakeWS[] = []
    readyState = 0
    sent: unknown[] = []
    constructor(public url: string, public opts?: unknown) { super(); FakeWS.all.push(this) }
    send(m: unknown) { this.sent.push(m) }
    ping() {}
    pong() {}
    /** The server accepted the connection */
    accept() { this.readyState = 1; this.emit('open') }
    /** The connection is gone (the server closed it, the network dropped, or an attempt failed) */
    drop() { this.readyState = 3; this.emit('close') }
    terminate() { this.drop() }
    close() { this.drop() }
  }
  return { FakeWS }
})
vi.mock('ws', () => ({ default: ws.FakeWS, WebSocket: ws.FakeWS }))

import { DhanFeed } from '../src/brokers/adapters/dhan/DhanFeed'
import { KiteTicker } from '../src/brokers/adapters/kite/KiteTicker'
import { AngelFeed } from '../src/brokers/adapters/angel/AngelFeed'
import { UpstoxFeed } from '../src/brokers/adapters/upstox/UpstoxFeed'

const feeds: Array<{ name: string; make: () => EventEmitter & { connect(): unknown; disconnect(): void } }> = [
  { name: 'Dhan', make: () => new DhanFeed('token', 'client') as any },
  { name: 'Kite', make: () => new KiteTicker('key', 'token') as any },
  { name: 'Angel One', make: () => new AngelFeed({ jwt: 'j', apiKey: 'k', clientCode: 'c', feedToken: 'f' } as any) as any },
  { name: 'Upstox', make: () => new UpstoxFeed('token') as any },
]

beforeEach(() => {
  ws.FakeWS.all.length = 0
  vi.useFakeTimers()
  // Upstox asks for the address of its feed first
  vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ data: { authorized_redirect_uri: 'wss://feed.example/stream' } }) })))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

/** The socket the feed opened last, once it has opened one */
async function lastSocket(): Promise<InstanceType<typeof ws.FakeWS>> {
  await vi.advanceTimersByTimeAsync(0)
  return ws.FakeWS.all[ws.FakeWS.all.length - 1]
}

describe.each(feeds)('$name feed', ({ make }) => {
  it('reports an outage once, however many times it fails to come back, and the recovery', async () => {
    const feed = make()
    const events: string[] = []
    feed.on('connected', () => events.push('connected'))
    feed.on('disconnected', () => events.push('disconnected'))

    feed.connect()
    let sock = await lastSocket()
    sock.accept()
    expect(events).toEqual(['connected'])

    // The network drops. Three attempts to get back fail (the socket closes without ever opening).
    sock.drop()
    expect(events).toEqual(['connected', 'disconnected'])
    for (let attempt = 0; attempt < 3; attempt++) {
      await vi.advanceTimersByTimeAsync(70_000)            // the reconnect timer (at most 60 s)
      const before = ws.FakeWS.all.length
      sock = await lastSocket()
      expect(ws.FakeWS.all.length).toBeGreaterThanOrEqual(before)
      sock.drop()
    }
    expect(events).toEqual(['connected', 'disconnected'])    // still the one report

    // It is back
    await vi.advanceTimersByTimeAsync(70_000)
    sock = await lastSocket()
    sock.accept()
    expect(events).toEqual(['connected', 'disconnected', 'connected'])

    // The next outage is a new one
    sock.drop()
    expect(events).toEqual(['connected', 'disconnected', 'connected', 'disconnected'])
    feed.disconnect()
  })

  it('a feed that never came up reports its first failed attempt, once', async () => {
    const feed = make()
    const events: string[] = []
    feed.on('disconnected', () => events.push('disconnected'))
    feed.connect()
    for (let attempt = 0; attempt < 4; attempt++) {
      const sock = await lastSocket()
      sock.drop()
      await vi.advanceTimersByTimeAsync(70_000)
    }
    expect(events).toEqual(['disconnected'])
    feed.disconnect()
  })
})
