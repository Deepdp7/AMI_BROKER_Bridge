import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

vi.mock('../api/apiClient', () => ({ BASE_URL: '/api', isApiAvailable: vi.fn(async () => true) }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn(async () => {}) }))

import { useAppStore, type SymbolFeed } from '../store/appStore'
import { BrokerConnectionPage } from './BrokerConnection'
import { ConfirmHost } from '../components/ui/Dialog'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const sym = (ticker: string, brokerId: string) => ({ ticker, brokerId, exchange: 'NSE', instrumentType: 'EQ', status: 'STALE', lastPrice: 1, changePercent: 0 }) as SymbolFeed
const fetchMock = vi.fn(async (..._args: any[]): Promise<any> => ({ ok: true, json: async () => ({ loginUrl: 'https://login' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  document.documentElement.dataset.motion = 'reduced' // numbers show their value at once
  useAppStore.setState({
    brokers: [
      { id: 'f1', brokerType: 'fyers', label: 'Fyers', status: 'connected', lastConnectedAt: Date.now() - 3600_000 },
      { id: 'd1', brokerType: 'dhan', label: 'Dhan', status: 'auth_required' },
    ],
    symbols: [sym('TCS', 'f1'), sym('INFY', 'f1'), sym('ITC', 'd1')],
  })
})

describe('Broker Connection', () => {
  it('summarises the connections and shows each broker with its symbols and history speed', () => {
    render(<BrokerConnectionPage />)
    expect(screen.getByText('1 of 2 connected · 1 needs a login')).toBeTruthy()
    const fyers = document.getElementById('broker-card-f1')!
    expect(within(fyers).getByText('2')).toBeTruthy()                       // its symbols
    expect(within(fyers).getAllByText('Medium').length).toBeGreaterThan(0)   // Fyers history speed
    const dhan = document.getElementById('broker-card-d1')!
    expect(within(dhan).getByText('Daily login needed')).toBeTruthy()
    expect(screen.getByText('RECOMMENDED')).toBeTruthy()
  })

  it('remove asks first, saying the symbols stay; cancelling keeps the broker', async () => {
    render(<><BrokerConnectionPage /><ConfirmHost /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Fyers' }))
    expect(screen.getByText('Remove Fyers?')).toBeTruthy()
    expect(screen.getByText(/Your 2 symbols and all downloaded history stay/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAppStore.getState().brokers).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Fyers' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove broker' }))
    await settle()
    expect(fetchMock).toHaveBeenCalledWith('/api/brokers/f1', { method: 'DELETE' })
    expect(useAppStore.getState().brokers.map(b => b.id)).toEqual(['d1'])
  })

  it('a broker in the gallery opens the connect dialog with that broker chosen', async () => {
    render(<BrokerConnectionPage />)
    fireEvent.click(screen.getByTitle('Connect Zerodha Kite'))
    await settle()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Connect a broker')).toBeTruthy()
    expect(within(dialog).getByText('http://127.0.0.1:7890/api/callback/zerodha_kite')).toBeTruthy()
    expect((within(dialog).getByRole('button', { name: /save & log in/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a broker that logs in with its keys (XTS) connects at once: no redirect URL, no browser', async () => {
    const { open } = await import('@tauri-apps/plugin-shell')
    fetchMock.mockImplementation(async (url: any, init?: any) => ({
      ok: true,
      json: async () => (url === '/api/brokers' && init?.method === 'POST'
        ? { broker: { id: 'c1', brokerType: 'compositedge', label: 'Compositedge', status: 'connected' }, loginUrl: null }
        : {}),
    }))
    render(<BrokerConnectionPage />)
    fireEvent.click(screen.getByTitle('Connect Compositedge'))
    await settle()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText(/api\/callback/)).toBeNull()
    expect(within(dialog).getByText(/No browser login/)).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('Market Data API Key'), { target: { value: 'Key1234abcd' } })
    fireEvent.change(within(dialog).getByLabelText('Market Data Secret Key'), { target: { value: 'Sec#1234' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save & connect/i }))
    await settle()
    expect(within(dialog).getByText('Connected')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    expect(useAppStore.getState().brokers.some(b => b.id === 'c1')).toBe(true)
  })
})
