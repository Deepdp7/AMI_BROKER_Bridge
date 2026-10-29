/**
 * Symbol details in AmiBroker (Symbol > Information): the lot size, tick size and name of every
 * tracked symbol, as the broker's instrument list gives them.
 *
 * F&O contracts are bought in whole lots only (RELIANCE futures: 500 shares a lot), so the lot
 * goes into AmiBroker's "Round lot size": the backtester then buys whole lots, and a formula
 * reads it as RoundLotSize (lots a budget buys: floor(Budget / (RoundLotSize * Close))). Where
 * the list counts MCX contracts as lot 1 (Fyers), what one lot earns per rupee of price move goes
 * into "Point value" (CRUDEOIL 100); everything else in Symbol Information is left alone.
 *
 * Written through AmiBroker's OLE interface, which also adds tracked symbols AmiBroker doesn't
 * have yet, only while AmiBroker runs with the plugin connected, because COM would otherwise
 * start a hidden AmiBroker. That is when AmiBroker connects, when symbols are added, and once a
 * day after the new lists are out. Only values that differ are written.
 */
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { stmts, DATA_DIR } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { BROKERS } from '../brokers/brokerAuth'
import type { IBrokerAdapter, InstrumentDetails } from '../brokers/adapters/IBrokerAdapter'

export interface SymbolDetails {
  /** AmiBroker ticker */
  ticker: string
  /** What the broker's list says; missing when it doesn't list the symbol (then it is only added) */
  details?: InstrumentDetails
}

const IST_MS = 19_800_000
/** New instrument lists are out by then (08:30 IST), with a margin */
const DAILY_AT_IST_MIN = 8 * 60 + 45

// Lists of brokers that are not logged in are read through an adapter that never connects
const listReaders = new Map<string, IBrokerAdapter>()
function adapterFor(brokerId: string): IBrokerAdapter | undefined {
  const live = brokerManager.getAdapter(brokerId)
  if (live) return live
  const type = (stmts.getBrokerById.get(brokerId) as any)?.broker_type as keyof typeof BROKERS | undefined
  if (!type || !BROKERS[type]) return undefined
  if (!listReaders.has(type)) listReaders.set(type, BROKERS[type].create())
  return listReaders.get(type)
}

/** Every tracked symbol, once per AmiBroker ticker, with what its broker's list says about it */
export async function collectSymbolDetails(): Promise<SymbolDetails[]> {
  const byBroker = new Map<string, any[]>()
  const out = new Map<string, SymbolDetails>()
  for (const s of stmts.getSymbols.all() as any[]) {
    if (!s.amiBrokerTicker) continue
    if (!out.has(s.amiBrokerTicker)) out.set(s.amiBrokerTicker, { ticker: s.amiBrokerTicker })
    if (s.brokerId) byBroker.set(s.brokerId, [...(byBroker.get(s.brokerId) || []), s])
  }
  for (const [brokerId, symbols] of byBroker) {
    const adapter = adapterFor(brokerId)
    if (!adapter?.instrumentDetails) continue
    const nameOf = (s: any) => s.rawSymbol || s.instrumentId || s.amiBrokerTicker
    let details: Map<string, InstrumentDetails>
    try {
      details = await adapter.instrumentDetails(symbols.map(nameOf))
    } catch (err: any) {
      console.warn(`[SymbolDetails] ${brokerId}: instrument list not readable (${err?.message || err})`)
      continue
    }
    for (const s of symbols) {
      const d = details.get(nameOf(s))
      const row = out.get(s.amiBrokerTicker)!
      if (d && !row.details) row.details = d
    }
  }
  return [...out.values()]
}

const CACHE_MS = 5 * 60_000
let cache: { at: number; key: string; rows: Promise<SymbolDetails[]> } | null = null
/** collectSymbolDetails, kept for a few minutes (the app's symbol pages ask for it often) */
export function symbolDetailsCached(nowMs = Date.now()): Promise<SymbolDetails[]> {
  const key = (stmts.getSymbols.all() as any[]).map(s => `${s.brokerId}|${s.amiBrokerTicker}`).join(',')
  if (!cache || cache.key !== key || nowMs - cache.at > CACHE_MS) {
    const rows = collectSymbolDetails()
    cache = { at: nowMs, key, rows }
    rows.catch(() => { if (cache?.rows === rows) cache = null })
  }
  return cache.rows
}

/** The name AmiBroker shows: the list's name, with the expiry when the name doesn't carry it */
export function fullNameOf(d: InstrumentDetails): string {
  if (!d.expiry) return d.name
  const [y, m, day] = d.expiry.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, day)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  // Fyers: "RELIANCE 27 Oct 26 FUT" already says it
  if (new RegExp(`\\b${month}\\b`, 'i').test(d.name)) return d.name
  return `${d.name} (expiry ${day} ${month} ${y})`
}

/** One tab-separated line per symbol: ticker, full name, lot size, tick size, point value ('' = leave as is) */
export function symbolDetailsLines(rows: SymbolDetails[]): string {
  const clean = (v: string) => v.replace(/[\t\r\n]/g, ' ').trim()
  const num = (v: number | undefined) => (v && v > 0 ? String(v) : '')
  return rows.map(({ ticker, details: d }) => [
    clean(ticker), d ? clean(fullNameOf(d)) : '', num(d?.lotSize), num(d?.tickSize), num(d?.pointValue),
  ].join('\t')).join('\n')
}

// Adds missing symbols to the running AmiBroker and writes each line's values, only those that
// differ. AmiBroker's objects carry no type information, so PowerShell's "$ab.Stocks" reads as
// empty: members are called by name through IDispatch instead (checked on AmiBroker 6.20). It
// isn't in the running-object table either; creating the object attaches to the running one,
// so it is only done while Broker.exe runs. Casts use the invariant culture ("0.05" everywhere).
const PS_SCRIPT = `param([string]$Path)
if (-not (Get-Process -Name Broker -ErrorAction SilentlyContinue)) { 'NOT_RUNNING'; exit 0 }
$BF = [Reflection.BindingFlags]
function Get-Prop($o, $n, $a = $null) { , [System.__ComObject].InvokeMember($n, $BF::GetProperty, $null, $o, $a) }
function Set-Prop($o, $n, $v) { [void][System.__ComObject].InvokeMember($n, $BF::SetProperty, $null, $o, @($v)) }
function Invoke-Com($o, $n, $a) { , [System.__ComObject].InvokeMember($n, $BF::InvokeMethod, $null, $o, $a) }
try { $ab = New-Object -ComObject Broker.Application; $stocks = Get-Prop $ab 'Stocks' } catch { 'NO_OLE ' + $_.Exception.Message; exit 0 }
$total = 0; $added = 0; $changed = 0; $failed = 0
foreach ($line in [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)) {
  $f = $line.Split([char]9)
  if ($f.Length -lt 5 -or $f[0] -eq '') { continue }
  $total++
  try {
    $st = Get-Prop $stocks 'Item' @($f[0])
    if ($null -eq $st) { $st = Invoke-Com $stocks 'Add' @($f[0]); $added++ }
    $dirty = $false
    if ($f[1] -ne '' -and (Get-Prop $st 'FullName') -ne $f[1]) { Set-Prop $st 'FullName' $f[1]; $dirty = $true }
    if ($f[2] -ne '') { $v = [single]$f[2]; if ((Get-Prop $st 'RoundLotSize') -ne $v) { Set-Prop $st 'RoundLotSize' $v; $dirty = $true } }
    if ($f[3] -ne '') { $v = [single]$f[3]; if ((Get-Prop $st 'TickSize') -ne $v) { Set-Prop $st 'TickSize' $v; $dirty = $true } }
    if ($f[4] -ne '') { $v = [single]$f[4]; if ((Get-Prop $st 'PointValue') -ne $v) { Set-Prop $st 'PointValue' $v; $dirty = $true } }
    if ($dirty) { $changed++ }
  } catch { $failed++ }
}
"DONE $total $added $changed $failed"
`

let isAmiBrokerConnected: () => boolean = () => false
let pushTimer: NodeJS.Timeout | null = null
let running: Promise<void> | null = null
let again = false
let lastPushMs = 0

/** Writes the details of every tracked symbol into the running AmiBroker */
export async function pushSymbolDetails(): Promise<void> {
  if (running) { again = true; return running }
  running = (async () => {
    try {
      if (!isAmiBrokerConnected()) return
      cache = null // lists may be newer (the daily push), symbols just added
      const rows = await symbolDetailsCached()
      if (!rows.length) return
      const dir = path.join(DATA_DIR, 'amibroker')
      await fs.promises.mkdir(dir, { recursive: true })
      const script = path.join(dir, 'symbol-details.ps1')
      const data = path.join(dir, 'symbol-details.tsv')
      await fs.promises.writeFile(script, PS_SCRIPT)
      await fs.promises.writeFile(data, symbolDetailsLines(rows))
      const result = await new Promise<string>(resolve => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, data],
          { windowsHide: true, timeout: 120_000 }, (err, stdout) => resolve(err ? `ERROR ${err.message}` : String(stdout).trim()))
      })
      lastPushMs = Date.now()
      const done = result.match(/DONE (\d+) (\d+) (\d+) (\d+)/)
      if (done) {
        const [, total, added, changed, failed] = done
        console.log(`[SymbolDetails] Lot size, tick size and name sent to AmiBroker: ${total} symbols, ${added} added, ${changed} updated${failed !== '0' ? `, ${failed} failed` : ''}`)
      } else if (result.startsWith('NOT_RUNNING')) {
        // Closed in the meantime: sent again when it connects
      } else {
        console.warn(`[SymbolDetails] Could not update AmiBroker: ${result.slice(0, 200)}`)
      }
    } catch (err: any) {
      console.warn(`[SymbolDetails] ${err?.message || err}`)
    }
  })().finally(() => {
    running = null
    if (again) { again = false; schedulePush(0) }
  })
  return running
}

/** Pushes after `delayMs` (calls in the meantime are folded into one push) */
export function schedulePush(delayMs = 3000) {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushTimer = null; void pushSymbolDetails() }, delayMs)
  pushTimer.unref?.()
}

/** True when the last push was before today's 08:45 IST and it is past that now */
export function dailyPushDue(lastMs: number, nowMs = Date.now()): boolean {
  const ist = new Date(nowMs + IST_MS)
  const todayAt = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, DAILY_AT_IST_MIN) - IST_MS
  return nowMs >= todayAt && lastMs < todayAt
}

/** Starts the daily refresh; `connected` says whether AmiBroker's plugin is connected now */
export function startSymbolDetailsSync(connected: () => boolean) {
  isAmiBrokerConnected = connected
  setInterval(() => {
    if (connected() && lastPushMs && dailyPushDue(lastPushMs)) schedulePush(0)
  }, 15 * 60_000).unref()
}
