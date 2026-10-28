/**
 * DataBridge Pro — settings read back after a restart are the same values that were saved
 * (they used to come back as text: a switch saved off showed on, numbers stopped matching,
 * paths gained quotes, the daily re-login ran although it was switched off).
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-settings-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'settings.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

/** A fresh copy of the database module on the same file: what the next app start sees */
async function restart() {
  vi.resetModules()
  const db = await import('../src/db')
  await db.syncCachesPromise
  return db
}

describe('Settings after a restart', () => {
  it('come back with the same types and values', async () => {
    const first = await restart()
    first.upsertSettings({
      autoStartAmiBroker: false,
      historyUseAllBrokers: false,
      backfillDepthDays: 730,
      amiBrokerPath: 'C:\\Program Files (x86)\\AmiBroker',
      historySkipped: ['ACC', 'M&M'],
    })
    first.upsertSettings('dailyReloginEnabled', 'false') // single-key writes store plain text
    first.upsertSettings('dailyReloginTime', '08:45')
    first.flushPendingBars()

    const s: any = (await restart()).getAllSettings()
    expect(s.autoStartAmiBroker).toBe(false)
    expect(s.historyUseAllBrokers).toBe(false)
    expect(s.backfillDepthDays).toBe(730)
    expect(s.amiBrokerPath).toBe('C:\\Program Files (x86)\\AmiBroker')
    expect(s.historySkipped).toEqual(['ACC', 'M&M'])
    expect(s.dailyReloginEnabled).toBe(false) // "false" text must not turn the re-login on
    expect(s.dailyReloginTime).toBe('08:45')
  })
})
