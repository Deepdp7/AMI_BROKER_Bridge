/**
 * App-styled tooltips in place of the browser's white "title" box.
 *
 * Every `title="…"` in the app keeps working: while the pointer is over an element its title
 * (and any title on the elements around it, which the browser would fall back to) is held
 * back so the browser has nothing to show, and our own tooltip shows the text. The titles are
 * put back when the pointer leaves, so React's view of the page stays true. If React changes a
 * title while it is held back, the tooltip follows.
 *
 * Like Windows: a short wait before the first tooltip, none while moving between buttons once
 * one is showing, and clicking, typing, scrolling or leaving the window hides it.
 */

const SHOW_DELAY_MS = 450
/** A tooltip hidden less than this long ago lets the next one show at once */
const RESHOW_MS = 400
/** Small elements get their tooltip centred under them; rows and panels get it at the pointer */
const ANCHOR_MAX_W = 220
const ANCHOR_MAX_H = 56
const GAP = 6
const EDGE = 6

/** Elements whose title is being held back, and the text */
const held = new Map<Element, string>()
let owner: Element | null = null
let tip: HTMLDivElement | null = null
let visible = false
let showTimer = 0
let lastHiddenAt = 0
/** After a click or key press the tooltip stays away until the pointer moves to something else */
let suppressed = false
let pointerX = 0
let pointerY = 0
let watcher: MutationObserver | null = null

function tipElement() {
  if (!tip) {
    tip = document.createElement('div')
    tip.className = 'app-tip'
    tip.setAttribute('role', 'tooltip')
    document.body.appendChild(tip)
  }
  return tip
}

function hold(el: Element) {
  const text = el.getAttribute('title')
  if (text === null) return
  held.set(el, text)
  el.removeAttribute('title')
  // An icon-only button named only by its title still needs a name for screen readers
  if (text && !el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', text)
}

function release(el: Element) {
  const text = held.get(el)
  held.delete(el)
  if (text !== undefined && !el.hasAttribute('title')) el.setAttribute('title', text)
}

/** Titled elements from `start` up to the page root, nearest first */
function titledChain(start: Element | null) {
  const chain: Element[] = []
  for (let el = start; el && el !== document.documentElement; el = el.parentElement) {
    if (el.hasAttribute('title') || held.has(el)) chain.push(el)
  }
  return chain
}

function place() {
  if (!owner || !tip) return
  const w = tip.offsetWidth, h = tip.offsetHeight
  const vw = window.innerWidth, vh = window.innerHeight
  const r = owner.getBoundingClientRect()
  let left: number, top: number
  if (r.width <= ANCHOR_MAX_W && r.height <= ANCHOR_MAX_H) {
    left = r.left + r.width / 2 - w / 2
    top = r.bottom + GAP
    if (top + h > vh - EDGE) top = r.top - GAP - h
  } else {
    left = pointerX + 2
    top = pointerY + 20
    if (top + h > vh - EDGE) top = pointerY - 10 - h
  }
  left = Math.max(EDGE, Math.min(left, vw - w - EDGE))
  top = Math.max(EDGE, top)
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
}

function show() {
  showTimer = 0
  const text = owner ? held.get(owner) : ''
  if (!owner || !text || suppressed || !owner.isConnected) return
  const el = tipElement()
  el.textContent = text
  place()
  el.classList.add('show')
  visible = true
}

function hide() {
  if (showTimer) { clearTimeout(showTimer); showTimer = 0 }
  if (visible) {
    tip?.classList.remove('show')
    visible = false
    lastHiddenAt = Date.now()
  }
}

function watch(chain: Element[]) {
  watcher?.disconnect()
  if (!chain.length) return
  watcher ??= new MutationObserver(records => {
    for (const r of records) {
      const el = r.target as Element
      // Our own removal also lands here; only a title put back by the page matters
      if (!held.has(el) || !el.hasAttribute('title')) continue
      hold(el)
      if (el === owner) {
        if (!held.get(el)) hide()
        else if (visible && tip) { tip.textContent = held.get(el)!; place() }
      }
    }
  })
  for (const el of chain) watcher.observe(el, { attributes: true, attributeFilter: ['title'] })
}

/** The pointer is now over `target`: move the held titles and the tooltip along with it */
function moveTo(target: Element | null) {
  const chain = titledChain(target)
  for (const el of [...held.keys()]) if (!chain.includes(el)) release(el)
  for (const el of chain) if (!held.has(el)) hold(el)
  watch(chain)

  const next = chain[0] ?? null
  if (next === owner) return
  const wasVisible = visible
  hide()
  owner = next
  suppressed = false
  if (!owner || !held.get(owner)) return
  const quick = wasVisible || Date.now() - lastHiddenAt < RESHOW_MS
  if (quick) show()
  else showTimer = window.setTimeout(show, SHOW_DELAY_MS)
}

function leaveAll() {
  hide()
  for (const el of [...held.keys()]) release(el)
  watcher?.disconnect()
  owner = null
}

function dismiss() {
  hide()
  suppressed = true
}

export function installTooltips() {
  document.addEventListener('pointerover', e => {
    pointerX = e.clientX
    pointerY = e.clientY
    moveTo(e.target instanceof Element ? e.target : null)
  }, { capture: true })
  document.addEventListener('pointermove', e => { pointerX = e.clientX; pointerY = e.clientY }, { capture: true, passive: true })
  // Pointer left the window
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) leaveAll() }, { capture: true })
  document.addEventListener('pointerdown', dismiss, { capture: true })
  document.addEventListener('keydown', dismiss, { capture: true })
  document.addEventListener('wheel', dismiss, { capture: true, passive: true })
  document.addEventListener('scroll', hide, { capture: true, passive: true })
  window.addEventListener('blur', leaveAll)
  window.addEventListener('resize', hide)
}

/** For tests: forget everything between cases */
export function resetTooltipsForTest() {
  leaveAll()
  tip?.remove()
  tip = null
  watcher = null
  lastHiddenAt = 0
  suppressed = false
}
