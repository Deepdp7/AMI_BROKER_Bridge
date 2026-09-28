/**
 * Toast Notification System
 * Global notification component with auto-dismiss and action support
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // ms, 0 = persistent
  action?: { label: string; onClick: () => void }
}

// ===== Global Toast Manager (singleton) =====
type ToastListener = (toasts: Toast[]) => void
const listeners = new Set<ToastListener>()
let toastList: Toast[] = []

const notify = (toasts: Toast[]) => {
  toastList = toasts
  listeners.forEach(fn => fn(toasts))
}

export const toast = {
  success: (title: string, message?: string, duration = 4000, action?: Toast['action']) =>
    toast._add({ type: 'success', title, message, duration, action }),
  warning: (title: string, message?: string, duration = 5000, action?: Toast['action']) =>
    toast._add({ type: 'warning', title, message, duration, action }),
  error: (title: string, message?: string, duration = 6000, action?: Toast['action']) =>
    toast._add({ type: 'error', title, message, duration, action }),
  info: (title: string, message?: string, duration = 4000, action?: Toast['action']) =>
    toast._add({ type: 'info', title, message, duration, action }),
  dismiss: (id: string) => notify(toastList.filter(t => t.id !== id)),
  _add: (t: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    notify([...toastList, { ...t, id }])
    if (t.duration && t.duration > 0) {
      setTimeout(() => toast.dismiss(id), t.duration)
    }
    return id
  },
}

// ===== Toast Item =====
const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}
const COLORS: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
  success: { bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.2)', icon: '#00d4aa', bar: '#00d4aa' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '#f59e0b', bar: '#f59e0b' },
  error: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', icon: '#f43f5e', bar: '#f43f5e' },
  info: { bg: 'rgba(107,128,153,0.08)', border: 'rgba(107,128,153,0.2)', icon: '#94a3b8', bar: '#94a3b8' },
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const Icon = ICONS[t.type]
  const c = COLORS[t.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      id={`toast-${t.id}`}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.75rem',
        padding: '0.875rem 1rem',
        minWidth: '300px',
        maxWidth: '380px',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <Icon size={18} color={c.icon} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2eaf4' }}>{t.title}</div>
          {t.message && (
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem', lineHeight: 1.5 }}>{t.message}</div>
          )}
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); onDismiss() }}
              style={{
                marginTop: '0.5rem',
                background: 'none', border: `1px solid ${c.border}`,
                color: c.icon, borderRadius: '0.375rem',
                padding: '0.25rem 0.625rem', fontSize: '0.75rem',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#6b8099', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {t.duration && t.duration > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
          background: 'rgba(255,255,255,0.05)',
        }}>
          <div style={{
            height: '100%',
            background: c.bar,
            animation: `toast-shrink ${t.duration}ms linear forwards`,
          }} />
        </div>
      )}
    </div>
  )
}

// ===== Toast Container =====
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const latestToastsRef = useRef(toasts)
  latestToastsRef.current = toasts

  const handleUpdate = useCallback((updated: Toast[]) => {
    setToasts([...updated])
  }, [])

  useEffect(() => {
    listeners.add(handleUpdate)
    return () => { listeners.delete(handleUpdate) }
  }, [handleUpdate])

  if (toasts.length === 0) return null

  return (
    <div
      id="toast-container"
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem t={t} onDismiss={() => toast.dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
