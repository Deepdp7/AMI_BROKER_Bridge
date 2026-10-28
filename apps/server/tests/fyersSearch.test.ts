/**
 * Fyers symbol search with the app's filter chips (EQ (NSE), FUTSTK (NFO), OPTIDX (NFO), FUTCOM
 * (MCX)…). The chips name instrument categories; Fyers lists carry their own type codes. Rows
 * below are real lines from the public Fyers lists. Runs in a temp home folder.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-fyerssearch-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'fs.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const NSE_CM = [
  '10100000002885,RELIANCE INDUSTRIES LTD,0,1,0.1,INE002A01018,0915-1530|1815-1915:,2026-10-26,,NSE:RELIANCE-EQ,10,10,2885,RELIANCE,2885,-1.0,XX,10100000002885,None,1,3.7',
  '101000000026000,NIFTY50-INDEX,10,0,0.05,,0915-1530|1815-1915:,2026-10-26,,NSE:NIFTY50-INDEX,10,10,26000,NIFTY,26000,-1.0,XX,101000000026000,None,0,0.0',
]
const NSE_FO = [
  '101126102748704,NIFTY 27 Oct 26 FUT,11,65,0.1,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:NIFTY26OCTFUT,10,11,48704,NIFTY,26000,-1.0,XX,101000000026000,None,0,0.0',
  '101126102748987,RELIANCE 27 Oct 26 FUT,13,500,0.1,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:RELIANCE26OCTFUT,10,11,48987,RELIANCE,2885,-1.0,XX,10100000002885,None,0,0.0',
  '101126102735040,NIFTY 27 Oct 26 17350 CE,14,65,0.05,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:NIFTY26OCT17350CE,10,11,35040,NIFTY,26000,17350.0,CE,101000000026000,None,0,0.0',
  '1011261027106474,RELIANCE 27 Oct 26 720 CE,15,500,0.05,,0915-1540|1815-1915:,2026-10-26,1793095800,NSE:RELIANCE26OCT720CE,10,11,106474,RELIANCE,2885,720.0,CE,10100000002885,None,0,0.0',
]
const MCX_COM = [
  '1120261119573422,CRUDEOIL 19 Nov 26 FUT,30,1,1.0,,0900-2330|1815-1915:,2026-10-27,1795111200,MCX:CRUDEOIL26NOVFUT,11,20,573422,CRUDEOIL,294,-1.0,XX,1120000000294,1795111200,0,0.0',
  '1120261117582829,CRUDEOIL 17 Nov 26 7900 CE,31,1,0.1,,0900-2330|1815-1915:,2026-10-27,1794938400,MCX:CRUDEOIL26NOV7900CE,11,20,582829,CRUDEOIL,573422,7900.0,CE,1120000000573422,1794938400,0,0.0',
  '1120261028580246,MCXBULLDEX 28 Oct 26 FUT,11,1,1.0,,0900-2330|1815-1915:,2026-10-27,1793210400,MCX:MCXBULLDEX26OCTFUT,11,20,580246,MCXBULLDEX,568,-1.0,XX,1120000000568,1793210400,0,0.0',
]

let adapter: any
let fyersCategory: (ex: string, code: number, id: string) => string

beforeAll(async () => {
  const db = await import('../src/db')
  await db.syncCachesPromise
  const dir = path.join(db.DATA_DIR, 'fyers_master')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'NSE_CM.csv'), NSE_CM.join('\n'))
  fs.writeFileSync(path.join(dir, 'NSE_FO.csv'), NSE_FO.join('\n'))
  fs.writeFileSync(path.join(dir, 'MCX_COM.csv'), MCX_COM.join('\n'))
  fs.writeFileSync(path.join(dir, 'BSE_CM.csv'), '')
  const mod = await import('../src/brokers/adapters/fyers/FyersAdapter')
  adapter = new mod.FyersAdapter()
  fyersCategory = mod.fyersCategory
})
afterAll(() => { try { fs.rmSync(tmpHome, { recursive: true, force: true }) } catch { /* open on Windows */ } })

const ids = async (q: string, filter: string) => (await adapter.searchSymbols(q, filter)).map((r: any) => r.instrumentId).sort()

describe('Fyers symbol search filters', () => {
  it('EQ (NSE) finds stocks and indices, not futures or options', async () => {
    expect(await ids('RELIANCE', 'NSE-10')).toEqual(['NSE:RELIANCE-EQ'])
    expect(await ids('NIFTY', 'NSE-10')).toEqual(['NSE:NIFTY50-INDEX'])
  })

  it.each([
    ['NFO-11', 'FUTIDX', 'NIFTY', ['NSE:NIFTY26OCTFUT']],
    ['NFO-12', 'FUTSTK', 'RELIANCE', ['NSE:RELIANCE26OCTFUT']],
    ['NFO-13', 'OPTIDX', 'NIFTY', ['NSE:NIFTY26OCT17350CE']],
    ['NFO-14', 'OPTSTK', 'RELIANCE', ['NSE:RELIANCE26OCT720CE']],
    ['MCX-11', 'FUTCOM', 'CRUDEOIL', ['MCX:CRUDEOIL26NOVFUT']],
    ['MCX-12', 'OPTFUT', 'CRUDEOIL', ['MCX:CRUDEOIL26NOV7900CE']],
    ['MCX-13', 'FUTIDX (MCX)', 'BULLDEX', ['MCX:MCXBULLDEX26OCTFUT']],
  ])('%s (%s) finds only that kind', async (filter, _label, q, expected) => {
    expect(await ids(q, filter)).toEqual(expected)
  })

  it('ALL finds every kind, typed for the app (index, future, option)', async () => {
    const all = await adapter.searchSymbols('NIFTY', 'ALL')
    const types = Object.fromEntries(all.map((r: any) => [r.instrumentId, r.instrumentType]))
    expect(types).toMatchObject({ 'NSE:NIFTY50-INDEX': 'INDEX', 'NSE:NIFTY26OCTFUT': 'FUT', 'NSE:NIFTY26OCT17350CE': 'OPT' })
    const mcx = await adapter.searchSymbols('CRUDEOIL', 'ALL')
    expect(mcx.map((r: any) => r.instrumentType).sort()).toEqual(['FUT', 'OPT'])
  })

  it('a type code Fyers adds later still lands in a sensible category', () => {
    expect(fyersCategory('NFO', 99, 'NSE:XYZ26OCT100PE')).toBe('OPTSTK')
    expect(fyersCategory('MCX', 99, 'MCX:GOLD26DECFUT')).toBe('FUTCOM')
    expect(fyersCategory('NSE', 99, 'NSE:FINNIFTY-INDEX')).toBe('INDEX')
  })

  it('an added NSE option gets its live-price token (options are looked up when subscribed)', async () => {
    const tokens = await adapter.getHsmTokens(['NSE:NIFTY26OCT17350CE', 'NSE:RELIANCE-EQ', 'NSE:RELIANCE26OCT720CE', 'MCX:CRUDEOIL26NOV7900CE'])
    expect(tokens).toEqual(['sf|nse_fo|35040', 'sf|nse_cm|2885', 'sf|nse_fo|106474', 'sf|mcx_fo|582829'])
    // the underlying's name is not taken over by an option
    expect(adapter.masterCache.get('NIFTY')?.id).not.toBe('NSE:NIFTY26OCT17350CE')
  })
})
