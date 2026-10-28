/**
 * DataBridge Pro — backup & restore (Settings). The restore completes across a restart, so
 * each step runs as its own process, like the real app.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-backup-'))
const dataDir = path.join(home, 'AppData', 'Roaming', 'DataBridgePro')
const backupFile = path.join(home, 'My backup.dbpbackup')
const script = path.join(__dirname, 'helpers', 'backupScenario.ts')

function run(...args: string[]) {
  const out = execFileSync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      USERPROFILE: home, HOME: home, APPDATA: path.join(home, 'AppData', 'Roaming'),
      DATABRIDGE_DB_PATH: path.join(dataDir, 'databridge.db'),
      DATABRIDGE_NO_PG_IMPORT: '1',
      DATABRIDGE_SECRET_KEY: '11'.repeat(32),
    },
    encoding: 'utf8',
    timeout: 60_000,
  })
  const json = out.split('\n').reverse().find(l => l.startsWith('{'))
  return JSON.parse(json!)
}

afterAll(() => {
  try { fs.rmSync(home, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

describe('Backup & restore', () => {
  it('a backup holds the symbols, history and settings; a restore brings exactly that back after the restart', () => {
    const { made, staged } = run('make', backupFile)
    expect(made).toMatchObject({ symbols: 1, bars: 3 })
    expect(made.bytes).toBeGreaterThan(0)
    expect(staged.symbols).toBe(1)
    expect(fs.existsSync(path.join(dataDir, 'restore-pending.dbpbackup'))).toBe(true)

    const after = run('check')
    expect(after.symbols).toEqual(['AAA'])                // BBB, added after the backup, is gone
    expect(after.aaaBars).toBe(3)
    expect(after.depth).toBe(730)                          // the setting as it was in the backup
    expect(after.closedDays).toContain('2026-10-21')       // state files come back too
    expect(after.previousKept).toBe(true)                  // the replaced data is kept as a copy
    expect(after.backupTablesLeft).toEqual([])             // the live database has no backup-only tables
    expect(fs.existsSync(path.join(dataDir, 'restore-pending.dbpbackup'))).toBe(false)

    // The next start is a normal start (nothing applied twice)
    const again = run('check')
    expect(again.symbols).toEqual(['AAA'])
  })

  it('refuses a file that is not a backup', async () => {
    process.env.DATABRIDGE_DB_PATH = path.join(home, 'scratch.db')
    process.env.USERPROFILE = home
    process.env.DATABRIDGE_NO_PG_IMPORT = '1'
    const { readBackupInfo } = await import('../src/system/Backup')
    const notBackup = path.join(home, 'notes.txt')
    fs.writeFileSync(notBackup, 'hello')
    expect(() => readBackupInfo(notBackup)).toThrow(/not a DataBridge Pro backup/)
    expect(() => readBackupInfo(path.join(home, 'missing.dbpbackup'))).toThrow(/not found/)
  })
})
