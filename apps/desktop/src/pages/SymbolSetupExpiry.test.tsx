/**
 * Symbol Setup: futures by expiry month. Filter a month (or every expired contract), optionally
 * narrow to one symbol with the text filter, and remove them together; or pick some by hand.
 * Years 2020 / 2099 keep "expired" independent of today's date.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

const h = vi.hoisted(() => ({ removeSymbolFromBroker: vi.fn(async () => ({ ok: true })) }))
vi.mock('../api/apiClient', () => ({
  BASE_URL: '/api',
  api: {
    removeSymbolFromBroker: h.removeSymbolFromBroker,
    getSymbolHealth: vi.fn(async () => ({ symbols: [] })),
    getSymbolDetails: vi.fn(async () => []),
    getBackfillStatus: vi.fn(async () => ({ queueLength: 0, cancelled: 0, statuses: [] })),
  },
  wsManager: { on: () => () => {} },
}))
vi.mock('../hooks/useApiSync', () => ({ useEngineRefresh: () => {} }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { useAppStore, type SymbolFeed } from '../store/appStore'
import { SymbolSetupPage } from './SymbolSetup'
import { ConfirmHost } from '../components/ui/Dialog'

const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() }) }
const sym = (ticker: string, over: Partial<SymbolFeed> = {}): SymbolFeed => ({
  ticker, exchange: 'NFO', instrumentType: 'FUT', lastPrice: 100, prevClose: 100, lastTickUtcMs: 0, barsPerMin: 0,
  internalLatencyMs: 0, status: 'STALE', change: 0, changePercent: 0, volume: 0, brokerId: 'f1', ...over,
}) as SymbolFeed
const shown = () => [...document.querySelectorAll('[id^="symbol-chip-"]')].map(e => e.id.slice('symbol-chip-'.length)).sort()

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.dataset.motion = 'reduced'
  useAppStore.setState({
    brokers: [{ id: 'f1', brokerType: 'fyers', label: 'Fyers', status: 'connected' }] as any,
    symbols: [
      sym('ACC', { exchange: 'NSE', instrumentType: 'EQ' }),
      sym('RELIANCE20SEPFUT'), sym('TCS20SEPFUT'), sym('RELIANCE20OCTFUT'),
      sym('RELIANCE99NOVFUT'), sym('TCS99NOVFUT'),
    ],
  })
})

describe('futures by expiry month', () => {
  it('has a chip per month with its count, and one for everything expired', () => {
    render(<SymbolSetupPage />)
    expect(within(screen.getByRole('button', { name: /sep 2020/i })).getByText('2')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /nov 2099/i })).getByText('2')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /^expired/i })).getByText('3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /sep 2020/i }))
    expect(shown()).toEqual(['RELIANCE20SEPFUT', 'TCS20SEPFUT'])
  })

  it('removes every expired contract together', async () => {
    render(<><SymbolSetupPage /><ConfirmHost /></>)
    fireEvent.click(screen.getByRole('button', { name: /^expired/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove these 3/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove 3' }))
    await settle()
    expect(h.removeSymbolFromBroker.mock.calls.map((c: any[]) => c[1]).sort()).toEqual(['RELIANCE20OCTFUT', 'RELIANCE20SEPFUT', 'TCS20SEPFUT'])
    expect(useAppStore.getState().symbols.map(s => s.ticker).sort()).toEqual(['ACC', 'RELIANCE99NOVFUT', 'TCS99NOVFUT'])
  })

  it('one symbol\'s month only: the text filter narrows what is removed', async () => {
    render(<><SymbolSetupPage /><ConfirmHost /></>)
    fireEvent.change(screen.getByPlaceholderText(/filter your symbols/i), { target: { value: 'reliance' } })
    fireEvent.click(screen.getByRole('button', { name: /nov 2099/i }))
    expect(shown()).toEqual(['RELIANCE99NOVFUT'])
    fireEvent.click(screen.getByRole('button', { name: /remove these 1/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove 1' }))
    await settle()
    expect(h.removeSymbolFromBroker).toHaveBeenCalledTimes(1)
    expect(h.removeSymbolFromBroker).toHaveBeenCalledWith('f1', 'RELIANCE99NOVFUT')
  })

  it('or pick some of a month by hand', async () => {
    render(<><SymbolSetupPage /><ConfirmHost /></>)
    fireEvent.click(screen.getByRole('button', { name: /sep 2020/i }))
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(document.getElementById('symbol-chip-TCS20SEPFUT')!)
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove 1' }))
    await settle()
    expect(h.removeSymbolFromBroker).toHaveBeenCalledTimes(1)
    expect(h.removeSymbolFromBroker).toHaveBeenCalledWith('f1', 'TCS20SEPFUT')
  })
})
