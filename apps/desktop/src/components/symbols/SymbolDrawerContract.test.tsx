/**
 * The symbol panel shows the contract from the broker's list: lot size, tick size, expiry and
 * what one lot costs at the current price (the budget question: can one lot be bought?).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../api/apiClient', () => ({
  api: {
    getSymbolHealth: vi.fn(async () => ({ symbols: [] })),
    getSymbolDetails: vi.fn(async () => [
      { ticker: 'RELIANCE26NOVFUT', name: 'RELIANCE 23 Nov 26 FUT', lotSize: 500, tickSize: 0.1, expiry: '2026-11-23' },
      { ticker: 'CRUDEOIL26NOVFUT', name: 'CRUDEOIL 19 Nov 26 FUT', lotSize: 1, tickSize: 1, expiry: '2026-11-19', pointValue: 100 },
    ]),
  },
}))

import { SymbolDrawer } from './SymbolDrawer'
import { useAppStore } from '../../store/appStore'
import { lotValue } from '../../hooks/useSymbolDetails'

const sym = (ticker: string, lastPrice: number) =>
  ({ ticker, exchange: ticker.startsWith('CRUDE') ? 'MCX' : 'NFO', instrumentType: 'FUT', lastPrice, status: 'STREAMING', change: 0, changePercent: 0 }) as any

describe('contract details in the symbol panel', () => {
  it('shows the lot size, tick, expiry and what one lot costs', async () => {
    useAppStore.setState({ symbols: [sym('RELIANCE26NOVFUT', 1400), sym('CRUDEOIL26NOVFUT', 5600)] })
    render(<SymbolDrawer ticker="RELIANCE26NOVFUT" onClose={() => {}} />)
    expect(await screen.findByText('500 shares')).toBeTruthy()
    expect(screen.getByText('₹0.1')).toBeTruthy()
    expect(screen.getByText('2026-11-23')).toBeTruthy()
    expect(screen.getByText('₹7,00,000')).toBeTruthy() // 500 × 1400
  })

  it('values an MCX lot by what it earns per rupee of move', () => {
    expect(lotValue({ ticker: 'CRUDEOIL26NOVFUT', name: '', lotSize: 1, tickSize: 1, expiry: '', pointValue: 100 }, 5600)).toBe(560_000)
    expect(lotValue({ ticker: 'TCS', name: '', lotSize: 1, tickSize: 0.1, expiry: '' }, 3000)).toBe(3000)
  })
})
