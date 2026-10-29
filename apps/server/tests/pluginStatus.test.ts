/**
 * The DataBridge light in AmiBroker's status bar: green / yellow / red with a short word and a
 * tooltip, decided by the engine.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-light-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'light.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const base = { brokers: ['Fyers'], symbols: 25, downloading: 0, paused: false, marketOpen: true, lastTickAgoMs: 2000 }

describe('AmiBroker status light', () => {
  it('red without a logged-in broker', async () => {
    const { pluginStatusFrom } = await import('../src/amibroker/pluginStatus')
    expect(pluginStatusFrom({ ...base, brokers: [] })).toMatchObject({ level: 2, short: 'No broker' })
  })

  it('yellow while history downloads (unless paused), green and "Live" when ticks flow', async () => {
    const { pluginStatusFrom } = await import('../src/amibroker/pluginStatus')
    expect(pluginStatusFrom({ ...base, downloading: 12 })).toMatchObject({ level: 1, short: 'History 12' })
    expect(pluginStatusFrom(base)).toMatchObject({ level: 0, short: 'Live' })
    expect(pluginStatusFrom(base).long).toContain('Fyers live, 25 symbols')
    expect(pluginStatusFrom({ ...base, downloading: 3, paused: true, marketOpen: false }).long).toContain('History download paused')
  })

  it('yellow when the market is open but nothing arrives; green "OK" when closed', async () => {
    const { pluginStatusFrom } = await import('../src/amibroker/pluginStatus')
    expect(pluginStatusFrom({ ...base, lastTickAgoMs: 95_000 })).toMatchObject({ level: 1, short: 'No ticks' })
    expect(pluginStatusFrom({ ...base, lastTickAgoMs: 95_000 }).long).toContain('for 95 s')
    expect(pluginStatusFrom({ ...base, marketOpen: false, lastTickAgoMs: Infinity })).toMatchObject({ level: 0, short: 'OK' })
  })

  it('yellow "Reloading" with what to change when AmiBroker keeps reloading full histories', async () => {
    const { pluginStatusFrom, handlePluginNote, currentPluginStatus } = await import('../src/amibroker/pluginStatus')
    const s = pluginStatusFrom({ ...base, reloading: { symbols: 40, numBars: 100000 } })
    expect(s).toMatchObject({ level: 1, short: 'Reloading' })
    expect(s.long).toContain('40 symbols with all 1,00,000 bars')
    expect(s.long).toContain('Tools > Preferences > Data')
    // The note from the plugin shows for 15 minutes (no broker in this test, so red wins first)
    const now = Date.now()
    handlePluginNote('NOTE|RELOADS|40|100000', now)
    expect(currentPluginStatus(now + 60_000).short).toBe('No broker')
  })

  it('the engine stall watch reports only stretches of half a second or more', async () => {
    const { describeStall } = await import('../src/system/stallWatch')
    expect(describeStall(120, 30)).toBeNull()
    expect(describeStall(1830.4, 41)).toContain('busy for 1830 ms at once')
  })

  it('one line for the plugin, with nothing that could split it', async () => {
    const { statusLine } = await import('../src/amibroker/pluginStatus')
    expect(statusLine({ level: 1, short: 'History 2', long: 'a|b\nc' })).toBe('STATUS|1|History 2|a b c\n')
  })

  it('menu commands without a symbol or unknown ones do nothing', async () => {
    const { runPluginCommand } = await import('../src/amibroker/pluginStatus')
    expect(await runPluginCommand('CMD|REPAIR|')).toBe('ignored (no symbol)')
    expect(await runPluginCommand('CMD|FORMAT_DISK|C')).toBe('unknown command FORMAT_DISK')
    expect(await runPluginCommand('CMD|TODAY|NOT_TRACKED')).toBe('NOT_TRACKED: no broker for it')
  })
})
