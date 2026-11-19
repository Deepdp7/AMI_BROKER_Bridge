/**
 * What the account's Fyers API plan allows (fyers.in/api-docs/v3/getting-started/plans-and-limits,
 * updated 14 Oct 2026), per user across every app and PC logged in with it:
 *
 *                       Standard                      Prime
 *   live symbols        100                           5,000
 *   data requests       5/s, 50/min, 5,000/day        10/s, 500/min, 5,00,000/day
 *   1-minute history    the last 1 year               5+ years
 *   daily history       the last 5 years              25+ years
 *
 * Going over the per-minute limit more than 3 times in a day blocks the account until the next
 * day. No API answer says which plan an account has, so it is learned from what Fyers does: its
 * refusals name the plan ("Standard plan limit", "outside your Standard plan's historical data
 * limit of 5 years for daily data and 1 year for intraday data"), and a live socket that takes
 * more than 100 symbols is Prime. What was learned, and today's request count, are kept in
 * fyers_plan.json so a restart neither forgets nor re-learns them the expensive way.
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../../../db'

export type FyersPlan = 'standard' | 'prime' | 'unknown'

const PLAN_FILE = path.join(DATA_DIR, 'fyers_plan.json')
const DAY_MS = 86_400_000
const IST_MS = 19_800_000
/** Standard's 5,000 a day, less a margin for requests of other apps on the same account */
const STANDARD_DAILY_REQUESTS = 4_800
const STANDARD_LIVE_SYMBOLS = 100

interface PlanState {
  plan: FyersPlan
  /** History windows Fyers stated (days back from today), once it refused a request beyond them */
  intradayDays?: number
  dailyDays?: number
  /** Data requests sent on IST day `day` */
  day: number
  requests: number
}

let state: PlanState | null = null
let saveTimer: NodeJS.Timeout | null = null

const istDay = (ms: number) => Math.floor((ms + IST_MS) / DAY_MS)

function load(): PlanState {
  if (state) return state
  state = { plan: 'unknown', day: istDay(Date.now()), requests: 0 }
  try {
    const saved = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'))
    if (saved && typeof saved === 'object') state = { ...state, ...saved }
  } catch { /* first run */ }
  return state!
}

function save(now = false) {
  const write = () => {
    saveTimer = null
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(PLAN_FILE, JSON.stringify(load()), 'utf8')
    } catch (err) {
      console.error('[FyersPlan] Failed to save:', err)
    }
  }
  if (now) { if (saveTimer) clearTimeout(saveTimer); write(); return }
  if (!saveTimer) saveTimer = setTimeout(write, 2000)
}

export function fyersPlan(): FyersPlan {
  return load().plan
}

function setPlan(plan: FyersPlan) {
  const s = load()
  if (s.plan === plan) return
  s.plan = plan
  console.log(`[FyersPlan] This Fyers account is on the ${plan === 'standard' ? 'Standard' : 'Prime'} API plan` +
    (plan === 'standard' ? ` (live prices for ${STANDARD_LIVE_SYMBOLS} symbols, 5,000 history requests a day)` : ''))
  save(true)
}

/** Reads what a Fyers refusal says about the plan (any message text or JSON) */
export function learnFromFyersMessage(text: string) {
  if (/standard plan/i.test(text)) setPlan('standard')
  const daily = /(\d+)\s*years?\s+for\s+daily/i.exec(text)
  const intraday = /(\d+)\s*years?\s+for\s+intraday/i.exec(text)
  const s = load()
  let changed = false
  if (daily) { const d = Number(daily[1]) * 365; if (s.dailyDays !== d) { s.dailyDays = d; changed = true } }
  if (intraday) { const d = Number(intraday[1]) * 365; if (s.intradayDays !== d) { s.intradayDays = d; changed = true } }
  if (changed) {
    console.log(`[FyersPlan] History this plan serves: 1-minute ${s.intradayDays ? `the last ${s.intradayDays / 365} year(s)` : 'unknown'}, daily ${s.dailyDays ? `the last ${s.dailyDays / 365} year(s)` : 'unknown'}; older requests are no longer sent`)
    save(true)
  }
}

/** The live socket took `accepted` symbols of more asked for (100 = Standard), or more than 100 (Prime) */
export function learnFromLiveCap(accepted: number, asked: number) {
  if (accepted > STANDARD_LIVE_SYMBOLS) setPlan('prime')
  else if (accepted === STANDARD_LIVE_SYMBOLS && asked > accepted) setPlan('standard')
}

/** Live symbols the plan streams (undefined: not known) */
export function liveSymbolCap(): number | undefined {
  const plan = load().plan
  return plan === 'standard' ? STANDARD_LIVE_SYMBOLS : plan === 'prime' ? 5_000 : undefined
}

/**
 * The earliest time (UTC ms) the plan serves history from, for 1-minute or daily bars, with a
 * day's margin; 0 when no limit is known. Requests for older times only earn a refusal.
 */
export function historyFloorMs(daily: boolean, nowMs = Date.now()): number {
  const s = load()
  const days = daily ? s.dailyDays : s.intradayDays
  return days ? nowMs - (days - 1) * DAY_MS : 0
}

/** Data requests the plan still allows today (Infinity when it has no daily cap known) */
export function requestsLeftToday(nowMs = Date.now()): number {
  const s = load()
  if (s.plan !== 'standard') return Infinity
  if (s.day !== istDay(nowMs)) return STANDARD_DAILY_REQUESTS
  return Math.max(0, STANDARD_DAILY_REQUESTS - s.requests)
}

/** Counts one data request (history, quotes) */
export function noteRequest(nowMs = Date.now()) {
  const s = load()
  const day = istDay(nowMs)
  if (s.day !== day) { s.day = day; s.requests = 0 }
  s.requests++
  save()
}

/** Milliseconds until the daily count starts over (IST midnight) */
export function msUntilNewDay(nowMs = Date.now()): number {
  return (istDay(nowMs) + 1) * DAY_MS - IST_MS - nowMs
}

/** Forget everything (tests) */
export function resetFyersPlan() {
  state = null
  try { fs.unlinkSync(PLAN_FILE) } catch {}
}
