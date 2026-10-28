import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, readPref, writePref, THEMES } from './usePref'

describe('colour themes', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme
    localStorage.clear()
  })

  it('offers four themes, each with its own accent and background', () => {
    expect(THEMES.map(t => t.id)).toEqual(['emerald', 'ocean', 'violet', 'ember'])
    expect(new Set(THEMES.map(t => t.accent)).size).toBe(4)
    expect(new Set(THEMES.map(t => t.bg)).size).toBe(4)
  })

  it('sets data-theme on <html>; emerald (the original) has no attribute', () => {
    applyTheme('ocean')
    expect(document.documentElement.dataset.theme).toBe('ocean')
    applyTheme('emerald')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('applies the saved choice on start, and ignores one it does not know', () => {
    writePref('theme', 'violet')
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('violet')
    writePref('theme', 'neon-pink')
    applyTheme()
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(readPref('theme', 'emerald')).toBe('neon-pink') // left alone, just not applied
  })

  it('fades colours only when asked, and never with reduced motion', () => {
    applyTheme('ember', true)
    expect(document.documentElement.classList.contains('theme-fading')).toBe(true)
    document.documentElement.classList.remove('theme-fading')
    document.documentElement.dataset.motion = 'reduced'
    applyTheme('ocean', true)
    expect(document.documentElement.classList.contains('theme-fading')).toBe(false)
    delete document.documentElement.dataset.motion
  })
})
