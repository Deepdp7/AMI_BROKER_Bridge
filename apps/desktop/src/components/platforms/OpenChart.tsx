/**
 * Opening a symbol's chart on Chartink or TradingView, straight on that symbol
 * (chartink.com/stocks-new?symbol=TCS): small logo buttons on symbol cards, buttons in the symbol
 * panel, and a sidebar launcher that asks which symbol (type, ↑ ↓, Enter).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Search, CornerDownLeft } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { platformsApi, siteHasChart, useChartSites, CHART_SITE_NAMES, type ChartSite } from '../../lib/platforms'
import { PlatformLogo } from './PlatformPicker'
import { Dialog } from '../ui/Dialog'
import SymbolLogo from '../ui/SymbolLogo'
import { toast } from '../ui/Toast'

export async function openChart(site: ChartSite, ticker: string) {
  try {
    await platformsApi.openChart(site, ticker)
  } catch (err: any) {
    toast.error(`Couldn't open ${CHART_SITE_NAMES[site]}`, String(err?.message || err), 6000)
  }
}

interface SymbolLike { ticker: string; exchange?: string; instrumentType?: string }

/** One small logo button per chosen chart website (on a card or a row) */
export function ChartLinkIcons({ sym, size = 22 }: { sym: SymbolLike; size?: number }) {
  const sites = useChartSites().filter(s => siteHasChart(s, sym))
  if (!sites.length) return null
  return (
    <span className="chart-links">
      {sites.map(site => (
        <button
          key={site}
          className="chart-link-btn"
          title={`Open ${sym.ticker} on ${CHART_SITE_NAMES[site]}`}
          aria-label={`Open ${sym.ticker} on ${CHART_SITE_NAMES[site]}`}
          onClick={e => { e.stopPropagation(); void openChart(site, sym.ticker) }}
        >
          <PlatformLogo id={site} name={CHART_SITE_NAMES[site]} size={size} />
        </button>
      ))}
    </span>
  )
}

/** "Chart on Chartink" buttons (the symbol panel); every site when none was chosen */
export function ChartLinkButtons({ sym }: { sym: SymbolLike }) {
  const chosen = useChartSites()
  const sites = (chosen.length ? chosen : (['chartink', 'tradingview'] as ChartSite[])).filter(s => siteHasChart(s, sym))
  if (!sites.length) return null
  return (
    <>
      {sites.map(site => (
        <button key={site} className="btn-secondary" style={{ justifyContent: 'center', gap: 7 }} onClick={() => openChart(site, sym.ticker)} title={`Open ${sym.ticker}'s chart on ${CHART_SITE_NAMES[site]}`}>
          <PlatformLogo id={site} name={CHART_SITE_NAMES[site]} size={16} />
          Chart on {CHART_SITE_NAMES[site]}
          <ExternalLink size={11} style={{ opacity: 0.6 }} />
        </button>
      ))}
    </>
  )
}

/** Type a symbol, pick it, and the site opens on its chart */
export function ChartPicker({ open, site: initialSite, onClose }: { open: boolean; site: ChartSite; onClose: () => void }) {
  const symbols = useAppStore(s => s.symbols)
  const chosen = useChartSites()
  const [site, setSite] = useState<ChartSite>(initialSite)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setSite(initialSite); setQ(''); setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open, initialSite])

  const typed = q.trim().toUpperCase()
  const results = useMemo(() => {
    const seen = new Set<string>()
    const list = symbols.filter(s => s.ticker && siteHasChart(site, s) && !seen.has(s.ticker) && seen.add(s.ticker))
    const hits = typed
      ? list.filter(s => s.ticker.toUpperCase().includes(typed)).sort((a, b) => Number(!b.ticker.toUpperCase().startsWith(typed)) - Number(!a.ticker.toUpperCase().startsWith(typed)) || a.ticker.localeCompare(b.ticker))
      : [...list].sort((a, b) => a.ticker.localeCompare(b.ticker))
    const rows: SymbolLike[] = hits.slice(0, 50)
    // Any NSE name, tracked or not (Chartink and TradingView have every stock): first when no
    // tracked symbol starts with it, so "INFY" opens INFY and "tc" still opens TCS
    if (typed && /^[A-Z0-9&_.-]{1,30}$/.test(typed) && !rows.some(r => r.ticker.toUpperCase() === typed)) {
      const free = { ticker: typed, exchange: 'NSE', instrumentType: 'EQ' }
      if (rows.some(r => r.ticker.toUpperCase().startsWith(typed))) rows.push(free); else rows.unshift(free)
    }
    return rows
  }, [symbols, site, typed])

  useEffect(() => { setActive(0) }, [typed, site])

  const go = (s?: SymbolLike) => {
    if (!s) return
    void openChart(site, s.ticker)
    onClose()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]) }
    else if (e.key === 'Tab' && chosen.length > 1) { e.preventDefault(); setSite(s => chosen[(chosen.indexOf(s) + 1) % chosen.length]) }
  }

  useEffect(() => {
    document.getElementById(`chart-pick-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const siteName = CHART_SITE_NAMES[site]
  return (
    <Dialog open={open} onClose={onClose} width={520} top label={`Open a chart on ${siteName}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.9rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <PlatformLogo id={site} name={siteName} size={26} />
        <Search size={15} style={{ color: '#6b727c', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Symbol to open on ${siteName}…`}
          aria-label="Symbol"
          spellCheck={false}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#eceef2', fontSize: '0.95rem' }}
        />
        {chosen.length > 1 && (
          <span style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label="Website">
            {chosen.map(s => (
              <button
                key={s}
                role="radio"
                aria-checked={s === site}
                aria-label={CHART_SITE_NAMES[s]}
                title={`${CHART_SITE_NAMES[s]} (Tab switches)`}
                className="chart-site-toggle"
                data-on={s === site}
                onClick={() => { setSite(s); inputRef.current?.focus() }}
              >
                <PlatformLogo id={s} name={CHART_SITE_NAMES[s]} size={18} />
              </button>
            ))}
          </span>
        )}
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0.35rem' }}>
        {results.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#6b727c' }}>
            {symbols.length ? 'No symbol matches' : 'Type a symbol, e.g. TCS'}
          </div>
        )}
        {results.map((s, i) => (
          <div
            key={s.ticker}
            id={`chart-pick-${i}`}
            className="chart-pick"
            data-active={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(s)}
            role="option"
            aria-selected={i === active}
          >
            <SymbolLogo ticker={s.ticker} exchange={s.exchange} size={26} />
            <span style={{ fontWeight: 650, color: '#eceef2', fontSize: '0.86rem' }}>{s.ticker}</span>
            <span style={{ fontSize: '0.68rem', color: '#6b727c' }}>{s.exchange || 'NSE'}{s.instrumentType && s.instrumentType !== 'EQ' ? ` · ${s.instrumentType}` : ''}</span>
            {i === active && <span className="kbd" style={{ marginLeft: 'auto' }}><CornerDownLeft size={10} /></span>}
          </div>
        ))}
      </div>
      <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.68rem', color: '#575d66', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
        <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
        <span><span className="kbd">Enter</span> open on {siteName}</span>
        {chosen.length > 1 && <span><span className="kbd">Tab</span> other website</span>}
        {site === 'chartink' && <span style={{ marginLeft: 'auto' }}>Futures open their stock's chart</span>}
      </div>
    </Dialog>
  )
}

/** The sidebar's "Open Chartink" / "Open TradingView": asks which symbol, then opens its chart */
export function OpenChartSiteButton({ site }: { site: ChartSite }) {
  const [open, setOpen] = useState(false)
  const name = CHART_SITE_NAMES[site]
  return (
    <>
      <button id={`open-${site}`} className="open-site-btn" onClick={() => setOpen(true)} title={`Open a symbol's chart on ${name}`}>
        <PlatformLogo id={site} name={name} size={18} />
        <span>{name}</span>
      </button>
      <ChartPicker open={open} site={site} onClose={() => setOpen(false)} />
    </>
  )
}
