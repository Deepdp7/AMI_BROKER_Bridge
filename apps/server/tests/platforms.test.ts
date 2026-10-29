/**
 * Charting platforms: finding them on a PC, the quote lines Excel reads, the live sheet, and the
 * files for TradingView, Chartink, NinjaTrader, MetaTrader 5 and plain CSV.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dbp-platforms-'))
process.env.USERPROFILE = tmpHome
process.env.HOME = tmpHome
process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming')
process.env.DATABRIDGE_DB_PATH = path.join(tmpHome, 'platforms.db')
process.env.DATABRIDGE_NO_PG_IMPORT = '1'

/** A made-up PC: these paths exist, these programs are installed */
function fakePc(files: string[], programs: Array<Record<string, string>>, texts: Record<string, string> = {}, registry: Record<string, Record<string, string>> = {}) {
  const set = new Set(files.map(f => f.toLowerCase()))
  const dirs = new Set<string>()
  const all: string[] = [...files]   // every path with its own letter case
  for (const f of files) for (let d = path.dirname(f); d.length > 3; d = path.dirname(d)) { dirs.add(d.toLowerCase()); all.push(d) }
  return {
    env: { APPDATA: 'C:\\Users\\T\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\T\\AppData\\Local', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramW6432: 'C:\\Program Files' },
    exists: (p: string) => set.has(p.toLowerCase()) || dirs.has(p.toLowerCase()),
    readDir: (p: string) => [...new Set(all.filter(f => path.dirname(f).toLowerCase() === p.toLowerCase()).map(f => path.basename(f)))],
    readText: (p: string) => texts[p.toLowerCase()] ?? null,
    programs: async () => programs.map((p, i) => ({ key: `k${i}`, ...p })),
    registry: async (key: string) => new Map(registry[key] ? [[key, registry[key]]] : []),
  }
}

describe('finding platforms on the PC', () => {
  it('finds AmiBroker with its plugin, Excel and its bitness, and a MetaTrader 5 terminal by its data folder', async () => {
    const { detectPlatforms } = await import('../src/platforms/registry')
    const mt5Data = 'C:\\Users\\T\\AppData\\Roaming\\MetaQuotes\\Terminal\\D0E8209F77C8CF37AD8BF550E51FF075'
    const pc = fakePc([
      'C:\\Program Files (x86)\\AmiBroker\\Broker.exe',
      'C:\\Program Files (x86)\\AmiBroker\\Plugins\\DataBridgePro.dll',
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
      'C:\\Program Files\\Zerodha MT5\\terminal64.exe',
      `${mt5Data}\\origin.txt`, `${mt5Data}\\MQL5\\Services\\DataBridge.ex5`,
      'C:\\Users\\T\\AppData\\Roaming\\MetaQuotes\\Terminal\\AAAA\\origin.txt', 'C:\\Users\\T\\AppData\\Roaming\\MetaQuotes\\Terminal\\AAAA\\MQL4\\x',
    ], [
      { DisplayName: 'AmiBroker 6.20.1', InstallLocation: 'C:\\Program Files (x86)\\AmiBroker\\' },
      { DisplayName: 'Some other program' },
    ], {
      [`${mt5Data}\\origin.txt`.toLowerCase()]: 'C:\\Program Files\\Zerodha MT5',
      'c:\\users\\t\\appdata\\roaming\\metaquotes\\terminal\\aaaa\\origin.txt': 'C:\\Program Files\\MT4',
    }, {
      'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\excel.exe': { '(Default)': 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE' },
      'HKLM\\Software\\Microsoft\\Office\\ClickToRun\\Configuration': { Platform: 'x64' },
    })
    const all = await detectPlatforms(pc as any)
    const by = Object.fromEntries(all.map(p => [p.id, p]))
    expect(by.amibroker.installed).toBe(true)
    expect(by.amibroker.instances).toEqual([{ folder: 'C:\\Program Files (x86)\\AmiBroker', exe: 'C:\\Program Files (x86)\\AmiBroker\\Broker.exe', connectorFolder: 'C:\\Program Files (x86)\\AmiBroker\\Plugins', connectorInstalled: true }])
    expect(by.excel).toMatchObject({ installed: true, note: '64-bit' })
    expect(by.excel.instances[0]).toMatchObject({ connectorInstalled: false })
    expect(by.metatrader5.instances).toHaveLength(1)   // the MetaTrader 4 terminal is left out
    expect(by.metatrader5.instances[0]).toMatchObject({ folder: 'C:\\Program Files\\Zerodha MT5', connectorFolder: `${mt5Data}\\MQL5`, connectorInstalled: true })
    expect(by.ninjatrader8.installed).toBe(false)
    expect(by.sierrachart.level).toBe('soon')
    // Web platforms and plain files are always there
    expect(by.tradingview.installed && by.chartink.installed && by.csv.installed).toBe(true)
  })

  it('reads reg.exe output, and the exe out of an uninstall entry\'s icon', async () => {
    const { parseRegQuery, exeFromIcon, expandEnv } = await import('../src/platforms/windows')
    const tree = parseRegQuery([
      'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AmiBroker',
      '    DisplayName    REG_SZ    AmiBroker 6.20.1',
      '    InstallLocation    REG_SZ    C:\\Program Files (x86)\\AmiBroker\\',
      '    (Default)    REG_SZ    ',
      '',
    ].join('\r\n'))
    expect([...tree.values()][0]).toMatchObject({ DisplayName: 'AmiBroker 6.20.1', InstallLocation: 'C:\\Program Files (x86)\\AmiBroker\\' })
    expect(exeFromIcon('"C:\\Program Files (x86)\\AmiBroker\\Broker.exe",0')).toBe('C:\\Program Files (x86)\\AmiBroker\\Broker.exe')
    expect(exeFromIcon('C:\\x\\setup.ico')).toBeUndefined()
    expect(expandEnv('%USERPROFILE%\\Documents', { USERPROFILE: 'C:\\Users\\T' })).toBe('C:\\Users\\T\\Documents')
  })
})

describe('quotes for Excel', () => {
  it('keeps the day\'s open, high and low from the 1-minute bars, and starts over on a new day', async () => {
    const { foldBar, quoteLine, istMidnight } = await import('../src/platforms/quotes')
    const at = (iso: string) => Date.parse(iso)
    let d = foldBar(undefined, { bucketMs: at('2026-10-28T09:15:00+05:30'), open: 100, high: 101, low: 99, close: 100 } as any)
    d = foldBar(d, { bucketMs: at('2026-10-28T09:16:00+05:30'), open: 100.5, high: 103, low: 100, close: 102 } as any)
    expect(d).toMatchObject({ open: 100, high: 103, low: 99 })
    const next = foldBar(d, { bucketMs: at('2026-10-29T09:15:00+05:30'), open: 105, high: 106, low: 104, close: 105 } as any)
    expect(next).toMatchObject({ open: 105, high: 106, low: 104, day: istMidnight(at('2026-10-29T12:00:00+05:30')) })

    const line = quoteLine({ ticker: 'RELIANCE26NOVFUT', lastPrice: 1315.8, prevClose: 1305, change: 10.8, changePercent: 0.83, volume: 81234, openInterest: 1234500, lastTickUtcMs: 1, status: 'RECEIVING' } as any, d, 500, at('2026-10-28T10:00:00+05:30'))
    expect(line).toBe('RELIANCE26NOVFUT|1315.8|100|103|99|1305|10.8|0.83|81234|1234500|0|0|1|500|RECEIVING')
    // Yesterday's day stats are not shown as today's
    expect(quoteLine({ ticker: 'X', lastPrice: 1 } as any, d, undefined, at('2026-10-29T10:00:00+05:30')).split('|').slice(2, 5)).toEqual(['0', '0', '0'])
  })
})

/** Files inside a stored (uncompressed) zip */
function unzipAll(buf: Buffer): Record<string, string> {
  const out: Record<string, string> = {}
  let i = 0
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18), nameLen = buf.readUInt16LE(i + 26), extra = buf.readUInt16LE(i + 28)
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen)
    const data = buf.subarray(i + 30 + nameLen + extra, i + 30 + nameLen + extra + size)
    expect(zlib.crc32(data)).toBe(buf.readUInt32LE(i + 14))
    out[name] = data.toString('utf8')
    i += 30 + nameLen + extra + size
  }
  return out
}

describe('the live sheet', () => {
  it('has a row per symbol, every value an RTD formula, and the value of one lot', async () => {
    const { liveSheetRows } = await import('../src/platforms/excel')
    const rows = liveSheetRows(['RELIANCE26NOVFUT', 'NIFTY50'])
    expect(rows[0].slice(0, 4)).toEqual(['Symbol', 'Last', 'Change', 'Change %'])
    expect(rows[1][0]).toBe('RELIANCE26NOVFUT')
    expect(rows[1][1]).toEqual({ f: 'RTD("DataBridge.RTD",,$A2,"LTP")' })
    expect(rows[2][10]).toEqual({ f: 'RTD("DataBridge.RTD",,$A3,"LOT")' })
    expect(rows[1][11]).toEqual({ f: 'IF(AND(ISNUMBER(B2),ISNUMBER(K2)),B2*K2,"")' })
  })

  it('is a valid .xlsx: the parts Excel needs, formulas and text escaped, header frozen, gains green', async () => {
    const { buildXlsx, columnName } = await import('../src/lib/xlsx')
    expect([columnName(0), columnName(25), columnName(26), columnName(27)]).toEqual(['A', 'Z', 'AA', 'AB'])
    const files = unzipAll(buildXlsx({ name: 'Live prices', rows: [['Symbol', 'Last'], ['M&M', { f: 'RTD("DataBridge.RTD",,$A2,"LTP")' }]], signColumns: [1], freezeRows: 1, widths: [20, 10], columnStyles: ['text', 'num'] }))
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
    const sheet = files['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('<t xml:space="preserve">M&amp;M</t>')
    expect(sheet).toContain('<c r="B2" s="2"><f>RTD(&quot;DataBridge.RTD&quot;,,$A2,&quot;LTP&quot;)</f></c>')
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<formula>AND(ISNUMBER(B2),B2&gt;0)</formula>')
  })

  it('the workbook also has a History sheet: symbol and timeframe drop-downs, 100 live BAR rows and a chart', async () => {
    const { liveWorkbook, historySheetRows } = await import('../src/platforms/excel')
    const rows = historySheetRows('TCS')
    expect(rows[0][1]).toBe('TCS')
    expect(rows[1][1]).toBe('5m')
    expect(rows[4]).toEqual(['Bar', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume', 'Change %'])
    expect(rows[5][0]).toBe(1)
    expect(rows[5][1]).toEqual({ f: 'RTD("DataBridge.RTD",,$B$1,"BAR",$B$2,$A6,"TIME")' })
    expect(rows[5][5]).toEqual({ f: 'RTD("DataBridge.RTD",,$B$1,"BAR",$B$2,$A6,"CLOSE")' })
    expect(rows[5][7]).toEqual({ f: 'IF(AND(ISNUMBER(F6),ISNUMBER(F7),F7<>0),(F6/F7-1)*100,"")' })
    expect(rows.length).toBe(105)

    const files = unzipAll(liveWorkbook(['M&M', 'TCS']))
    expect(files['xl/workbook.xml']).toContain('<sheet name="Live prices" sheetId="1" r:id="rId1"/><sheet name="History" sheetId="2" r:id="rId2"/>')
    expect(files['xl/_rels/workbook.xml.rels']).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"')
    const history = files['xl/worksheets/sheet2.xml']
    expect(history).toContain(`<formula1>'Live prices'!$A$2:$A$3</formula1>`)
    expect(history).toContain('<formula1>&quot;1m,5m,15m,30m,1h,1d&quot;</formula1>')
    expect(history).toContain('<c r="A5" s="1"')   // header row 5
    expect(history).toContain('<drawing r:id="rId1"/>')
    expect(files['xl/charts/chart1.xml']).toContain('<c:f>History!$F$6:$F$105</c:f>')
    expect(files['[Content_Types].xml']).toContain('/xl/charts/chart1.xml')
  })
})

describe('bars for other platforms', () => {
  it('reads a timeframe the way people write it', async () => {
    const { timeframeOf } = await import('../src/platforms/bars')
    expect(['1', '5', '5M', '5min', '15', '30m', '60', '1H', 'H', 'D', 'day', '1d'].map(timeframeOf))
      .toEqual(['1m', '5m', '5m', '5m', '15m', '30m', '1h', '1h', '1h', '1d', '1d', '1d'])
    expect(timeframeOf('7m')).toBeNull()
    expect(timeframeOf('')).toBeNull()
  })

  it('GET /api/platforms/bars: 404 for an untracked symbol, 400 for an unknown timeframe', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../src/app')
    expect((await request(app).get('/api/platforms/bars?ticker=NOPE&tf=5m')).status).toBe(404)
    const bad = await request(app).get('/api/platforms/bars?ticker=TCS&tf=7m')
    expect(bad.status).toBe(400)
    expect(bad.text).toBe('Timeframe: 1m, 5m, 15m, 30m, 1h or 1d')
  })

  it('kept-up-to-date CSV files: the whole history first, then only the minutes after the last line', async () => {
    const db = await import('../src/db')
    await db.syncCachesPromise
    const { updateCsvFiles } = await import('../src/platforms/liveCsv')
    db.stmts.insertSymbol.run({ broker_id: 'b-csv', instrument_id: 'NSE:CSVT-EQ', amibroker_ticker: 'CSVT', exchange: 'NSE', instrument_type: 'EQ', raw_symbol: 'NSE:CSVT-EQ', created_at: Date.now() })
    const t0 = 1793072700_000   // 27 Oct 2026 09:15 IST
    const bar = (ms: number, close: number) => ({ ts: ms, open: close, high: close + 1, low: close - 1, close, volume: 10 })
    await db.upsertBarsToHistory('CSVT', [bar(t0, 100), bar(t0 + 60_000, 101)])
    const folder = fs.mkdtempSync(path.join(tmpHome, 'csv-'))
    await updateCsvFiles(folder)
    const file = path.join(folder, 'CSVT.csv')
    expect(fs.readFileSync(file, 'utf8')).toBe('Date,Time,Open,High,Low,Close,Volume,OI\n2026-10-27,09:15:00,100,101,99,100,10,0\n2026-10-27,09:16:00,101,102,100,101,10,0\n')

    await db.upsertBarsToHistory('CSVT', [bar(t0 + 120_000, 102)])
    const r = await updateCsvFiles(folder)
    expect(r.added).toBe(1)
    expect(fs.readFileSync(file, 'utf8').split('\n').slice(-2)).toEqual(['2026-10-27,09:17:00,102,103,101,102,10,0', ''])
    expect((await updateCsvFiles(folder)).added).toBe(0)   // nothing new: nothing written twice
  })

  it('a kept-up-to-date CSV file: its last bar is read back in India time', async () => {
    const { lastBarSec } = await import('../src/platforms/liveCsv')
    const tail = 'Date,Time,Open\n2026-10-27,09:15:00,1,2,3,4,5,0\n2026-10-27,09:16:00,1,2,3,4,5,0\n'
    expect(lastBarSec(tail)).toBe(1793072760)   // 27 Oct 2026 09:16 IST
    expect(lastBarSec('Date,Time,Open\n')).toBe(0)
    expect(lastBarSec('09:15:00,1,2\n')).toBe(0)  // a cut-off first line
  })
})

describe('TradingView', () => {
  it('spells symbols its way: "_" for "-" and "&", its index names, continuous futures by month', async () => {
    const { tradingViewSymbol, tvContinuous, tradingViewWatchlist } = await import('../src/platforms/exports')
    const now = Date.parse('2026-10-28T12:00:00+05:30') // October expiry (27 Oct, last Tuesday) has passed
    expect(tradingViewSymbol({ ticker: 'BAJAJ-AUTO', exchange: 'NSE', type: 'EQ' }, now)).toBe('NSE:BAJAJ_AUTO')
    expect(tradingViewSymbol({ ticker: 'M&M', exchange: 'NSE', type: 'EQ' }, now)).toBe('NSE:M_M')
    expect(tradingViewSymbol({ ticker: 'NIFTY50', exchange: 'NSE', type: 'INDEX' }, now)).toBe('NSE:NIFTY')
    expect(tradingViewSymbol({ ticker: 'SENSEX', exchange: 'BSE', type: 'INDEX' }, now)).toBe('BSE:SENSEX')
    expect(tvContinuous('RELIANCE26NOVFUT', now)).toBe('RELIANCE1!')
    expect(tvContinuous('RELIANCE26DECFUT', now)).toBe('RELIANCE2!')
    expect(tvContinuous('RELIANCE26OCTFUT', now)).toBeNull()                             // expired
    expect(tvContinuous('RELIANCE26OCTFUT', Date.parse('2026-10-20T12:00:00+05:30'))).toBe('RELIANCE1!')
    expect(tradingViewSymbol({ ticker: 'NIFTY26NOV25000CE', exchange: 'NFO', type: 'OPT' }, now)).toBeNull()
    const list = tradingViewWatchlist([
      { ticker: 'RELIANCE', exchange: 'NSE', type: 'EQ' }, { ticker: 'RELIANCE26NOVFUT', exchange: 'NFO', type: 'FUT' },
      { ticker: 'NIFTY26NOV25000CE', exchange: 'NFO', type: 'OPT' },
    ], now)
    expect(list).toEqual({ text: 'NSE:RELIANCE,NSE:RELIANCE1!', skipped: ['NIFTY26NOV25000CE'] })
  })

  it('links a symbol to its TradingView chart and Chartink chart', async () => {
    const { symbolLinks } = await import('../src/platforms/exports')
    const ck = (ticker: string, exchange = 'NSE', type = 'EQ') => symbolLinks({ ticker, exchange, type }).chartink
    expect(ck('TCS')).toBe('https://chartink.com/stocks-new?symbol=TCS')
    // Chartink has the cash market only: a future or an option opens its underlying
    expect(ck('TATAELXSI26NOVFUT', 'NFO', 'FUT')).toBe('https://chartink.com/stocks-new?symbol=TATAELXSI')
    expect(ck('TCS26NOV4000CE', 'NFO', 'OPT')).toBe('https://chartink.com/stocks-new?symbol=TCS')
    expect(ck('NIFTY50', 'NSE', 'INDEX')).toBe('https://chartink.com/stocks-new?symbol=NIFTY')
    expect(ck('M&M')).toBe('https://chartink.com/stocks-new?symbol=M%26M')
    expect(ck('CRUDEOIL26NOVFUT', 'MCX', 'FUT')).toBeNull()
    expect(symbolLinks({ ticker: 'RELIANCE', exchange: 'NSE', type: 'EQ' }).tradingview).toBe('https://www.tradingview.com/chart/?symbol=NSE%3ARELIANCE')
  })
})

describe('Chartink', () => {
  it('reads the symbols of a scan\'s CSV download', async () => {
    const { parseChartinkSymbols } = await import('../src/platforms/exports')
    const csv = '\uFEFFSr.,Stock Name,Symbol,Links,% Chg,Price,Volume\n1,Reliance Industries Limited,RELIANCE,P&F | F.A,1.2,1315.8,123456\n2,"Mahindra & Mahindra Limited",M&M,P&F | F.A,-0.5,3200,4567\n3,Reliance Industries Limited,RELIANCE,P&F,1.2,1315.8,1'
    expect(parseChartinkSymbols(csv)).toEqual(['RELIANCE', 'M&M'])
  })

  it('also takes a pasted list', async () => {
    const { parseChartinkSymbols } = await import('../src/platforms/exports')
    expect(parseChartinkSymbols('reliance, tcs\nNSE:INFY\tHDFCBANK\nbad!name')).toEqual(['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'])
  })
})

describe('history files', () => {
  const bars = '1793072700,100,101,99,100.5,250,4500\n1793072760,100.5,102,100,101,300'  // 27 Oct 2026 09:15 and 09:16 IST

  it('NinjaTrader 8: "yyyyMMdd HHmmss;o;h;l;c;v", stamped at the bar\'s end, India time', async () => {
    const { ninjaLines } = await import('../src/platforms/exports')
    expect(ninjaLines(bars)).toBe('20261027 091600;100;101;99;100.5;250\n20261027 091700;100.5;102;100;101;300')
  })

  it('CSV: date, time (bar start), OHLC, volume and OI', async () => {
    const { csvLines } = await import('../src/platforms/exports')
    expect(csvLines(bars)).toBe('Date,Time,Open,High,Low,Close,Volume,OI\n2026-10-27,09:15:00,100,101,99,100.5,250,4500\n2026-10-27,09:16:00,100.5,102,100,101,300,0')
  })

  it('MetaTrader 5: India time as seconds, symbol names MT5 accepts', async () => {
    const { mt5HistoryLines, mt5SymbolsText, mt5Name } = await import('../src/platforms/mt5')
    expect(mt5HistoryLines(bars)).toBe(`${1793072700 + 19800},100,101,99,100.5,250\n${1793072760 + 19800},100.5,102,100,101,300`)
    expect(mt5HistoryLines(bars, 'M_M,').split('\n')[0]).toBe(`M_M,${1793072700 + 19800},100,101,99,100.5,250`)
    expect(mt5Name('M&M')).toBe('M_M')
    expect(mt5SymbolsText([{ ticker: 'RELIANCE26NOVFUT', lot: 500, name: 'RELIANCE | FUT' }])).toBe('RELIANCE26NOVFUT|2|500|RELIANCE   FUT')
  })
})

describe('the platforms API', () => {
  it('saves the chosen platforms (unknown ones dropped) and lists every platform with that choice', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../src/app')
    const saved = await request(app).put('/api/platforms/chosen').send({ ids: ['excel', 'amibroker', 'nonsense'] })
    expect(saved.status).toBe(200)
    expect(saved.body.chosen).toEqual(['excel', 'amibroker'])
    const list = await request(app).get('/api/platforms')
    expect(list.status).toBe(200)
    expect(list.body.asked).toBe(true)
    expect(list.body.chosen).toEqual(['excel', 'amibroker'])
    expect(list.body.platforms.map((p: any) => p.id)).toEqual(['amibroker', 'excel', 'metatrader5', 'ninjatrader8', 'metastock', 'sierrachart', 'tradingview', 'chartink', 'csv'])
    expect((await request(app).put('/api/platforms/chosen').send({})).status).toBe(400)
  }, 30_000)

  it('serves the quote lines as plain text, and only reveals files DataBridge wrote', async () => {
    const request = (await import('supertest')).default
    const { app } = await import('../src/app')
    const q = await request(app).get('/api/platforms/quotes')
    expect(q.status).toBe(200)
    expect(q.headers['content-type']).toMatch(/text\/plain/)
    expect((await request(app).post('/api/platforms/reveal').send({ path: 'C:\Windows\System32\cmd.exe' })).status).toBe(400)
    expect((await request(app).post('/api/platforms/chartink/import').send({ brokerId: 'none', text: '' })).body.error).toMatch(/No symbols found/)
  })
})
