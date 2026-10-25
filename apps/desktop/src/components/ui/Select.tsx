import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react'
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  /** Optional leading element (e.g. a coloured broker tag). */
  leading?: ReactNode
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  id?: string
  width?: number | string
  height?: number
  fontSize?: string
  placeholder?: string
}

const MENU_MAX_HEIGHT = 280
const MENU_GAP = 6

interface MenuPos { top?: number; bottom?: number; left: number; width: number; maxHeight: number }

export default function Select({
  value, options, onChange, id, width = '100%', height, fontSize, placeholder = 'Select…',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selectedIdx = options.findIndex(o => o.value === value)
  const selected = selectedIdx >= 0 ? options[selectedIdx] : undefined

  const close = useCallback((refocus = false) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const openMenu = () => {
    setActive(selectedIdx >= 0 ? selectedIdx : 0)
    setOpen(true)
  }

  const choose = (idx: number) => {
    onChange(options[idx].value)
    close(true)
  }

  // Position the menu against the trigger; flip upward when there's no room below.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - MENU_GAP - 8
    const above = r.top - MENU_GAP - 8
    const wanted = Math.min(MENU_MAX_HEIGHT, options.length * 38 + 12)
    if (below >= wanted || below >= above) {
      setPos({ top: r.bottom + MENU_GAP, left: r.left, width: r.width, maxHeight: Math.min(MENU_MAX_HEIGHT, below) })
    } else {
      setPos({ bottom: window.innerHeight - r.top + MENU_GAP, left: r.left, width: r.width, maxHeight: Math.min(MENU_MAX_HEIGHT, above) })
    }
  }, [open, options.length])

  // Close on outside click, resize, or scrolling anything other than the menu itself.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      close()
    }
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  // Keep the keyboard-active row in view.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, pos])

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); break
      case 'ArrowUp':   e.preventDefault(); setActive(i => Math.max(0, i - 1)); break
      case 'Home':      e.preventDefault(); setActive(0); break
      case 'End':       e.preventDefault(); setActive(options.length - 1); break
      case 'Enter':
      case ' ':         e.preventDefault(); choose(active); break
      case 'Escape':    e.preventDefault(); close(true); break
      case 'Tab':       close(); break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`input-field select-trigger${open ? ' is-open' : ''}`}
        style={{ width, height, fontSize }}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">
          {selected ? (
            <>
              {selected.leading}
              <span className="select-label">{selected.label}</span>
            </>
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={15} className="select-chevron" />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          className="select-menu"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
        >
          {options.map((o, i) => {
            const isSel = o.value === value
            return (
              <div
                key={o.value}
                data-idx={i}
                role="option"
                aria-selected={isSel}
                className={`select-option${i === active ? ' is-active' : ''}${isSel ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {o.leading}
                <span className="select-label">{o.label}</span>
                {isSel && <Check size={14} className="select-check" />}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
