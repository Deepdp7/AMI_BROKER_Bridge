/**
 * Start with the last session's data: the window shows at once, before the engine answers,
 * and the engine's data then replaces the snapshot in place.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ engineUp: false, events: [] as string[] }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async (cmd: string) => { h.events.push(`invoke:${cmd}`) }) }))
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: async () => true, requestPermission: async () => 'granted', sendNotification: () => {} }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../lib/startupSnapshot', () => ({ restoredFromSnapshot: true, startSnapshotSaving: () => {} }))
vi.mock('../api/apiClient', () => ({
  isApiAvailable: vi.fn(async () => { h.events.push(h.engineUp ? 'engine:up' : 'engine:down'); return h.engineUp }),
  api: {
    getSettings: async () => ({}),
    getLogs: async () => [],
    getBrokers: async () => [],
    getFeedStatus: async () => ({ symbols: [{ ticker: 'TCS', exchange: 'NSE', instrumentType: 'EQ', lastPrice: 2500, status: 'STALE' }], coreEngine: {} }),
    getBackfillStatus: async () => ({ statuses: [] }),
  },
  wsManager: { on: () => () => {}, connect: () => {}, isConnected: false },
}))

import { useApiSync } from './useApiSync'
import { useAppStore } from '../store/appStore'

describe('start with the last session\'s data', () => {
  it('shows the window before the engine answers, then the engine\'s data replaces the snapshot', async () => {
    ;(window as any).__TAURI_INTERNALS__ = {}
    useAppStore.setState({ symbols: [{ ticker: 'TCS', exchange: 'NSE', instrumentType: 'EQ', lastPrice: 2400, status: 'STALE' } as any] })
    try {
      renderHook(() => useApiSync())
      await waitFor(() => expect(h.events).toContain('invoke:app_ready'))
      expect(h.events.includes('engine:up')).toBe(false) // shown while the engine was still starting
      expect(useAppStore.getState().symbols[0].lastPrice).toBe(2400)
      h.engineUp = true
      await waitFor(() => expect(useAppStore.getState().symbols[0].lastPrice).toBe(2500), { timeout: 3000 })
      expect(h.events.filter(e => e === 'invoke:app_ready')).toHaveLength(1)
    } finally {
      delete (window as any).__TAURI_INTERNALS__
    }
  })
})
