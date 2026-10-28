/**
 * One shared once-a-second clock. Only the small labels that show "42s ago" subscribe to it,
 * so a whole page doesn't redraw every second just to move those labels on.
 */
import { useSyncExternalStore } from 'react'

let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(fn: () => void) {
  listeners.add(fn)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => { now = Date.now(); listeners.forEach(l => l()) }, 1000)
  }
  return () => {
    listeners.delete(fn)
    if (!listeners.size && timer) { clearInterval(timer); timer = null }
  }
}

// Before the clock runs, read the time (rounded to the second, so repeated reads agree)
const snapshot = () => (timer ? now : (now = Math.floor(Date.now() / 1000) * 1000))

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
