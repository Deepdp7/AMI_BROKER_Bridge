import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const h = vi.hoisted(() => {
  ;(window as any).__TAURI_INTERNALS__ = {}
  const info = { createdAt: '2026-10-28T09:15:00.000Z', appVersion: '1.0.0', symbols: 502, bars: 4_300_000, bytes: 1.2 * 1024 ** 3 }
  return {
    info,
    save: vi.fn(async () => 'C:\\Backups\\DataBridge backup.dbpbackup'),
    open: vi.fn(async () => 'C:\\Backups\\old.dbpbackup'),
    createBackup: vi.fn(async () => ({ ok: true, ...info })),
    checkBackup: vi.fn(async () => ({ ok: true, ...info })),
    restoreBackup: vi.fn(async () => ({ ok: true, restarting: false, ...info })),
    toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
  }
})
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: h.save, open: h.open }))
vi.mock('../../api/apiClient', () => ({
  api: { createBackup: h.createBackup, checkBackup: h.checkBackup, restoreBackup: h.restoreBackup },
  isApiAvailable: vi.fn(async () => true),
}))
vi.mock('../ui/Toast', () => ({ toast: h.toast }))

import { BackupRestore, friendlyError, describeBackup } from './BackupRestore'

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => vi.clearAllMocks())

describe('Backup & restore', () => {
  it('saves a backup to the chosen file and says what is in it', async () => {
    render(<BackupRestore />)
    fireEvent.click(screen.getByRole('button', { name: /save a backup/i }))
    await settle()
    expect(h.createBackup).toHaveBeenCalledWith('C:\\Backups\\DataBridge backup.dbpbackup')
    expect(h.toast.success).toHaveBeenCalledWith('Backup saved', expect.stringMatching(/502 symbols · .* bars · 1\.2 GB/), 7000)
  })

  it('restore asks first, showing the backup, and "Keep my current data" changes nothing', async () => {
    render(<BackupRestore />)
    fireEvent.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await settle()
    expect(screen.getByText('Restore this backup?')).toBeTruthy()
    expect(screen.getByText(/502 symbols/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /keep my current data/i }))
    expect(h.restoreBackup).not.toHaveBeenCalled()
  })

  it('confirmed restore stages the backup', async () => {
    render(<BackupRestore />)
    fireEvent.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }))
    await settle()
    expect(h.restoreBackup).toHaveBeenCalledWith('C:\\Backups\\old.dbpbackup')
    expect(h.toast.info).toHaveBeenCalledWith('Restore ready', expect.any(String), 10000)
  })

  it('a file that is not a backup gets a plain message', async () => {
    h.checkBackup.mockRejectedValueOnce(new Error('API /system/restore/check failed (400): {"error":"This is not a DataBridge Pro backup"}'))
    render(<BackupRestore />)
    fireEvent.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await settle()
    expect(h.toast.error).toHaveBeenCalledWith("Can't restore this file", 'This is not a DataBridge Pro backup', 8000)
    expect(screen.queryByText('Restore this backup?')).toBeNull()
  })

  it('cancelling the file dialog does nothing', async () => {
    h.save.mockResolvedValueOnce(null as any)
    render(<BackupRestore />)
    fireEvent.click(screen.getByRole('button', { name: /save a backup/i }))
    await settle()
    expect(h.createBackup).not.toHaveBeenCalled()
  })

  it('helpers', () => {
    expect(friendlyError(new Error('API /x failed (400): {"error":"Disk full"}'))).toBe('Disk full')
    expect(friendlyError(new Error('Network down'))).toBe('Network down')
    expect(describeBackup({ ...h.info, bytes: 5 * 1024 ** 2 })).toMatch(/^502 symbols · .* bars · 5 MB · saved /)
  })
})
