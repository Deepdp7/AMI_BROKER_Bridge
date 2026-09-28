import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Settings as SettingsIcon, FolderOpen, Shield, ChevronDown, ChevronUp, Save, CheckCircle, Copy, Terminal, Database, Sliders, Activity, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { api, isApiAvailable } from '../api/apiClient'
import { toast } from '../components/Toast'

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {Icon && <Icon size={15} style={{ color: '#00d4aa' }} />}
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', color: '#e2eaf4', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: '0.75rem', color: '#6b8099', marginTop: '0.2rem' }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedPort, setCopiedPort] = useState(false)

  const handleSave = async () => {
    try {
      if (await isApiAvailable()) {
        await api.updateSettings(settings)
        toast.success('Settings Saved', 'Configuration has been successfully updated on the server.', 3000)
      } else {
        toast.info('Settings Saved Locally', 'API is offline, settings saved to local application state.', 3000)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      toast.error('Save Failed', 'Could not update settings on the server.')
      console.error('Failed to save settings:', e)
    }
  }

  const handleCleanDatabase = async () => {
    if (!window.confirm("WARNING: This will completely wipe the application's DATABASE DATA.\n\nDelete all database data including symbols, history, mappings, backfill and market data.\n\nAre you sure you want to proceed?")) return
    if (window.prompt("Type 'CLEAN' to confirm database deletion:") !== 'CLEAN') return
    
    try {
      await api.cleanDatabase()
      toast.success('Database Cleaned', 'Database data has been successfully wiped.', 5000)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      toast.error('Clean Failed', 'Failed to clean database: ' + (e.message || String(e)))
    }
  }

  const handleFullForceClean = async () => {
    if (!window.confirm("CRITICAL WARNING: This will COMPLETE A-to-Z FACTORY RESET OF APPLICATION DATA.\n\nReset the entire application to first-launch state. Everything will be deleted.\n\nAre you absolutely sure?")) return
    if (window.prompt("Type 'RESET' to confirm factory reset:") !== 'RESET') return
    
    try {
      await api.fullForceClean()
      toast.success('Factory Reset', 'Full force clean complete. Relaunching empty...', 5000)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      toast.error('Reset Failed', 'Failed to run full force clean: ' + (e.message || String(e)))
    }
  }

  const copyToClipboard = (text: string, type: 'url' | 'port') => {
    navigator.clipboard.writeText(text)
    if (type === 'url') {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } else {
      setCopiedPort(true)
      setTimeout(() => setCopiedPort(false), 2000)
    }
    toast.success('Copied to Clipboard', text)
  }

  const handlePickFolder = async () => {
    try {
      const isTauri = window.location.origin.startsWith('tauri://') || window.location.origin.includes('tauri.localhost') || !!(window as any).__TAURI_INTERNALS__
      
      if (isTauri) {
        const selectedPath = await open({
          directory: true,
          multiple: false,
          title: 'Select AmiBroker Installation Folder'
        })
        if (selectedPath && typeof selectedPath === 'string') {
          updateSettings({ amiBrokerPath: selectedPath })
        }
      } else {
        const res = await api.pickFolder()
        if (res.path) {
          updateSettings({ amiBrokerPath: res.path })
        }
      }
    } catch (e) {
      toast.error('Failed', 'Could not open folder picker')
      console.error(e)
    }
  }

  return (
    <div style={{ width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '850px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2eaf4', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SettingsIcon size={20} style={{ color: '#00d4aa' }} />
            Settings & Integration
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#6b8099', margin: '0.25rem 0 0' }}>Configure DataBridge Pro behavior and AmiBroker connection</p>
        </div>
        <button
          id="save-settings-btn"
          onClick={handleSave}
          className={saved ? 'btn-secondary' : 'btn-primary'}
          style={{ minWidth: '100px' }}
        >
          {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save</>}
        </button>
      </div>

      {/* AmiBroker Connection Card */}
      <div className="glass-card" style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, rgba(56,126,209,0.12) 0%, rgba(10,22,40,0.6) 100%)',
        border: '1px solid rgba(56,126,209,0.3)',
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={15} />
          AmiBroker Plugin Connection Info
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
          <div style={{ background: 'rgba(5,12,20,0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Local Feed API URL</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>http://127.0.0.1:7890</span>
              <button
                onClick={() => copyToClipboard('http://127.0.0.1:7890', 'url')}
                style={{ background: 'none', border: 'none', color: copiedUrl ? '#00d4aa' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem' }}
              >
                <Copy size={13} />
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(5,12,20,0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.25rem' }}>IPC TCP Streaming Port</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: '#00d4aa', fontWeight: 600 }}>7891 (Localhost)</span>
              <button
                onClick={() => copyToClipboard('7891', 'port')}
                style={{ background: 'none', border: 'none', color: copiedPort ? '#00d4aa' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem' }}
              >
                <Copy size={13} />
                {copiedPort ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AmiBroker Integration */}
      <Section title="AmiBroker Path & Launch" icon={FolderOpen}>
        <SettingRow label="AmiBroker Installation Path" description="Location where AmiBroker is installed on this PC">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              id="amibroker-path"
              className="input-field"
              value={settings.amiBrokerPath}
              onChange={e => updateSettings({ amiBrokerPath: e.target.value })}
              style={{ width: '260px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}
            />
            <button 
              className="btn-secondary" 
              style={{ padding: '0.625rem', flexShrink: 0 }}
              onClick={handlePickFolder}
            >
              <FolderOpen size={14} />
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Auto-start AmiBroker with Bridge" description="Launches AmiBroker automatically when DataBridge Pro starts">
          <Toggle id="auto-start-ab" checked={settings.autoStartAmiBroker} onChange={v => updateSettings({ autoStartAmiBroker: v })} />
        </SettingRow>
      </Section>

      {/* System */}
      <Section title="System & Updates" icon={Sliders}>
        <SettingRow label="Start with Windows" description="Register DataBridge Pro to launch automatically at Windows startup">
          <Toggle id="auto-start-windows" checked={settings.autoStartWithWindows} onChange={v => updateSettings({ autoStartWithWindows: v })} />
        </SettingRow>
        <SettingRow label="Auto-update" description="Automatically download and apply software updates on restart">
          <Toggle id="auto-update" checked={settings.autoUpdate} onChange={v => updateSettings({ autoUpdate: v })} />
        </SettingRow>
        <SettingRow label="Update Channel" description="Stable is recommended for active trading">
          <select
            id="update-channel"
            value={settings.updateChannel}
            onChange={e => updateSettings({ updateChannel: e.target.value as any })}
            className="input-field"
            style={{ width: '120px' }}
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
          </select>
        </SettingRow>
      </Section>

      {/* Broker Auto Re-Login */}
      <Section title="Broker Auto Re-Login" icon={RefreshCw}>
        <SettingRow
          label="Daily Auto Re-Login"
          description="Open Fyers login page automatically every day so you don't miss market open"
        >
          <Toggle
            id="daily-relogin-enabled"
            checked={settings.dailyReloginEnabled}
            onChange={v => updateSettings({ dailyReloginEnabled: v })}
          />
        </SettingRow>
        {settings.dailyReloginEnabled && (
          <SettingRow
            label="Login Time (IST)"
            description="Browser will open the Fyers login page at this time every weekday"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="daily-relogin-time"
                type="time"
                value={settings.dailyReloginTime}
                onChange={e => updateSettings({ dailyReloginTime: e.target.value })}
                className="input-field"
                style={{ width: '120px', fontFamily: 'JetBrains Mono, monospace', colorScheme: 'dark' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#6b8099' }}>IST</span>
            </div>
          </SettingRow>
        )}
        <div style={{ fontSize: '0.72rem', color: '#4b5e6e', padding: '0.5rem 0 0', lineHeight: 1.5 }}>
          💡 At the set time, your browser opens Fyers login. After you log in, DataBridge automatically saves the token and resumes data feed — no manual steps needed.
        </div>
      </Section>

      {/* Data */}
      <Section title="Data & History Depth" icon={Database}>
        <SettingRow label="Backfill Depth (days)" description="Historical bar backfill depth for newly added symbols">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="backfill-days"
              type="range"
              min={1} max={365}
              value={settings.backfillDepthDays}
              onChange={e => updateSettings({ backfillDepthDays: +e.target.value })}
              style={{ width: '120px', accentColor: '#00d4aa' }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00d4aa', fontSize: '0.85rem', minWidth: '36px' }}>
              {settings.backfillDepthDays}d
            </span>
          </div>
        </SettingRow>
      </Section>

      {/* Logging */}
      <Section title="Diagnostics & Logging" icon={Activity}>
        <SettingRow label="Log Level" description="Verbosity of runtime logs (info recommended)">
          <select
            id="log-level"
            value={settings.logLevel}
            onChange={e => updateSettings({ logLevel: e.target.value as any })}
            className="input-field"
            style={{ width: '120px' }}
          >
            <option value="error">Error Only</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </SettingRow>
        <SettingRow label="Log Retention (days)" description="Automatically purge diagnostic logs older than this">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="log-retention"
              type="number"
              min={1} max={90}
              value={settings.logRetentionDays}
              onChange={e => updateSettings({ logRetentionDays: +e.target.value })}
              className="input-field"
              style={{ width: '80px', fontFamily: 'JetBrains Mono, monospace' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#6b8099' }}>days</span>
          </div>
        </SettingRow>
      </Section>

      {/* Advanced Timing */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none', border: 'none', color: '#94a3b8',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: 0, fontSize: '0.85rem', fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2eaf4' }}>
            <Shield size={16} style={{ color: '#00d4aa' }} />
            Advanced Timing Controls
          </span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <SettingRow label="Late Tick Tolerance" description="Seconds to accept late-arriving ticks into previous 1s bucket">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min={1} max={10}
                  value={settings.lateToleranaceSeconds}
                  onChange={e => updateSettings({ lateToleranaceSeconds: +e.target.value })}
                  className="input-field"
                  style={{ width: '70px', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#6b8099' }}>sec</span>
              </div>
            </SettingRow>

            <SettingRow label="Clock Skew Warning Threshold" description="Warn if broker timestamp diverges from system clock">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min={1} max={60}
                  value={settings.clockSkewThresholdSeconds}
                  onChange={e => updateSettings({ clockSkewThresholdSeconds: +e.target.value })}
                  className="input-field"
                  style={{ width: '70px', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#6b8099' }}>sec</span>
              </div>
            </SettingRow>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid rgba(255, 60, 60, 0.3)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ff4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} style={{ color: '#ff4444' }} />
          Danger Zone
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          
          <SettingRow 
            label="Clean Database" 
            description="Delete all database data including symbols, history, mappings, backfill and market data."
          >
            <button 
              className="btn btn-primary" 
              style={{ background: 'rgba(255, 60, 60, 0.1)', color: '#ff4444', border: '1px solid rgba(255, 60, 60, 0.3)' }}
              onClick={handleCleanDatabase}
            >
              <Database size={14} style={{ marginRight: '6px' }} />
              Clean Database
            </button>
          </SettingRow>

          <SettingRow 
            label="Full Force Clean" 
            description="Reset the entire application to first-launch state."
          >
            <button 
              className="btn btn-primary" 
              style={{ background: '#ff4444', color: '#fff', border: 'none' }}
              onClick={handleFullForceClean}
            >
              <Trash2 size={14} style={{ marginRight: '6px' }} />
              Full Force Clean
            </button>
          </SettingRow>
          
        </div>
      </div>

    </div>
  )
}
