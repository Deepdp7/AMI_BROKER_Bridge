import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  saved: {} as any,
  updateSettings: vi.fn(async (s: any) => ({ ...s })),
  cleanDatabase: vi.fn(async () => ({ ok: true })),
  fullForceClean: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../api/apiClient', () => ({
  api: {
    getSettings: vi.fn(async () => ({ ...h.saved })),
    updateSettings: h.updateSettings,
    cleanDatabase: h.cleanDatabase,
    fullForceClean: h.fullForceClean,
    pickFolder: vi.fn(),
  },
  isApiAvailable: vi.fn(async () => true),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => false) }))
vi.mock('../components/ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../components/settings/BackupRestore', () => ({ BackupRestore: () => <div>Backup & restore</div> }))

import { useAppStore } from '../store/appStore'
import { SettingsPage, changedKeys, matchesQuery } from './Settings'
import { ConfirmHost } from '../components/ui/Dialog'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  vi.clearAllMocks()
  const current = useAppStore.getState().settings
  h.saved = { ...current, autoStartAmiBroker: false, backfillDepthDays: 365 }
  useAppStore.setState({ settings: { ...current, autoStartAmiBroker: false, backfillDepthDays: 365 } })
})

describe('Settings', () => {
  it('shows an unsaved-changes bar only after a change, and Discard puts the saved value back', async () => {
    render(<SettingsPage />)
    await settle()
    expect(screen.queryByText(/unsaved change/)).toBeNull()

    fireEvent.click(screen.getByLabelText('', { selector: '#auto-start-ab' }))
    expect(useAppStore.getState().settings.autoStartAmiBroker).toBe(true)
    expect(screen.getByText('1 unsaved change')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    expect(useAppStore.getState().settings.autoStartAmiBroker).toBe(false)
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('Ctrl+S saves to the data service and the bar goes away', async () => {
    render(<SettingsPage />)
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: '2Y' }))
    expect(screen.getByText('1 unsaved change')).toBeTruthy()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    await settle()
    expect(h.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ backfillDepthDays: 730 }))
    expect(screen.queryByText(/unsaved change/)).toBeNull()
  })

  it('search keeps only the matching sections', async () => {
    render(<SettingsPage />)
    await settle()
    fireEvent.change(screen.getByPlaceholderText('Search settings'), { target: { value: 'tray' } })
    expect(screen.getByText('Start with Windows')).toBeTruthy()
    expect(screen.queryByText('History depth')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('Search settings'), { target: { value: 'zzz nothing' } })
    expect(screen.getByText(/No settings match/)).toBeTruthy()
  })

  it('Clean database asks in the app and needs the word CLEAN; cancelling does nothing', async () => {
    render(<><SettingsPage /><ConfirmHost /></>)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /clean database/i }))
    expect(screen.getByText('Clean the database?')).toBeTruthy()
    const confirm = screen.getByRole('dialog').querySelector('button[type="submit"]') as HTMLButtonElement
    expect(confirm.disabled).toBe(true) // until CLEAN is typed
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(h.cleanDatabase).not.toHaveBeenCalled()
  })

  it('helpers', () => {
    expect(matchesQuery('Start with Windows tray', 'windows TRAY')).toBe(true)
    expect(matchesQuery('History depth', 'history speed')).toBe(false)
    // Keys the engine doesn't know are not "unsaved"; Start with Windows applies at once and never counts
    expect(changedKeys({ logLevel: 'debug', autoStartWithWindows: true } as any, { logLevel: 'info' } as any)).toEqual(['logLevel'])
    expect(changedKeys({ logLevel: 'debug' } as any, null)).toEqual([])
  })
})
