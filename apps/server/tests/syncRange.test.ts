/**
 * Stage 3d: the SYNC notice names the range of history that changed ("SYNC|ticker|from|to"), notices for one
 * symbol that come within a second are one line, and a notice without a range stays what it was.
 */
import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import net from 'net'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-sync-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'sync.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

vi.mock('../src/config', async (orig) => ({ ...(await orig<any>()), AMIBROKER_IPC_PORT: 17894 }))
vi.mock('../src/amibroker/symbolDetails', () => ({ startSymbolDetailsSync() {}, schedulePush() {} }))

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('SYNC notices', () => {
  it('coalesce per symbol to the oldest start and the newest end; a notice without a range leaves the end open', async () => {
    const { startAmiBrokerIpc, notifyAmiBrokerHistoryChanged } = await import('../src/amibroker/ipcServer')
    const { backfillQueue } = await import('../src/market/BackfillQueue')
    const server = startAmiBrokerIpc()
    await new Promise<void>(r => server.listening ? r() : server.once('listening', () => r()))
    const client = net.connect(17894, '127.0.0.1')
    await new Promise<void>(r => client.once('connect', () => r()))
    let received = ''
    client.on('data', d => { received += d.toString() })
    await sleep(100)

    // a download of several chunks: each chunk's notice, newest first
    notifyAmiBrokerHistoryChanged('TA', 5000, 6000)
    notifyAmiBrokerHistoryChanged('TA', 4000, 4900)
    notifyAmiBrokerHistoryChanged('TA', 5500, 7000)
    // a ranged notice, then a refresh without a range: "up to now" cannot be narrowed
    notifyAmiBrokerHistoryChanged('TB', 1000, 2000)
    notifyAmiBrokerHistoryChanged('TB')
    // no range at all, an engine's old-style notice with only a start, and one range
    notifyAmiBrokerHistoryChanged('TC')
    notifyAmiBrokerHistoryChanged('TD', 3000)
    notifyAmiBrokerHistoryChanged('TE', 8000, 9000)
    // a gap-filled chunk reaches the same line through the download queue's event
    backfillQueue.emit('bars_gap_filled', { ticker: 'TF', fromSec: 100, toSec: 200 })
    backfillQueue.emit('bars_gap_filled', { ticker: 'TG', fromSec: 100 })   // an emitter that gives no end

    await vi.waitFor(() => expect(received.split('\n').filter(l => l.startsWith('SYNC|')).length).toBe(7), { timeout: 4000, interval: 50 })
    const lines = new Map(received.split('\n').filter(l => l.startsWith('SYNC|')).map(l => [l.split('|')[1], l]))
    expect(lines.get('TA')).toBe('SYNC|TA|4000|7000')
    expect(lines.get('TB')).toBe('SYNC|TB|1000')
    expect(lines.get('TC')).toBe('SYNC|TC')
    expect(lines.get('TD')).toBe('SYNC|TD|3000')
    expect(lines.get('TE')).toBe('SYNC|TE|8000|9000')
    expect(lines.get('TF')).toBe('SYNC|TF|100|200')
    expect(lines.get('TG')).toBe('SYNC|TG|100')

    client.destroy()
    await new Promise<void>(r => server.close(() => r()))
  }, 15_000)
})
