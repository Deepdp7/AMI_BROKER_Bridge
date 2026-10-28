import { describe, it, expect } from 'vitest'
import { buildActivity } from './activity'
import type { ConsoleLine } from '../api/apiClient'

let seq = 0
const T0 = Date.UTC(2026, 9, 27, 10, 0, 0)
const line = (text: string, minutes = 0, level: ConsoleLine['level'] = 'log'): ConsoleLine => ({ seq: ++seq, ts: T0 + minutes * 60_000, level, text })

describe('Activity: engine lines in plain language', () => {
  it('hides noise: ticks, request logs, internal bookkeeping, startup lines', () => {
    const events = buildActivity([
      line('[HSM_SUB_BATCH] batch=1 symbols=50 bytes=759'),
      line('[HSM_SUB_SEND] count=50 firstToken=sf|nse_cm|26000 lastToken=sf|nse_cm|3351 packetBytes=770'),
      line('[HSM_SUB_ACK] received status=ACK'),
      line('[System Status] Total Symbols Active: 100 | Receiving Live Ticks: 100'),
      line('{"ts":"2026-10-27T19:07:55.982Z","method":"GET","path":"/api/brokers","ip":"127.0.0.1"}'),
      line('[INFO] [LiveFeed] Symbol added: NIFTY (NSE)'),
      line('[Live Tick] 2026-10-27 10:00:00 | NIFTY | ₹ 22000.00 | Vol: 5'),
      line('[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|M&M|1793096940|2858.4|2858.4|2858.4|2858.4|0'),
      line('[FYERS_HSM_CONNECT] Disconnected. Scheduling reconnect...'),
      line('[BackfillQueue] Fetching ACC (NSE:ACC-EQ) [1 in queue] from 2026-01-15 to 2026-04-20...'),
      line('◇ injected env (5) from .env', 0, 'error'), // marked as an error by the engine, but harmless
      line('[Secrets] Broker credentials are encrypted (Windows DPAPI)'),
    ])
    expect(events).toEqual([])
  })

  it('describes a normal start in plain words', () => {
    const events = buildActivity([
      line('[IPC] AmiBroker TCP Server listening on 127.0.0.1:7891'),
      line('[Init] Auto-connecting broker fyers-94a80a32...'),
      line('[Broker] fyers-94a80a32: subscribed 502 symbols for live ticks', 1),
      line('[FYERS_HSM_AUTH] Auth successful.', 1),
      line('[CatchUp] fyers-94a80a32: 0 symbol(s) with missing bars queued, 0 full download(s), 502 up to date (0.2s)', 1),
    ])
    expect(events.map(e => e.title)).toEqual([
      'DataBridge Pro started',
      'Logging in to your broker',
      'Live prices started for 502 symbols',
      'Connected to the live price feed',
      'Your history is up to date',
    ])
    expect(events.at(-1)!.tone).toBe('good')
  })

  it('merges a stream of downloads into one event with a running total', () => {
    const events = buildActivity([
      line('[BackfillQueue] Saved 375 bars for BANKEX (2026-10-26 to 2026-10-26)', 0),
      line('[BackfillQueue] Gap-fill for BANKEX completed successfully!', 0),
      line('[BackfillQueue] Saved 375 bars for SENSEX (2026-10-26 to 2026-10-26)', 1),
      line('[BackfillQueue] Saved 21000 bars for ONGC (2025-10-25 to 2026-01-13)', 2),
      line('[BackfillQueue] Saved 100 bars for ONGC (2026-01-13 to 2026-04-20)', 3),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Downloaded history for 3 symbols')
    expect(events[0].detail).toBe('21,850 bars saved · latest: ONGC')
    expect(events[0].count).toBe(1) // the title carries the totals, so no "×4" counter
    expect(events[0].ts).toBe(T0 + 3 * 60_000)
  })

  it('a long gap starts a new event instead of merging', () => {
    const events = buildActivity([
      line('[BackfillQueue] Saved 375 bars for A (2026-10-26 to 2026-10-26)', 0),
      line('[BackfillQueue] Saved 375 bars for B (2026-10-26 to 2026-10-26)', 60),
    ])
    expect(events.map(e => e.title)).toEqual(['Downloaded history for 1 symbol', 'Downloaded history for 1 symbol'])
  })

  it("explains the broker's rate limit as nothing to worry about", () => {
    const events = buildActivity([
      line("[FyersAdapter] Rate limit reached for NSE:TMPV-EQ (-360 You've reached the Standard plan limit of 5 requests/second. Upgrade to Prime for higher API limits.): pausing, now 16 requests/min", 0, 'warn'),
      line('[BackfillQueue] Rate limit / timeout for TMPV. Retrying (#1)', 0, 'warn'),
      line("[FyersAdapter] Rate limit reached for NSE:LT-EQ (-360 You've reached the Standard plan limit): pausing, now 16 requests/min", 1, 'warn'),
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ tone: 'warn', title: 'Your broker is slowing downloads down', count: 3 })
    expect(events[0].detail).toMatch(/nothing for you to do/)
    expect(JSON.stringify(events[0])).not.toMatch(/-360|Prime|TMPV/) // no technical text leaks
  })

  it('an expired login points to Broker Connection; a stopped queue is an error', () => {
    const events = buildActivity([
      line('[FyersAdapter] Access token expired', 0),
      line('[BackfillQueue] Token permanently invalid (5 auth errors). Queue stopped. Re-authenticate to resume.', 1, 'error'),
    ])
    expect(events[0]).toMatchObject({ tone: 'warn', title: 'Your broker login has expired', fix: 'broker' })
    expect(events[1]).toMatchObject({ tone: 'bad', title: 'History downloads stopped: login needed', fix: 'broker' })
  })

  it('logging in again marks the earlier login problems as fixed (no button, not "needs attention")', () => {
    // What a 7:00 start with yesterday's Fyers token looks like, then a login at 7:05
    const events = buildActivity([
      line('[Init] Auto-connecting broker fyers-94a80a32...', 0),
      line('[ERROR] [BrokerManager] Failed to connect broker fyers-94a80a32: Token expired — log in to Fyers again', 0, 'error'),
      line('[Init] Failed to auto-connect broker fyers-94a80a32: Token expired — log in to Fyers again', 0, 'error'),
      line('[Auth] Token expired for fyers-94a80a32. Opening Fyers login in the browser...', 0),
      line('[Broker] fyers-94a80a32: connected and ready', 5),
      line('[Broker] fyers-94a80a32: subscribed 502 symbols for live ticks', 5),
    ])
    expect(events.map(e => e.title)).toEqual([
      'Logging in to your broker',
      "Couldn't connect to your broker", // the BrokerManager and Init lines are one event
      'Your broker login has expired',
      'Connected to your broker',
      'Live prices started for 502 symbols',
    ])
    for (const e of events.slice(1, 3)) {
      expect(e.fixedAt).toBe(T0 + 5 * 60_000)
      expect(e.fixedBy).toBe('Your broker is connected again')
      expect(e.fix).toBeUndefined()
    }
  })

  it('a login problem after the fix is a new, open problem', () => {
    const events = buildActivity([
      line('[FyersAdapter] Access token expired', 0),
      line('[Broker] fyers-1: connected and ready', 1),
      line('[FyersAdapter] Access token expired', 2),
    ])
    expect(events).toHaveLength(3)
    expect(events[0].fixedAt).toBeDefined()
    expect(events[2]).toMatchObject({ title: 'Your broker login has expired', fix: 'broker', count: 1 })
    expect(events[2].fixedAt).toBeUndefined()
  })

  it("reports the download card's Pause, Resume and Cancel", () => {
    const events = buildActivity([
      line('[BackfillQueue] Paused by the user (433 queued)', 0),
      line('[BackfillQueue] Resumed by the user (433 queued)', 1),
      line('[BackfillQueue] Cancelled 433 queued download(s)', 2),
      line('[BackfillQueue] History downloads allowed again for 432 symbol(s)', 3),
    ])
    expect(events.map(e => e.title)).toEqual(['Downloads paused', 'Downloads resumed', 'Downloads cancelled', 'History downloads turned back on'])
    expect(events[2].detail).toMatch(/Download now in Symbol Setup/)
  })

  it('shows symbols added, merged', () => {
    const events = buildActivity([
      line('[ADD_SYMBOL] "ACC" backfill queued (365 days).', 0),
      line('[ADD_SYMBOL] "ACE" backfill queued (365 days).', 0),
      line('[IPC_AUTO_REG] "TCS" → "NSE:TCS-EQ" registered, subscribed, backfill queued.', 1),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Added 3 symbols')
  })

  it('catch-up lists what it found and what you cancelled', () => {
    const [e] = buildActivity([line('[CatchUp] fyers-1: 3 symbol(s) with missing bars queued, 2 full download(s), 70 up to date, 432 cancelled by the user (0.0s)')])
    expect(e.title).toBe('Checked your history')
    expect(e.detail).toBe('3 symbols with missing bars · 2 symbols new to download · 70 symbols up to date · 432 symbols skipped (you cancelled their history)')
  })

  it('learns a holiday in words', () => {
    const [e] = buildActivity([line('[MarketCalendar] Learned NSE closed day 2027-01-26 (no trading in AAA, BBB)')])
    expect(e.title).toBe('Market holiday learned')
    expect(e.detail).toMatch(/NSE was closed on .*2027/)
  })

  it('an unrecognised error still shows, in plain framing, with the original text as detail', () => {
    const events = buildActivity([
      line('[Server Error] Something odd: ECONNRESET', 0, 'error'),
      line('[Server Error] Something odd: ECONNRESET', 0.5, 'error'),
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ tone: 'bad', title: 'Something went wrong', count: 2 })
    expect(events[0].detail).toContain('ECONNRESET')
    expect(events[0].detail).not.toContain('[Server Error]')
    expect(events[0].detail).toContain('Technical tab')
  })

  it('an unrecognised ordinary line is ignored', () => {
    expect(buildActivity([line('[Whatever] some new log line nobody wrote a sentence for')])).toEqual([])
  })
})
