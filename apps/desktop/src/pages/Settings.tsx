import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAppStore, type AppSettings } from '../store/appStore'
import {
  Settings as SettingsIcon, FolderOpen, Save, CheckCircle, Copy, Terminal, Database, Sliders, Activity,
  RefreshCw, AlertTriangle, Trash2, Search, X, Sparkles, Archive, Timer, ChevronDown, Plug, Loader, Undo2,
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { api, isApiAvailable } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import { BackupRestore } from '../components/settings/BackupRestore'
import { PageHeader } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { confirmDialog } from '../components/ui/Dialog'
import { locateAmiBroker } from '../lib/amibroker'
import { usePref, applyMotionPref, applyTheme, THEMES, type MotionPref, type ThemePref } from '../hooks/usePref'

// ===== Search =====
const QueryCtx = createContext('')

/** Every word of the search appears somewhere in the text */
export function matchesQuery(text: string, q: string): boolean {
  const t = text.toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => t.includes(w))
}

// One list drives the side menu, the search and the sections
const SECTIONS = [
  { id: 'connection', title: 'AmiBroker connection', icon: Plug, find: 'plugin url port 7890 7891 copy check test data service address live' },
  { id: 'amibroker', title: 'AmiBroker path & launch', icon: FolderOpen, find: 'installation folder path open automatically start launch' },
  { id: 'startup', title: 'Startup', icon: Sliders, find: 'start with windows tray sign in boot' },
  { id: 'relogin', title: 'Daily broker login', icon: RefreshCw, find: 'auto re-login relogin token time fyers morning open the login page ist weekday' },
  { id: 'history', title: 'History', icon: Database, find: 'history depth years backfill use all connected brokers download speed faster 1y 2y 3y 5y max bars' },
  { id: 'appearance', title: 'Appearance', icon: Sparkles, find: 'colour color theme accent green blue purple violet orange ember ocean emerald dark look appearance animations motion effects reduce reduced full transitions' },
  { id: 'backup', title: 'Backup & restore', icon: Archive, find: 'backup restore save file move new pc' },
  { id: 'diagnostics', title: 'Diagnostics', icon: Activity, find: 'log level detail retention keep logs debug info warnings errors days' },
  { id: 'advanced', title: 'Advanced timing', icon: Timer, find: 'late tick tolerance clock skew difference warning seconds' },
  { id: 'danger', title: 'Danger zone', icon: AlertTriangle, find: 'clean database factory reset delete wipe remove everything' },
] as const
type SectionId = typeof SECTIONS[number]['id']
const META = Object.fromEntries(SECTIONS.map(s => [s.id, s])) as Record<SectionId, typeof SECTIONS[number]>

function Section({ id, index, children, tone }: { id: SectionId; index: number; children: React.ReactNode; tone?: 'danger' }) {
  const q = useContext(QueryCtx)
  const meta = META[id]
  if (q && !matchesQuery(`${meta.title} ${meta.find}`, q)) return null
  const Icon = meta.icon
  const color = tone === 'danger' ? '#ff5a6a' : 'var(--accent)'
  return (
    <section
      id={`set-${id}`}
      className="glass-card reveal settings-section"
      style={{ ['--i' as any]: index, padding: '1.2rem 1.25rem', scrollMarginTop: '1rem', border: tone === 'danger' ? '1px solid rgba(255,60,60,0.28)' : undefined }}
    >
      <div style={{ fontSize: '0.76rem', fontWeight: 750, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <span style={{ display: 'inline-flex', padding: 6, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33` }}><Icon size={14} /></span>
        {meta.title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
    </section>
  )
}

function SettingRow({ label, description, keywords = '', children }: { label: string; description?: React.ReactNode; keywords?: string; children?: React.ReactNode }) {
  // A search hides whole sections (their keywords cover their rows) and lights up the rows it found
  const q = useContext(QueryCtx)
  const hit = !!q && matchesQuery(`${label} ${typeof description === 'string' ? description : ''} ${keywords}`, q)
  return (
    <div className={hit ? 'setting-row setting-hit' : 'setting-row'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem', padding: '0.15rem 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', color: '#eceef2', fontWeight: 550 }}>{label}</div>
        {description && <div style={{ fontSize: '0.76rem', color: '#8b9199', marginTop: '0.25rem', lineHeight: 1.5 }}>{description}</div>}
      </div>
      {children && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

/** Colour theme cards: a little preview of each theme's background, panel and accent */
function ThemePicker({ value, onChange }: { value: ThemePref; onChange: (t: ThemePref) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem', marginTop: '0.75rem' }}>
      {THEMES.map(t => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.id)}
            className="lift"
            style={{
              textAlign: 'left', padding: '0.55rem', borderRadius: 12, cursor: 'pointer', color: 'inherit',
              background: on ? 'rgb(var(--accent-rgb) / 0.08)' : 'rgb(var(--s1-rgb) / 0.6)',
              border: `1px solid ${on ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: on ? '0 0 0 3px rgb(var(--accent-rgb) / 0.14)' : 'none',
              transition: 'border-color .2s, box-shadow .2s, background .2s',
            }}
          >
            {/* Miniature of the app: sidebar, a card and an accent button */}
            <div aria-hidden style={{ position: 'relative', height: 62, borderRadius: 8, background: t.bg, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', gap: 5, padding: 6 }}>
              <div style={{ width: 16, borderRadius: 4, background: t.panel }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 8, width: '55%', borderRadius: 3, background: t.accent }} />
                <div style={{ flex: 1, borderRadius: 4, background: t.panel }} />
              </div>
              {on && (
                <span style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: 99, background: t.accent, color: '#0e0e0e', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>✓</span>
              )}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', fontWeight: 650, color: '#eceef2' }}>{t.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#8b9199' }}>{t.note}</div>
          </button>
        )
      })}
    </div>
  )
}

const HISTORY_PRESETS = [
  { label: '1Y', days: 365, title: '1 year' },
  { label: '2Y', days: 730, title: '2 years' },
  { label: '3Y', days: 1095, title: '3 years' },
  { label: '5Y', days: 1825, title: '5 years' },
  { label: 'Max', days: 3650, title: 'Everything the broker has (Fyers 1-minute data goes back to about 2018)' },
]

/** Settings that only count once saved to the engine (Start with Windows applies at once) */
const SAVED_KEYS: (keyof AppSettings)[] = [
  'amiBrokerPath', 'autoStartAmiBroker', 'dailyReloginEnabled', 'dailyReloginTime', 'backfillDepthDays',
  'historyUseAllBrokers', 'logLevel', 'logRetentionDays', 'lateToleranaceSeconds', 'clockSkewThresholdSeconds',
]

/** Which of the saved keys differ between what's on screen and what the engine has */
export function changedKeys(current: Partial<AppSettings>, saved: Partial<AppSettings> | null): (keyof AppSettings)[] {
  if (!saved) return []
  return SAVED_KEYS.filter(k => saved[k] !== undefined && JSON.stringify(current[k]) !== JSON.stringify(saved[k]))
}

const isTauriApp = !!(window as any).__TAURI_INTERNALS__

function CopyBox({ label, shown, color, copied, onCopy }: { label: string; shown: string; color: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ background: 'rgb(var(--s0-rgb) / 0.6)', padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.72rem', color: '#8b9199', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.86rem', color, fontWeight: 650 }}>{shown}</span>
        <button className="icon-btn" data-on={copied} onClick={onCopy} style={{ height: 28 }}>
          {copied ? <CheckCircle size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const settings = useAppStore(s => s.settings)
  const updateSettings = useAppStore(s => s.updateSettings)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<SectionId>('connection')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [copied, setCopied] = useState<'url' | 'port' | null>(null)
  const [check, setCheck] = useState<{ state: 'idle' | 'checking' | 'ok' | 'down'; ms?: number }>({ state: 'idle' })
  const [motion, setMotion] = usePref<MotionPref>('motion', 'auto')
  const [theme, setTheme] = usePref<ThemePref>('theme', 'emerald')

  // What the engine has saved: the "unsaved changes" bar compares against it
  const [saved, setSaved] = useState<Partial<AppSettings> | null>(null)
  useEffect(() => { api.getSettings().then(s => setSaved(s as any)).catch(() => setSaved(null)) }, [])
  const dirtyKeys = changedKeys(settings, saved)
  const dirty = dirtyKeys.length > 0

  // Start with Windows: the real Windows startup entry, applied at once (not via Save)
  const [autostart, setAutostart] = useState<boolean | null>(null)
  useEffect(() => {
    if (isTauriApp) invoke<boolean>('get_autostart').then(setAutostart).catch(() => setAutostart(false))
  }, [])
  const changeAutostart = async (enabled: boolean) => {
    try {
      const now = await invoke<boolean>('set_autostart', { enabled })
      setAutostart(now)
      updateSettings({ autoStartWithWindows: now })
      if (now) toast.success('Starts with Windows', 'DataBridge Pro will open quietly in the tray next to the clock when you sign in.', 5000)
      else toast.info('Start with Windows is off', 'DataBridge Pro will only open when you start it.', 4000)
    } catch (e: any) {
      toast.error('Could not change Start with Windows', String(e?.message || e))
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (await isApiAvailable()) {
        const result = await api.updateSettings(useAppStore.getState().settings)
        setSaved(result as any)
        toast.success('Settings saved', 'The data service is using them now.', 3000)
      } else {
        toast.info('Saved on this screen only', 'The data service is offline; press Save again once it is back.', 4000)
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (e) {
      toast.error('Save failed', 'Could not update settings on the data service.')
      console.error('Failed to save settings:', e)
    } finally {
      setSaving(false)
    }
  }, [])

  const discard = () => {
    if (!saved) return
    updateSettings(Object.fromEntries(dirtyKeys.map(k => [k, saved[k]])) as Partial<AppSettings>)
    toast.info('Changes discarded', undefined, 2000)
  }

  // Ctrl+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  // The side menu follows the scrolling
  useEffect(() => {
    const root = document.getElementById('route-container')
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id.replace('set-', '') as SectionId)
    }, { root, rootMargin: '-15% 0px -70% 0px' })
    document.querySelectorAll('.settings-section').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [query, showAdvanced])

  const goTo = (id: SectionId) => {
    if (id === 'advanced') setShowAdvanced(true)
    document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  const visibleSections = useMemo(() => SECTIONS.filter(s => !query || matchesQuery(`${s.title} ${s.find}`, query)), [query])

  const handleCleanDatabase = async () => {
    const ok = await confirmDialog({
      title: 'Clean the database?',
      message: 'This deletes every symbol, all downloaded history, mappings and download progress. Broker logins stay. Save a backup first if you may need any of it.',
      confirmLabel: 'Clean database',
      tone: 'danger',
      typeToConfirm: 'CLEAN',
    })
    if (!ok) return
    try {
      await api.cleanDatabase()
      toast.success('Database cleaned', 'All data has been removed.', 5000)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      toast.error('Clean failed', 'Failed to clean database: ' + (e.message || String(e)))
    }
  }

  const handleFullForceClean = async () => {
    const ok = await confirmDialog({
      title: 'Factory reset?',
      message: 'DataBridge Pro goes back to how it was on first launch: brokers, keys, symbols, history and settings are all deleted.',
      confirmLabel: 'Reset everything',
      tone: 'danger',
      typeToConfirm: 'RESET',
    })
    if (!ok) return
    try {
      await api.fullForceClean()
      toast.success('Factory reset', 'Everything was removed. Starting fresh…', 5000)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      toast.error('Reset failed', 'Failed to run full force clean: ' + (e.message || String(e)))
    }
  }

  const copy = (text: string, what: 'url' | 'port') => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(what)
    setTimeout(() => setCopied(null), 1800)
  }

  const checkConnection = async () => {
    setCheck({ state: 'checking' })
    const t0 = performance.now()
    const ok = await isApiAvailable()
    setCheck({ state: ok ? 'ok' : 'down', ms: Math.round(performance.now() - t0) })
  }

  const [finding, setFinding] = useState(false)
  const findAmiBroker = async () => {
    setFinding(true)
    try {
      const exe = await locateAmiBroker()
      if (exe) toast.success('AmiBroker found', exe)
      else toast.error('AmiBroker not found', 'It is not installed on this PC, or not where it can be read. Choose its folder with the folder button.')
    } catch (e: any) {
      toast.error('Search failed', String(e?.message || e))
    } finally {
      setFinding(false)
    }
  }

  const handlePickFolder = async () => {
    try {
      if (isTauriApp) {
        const selectedPath = await open({ directory: true, multiple: false, title: 'Select AmiBroker Installation Folder' })
        if (selectedPath && typeof selectedPath === 'string') updateSettings({ amiBrokerPath: selectedPath })
      } else {
        const res = await api.pickFolder()
        if (res.path) updateSettings({ amiBrokerPath: res.path })
      }
    } catch (e) {
      toast.error('Failed', 'Could not open folder picker')
      console.error(e)
    }
  }

  const changeMotion = (m: MotionPref) => { setMotion(m); applyMotionPref(m) }
  const changeTheme = (t: ThemePref) => { setTheme(t); applyTheme(t, true) }
  const bars = Math.round(settings.backfillDepthDays * 0.69 * 375)

  let i = 1
  return (
    <QueryCtx.Provider value={query.trim()}>
      <div className="settings-layout">
        {/* Side menu */}
        <aside className="settings-nav reveal">
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#8b9199' }} />
            <input
              id="settings-search"
              className="input-field"
              placeholder="Search settings"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
              style={{ paddingLeft: '2rem', paddingRight: '1.8rem', height: 34, fontSize: '0.8rem' }}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b9199', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map(s => {
              const shown = visibleSections.includes(s)
              const Icon = s.icon
              return (
                <button key={s.id} className="settings-nav-item" data-on={active === s.id} data-dim={!shown} disabled={!shown} onClick={() => goTo(s.id)}>
                  <Icon size={14} /> {s.title}
                </button>
              )
            })}
          </nav>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', minWidth: 0, paddingBottom: dirty ? '5rem' : 0 }}>
          <PageHeader
            icon={SettingsIcon}
            title="Settings"
            subtitle="How DataBridge Pro connects to AmiBroker, starts up and downloads history"
            actions={
              <button id="save-settings-btn" onClick={handleSave} disabled={saving} className={justSaved ? 'btn-secondary' : 'btn-primary'} style={{ minWidth: 110, justifyContent: 'center', position: 'relative' }}>
                {saving ? <Loader size={14} className="animate-spin" /> : justSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                {justSaved ? 'Saved' : 'Save'}
                {dirty && !justSaved && <span className="breathe" style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', border: '2px solid rgb(var(--s0-rgb))' }} />}
              </button>
            }
          />

          {query && visibleSections.length === 0 && (
            <div className="glass-card reveal" style={{ padding: '2rem', textAlign: 'center', color: '#8b9199', fontSize: '0.85rem' }}>
              No settings match "{query}".
            </div>
          )}

          <Section id="connection" index={i++}>
            <div style={{ fontSize: '0.78rem', color: '#8b9199', lineHeight: 1.5, marginTop: '-0.3rem' }}>
              The AmiBroker plugin connects to these on this PC. You only need them when setting the plugin up.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              <CopyBox label="Data service address" shown="http://127.0.0.1:7890" color="#38bdf8" copied={copied === 'url'} onCopy={() => copy('http://127.0.0.1:7890', 'url')} />
              <CopyBox label="Live data port (for the plugin)" shown="7891 (this PC only)" color="var(--accent)" copied={copied === 'port'} onCopy={() => copy('7891', 'port')} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="icon-btn" onClick={checkConnection} disabled={check.state === 'checking'}>
                {check.state === 'checking' ? <Loader size={13} className="animate-spin" /> : <Terminal size={13} />} Check connection
              </button>
              {check.state === 'ok' && <span className="pop-in" style={{ fontSize: '0.78rem', color: 'var(--good)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle size={13} /> The data service is running (answered in {check.ms} ms)</span>}
              {check.state === 'down' && <span className="pop-in" style={{ fontSize: '0.78rem', color: '#fb7185', display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} /> Not answering. Close and open DataBridge Pro.</span>}
            </div>
          </Section>

          <Section id="amibroker" index={i++}>
            <SettingRow label="AmiBroker folder" description="Where AmiBroker is installed on this PC">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="amibroker-path"
                  className="input-field"
                  value={settings.amiBrokerPath}
                  onChange={e => updateSettings({ amiBrokerPath: e.target.value })}
                  style={{ width: 280, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}
                />
                <button className="btn-secondary" style={{ padding: '0.625rem', flexShrink: 0 }} onClick={handlePickFolder} title="Choose the folder" aria-label="Choose the AmiBroker folder">
                  <FolderOpen size={14} />
                </button>
                {isTauriApp && (
                  <button className="btn-secondary" style={{ padding: '0.55rem 0.75rem', flexShrink: 0, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 6 }} onClick={findAmiBroker} disabled={finding} title="Look for AmiBroker on this PC">
                    {finding ? <Loader size={13} className="animate-spin" /> : <Search size={13} />} Find
                  </button>
                )}
              </div>
            </SettingRow>
            <SettingRow label="Open AmiBroker automatically" description="When DataBridge Pro starts, it opens AmiBroker too (if it isn't open already). It finds AmiBroker wherever it is installed and remembers the place; the Open AmiBroker button in the sidebar does the same at any time.">
              <Toggle id="auto-start-ab" checked={settings.autoStartAmiBroker} onChange={v => updateSettings({ autoStartAmiBroker: v })} />
            </SettingRow>
          </Section>

          <Section id="startup" index={i++}>
            <SettingRow
              label="Start with Windows"
              description={isTauriApp
                ? 'Opens quietly in the tray when you sign in to Windows, so data is flowing before you open AmiBroker. Takes effect right away.'
                : 'Only available in the desktop app.'}
            >
              {isTauriApp && autostart !== null && <Toggle id="auto-start-windows" checked={autostart} onChange={changeAutostart} />}
            </SettingRow>
          </Section>

          <Section id="relogin" index={i++}>
            <SettingRow label="Open the login page every morning" description="Broker logins expire daily. At the time below your browser opens the Fyers login page; after you log in, data resumes by itself.">
              <Toggle id="daily-relogin-enabled" checked={settings.dailyReloginEnabled} onChange={v => updateSettings({ dailyReloginEnabled: v })} />
            </SettingRow>
            <div className="db-collapse" data-open={settings.dailyReloginEnabled}>
              <div>
                <SettingRow label="Login time (IST)" description="Every weekday. Before 09:15 gives you time to log in before the market opens.">
                  <input
                    id="daily-relogin-time"
                    type="time"
                    value={settings.dailyReloginTime}
                    onChange={e => updateSettings({ dailyReloginTime: e.target.value })}
                    className="input-field"
                    style={{ width: 120, fontFamily: 'JetBrains Mono, monospace', colorScheme: 'dark' }}
                  />
                </SettingRow>
              </div>
            </div>
          </Section>

          <Section id="history" index={i++}>
            <SettingRow label="History depth" description="How far back 1-minute history is downloaded for every symbol. Raising it downloads only the older part that is missing.">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <Segmented
                  id="history-depth"
                  ariaLabel="History depth"
                  value={settings.backfillDepthDays}
                  onChange={v => updateSettings({ backfillDepthDays: v })}
                  options={HISTORY_PRESETS.map(p => ({ value: p.days, label: p.label, title: p.title }))}
                />
                <span style={{ fontSize: '0.7rem', color: '#6b727c' }}>{settings.backfillDepthDays.toLocaleString()} days · about {bars.toLocaleString('en-IN')} bars per symbol</span>
              </div>
            </SettingRow>
            <SettingRow
              label="Use all connected brokers for history"
              description="With more than one broker connected, each part of the history comes from whichever broker is fastest and free, so downloads finish sooner."
            >
              <Toggle id="history-all-brokers" checked={settings.historyUseAllBrokers !== false} onChange={v => updateSettings({ historyUseAllBrokers: v })} />
            </SettingRow>
          </Section>

          <Section id="appearance" index={i++}>
            <div>
              <SettingRow label="Colour theme" description="The colours of the whole app. Applies at once on this PC, and is remembered." keywords="colour color theme accent green blue purple violet orange ember ocean emerald dark" />
              <ThemePicker value={theme} onChange={changeTheme} />
            </div>
            <SettingRow label="Animations" description="Page transitions, counters and other motion. Applies at once on this PC.">
              <Segmented
                ariaLabel="Animations"
                value={motion}
                onChange={changeMotion}
                options={[
                  { value: 'auto', label: 'Like Windows', title: 'Follow the Windows "Animation effects" setting' },
                  { value: 'full', label: 'Full' },
                  { value: 'reduced', label: 'Reduced' },
                ]}
              />
            </SettingRow>
          </Section>

          {(!query || visibleSections.some(s => s.id === 'backup')) && (
            <section id="set-backup" className="settings-section reveal" style={{ ['--i' as any]: i++, scrollMarginTop: '1rem' }}>
              <BackupRestore />
            </section>
          )}

          <Section id="diagnostics" index={i++}>
            <SettingRow label="Log detail" description="How much the data service writes to its log. Info is right for everyday use.">
              <Segmented
                id="log-level"
                ariaLabel="Log detail"
                value={settings.logLevel}
                onChange={v => updateSettings({ logLevel: v })}
                options={[
                  { value: 'error', label: 'Errors' },
                  { value: 'warn', label: 'Warnings' },
                  { value: 'info', label: 'Info' },
                  { value: 'debug', label: 'Debug' },
                ]}
              />
            </SettingRow>
            <SettingRow label="Keep logs for" description="Older log files are deleted automatically">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id="log-retention"
                  type="number"
                  min={1} max={90}
                  value={settings.logRetentionDays}
                  onChange={e => updateSettings({ logRetentionDays: +e.target.value })}
                  className="input-field"
                  style={{ width: 80, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#8b9199' }}>days</span>
              </div>
            </SettingRow>
          </Section>

          {(!query || visibleSections.some(s => s.id === 'advanced')) && (
            <section id="set-advanced" className="glass-card reveal settings-section" style={{ ['--i' as any]: i++, padding: '1.1rem 1.25rem', scrollMarginTop: '1rem' }}>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced || !!query}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.76rem', fontWeight: 750, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span style={{ display: 'inline-flex', padding: 6, borderRadius: 8, background: 'rgb(var(--accent-rgb) / 0.09)', border: '1px solid rgb(var(--accent-rgb) / 0.2)' }}><Timer size={14} /></span>
                  Advanced timing
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#6b727c', fontSize: '0.74rem' }}>Rarely needs changing</span>
                </span>
                <ChevronDown size={16} color="#8b9199" style={{ transform: showAdvanced || query ? 'rotate(180deg)' : 'none', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />
              </button>
              <div className="db-collapse" data-open={showAdvanced || !!query}>
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <SettingRow label="Late tick tolerance" description="Seconds a late tick may still join the previous 1-second bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="number" min={1} max={10} value={settings.lateToleranaceSeconds} onChange={e => updateSettings({ lateToleranaceSeconds: +e.target.value })} className="input-field" style={{ width: 70, fontFamily: 'JetBrains Mono, monospace' }} />
                        <span style={{ fontSize: '0.8rem', color: '#8b9199' }}>sec</span>
                      </div>
                    </SettingRow>
                    <SettingRow label="Clock difference warning" description="Warn when the broker's time and this PC's clock differ by more than this">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="number" min={1} max={60} value={settings.clockSkewThresholdSeconds} onChange={e => updateSettings({ clockSkewThresholdSeconds: +e.target.value })} className="input-field" style={{ width: 70, fontFamily: 'JetBrains Mono, monospace' }} />
                        <span style={{ fontSize: '0.8rem', color: '#8b9199' }}>sec</span>
                      </div>
                    </SettingRow>
                  </div>
                </div>
              </div>
            </section>
          )}

          <Section id="danger" index={i++} tone="danger">
            <SettingRow label="Clean database" description="Deletes every symbol, all downloaded history and download progress. Broker logins stay.">
              <button className="btn-danger" onClick={handleCleanDatabase}><Database size={14} /> Clean database</button>
            </SettingRow>
            <SettingRow label="Factory reset" description="Back to first launch: brokers, keys, symbols, history and settings are all deleted.">
              <button className="btn-danger btn-danger--solid" onClick={handleFullForceClean}><Trash2 size={14} /> Factory reset</button>
            </SettingRow>
          </Section>
        </div>
      </div>

      {dirty && (
        <div className="action-bar" role="status">
          <span className="breathe" style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
          <span style={{ fontSize: '0.82rem', color: '#eceef2', fontWeight: 600 }}>
            {dirtyKeys.length === 1 ? '1 unsaved change' : `${dirtyKeys.length} unsaved changes`}
          </span>
          <button className="icon-btn" onClick={discard}><Undo2 size={13} /> Discard</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '0.45rem 0.9rem' }}>
            {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} Save <span className="kbd" style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--on-accent)', borderColor: 'rgba(0,0,0,0.2)' }}>Ctrl S</span>
          </button>
        </div>
      )}

      <style>{`
        .settings-layout { width: 100%; padding: 1.5rem; display: grid; grid-template-columns: 210px minmax(0, 860px); gap: 1.5rem; align-items: start; }
        .settings-nav { position: sticky; top: 1.5rem; padding-top: 0.3rem; }
        .settings-nav-item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.5rem 0.7rem;
          border-radius: 8px; font-size: 0.8rem; color: #8b9199; cursor: pointer; border: 1px solid transparent; position: relative;
          transition: background .15s, color .15s, border-color .15s; }
        .settings-nav-item:hover:not(:disabled) { background: rgba(255,255,255,0.04); color: #eceef2; }
        .settings-nav-item[data-on="true"] { color: var(--accent); background: rgb(var(--accent-rgb) / 0.1); border-color: rgb(var(--accent-rgb) / 0.18); }
        .settings-nav-item[data-on="true"]::before { content: ''; position: absolute; left: -1px; top: 25%; bottom: 25%; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
        .settings-nav-item[data-dim="true"] { opacity: 0.3; cursor: default; }
        @media (max-width: 1000px) { .settings-layout { grid-template-columns: minmax(0, 1fr); } .settings-nav { display: none; } }
      `}</style>
    </QueryCtx.Provider>
  )
}
