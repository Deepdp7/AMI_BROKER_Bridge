import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { SymbolFeed } from '../store/appStore'
import { api, BASE_URL } from '../api/apiClient'
import { toast } from '../components/Toast'
import { List, Search, Plus, Trash2, TrendingUp, TrendingDown, CheckCircle, X, Loader, Upload, Download, Filter } from 'lucide-react'


const EXCHANGE_FILTERS = [
  { label: 'ALL', value: 'ALL' },
  { label: 'EQ (NSE)', value: 'NSE-10' },
  { label: 'FUTSTK (NFO)', value: 'NFO-12' },
  { label: 'FUTIDX (NFO)', value: 'NFO-11' },
  { label: 'OPTIDX (NFO)', value: 'NFO-13' },
  { label: 'OPTSTK (NFO)', value: 'NFO-14' },
  { label: 'FUTCOM (MCX)', value: 'MCX-11' },
  { label: 'OPTFUT (MCX)', value: 'MCX-12' },
  { label: 'FUTIDX (MCX)', value: 'MCX-13' },
  { label: 'OPTIDX (MCX)', value: 'MCX-14' },
]

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  EQ:    { bg: 'rgba(0, 212, 170, 0.15)',  color: '#00d4aa', label: 'EQ' },
  FUT:   { bg: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', label: 'FUT' },
  OPT:   { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'OPT' },
  INDEX: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', label: 'IDX' },
}

const SymbolCard = React.memo(({ sym, handleRemove, isSelected, onToggleSelect, selectionMode }: { sym: SymbolFeed, handleRemove: (ticker: string) => void, isSelected: boolean, onToggleSelect: (ticker: string) => void, selectionMode: boolean }) => {
  const badge = TYPE_BADGE[sym.instrumentType] || { bg: 'rgba(255,255,255,0.08)', color: '#8899aa', label: sym.instrumentType }
  const exchangeLabel = sym.exchange || 'NSE'

  return (
    <div
      onClick={() => selectionMode ? onToggleSelect(sym.ticker) : undefined}
      id={`symbol-chip-${(sym.ticker || 'unknown').replace(' ', '-')}`}
      className="glass-card-hover"
      style={{
        background: 'rgba(10,22,40,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '0.625rem',
        padding: '0.875rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        transition: 'all 0.2s',
        cursor: selectionMode ? 'pointer' : 'default',
        boxShadow: isSelected ? '0 0 0 2px #00d4aa' : 'none',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {selectionMode && (
          <div style={{ paddingTop: '2px' }}>
            <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#00d4aa', cursor: 'pointer' }} />
          </div>
        )}
      <div style={{ flex: 1 }}>
        {/* Symbol name + type badge in same row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#e2eaf4', fontSize: '0.88rem', letterSpacing: '0.01em' }}>
            {sym.ticker}
          </span>
          {/* Instrument Type Badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
            padding: '1px 6px', borderRadius: '4px',
            background: badge.bg, color: badge.color,
            border: `1px solid ${badge.color}44`,
          }}>
            {badge.label}
          </span>
          {/* Exchange Badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.03em',
            padding: '1px 5px', borderRadius: '4px',
            background: 'rgba(255,255,255,0.06)', color: '#8899aa',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {exchangeLabel}
          </span>
        </div>

        {/* Raw broker symbol (e.g. NSE:ABB26SEPFUT) */}
        {sym.rawSymbol && sym.rawSymbol !== sym.ticker && (
          <div style={{ fontSize: '0.65rem', color: '#4a6080', marginTop: '0.18rem', fontFamily: 'JetBrains Mono, monospace' }}>
            {sym.rawSymbol}
          </div>
        )}

        {sym.lastPrice > 0 && (
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#e2eaf4' }}>
              ₹{sym.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            {sym.changePercent !== 0 && (
              <span style={{ fontSize: '0.7rem', color: sym.changePercent >= 0 ? '#00d4aa' : '#f43f5e', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {sym.changePercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {sym.changePercent.toFixed(2)}%
              </span>
            )}
          </div>
        )}
        <div style={{ marginTop: '0.375rem' }}>
          <span className={`badge ${sym.status === 'STREAMING' ? 'badge-green' : sym.status === 'STALE' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
            {sym.status}
          </span>
        </div>
      </div>
      </div>
      {!selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(sym.ticker) }}
          style={{ background: 'none', border: 'none', color: '#3d5068', cursor: 'pointer', padding: '2px', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fb7185'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3d5068'}
          title="Remove symbol"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
})


export function SymbolSetupPage() {
  const { symbols, brokers, addSymbol, removeSymbol } = useAppStore()
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')
  const [localTypeFilter, setLocalTypeFilter] = useState('ALL')
  const [exchangeFilter, setExchangeFilter] = useState('ALL')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set())

  const activeBrokerId = brokers.find(b => b.status === 'connected')?.id || brokers[0]?.id || ''

  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await api.searchSymbols(activeBrokerId, search, exchangeFilter !== 'ALL' ? exchangeFilter : undefined)
        setSearchResults(res || [])
      } catch (e) {
        console.error(e)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [search, exchangeFilter, brokers])

  const isAdded = (ticker: string) => symbols.some(s => s.ticker === ticker)

  const handleAdd = async (sym: any) => {
    if (!sym.ticker || isAdded(sym.ticker)) return
    if (activeBrokerId) {
      try {
        await api.addSymbolsToBroker(activeBrokerId, [sym])
        addSymbol({
          ticker: sym.ticker!,
          exchange: sym.exchange as any || 'NSE',
          instrumentType: sym.instrumentType as any || 'EQ',
          lastPrice: sym.lastPrice || 0,
          prevClose: sym.lastPrice || 0,
          lastTickUtcMs: 0,
          barsPerMin: 0,
          internalLatencyMs: 0,
          status: 'STREAMING',
          change: 0,
          changePercent: 0,
          volume: 0,
        })
        setSearch('')
        toast.success('Symbol Added', `${sym.ticker} added to live feed tracking.`)
      } catch (e: any) {
        console.error('Failed to add symbol to broker backend', e)
        toast.error('Add Failed', e.message || 'Could not add symbol to backend')
      }
    } else {
      toast.error('No Broker', 'Please connect a broker first')
    }
  }

  const handleRemove = async (ticker: string) => {
    if (activeBrokerId) {
      try {
        await api.removeSymbolFromBroker(activeBrokerId, ticker)
      } catch (e) {
        console.error('Failed to remove symbol from backend', e)
      }
    }
    removeSymbol(ticker)
  }

  const handleDeleteSelected = async () => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    if (confirm(`Are you sure you want to delete ${selectedTickers.size} selected symbols?`)) {
      for (const ticker of selectedTickers) {
        await api.removeSymbolFromBroker(activeBrokerId, ticker).catch(() => {})
        removeSymbol(ticker)
      }
      setSelectedTickers(new Set())
      setSelectionMode(false)
      toast.success('Deleted', 'Selected symbols have been removed.')
    }
  }

  const handleDeleteAll = async () => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    if (confirm('Are you sure you want to delete ALL symbols? This cannot be undone.')) {
      for (const sym of symbols) {
        await api.removeSymbolFromBroker(activeBrokerId, sym.ticker).catch(() => {})
        removeSymbol(sym.ticker)
      }
      toast.success('Deleted All', 'All symbols have been removed.')
    }
  }

  const toggleSelect = useCallback((ticker: string) => {
    setSelectedTickers(prev => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  const handleExport = async () => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    try {
      const res = await fetch(`${BASE_URL}/brokers/${activeBrokerId}/symbols/export`)
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'symbols.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported', `${symbols.length} symbols exported to symbols.csv`)
    } catch (e: any) {
      toast.error('Export Failed', e.message)
    }
  }

  const handleImportFile = async (file: File) => {
    if (!activeBrokerId) return toast.error('No broker', 'Connect a broker first')
    setImporting(true)
    try {
      const csv = await file.text()
      const res = await fetch(`${BASE_URL}/brokers/${activeBrokerId}/symbols/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Import Successful', `Added ${data.added} of ${data.total} symbols`)
      window.location.reload()
    } catch (e: any) {
      toast.error('Import Failed', e.message)
    } finally {
      setImporting(false)
    }
  }

  const exchangeGroups = ['NSE', 'NFO', 'MCX', 'BSE']
  const instrumentTypes = ['EQ', 'FUTIDX', 'OPTIDX', 'FUTSTK', 'OPTSTK', 'FUTCOM', 'OPTFUT']

  const filteredSymbols = symbols.filter(s => {
    const matchSearch = !localSearch || 
      s.ticker.toLowerCase().includes(localSearch.toLowerCase()) ||
      (s.rawSymbol && s.rawSymbol.toLowerCase().includes(localSearch.toLowerCase()))
    const matchType = localTypeFilter === 'ALL' || s.instrumentType === localTypeFilter
    return matchSearch && matchType
  })

  const grouped = exchangeGroups.reduce((acc, ex) => {
    acc[ex] = filteredSymbols.filter(s => s.exchange === ex)
    return acc
  }, {} as Record<string, SymbolFeed[]>)

  return (
    <div style={{ width: '100%', flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = '' } }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2eaf4', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <List size={20} style={{ color: '#00d4aa' }} />
            Symbol Setup
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#6b8099', margin: '0.25rem 0 0' }}>
            {symbols.length} symbols configured — Auto-mapped across connected brokers
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {selectionMode ? (
            <>
              <button className="btn-secondary" onClick={() => { setSelectionMode(false); setSelectedTickers(new Set()) }}>Cancel</button>
              <button 
                className="btn-danger" 
                onClick={handleDeleteSelected}
                disabled={selectedTickers.size === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: selectedTickers.size ? 'pointer' : 'not-allowed', opacity: selectedTickers.size ? 1 : 0.5 }}
              >
                <X size={14} /> Delete Selected ({selectedTickers.size})
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setSelectionMode(true)} disabled={symbols.length === 0}>
                Select Multiple
              </button>
              <button 
                className="btn-danger" 
                onClick={handleDeleteAll} 
                disabled={symbols.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '0.375rem', fontWeight: 600, cursor: symbols.length ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                onMouseEnter={e => symbols.length && ((e.currentTarget as HTMLElement).style.background = 'rgba(244, 63, 94, 0.2)')}
                onMouseLeave={e => symbols.length && ((e.currentTarget as HTMLElement).style.background = 'rgba(244, 63, 94, 0.1)')}
              >
                <X size={14} /> Delete All
              </button>
              <button
                id="import-symbols-btn"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Import symbols from CSV file"
              >
                {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Importing...' : 'Import CSV'}
              </button>
              <button
                id="export-symbols-btn"
                className="btn-secondary"
                onClick={handleExport}
                disabled={symbols.length === 0}
                title="Export symbols to CSV file"
              >
                <Download size={14} />
                Export CSV
              </button>
            </>
          )}
          <button
            id="add-symbol-btn"
            className="btn-primary"
            onClick={() => setShowSearch(true)}
          >
            <Plus size={15} />
            Add Symbol
          </button>
        </div>
      </div>

      {/* Local Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '500px', alignSelf: 'flex-start' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b8099' }} />
          <input
            type="text"
            placeholder="Filter added symbols..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', height: '32px', fontSize: '0.8rem' }}
          />
          {localSearch && (
            <button 
              onClick={() => setLocalSearch('')}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b8099', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <select
          value={localTypeFilter}
          onChange={e => setLocalTypeFilter(e.target.value)}
          className="input-field"
          style={{ height: '32px', fontSize: '0.8rem', padding: '0 2rem 0 0.75rem', minWidth: '140px', cursor: 'pointer' }}
        >
          <option value="ALL">All Types</option>
          {instrumentTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Symbols Grouped by Exchange */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {exchangeGroups.map(ex => {
          const groupSymbols = grouped[ex] || []
          if (groupSymbols.length === 0) return null
          return (
            <div key={ex}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-gray">{ex}</span>
                <span>({groupSymbols.length} symbols)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {groupSymbols.map(sym => (
                  <SymbolCard 
                    key={sym.ticker} 
                    sym={sym} 
                    handleRemove={handleRemove} 
                    isSelected={selectedTickers.has(sym.ticker)}
                    onToggleSelect={toggleSelect}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {filteredSymbols.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#6b8099' }}>
            <List size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>No symbols found</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click "+ Add Symbol" to search and add symbols from your connected broker.</div>
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,13,26,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh' }} onClick={() => setShowSearch(false)}>
          <div className="glass-card animate-fade-in" style={{ width: '540px', maxWidth: '92vw', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b8099' }} />
                  <input
                    id="symbol-search-input"
                    className="input-field"
                    placeholder="Search NSE, NFO, MCX symbols (e.g. RELIANCE, NIFTY)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '2.25rem' }}
                    autoFocus
                  />
                  {search && (
                    <button 
                      onClick={() => setSearch('')}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b8099', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', color: '#6b8099', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Exchange Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {EXCHANGE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setExchangeFilter(f.value)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: exchangeFilter === f.value ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.04)',
                      color: exchangeFilter === f.value ? '#00d4aa' : '#6b8099',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', position: 'relative' }}>
              {isSearching && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b8099' }}>
                  <Loader className="animate-spin" size={24} style={{ margin: '0 auto', marginBottom: '0.5rem', color: '#00d4aa' }} />
                  Searching master contracts...
                </div>
              )}
              {!isSearching && searchResults.length === 0 && search.length >= 2 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b8099' }}>No matching symbols found.</div>
              )}
              {!isSearching && search.length < 2 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b8099', fontSize: '0.8rem' }}>
                  Type symbol name to search all Indian market contracts.
                </div>
              )}
              {!isSearching && searchResults.map(sym => {
                const added = isAdded(sym.ticker!)
                return (
                  <div
                    key={sym.ticker}
                    id={`search-result-${sym.ticker}`}
                    style={{
                      padding: '0.75rem 1.25rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: added ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                    onClick={() => !added && handleAdd(sym)}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '8px',
                        background: 'rgba(0,212,170,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 700, color: '#00d4aa',
                      }}>
                        {sym.exchange || 'NSE'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#e2eaf4', fontSize: '0.875rem' }}>{sym.ticker}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b8099' }}>{sym.name || sym.instrumentType}</div>
                      </div>
                    </div>
                    <div>
                      {added ? (
                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                          <CheckCircle size={10} /> Added
                        </span>
                      ) : (
                        <button className="btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
