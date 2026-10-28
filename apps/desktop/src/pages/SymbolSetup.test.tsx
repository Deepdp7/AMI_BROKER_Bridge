import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

const h = vi.hoisted(() => ({
  refreshToday: vi.fn(async () => ({ ok: true, queued: 2, skipped: 0 })),
  removeSymbolFromBroker: vi.fn(async () => ({ ok: true })),
  addSymbolsToBroker: vi.fn(async () => ({ added: 1 })),
  searchSymbols: vi.fn(async () => [{ ticker: 'RELIANCE', exchange: 'NSE', instrumentType: 'EQ', name: 'Reliance Industries' }, { ticker: 'RELINFRA', exchange: 'NSE', instrumentType: 'EQ' }]),
}))
vi.mock('../api/apiClient', () => ({
  BASE_URL: '/api',
  api: {
    refreshToday: h.refreshToday,
    removeSymbolFromBroker: h.removeSymbolFromBroker,
    addSymbolsToBroker: h.addSymbolsToBroker,
    searchSymbols: h.searchSymbols,
    getSymbolHealth: vi.fn(async () => ({ symbols: [] })),
    repairSymbols: vi.fn(async () => ({ ok: true, checked: 0, queued: 0, complete: 0, noBroker: 0 })),
    getBackfillStatus: vi.fn(async () => ({ queueLength: 0, cancelled: 0, statuses: [] })),
    restoreBackfill: vi.fn(),
  },
  wsManager: { on: () => () => {} },
}))
vi.mock('../hooks/useApiSync', () => ({ useEngineRefresh: () => {} }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { useAppStore, type SymbolFeed } from '../store/appStore'
import { SymbolSetupPage } from './SymbolSetup'
import { ConfirmHost } from '../components/ui/Dialog'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const sym = (ticker: string, over: Partial<SymbolFeed> = {}): SymbolFeed => ({
  ticker, exchange: 'NSE', instrumentType: 'EQ', lastPrice: 100, prevClose: 100, lastTickUtcMs: 0, barsPerMin: 0,
  internalLatencyMs: 0, status: 'STALE', change: 0, changePercent: 0, volume: 0, brokerId: 'f1', ...over,
})
const card = (t: string) => document.getElementById(`symbol-chip-${t}`)!

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.dataset.motion = 'reduced'
  useAppStore.setState({
    brokers: [{ id: 'f1', brokerType: 'fyers', label: 'Fyers', status: 'connected' }],
    symbols: [sym('NIFTY', { instrumentType: 'INDEX' }), sym('ACC'), sym('BEL'), sym('CIPLA')],
  })
})

describe('Symbol Setup', () => {
  it('type chips count and filter', () => {
    render(<SymbolSetupPage />)
    const indices = screen.getByRole('button', { name: /indices/i })
    expect(within(indices).getByText('1')).toBeTruthy()
    fireEvent.click(indices)
    expect(card('NIFTY')).toBeTruthy()
    expect(document.getElementById('symbol-chip-ACC')).toBeNull()
  })

  it('select: click, shift-click a range, then refresh today for just those in one call', async () => {
    render(<SymbolSetupPage />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(card('ACC'))
    fireEvent.click(card('CIPLA'), { shiftKey: true })
    expect(screen.getByText('3 selected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /refresh today/i }))
    await settle()
    expect(h.refreshToday).toHaveBeenCalledWith({ tickers: ['ACC', 'BEL', 'CIPLA'] })
  })

  it('Remove all needs the word DELETE, then removes each symbol from its broker', async () => {
    render(<><SymbolSetupPage /><ConfirmHost /></>)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove all/i }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Remove everything' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(/to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(confirm)
    await settle()
    expect(h.removeSymbolFromBroker).toHaveBeenCalledTimes(4)
    expect(h.removeSymbolFromBroker).toHaveBeenCalledWith('f1', 'BEL')
    expect(useAppStore.getState().symbols).toHaveLength(0)
  })

  it('clicking a symbol opens its details panel', async () => {
    render(<SymbolSetupPage />)
    fireEvent.click(card('BEL'))
    await settle()
    expect(screen.getByRole('dialog', { name: 'BEL details' })).toBeTruthy()
  })

  it('Add Symbol: arrows and Enter add from the results, and the dialog stays open for more', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<SymbolSetupPage />)
      fireEvent.click(screen.getByRole('button', { name: /add symbol/i }))
      const input = screen.getByPlaceholderText(/search nse/i)
      fireEvent.change(input, { target: { value: 'REL' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await settle()
      expect(screen.getByText('Reliance Industries')).toBeTruthy()
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })
      await settle()
      expect(h.addSymbolsToBroker).toHaveBeenCalledWith('f1', [expect.objectContaining({ ticker: 'RELINFRA' })])
      expect(screen.getByPlaceholderText(/search nse/i)).toBeTruthy()
      expect(useAppStore.getState().symbols.some(s => s.ticker === 'RELINFRA')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
