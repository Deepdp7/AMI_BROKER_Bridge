/**
 * Excel: live prices through DataBridge's RTD server (plugins/excel), and a ready-made live sheet.
 *
 * Install copies the DLL that matches Excel (64- or 32-bit) to %APPDATA%\DataBridgePro\connectors
 * (a place that survives app updates and needs no administrator) and registers it for this user
 * with regsvr32. When Excel has the old copy loaded, the new one goes next to it under another
 * name: Windows won't replace a DLL in use.
 */
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { DATA_DIR, stmts } from '../db'
import { buildXlsx, type Cell } from '../lib/xlsx'
import { connectorSource, userFolder } from './files'
import { readRegistry } from './windows'

export async function excelConnectorRegistered(): Promise<boolean> {
  return (await readRegistry('HKCU\\Software\\Classes\\DataBridge.RTD\\CLSID')).size > 0
}

function regsvr32(bits: 32 | 64, dll: string, unregister = false): Promise<void> {
  const exe = path.join(process.env.windir || 'C:\\Windows', bits === 32 && process.arch === 'x64' ? 'SysWOW64' : 'System32', 'regsvr32.exe')
  return new Promise((resolve, reject) => {
    execFile(exe, [...(unregister ? ['/u'] : []), '/s', dll], { windowsHide: true, timeout: 30_000 }, err => {
      if (err) reject(new Error(`regsvr32 could not ${unregister ? 'remove' : 'register'} ${path.basename(dll)} (${(err as any).code ?? err.message})`))
      else resolve()
    })
  })
}

/** Installs (or updates) the live-price connector for this user's Excel */
export async function installExcelConnector(bits: 32 | 64): Promise<string> {
  const name = `DataBridgeRtd${bits}.dll`
  const source = connectorSource(name)
  if (!source) throw new Error(`${name} is not in this DataBridge Pro installation; reinstall DataBridge Pro`)
  const dir = path.join(DATA_DIR, 'connectors', 'excel')
  await fs.promises.mkdir(dir, { recursive: true })
  let target = path.join(dir, name)
  try {
    await fs.promises.copyFile(source, target)
  } catch (err: any) {
    // The current copy is loaded in a running Excel: the new one goes beside it
    if (err?.code !== 'EBUSY' && err?.code !== 'EPERM') throw err
    target = path.join(dir, `DataBridgeRtd${bits}-${Date.now()}.dll`)
    await fs.promises.copyFile(source, target)
  }
  await regsvr32(bits, target)
  if (!(await excelConnectorRegistered())) throw new Error('Excel connector registration did not take effect')
  // Older copies that are no longer registered and not in use
  for (const f of await fs.promises.readdir(dir)) {
    const full = path.join(dir, f)
    if (full !== target && /^DataBridgeRtd\d+(-\d+)?\.dll$/i.test(f)) await fs.promises.unlink(full).catch(() => {})
  }
  console.log(`[Platforms] Excel live prices installed (${bits}-bit): ${target}`)
  return target
}

export async function uninstallExcelConnector(bits: 32 | 64): Promise<void> {
  const dir = path.join(DATA_DIR, 'connectors', 'excel')
  const files = (await fs.promises.readdir(dir).catch(() => [] as string[])).filter(f => /^DataBridgeRtd\d+(-\d+)?\.dll$/i.test(f))
  for (const f of files) await regsvr32(bits, path.join(dir, f), true).catch(() => {})
}

const FIELDS: Array<{ title: string; field?: string; width: number; style: 'num' | 'num0' | 'pct' | 'time' | 'text' }> = [
  { title: 'Symbol', width: 22, style: 'text' },
  { title: 'Last', field: 'LTP', width: 12, style: 'num' },
  { title: 'Change', field: 'CHANGE', width: 10, style: 'num' },
  { title: 'Change %', field: 'CHANGE%', width: 10, style: 'pct' },
  { title: 'Open', field: 'OPEN', width: 11, style: 'num' },
  { title: 'High', field: 'HIGH', width: 11, style: 'num' },
  { title: 'Low', field: 'LOW', width: 11, style: 'num' },
  { title: 'Prev close', field: 'PREVCLOSE', width: 11, style: 'num' },
  { title: 'Volume', field: 'VOLUME', width: 13, style: 'num0' },
  { title: 'OI', field: 'OI', width: 13, style: 'num0' },
  { title: 'Lot', field: 'LOT', width: 8, style: 'num0' },
  { title: 'One lot (₹)', width: 14, style: 'num' },
  { title: 'Last trade', field: 'TIME', width: 11, style: 'time' },
]

/** The live sheet's rows: one per symbol, every value an =RTD() formula */
export function liveSheetRows(tickers: string[]): Cell[][] {
  const rows: Cell[][] = [FIELDS.map(f => f.title)]
  tickers.forEach((t, i) => {
    const r = i + 2
    rows.push(FIELDS.map((f, c) => {
      if (c === 0) return t
      if (f.title.startsWith('One lot')) return { f: `IF(AND(ISNUMBER(B${r}),ISNUMBER(K${r})),B${r}*K${r},"")` }
      return { f: `RTD("DataBridge.RTD",,$A${r},"${f.field}")` }
    }))
  })
  return rows
}

export const HISTORY_BARS = 100
export const HISTORY_HEADER_ROW = 4   // 0-based: row 5 in Excel
const TIMEFRAME_CHOICES = '1m,5m,15m,30m,1h,1d'

/**
 * The History sheet: pick a symbol (B1) and a timeframe (B2), and the last 100 bars fill in, bar 1
 * being the one forming now (it moves with every tick), with a chart of the closes.
 */
export function historySheetRows(firstTicker: string): Cell[][] {
  const rows: Cell[][] = [
    [{ f: '"Symbol"', style: 'bold' }, firstTicker, { f: '"← any symbol in DataBridge (list: Live prices sheet)"', style: 'note' }],
    [{ f: '"Timeframe"', style: 'bold' }, '5m', { f: '"← 1m, 5m, 15m, 30m, 1h or 1d"', style: 'note' }],
    [{ f: '"Bar 1 is the one forming now: it moves with every price. Older bars come from DataBridge\'s stored history."', style: 'note' }],
    [],
    ['Bar', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume', 'Change %'],
  ]
  const fields = ['TIME', 'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME']
  for (let i = 1; i <= HISTORY_BARS; i++) {
    const r = HISTORY_HEADER_ROW + 1 + i   // Excel row of bar i
    rows.push([
      i,
      ...fields.map(f => ({ f: `RTD("DataBridge.RTD",,$B$1,"BAR",$B$2,$A${r},"${f}")` })),
      { f: `IF(AND(ISNUMBER(F${r}),ISNUMBER(F${r + 1}),F${r + 1}<>0),(F${r}/F${r + 1}-1)*100,"")` },
    ])
  }
  return rows
}

/** Writes Documents\DataBridge Pro\DataBridge Live.xlsx with every tracked symbol; returns its path */
export async function writeLiveSheet(): Promise<string> {
  const tickers = [...new Set((stmts.getSymbols.all() as any[]).map(s => s.amiBrokerTicker).filter(Boolean))].sort()
  const file = path.join(await userFolder(), 'DataBridge Live.xlsx')
  const xlsx = liveWorkbook(tickers)
  try {
    await fs.promises.writeFile(file, xlsx)
    return file
  } catch (err: any) {
    // Open in Excel right now: a new copy beside it
    if (err?.code !== 'EBUSY' && err?.code !== 'EPERM') throw err
    const other = path.join(path.dirname(file), `DataBridge Live ${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.xlsx`)
    await fs.promises.writeFile(other, xlsx)
    return other
  }
}

/** The workbook: "Live prices" (a row per symbol) and "History" (any symbol's bars, with a chart) */
export function liveWorkbook(tickers: string[]): Buffer {
  const list = tickers.length ? tickers : ['NIFTY50']
  const first = HISTORY_HEADER_ROW + 2, last = HISTORY_HEADER_ROW + 1 + HISTORY_BARS
  return buildXlsx([
    {
      name: 'Live prices',
      rows: liveSheetRows(list),
      widths: FIELDS.map(f => f.width),
      columnStyles: FIELDS.map(f => f.style),
      signColumns: [2, 3],
      freezeRows: 1,
    },
    {
      name: 'History',
      rows: historySheetRows(list[0]),
      headerRow: HISTORY_HEADER_ROW,
      widths: [7, 17, 11, 11, 11, 11, 13, 10, 3],
      columnStyles: ['num0', 'datetime', 'num', 'num', 'num', 'num', 'num0', 'pct'],
      signColumns: [7],
      freezeRows: HISTORY_HEADER_ROW + 1,
      lists: [
        { cell: 'B1', source: `'Live prices'!$A$2:$A$${list.length + 1}` },
        { cell: 'B2', source: TIMEFRAME_CHOICES },
      ],
      chart: {
        title: 'Close', seriesName: 'Close', newestFirst: true,
        categories: `History!$B$${first}:$B$${last}`,
        values: `History!$F$${first}:$F$${last}`,
        from: [9, 0], to: [21, 24],
      },
    },
  ])
}
