/**
 * The last session's symbols and prices, so the app opens already filled in.
 *
 * The data engine answers within a fraction of a second of starting, but the window used to
 * wait for it and then for the first data. With a snapshot the window shows at once with what
 * was on screen last time, and the engine's data replaces it quietly a moment later (symbols
 * that didn't change keep their objects, so nothing flickers). Brokers and settings are kept
 * by the store already; prices change too often for that, so they are saved here every few
 * seconds and when the window hides or closes.
 */
import { useAppStore, type SymbolFeed } from '../store/appStore'

const KEY = 'dbp.snapshot.v1'
const SAVE_EVERY_MS = 10_000
/** Older than this, a snapshot would mislead more than help */
const MAX_AGE_MS = 14 * 24 * 3600_000

interface Snapshot { at: number; symbols: SymbolFeed[]; coreStats?: unknown }

/** Set at start when the last session's data was put on screen */
export let restoredFromSnapshot = false

/** Puts the last session's symbols on screen. True when there was something to show. */
export function restoreSnapshot(nowMs = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const snap = JSON.parse(raw) as Snapshot
    if (!snap || !Array.isArray(snap.symbols) || !snap.symbols.length || nowMs - snap.at > MAX_AGE_MS) return false
    if (useAppStore.getState().symbols.length) return false // live data is already there
    // Nothing is streaming yet: the engine says so again within a second if it is
    const symbols = snap.symbols.map(s => (s.status === 'STREAMING' || s.status === 'RECEIVING' ? { ...s, status: 'STALE' as const } : s))
    useAppStore.setState(snap.coreStats ? { symbols, coreStats: snap.coreStats as any } : { symbols })
    restoredFromSnapshot = true
    return true
  } catch {
    return false
  }
}

let lastSaved = ''
export function saveSnapshot(nowMs = Date.now()) {
  const { symbols, coreStats } = useAppStore.getState()
  if (!symbols.length) return
  try {
    const text = JSON.stringify({ at: nowMs, symbols, coreStats } satisfies Snapshot)
    if (text === lastSaved) return
    lastSaved = text
    localStorage.setItem(KEY, text)
  } catch { /* storage full or blocked: the next start just waits for the engine */ }
}

let timer: number | null = null
/** Saves now and then, and whenever the window is hidden or closed */
export function startSnapshotSaving() {
  if (timer !== null) return
  timer = window.setInterval(() => saveSnapshot(), SAVE_EVERY_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSnapshot() })
  window.addEventListener('pagehide', () => saveSnapshot())
}
