import { useEffect, useState } from 'react'
import { CheckCircle, FileSpreadsheet, Blocks, Search } from 'lucide-react'
import { Dialog, DialogHeader } from '../ui/Dialog'
import { toast } from '../ui/Toast'
import { PLATFORM_LOGOS, LEVEL_LABEL, platformsApi, setPlatformsState, type PlatformInfo, type PlatformId } from '../../lib/platforms'

/** A platform's mark: its own icon, or its initials (a file icon for plain CSV) */
export function PlatformLogo({ id, name, size = 36 }: { id: PlatformId; name: string; size?: number }) {
  const src = PLATFORM_LOGOS[id]
  if (src) {
    return (
      <span className="broker-logo" style={{ width: size, height: size, borderRadius: '24%' }}>
        <img src={src} alt={`${name} logo`} draggable={false} />
      </span>
    )
  }
  return (
    <span className="broker-logo is-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-label={name}>
      {id === 'csv' ? <FileSpreadsheet size={size * 0.55} /> : name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function LevelTag({ p }: { p: PlatformInfo }) {
  const l = LEVEL_LABEL[p.level]
  return (
    <span title={l.title} style={{ fontSize: '0.64rem', fontWeight: 700, color: l.color, border: `1px solid ${l.color}`, borderRadius: 999, padding: '1px 7px', opacity: 0.9, whiteSpace: 'nowrap' }}>
      {l.text}
    </span>
  )
}

/**
 * "Which platforms do you use?": shown once on first start, and from the Platforms page.
 * Platforms found on this PC are ticked to begin with.
 */
export function PlatformPicker({ open, platforms, chosen, onClose }: { open: boolean; platforms: PlatformInfo[]; chosen: PlatformId[]; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<PlatformId>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    // First time: what is on this PC (desktop programs), else what was chosen before
    const start = chosen.length ? chosen : platforms.filter(p => p.kind === 'desktop' && p.installed).map(p => p.id)
    setPicked(new Set(start.length ? start : ['amibroker']))
  }, [open, platforms, chosen])

  const toggle = (id: PlatformId) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const save = async () => {
    setSaving(true)
    try {
      // In the order the platforms are listed
      const ids = platforms.map(p => p.id).filter(id => picked.has(id))
      await platformsApi.choose(ids)
      setPlatformsState(s => ({ ...s, chosen: ids, asked: true }))
      onClose()
    } catch (e: any) {
      toast.error('Could not save', e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const found = platforms.filter(p => p.kind === 'desktop' && p.installed).length

  return (
    <Dialog open={open} onClose={onClose} width={640} label="Choose your platforms">
      <DialogHeader
        title="Where do you look at charts?"
        subtitle={`Pick every platform you use: DataBridge Pro sets each one up. ${found ? `${found} found on this PC ${found === 1 ? 'is' : 'are'} ticked already.` : ''}`}
        icon={<span className="page-icon"><Blocks size={18} /></span>}
        onClose={onClose}
      />
      <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '0.6rem' }}>
          {platforms.map(p => {
            const on = picked.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={p.name}
                className="platform-pick"
                data-on={on}
                onClick={() => toggle(p.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%' }}>
                  <PlatformLogo id={p.id} name={p.name} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 650, color: '#eceef2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    <span style={{ display: 'block', marginTop: 3 }}><LevelTag p={p} /></span>
                  </span>
                  <span className="platform-pick-check" aria-hidden="true">{on && <CheckCircle size={16} />}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7, fontSize: '0.66rem', color: p.kind !== 'desktop' ? '#6b727c' : p.installed ? 'var(--good)' : '#6b727c' }}>
                  {p.kind === 'web' ? 'Website' : p.kind === 'file' ? 'Files' : p.installed ? <><Search size={10} /> Found on this PC</> : 'Not found on this PC'}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#6b727c', lineHeight: 1.55, marginTop: '0.9rem' }}>
          Each one gets everything it can take. TradingView and Chartink run on their own data and can't load another feed, so your
          symbol lists and charts go back and forth instead. NinjaTrader and MetaStock only take history files imported by hand, and
          Sierra Chart's live feed needs its own protocol (not built yet). You can change this any time in Platforms.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Later</button>
          <button className="btn-primary" onClick={save} disabled={saving || picked.size === 0} style={{ flex: 2, justifyContent: 'center' }}>
            {picked.size ? `Use ${picked.size} platform${picked.size === 1 ? '' : 's'}` : 'Pick at least one'}
          </button>
        </div>
      </div>
      <style>{`
        .platform-pick { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; padding: 0.7rem;
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); transition: border-color .2s, background .2s, transform .2s; }
        .platform-pick:hover { transform: translateY(-1px); border-color: rgb(var(--accent-rgb) / 0.3); }
        .platform-pick[data-on="true"] { border-color: rgb(var(--accent-rgb) / 0.65); background: rgb(var(--accent-rgb) / 0.07); box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.35); }
        .platform-pick:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .platform-pick-check { width: 18px; height: 18px; color: var(--accent); display: inline-flex; }
      `}</style>
    </Dialog>
  )
}
