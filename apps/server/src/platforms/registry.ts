/**
 * The trading and charting platforms DataBridge Pro feeds, and where each one is on this PC.
 *
 * What each can take is decided by the platform, not by us:
 *   live      live prices and full history (AmiBroker plugin, Excel RTD, MetaTrader 5 connector)
 *   history   1-minute history files to import (NinjaTrader 8, MetaStock and anything else via CSV)
 *   watchlist web platforms with their own data and no way to load another feed (TradingView,
 *             Chartink): symbol lists go back and forth and a symbol opens there
 * Sierra Chart is listed as found-but-not-connected yet: it takes outside data only over its DTC
 * protocol, which DataBridge does not speak yet.
 *
 * Only the platform's own places are looked at: Windows' list of installed programs, App Paths,
 * the platform's data folders (MetaTrader's %APPDATA%\MetaQuotes\Terminal\<id>), and the usual
 * install folders.
 */
import fs from 'fs'
import path from 'path'
import { installedPrograms, readRegistry, exeFromIcon, type RegReader, type RegValues } from './windows'

export type PlatformId = 'amibroker' | 'excel' | 'metatrader5' | 'ninjatrader8' | 'sierrachart' | 'metastock' | 'tradingview' | 'chartink' | 'csv'
export type PlatformLevel = 'live' | 'history' | 'watchlist' | 'soon'

export interface PlatformInstance {
  /** Install folder (where the exe is) */
  folder: string
  exe?: string
  /** Where DataBridge puts its plugin / connector / files for it */
  connectorFolder?: string
  connectorInstalled?: boolean
  label?: string
}

export interface PlatformInfo {
  id: PlatformId
  name: string
  kind: 'desktop' | 'web' | 'file'
  level: PlatformLevel
  /** One line: what DataBridge does for it */
  gives: string
  installed: boolean
  instances: PlatformInstance[]
  /** Extra facts (Office 64-bit, …) */
  note?: string
  website: string
}

export interface DetectDeps {
  env: NodeJS.ProcessEnv
  exists: (p: string) => boolean
  readDir: (p: string) => string[]
  readText: (p: string) => string | null
  programs: () => Promise<Array<RegValues & { key: string }>>
  registry: RegReader
}

export const realDeps = (): DetectDeps => ({
  env: process.env,
  exists: p => { try { return fs.existsSync(p) } catch { return false } },
  readDir: p => { try { return fs.readdirSync(p) } catch { return [] } },
  readText: p => {
    try {
      const buf = fs.readFileSync(p)
      // MetaTrader writes origin.txt as UTF-16
      return buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le').slice(1) : buf.toString('utf8')
    } catch { return null }
  },
  programs: () => installedPrograms(),
  registry: readRegistry,
})

const DEFS: Array<Omit<PlatformInfo, 'installed' | 'instances' | 'note'>> = [
  { id: 'amibroker', name: 'AmiBroker', kind: 'desktop', level: 'live', website: 'https://www.amibroker.com',
    gives: 'Live charts, full history, scans and backtests through the DataBridge plugin.' },
  { id: 'excel', name: 'Microsoft Excel', kind: 'desktop', level: 'live', website: 'https://www.microsoft.com/microsoft-365/excel',
    gives: 'Live prices in any cell, bars of any timeframe (1m to 1d, the newest moving live), and a ready-made workbook with a History sheet and chart.' },
  { id: 'metatrader5', name: 'MetaTrader 5', kind: 'desktop', level: 'live', website: 'https://www.metatrader5.com',
    gives: 'Your symbols as MT5 custom symbols: history and live 1-minute bars for charts, indicators and EAs.' },
  { id: 'ninjatrader8', name: 'NinjaTrader 8', kind: 'desktop', level: 'history', website: 'https://ninjatrader.com',
    gives: '1-minute history files in NinjaTrader\'s import format (Tools → Import → Historical Data).' },
  { id: 'metastock', name: 'MetaStock', kind: 'desktop', level: 'history', website: 'https://www.metastock.com',
    gives: '1-minute history as CSV for MetaStock\'s Downloader (ASCII import).' },
  { id: 'sierrachart', name: 'Sierra Chart', kind: 'desktop', level: 'soon', website: 'https://www.sierrachart.com',
    gives: 'Found when installed. Live data needs Sierra Chart\'s DTC protocol, which DataBridge does not speak yet; CSV history works now.' },
  { id: 'tradingview', name: 'TradingView', kind: 'web', level: 'watchlist', website: 'https://www.tradingview.com',
    gives: 'Uses its own data (no outside feeds): your symbols export as a TradingView watchlist, and any symbol opens on its chart.' },
  { id: 'chartink', name: 'Chartink', kind: 'web', level: 'watchlist', website: 'https://chartink.com',
    gives: 'Uses its own data (no outside feeds): a scan\'s stocks come into DataBridge (then AmiBroker, Excel…), and any symbol opens there.' },
  { id: 'csv', name: 'CSV files (any software)', kind: 'file', level: 'live', website: '',
    gives: 'One file per symbol (date, time, open, high, low, close, volume, OI), kept up to date every minute: Python, Investar, anything that reads CSV.' },
]

export const PLATFORM_IDS = DEFS.map(d => d.id)

const firstExisting = (deps: DetectDeps, paths: (string | undefined)[]) => paths.find(p => !!p && deps.exists(p))
const programMatching = (programs: Array<RegValues & { key: string }>, re: RegExp) => programs.filter(p => re.test(p.DisplayName || ''))
/** Install folder of an uninstall entry (InstallLocation, else the DisplayIcon's folder) */
const folderOf = (p: RegValues) => (p.InstallLocation || '').replace(/[\\/]+$/, '') || (exeFromIcon(p.DisplayIcon) ? path.dirname(exeFromIcon(p.DisplayIcon)!) : '')

async function detectAmiBroker(deps: DetectDeps, programs: Array<RegValues & { key: string }>): Promise<PlatformInstance[]> {
  const folders = new Set<string>()
  const remembered = deps.readText(path.join(deps.env.APPDATA || '', 'DataBridgePro', 'amibroker_path.txt'))?.trim()
  if (remembered) folders.add(path.dirname(remembered))
  for (const p of programMatching(programs, /amibroker/i)) { const f = folderOf(p); if (f) folders.add(f) }
  for (const v of ['ProgramFiles(x86)', 'ProgramFiles', 'ProgramW6432']) if (deps.env[v]) folders.add(path.join(deps.env[v]!, 'AmiBroker'))
  const out: PlatformInstance[] = []
  const seen = new Set<string>()
  for (const folder of folders) {
    const exe = path.join(folder, 'Broker.exe')
    if (!deps.exists(exe) || seen.has(exe.toLowerCase())) continue
    seen.add(exe.toLowerCase())
    const plugins = path.join(folder, 'Plugins')
    out.push({ folder, exe, connectorFolder: plugins, connectorInstalled: deps.exists(path.join(plugins, 'DataBridgePro.dll')) })
  }
  return out
}

async function detectExcel(deps: DetectDeps): Promise<{ instances: PlatformInstance[]; note?: string }> {
  const appPath = [...(await deps.registry('HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\excel.exe')).values()][0]?.['(Default)']
  const exe = firstExisting(deps, [appPath?.replace(/^"|"$/g, ''),
    path.join(deps.env.ProgramW6432 || deps.env.ProgramFiles || '', 'Microsoft Office', 'root', 'Office16', 'EXCEL.EXE'),
    path.join(deps.env['ProgramFiles(x86)'] || '', 'Microsoft Office', 'root', 'Office16', 'EXCEL.EXE')])
  if (!exe) return { instances: [] }
  const ctr = [...(await deps.registry('HKLM\\Software\\Microsoft\\Office\\ClickToRun\\Configuration')).values()][0]
  const bits = ctr?.Platform === 'x86' || /\(x86\)/i.test(exe) ? 32 : 64
  const registered = (await deps.registry('HKCU\\Software\\Classes\\DataBridge.RTD\\CLSID')).size > 0
  return { instances: [{ folder: path.dirname(exe), exe, connectorInstalled: registered, label: `Office ${bits}-bit` }], note: `${bits}-bit` }
}

async function detectMetaTrader5(deps: DetectDeps, programs: Array<RegValues & { key: string }>): Promise<PlatformInstance[]> {
  const out: PlatformInstance[] = []
  // Every terminal has a data folder %APPDATA%\MetaQuotes\Terminal\<id> whose origin.txt names its install folder
  const root = path.join(deps.env.APPDATA || '', 'MetaQuotes', 'Terminal')
  for (const id of deps.readDir(root)) {
    const dataDir = path.join(root, id)
    const origin = deps.readText(path.join(dataDir, 'origin.txt'))?.replace(/\u0000/g, '').trim()
    if (!origin || !deps.exists(path.join(dataDir, 'MQL5'))) continue
    // MetaTrader 4 terminals share this folder; theirs have MQL4 and no terminal64.exe
    const exe = path.join(origin, 'terminal64.exe')
    if (!deps.exists(exe)) continue
    out.push({
      folder: origin, exe,
      connectorFolder: path.join(dataDir, 'MQL5'),
      connectorInstalled: deps.exists(path.join(dataDir, 'MQL5', 'Services', 'DataBridge.ex5')),
      label: path.basename(origin),
    })
  }
  // Installed but never started (no data folder yet): found, nothing to install into until it runs once
  for (const p of programMatching(programs, /metatrader 5|mt5/i)) {
    const folder = folderOf(p)
    if (folder && !out.some(o => o.folder.toLowerCase() === folder.toLowerCase()) && deps.exists(path.join(folder, 'terminal64.exe'))) {
      out.push({ folder, exe: path.join(folder, 'terminal64.exe'), label: p.DisplayName })
    }
  }
  return out
}

function simpleInstances(programs: Array<RegValues & { key: string }>, re: RegExp, deps: DetectDeps, exeNames: string[], extraFolders: string[] = []): PlatformInstance[] {
  const out: PlatformInstance[] = []
  const folders = [...programMatching(programs, re).map(folderOf), ...extraFolders].filter(Boolean)
  for (const folder of new Set(folders)) {
    const exe = firstExisting(deps, exeNames.map(n => path.join(folder, n)))
    if (exe || deps.exists(folder)) out.push({ folder, exe })
  }
  return out
}

/** Every platform, with what was found on this PC */
export async function detectPlatforms(deps: DetectDeps = realDeps()): Promise<PlatformInfo[]> {
  const programs = await deps.programs().catch(() => [])
  const found: Partial<Record<PlatformId, { instances: PlatformInstance[]; note?: string }>> = {}
  found.amibroker = { instances: await detectAmiBroker(deps, programs) }
  found.excel = await detectExcel(deps)
  found.metatrader5 = { instances: await detectMetaTrader5(deps, programs) }
  found.ninjatrader8 = { instances: simpleInstances(programs, /ninjatrader\s*8|^ninjatrader$/i, deps, ['bin\\NinjaTrader.exe', 'bin64\\NinjaTrader.exe']) }
  found.metastock = { instances: simpleInstances(programs, /metastock/i, deps, ['MsWin.exe', 'MetaStock.exe']) }
  found.sierrachart = { instances: simpleInstances(programs, /sierra\s*chart/i, deps, ['SierraChart_64.exe', 'SierraChart.exe'], ['C:\\SierraChart'].filter(deps.exists)) }
  const tvDesktop = firstExisting(deps, [path.join(deps.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'TradingView.exe'), path.join(deps.env.LOCALAPPDATA || '', 'Programs', 'TradingView', 'TradingView.exe')])
  found.tradingview = { instances: tvDesktop ? [{ folder: path.dirname(tvDesktop), exe: tvDesktop, label: 'TradingView desktop' }] : [] }

  return DEFS.map(def => {
    const f = found[def.id]
    const instances = f?.instances || []
    // Web and file "platforms" are always available
    const installed = def.kind !== 'desktop' || instances.length > 0
    return { ...def, installed, instances, ...(f?.note ? { note: f.note } : {}) }
  })
}
