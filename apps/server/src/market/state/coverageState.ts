/**
 * Per-ticker "verified through" watermark (UTC ms), persisted across restarts.
 *
 * Once a gap-detection pass for a ticker has been fully filled from the broker, every
 * candle up to the pass's scan end is as complete as the broker can make it. Later
 * passes start scanning from the watermark, so unfillable holes (no-trade minutes in
 * illiquid contracts, pre-listing days) are not re-downloaded on every startup.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

const DATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'DataBridgePro')
const STATE_FILE = path.join(DATA_DIR, 'coverage_state.json')

const verifiedThrough = new Map<string, number>()
let saveTimer: NodeJS.Timeout | null = null

try {
  if (fs.existsSync(STATE_FILE)) {
    const obj = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    for (const [ticker, ms] of Object.entries(obj)) {
      if (typeof ms === 'number' && ms > 0) verifiedThrough.set(ticker, ms)
    }
  }
} catch (err) {
  console.error('[CoverageState] Failed to load state:', err)
}

function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(Object.fromEntries(verifiedThrough)), 'utf8')
  } catch (err) {
    console.error('[CoverageState] Failed to save state:', err)
  }
}

// Debounced: a startup pass can advance hundreds of tickers within a second
function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(saveNow, 1000)
}

export function getVerifiedThroughMs(ticker: string): number | undefined {
  return verifiedThrough.get(ticker)
}

export function setVerifiedThroughMs(ticker: string, ms: number) {
  if ((verifiedThrough.get(ticker) ?? 0) >= ms) return
  verifiedThrough.set(ticker, ms)
  scheduleSave()
}

/** Forget the watermark (symbol deleted, or user forces a full re-download). */
export function clearVerifiedThrough(ticker?: string) {
  if (ticker) verifiedThrough.delete(ticker)
  else verifiedThrough.clear()
  saveNow()
  clearHistoryFloor(ticker)
}

// ===== History floor: how far back the broker has already been asked for =====
// Lets a larger "history depth" setting fetch only the older years that are missing, and
// stops re-asking when the broker simply has nothing older (recent listings).
const FLOOR_FILE = path.join(DATA_DIR, 'history_floor.json')
const historyFloor = new Map<string, number>()

try {
  if (fs.existsSync(FLOOR_FILE)) {
    for (const [ticker, ms] of Object.entries(JSON.parse(fs.readFileSync(FLOOR_FILE, 'utf8')))) {
      if (typeof ms === 'number' && ms > 0) historyFloor.set(ticker, ms)
    }
  }
} catch (err) {
  console.error('[CoverageState] Failed to load history floor:', err)
}

export function getHistoryFloorMs(ticker: string): number | undefined {
  return historyFloor.get(ticker)
}

export function setHistoryFloorMs(ticker: string, ms: number) {
  if ((historyFloor.get(ticker) ?? Infinity) <= ms) return
  historyFloor.set(ticker, ms)
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(FLOOR_FILE, JSON.stringify(Object.fromEntries(historyFloor)), 'utf8')
  } catch (err) {
    console.error('[CoverageState] Failed to save history floor:', err)
  }
}

function clearHistoryFloor(ticker?: string) {
  if (ticker) historyFloor.delete(ticker)
  else historyFloor.clear()
  try { fs.writeFileSync(FLOOR_FILE, JSON.stringify(Object.fromEntries(historyFloor)), 'utf8') } catch {}
}
