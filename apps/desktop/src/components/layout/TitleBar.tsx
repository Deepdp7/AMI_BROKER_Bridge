import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import appIcon from '../../assets/brand/app-icon.png'
import { isTauri, reportMaximizeButtonRect, onMaximizeHover } from '../../lib/nativeWindow'
import './titlebar.css'

interface Props {
  /** Name of the open page, shown after the app name */
  page: string
  /** Left-hand status (API connection) */
  status?: ReactNode
}

type AppWindow = Awaited<ReturnType<typeof getWindow>>
async function getWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

/**
 * The window's own title bar (the native one is turned off in tauri.conf.json): brand, open
 * page, API status and Windows-style minimize / maximize / close. In a plain browser it
 * shows the same information without the window buttons.
 */
export function TitleBar({ page, status }: Props) {
  const native = isTauri()
  const [win, setWin] = useState<AppWindow | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFocused, setIsFocused] = useState(true)
  // Once Windows claims the maximize button for Snap Layouts, CSS :hover stops firing on it:
  // Rust reports the hover instead
  const [snapHover, setSnapHover] = useState(false)
  const maximizeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!native) return
    let stopped = false
    const cleanups: Array<() => void> = []
    getWindow().then(w => {
      if (stopped) return
      setWin(w)
      const sync = () => w.isMaximized().then(setIsMaximized).catch(() => {})
      sync()
      w.onResized(sync).then(un => cleanups.push(un)).catch(() => {})
      w.onFocusChanged(({ payload }) => setIsFocused(payload)).then(un => cleanups.push(un)).catch(() => {})
    })
    return () => {
      stopped = true
      cleanups.forEach(fn => fn())
    }
  }, [native])

  // Keep the Snap Layouts rect (where the maximize button is on screen) up to date
  const syncRect = useCallback(() => { reportMaximizeButtonRect(maximizeRef.current) }, [])
  useEffect(() => {
    if (!native) return
    syncRect()
    const observer = new ResizeObserver(syncRect)
    if (maximizeRef.current) observer.observe(maximizeRef.current)
    window.addEventListener('resize', syncRect)
    let unlisten: (() => void) | undefined
    onMaximizeHover(setSnapHover).then(un => { unlisten = un })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncRect)
      unlisten?.()
    }
  }, [native, syncRect, isMaximized])

  const toggleMaximize = () => { win?.toggleMaximize().catch(() => {}) }

  // Drag the window by the bar; double-click maximizes / restores like a native title bar
  const onBarMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0 || !win) return
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    if (e.detail === 2) toggleMaximize()
    else win.startDragging().catch(() => {})
  }

  return (
    <header
      className={`titlebar${isFocused ? '' : ' is-blurred'}`}
      onMouseDown={native ? onBarMouseDown : undefined}
    >
      {/* Left: API connection status */}
      <div className="titlebar__status" data-no-drag>{status}</div>

      {/* Centre: app name | open page */}
      <div className="titlebar__center">
        <div className="titlebar__brand">
          <img className="titlebar__logo" src={appIcon} alt="" draggable={false} />
          <span className="titlebar__name">DataBridge</span>
          <span className="titlebar__pro gradient-text">PRO</span>
        </div>
        <span className="titlebar__sep" />
        <span className="titlebar__page">{page}</span>
      </div>

      {/* Right: Windows-standard minimize, maximize / restore, close */}
      {native ? (
        <div className={`titlebar__controls${snapHover ? ' is-snap-hover' : ''}`} data-no-drag>
          <button
            className="titlebar__btn titlebar__btn--minimize"
            onClick={() => win?.minimize().catch(() => {})}
            aria-label="Minimize"
            title="Minimize"
            tabIndex={-1}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <path d="M 0,5 L 10,5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            ref={maximizeRef}
            className={`titlebar__btn titlebar__btn--maximize${snapHover ? ' is-snap-hover' : ''}`}
            onClick={toggleMaximize}
            aria-label={isMaximized ? 'Restore Down' : 'Maximize'}
            title={isMaximized ? 'Restore Down' : 'Maximize'}
            tabIndex={-1}
          >
            {isMaximized ? (
              <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M 2.5,2.5 L 2.5,0.5 L 9.5,0.5 L 9.5,7.5 L 7.5,7.5" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            onClick={() => win?.close().catch(() => {})}
            aria-label="Close"
            title="Close DataBridge (stops the data engine; missed data is filled in when you open it again)"
            tabIndex={-1}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <path d="M 0.8,0.8 L 9.2,9.2 M 9.2,0.8 L 0.8,9.2" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      ) : <div />}
    </header>
  )
}
