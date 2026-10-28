import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ invoke: vi.fn(async () => 'Started AmiBroker from C:\\Program Files (x86)\\AmiBroker\\Broker.exe') }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }))
vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../lib/assistantView', () => ({ setAssistantView: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  h.invoke.mockClear()
  ;(window as any).__TAURI_INTERNALS__ = {}
})

describe('Open AmiBroker automatically', () => {
  it('does nothing when the setting is off', async () => {
    const { maybeStartAmiBroker } = await import('./useApiSync')
    maybeStartAmiBroker({ autoStartAmiBroker: false })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('opens AmiBroker once per app start, with the folder from Settings', async () => {
    const { maybeStartAmiBroker } = await import('./useApiSync')
    const settings = { autoStartAmiBroker: true, amiBrokerPath: 'C:\\Program Files (x86)\\AmiBroker' }
    maybeStartAmiBroker(settings)
    maybeStartAmiBroker(settings) // a later resync must not open a second AmiBroker
    expect(h.invoke).toHaveBeenCalledTimes(1)
    expect(h.invoke).toHaveBeenCalledWith('start_amibroker', { path: 'C:\\Program Files (x86)\\AmiBroker' })
  })

  it('outside the desktop app (browser preview) nothing is started', async () => {
    delete (window as any).__TAURI_INTERNALS__
    const { maybeStartAmiBroker } = await import('./useApiSync')
    maybeStartAmiBroker({ autoStartAmiBroker: true })
    expect(h.invoke).not.toHaveBeenCalled()
  })
})
