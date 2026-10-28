/**
 * Data health in Symbol Setup: a summary above the list ("480 complete · 12 missing days")
 * with Repair all, and one line on each symbol card. Repair re-checks a symbol's whole history
 * with the broker and downloads whatever is missing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HeartPulse, Wrench, Loader } from 'lucide-react'
import { api, wsManager, type SymbolHealth } from '../../api/apiClient'
import { useEngineRefresh } from '../../hooks/useApiSync'
import { toast } from '../ui/Toast'

export type { SymbolHealth }

/** The last picture, kept while the app runs: coming back to Symbol Setup shows it at once */
let lastList: SymbolHealth[] | null = null

/** Loads health for every symbol; refreshes on the 60 s resync and shortly after downloads finish */
export function useDataHealth() {
  const [list, setList] = useState<SymbolHealth[] | null>(lastList)
  const [repairing, setRepairing] = useState<Set<string> | 'all' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(() => {
    api.getSymbolHealth().then(r => {
      lastList = r.symbols
      setList(r.symbols)
      // The engine sent an older picture for speed and is working out a new one: look again shortly
      if (r.fresh === false && !retry.current) {
        retry.current = setTimeout(() => { retry.current = null; load() }, 3000)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useEngineRefresh(load)
  useEffect(() => {
    // Downloads finishing change the picture: look again a moment later (once per burst)
    const soon = () => {
      if (timer.current) return
      timer.current = setTimeout(() => { timer.current = null; load() }, 4000)
    }
    // (retry timer is cleared below with the other one)
    const offDone = wsManager.on('backfill_completed', soon)
    const offControl = wsManager.on('backfill_control', soon)
    return () => {
      offDone(); offControl()
      if (timer.current) clearTimeout(timer.current)
      if (retry.current) { clearTimeout(retry.current); retry.current = null }
    }
  }, [load])

  const byTicker = useMemo(() => new Map((list ?? []).map(h => [h.ticker, h])), [list])

  const repair = useCallback(async (tickers?: string[]) => {
    setRepairing(tickers ? new Set(tickers) : 'all')
    try {
      const r = await api.repairSymbols(tickers)
      if (r.queued > 0) toast.success('Repair started', `Downloading what is missing for ${r.queued} symbol${r.queued === 1 ? '' : 's'}. Progress shows on the download card.`, 6000)
      else if (r.noBroker > 0) toast.error('Nothing could be repaired', 'Their broker is not connected. Log in on Broker Connection, then try again.', 7000)
      else toast.info('Already complete', 'Nothing is missing that the broker can provide.', 5000)
    } catch (e: any) {
      toast.error('Repair failed', e?.message || String(e))
    } finally {
      setRepairing(null)
      load()
    }
  }, [load])

  const isRepairing = (ticker: string) => repairing === 'all' || (repairing instanceof Set && repairing.has(ticker))
  return { list, byTicker, repair, isRepairing, repairingAll: repairing === 'all' }
}

export const needsAttention = (h?: SymbolHealth) => !!h && (h.status === 'missing' || h.status === 'empty')

function plural(n: number, one: string, many = one + 's') {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

/** Summary above the symbol list */
export function DataHealthSummary({ list, onRepairAll, repairing, onlyProblems, setOnlyProblems }: {
  list: SymbolHealth[] | null
  onRepairAll: () => void
  repairing: boolean
  onlyProblems: boolean
  setOnlyProblems: (v: boolean) => void
}) {
  if (!list || list.length === 0) return null
  const count = (s: SymbolHealth['status']) => list.filter(h => h.status === s).length
  const complete = count('complete'), downloading = count('downloading'), cancelled = count('cancelled')
  const problems = list.filter(h => needsAttention(h)).length
  const missingDays = list.reduce((n, h) => n + (h.status === 'missing' ? h.missingDays : 0), 0)

  const parts = [
    `${plural(complete, 'symbol')} complete`,
    problems ? `${plural(problems, 'symbol')} with missing history${missingDays ? ` (${plural(missingDays, 'day')})` : ''}` : '',
    downloading ? `${plural(downloading, 'symbol')} downloading` : '',
    cancelled ? `${plural(cancelled, 'symbol')} cancelled` : '',
  ].filter(Boolean)

  const color = problems ? '#f59e0b' : downloading ? '#38bdf8' : '#22c55e'
  return (
    <div className="glass-card" style={{ padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <HeartPulse size={18} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 650, color: '#eceef2' }}>
          {problems ? 'Some history is missing' : downloading ? 'History is downloading' : 'All history is complete'}
        </div>
        <div style={{ fontSize: '0.76rem', color: '#8b9199', marginTop: 2 }}>{parts.join(' · ')}</div>
      </div>
      {problems > 0 && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: '#a1a7b0', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Show only these
          </label>
          <button className="btn-secondary" onClick={onRepairAll} disabled={repairing} style={{ padding: '0.4rem 0.8rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {repairing ? <Loader size={13} className="animate-spin" /> : <Wrench size={13} />}
            Repair all ({problems})
          </button>
        </>
      )}
    </div>
  )
}

const LINE: Record<SymbolHealth['status'], { color: string; text: (h: SymbolHealth) => string }> = {
  complete: { color: '#22c55e', text: () => 'History complete' },
  missing: { color: '#f59e0b', text: h => h.missingDays > 0 ? `${plural(h.missingDays, 'day')} missing` : 'Older history missing' },
  downloading: { color: '#38bdf8', text: () => 'Downloading history…' },
  cancelled: { color: '#8b9199', text: () => 'History cancelled' },
  empty: { color: '#f43f5e', text: () => 'No history yet' },
}

function tooltip(h: SymbolHealth): string {
  const lines: string[] = []
  if (h.firstDay) lines.push(`History from ${h.firstDay} to ${h.lastDay} · ${h.bars.toLocaleString()} bars`)
  if (h.missingSample.length) lines.push(`Missing: ${h.missingSample.join(', ')}${h.missingDays > h.missingSample.length ? ' …' : ''}`)
  if (h.olderMissing) lines.push('The history depth in Settings reaches further back than what is stored')
  return lines.join('\n')
}

/** The health line on one symbol card */
export function HealthLine({ health, onRepair, repairing, loading = false }: { health?: SymbolHealth; onRepair: () => void; repairing: boolean; loading?: boolean }) {
  if (!health) {
    // Not known yet: a quiet placeholder in the same place, so the card doesn't look unfinished
    // and nothing jumps when the real line arrives
    return loading ? (
      <div aria-hidden className="health-checking" style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#575d66' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3a3f46', flexShrink: 0 }} />
        <span>Checking history…</span>
      </div>
    ) : null
  }
  const look = LINE[health.status]
  return (
    <div title={tooltip(health)} style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: look.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: look.color, flexShrink: 0 }} />
      <span>{look.text(health)}</span>
      {needsAttention(health) && (
        <button
          onClick={e => { e.stopPropagation(); onRepair() }}
          disabled={repairing}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent)', cursor: repairing ? 'default' : 'pointer', fontSize: '0.7rem', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
        >
          {repairing ? <Loader size={11} className="animate-spin" /> : <Wrench size={11} />}
          Repair
        </button>
      )}
    </div>
  )
}
