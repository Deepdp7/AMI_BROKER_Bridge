/**
 * Lot size, tick size and name of tracked symbols, from each broker's instrument list, for
 * AmiBroker's Symbol Information. Fyers rows are real lines from the public lists; the Kite
 * records are the shape every listed broker shares. Runs in a temp home folder.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-symdetails-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'sd.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const NSE_CM = [
  '10100000002885,RELIANCE INDUSTRIES LTD,0,1,0.1,INE002A01018,0915-1530|1815-1915:,2026-10-26,,NSE:RELIANCE-EQ,10,10,2885,RELIANCE,2885,-1.0,XX,10100000002885,None,1,3.7',
  '101000000026000,NIFTY50-INDEX,10,0,0.05,,0915-1530|1815-1915:,2026-10-26,,NSE:NIFTY50-INDEX,10,10,26000,NIFTY,26000,-1.0,XX,101000000026000,None,0,0.0',
]
const NSE_FO = [
  '101126102748987,RELIANCE 27 Oct 26 FUT,13,500,0.1,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:RELIANCE26OCTFUT,10,11,48987,RELIANCE,2885,-1.0,XX,10100000002885,None,0,0.0',
  '101126112361471,NIFTY 23 Nov 26 FUT,11,65,0.1,,0915-1540|1815-1915:,2026-10-26,1795428600,NSE:NIFTY26NOVFUT,10,11,61471,NIFTY,26000,-1.0,XX,101000000026000,None,0,0.0',
]
const MCX_COM = [
  '1120261119573422,CRUDEOIL 19 Nov 26 FUT,30,1,1.0,,0900-2330|1815-1915:,2026-10-27,1795111200,MCX:CRUDEOIL26NOVFUT,11,20,573422,CRUDEOIL,294,-1.0,XX,1120000000294,1795111200,0,0.0',
]

let db: typeof import('../src/db')
let sd: typeof import('../src/amibroker/symbolDetails')

function addSymbol(brokerId: string, ticker: string, raw: string, exchange = 'NSE', type = 'EQ') {
  db.stmts.insertSymbol.run({ broker_id: brokerId, instrument_id: raw, amibroker_ticker: ticker, exchange, instrument_type: type, raw_symbol: raw, created_at: Date.now() })
}
function addBroker(id: string, type: string) {
  db.stmts.insertBroker.run({ id, broker_type: type, label: type, credential_ref: 'x', status: 'auth_required', health_score: 100, reconnect_count_1h: 0, account_id: null, created_at: 1, last_connected_at: null })
}

beforeAll(async () => {
  db = await import('../src/db')
  await db.syncCachesPromise
  const dir = path.join(db.DATA_DIR, 'fyers_master')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'NSE_CM.csv'), NSE_CM.join('\n'))
  fs.writeFileSync(path.join(dir, 'NSE_FO.csv'), NSE_FO.join('\n'))
  fs.writeFileSync(path.join(dir, 'MCX_COM.csv'), MCX_COM.join('\n'))
  fs.writeFileSync(path.join(dir, 'BSE_CM.csv'), '')
  // Today's MCX lot values, as saved from Fyers' JSON list (no download in tests)
  const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10)
  fs.writeFileSync(path.join(dir, 'MCX_multipliers.json'), JSON.stringify({ date: today, multipliers: { 'MCX:CRUDEOIL26NOVFUT': 100 } }))

  const { kiteMaster } = await import('../src/brokers/adapters/kite/KiteAdapter')
  kiteMaster.setRecords([
    { key: 'NFO:TATAELXSI26NOVFUT', ticker: 'TATAELXSI26NOVFUT', name: 'TATAELXSI', exchange: 'NFO', cat: 'FUTSTK', lot: 100, tick: 0.5, expiry: '2026-11-24', ref: '111' },
    { key: 'NSE:TATAELXSI', ticker: 'TATAELXSI', name: 'TATA ELXSI', exchange: 'NSE', cat: 'EQ', lot: 1, tick: 0.5, expiry: '', ref: '222' },
  ])

  addBroker('fy1', 'fyers')
  addBroker('kite1', 'zerodha_kite')
  addSymbol('fy1', 'RELIANCE', 'NSE:RELIANCE-EQ')
  addSymbol('fy1', 'RELIANCE26OCTFUT', 'NSE:RELIANCE26OCTFUT', 'NFO', 'FUT')
  addSymbol('fy1', 'NIFTY', 'NSE:NIFTY50-INDEX', 'NSE', 'INDEX')
  addSymbol('fy1', 'CRUDEOIL26NOVFUT', 'MCX:CRUDEOIL26NOVFUT', 'MCX', 'FUT')
  addSymbol('fy1', 'GONE26JANFUT', 'NSE:GONE26JANFUT', 'NFO', 'FUT') // not in the list (expired)
  addSymbol('kite1', 'TATAELXSI26NOVFUT', 'NFO:TATAELXSI26NOVFUT', 'NFO', 'FUT')
  addSymbol('kite1', 'TATAELXSI', 'NSE:TATAELXSI')
  sd = await import('../src/amibroker/symbolDetails')
})
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })

describe('symbol details from the broker lists', () => {
  it('reads lot size, tick size, name and expiry for every broker, also when it is not logged in', async () => {
    const rows = new Map((await sd.collectSymbolDetails()).map(r => [r.ticker, r.details]))
    expect(rows.get('RELIANCE26OCTFUT')).toEqual({ name: 'RELIANCE 27 Oct 26 FUT', lotSize: 500, tickSize: 0.1, expiry: '2026-10-27' })
    expect(rows.get('RELIANCE')).toEqual({ name: 'RELIANCE INDUSTRIES LTD', lotSize: 1, tickSize: 0.1, expiry: '' })
    expect(rows.get('NIFTY')?.lotSize).toBe(1) // indices say 0
    expect(rows.get('TATAELXSI26NOVFUT')).toEqual({ name: 'TATAELXSI', lotSize: 100, tickSize: 0.5, expiry: '2026-11-24' })
    expect(rows.get('TATAELXSI')?.lotSize).toBe(1)
  })

  it('gives MCX contracts counted as lot 1 what one lot earns per rupee of move', async () => {
    const crude = (await sd.collectSymbolDetails()).find(r => r.ticker === 'CRUDEOIL26NOVFUT')
    expect(crude?.details).toMatchObject({ lotSize: 1, tickSize: 1, pointValue: 100 })
  })

  it('keeps symbols the list does not have, so they are still added to AmiBroker', async () => {
    const gone = (await sd.collectSymbolDetails()).find(r => r.ticker === 'GONE26JANFUT')
    expect(gone).toEqual({ ticker: 'GONE26JANFUT' })
  })
})

describe('what AmiBroker is sent', () => {
  it('one line per symbol: ticker, name, lot, tick, point value; empty means leave as is', () => {
    const text = sd.symbolDetailsLines([
      { ticker: 'RELIANCE26OCTFUT', details: { name: 'RELIANCE 27 Oct 26 FUT', lotSize: 500, tickSize: 0.1, expiry: '2026-10-27' } },
      { ticker: 'CRUDEOIL26NOVFUT', details: { name: 'CRUDEOIL 19 Nov 26 FUT', lotSize: 1, tickSize: 1, expiry: '2026-11-19', pointValue: 100 } },
      { ticker: 'GONE26JANFUT' },
      { ticker: 'M&M', details: { name: 'MAHINDRA\t& MAHINDRA\nLTD', lotSize: 1, tickSize: 0.05, expiry: '' } },
    ])
    expect(text.split('\n')).toEqual([
      'RELIANCE26OCTFUT\tRELIANCE 27 Oct 26 FUT\t500\t0.1\t',
      'CRUDEOIL26NOVFUT\tCRUDEOIL 19 Nov 26 FUT\t1\t1\t100',
      'GONE26JANFUT\t\t\t\t',
      'M&M\tMAHINDRA & MAHINDRA LTD\t1\t0.05\t',
    ])
  })

  it('adds the expiry to a name that does not carry it', () => {
    expect(sd.fullNameOf({ name: 'TATAELXSI', lotSize: 100, tickSize: 0.5, expiry: '2026-11-24' })).toBe('TATAELXSI (expiry 24 Nov 2026)')
    expect(sd.fullNameOf({ name: 'RELIANCE 27 Oct 26 FUT', lotSize: 500, tickSize: 0.1, expiry: '2026-10-27' })).toBe('RELIANCE 27 Oct 26 FUT')
    expect(sd.fullNameOf({ name: 'TATA ELXSI', lotSize: 1, tickSize: 0.5, expiry: '' })).toBe('TATA ELXSI')
  })

  it('is sent again each day once the new lists are out (08:45 IST)', () => {
    const ist = (d: string, hhmm: string) => Date.parse(`${d}T${hhmm}:00+05:30`)
    expect(sd.dailyPushDue(ist('2026-10-27', '15:00'), ist('2026-10-28', '08:30'))).toBe(false)
    expect(sd.dailyPushDue(ist('2026-10-27', '15:00'), ist('2026-10-28', '09:00'))).toBe(true)
    expect(sd.dailyPushDue(ist('2026-10-28', '08:50'), ist('2026-10-28', '14:00'))).toBe(false)
  })

  it('does nothing while AmiBroker is not connected (COM would start a hidden one)', async () => {
    sd.startSymbolDetailsSync(() => false)
    await sd.pushSymbolDetails()
    expect(fs.existsSync(path.join(db.DATA_DIR, 'amibroker', 'symbol-details.tsv'))).toBe(false)
  })
})
