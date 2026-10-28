/** A tiny line chart with a soft fill under it */
import { useId } from 'react'

export function Sparkline({ data, color = 'var(--accent)', width = 120, height = 32, fill = true }: {
  data: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
}) {
  const id = useId().replace(/:/g, '')
  if (data.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    pad + (height - pad * 2) * (1 - (v - min) / range),
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#sg${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.4" fill={color} />
    </svg>
  )
}
