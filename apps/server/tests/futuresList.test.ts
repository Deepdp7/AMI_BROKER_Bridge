/**
 * Every NFO stock / index future a broker lists, for "add a whole month" in Symbol Setup.
 * Fyers rows are real lines from its public NSE_FO list. Runs in a temp home folder.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-futlist-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'fl.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const NSE_FO = [
  '101126102748704,NIFTY 27 Oct 26 FUT,11,65,0.1,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:NIFTY26OCTFUT,10,11,48704,NIFTY,26000,-1.0,XX,101000000026000,None,0,0.0',
  '101126102748987,RELIANCE 27 Oct 26 FUT,13,500,0.1,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:RELIANCE26OCTFUT,10,11,48987,RELIANCE,2885,-1.0,XX,10100000002885,None,0,0.0',
  '101126112361697,RELIANCE 23 Nov 26 FUT,13,500,0.1,,0915-1540|1815-1915:,2026-10-26,1795428600,NSE:RELIANCE26NOVFUT,10,11,61697,RELIANCE,2885,-1.0,XX,10100000002885,None,0,0.0',
  '101126102735040,NIFTY 27 Oct 26 17350 CE,14,65,0.05,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:NIFTY26OCT17350CE,10,11,35040,NIFTY,26000,17350.0,CE,101000000026000,None,0,0.0',
  '1011261027106474,RELIANCE 27 Oct 26 720 CE,15,500,0.05,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:RELIANCE26OCT720CE,10,11,106474,RELIANCE,2885,720.0,CE,10100000002885,None,0,0.0',
]

beforeAll(async () => {
  const db = await import('../src/db')
  await db.syncCachesPromise
  const dir = path.join(db.DATA_DIR, 'fyers_master')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of ['NSE_CM.csv', 'MCX_COM.csv', 'BSE_CM.csv']) fs.writeFileSync(path.join(dir, f), 'x'.repeat(2000))
  fs.writeFileSync(path.join(dir, 'NSE_FO.csv'), NSE_FO.join('\n'))
})
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })

describe('futures lists', () => {
  it('Fyers: stock futures and index futures, no options', async () => {
    const { FyersAdapter } = await import('../src/brokers/adapters/fyers/FyersAdapter')
    const fyers = new FyersAdapter()
    const stock = await fyers.listFutures('stock')
    expect(stock.map(f => [f.ticker, f.instrumentId, f.expiry, f.lotSize])).toEqual([
      ['RELIANCE26OCTFUT', 'NSE:RELIANCE26OCTFUT', '2026-10-27', 500],
      ['RELIANCE26NOVFUT', 'NSE:RELIANCE26NOVFUT', '2026-11-23', 500],
    ])
    expect((await fyers.listFutures('index')).map(f => f.ticker)).toEqual(['NIFTY26OCTFUT'])
  })

  it('a listed broker (Kite): NFO only, from its instrument list', async () => {
    const { kiteMaster, KiteAdapter } = await import('../src/brokers/adapters/kite/KiteAdapter')
    kiteMaster.setRecords([
      { key: 'NFO:TCS26NOVFUT', ticker: 'TCS26NOVFUT', name: 'TCS', exchange: 'NFO', cat: 'FUTSTK', lot: 175, tick: 0.1, expiry: '2026-11-24', ref: '1' },
      { key: 'NFO:NIFTY26NOVFUT', ticker: 'NIFTY26NOVFUT', name: 'NIFTY', exchange: 'NFO', cat: 'FUTIDX', lot: 65, tick: 0.1, expiry: '2026-11-24', ref: '2' },
      { key: 'BFO:SENSEX26NOVFUT', ticker: 'SENSEX26NOVFUT', name: 'SENSEX', exchange: 'BFO', cat: 'FUTIDX', lot: 20, tick: 0.1, expiry: '2026-11-26', ref: '3' },
      { key: 'NSE:TCS', ticker: 'TCS', name: 'TCS', exchange: 'NSE', cat: 'EQ', lot: 1, tick: 0.1, expiry: '', ref: '4' },
    ])
    const kite = new KiteAdapter()
    expect((await kite.listFutures('stock')).map(f => [f.ticker, f.lotSize, f.expiry])).toEqual([['TCS26NOVFUT', 175, '2026-11-24']])
    expect((await kite.listFutures('index')).map(f => f.ticker)).toEqual(['NIFTY26NOVFUT'])
  })
})
