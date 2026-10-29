/**
 * Notices at the top of Symbol Setup:
 *  - CancelledHistoryNotice: some symbols' history download was cancelled from the download card;
 *    the engine skips them (at startup too) until "Download now" allows them again.
 *  - UnknownSymbolsNotice: symbols the broker said it doesn't have, offered for removal.
 */
import { useCallback, useEffect, useState } from 'react'
import { DownloadCloud, Loader, AlertTriangle, Trash2 } from 'lucide-react'
import { api, wsManager } from '../../api/apiClient'
import { useEngineRefresh } from '../../hooks/useApiSync'
import { toast } from '../ui/Toast'

export function CancelledHistoryNotice() {
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.getBackfillStatus().then(s => setCount(Number(s?.cancelled) || 0)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useEngineRefresh(load)
  // A cancel from the download card while this page is open
  useEffect(() => {
    const off = wsManager.on('backfill_control', () => load())
    return () => { off() }
  }, [load])

  if (count === 0) return null

  const downloadNow = async () => {
    setBusy(true)
    try {
      const r = await api.restoreBackfill()
      setCount(0)
      toast.success('Downloading history', `History for ${r.symbols} symbol(s) is queued again.`, 6000)
    } catch (err: any) {
      toast.error('Could not start the download', err?.message || String(err), 6000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      padding: '0.75rem 1rem', borderRadius: 12,
      background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
    }}>
      <DownloadCloud size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220, fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.45 }}>
        <b style={{ color: '#f3f4f6' }}>History download cancelled for {count} symbol{count === 1 ? '' : 's'}.</b>{' '}
        They still get live prices, but past bars won't download until you ask.
      </div>
      <button className="btn-secondary" onClick={downloadNow} disabled={busy}>
        {busy ? <Loader size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
        Download now
      </button>
    </div>
  )
}

/**
 * Symbols the broker said it doesn't have (a word of pasted text taken for a ticker, a contract
 * that no longer exists): they get no prices and no history, so they are offered for removal.
 */
export function UnknownSymbolsNotice({ onRemove }: { onRemove: (tickers: string[]) => Promise<void> }) {
  const [unknown, setUnknown] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.getBackfillStatus().then(s => setUnknown(Array.isArray(s?.unknown) ? s.unknown : [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    // The broker's answer comes while history downloads: looked at again now and then
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])
  useEngineRefresh(load)

  if (unknown.length === 0) return null

  const remove = async () => {
    setBusy(true)
    try {
      await onRemove(unknown)
      toast.success('Removed', `${unknown.length} symbol${unknown.length === 1 ? '' : 's'} the broker doesn't have.`, 4000)
      setUnknown([])
    } catch (err: any) {
      toast.error('Could not remove them', err?.message || String(err), 6000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      padding: '0.75rem 1rem', borderRadius: 12,
      background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.28)',
    }}>
      <AlertTriangle size={18} color="#fb7185" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220, fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.45 }}>
        <b style={{ color: '#f3f4f6' }}>Your broker has no symbol named {unknown.slice(0, 8).join(', ')}{unknown.length > 8 ? ` and ${unknown.length - 8} more` : ''}.</b>{' '}
        They get no prices or history (most likely words from pasted text, or contracts that ended).
      </div>
      <button className="btn-danger" onClick={remove} disabled={busy}>
        {busy ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Remove {unknown.length === 1 ? 'it' : `these ${unknown.length}`}
      </button>
    </div>
  )
}
