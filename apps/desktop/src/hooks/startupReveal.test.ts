/**
 * First start: the window (hidden by the shell) is shown only once the first data is in the
 * store, so it never opens on an empty "Connecting…" page.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  up: false,
  events: [] as string[],
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => { h.events.push(`invoke:${cmd}`) }),
}))
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: async () => true, requestPermission: async () => 'granted', sendNotification: () => {} }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../api/apiClient', () => ({
  isApiAvailable: vi.fn(async () => {
    const answer = h.up
    h.up = true // the engine answers on the second look
    return answer
  }),
  api: {
    getSettings: async () => ({}),
    getLogs: async () => [],
    getBrokers: async () => [{ id: 'f1', brokerType: 'fyers', label: 'Fyers', status: 'connected' }],
    getFeedStatus: async () => {
      h.events.push('data')
      return { symbols: [{ ticker: 'TCS', exchange: 'NSE', instrumentType: 'EQ', lastPrice: 2496.9, status: 'STALE' }], coreEngine: {} }
    },
    getBackfillStatus: async () => ({ statuses: [] }),
  },
  wsManager: { on: () => () => {}, connect: () => {}, isConnected: false },
}))

import { useApiSync } from './useApiSync'
import { useAppStore } from '../store/appStore'

describe('first start', () => {
  it('shows the window only after the first data is in, then says connected', async () => {
    ;(window as any).__TAURI_INTERNALS__ = {}
    try {
      const { result } = renderHook(() => useApiSync())
      expect(result.current.apiState).toBe('checking')
      await waitFor(() => expect(h.events).toContain('invoke:app_ready'), { timeout: 3000 })
      expect(h.events.indexOf('data')).toBeLessThan(h.events.indexOf('invoke:app_ready'))
      expect(useAppStore.getState().symbols.map(s => s.ticker)).toEqual(['TCS'])
      expect(result.current.apiState).toBe('connected')
      expect(h.events.filter(e => e === 'invoke:app_ready')).toHaveLength(1)
    } finally {
      delete (window as any).__TAURI_INTERNALS__
    }
  })
})
