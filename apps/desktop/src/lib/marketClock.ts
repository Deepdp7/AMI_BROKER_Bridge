/**
 * NSE session clock for the Feed Status header: how far into today's session we are, or when
 * the next one starts. Weekends are skipped; exchange holidays are not known here, so the
 * "opens" line names the day and the engine's own market status stays the authority.
 */
const IST_OFFSET_MS = 5.5 * 3600 * 1000
export const OPEN_MIN = 9 * 60 + 15
export const CLOSE_MIN = 15 * 60 + 30
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface SessionInfo {
  /** Within 09:15–15:30 IST on a weekday */
  inSession: boolean
  /** 0–1 through today's session (0 before, 1 after) */
  progress: number
  /** Milliseconds until the close (in session) or the next open */
  msToNext: number
  /** "Today", "Tomorrow" or a day name, for the next open */
  nextOpenDay: string
}

export function sessionInfo(nowMs = Date.now()): SessionInfo {
  const ist = new Date(nowMs + IST_OFFSET_MS)
  const day = ist.getUTCDay()
  const minOfDay = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60
  const weekday = day !== 0 && day !== 6
  const inSession = weekday && minOfDay >= OPEN_MIN && minOfDay < CLOSE_MIN
  const progress = !weekday ? 0 : Math.min(1, Math.max(0, (minOfDay - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)))

  if (inSession) return { inSession, progress, msToNext: (CLOSE_MIN - minOfDay) * 60_000, nextOpenDay: 'Today' }

  // Next weekday 09:15 IST
  let addDays = weekday && minOfDay < OPEN_MIN ? 0 : 1
  while ([0, 6].includes((day + addDays) % 7)) addDays++
  const msToNext = (addDays * 1440 + OPEN_MIN - minOfDay) * 60_000
  const nextOpenDay = addDays === 0 ? 'Today' : addDays === 1 ? 'Tomorrow' : DAY_NAMES[(day + addDays) % 7]
  return { inSession, progress, msToNext, nextOpenDay }
}

/** "2h 14m", "38m", "45s" */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}
