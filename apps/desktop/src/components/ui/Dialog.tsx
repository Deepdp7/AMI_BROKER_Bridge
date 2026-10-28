/**
 * Animated dialog (springs in, fades out) and an in-app confirm that replaces the browser's
 * plain confirm()/prompt() boxes: `if (await confirmDialog({...})) …`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'

const CLOSE_MS = 180

/** Keeps the content mounted for the closing animation */
function useExitAnimation(open: boolean, ms = CLOSE_MS) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return }
    if (!mounted) return
    setClosing(true)
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, ms)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return { mounted, closing }
}

export function Dialog({ open, onClose, width = 460, top = false, label, children }: {
  open: boolean
  onClose: () => void
  width?: number
  /** Sit near the top (search dialogs, where results grow downwards) */
  top?: boolean
  label?: string
  children: ReactNode
}) {
  const { mounted, closing } = useExitAnimation(open)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    // Capture phase, and stop there: Escape closes only the dialog on top, not a panel behind it
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCloseRef.current() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!mounted) return null
  return createPortal(
    <div className="dlg-backdrop" data-top={top} data-closing={closing} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth: width }}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Title row with an optional icon and a close button */
export function DialogHeader({ title, subtitle, icon, onClose }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; onClose?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', padding: '1.25rem 1.25rem 0' }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#eceef2' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.78rem', color: '#8b9199', marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      {onClose && (
        <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ height: 28, minWidth: 28, padding: 0 }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ===== confirmDialog =====

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' paints the confirm button red */
  tone?: 'danger' | 'primary'
  /** The user must type this word before the confirm button works */
  typeToConfirm?: string
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }
let showConfirm: ((p: Pending) => void) | null = null

/** Resolves true when confirmed, false when cancelled. Falls back to window.confirm without the host. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (!showConfirm) return Promise.resolve(window.confirm(`${opts.title}${typeof opts.message === 'string' ? `\n\n${opts.message}` : ''}`))
  return new Promise(resolve => showConfirm!({ ...opts, resolve }))
}

/** Mounted once (App) to show confirmDialog() requests */
export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    showConfirm = p => { setPending(p); setTyped(''); setOpen(true) }
    return () => { showConfirm = null }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => (pending?.typeToConfirm ? inputRef.current : confirmRef.current)?.focus(), 60)
    return () => clearTimeout(t)
  }, [open, pending])

  const finish = (ok: boolean) => {
    if (!pending || !open) return
    pending.resolve(ok)
    setOpen(false)
  }

  const p = pending
  const danger = p?.tone === 'danger'
  const blocked = !!p?.typeToConfirm && typed.trim().toUpperCase() !== p.typeToConfirm.toUpperCase()
  return (
    <Dialog open={open} onClose={() => finish(false)} width={440} label={p?.title}>
      {p && (
        <form onSubmit={e => { e.preventDefault(); if (!blocked) finish(true) }}>
          <DialogHeader
            title={p.title}
            icon={
              <span className="pop-in" style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: danger ? 'rgba(244,63,94,0.14)' : 'rgb(var(--accent-rgb) / 0.12)',
                border: `1px solid ${danger ? 'rgba(244,63,94,0.35)' : 'rgb(var(--accent-rgb) / 0.3)'}`,
                color: danger ? '#fb7185' : 'var(--accent)',
              }}>
                {danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
              </span>
            }
          />
          <div style={{ padding: '0.75rem 1.25rem 0 calc(1.25rem + 38px + 0.8rem)', fontSize: '0.82rem', color: '#a1a7b0', lineHeight: 1.6 }}>
            {p.message}
            {p.typeToConfirm && (
              <div style={{ marginTop: '0.9rem' }}>
                <label htmlFor="confirm-type" style={{ fontSize: '0.75rem', color: '#8b9199' }}>
                  Type <b style={{ color: '#eceef2', fontFamily: 'JetBrains Mono, monospace' }}>{p.typeToConfirm}</b> to confirm
                </label>
                <input
                  id="confirm-type"
                  ref={inputRef}
                  className="input-field"
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  autoComplete="off"
                  style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '1.25rem' }}>
            <button type="button" className="btn-secondary" onClick={() => finish(false)}>{p.cancelLabel || 'Cancel'}</button>
            <button
              type="submit"
              ref={confirmRef}
              disabled={blocked}
              className={danger ? 'btn-danger btn-danger--solid' : 'btn-primary'}
            >
              {p.confirmLabel || 'Confirm'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

export { useExitAnimation }
