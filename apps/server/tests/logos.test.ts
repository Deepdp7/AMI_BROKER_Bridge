/**
 * Company logos: which company a ticker belongs to, the ISIN lookup from NSE's list, and the
 * route that serves (and saves) the picture.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-logos-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'logos.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

const NSE_LIST = [
  'SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE',
  'TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1',
  'BAJAJ-AUTO,Bajaj Auto Limited,EQ,01-JAN-2000,10,1,INE917I01010,10',
  'M&M,Mahindra & Mahindra Limited,EQ,01-JAN-1990,5,1,INE101A01026,5',
  'GOLDSTAR,Goldstar Power Limited,ST,01-JAN-2024,10,1,INE0AAA01011,10',
  'ITC,ITC Limited,EQ,01-JAN-1990,1,1,INE154A01025,1',
  'INFY,Infosys Limited,EQ,01-JAN-1990,5,1,INE009A01021,5',
].join('\r\n')

describe('which company a ticker belongs to', () => {
  it('uses the underlying of a future or an option, and leaves a share as it is', async () => {
    const { underlyingOf } = await import('../src/lib/logos')
    expect(underlyingOf('RELIANCE26NOVFUT')).toBe('RELIANCE')
    expect(underlyingOf('TCS26OCT4000CE')).toBe('TCS')
    expect(underlyingOf('TCS26N0944000.5PE')).toBe('TCS')   // weekly option
    expect(underlyingOf('M&M26NOVFUT')).toBe('M&M')
    expect(underlyingOf('TATAELXSI-FUT')).toBe('TATAELXSI')
    expect(underlyingOf('tcs')).toBe('TCS')
    expect(underlyingOf('BAJAJ-AUTO')).toBe('BAJAJ-AUTO')
  })

  it('finds the ISIN in NSE\'s list; a name with a hyphen is tried whole first, a series suffix after', async () => {
    const { parseEquityList, isinFor } = await import('../src/lib/logos')
    const list = parseEquityList(NSE_LIST)
    expect(list.isin.size).toBe(6)
    expect(isinFor('TCS', list)).toBe('INE467B01029')
    expect(isinFor('TCS26NOVFUT', list)).toBe('INE467B01029')
    expect(isinFor('BAJAJ-AUTO', list)).toBe('INE917I01010')
    expect(isinFor('M&M', list)).toBe('INE101A01026')
    expect(isinFor('GOLDSTAR-ST', list)).toBe('INE0AAA01011')
    expect(isinFor('NIFTY26NOVFUT', list)).toBeNull()   // an index has no company
    expect(isinFor('CRUDEOIL', list)).toBeNull()
    expect(parseEquityList('').isin.size).toBe(0)
  })
})

describe('the name TradingView knows a company by', () => {
  it('drops "Limited", apostrophes and punctuation', async () => {
    const { slugOf } = await import('../src/lib/logos')
    expect(slugOf('Kotak Mahindra Bank Limited')).toBe('kotak-mahindra-bank')
    expect(slugOf("Dr. Reddy's Laboratories Limited")).toBe('dr-reddys-laboratories')
    expect(slugOf('Mahindra & Mahindra Limited')).toBe('mahindra-and-mahindra')
    expect(slugOf('Southern Petrochemicals Industries Corporation  Limited')).toBe('southern-petrochemicals-industries-corporation')
  })
})

describe('where a logo is looked for', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('Dhan first by plain NSE symbol (no ISIN, no NSE list needed), then Groww, then TradingView; indices use their NSE name', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 7)])
    const asked: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url)
      asked.push(u)
      if (u.endsWith('EQUITY_L.csv')) throw new TypeError('NSE is down')   // the list is not needed for Dhan's
      if (u.includes('images.dhan.co/symbol/')) {
        const name = decodeURIComponent(u.split('/symbol/')[1].replace('.png', ''))
        return ['FCSSOFT', 'L&TFH', 'BANKNIFTY'].includes(name) ? new Response(png, { headers: { 'content-type': 'image/png' } }) : new Response('<Error/>', { status: 403, headers: { 'content-type': 'application/xml' } })
      }
      return new Response('', { status: 404 })
    }))
    const { app } = await import('../src/app')
    expect((await request(app).get('/api/symbols/logo/FCSSOFT')).status).toBe(200)
    expect((await request(app).get('/api/symbols/logo/FCSSOFT26NOVFUT')).status).toBe(200)   // the underlying's
    expect((await request(app).get('/api/symbols/logo/L%26TFH')).status).toBe(200)
    expect((await request(app).get('/api/symbols/logo/NIFTYBANK')).status).toBe(200)         // DataBridge's name → BANKNIFTY
    expect(asked.some(u => u.endsWith('/symbol/BANKNIFTY.png'))).toBe(true)
    expect(asked.some(u => u.includes('groww'))).toBe(false)
    // Asked once each: the second FCSSOFT came from the disk
    expect(asked.filter(u => u.endsWith('/symbol/FCSSOFT.png')).length).toBe(1)
  })
})

describe('a logo that can\'t be told yet is "try again" (503), not "none" (404)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('503 while NSE\'s list or the logo servers can\'t be reached; the same symbol works once they can', async () => {
    let online = false
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 7)])
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      if (!online) throw new TypeError('fetch failed')
      const u = String(url)
      if (u.endsWith('EQUITY_L.csv')) return new Response(NSE_LIST + '\r\n' + Array.from({ length: 120 }, (_, i) => `Z${i},Z,EQ,x,1,1,INE${String(i).padStart(7, '0')}01,1`).join('\r\n'))
      return u.endsWith('INE154A01025.png') ? new Response(png, { headers: { 'content-type': 'image/png' } }) : new Response('', { status: 404 })
    }))
    const { app } = await import('../src/app')

    // The engine has just started and NSE's list could not be fetched
    expect((await request(app).get('/api/symbols/logo/ITC')).status).toBe(503)
    // Same for a company whose logo server could not be reached
    online = true
    expect((await request(app).get('/api/symbols/logo/ITC')).status).toBe(200)
    // A company with no logo anywhere is still final
    expect((await request(app).get('/api/symbols/logo/GOLDSTAR-ST')).status).toBe(404)
  })

  it('503 when the list is there but the logo servers are down; nothing is remembered as "none"', async () => {
    let up = false
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 7)])
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url)
      if (u.endsWith('EQUITY_L.csv')) return new Response(NSE_LIST + '\r\n' + Array.from({ length: 120 }, (_, i) => `Z${i},Z,EQ,x,1,1,INE${String(i).padStart(7, '0')}01,1`).join('\r\n'))
      if (!up) throw new TypeError('fetch failed')
      return u.endsWith('INE009A01021.png') ? new Response(png, { headers: { 'content-type': 'image/png' } }) : new Response('', { status: 404 })
    }))
    const { app } = await import('../src/app')
    expect((await request(app).get('/api/symbols/logo/INFY')).status).toBe(503)
    up = true
    expect((await request(app).get('/api/symbols/logo/INFY')).status).toBe(200)
  })
})

describe('Chartink import takes only real NSE names', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('leaves out words of pasted text, keeps listed stocks and indices', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: any) => String(url).endsWith('EQUITY_L.csv')
      ? new Response(NSE_LIST + '\r\n' + Array.from({ length: 120 }, (_, i) => `Z${i},Z,EQ,x,1,1,INE${String(i).padStart(7, '0')}01,1`).join('\r\n'))
      : new Response('', { status: 404 })))
    const { app } = await import('../src/app')
    const none = await request(app).post('/api/platforms/chartink/import').send({ brokerId: 'x', text: 'Ticker made indices exchange type' })
    expect(none.status).toBe(400)
    expect(none.body.error).toMatch(/None of these is an NSE symbol: TICKER, MADE, INDICES, EXCHANGE, TYPE/)
    // Real names get past the check (and then need a broker account)
    const some = await request(app).post('/api/platforms/chartink/import').send({ brokerId: 'x', text: 'TCS, ticker, NIFTY' })
    expect(some.body.error).toMatch(/Choose the broker account/)
  })
})

describe('GET /api/symbols/logo/:ticker', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('fetches a logo once, saves it, and answers 404 for what has none', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 7)])
    const fetched: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url)
      fetched.push(u)
      if (u.endsWith('EQUITY_L.csv')) return new Response(NSE_LIST + '\r\n' + Array.from({ length: 120 }, (_, i) => `Z${i},Z,EQ,x,1,1,INE${String(i).padStart(7, '0')}01,1`).join('\r\n'))
      if (u.endsWith('bajaj-auto--big.svg')) return new Response('<svg>' + 'x'.repeat(200) + '</svg>', { headers: { 'content-type': 'image/svg+xml' } })
      if (u.endsWith('INE467B01029.png')) return new Response(png, { headers: { 'content-type': 'image/png' } })
      return new Response('', { status: 404 })
    }))
    const { app } = await import('../src/app')

    const a = await request(app).get('/api/symbols/logo/TCS')
    expect(a.status).toBe(200)
    expect(a.headers['content-type']).toBe('image/png')
    expect(Buffer.from(a.body).equals(png)).toBe(true)

    // The second time it comes from the disk
    const before = fetched.filter(u => u.endsWith('.png')).length
    const b = await request(app).get('/api/symbols/logo/TCS26NOVFUT')
    expect(b.status).toBe(200)
    expect(fetched.filter(u => u.endsWith('.png')).length).toBe(before)

    expect((await request(app).get('/api/symbols/logo/NIFTY26NOVFUT')).status).toBe(404)
    // Groww has none, TradingView has: its SVG
    const svg = await request(app).get('/api/symbols/logo/BAJAJ-AUTO')
    expect(svg.status).toBe(200)
    expect(svg.headers['content-type']).toContain('image/svg+xml')

    // Neither has a picture: 404, remembered, not asked again
    expect((await request(app).get('/api/symbols/logo/M%26M')).status).toBe(404)
    const asked = fetched.filter(u => u.includes('INE101A01026')).length
    expect((await request(app).get('/api/symbols/logo/M%26M')).status).toBe(404)
    expect(fetched.filter(u => u.includes('INE101A01026')).length).toBe(asked)
  })
})
