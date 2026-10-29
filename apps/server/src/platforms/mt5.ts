/**
 * MetaTrader 5: DataBridge's prices as custom symbols, through files (MT5 programs may only read
 * files inside the terminal's own MQL5\Files folder, and need no extra permission for that).
 *
 * Install puts the DataBridge service (plugins/metatrader5/DataBridge.mq5) into the terminal's
 * MQL5\Services and compiles it with the terminal's MetaEditor. From then on the engine keeps
 * MQL5\Files\DataBridge up to date (the service's header says what is in each file):
 *   symbols.txt   when symbols change        hist\<T>.csv   on install / new symbol / daily
 *   recent.csv    every minute (3 days)       live.csv       every second (forming bars)
 * Times are India time written as seconds, so MT5 charts show NSE hours.
 */
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { liveFeed } from '../market/liveFeed'
import { readBarsCsv } from '../db/reader'
import { symbolDetailsCached } from '../amibroker/symbolDetails'
import { connectorSource, safeFileName } from './files'
import { storedSymbols } from './exports'
import type { PlatformInstance } from './registry'

const IST_SEC = 19_800
const RECENT_DAYS = 3
const HISTORY_BARS = 400_000

/** Engine bar CSV ("ts,o,h,l,c,v[,oi]") → the service's "istTime,o,h,l,c,v" lines */
export function mt5HistoryLines(barsCsv: string, prefix = ''): string {
  const out: string[] = []
  for (const line of barsCsv.split('\n')) {
    const f = line.split(',')
    if (f.length < 6) continue
    out.push(`${prefix}${Number(f[0]) + IST_SEC},${f[1]},${f[2]},${f[3]},${f[4]},${Math.round(Number(f[5]) || 0)}`)
  }
  return out.join('\n')
}

/** symbols.txt: TICKER|digits|lot|description (MT5 names may not hold some characters) */
export function mt5SymbolsText(rows: Array<{ ticker: string; lot?: number; name?: string }>): string {
  return rows.map(r => [mt5Name(r.ticker), 2, r.lot || 1, (r.name || r.ticker).replace(/[|\r\n]/g, ' ')].join('|')).join('\n')
}

/** A DataBridge ticker as an MT5 symbol name ("M&M" → "M_M": MT5 rejects some characters) */
export function mt5Name(ticker: string): string {
  return ticker.replace(/[^A-Za-z0-9._-]/g, '_')
}

function filesDir(mql5: string) { return path.join(mql5, 'Files', 'DataBridge') }

/** Copies the service in and compiles it with this terminal's MetaEditor */
export async function installMt5Connector(inst: PlatformInstance): Promise<void> {
  if (!inst.connectorFolder) throw new Error('Start this MetaTrader 5 once (so it creates its data folder), then install again')
  const source = connectorSource('DataBridge.mq5')
  if (!source) throw new Error('DataBridge.mq5 is not in this DataBridge Pro installation; reinstall DataBridge Pro')
  const services = path.join(inst.connectorFolder, 'Services')
  await fs.promises.mkdir(services, { recursive: true })
  const target = path.join(services, 'DataBridge.mq5')
  await fs.promises.copyFile(source, target)
  const editor = ['metaeditor64.exe', 'MetaEditor64.exe'].map(n => path.join(inst.folder, n)).find(p => fs.existsSync(p))
  if (editor) {
    // MetaEditor compiles and exits; it reports through the log file, not its exit code
    const log = path.join(services, 'DataBridge.compile.log')
    await new Promise<void>(resolve => execFile(editor, [`/compile:${target}`, `/log:${log}`], { windowsHide: true, timeout: 120_000 }, () => resolve()))
  }
  if (!fs.existsSync(path.join(services, 'DataBridge.ex5'))) {
    throw new Error(`The service was copied to ${services} but not compiled: open it in MetaEditor (F4) and press Compile (F7)`)
  }
  await fs.promises.mkdir(path.join(filesDir(inst.connectorFolder), 'hist'), { recursive: true })
  await writeSymbolsAndHistory(inst.connectorFolder, true)
}

/** symbols.txt, and history files (all of them, or only the ones missing) */
async function writeSymbolsAndHistory(mql5: string, all: boolean) {
  const dir = filesDir(mql5)
  await fs.promises.mkdir(path.join(dir, 'hist'), { recursive: true })
  const details = new Map((await symbolDetailsCached().catch(() => [])).map(r => [r.ticker, r.details]))
  const symbols = storedSymbols()
  await fs.promises.writeFile(path.join(dir, 'symbols.txt'),
    mt5SymbolsText(symbols.map(s => ({ ticker: s.ticker, lot: details.get(s.ticker)?.lotSize, name: details.get(s.ticker)?.name }))))
  for (const s of symbols) {
    const file = path.join(dir, 'hist', `${safeFileName(mt5Name(s.ticker))}.csv`)
    if (!all && fs.existsSync(file)) continue
    const csv = await readBarsCsv(s.ticker, 0, HISTORY_BARS)
    if (csv) await fs.promises.writeFile(file, mt5HistoryLines(csv))
  }
}

// ---- Keeping the files current ----

const forming = new Map<string, { bucketMs: number; open: number; high: number; low: number; close: number; volume: number }>()
let targets: string[] = []        // MQL5 folders with the connector installed
let symbolsKey = ''
let timers: NodeJS.Timeout[] = []

/** The MT5 terminals (their MQL5 folders) the files go to */
export function setMt5Targets(mql5Folders: string[]) {
  targets = [...new Set(mql5Folders)]
  if (targets.length && !timers.length) startWriters()
  if (!targets.length) stopWriters()
}

async function writeAll(name: string, text: string) {
  for (const mql5 of targets) {
    // MT5 may be reading it this very moment: the next round writes it again
    await fs.promises.writeFile(path.join(filesDir(mql5), name), text).catch(() => {})
  }
}

function startWriters() {
  liveFeed.on('live_bar_updated', onBar)
  // Forming bars, every second
  timers.push(setInterval(() => {
    if (!forming.size) return
    const lines = [...forming].map(([t, b]) => `${mt5Name(t)},${Math.floor(b.bucketMs / 1000) + IST_SEC},${b.open},${b.high},${b.low},${b.close},${Math.round(b.volume)}`)
    void writeAll('live.csv', lines.join('\n'))
  }, 1000))
  // The last few days of every symbol, every minute (fills minutes MT5 missed while closed)
  timers.push(setInterval(() => { void writeRecent() }, 60_000))
  // New or removed symbols: their list, and history for new ones
  timers.push(setInterval(() => {
    const key = storedSymbols().map(s => s.ticker).join(',')
    if (key === symbolsKey) return
    symbolsKey = key
    for (const mql5 of targets) void writeSymbolsAndHistory(mql5, false).catch(err => console.warn(`[MT5] ${err?.message || err}`))
  }, 15_000))
  for (const t of timers) t.unref()
  void writeRecent()
}

function stopWriters() {
  liveFeed.off('live_bar_updated', onBar)
  for (const t of timers) clearInterval(t)
  timers = []
}

function onBar({ ticker, bar }: { ticker: string; bar: any }) {
  if (bar?.open > 0 && bar.bucketMs) forming.set(ticker, { ...bar })
}

async function writeRecent() {
  const since = Math.floor(Date.now() / 1000) - RECENT_DAYS * 86_400
  const parts: string[] = []
  for (const s of storedSymbols()) {
    const csv = await readBarsCsv(s.ticker, since, 5_000).catch(() => '')
    if (csv) parts.push(mt5HistoryLines(csv, `${mt5Name(s.ticker)},`))
  }
  await writeAll('recent.csv', parts.join('\n'))
}
