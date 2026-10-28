/**
 * CancelledHistoryNotice
 * Shown in Symbol Setup while some symbols' history download was cancelled from the download
 * card: the engine skips them (at startup too) until "Download now" allows them again.
 */
import { useCallback, useEffect, useState } from 'react'
import { DownloadCloud, Loader } from 'lucide-react'
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
