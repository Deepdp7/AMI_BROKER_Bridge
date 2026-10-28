import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// The engine, faked: console lines as the real engine prints them
const h = vi.hoisted(() => ({
  lines: [] as any[],
  getConsole: vi.fn(async () => ({ lines: h.lines })),
}))

vi.mock('../api/apiClient', () => ({
  api: { getConsole: h.getConsole },
  wsManager: { isConnected: true, on: () => () => {} },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
// The raw view uses a virtual list that needs real layout; the test only needs to know it is shown
vi.mock('../components/console/RawConsole', () => ({ RawConsole: () => <div>RAW CONSOLE</div> }))

import { useAppStore } from '../store/appStore'
import { ActivityPage } from './Activity'

const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }
const mount = () => render(
  <MemoryRouter initialEntries={['/console']}>
    <Routes>
      <Route path="/console" element={<ActivityPage />} />
      <Route path="/broker-connection" element={<div>BROKER CONNECTION PAGE</div>} />
    </Routes>
  </MemoryRouter>,
)

const now = Date.now()
beforeEach(() => {
  localStorage.clear()
  h.lines = [
    { seq: 1, ts: now - 60_000, level: 'log', text: '[Broker] fyers-1: subscribed 502 symbols for live ticks' },
    { seq: 2, ts: now - 50_000, level: 'log', text: '[HSM_SUB_SEND] count=50 firstToken=sf|nse_cm|26000 lastToken=sf|nse_cm|3351 packetBytes=770' },
    { seq: 3, ts: now - 40_000, level: 'log', text: '[FyersAdapter] Access token expired' },
  ]
  useAppStore.setState({
    brokers: [{ id: 'fyers-1', brokerType: 'fyers', label: 'Fyers', status: 'auth_required' }] as any,
    symbols: [], backfillStatuses: {}, backfillPaused: false, marketStatus: 'open',
  })
})

describe('Activity page', () => {
  it('shows plain sentences, hides engine noise, and the status cards say what to do', async () => {
    const { container } = mount()
    await settle()
    expect(screen.getByText('Live prices started for 502 symbols')).toBeTruthy()
    expect(screen.getByText('Your broker login has expired')).toBeTruthy()
    expect(container.textContent).not.toMatch(/HSM_SUB|firstToken|packetBytes/)
    // Status cards
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('Login needed')).toBeTruthy()
  })

  it('the Log in and fix buttons lead to Broker Connection', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('BROKER CONNECTION PAGE')).toBeTruthy()
  })

  it('"Needs attention" lists only problems', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /needs attention/i }))
    expect(screen.getByText('Your broker login has expired')).toBeTruthy()
    expect(screen.queryByText('Live prices started for 502 symbols')).toBeNull()
  })

  it('Technical shows the raw console, and the choice is remembered', async () => {
    const first = mount()
    await settle()
    fireEvent.click(screen.getByRole('tab', { name: 'Technical' }))
    expect(screen.getByText('RAW CONSOLE')).toBeTruthy()
    expect(screen.queryByText('Recent activity')).toBeNull()
    first.unmount()

    mount()
    await settle()
    expect(screen.getByText('RAW CONSOLE')).toBeTruthy()
  })

  it('an empty engine says so kindly instead of showing a blank box', async () => {
    h.lines = []
    mount()
    await settle()
    expect(screen.getByText('Nothing to show yet')).toBeTruthy()
  })
})
