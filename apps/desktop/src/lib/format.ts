/** Small formatting helpers shared by the pages */

/** "Just now", "42s ago", "9h 26m ago", "3d ago" */
export function formatAgo(ms: number, now = Date.now()): string {
  if (!ms) return '—'
  const s = Math.max(0, Math.floor((now - ms) / 1000))
  if (s < 2) return 'Just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** A duration in seconds: "45s", "12m", "2h 05m", "3d 4h" */
export function formatDuration(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

/** 1234 → "1.2K", 4_300_000 → "4.3M" */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export const formatPrice = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function plural(n: number, one: string, many = one + 's') {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}
