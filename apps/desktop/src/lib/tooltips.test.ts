import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { installTooltips, resetTooltipsForTest } from './tooltips'

// jsdom has no PointerEvent; the handlers only read the type, target and position
const fire = (type: string, target: EventTarget, init: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
const tip = () => document.querySelector('.app-tip')
const shown = () => tip()?.classList.contains('show') ?? false

describe('app tooltips', () => {
  beforeAll(() => installTooltips())
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <div id="row" title="Open NIFTY"><span id="price">22,749</span><button id="pin" title="Pin"><svg></svg></button></div>
      <button id="other" title="Refresh">R</button>
      <p id="plain">no title</p>`
  })
  afterEach(() => {
    resetTooltipsForTest()
    vi.useRealTimers()
  })

  it('holds back the title so the browser shows nothing, and shows ours after a short wait', () => {
    const row = document.getElementById('row')!
    fire('pointerover', document.getElementById('price')!)
    expect(row.hasAttribute('title')).toBe(false)
    expect(shown()).toBe(false)
    vi.advanceTimersByTime(500)
    expect(shown()).toBe(true)
    expect(tip()!.textContent).toBe('Open NIFTY')
  })

  it('puts every title back when the pointer moves on', () => {
    const row = document.getElementById('row')!, pin = document.getElementById('pin')!
    fire('pointerover', pin)
    // the button's own title wins, and the row's is held too so the browser can't fall back to it
    expect(pin.hasAttribute('title')).toBe(false)
    expect(row.hasAttribute('title')).toBe(false)
    vi.advanceTimersByTime(500)
    expect(tip()!.textContent).toBe('Pin')
    expect(pin.getAttribute('aria-label')).toBe('Pin') // icon-only button keeps a name

    fire('pointerover', document.getElementById('plain')!)
    expect(pin.getAttribute('title')).toBe('Pin')
    expect(row.getAttribute('title')).toBe('Open NIFTY')
    expect(shown()).toBe(false)
  })

  it('moving between titled items while one is showing switches at once', () => {
    fire('pointerover', document.getElementById('pin')!)
    vi.advanceTimersByTime(500)
    fire('pointerover', document.getElementById('other')!)
    expect(shown()).toBe(true)
    expect(tip()!.textContent).toBe('Refresh')
  })

  it('a click hides it until the pointer goes somewhere else', () => {
    const other = document.getElementById('other')!
    fire('pointerover', other)
    vi.advanceTimersByTime(500)
    fire('pointerdown', other)
    expect(shown()).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(shown()).toBe(false)
  })

  it('follows a title the page changes while it is held back', async () => {
    vi.useRealTimers()
    const other = document.getElementById('other')!
    fire('pointerover', other)
    await new Promise(r => setTimeout(r, 500))
    other.setAttribute('title', 'Refreshing…') // what React does when the prop changes
    await new Promise(r => setTimeout(r, 0))
    expect(other.hasAttribute('title')).toBe(false)
    expect(tip()!.textContent).toBe('Refreshing…')
    fire('pointerover', document.getElementById('plain')!)
    expect(other.getAttribute('title')).toBe('Refreshing…')
  })

  it('leaving the window hides it and restores titles', () => {
    const other = document.getElementById('other')!
    fire('pointerover', other)
    vi.advanceTimersByTime(500)
    fire('pointerout', other, { relatedTarget: null })
    expect(shown()).toBe(false)
    expect(other.getAttribute('title')).toBe('Refresh')
  })
})
