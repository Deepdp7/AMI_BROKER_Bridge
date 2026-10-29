import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

const h = vi.hoisted(() => ({
  refreshToday: vi.fn(async () => ({ ok: true, queued: 3, skipped: 0 })),
}))
vi.mock('../api/apiClient', () => ({
  BASE_URL: '/api',
  api: { refreshToday: h.refreshToday, getSymbolHealth: vi.fn(async () => ({ symbols: [] })), repairSymbols: vi.fn() },
  wsManager: { on: () => () => {} },
}))
vi.mock('../hooks/useApiSync', () => ({ useEngineRefresh: () => {} }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
// jsdom has no layout, so the virtual table would show no rows: render them all
vi.mock('react-virtuoso', () => ({
  TableVirtuoso: ({ data, itemContent, fixedHeaderContent, components, context, computeItemKey }: any) => (
    <table>
      <thead>{fixedHeaderContent()}</thead>
      <tbody>
        {data.map((d: any, i: number) => (
          <components.TableRow key={computeItemKey(i, d)} item={d} context={context}>{itemContent(i, d)}</components.TableRow>
        ))}
      </tbody>
    </table>
  ),
}))

import { useAppStore, type SymbolFeed } from '../store/appStore'
import { FeedStatusPage } from './FeedStatus'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const sym = (ticker: string, over: Partial<SymbolFeed> = {}): SymbolFeed => ({
  ticker, exchange: 'NSE', instrumentType: 'EQ', lastPrice: 100, prevClose: 100, lastTickUtcMs: 0, barsPerMin: 0,
  internalLatencyMs: 0, status: 'STALE', change: 0, changePercent: 0, volume: 0, ...over,
})
const rowTickers = () => Array.from(document.querySelectorAll('tbody tr.feed-row')).map(r => r.getAttribute('title')?.replace('Open ', ''))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false, intervalMin: 1, running: false, lastRunAt: null, nextRunAt: null, lastError: null, lastRunSymbols: 0 }) })))
  document.documentElement.dataset.motion = 'reduced'
  useAppStore.setState({
    brokers: [{ id: 'f1', brokerType: 'fyers', label: 'Fyers', status: 'connected' }],
    marketStatus: 'closed',
    symbols: [
      sym('TCS', { changePercent: 1.5, status: 'STREAMING', brokerId: 'f1' }),
      sym('INFY', { changePercent: -0.5, brokerId: 'f1' }),
      sym('ITC', { changePercent: 0.4, brokerId: 'f1' }),
    ],
  })
})

describe('Feed Status', () => {
  it('quick filters show their counts and narrow the table', () => {
    render(<FeedStatusPage />)
    expect(rowTickers()).toEqual(['TCS', 'INFY', 'ITC'])
    const gainers = screen.getByRole('button', { name: /gainers/i })
    expect(within(gainers).getByText('2')).toBeTruthy()
    fireEvent.click(gainers)
    expect(rowTickers()).toEqual(['TCS', 'ITC'])
    fireEvent.click(screen.getByRole('button', { name: /losers/i }))
    expect(rowTickers()).toEqual(['INFY'])
  })

  it('clicking a column sorts; a pinned symbol stays on top and is remembered', () => {
    const { unmount } = render(<FeedStatusPage />)
    fireEvent.click(screen.getByTitle('Sort by price / change'))
    expect(rowTickers()).toEqual(['TCS', 'ITC', 'INFY'])
    fireEvent.click(screen.getByRole('button', { name: 'Pin INFY' }))
    expect(rowTickers()).toEqual(['INFY', 'TCS', 'ITC'])
    expect(screen.getByRole('button', { name: /pinned/i })).toBeTruthy()
    unmount()
    render(<FeedStatusPage />)
    expect(rowTickers()[0]).toBe('INFY')
  })

  it('Refresh all today is one request for every symbol', async () => {
    render(<FeedStatusPage />)
    fireEvent.click(screen.getByRole('button', { name: /refresh all today/i }))
    await settle()
    expect(h.refreshToday).toHaveBeenCalledTimes(1)
    expect(h.refreshToday).toHaveBeenCalledWith({ all: true })
  })

  it('Pause view holds the prices still until Resume', () => {
    render(<FeedStatusPage />)
    fireEvent.click(screen.getByRole('button', { name: /pause view/i }))
    act(() => { useAppStore.getState().updateSymbolFeed('TCS', { lastPrice: 222 }) })
    expect(screen.queryByText('₹222.00')).toBeNull()
    expect(screen.getByText(/View paused at/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /resume/i })[0])
    expect(screen.getByText('₹222.00')).toBeTruthy()
  })

  it('a row opens the details panel', async () => {
    render(<FeedStatusPage />)
    fireEvent.click(screen.getByTitle('Open ITC'))
    await settle()
    const panel = screen.getByRole('dialog', { name: 'ITC details' })
    expect(within(panel).getByText('Refresh today')).toBeTruthy()
    expect(within(panel).getByText('Fyers')).toBeTruthy()
  })
})
