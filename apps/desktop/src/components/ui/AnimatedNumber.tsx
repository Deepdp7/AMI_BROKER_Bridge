/** A number that counts smoothly to each new value (straight to it when animations are reduced) */
import { useEffect, useRef, useState } from 'react'

const reduced = () => {
  try {
    const m = document.documentElement.dataset.motion
    return m === 'reduced' || (m !== 'full' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch { return false }
}

export function AnimatedNumber({ value, format = n => Math.round(n).toLocaleString('en-IN'), duration = 700, from = 0 }: {
  value: number
  format?: (n: number) => string
  duration?: number
  /** Where the first count starts */
  from?: number
}) {
  const [shown, setShown] = useState(() => (reduced() || typeof requestAnimationFrame === 'undefined' ? value : from))
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (!Number.isFinite(value)) return
    if (reduced() || typeof requestAnimationFrame === 'undefined') { setShown(value); return }
    const start = shownRef.current
    if (start === value) return
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(start + (value - start) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{format(shown)}</>
}
