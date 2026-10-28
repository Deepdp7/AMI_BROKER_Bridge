import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => ({
  cancelled: 433,
  restoreBackfill: vi.fn(async () => ({ ok: true, symbols: 433 })),
}))

vi.mock('../../api/apiClient', () => ({
  api: {
    getBackfillStatus: vi.fn(async () => ({ queueLength: 0, paused: false, cancelled: h.cancelled, statuses: [] })),
    restoreBackfill: h.restoreBackfill,
  },
  wsManager: { on: () => () => {} },
}))
vi.mock('../../hooks/useApiSync', () => ({ useEngineRefresh: () => {} }))
vi.mock('../ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { CancelledHistoryNotice } from './CancelledHistoryNotice'

const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => { vi.clearAllMocks(); h.cancelled = 433 })

describe('Cancelled history notice (Symbol Setup)', () => {
  it('says how many symbols were cancelled; Download now queues them again and hides it', async () => {
    render(<CancelledHistoryNotice />)
    await settle()
    expect(screen.getByText(/History download cancelled for 433 symbols\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /download now/i }))
    await settle()
    expect(h.restoreBackfill).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/History download cancelled/)).toBeNull()
  })

  it('shows nothing when nothing was cancelled', async () => {
    h.cancelled = 0
    const { container } = render(<CancelledHistoryNotice />)
    await settle()
    expect(container.textContent).toBe('')
  })
})
