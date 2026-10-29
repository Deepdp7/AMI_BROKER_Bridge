import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

vi.mock('../api/apiClient', () => ({ BASE_URL: '/api', isApiAvailable: vi.fn(async () => true) }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn(async () => {}) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => ({ message: 'ok', path: null, alreadyOpen: true, pluginInstalled: true })) }))

import { useAppStore } from '../store/appStore'

const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve() }) }

const PLATFORMS = [
  { id: 'amibroker', name: 'AmiBroker', kind: 'desktop', level: 'live', gives: 'Live charts', installed: true, website: '', instances: [{ folder: 'C:\\AB', exe: 'C:\\AB\\Broker.exe', connectorFolder: 'C:\\AB\\Plugins', connectorInstalled: true }] },
  { id: 'excel', name: 'Microsoft Excel', kind: 'desktop', level: 'live', gives: 'Live prices in cells', installed: true, note: '64-bit', website: '', instances: [{ folder: 'C:\\Office', exe: 'C:\\Office\\EXCEL.EXE', connectorInstalled: false, label: 'Office 64-bit' }] },
  { id: 'metatrader5', name: 'MetaTrader 5', kind: 'desktop', level: 'live', gives: 'Custom symbols', installed: false, website: '', instances: [] },
  { id: 'tradingview', name: 'TradingView', kind: 'web', level: 'watchlist', gives: 'Watchlists', installed: true, website: 'https://www.tradingview.com', instances: [] },
  { id: 'chartink', name: 'Chartink', kind: 'web', level: 'watchlist', gives: 'Scans in', installed: true, website: 'https://chartink.com', instances: [] },
]

let state: any
const calls: Array<{ url: string; method: string; body?: any }> = []
const fetchMock = vi.fn(async (url: any, init?: any) => {
  calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : undefined })
  const json = (body: any, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body })
  if (String(url).startsWith('/api/platforms?') || url === '/api/platforms') return json(state)
  if (url === '/api/platforms/chosen') return json({ chosen: JSON.parse(init.body).ids })
  if (url === '/api/platforms/excel/install') return json({ ok: true, message: 'Live prices installed', platform: { ...PLATFORMS[1], instances: [{ ...PLATFORMS[1].instances[0], connectorInstalled: true }] } })
  if (url === '/api/platforms/chartink/import') return json({ ok: true, found: 2, added: 2, already: 0, noFuture: [] })
  if (url === '/api/platforms/csv/live') return json({ ok: true, on: JSON.parse(init.body).on, folder: 'C:\\Docs\\DataBridge Pro\\CSV', added: 10 })
  return json({})
})

beforeEach(async () => {
  vi.resetModules()
  calls.length = 0
  vi.stubGlobal('fetch', fetchMock)
  document.documentElement.dataset.motion = 'reduced'
  useAppStore.setState({ brokers: [{ id: 'd1', brokerType: 'dhan', label: 'Dhan', status: 'connected' } as any] })
})

describe('Platforms', () => {
  it('shows the chosen platforms with what to do for each, and the rest as "also supported"', async () => {
    state = { platforms: PLATFORMS, chosen: ['amibroker', 'excel', 'chartink'], asked: true }
    const { PlatformsPage } = await import('./Platforms')
    render(<PlatformsPage />)
    await settle()
    const excel = document.getElementById('platform-excel')!
    expect(within(excel).getByText('=RTD("DataBridge.RTD",,"RELIANCE","LTP")')).toBeTruthy()
    expect(within(excel).getByText(/live prices not installed yet/)).toBeTruthy()
    expect(within(document.getElementById('platform-amibroker')!).getByText(/DataBridge plugin installed/)).toBeTruthy()
    expect(screen.getByText('Also supported')).toBeTruthy()
    expect(screen.getByText('Not found on this PC')).toBeTruthy()   // MetaTrader 5

    fireEvent.click(within(excel).getByRole('button', { name: /install live prices/i }))
    await settle()
    expect(calls.some(c => c.url === '/api/platforms/excel/install' && c.method === 'POST')).toBe(true)
    expect(within(document.getElementById('platform-excel')!).getByText(/Live prices installed \(Office 64-bit\)/)).toBeTruthy()
  })

  it('adds a pasted Chartink scan to the broker, as this month\'s futures when asked', async () => {
    state = { platforms: PLATFORMS, chosen: ['chartink'], asked: true }
    const { PlatformsPage } = await import('./Platforms')
    render(<PlatformsPage />)
    await settle()
    fireEvent.change(screen.getByLabelText('Chartink scan CSV or symbols'), { target: { value: 'RELIANCE, TCS' } })
    fireEvent.click(screen.getByRole('radio', { name: "As this month's futures" }))
    fireEvent.click(screen.getByRole('button', { name: /add to databridge/i }))
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/chartink/import')?.body).toEqual({ brokerId: 'd1', text: 'RELIANCE, TCS', as: 'FUT' })
  })
})

describe('CSV files kept up to date', () => {
  it('the switch turns the minute-by-minute updates on, and shows them on', async () => {
    const csv = { id: 'csv', name: 'CSV files (any software)', kind: 'file', level: 'live', gives: 'Files', installed: true, website: '', instances: [] }
    state = { platforms: [...PLATFORMS, csv], chosen: ['csv'], asked: true, csvLive: false }
    const { PlatformsPage } = await import('./Platforms')
    render(<PlatformsPage />)
    await settle()
    const toggle = screen.getByLabelText('Keep the CSV files up to date') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/csv/live')).toEqual({ url: '/api/platforms/csv/live', method: 'POST', body: { on: true } })
    expect((screen.getByLabelText('Keep the CSV files up to date') as HTMLInputElement).checked).toBe(true)
  })
})

describe('opening a symbol\'s chart on Chartink / TradingView', () => {
  const SYMBOLS = [
    { ticker: 'TCS', exchange: 'NSE', instrumentType: 'EQ' },
    { ticker: 'RELIANCE26NOVFUT', exchange: 'NFO', instrumentType: 'FUT' },
    { ticker: 'CRUDEOIL26NOVFUT', exchange: 'MCX', instrumentType: 'FUT' },
  ]

  it('the picker opens the chosen site on the typed symbol; Tab switches site; any NSE name works', async () => {
    state = { platforms: PLATFORMS, chosen: ['chartink', 'tradingview'], asked: true }
    // The modules were reset: the picker reads a fresh store
    ;(await import('../store/appStore')).useAppStore.setState({ symbols: SYMBOLS as any })
    const { ChartPicker } = await import('../components/platforms/OpenChart')
    const onClose = vi.fn()
    render(<ChartPicker open site="chartink" onClose={onClose} />)
    await settle()
    // Chartink has no MCX
    expect(screen.queryByText('CRUDEOIL26NOVFUT')).toBeNull()
    const input = screen.getByLabelText('Symbol')
    fireEvent.change(input, { target: { value: 'tc' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/chartink/open')?.body).toEqual({ ticker: 'TCS' })
    expect(onClose).toHaveBeenCalled()

    calls.length = 0
    fireEvent.keyDown(input, { key: 'Tab' })
    fireEvent.change(input, { target: { value: 'infy' } })   // not tracked
    fireEvent.keyDown(input, { key: 'Enter' })
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/tradingview/open')?.body).toEqual({ ticker: 'INFY' })
  })

  it('a card shows one logo button per chosen site that has the symbol', async () => {
    state = { platforms: PLATFORMS, chosen: ['amibroker', 'chartink'], asked: true }
    const { ChartLinkIcons } = await import('../components/platforms/OpenChart')
    render(<><ChartLinkIcons sym={SYMBOLS[0]} /><ChartLinkIcons sym={SYMBOLS[2]} /></>)
    await settle()
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Open TCS on Chartink'])
    fireEvent.click(screen.getByRole('button', { name: 'Open TCS on Chartink' }))
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/chartink/open')?.body).toEqual({ ticker: 'TCS' })
  })
})

describe('first start', () => {
  it('asks which platforms are used, with the ones found on this PC ticked, and saves the answer', async () => {
    state = { platforms: PLATFORMS, chosen: [], asked: false }
    const { FirstRunPlatformPicker } = await import('../components/platforms/FirstRunPlatformPicker')
    render(<FirstRunPlatformPicker />)
    await settle()
    expect(screen.getByText('Where do you look at charts?')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'AmiBroker' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'Microsoft Excel' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: 'MetaTrader 5' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chartink' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Microsoft Excel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use 2 platforms' }))
    await settle()
    expect(calls.find(c => c.url === '/api/platforms/chosen')).toEqual({ url: '/api/platforms/chosen', method: 'PUT', body: { ids: ['amibroker', 'chartink'] } })
  })
})
