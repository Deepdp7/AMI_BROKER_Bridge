/** A row of choices with a highlight that slides to the chosen one */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface SegOption<T> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string | number>({ value, onChange, options, ariaLabel, id }: {
  value: T
  onChange: (v: T) => void
  options: SegOption<T>[]
  ariaLabel?: string
  id?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const box = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null)
  const index = options.findIndex(o => o.value === value)

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[index]
      setThumb(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
    }
    measure()
    // Fonts arriving late, or the control first showing inside a section that was closed
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && box.current) ro.observe(box.current)
    return () => ro?.disconnect()
  }, [index, options.length])

  return (
    <div ref={box} className="seg" role="radiogroup" aria-label={ariaLabel} id={id}>
      {thumb && thumb.w > 0 && <span className="seg-thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} />}
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={el => { refs.current[i] = el }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="seg-btn"
          data-on={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
