import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

// The engine, faked: the download card's three control calls
const h = vi.hoisted(() => ({
  pauseBackfill: vi.fn(async () => ({ ok: true, paused: true })),
  resumeBackfill: vi.fn(async () => ({ ok: true, paused: false })),
  cancelBackfill: vi.fn(async () => ({ ok: true, cancelled: 3, symbols: 3 })),
  etaMs: null as number | null,
  getBackfillStatus: vi.fn(async () => ({ queueLength: 3, paused: false, etaMs: h.etaMs, statuses: [] })),
}))

vi.mock('../../api/apiClient', () => ({ api: h }))
vi.mock('../ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { useAppStore } from '../../store/appStore'
import { BackfillStatusBanner, formatTimeLeft } from './BackfillStatusBanner'

const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }
const status = (ticker: string, st: string) => ({ ticker, status: st, progress: 0, candlesFetched: 0, completedChunks: 0, totalChunks: 4 })

beforeEach(() => {
  vi.clearAllMocks()
  h.etaMs = null
  useAppStore.setState({
    backfillPaused: false,
    backfillStatuses: { AAA: status('AAA', 'running'), BBB: status('BBB', 'pending'), CCC: status('CCC', 'pending') },
  })
})

describe('Download card controls', () => {
  it('Pause stops the queue and shows the paused card; Resume starts it again', async () => {
    render(<BackfillStatusBanner />)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    await settle()
    expect(h.pauseBackfill).toHaveBeenCalledTimes(1)
    expect(screen.getByText('History download paused')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    await settle()
    expect(h.resumeBackfill).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Downloading history')).toBeTruthy()
  })

  it('Cancel asks first; "Keep downloading" changes nothing', async () => {
    render(<BackfillStatusBanner />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText(/Stop all 3 downloads\?/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /keep downloading/i }))
    expect(h.cancelBackfill).not.toHaveBeenCalled()
    expect(Object.keys(useAppStore.getState().backfillStatuses)).toHaveLength(3)
  })

  it('confirmed Cancel drops every queued download', async () => {
    render(<BackfillStatusBanner />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    fireEvent.click(screen.getByRole('button', { name: /yes, cancel/i }))
    await settle()
    expect(h.cancelBackfill).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().backfillStatuses).toEqual({})
  })
})

describe('Time left', () => {
  it('reads like a person would say it', () => {
    expect(formatTimeLeft(20_000)).toBe('Less than a minute left')
    expect(formatTimeLeft(9 * 60_000)).toBe('About 9 min left')
    expect(formatTimeLeft(60 * 60_000)).toBe('About 1 h left')
    expect(formatTimeLeft(95 * 60_000)).toBe('About 1 h 35 min left')
  })

  it("shows the engine's estimate while downloading, and nothing before it knows", async () => {
    render(<BackfillStatusBanner />)
    await settle()
    expect(screen.queryByText(/left$/)).toBeNull()

    h.etaMs = 9 * 60_000
    useAppStore.setState({ backfillPaused: true })
    await settle()
    useAppStore.setState({ backfillPaused: false }) // resuming asks again
    await settle()
    expect(screen.getByText('About 9 min left')).toBeTruthy()
  })

  it('no time left while paused', async () => {
    h.etaMs = 9 * 60_000
    useAppStore.setState({ backfillPaused: true })
    render(<BackfillStatusBanner />)
    await settle()
    expect(screen.queryByText('About 9 min left')).toBeNull()
  })
})
