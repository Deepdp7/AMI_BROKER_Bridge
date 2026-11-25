/**
 * DailyHistory.ts
 *
 * Daily bars for the years before a symbol's 1-minute history starts. Brokers keep 1-minute
 * history for a few years at most (Fyers from 2017) but daily bars for decades; AmiBroker shows
 * both in one chart when the database has "Allow mixed EOD/intraday data" ticked (the plugin
 * sends these days first, marked as end-of-day bars).
 *
 * Stocks and indices only (a futures or options contract lives for months and its 1-minute
 * history covers it), from brokers whose history API really serves daily bars. One symbol at a
 * time, newest year first, only while no 1-minute download is running: it never slows those
 * down. How far back each symbol was asked is remembered (daily_floor.json), so a restart
 * continues where it stopped and a symbol is never asked twice.
 */
import fs from 'fs'
import path from 'path'
import { stmts, getAllSettings, upsertDailyBars, getOldestBarTimestampSec, DATA_DIR, repairBar, ORPHANED } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { withPriority } from '../lib/priority'
import { backfillQueue, isInvalidSymbolError } from './BackfillQueue'
import { isMarketSession } from './MarketCalendar'

const DAY_MS = 86_400_000
/** Years of daily bars wanted when the setting isn't there (0 in the setting turns this off) */
export const DEFAULT_DAILY_YEARS = 20
/** Days per request: Fyers serves at most 366 daily bars per call; Kite, Angel 2000 */
const CHUNK_DAYS = 365
/**
 * A broker with a daily request allowance (Fyers Standard: 5,000) gets daily-history requests
 * only outside market hours (this long before the open to after the close), and only while this
 * many are left: the market's refreshes and repairs come first.
 */
const MARKET_MARGIN_MS = 15 * 60_000
const ALLOWANCE_KEPT = 1_500
/** How often a round is tried (it waits for 1-minute downloads to finish first) */
const ROUND_EVERY_MS = 60_000

const FLOOR_FILE = path.join(DATA_DIR, 'daily_floor.json')
/** ticker → how far back (UTC ms) the broker was asked for daily bars */
const floors = new Map<string, number>()
let floorsLoaded = false

function loadFloors() {
  if (floorsLoaded) return
  floorsLoaded = true
  try {
    for (const [t, ms] of Object.entries(JSON.parse(fs.readFileSync(FLOOR_FILE, 'utf8')))) {
      if (typeof ms === 'number' && ms > 0) floors.set(t, ms)
    }
  } catch { /* none yet */ }
}

function saveFloors() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(FLOOR_FILE + '.part', JSON.stringify(Object.fromEntries(floors)), 'utf8')
    fs.renameSync(FLOOR_FILE + '.part', FLOOR_FILE)
  } catch (err) {
    console.error('[DailyHistory] Failed to save progress:', err)
  }
}

/** Years of daily bars wanted (0 = off) */
export function dailyYears(): number {
  const v = (getAllSettings() as any)?.dailyHistoryYears
  const n = v === undefined || v === null || v === '' ? DEFAULT_DAILY_YEARS : Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 40) : 0
}

/** Futures and options contracts: no daily download */
function isDerivative(sym: any): boolean {
  const ticker = String(sym.amiBrokerTicker || sym.amibroker_ticker || '')
  const type = String(sym.instrumentType || sym.instrument_type || '').toUpperCase()
  return /^(FUT|OPT|CE|PE)/.test(type) || /(FUT|\d(CE|PE))$/i.test(ticker)
}

export type DailyResult = 'done' | 'downloaded' | 'skipped' | 'later'

/**
 * Downloads one symbol's missing daily years, newest first, chunk by chunk (progress is kept
 * after each one). 'later' = try again next round (no broker, an error, history download busy).
 */
export async function downloadDailyFor(sym: any, nowMs = Date.now()): Promise<DailyResult> {
  loadFloors()
  const ticker = sym.amiBrokerTicker || sym.amibroker_ticker
  const brokerId = sym.brokerId || sym.broker_id
  const years = dailyYears()
  if (!ticker || !years || isDerivative(sym) || !brokerId || brokerId === ORPHANED) return 'skipped'
  const adapter: any = brokerManager.getAdapter(brokerId)
  if (!adapter) return 'later'
  if (!adapter.dailyHistory) return 'skipped'
  const left = adapter.historyRequestsLeftToday?.()
  if (typeof left === 'number' && Number.isFinite(left)) {
    const nearMarket = [nowMs - MARKET_MARGIN_MS, nowMs, nowMs + MARKET_MARGIN_MS].some(t => isMarketSession(t, 'NSE'))
    if (nearMarket || left < ALLOWANCE_KEPT) return 'later'
  }

  const wantFromMs = nowMs - years * 365.25 * DAY_MS
  const oldestMinuteSec = await getOldestBarTimestampSec(ticker)
  if (!oldestMinuteSec) return 'later'   // the 1-minute history comes first: it says where days are needed
  let endMs = Math.min(floors.get(ticker) ?? Infinity, oldestMinuteSec * 1000)
  if (endMs <= wantFromMs + 7 * DAY_MS) return 'done'

  const token = sym.rawSymbol || sym.raw_symbol || sym.instrumentId || sym.instrument_id || ticker
  let stored = 0
  while (endMs > wantFromMs + 7 * DAY_MS) {
    if (backfillQueue.hasActiveWork()) break   // a 1-minute download started: it goes first
    const fromMs = Math.max(wantFromMs, endMs - CHUNK_DAYS * DAY_MS)
    let bars: any[]
    try {
      bars = (await withPriority<any[]>('bulk', () => adapter.getHistoricalBars(token, '1d', new Date(fromMs), new Date(endMs)))) || []
    } catch (err: any) {
      if (isInvalidSymbolError(err)) { floors.set(ticker, wantFromMs); saveFloors(); return 'skipped' }
      console.warn(`[DailyHistory] ${ticker}: ${err?.message || err} (trying again later)`)
      return stored ? 'downloaded' : 'later'
    }
    const written = upsertDailyBars(ticker, bars.map(repairBar))
    stored += written
    // Nothing at all this far back: the symbol wasn't listed yet
    endMs = written === 0 ? wantFromMs : fromMs
    floors.set(ticker, endMs)
    saveFloors()
  }
  if (stored) console.log(`[DailyHistory] ${ticker}: ${stored} daily bars stored (back to ${new Date(floors.get(ticker)!).toISOString().slice(0, 10)})`)
  return endMs <= wantFromMs + 7 * DAY_MS ? (stored ? 'downloaded' : 'done') : 'later'
}

/** Forget how far a symbol was asked (symbol deleted, years setting raised: the next round re-checks) */
export function forgetDailyFloor(ticker?: string) {
  loadFloors()
  if (ticker) floors.delete(ticker)
  else floors.clear()
  saveFloors()
}

let running = false

/** One pass over the symbols that still need daily years; stops when a 1-minute download starts */
export async function dailyRound(nowMs = Date.now()): Promise<number> {
  if (running || !dailyYears() || backfillQueue.hasActiveWork()) return 0
  running = true
  let downloaded = 0
  try {
    for (const sym of stmts.getSymbols.all() as any[]) {
      if (backfillQueue.hasActiveWork()) break
      if ((await downloadDailyFor(sym, nowMs)) === 'downloaded') downloaded++
    }
  } finally {
    running = false
  }
  return downloaded
}

/** Starts the rounds (shortly after the engine starts, then every minute while there is work) */
export function startDailyHistory() {
  setTimeout(() => {
    dailyRound().catch(err => console.error('[DailyHistory] Round failed:', err))
    setInterval(() => dailyRound().catch(err => console.error('[DailyHistory] Round failed:', err)), ROUND_EVERY_MS).unref()
  }, 2 * 60_000).unref()
}
