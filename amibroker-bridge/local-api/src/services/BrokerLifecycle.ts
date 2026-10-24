/**
 * BrokerLifecycle.ts
 *
 * What happens when a broker account becomes usable — a saved token at startup or a fresh
 * OAuth login: it takes over the symbol list, subscribes live ticks, and queues the history
 * catch-up for everything missed while the app was closed or the token was dead.
 *
 * Also owns opening the broker login page, so an expired token opens it once (two tabs
 * produce two auth codes and the older one is rejected as "invalid auth code").
 */
import { exec } from 'child_process'
import { stmts, getAllSettings, getOldestBarTimestampSec, ORPHANED } from '../db'
import { brokerManager } from './BrokerManager'
import { backfillQueue, FUTURES_HISTORY_DAYS } from './BackfillQueue'
import { feedSimulator } from './feedSimulator'
import { detectGaps } from './GapDetector'
import { backfilledTickers } from '../shared/backfillState'
import { getVerifiedThroughMs, clearVerifiedThrough } from '../shared/coverageState'
import { brokerLoginUrl, LOGIN_BROKERS, BROKER_NAMES } from './brokerAuth'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }

/** Credentials waiting for the OAuth callback, by broker type */
export const pendingLogins = new Map<string, { apiKey: string; apiSecret: string }>()

const LOGIN_REOPEN_MS = 3 * 60 * 1000
const lastLoginOpenAt = new Map<string, number>()

/**
 * Marks `brokerId` auth_required and opens its login page in the browser, at most once per
 * few minutes per broker. `state` carries the broker id so the callback finds this account.
 */
export function openBrokerLogin(brokerId: string, reason: string): boolean {
  const broker = stmts.getBrokerById.get(brokerId) as any
  const creds = stmts.getCredentials.get(brokerId) as any
  stmts.updateBrokerStatus.run('auth_required', null, brokerId)
  if (!LOGIN_BROKERS.has(broker?.broker_type) || !creds?.apiKey) return false
  if (!creds.apiSecret) {
    console.log(`[Auth] ${reason} for ${brokerId}, but its API Secret is missing. Remove and re-add the broker.`)
    return false
  }
  if (Date.now() - (lastLoginOpenAt.get(brokerId) || 0) < LOGIN_REOPEN_MS) return false
  lastLoginOpenAt.set(brokerId, Date.now())

  const type = broker.broker_type
  pendingLogins.set(type, { apiKey: creds.apiKey, apiSecret: creds.apiSecret })
  brokerLoginUrl(type, brokerId, { apiKey: creds.apiKey, apiSecret: creds.apiSecret, clientId: broker.account_id })
    .then(loginUrl => {
      console.log(`[Auth] ${reason} for ${brokerId}. Opening ${BROKER_NAMES[type] || type} login in the browser...`)
      exec(`start "" "${loginUrl}"`, (err) => {
        if (err) console.error('[Auth] Failed to open browser:', err.message)
      })
    })
    .catch(err => console.error(`[Auth] ${reason} for ${brokerId}, but the login could not be started: ${err?.message || err}`))
  return true
}

/**
 * Gives `brokerId` the symbols of removed accounts ('orphaned') and of other, unconnected
 * accounts of the same broker type, then deletes those now-empty accounts. Re-adding a broker
 * used to leave every symbol behind on the dead account: no ticks, no backfill.
 */
function takeOverSymbols(brokerId: string, brokerType: string): number {
  const moved = stmts.reassignSymbols.run(ORPHANED, brokerId)
  for (const b of [...(stmts.getBrokers.all() as any[])]) {
    if (b.id === brokerId || b.broker_type !== brokerType || brokerManager.getAdapter(b.id)) continue
    moved.push(...stmts.reassignSymbols.run(b.id, brokerId))
    backfillQueue.updateBrokerInQueue(b.id, brokerId)
    stmts.deleteBroker.run(b.id)
    console.log(`[Broker] Merged unconnected ${brokerType} account ${b.id} into ${brokerId}`)
  }
  for (const { ticker, record } of moved) {
    if (!feedSimulator.moveSymbolToBroker(ticker, brokerId)) {
      feedSimulator.addSymbolByTicker(ticker, brokerId, record.exchange, record.instrumentType, record.rawSymbol || record.instrumentId || ticker)
    }
  }
  if (moved.length) console.log(`[Broker] ${brokerId} took over ${moved.length} symbol(s)`)
  return moved.length
}

/** Call once a broker is connected with a working token. */
export async function activateBroker(brokerId: string, brokerType: string) {
  takeOverSymbols(brokerId, brokerType)

  const rawSymbols = (stmts.getSymbolsByBroker.all(brokerId) as any[])
    .map(s => s.rawSymbol || s.instrumentId)
    .filter(Boolean)
  if (rawSymbols.length > 0) {
    try {
      await brokerManager.subscribe(brokerId, rawSymbols)
      console.log(`[Broker] ${brokerId}: subscribed ${rawSymbols.length} symbols for live ticks`)
    } catch (err) {
      console.error(`[Broker] ${brokerId}: failed to subscribe symbols:`, err)
    }
  }

  backfillQueue.resumeAfterAuth()
  queueCatchUp(brokerId).catch(err => console.error(`[CatchUp] ${brokerId} failed:`, err))
}

/** Listing start of a futures contract (expiry − ~95 days), never deeper than the futures window. */
function futuresListingStartMs(ticker: string, nowMs: number): number | null {
  const m = /(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/i.exec(ticker)
  if (!m) return null
  const expiryMs = new Date(2000 + Number(m[1]), MONTHS[m[2].toUpperCase()] - 1, 28).getTime()
  return Math.max(expiryMs - 95 * DAY_MS, nowMs - FUTURES_HISTORY_DAYS * DAY_MS)
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function forEachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => { while (next < items.length) await fn(items[next++]) }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

const CATCH_UP_EVERY_MS = 30 * 60 * 1000

/**
 * Re-checks every connected broker for missing bars every 30 minutes, and right after the PC
 * wakes from sleep (timers stop while it sleeps, so a gap shows up as a late tick). Covers
 * stream drops outside the auto-refresh window and days slept through. The scan reads only
 * the local database; a broker request is made only for a real hole.
 */
export function startPeriodicCatchUp() {
  let lastTick = Date.now()
  let lastRun = Date.now()
  setInterval(() => {
    const now = Date.now()
    const woke = now - lastTick > 3 * 60_000
    lastTick = now
    if (!woke && now - lastRun < CATCH_UP_EVERY_MS) return
    lastRun = now
    if (woke) console.log('[CatchUp] PC resumed from sleep: checking for missing bars')
    for (const b of stmts.getBrokers.all() as any[]) {
      queueCatchUp(b.id).catch(err => console.error(`[CatchUp] ${b.id} failed:`, err))
    }
  }, 60_000).unref()
}

const catchUpRunning = new Set<string>()

/**
 * Queues every missing range for the symbols of a connected broker: a full download for
 * symbols with no history, otherwise gap-fills from the coverage watermark up to now.
 * Gap passes are used (not enqueue()) because enqueue() skips any ticker that has been
 * backfilled once — which is why logging in again never fetched the days the app was closed.
 */
export async function queueCatchUp(brokerId: string): Promise<void> {
  if (catchUpRunning.has(brokerId) || !brokerManager.getAdapter(brokerId)) return
  catchUpRunning.add(brokerId)
  const started = Date.now()
  let full = 0, gapped = 0, current = 0
  try {
    const depthDays = Number((getAllSettings() as any)?.backfillDepthDays) || 365
    const nowMs = Date.now()
    const symbols = [...(stmts.getSymbolsByBroker.all(brokerId) as any[])]

    // Gap scans are database-only, so run a few symbols at a time
    await forEachLimit(symbols, 4, async (sym: any) => {
      const ticker = sym.amiBrokerTicker
      if (!ticker) return
      const token = sym.rawSymbol || sym.instrumentId || ticker

      const oldestSec = await getOldestBarTimestampSec(ticker)
      if (!oldestSec) {
        // Nothing stored: full download (stale "done" markers would make enqueue() skip it)
        backfilledTickers.delete(ticker)
        if (getVerifiedThroughMs(ticker)) clearVerifiedThrough(ticker)
        backfillQueue.enqueue(ticker, brokerId, token, depthDays)
        full++
        return
      }

      let fromMs = Math.max(nowMs - depthDays * DAY_MS, oldestSec * 1000)
      const listingMs = futuresListingStartMs(ticker, nowMs)
      if (listingMs !== null) fromMs = Math.max(fromMs, listingMs)
      // Only scan what an earlier pass has not verified (no-trade minutes aren't re-fetched)
      const verifiedMs = getVerifiedThroughMs(ticker)
      if (verifiedMs) fromMs = Math.max(fromMs, verifiedMs)

      const gaps = await detectGaps(ticker, sym.exchange || 'NSE', '1m', ticker, fromMs, nowMs)
      if (gaps.length > 0) {
        backfilledTickers.delete(ticker)
        gapped++
      } else {
        backfilledTickers.add(ticker)
        current++
      }
      backfillQueue.enqueueGapPass(ticker, brokerId, token, gaps, nowMs)
    })

    console.log(`[CatchUp] ${brokerId}: ${gapped} symbol(s) with missing bars queued, ${full} full download(s), ${current} up to date (${((Date.now() - started) / 1000).toFixed(1)}s)`)
    // History depth may have been raised since the last run: fetch any older years still missing
    await backfillQueue.extendAllHistory(depthDays)
  } finally {
    catchUpRunning.delete(brokerId)
  }
}
