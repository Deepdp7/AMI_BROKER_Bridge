/**
 * A small per-PC preference kept in localStorage (a table's density, pinned symbols, which
 * columns show). Storage can be missing or blocked: the default is used then.
 */
import { useCallback, useState } from 'react'

const PREFIX = 'dbp.pref.'

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePref<T>(key: string, value: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

export function usePref<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readPref(key, fallback))
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      writePref(key, next)
      return next
    })
  }, [key])
  return [value, set]
}

/**
 * Settings → Appearance → Colour theme, applied to <html data-theme> (the colours themselves
 * are in styles/themes.css). Emerald is the original look and has no attribute.
 */
export type ThemePref = 'emerald' | 'ocean' | 'violet' | 'ember'

export const THEMES: { id: ThemePref; name: string; note: string; accent: string; bg: string; panel: string }[] = [
  { id: 'emerald', name: 'Emerald', note: 'The classic green', accent: '#00d4aa', bg: '#0e0e0e', panel: '#1e1e1e' },
  { id: 'ocean', name: 'Ocean', note: 'Calm and cool blue', accent: '#3b9eff', bg: '#0a0e16', panel: '#171f2f' },
  { id: 'violet', name: 'Violet', note: 'Soft purple', accent: '#a78bfa', bg: '#0e0b15', panel: '#1d182a' },
  { id: 'ember', name: 'Ember', note: 'Warm orange', accent: '#ff7a45', bg: '#110c0a', panel: '#211a16' },
]

const isTheme = (v: unknown): v is ThemePref => THEMES.some(t => t.id === v)

export function applyTheme(pref: ThemePref = readPref<ThemePref>('theme', 'emerald'), animate = false) {
  try {
    const root = document.documentElement
    const next = isTheme(pref) ? pref : 'emerald'
    if (next === 'emerald') delete root.dataset.theme
    else root.dataset.theme = next
    if (animate && root.dataset.motion !== 'reduced') {
      // Colours glide to the new theme instead of snapping
      root.classList.add('theme-fading')
      window.setTimeout(() => root.classList.remove('theme-fading'), 450)
    }
  } catch { /* no document */ }
}

/**
 * Settings → Appearance → Animations, applied to <html data-motion> so CSS can turn effects
 * down. 'auto' follows the Windows "Animation effects" setting.
 */
export type MotionPref = 'auto' | 'full' | 'reduced'
export function applyMotionPref(pref: MotionPref = readPref<MotionPref>('motion', 'auto')) {
  try {
    if (pref === 'auto') delete document.documentElement.dataset.motion
    else document.documentElement.dataset.motion = pref
  } catch { /* no document */ }
}
