/**
 * Add a whole month of futures at once: every NFO stock future (or index future) of the chosen
 * expiry month, e.g. all ~210 stock futures of November for a full scan in AmiBroker.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Loader, Plus } from 'lucide-react'
import { api } from '../../api/apiClient'
import { confirmDialog } from '../ui/Dialog'
import { toast } from '../ui/Toast'
import { monthLabel, todayIst } from '../../lib/expiry'
import { plural } from '../../lib/format'

type Contract = Awaited<ReturnType<typeof api.listFutures>>['contracts'][number]
const BATCH = 50

export function MonthOfFutures({ brokerId, isAdded, onAdded }: {
  brokerId: string
  isAdded: (ticker: string) => boolean
  onAdded: (contracts: Contract[]) => void
}) {
  const [kind, setKind] = useState<'stock' | 'index'>('stock')
  const [contracts, setContracts] = useState<Contract[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [month, setMonth] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!brokerId) return
    let alive = true
    setContracts(null); setFailed(false)
    Promise.resolve()
      .then(() => api.listFutures(brokerId, kind))
      .then(r => { if (alive) setContracts(r.contracts) })
      .catch(() => { if (alive) { setContracts([]); setFailed(true) } })
    return () => { alive = false }
  }, [brokerId, kind])

  // Months still trading, nearest first
  const today = todayIst()
  const months = useMemo(() => {
    const m = new Map<string, Contract[]>()
    for (const c of contracts || []) {
      if (!c.expiry || c.expiry < today) continue
      const key = c.expiry.slice(0, 7)
      m.set(key, [...(m.get(key) || []), c])
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]))
  }, [contracts, today])
  useEffect(() => { if (months.length && !months.some(([m]) => m === month)) setMonth(months[0][0]) }, [months, month])

  const inMonth = months.find(([m]) => m === month)?.[1] || []
  const fresh = inMonth.filter(c => !isAdded(c.ticker))

  const addAll = async () => {
    if (!fresh.length) return
    if (fresh.length > 10) {
      const ok = await confirmDialog({
        title: `Add ${plural(fresh.length, kind === 'stock' ? 'stock future' : 'index future')} of ${monthLabel(month)}?`,
        message: `They start streaming to AmiBroker at once. Their history downloads in the background, which takes a while for this many (brokers limit how fast history can be fetched); charts fill in as it arrives.`,
        confirmLabel: `Add ${fresh.length}`,
      })
      if (!ok) return
    }
    setProgress({ done: 0, total: fresh.length })
    const added: Contract[] = []
    try {
      for (let i = 0; i < fresh.length; i += BATCH) {
        const batch = fresh.slice(i, i + BATCH)
        await api.addSymbolsToBroker(brokerId, batch)
        added.push(...batch)
        setProgress({ done: added.length, total: fresh.length })
      }
      toast.success('Added', `${plural(added.length, 'future')} of ${monthLabel(month)} added. History is downloading.`, 5000)
    } catch (e: any) {
      toast.error('Some could not be added', `${added.length} of ${fresh.length} added: ${e?.message || e}`)
    } finally {
      if (added.length) onAdded(added)
      setProgress(null)
    }
  }

  if (!brokerId) return null
  return (
    <div className="month-futures">
      <div className="month-futures-head">
        <CalendarClock size={14} color="var(--accent)" />
        <span>Add a whole month of futures</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className="chip" data-on={kind === 'stock'} onClick={() => setKind('stock')} style={{ height: 24, fontSize: '0.68rem' }}>Stock futures</button>
          <button className="chip" data-on={kind === 'index'} onClick={() => setKind('index')} style={{ height: 24, fontSize: '0.68rem' }}>Index futures</button>
        </span>
      </div>
      {contracts === null ? (
        <div className="skeleton" style={{ height: 30, marginTop: 8 }} />
      ) : failed || !months.length ? (
        <div style={{ fontSize: '0.74rem', color: '#8b9199', marginTop: 8 }}>{failed ? "Couldn't read the broker's list of futures." : 'No futures in the broker list right now.'}</div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          {months.map(([m, list]) => (
            <button key={m} className="chip" data-on={m === month} onClick={() => setMonth(m)} style={{ height: 28 }}>
              {monthLabel(m)} <span className="chip-count">{list.length}</span>
            </button>
          ))}
          <button className="btn-primary" style={{ marginLeft: 'auto', padding: '0.35rem 0.8rem', fontSize: '0.76rem' }} disabled={!fresh.length || !!progress} onClick={addAll}>
            {progress
              ? <><Loader size={13} className="animate-spin" /> Adding {progress.done} of {progress.total}…</>
              : fresh.length
                ? <><Plus size={13} /> Add {fresh.length === inMonth.length ? 'all' : 'the'} {fresh.length}{fresh.length < inMonth.length ? ' not added yet' : ''}</>
                : 'All added'}
          </button>
        </div>
      )}
    </div>
  )
}
