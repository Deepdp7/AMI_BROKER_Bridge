import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

// The engine, faked: status answers and the WebSocket events the overlay listens to
const h = vi.hoisted(() => {
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  return {
    listeners,
    status: { isDownloading: false, isDownloadedToday: false, lastSync: 0, count: 0 },
    syncMaster: vi.fn(async () => ({ ok: true })),
    emit(type: string, payload: unknown) { listeners.get(type)?.forEach(fn => fn(payload)) },
  }
})

vi.mock('../../api/apiClient', () => ({
  api: {
    getMasterStatus: vi.fn(async () => ({ ...h.status })),
    syncMaster: h.syncMaster,
  },
  wsManager: {
    on(type: string, fn: (p: unknown) => void) {
      if (!h.listeners.has(type)) h.listeners.set(type, new Set())
      h.listeners.get(type)!.add(fn)
      return () => h.listeners.get(type)?.delete(fn)
    },
  },
}))

vi.mock('../../store/appStore', () => ({
  useAppStore: () => ({ brokers: [{ id: 'fyers-1', brokerType: 'fyers', label: 'Fyers', status: 'connected' }] }),
}))

import { MasterDownloadOverlay } from './MasterDownloadOverlay'

/** Lets pending promises (status check, sync request) settle */
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  vi.useFakeTimers()
  h.status = { isDownloading: false, isDownloadedToday: false, lastSync: 0, count: 0 }
  h.syncMaster.mockClear()
})
afterEach(() => { vi.useRealTimers() })

describe('symbol list card', () => {
  it('starts the download when today’s list is missing, shows real progress, and closes when done', async () => {
    render(<MasterDownloadOverlay />)
    await settle()
    expect(h.syncMaster).toHaveBeenCalledWith('fyers-1')
    expect(screen.getByText('Updating Fyers symbols')).toBeInTheDocument()

    act(() => h.emit('master_sync_progress', { brokerId: 'fyers-1', progress: 55, text: 'Downloading symbol lists (2 of 4)...' }))
    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.getByText('Downloading symbol lists (2 of 4)...')).toBeInTheDocument()

    act(() => h.emit('master_sync_complete', { brokerId: 'fyers-1', text: 'Symbols database up to date.' }))
    expect(screen.getByText('Symbol list updated')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByText('Symbol list updated')).toBeNull()
  })

  it('still ends when the "complete" event never arrives (it asks the engine itself)', async () => {
    render(<MasterDownloadOverlay />)
    await settle()
    expect(screen.getByText('Updating Fyers symbols')).toBeInTheDocument()
    h.status = { ...h.status, isDownloading: false, isDownloadedToday: true }
    await act(async () => { vi.advanceTimersByTime(2100) })
    await settle()
    expect(screen.getByText('Symbol list updated')).toBeInTheDocument()
  })

  it('shows why it failed and can try again, instead of spinning forever', async () => {
    render(<MasterDownloadOverlay />)
    await settle()
    act(() => h.emit('master_sync_error', { brokerId: 'fyers-1', error: 'Could not download the Fyers symbol list for NFO (timed out).' }))
    expect(screen.getByText('Symbol list not updated')).toBeInTheDocument()
    expect(screen.getByText(/NFO \(timed out\)/)).toBeInTheDocument()

    h.syncMaster.mockClear()
    fireEvent.click(screen.getByText('Try again'))
    await settle()
    expect(h.syncMaster).toHaveBeenCalledWith('fyers-1')
    expect(screen.getByText('Updating Fyers symbols')).toBeInTheDocument()
  })

  it('does nothing when today’s list is already there', async () => {
    h.status = { ...h.status, isDownloadedToday: true }
    render(<MasterDownloadOverlay />)
    await settle()
    expect(h.syncMaster).not.toHaveBeenCalled()
    expect(screen.queryByText(/symbols/i)).toBeNull()
  })
})
