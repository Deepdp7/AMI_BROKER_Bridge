/**
 * Fyers symbol-list download (downloadMasterContracts): finishes with "complete" only when all
 * four files arrived, reports a real error otherwise, never leaves a half-written file.
 * fetch is faked; runs in a temp home folder.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-fyersmaster-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'fm.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

let FyersAdapter: any
let masterDir: string
const BODY = 'x'.repeat(5000)

beforeAll(async () => {
  const db = await import('../src/db')
  await db.syncCachesPromise
  masterDir = path.join(db.DATA_DIR, 'fyers_master')
  FyersAdapter = (await import('../src/brokers/adapters/fyers/FyersAdapter')).FyersAdapter
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })

function events(adapter: any) {
  const seen: { type: string; data: any }[] = []
  for (const type of ['master_sync_progress', 'master_sync_complete', 'master_sync_error']) adapter.on(type, (data: any) => seen.push({ type, data }))
  return seen
}

describe('Fyers symbol list download', () => {
  it('downloads all four files at once and then reports complete', async () => {
    let inFlight = 0, most = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; most = Math.max(most, inFlight)
      await new Promise(r => setTimeout(r, 20))
      inFlight--
      return new Response(BODY, { status: 200 })
    }))
    const a = new FyersAdapter()
    const seen = events(a)
    await a.downloadMasterContracts('fyers-1')

    expect(most).toBe(4)
    expect(seen.at(-1)?.type).toBe('master_sync_complete')
    expect(seen.some(e => e.type === 'master_sync_error')).toBe(false)
    const progress = seen.filter(e => e.type === 'master_sync_progress').map(e => e.data.progress)
    expect(Math.max(...progress)).toBeLessThanOrEqual(100)
    expect(progress).toEqual([...progress].sort((x, y) => x - y))
    for (const f of ['NSE_CM.csv', 'NSE_FO.csv', 'MCX_COM.csv', 'BSE_CM.csv']) expect(fs.statSync(path.join(masterDir, f)).size).toBe(BODY.length)
    expect(fs.readdirSync(masterDir).some(f => f.endsWith('.part'))).toBe(false)
    expect(a.isMasterDownloadedToday()).toBe(true)
    expect(a.isDownloadingMaster).toBe(false)
  })

  it('reports an error naming the file that failed, never "complete"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('NSE_FO') ? new Response('busy', { status: 503, statusText: 'Service Unavailable' }) : new Response(BODY, { status: 200 })))
    const a = new FyersAdapter()
    const seen = events(a)
    const run = a.downloadMasterContracts('fyers-1')
    await vi.runAllTimersAsync()
    await run

    expect(seen.some(e => e.type === 'master_sync_complete')).toBe(false)
    const err = seen.find(e => e.type === 'master_sync_error')
    expect(err?.data.error).toMatch(/NFO \(HTTP 503/)
    expect(a.isDownloadingMaster).toBe(false)
  })
})
