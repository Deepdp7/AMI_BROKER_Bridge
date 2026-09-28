/**
 * DailyReloginService.ts
 *
 * Schedules an automatic daily re-login for Fyers (and other OAuth brokers).
 * Fyers access tokens expire every day. This service:
 *  1. Reads `dailyReloginTime` (HH:MM IST) from settings
 *  2. At that time, opens the Fyers OAuth login URL in the default browser
 *  3. The user completes the login; the callback handler does the rest automatically
 *
 * The scheduler checks every minute and fires once per day per broker.
 */

import { exec } from 'child_process'
import { getAllSettings } from '../db'
import { stmts } from '../db'

// Track which broker+date combos have already been triggered today
const firedToday = new Set<string>()

let schedulerInterval: NodeJS.Timeout | null = null

function openUrl(url: string) {
  const platform = process.platform
  let cmd: string
  if (platform === 'win32') {
    cmd = `start "" "${url}"`
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`
  } else {
    cmd = `xdg-open "${url}"`
  }
  exec(cmd, (err) => {
    if (err) console.error('[DailyRelogin] Failed to open browser:', err.message)
  })
}

function getISTHHMM(): string {
  // Returns current time as HH:MM in IST (UTC+5:30)
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  const hh = String(istNow.getUTCHours()).padStart(2, '0')
  const mm = String(istNow.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function getISTDateStr(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  return istNow.toISOString().split('T')[0]
}

function tick() {
  const settings = getAllSettings() as any
  if (!settings?.dailyReloginEnabled) return

  const targetTime: string = settings.dailyReloginTime || '08:50'
  const currentTime = getISTHHMM()

  if (currentTime !== targetTime) return

  // Find all connected/saved fyers (or any OAuth) brokers
  const brokers = stmts.getBrokers.all() as any[]
  const oauthBrokers = brokers.filter(b => b.broker_type === 'fyers')

  const todayStr = getISTDateStr()
  
  let staggerDelayMs = 0

  for (const broker of oauthBrokers) {
    const fireKey = `${broker.id}:${todayStr}`
    if (firedToday.has(fireKey)) continue  // Already opened today

    // Get saved credentials to build the login URL
    const creds = stmts.getCredentials?.get?.(broker.id) as any
    if (!creds?.apiKey) {
      console.warn(`[DailyRelogin] No credentials saved for broker ${broker.id}. Skipping auto-relogin.`)
      continue
    }

    const redirectUri = encodeURIComponent('http://127.0.0.1:7890/api/callback/fyers')
    const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${creds.apiKey}&redirect_uri=${redirectUri}&response_type=code&state=${broker.id}`

    firedToday.add(fireKey)

    // Stagger multiple brokers by 3s to avoid browser popup floods and race conditions
    setTimeout(() => {
      // Set status to auth_required so the callback handler will accept the incoming auth code
      stmts.updateBrokerStatus.run('auth_required', broker.last_connected_at || null, broker.id)
      console.log(`[DailyRelogin] 🔓 Opening Fyers login page for broker ${broker.id} at ${targetTime} IST`)
      openUrl(loginUrl)
    }, staggerDelayMs)
    
    staggerDelayMs += 3000
  }

  // Clean up old entries (keep only today's) to prevent unbounded growth
  for (const key of firedToday) {
    if (!key.includes(todayStr)) firedToday.delete(key)
  }
}

export function startDailyReloginScheduler() {
  if (schedulerInterval) return // Already running

  // Check every minute
  schedulerInterval = setInterval(tick, 60_000)

  // Also run immediately on start (in case server restarts near the target time)
  tick()

  const settings = getAllSettings() as any
  const enabled = settings?.dailyReloginEnabled ?? false
  const time = settings?.dailyReloginTime ?? '08:50'
  console.log(`[DailyRelogin] Scheduler started. Auto-relogin: ${enabled ? `ENABLED at ${time} IST` : 'DISABLED'}`)
}

export function stopDailyReloginScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[DailyRelogin] Scheduler stopped.')
  }
}

/** Call this when settings change so the scheduler picks up new time/enabled state immediately */
export function refreshDailyReloginScheduler() {
  const settings = getAllSettings() as any
  const enabled = settings?.dailyReloginEnabled ?? false
  const time = settings?.dailyReloginTime ?? '08:50'
  console.log(`[DailyRelogin] Settings refreshed. Auto-relogin: ${enabled ? `ENABLED at ${time} IST` : 'DISABLED'}`)
}
