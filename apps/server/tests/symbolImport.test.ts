/**
 * Import CSV (POST /api/brokers/:id/symbols/import) with the ready-made lists in symbols/,
 * which are made by scripts/make-symbol-csv.cjs. Runs against its own database in a temp home.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'

const execMock = vi.hoisted(() => vi.fn())
const execFileMock = vi.hoisted(() => vi.fn())
// The import also tells a running AmiBroker through PowerShell; never start it in tests
vi.mock('child_process', async orig => ({ ...(await orig<typeof import('child_process')>()), exec: execMock, execFile: execFileMock }))

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-import-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'import.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const SYMBOLS_DIR = path.resolve(__dirname, '../../../symbols')
const csv = (name: string) => fs.readFileSync(path.join(SYMBOLS_DIR, name), 'utf8')

let app: typeof import('../src/app').app
let db: typeof import('../src/db')

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  app = (await import('../src/app')).app
  const { backfillQueue } = await import('../src/market/BackfillQueue')
  const { brokerManager } = await import('../src/brokers/BrokerManager')
  // Importing must not start downloads or touch a broker here
  vi.spyOn(backfillQueue, 'enqueue').mockImplementation(() => undefined as any)
  vi.spyOn(brokerManager, 'subscribe').mockResolvedValue(undefined as any)
  db.stmts.insertBroker.run({ id: 'imp-1', broker_type: 'fyers', label: 'Fyers', credential_ref: 'x', status: 'connected', health_score: 100, reconnect_count_1h: 0, account_id: null, created_at: 1, last_connected_at: null })
})

afterAll(() => {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* file still open on Windows */ }
})

const importCsv = (text: string) => request(app).post('/api/brokers/imp-1/symbols/import').send({ csv: text })
const stored = () => (db.stmts.getSymbolsByBroker.all('imp-1') as any[])

describe('the ready-made symbol lists', () => {
  it('are in the format Import CSV reads, and not empty', () => {
    for (const f of ['indices.csv', 'nifty50.csv', 'nifty500.csv']) {
      const rows = csv(f).split(/\r?\n/).filter(l => l && !l.startsWith('#') && !l.startsWith('ticker'))
      expect(rows.length, f).toBeGreaterThanOrEqual(8)
      for (const r of rows) expect(r, `${f}: ${r}`).toMatch(/^[A-Z0-9&-]+,(NSE|BSE),(EQ|INDEX)$/)
      expect(new Set(rows).size, `${f} has repeated lines`).toBe(rows.length)
    }
  })

  it('import completely: every line is added, none is refused', async () => {
    for (const [file, expected] of [['indices.csv', 8], ['nifty50.csv', 50]] as const) {
      const res = await importCsv(csv(file))
      expect(res.status).toBe(200)
      expect(res.body.errors, file).toEqual([])
      expect(res.body.added, file).toBe(expected)
      expect(res.body.total, file).toBe(expected)
    }
    const names = stored().map(s => s.amiBrokerTicker)
    for (const t of ['NIFTY', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'M&M', 'BAJAJ-AUTO']) expect(names, t).toContain(t)
    expect(stored().find(s => s.amiBrokerTicker === 'NIFTY')?.instrumentType).toBe('INDEX')
    expect(stored().find(s => s.amiBrokerTicker === 'SENSEX')?.exchange).toBe('BSE')
  })

  it('Nifty 500 imports completely too, and Nifty 50 inside it is not duplicated', async () => {
    const res = await importCsv(csv('nifty500.csv'))
    expect(res.status).toBe(200)
    expect(res.body.errors).toEqual([])
    expect(res.body.added).toBe(res.body.total)
    expect(res.body.total).toBeGreaterThan(450)
    const names = stored().map(s => s.amiBrokerTicker)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThan(450)
  })
})

describe('a hostile CSV', () => {
  it('cannot put commands into a PowerShell line: tickers never go into one', async () => {
    execMock.mockClear()
    execFileMock.mockClear()
    const res = await importCsv(['GOODONE,NSE,EQ', "EVIL'; calc; '", 'BAD"X,NSE,EQ', 'ALSO$(calc),NSE,EQ', 'PCT%PATH%,NSE,EQ'].join('\n'))
    expect(res.status).toBe(200)
    expect(res.body.added).toBe(1)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3)
    // AmiBroker is told through a data file handed to a fixed script (amibroker/symbolDetails.ts)
    const ran = [...execMock.mock.calls, ...execFileMock.mock.calls].map(c => JSON.stringify(c.slice(0, 2))).join('\n')
    for (const t of ['GOODONE', 'EVIL', 'calc', 'BAD"X', 'PATH']) expect(ran, t).not.toContain(t)
  })
})
