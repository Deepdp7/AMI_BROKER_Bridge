/**
 * Thin wrappers over the Tauri window APIs. In a plain browser (the UI can also be opened
 * from a web address) every one of these is a no-op.
 */

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Tells Rust where the maximize button is so Windows 11 can offer Snap Layouts over it.
 * Coordinates are physical pixels relative to the client area.
 */
export async function reportMaximizeButtonRect(el: HTMLElement | null) {
  if (!isTauri() || !el) return
  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_maximize_button_rect', {
      left: Math.round(rect.left * dpr),
      top: Math.round(rect.top * dpr),
      right: Math.round(rect.right * dpr),
      bottom: Math.round(rect.bottom * dpr),
    })
  } catch {
    // Only Windows has Snap Layouts; elsewhere the command does not exist
  }
}

/** Subscribes to the hover events Rust sends while Windows owns the cursor over the button. */
export async function onMaximizeHover(handler: (hovered: boolean) => void): Promise<() => void> {
  if (!isTauri()) return () => {}
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return await getCurrentWindow().listen<boolean>('titlebar://maximize-hover', e => handler(e.payload))
  } catch {
    return () => {}
  }
}
