/**
 * nativeFeel.ts
 *
 * Makes the WebView behave like a desktop app instead of a browser tab: no reload,
 * print, find, view-source, dev-tools, zoom or back/forward shortcuts, no browser
 * right-click menu, no selecting or copying page text with the mouse or Ctrl+A, no
 * link/image dragging or middle-click scrolling, no spell-check underlines, no browser
 * tooltips (see tooltips.ts), and no browser autofill ("Saved info", password suggestions)
 * on any field. Text fields keep their normal editing keys and get a real Windows
 * Cut / Copy / Paste menu. Copy buttons in the app still put text on the clipboard.
 *
 * The desktop shell also switches the browser menu and keys off inside WebView2 itself
 * (src-tauri/src/window_chrome.rs); this file is the second layer, and the only one when
 * the page runs in a normal browser during development.
 */
import { installTooltips } from './tooltips'

const isTauri = () => '__TAURI_INTERNALS__' in window

const isEditable = (target: EventTarget | null) => {
  // Selection events can come from the text inside an element
  const el = target instanceof Text ? target.parentElement : target
  return el instanceof HTMLElement &&
    (el.isContentEditable || el.closest('input, textarea, select, [contenteditable="true"]') !== null)
}

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
  // Dev builds only: the inspector, now that the browser's own keys and menu are gone
  if (import.meta.env.DEV && e.shiftKey && key === 'f12' && isTauri()) {
    e.preventDefault()
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('open_devtools')).catch(() => {})
    return
  }
  if (e.shiftKey && BLOCKED_CTRL_SHIFT_KEYS.has(key)) { e.preventDefault(); return }
  if (e.shiftKey) return
  // Inside text fields keep select-all / copy / paste / undo etc.; Ctrl+F there is harmless too
  if (BLOCKED_CTRL_KEYS.has(key) && !(isEditable(e.target) && key === 'f')) e.preventDefault()
}

const NO_AUTOFILL_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'])

function stopFieldAutofill(el: HTMLInputElement | HTMLTextAreaElement) {
  if (el instanceof HTMLInputElement && NO_AUTOFILL_TYPES.has(el.type)) return
  // Red spell-check squiggles under API keys and tickers look like a web form
  if (!el.hasAttribute('spellcheck')) el.spellcheck = false
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

type MenuEntry = 'Undo' | 'Cut' | 'Copy' | 'Paste' | 'SelectAll'
/** Windows' own wording and shortcuts, used for the greyed-out copies of the built-in items */
const ENTRY_LOOK: Record<MenuEntry, { text: string; accelerator: string }> = {
  Undo: { text: '&Undo', accelerator: 'Ctrl+Z' },
  Cut: { text: 'Cu&t', accelerator: 'Ctrl+X' },
  Copy: { text: '&Copy', accelerator: 'Ctrl+C' },
  Paste: { text: '&Paste', accelerator: 'Ctrl+V' },
  SelectAll: { text: 'Select &All', accelerator: 'Ctrl+A' },
}

/** What the right-clicked field or text allows; null means no menu at all */
function menuFor(target: EventTarget | null): { entry: MenuEntry | 'Separator'; enabled: boolean }[] | null {
  const field = target instanceof Element ? target.closest('input, textarea, [contenteditable="true"]') : null
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field instanceof HTMLInputElement && NO_AUTOFILL_TYPES.has(field.type)) return null
    let selected = false
    try { selected = field.selectionStart !== field.selectionEnd } catch { selected = false } // number/email fields
    const writable = !field.readOnly && !field.disabled
    const secret = field instanceof HTMLInputElement && field.type === 'password'
    return [
      { entry: 'Undo', enabled: writable },
      { entry: 'Separator', enabled: true },
      { entry: 'Cut', enabled: writable && selected && !secret },
      { entry: 'Copy', enabled: selected && !secret },
      { entry: 'Paste', enabled: writable },
      { entry: 'Separator', enabled: true },
      { entry: 'SelectAll', enabled: field.value.length > 0 },
    ]
  }
  const selected = !!window.getSelection()?.toString()
  if (field) {
    return [
      { entry: 'Cut', enabled: selected },
      { entry: 'Copy', enabled: selected },
      { entry: 'Paste', enabled: true },
      { entry: 'Separator', enabled: true },
      { entry: 'SelectAll', enabled: true },
    ]
  }
  return null
}

/** A handful of menu shapes exist, so each is built once and reused */
const menuCache = new Map<string, Promise<{ popup: () => Promise<void> }>>()

async function popupNativeMenu(entries: NonNullable<ReturnType<typeof menuFor>>) {
  const key = entries.map(e => `${e.entry}:${e.enabled ? 1 : 0}`).join('|')
  let menu = menuCache.get(key)
  if (!menu) {
    menu = import('@tauri-apps/api/menu').then(({ Menu }) => Menu.new({
      items: entries.map(({ entry, enabled }) =>
        entry === 'Separator' ? { item: 'Separator' as const }
          // The built-in items do the real Windows edit action on the focused field
          : enabled ? { item: entry }
            : { ...ENTRY_LOOK[entry], enabled: false }),
    }))
    menuCache.set(key, menu)
    menu.catch(() => menuCache.delete(key))
  }
  await (await menu).popup()
}

export function installNativeFeel() {
  watchAutofill()
  installTooltips()

  // Capture phase so nothing in the page can let a browser shortcut through
  window.addEventListener('keydown', onKeyDown, { capture: true })

  // Right-click: never the browser menu (Back / Reload / Save as / Inspect). Text fields get a
  // real Windows edit menu; everything else has none, like other Windows apps.
  window.addEventListener('contextmenu', e => {
    const entries = menuFor(e.target)
    if (!entries || !isTauri()) {
      // In a plain browser (development) text fields keep the browser's menu
      if (!entries) e.preventDefault()
      return
    }
    e.preventDefault()
    popupNativeMenu(entries).catch(() => {})
  }, { capture: true })

  // Page text can't be selected or copied (the CSS already stops highlighting; this also covers
  // double/triple-click, Ctrl+A and anything with its own user-select). Text fields are unaffected,
  // and the app's Copy buttons write to the clipboard directly, so they keep working.
  window.addEventListener('selectstart', e => { if (!isEditable(e.target)) e.preventDefault() }, { capture: true })
  const blockPageCopy = (e: ClipboardEvent) => { if (!isEditable(document.activeElement)) e.preventDefault() }
  window.addEventListener('copy', blockPageCopy, { capture: true })
  window.addEventListener('cut', blockPageCopy, { capture: true })

  // Middle-click auto-scroll (the round scroll cursor)
  window.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault() }, { capture: true })

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
