/**
 * A grid that only draws the rows on screen (plus a few around them). With 500 symbols the page
 * otherwise redrew 500 cards on every price update. Rows have a fixed height; the number of
 * columns follows the width like `repeat(auto-fill, minmax(minColWidth, 1fr))`. Scrolling is
 * the page's own (the #route-container), so several grids can sit on one page.
 *
 * Without layout (tests, or before the first measure) every item is drawn as a plain grid.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function VirtualGrid<T>({ items, minColWidth, rowHeight, gap, getKey, render, overscanRows = 3, scrollParentId = 'route-container' }: {
  items: T[]
  minColWidth: number
  rowHeight: number
  gap: number
  getKey: (item: T) => string
  render: (item: T, index: number) => ReactNode
  overscanRows?: number
  scrollParentId?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const canMeasure = typeof ResizeObserver !== 'undefined'
  const [width, setWidth] = useState(0)
  const [range, setRange] = useState<{ first: number; last: number } | null>(null)

  const cols = width > 0 ? Math.max(1, Math.floor((width + gap) / (minColWidth + gap))) : 0
  const rows = cols ? Math.ceil(items.length / cols) : 0
  const stride = rowHeight + gap

  // Width → columns
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Scroll position → which rows are on screen (state changes only when that changes).
  // Layout effect: the first range is known before the first paint.
  useLayoutEffect(() => {
    const el = box.current
    const parent = document.getElementById(scrollParentId)
    if (!el || !parent || !cols) return
    let raf = 0
    const measure = () => {
      raf = 0
      const top = el.getBoundingClientRect().top - parent.getBoundingClientRect().top
      // The part of this grid inside the visible area, in the grid's own coordinates
      const from = Math.max(0, -top), to = parent.clientHeight - top
      const first = Math.max(0, Math.floor(from / stride) - overscanRows)
      const last = Math.min(rows - 1, Math.ceil(to / stride) + overscanRows)
      setRange(r => (r && r.first === first && r.last === last ? r : { first, last }))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    parent.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // Something above opening or closing moves this grid without any scrolling
    const ro = typeof ResizeObserver !== 'undefined' && parent.firstElementChild ? new ResizeObserver(onScroll) : null
    if (ro) ro.observe(parent.firstElementChild!)
    return () => {
      parent.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro?.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cols, rows, stride, overscanRows, scrollParentId])

  // Measuring (a moment before the first paint): an empty box, never all the items
  if (canMeasure && (!cols || !range)) return <div ref={box} style={{ minHeight: rowHeight }} />

  // No layout available (tests): draw everything as a plain grid
  if (!cols || !range) {
    return (
      <div ref={box} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${minColWidth}px, 100%), 1fr))`, gap }}>
        {items.map((item, i) => <div key={getKey(item)} style={{ height: rowHeight }}>{render(item, i)}</div>)}
      </div>
    )
  }

  const firstRow = Math.min(range.first, Math.max(0, rows - 1))
  const lastRow = Math.min(range.last, rows - 1)
  const start = firstRow * cols
  const end = Math.min(items.length, (lastRow + 1) * cols)
  return (
    <div ref={box} style={{ position: 'relative', height: rows ? rows * stride - gap : 0 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${firstRow * stride}px)`,
        display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: rowHeight, gap,
      }}>
        {items.slice(start, end).map((item, i) => <div key={getKey(item)} style={{ height: rowHeight, minWidth: 0 }}>{render(item, start + i)}</div>)}
      </div>
    </div>
  )
}
