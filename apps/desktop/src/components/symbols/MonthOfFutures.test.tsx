/**
 * Add a whole month of futures: month chips with counts (expired months hidden), and one click
 * adds every contract of the month that isn't tracked yet.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'

const fut = (ticker: string, expiry: string) => ({ instrumentId: `NSE:${ticker}`, ticker, exchange: 'NFO', instrumentType: 'FUT', lotSize: 500, tickSize: 0.1, expiry })
const h = vi.hoisted(() => ({ addSymbolsToBroker: vi.fn(async () => ({ added: 1 })) }))
vi.mock('../../api/apiClient', () => ({
  api: {
    listFutures: vi.fn(async (_id: string, kind: string) => ({
      kind,
      contracts: kind === 'stock'
        ? [fut('ACC20JANFUT', '2020-01-30'), fut('ACC99NOVFUT', '2099-11-24'), fut('TCS99NOVFUT', '2099-11-24'), fut('TCS99DECFUT', '2099-12-29')]
        : [fut('NIFTY99NOVFUT', '2099-11-24')],
    })),
    addSymbolsToBroker: h.addSymbolsToBroker,
  },
}))
vi.mock('../ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { MonthOfFutures } from './MonthOfFutures'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }

describe('a whole month of futures', () => {
  it('lists months still trading, and adds only the ones not tracked yet', async () => {
    const onAdded = vi.fn()
    render(<MonthOfFutures brokerId="f1" isAdded={t => t === 'TCS99NOVFUT'} onAdded={onAdded} />)
    await settle()
    expect(screen.queryByRole('button', { name: /jan 2020/i })).toBeNull()       // expired
    expect(within(screen.getByRole('button', { name: /nov 2099/i })).getByText('2')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /dec 2099/i })).getByText('1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /add the 1 not added yet/i }))
    await settle()
    expect(h.addSymbolsToBroker).toHaveBeenCalledWith('f1', [expect.objectContaining({ ticker: 'ACC99NOVFUT', instrumentId: 'NSE:ACC99NOVFUT' })])
    expect(onAdded).toHaveBeenCalledWith([expect.objectContaining({ ticker: 'ACC99NOVFUT' })])
  })

  it('index futures on the other chip', async () => {
    render(<MonthOfFutures brokerId="f1" isAdded={() => false} onAdded={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Index futures' }))
    await settle()
    expect(screen.getByRole('button', { name: /add all 1/i })).toBeTruthy()
  })
})
