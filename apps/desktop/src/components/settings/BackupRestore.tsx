/**
 * Settings → Backup & restore. A backup is one file with every symbol, all history and the
 * settings, for moving to a new PC or keeping safe. Restoring replaces what is here (the current
 * data is kept as a copy) and restarts the data service.
 */
import { useState } from 'react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { Archive, Download, Upload, Loader } from 'lucide-react'
import { api, isApiAvailable, type BackupInfo } from '../../api/apiClient'
import { toast } from '../ui/Toast'

const isTauriApp = !!(window as any).__TAURI_INTERNALS__
const FILTERS = [{ name: 'DataBridge Pro backup', extensions: ['dbpbackup'] }]

/** The sentence inside "API /x failed (400): {"error":"…"}" */
export function friendlyError(e: unknown): string {
  const msg = String((e as any)?.message || e)
  const json = msg.slice(msg.indexOf('{'))
  try { return JSON.parse(json).error || msg } catch { return msg }
}

export function describeBackup(info: BackupInfo): string {
  const when = info.createdAt ? new Date(info.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'an unknown date'
  const size = info.bytes >= 1024 ** 3 ? `${(info.bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(info.bytes / 1024 ** 2))} MB`
  return `${info.symbols.toLocaleString()} symbols · ${info.bars.toLocaleString()} bars · ${size} · saved ${when}`
}

const today = () => new Date().toISOString().slice(0, 10)

/** Waits for the data service to answer again after its restart (up to a minute) */
async function waitForEngine(): Promise<boolean> {
  await new Promise(r => setTimeout(r, 1500))
  for (let i = 0; i < 60; i++) {
    if (await isApiAvailable()) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

export function BackupRestore() {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [pending, setPending] = useState<{ path: string; info: BackupInfo } | null>(null)

  const backup = async () => {
    const path = await save({ title: 'Save a DataBridge Pro backup', defaultPath: `DataBridge backup ${today()}.dbpbackup`, filters: FILTERS })
    if (!path) return
    setBusy('backup')
    try {
      const info = await api.createBackup(path)
      toast.success('Backup saved', describeBackup(info), 7000)
    } catch (e) {
      toast.error('Backup failed', friendlyError(e), 8000)
    } finally {
      setBusy(null)
    }
  }

  const pickRestore = async () => {
    const path = await open({ title: 'Choose a DataBridge Pro backup', multiple: false, directory: false, filters: FILTERS })
    if (!path || typeof path !== 'string') return
    try {
      setPending({ path, info: await api.checkBackup(path) })
    } catch (e) {
      toast.error("Can't restore this file", friendlyError(e), 8000)
    }
  }

  const restore = async () => {
    if (!pending) return
    setBusy('restore')
    try {
      const r = await api.restoreBackup(pending.path)
      setPending(null)
      if (!r.restarting) {
        toast.info('Restore ready', 'Close and open DataBridge Pro again to finish restoring.', 10000)
        return
      }
      toast.info('Restoring…', 'The data service is restarting with the backup.', 5000)
      if (await waitForEngine()) window.location.reload()
      else toast.error('Still restarting', 'The data service has not come back yet. If this lasts, close and open DataBridge Pro.', 10000)
    } catch (e) {
      toast.error('Restore failed', friendlyError(e), 8000)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Archive size={15} style={{ color: 'var(--accent)' }} />
        Backup & restore
      </div>
      <div style={{ fontSize: '0.8rem', color: '#8b9199', lineHeight: 1.55, marginBottom: '0.9rem' }}>
        One file with every symbol, all downloaded history and your settings. Keep it safe, or use it to move
        DataBridge Pro to a new PC without downloading everything again. On a new PC you log in to your broker once more.
      </div>

      {!isTauriApp ? (
        <div style={{ fontSize: '0.78rem', color: '#6b727c' }}>Only available in the desktop app.</div>
      ) : pending ? (
        <div style={{ padding: '0.8rem 0.9rem', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 650, color: '#eceef2' }}>Restore this backup?</div>
          <div style={{ fontSize: '0.78rem', color: '#a1a7b0', marginTop: 4 }}>{describeBackup(pending.info)}</div>
          <div style={{ fontSize: '0.76rem', color: '#8b9199', marginTop: 6, lineHeight: 1.5 }}>
            It replaces every symbol, all history and the settings on this PC. What is here now is kept as a copy
            (databridge.before-restore.db) until the next restore. The data service restarts for a few seconds.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" disabled={busy === 'restore'} onClick={() => setPending(null)}>Keep my current data</button>
            <button className="btn-primary" disabled={busy === 'restore'} onClick={restore} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {busy === 'restore' ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              Restore
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" disabled={busy !== null} onClick={backup} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {busy === 'backup' ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
            {busy === 'backup' ? 'Saving backup… (a long history takes a minute)' : 'Save a backup…'}
          </button>
          <button className="btn-secondary" disabled={busy !== null} onClick={pickRestore} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Upload size={14} />
            Restore from a backup…
          </button>
        </div>
      )}
    </div>
  )
}
