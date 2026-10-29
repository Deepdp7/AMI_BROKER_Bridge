import { useMemo, useRef, useState } from 'react'
import {
  Blocks, RefreshCw, Download, FolderOpen, ExternalLink, Copy, CheckCircle, AlertCircle, Upload, Play, FileSpreadsheet, Loader2, Sparkles, CandlestickChart,
} from 'lucide-react'
import { ChartPicker } from '../components/platforms/OpenChart'
import { Toggle } from '../components/ui/Toggle'
import { PageHeader } from '../components/ui/PageHeader'
import { toast } from '../components/ui/Toast'
import Select from '../components/ui/Select'
import { useAppStore } from '../store/appStore'
import { openAmiBroker, canOpenAmiBroker } from '../lib/amibroker'
import { PlatformLogo, LevelTag, PlatformPicker } from '../components/platforms/PlatformPicker'
import { usePlatforms, platformsApi, setPlatformsState, type PlatformInfo, type PlatformId } from '../lib/platforms'

const RTD_EXAMPLE = '=RTD("DataBridge.RTD",,"RELIANCE","LTP")'
const BAR_EXAMPLE = '=RTD("DataBridge.RTD",,"RELIANCE","BAR","5m",1,"CLOSE")'
const RTD_FIELDS = ['LTP', 'OPEN', 'HIGH', 'LOW', 'PREVCLOSE', 'CHANGE', 'CHANGE%', 'VOLUME', 'OI', 'BID', 'ASK', 'TIME', 'LOT', 'STATUS']

/** An Excel formula with a copy button */
function Formula({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
      <code style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: 6, color: '#eceef2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</code>
      <button className="icon-btn" onClick={copy} data-on={copied} aria-label={label}>{copied ? <CheckCircle size={12} /> : <Copy size={12} />}</button>
    </div>
  )
}

/** Runs an action with a busy flag and a toast for failures */
function useAction() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn() } catch (e: any) { toast.error('That did not work', e?.message || String(e), 8000) } finally { setBusy(null) }
  }
  return { busy, run }
}

function Btn({ id, busy, onClick, icon: Icon, children, primary }: { id: string; busy: string | null; onClick: () => void; icon: React.ElementType; children: React.ReactNode; primary?: boolean }) {
  return (
    <button className={primary ? 'btn-primary' : 'icon-btn'} onClick={onClick} disabled={busy !== null} style={primary ? { height: 34, fontSize: '0.78rem' } : undefined}>
      {busy === id ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />} {children}
    </button>
  )
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', color: '#a1a7b0', lineHeight: 1.5 }}>
    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: 'rgb(var(--accent-rgb) / 0.12)', color: 'var(--accent)', fontSize: '0.66rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
    <span>{children}</span>
  </div>
)

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: ok ? 'var(--good)' : '#fb923c', fontWeight: 600 }}>
      {ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {children}
    </div>
  )
}

/** "Keep up to date every minute" for the CSV folder (shared by CSV, MetaStock and Sierra Chart) */
function LiveCsvSwitch() {
  const { state } = usePlatforms()
  const [busy, setBusy] = useState(false)
  const on = !!state?.csvLive
  const change = async (next: boolean) => {
    setBusy(true)
    try {
      const r = await platformsApi.csvLive(next)
      setPlatformsState(s => ({ ...s, csvLive: r.on }))
      if (r.on) toast.success('CSV files kept up to date', `${r.folder}: each new minute is added to its symbol's file.`, 7000)
    } catch (e: any) {
      toast.error('That did not work', e?.message || String(e), 8000)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '0.55rem 0.7rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ flex: 1, fontSize: '0.74rem', color: '#a1a7b0', lineHeight: 1.45 }}>
        <b style={{ color: '#eceef2' }}>Keep the files up to date</b><br />
        Every minute the bars that just closed are added, so programs reading the folder stay live.
      </div>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Toggle id="csv-live" checked={on} onChange={change} label="Keep the CSV files up to date" />}
    </div>
  )
}

function ChartinkImport() {
  const brokers = useAppStore(s => s.brokers)
  const [text, setText] = useState('')
  const [as, setAs] = useState<'EQ' | 'FUT'>('EQ')
  const [brokerId, setBrokerId] = useState(brokers.find(b => b.status === 'connected')?.id || brokers[0]?.id || '')
  const { busy, run } = useAction()
  const file = useRef<HTMLInputElement>(null)

  const go = () => run('import', async () => {
    const r = await platformsApi.importChartink(brokerId, text, as)
    toast.success(`${r.added} symbol${r.added === 1 ? '' : 's'} added`,
      [`${r.found} in the scan`, r.already ? `${r.already} you had already` : '',
        r.noFuture.length ? `no current future for ${r.noFuture.slice(0, 6).join(', ')}${r.noFuture.length > 6 ? '…' : ''}` : '',
        r.unknown?.length ? `left out, not NSE symbols: ${r.unknown.slice(0, 6).join(', ')}${r.unknown.length > 6 ? '…' : ''}` : '',
      ].filter(Boolean).join(' · '), 9000)
    setText('')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.3rem' }}>
      <Step n={1}>On chartink.com run your scan, then <b>Download csv</b> under its results (or copy the symbols).</Step>
      <Step n={2}>Drop that file here or paste: DataBridge adds the stocks, then they stream to AmiBroker, Excel and the rest.</Step>
      <textarea
        className="input-field"
        aria-label="Chartink scan CSV or symbols"
        placeholder={'Sr.,Stock Name,Symbol,…\n1,Reliance Industries Limited,RELIANCE,…\n\nor simply: RELIANCE, TCS, INFY'}
        value={text}
        onChange={e => setText(e.target.value)}
        style={{ minHeight: 86, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', resize: 'vertical' }}
      />
      <input ref={file} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={async e => {
        const f = e.target.files?.[0]
        if (f) setText(await f.text())
        e.target.value = ''
      }} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => file.current?.click()}><Upload size={13} /> Choose CSV file</button>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }} role="radiogroup" aria-label="Add as">
          {(['EQ', 'FUT'] as const).map(v => (
            <button key={v} role="radio" aria-checked={as === v} className="chip" data-on={as === v} onClick={() => setAs(v)} style={{ height: 28 }}>
              {v === 'EQ' ? 'As shares' : "As this month's futures"}
            </button>
          ))}
        </div>
        {brokers.length > 1 && (
          <div style={{ minWidth: 170 }}>
            <Select value={brokerId} onChange={setBrokerId} options={brokers.map(b => ({ value: b.id, label: b.label || b.brokerType }))} />
          </div>
        )}
        <Btn id="import" busy={busy} primary icon={Download} onClick={go}>Add to DataBridge</Btn>
      </div>
      {!brokers.length && <div style={{ fontSize: '0.72rem', color: '#fb923c' }}>Connect a broker first: imported symbols stream through it.</div>}
    </div>
  )
}

function PlatformCard({ p, index }: { p: PlatformInfo; index: number }) {
  const { busy, run } = useAction()
  const [chartPicker, setChartPicker] = useState(false)
  const inst = p.instances[0]

  const install = (i = 0) => run(`install-${i}`, async () => {
    const r = await platformsApi.install(p.id, i)
    if (r.platform) setPlatformsState(s => ({ ...s, platforms: s.platforms.map(x => x.id === p.id ? r.platform! : x) }))
    toast.success(`${p.name}: done`, r.message, 9000)
  })
  const exportFiles = () => run('export', async () => {
    const r = await platformsApi.exportHistory(p.id)
    toast.success(`${r.files} symbol${r.files === 1 ? '' : 's'} exported`, `${r.bars.toLocaleString('en-IN')} bars in ${r.folder}`, 8000)
    platformsApi.reveal(r.folder).catch(() => {})
  })
  const open = (i = 0) => run(`open-${i}`, async () => {
    if (p.id === 'amibroker' && canOpenAmiBroker()) { await openAmiBroker(); return }
    await platformsApi.open(p.id, i)
  })
  let body: React.ReactNode = null
  let actions: React.ReactNode = null

  if (p.id === 'amibroker') {
    body = inst
      ? <Status ok={!!inst.connectorInstalled}>{inst.connectorInstalled ? `DataBridge plugin installed · ${inst.folder}` : `Plugin not in ${inst.connectorFolder || inst.folder}`}</Status>
      : <Status ok={false}>AmiBroker was not found on this PC</Status>
    actions = <>
      {inst && <Btn id="open-0" busy={busy} icon={Play} onClick={() => open()} primary>Open AmiBroker</Btn>}
      {inst && <Btn id="install-0" busy={busy} icon={Download} onClick={() => install()}>{inst.connectorInstalled ? 'Update plugin' : 'Install plugin'}</Btn>}
    </>
  } else if (p.id === 'excel') {
    body = inst ? <>
      <Status ok={!!inst.connectorInstalled}>{inst.connectorInstalled ? `Live prices installed (${inst.label})` : `Excel found (${inst.label}); live prices not installed yet`}</Status>
      <Formula text={RTD_EXAMPLE} label="Copy the formula" />
      <div style={{ fontSize: '0.68rem', color: '#6b727c', lineHeight: 1.6 }}>Fields: {RTD_FIELDS.join(' · ')}. The symbol is the name in DataBridge (or a cell: $A2).</div>
      <Formula text={BAR_EXAMPLE} label="Copy the bar formula" />
      <div style={{ fontSize: '0.68rem', color: '#6b727c', lineHeight: 1.6 }}>
        History: timeframe 1m · 5m · 15m · 30m · 1h · 1d; bar 1 is the one forming now (it moves live), 2 the one before…; TIME · OPEN · HIGH · LOW · CLOSE · VOLUME.
        The live sheet's <b>History</b> tab has 100 bars of any symbol with a chart.
      </div>
    </> : <Status ok={false}>Excel was not found on this PC</Status>
    actions = inst && <>
      <Btn id="sheet" busy={busy} primary icon={FileSpreadsheet} onClick={() => run('sheet', async () => {
        if (!inst.connectorInstalled) await platformsApi.install('excel').then(r => r.platform && setPlatformsState(s => ({ ...s, platforms: s.platforms.map(x => x.id === 'excel' ? r.platform! : x) })))
        const r = await platformsApi.liveSheet()
        toast.success('Live sheet opened', r.file, 6000)
      })}>Open live sheet</Btn>
      <Btn id="install-0" busy={busy} icon={Download} onClick={() => install()}>{inst.connectorInstalled ? 'Reinstall live prices' : 'Install live prices'}</Btn>
    </>
  } else if (p.id === 'metatrader5') {
    body = p.instances.length ? <>
      {p.instances.map((t, i) => (
        <div key={t.folder} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Status ok={!!t.connectorInstalled}>{t.label || t.folder}: {t.connectorInstalled ? 'connector installed' : t.connectorFolder ? 'connector not installed' : 'start it once first'}</Status>
          <Btn id={`install-${i}`} busy={busy} icon={Download} onClick={() => install(i)}>{t.connectorInstalled ? 'Update' : 'Install connector'}</Btn>
          <Btn id={`open-${i}`} busy={busy} icon={Play} onClick={() => open(i)}>Open</Btn>
        </div>
      ))}
      <Step n={1}>Install the connector (it goes into that terminal's MQL5 folder).</Step>
      <Step n={2}>In MetaTrader 5: Navigator → Services → DataBridge → right-click → Start. Once: it restarts with MT5.</Step>
      <Step n={3}>Your symbols appear under Custom → DataBridge (View → Symbols); drag one onto a chart.</Step>
    </> : <Status ok={false}>No MetaTrader 5 terminal found on this PC</Status>
  } else if (p.id === 'ninjatrader8') {
    body = <>
      <Step n={1}>Export: one file per symbol, 1-minute bars, in NinjaTrader's own format.</Step>
      <Step n={2}>In NinjaTrader 8: Tools → Import → Historical Data, pick the files, Format "NinjaTrader (timestamps represent end of bar time)", Time zone "(UTC+05:30) Chennai, Kolkata".</Step>
      <Step n={3}>NSE symbols must exist in its Instrument Manager first (add each with the same name).</Step>
    </>
    actions = <>
      <Btn id="export" busy={busy} primary icon={Download} onClick={exportFiles}>Export history</Btn>
      {inst?.exe && <Btn id="open-0" busy={busy} icon={Play} onClick={() => open()}>Open NinjaTrader</Btn>}
    </>
  } else if (p.id === 'metastock' || p.id === 'sierrachart' || p.id === 'csv') {
    body = <>
      <Step n={1}>Export: one CSV per symbol (Date, Time, Open, High, Low, Close, Volume, OI), 1-minute bars, India time.</Step>
      <Step n={2}>{p.id === 'metastock' ? "In MetaStock's Downloader: Tools → Convert, source ASCII text, then point it at the folder."
        : p.id === 'sierrachart' ? 'In Sierra Chart: File → Import Intraday Data (Text/CSV) for each symbol.'
        : 'Any program that reads CSV (Investar, Python, R…) can use the folder.'}</Step>
      <LiveCsvSwitch />
    </>
    actions = <>
      <Btn id="export" busy={busy} primary icon={Download} onClick={exportFiles}>Export CSV history</Btn>
      {inst?.exe && <Btn id="open-0" busy={busy} icon={Play} onClick={() => open()}>Open {p.name}</Btn>}
    </>
  } else if (p.id === 'tradingview') {
    body = <>
      <Step n={1}>Export your symbols as a TradingView watchlist (futures as continuous contracts: RELIANCE1! is this month).</Step>
      <Step n={2}>In TradingView: watchlist menu → Import list… → pick "DataBridge watchlist.txt".</Step>
    </>
    actions = <>
      <Btn id="tv" busy={busy} primary icon={Download} onClick={() => run('tv', async () => {
        const r = await platformsApi.tradingViewWatchlist()
        toast.success(`Watchlist with ${r.count} symbols saved`, r.skipped.length ? `Options are left out (TradingView has no NSE option contracts): ${r.skipped.slice(0, 5).join(', ')}${r.skipped.length > 5 ? '…' : ''}` : r.file, 8000)
        platformsApi.reveal(r.file).catch(() => {})
      })}>Export watchlist</Btn>
      <Btn id="chart" busy={busy} icon={CandlestickChart} onClick={() => setChartPicker(true)}>Open a chart</Btn>
      <Btn id="open-0" busy={busy} icon={ExternalLink} onClick={() => open()}>{inst?.exe ? 'Open TradingView' : 'tradingview.com'}</Btn>
    </>
  } else if (p.id === 'chartink') {
    body = <ChartinkImport />
    actions = <>
      <Btn id="chart" busy={busy} icon={CandlestickChart} onClick={() => setChartPicker(true)}>Open a chart</Btn>
      <Btn id="open-0" busy={busy} icon={ExternalLink} onClick={() => open()}>chartink.com</Btn>
    </>
  }

  return (
    <div className="glass-card reveal" style={{ ['--i' as any]: index + 2, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }} id={`platform-${p.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <PlatformLogo id={p.id} name={p.name} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#eceef2', fontSize: '0.95rem' }}>{p.name}</span>
            <LevelTag p={p} />
          </div>
          <div style={{ fontSize: '0.74rem', color: '#8b9199', marginTop: 3, lineHeight: 1.45 }}>{p.gives}</div>
        </div>
      </div>
      {body && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>{body}</div>}
      {actions && <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: 2 }}>{actions}</div>}
      {(p.id === 'chartink' || p.id === 'tradingview') && <ChartPicker open={chartPicker} site={p.id} onClose={() => setChartPicker(false)} />}
    </div>
  )
}

export function PlatformsPage() {
  const { state, error, refresh } = usePlatforms()
  const [picker, setPicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const chosen = useMemo(() => {
    if (!state) return []
    const ids = new Set<PlatformId>(state.chosen.length ? state.chosen : ['amibroker'])
    return state.platforms.filter(p => ids.has(p.id))
  }, [state])
  const others = useMemo(() => state?.platforms.filter(p => !chosen.includes(p)) || [], [state, chosen])

  const rescan = async () => { setRefreshing(true); await refresh(); setRefreshing(false) }

  return (
    <div style={{ width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <PageHeader
        icon={Blocks}
        title="Platforms"
        subtitle="Where your prices go: AmiBroker, Excel, MetaTrader, NinjaTrader, TradingView, Chartink…"
        actions={<>
          <button className="icon-btn" onClick={rescan} disabled={refreshing} title="Look for installed platforms again" style={{ height: 38 }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Look again
          </button>
          <button className="btn-primary" onClick={() => setPicker(true)} disabled={!state}><Sparkles size={14} /> Choose platforms</button>
        </>}
      />
      {state && <PlatformPicker open={picker} platforms={state.platforms} chosen={state.chosen} onClose={() => setPicker(false)} />}

      {error && !state && (
        <div className="glass-card" style={{ padding: '1.25rem', color: '#fb923c', fontSize: '0.82rem' }}>
          The data engine is not answering ({error}). It starts with DataBridge Pro; try again in a moment.
        </div>
      )}
      {!state && !error && <div style={{ color: '#8b9199', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="animate-spin" /> Looking for platforms on this PC…</div>}

      {state && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem', alignItems: 'start' }}>
            {chosen.map((p, i) => <PlatformCard key={p.id} p={p} index={i} />)}
          </div>
          {others.length > 0 && (
            <div className="reveal" style={{ ['--i' as any]: chosen.length + 3 }}>
              <div style={{ fontSize: '0.74rem', color: '#8b9199', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.7rem' }}>Also supported</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.7rem' }}>
                {others.map(p => (
                  <button key={p.id} className="glass-card lift" onClick={() => setPicker(true)} title={`Use ${p.name}`}
                    style={{ padding: '0.85rem', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <PlatformLogo id={p.id} name={p.name} size={32} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 650, color: '#eceef2' }}>{p.name}</span>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: p.kind === 'desktop' && p.installed ? 'var(--good)' : '#6b727c', marginTop: 2 }}>
                        {p.kind === 'desktop' ? (p.installed ? 'Found on this PC' : 'Not found on this PC') : p.kind === 'web' ? 'Website' : 'Files'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: '#575d66', lineHeight: 1.6 }}>
            <FolderOpen size={11} style={{ verticalAlign: '-1px' }} /> Files DataBridge writes for you go to Documents\DataBridge Pro.
          </div>
        </>
      )}
    </div>
  )
}
