import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'

vi.mock('../../api/apiClient', () => ({ BASE_URL: '/api' }))

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }

let headStatus: number | 'down'
const fetchMock = vi.fn(async (_url: any, _init?: any) => {
  if (headStatus === 'down') throw new TypeError('Failed to fetch')
  return { status: headStatus } as Response
})

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('SymbolLogo', () => {
  it('asks the engine for the company logo, and a final "no logo" (404) gives letters for good', async () => {
    headStatus = 404
    const { default: SymbolLogo } = await import('./SymbolLogo')
    const { container } = render(<SymbolLogo ticker="TCS" instrumentType="EQ" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/api/symbols/logo/TCS')
    fireEvent.error(img)
    await settle()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('TC')
    expect(fetchMock).toHaveBeenCalledWith('/api/symbols/logo/TCS', { method: 'HEAD' })

    // Drawn again (scrolling): straight to letters, no new request
    const again = render(<SymbolLogo ticker="TCS" instrumentType="EQ" />)
    expect(again.container.querySelector('img')).toBeNull()
  })

  it('"not ready yet" (the engine is starting, 503) is not final: letters meanwhile, then the picture is asked for again', async () => {
    vi.useFakeTimers()
    headStatus = 503
    const { default: SymbolLogo, LOGO_RETRY_MS } = await import('./SymbolLogo')
    const { container } = render(<SymbolLogo ticker="WIPRO" instrumentType="EQ" />)
    fireEvent.error(container.querySelector('img')!)
    await settle()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('WI')

    await act(async () => { await vi.advanceTimersByTimeAsync(LOGO_RETRY_MS[0] + 10) })
    // A new address, so the browser doesn't reuse the failed answer
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/symbols/logo/WIPRO?r=1')

    // The engine is not up at all: the same, not final
    headStatus = 'down'
    fireEvent.error(container.querySelector('img')!)
    await settle()
    expect(container.querySelector('img')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(LOGO_RETRY_MS[1] + 10) })
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/symbols/logo/WIPRO?r=2')

    // It worked this time: the picture stays
    expect(container.textContent).toBe('')
  })

  it('an index asks the engine too (NIFTY has an icon), and gets letters when there is none', async () => {
    headStatus = 404
    const { default: SymbolLogo } = await import('./SymbolLogo')
    const idx = render(<SymbolLogo ticker="NIFTY50" exchange="NSE" />)
    const img = idx.container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/api/symbols/logo/NIFTY50')
    fireEvent.error(img)
    await settle()
    expect(idx.container.textContent).toBe('NI')
  })

  it('an MCX commodity is drawn (metal symbol, droplet, flame) without asking for a picture', async () => {
    const { default: SymbolLogo } = await import('./SymbolLogo')
    const gold = render(<SymbolLogo ticker="GOLDM26NOVFUT" exchange="MCX" />)
    expect(gold.container.querySelector('img')).toBeNull()
    expect(gold.container.textContent).toBe('Au')
    expect(render(<SymbolLogo ticker="SILVERMIC26NOVFUT" exchange="MCX" />).container.textContent).toBe('Ag')
    expect(render(<SymbolLogo ticker="CRUDEOIL26NOVFUT" exchange="MCX" />).container.querySelector('svg')).not.toBeNull()
    expect(render(<SymbolLogo ticker="NATURALGAS26NOVFUT" exchange="MCX" />).container.querySelector('svg')).not.toBeNull()
    // The same name on another exchange is not a commodity
    expect(render(<SymbolLogo ticker="GOLDBEES" exchange="NSE" />).container.querySelector('img')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encodes tickers like M&M', async () => {
    headStatus = 404
    const { default: SymbolLogo } = await import('./SymbolLogo')
    const { container } = render(<SymbolLogo ticker="M&M" instrumentType="EQ" />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/symbols/logo/M%26M')
  })
})
