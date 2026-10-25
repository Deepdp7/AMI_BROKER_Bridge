/**
 * nativeFeel.ts
 *
 * Makes the WebView behave like a desktop app instead of a browser tab: no reload,
 * print, find, view-source, dev-tools, zoom or back/forward shortcuts, no browser
 * right-click menu, no page text selection or link/image dragging, and no browser autofill
 * ("Saved info", password suggestions) on any field. Text fields keep their normal editing
 * keys and menu, and anything marked `.selectable` can be copied.
 */

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || el.closest('input, textarea, select, [contenteditable="true"]') !== null)

const isSelectable = (el: EventTarget | null) =>
  el instanceof Element && el.closest('.selectable') !== null

// Ctrl/Cmd + key combinations that only make sense in a browser
const BLOCKED_CTRL_KEYS = new Set([
  'r', 'p', 's', 'o', 'u', 'f', 'g', 'h', 'j', 'd', 'l', 'n', 't', 'w', 'e', 'k',
  '=', '+', '-', '_', '0', 'tab', 'pageup', 'pagedown',
])
// Ctrl+Shift combinations (dev tools, reopen tab, etc.)
const BLOCKED_CTRL_SHIFT_KEYS = new Set(['i', 'j', 'c', 'k', 'r', 'n', 't', 'w', 'delete', 'o', 'b', 'm', 'p'])

function onKeyDown(e: KeyboardEvent) {
  const key = e.key.toLowerCase()
  const ctrl = e.ctrlKey || e.metaKey

  // Function keys: reload, find-next, caret browsing, full screen, dev tools, …
  if (/^f([1-9]|1[0-2])$/.test(key) && !ctrl && !e.altKey) { e.preventDefault(); return }
  // Browser back / forward / home
  if (e.altKey && (key === 'arrowleft' || key === 'arrowright' || key === 'home')) { e.preventDefault(); return }
  if (key === 'browserback' || key === 'browserforward' || key === 'browserrefresh' || key === 'browsersearch' || key === 'browserhome') { e.preventDefault(); return }

  if (!ctrl) return
  if (e.shiftKey && BLOCKED_CTRL_SHIFT_KEYS.has(key)) { e.preventDefault(); return }
  if (e.shiftKey) return
  // Inside text fields keep select-all / copy / paste / undo etc.; Ctrl+F there is harmless too
  if (BLOCKED_CTRL_KEYS.has(key) && !(isEditable(e.target) && key === 'f')) e.preventDefault()
}

const NO_AUTOFILL_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'])

function stopFieldAutofill(el: HTMLInputElement | HTMLTextAreaElement) {
  if (el instanceof HTMLInputElement && NO_AUTOFILL_TYPES.has(el.type)) return
  // A field that sets its own autocomplete keeps it
  if (el.hasAttribute('autocomplete') && el.dataset.autofillSet !== '1') return
  el.setAttribute('autocomplete', el instanceof HTMLInputElement && el.type === 'password' ? 'new-password' : 'off')
  el.dataset.autofillSet = '1'
}

/**
 * Turns the WebView's autofill off for the fields under `root`: the "Saved info" list that
 * remembers typed API keys, and the offer to save passwords. "off" covers text fields;
 * password fields ignore it and need "new-password".
 */
export function stopAutofill(root: Element | Document) {
  if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) stopFieldAutofill(root)
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(stopFieldAutofill)
}

/** Fields come and go as pages change, so everything added to the page is covered */
function watchAutofill() {
  stopAutofill(document)
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes') {
        // A field switched between text and password needs the other value
        if (r.target instanceof HTMLInputElement) stopFieldAutofill(r.target)
      } else {
        r.addedNodes.forEach(node => { if (node instanceof Element) stopAutofill(node) })
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] })
}

export function installNativeFeel() {
  watchAutofill()

  // Capture phase so nothing in the page can let a browser shortcut through
  window.addEventListener('keydown', onKeyDown, { capture: true })

  // Right-click: no browser menu (Reload / Inspect / Save as…); text fields and selectable text keep theirs
  window.addEventListener('contextmenu', e => {
    if (isEditable(e.target)) return
    if (isSelectable(e.target) && window.getSelection()?.toString()) return
    e.preventDefault()
  }, { capture: true })

  // Ctrl + mouse wheel / pinch zoom
  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false, capture: true })
  window.addEventListener('gesturestart', e => e.preventDefault())

  // Dragging links/images out, or dropping a file onto the window (which would navigate away)
  window.addEventListener('dragstart', e => {
    if (!isEditable(e.target)) e.preventDefault()
  }, { capture: true })
  window.addEventListener('dragover', e => e.preventDefault())
  window.addEventListener('drop', e => { if (!isEditable(e.target)) e.preventDefault() })

  // Middle-click / Ctrl+click on a link would open a browser window
  window.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault() }, { capture: true })
  window.addEventListener('click', e => {
    if ((e.ctrlKey || e.shiftKey || e.metaKey) && (e.target as Element)?.closest?.('a[href]')) e.preventDefault()
  }, { capture: true })
}
