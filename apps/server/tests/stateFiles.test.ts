/**
 * The small JSON state files (backfilled symbols, coverage watermarks, history floors) are saved in the
 * background: a catch-up or an import changes them hundreds of times in a row, and each change used to
 * rewrite the whole file on the engine's one thread.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-statefiles-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'state.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'
const DATA = path.join(tmpHome, 'AppData', 'Roaming', 'DataBridgePro')
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'))

beforeEach(() => {
  vi.resetModules()
  // Each test starts from no saved state (an earlier test's files would be read back as the engine's own)
  for (const f of ['backfill_state.json', 'coverage_state.json', 'history_floor.json']) fs.rmSync(path.join(DATA, f), { force: true })
})
afterEach(() => { vi.useRealTimers() })

describe('state files', () => {
  it('500 changes make one write, 500 ms after the last one', async () => {
    const { backfilledTickers } = await import('../src/market/state/backfillState')
    const { perf } = await import('../src/system/perf')
    const writesBefore = perf.snapshot().sinceStart.counters['catchup.state_writes'] ?? 0

    for (let i = 0; i < 500; i++) backfilledTickers.add(`SYM${i}`)
    expect(fs.existsSync(path.join(DATA, 'backfill_state.json'))).toBe(false)   // nothing written on the engine's thread
    await new Promise(r => setTimeout(r, 250))
    expect(fs.existsSync(path.join(DATA, 'backfill_state.json'))).toBe(false)   // not before the pause
    await vi.waitFor(() => expect(read('backfill_state.json')).toHaveLength(500), { timeout: 3000 })
    expect(perf.snapshot().sinceStart.counters['catchup.state_writes'] - writesBefore).toBe(1)
    expect(fs.existsSync(path.join(DATA, 'backfill_state.json.part'))).toBe(false)   // renamed over the real file
  })

  it('a change made while a write is under way is written too, not lost', async () => {
    const { backfilledTickers } = await import('../src/market/state/backfillState')
    backfilledTickers.add('A')
    await vi.waitFor(() => expect(read('backfill_state.json')).toEqual(['A']), { timeout: 3000 })
    backfilledTickers.add('B')
    backfilledTickers.delete('A')
    await vi.waitFor(() => expect(read('backfill_state.json')).toEqual(['B']), { timeout: 3000 })
  })

  it('what is pending is written when the engine exits, and a restart reads it back', async () => {
    const first = await import('../src/market/state/backfillState')
    const cov = await import('../src/market/state/coverageState')
    const { flushStateFilesSync } = await import('../src/lib/DebouncedFile')
    first.backfilledTickers.add('RESTARTX')
    cov.setVerifiedThroughMs('RESTARTX', 1_700_000_000_000)
    cov.setHistoryFloorMs('RESTARTX', 1_600_000_000_000)

    flushStateFilesSync()                      // what the engine's exit hook does
    vi.resetModules()                          // a new process, reading the files
    const again = await import('../src/market/state/backfillState')
    const cov2 = await import('../src/market/state/coverageState')
    expect(again.backfilledTickers.has('RESTARTX')).toBe(true)
    expect(cov2.getVerifiedThroughMs('RESTARTX')).toBe(1_700_000_000_000)
    expect(cov2.getHistoryFloorMs('RESTARTX')).toBe(1_600_000_000_000)

    cov2.clearVerifiedThrough('RESTARTX')      // clears the watermark and the floor
    ;(await import('../src/lib/DebouncedFile')).flushStateFilesSync()
    expect(read('coverage_state.json').RESTARTX).toBeUndefined()
    expect(read('history_floor.json').RESTARTX).toBeUndefined()
  })

  it('an older background write never replaces a newer synchronous one', async () => {
    const { DebouncedFile } = await import('../src/lib/DebouncedFile')
    const file = path.join(tmpHome, 'race.json')
    let value = 'old'
    const f = new DebouncedFile(file, () => JSON.stringify(value), 'Race', 1)
    f.schedule()
    await new Promise(r => setTimeout(r, 5))   // the background write has started (it holds "old")
    value = 'new'
    f.schedule()
    f.flushSync()
    await new Promise(r => setTimeout(r, 150))
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toBe('new')
  })
})
