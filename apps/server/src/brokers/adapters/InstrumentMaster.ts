/**
 * InstrumentMaster.ts
 *
 * A broker's instrument list (Kite instruments dump, Dhan scrip master), reduced to the
 * segments the app tracks and saved under %APPDATA%\DataBridgePro\<broker>_master. Maps the
 * broker-neutral symbol keys (symbolKey.ts) to the broker's own reference (Kite instrument
 * token, Dhan segment + security id) and serves symbol search.
 *
 * Exchanges publish a new list every morning; it is downloaded once a day after 08:30 IST
 * (the old file is kept if the download fails). Records stay as tab-separated lines in
 * memory: ~150k instruments take ~20 MB this way, about half of what objects would.
 */
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../../db'
import type { InstrumentInfo } from './IBrokerAdapter'
import { parseSymbol, type ParsedSymbol } from './symbolKey'

/** Instrument categories, as the symbol-search filters name them */
export type InstrumentCategory = 'EQ' | 'INDEX' | 'FUTIDX' | 'FUTSTK' | 'FUTCOM' | 'OPTIDX' | 'OPTSTK' | 'OPTFUT'

export interface MasterRecord {
  key: string          // canonical key, e.g. NFO:TATAELXSI26OCTFUT
  ticker: string       // AmiBroker ticker, e.g. TATAELXSI26OCTFUT
  name: string
  exchange: string     // NSE | BSE | NFO | MCX
  cat: InstrumentCategory
  lot: number
  tick: number
  expiry: string       // YYYY-MM-DD, '' for cash / index
  ref: string          // broker reference (Kite token, Dhan "SEGMENT|SECURITYID|INSTRUMENT")
}

const FIELDS = ['key', 'ticker', 'name', 'exchange', 'cat', 'lot', 'tick', 'expiry', 'ref'] as const
const IST_MS = 5.5 * 3600 * 1000

/** Symbol-search filter values sent by the app ("NSE-10", "NFO-12"…, Fyers instrument codes) */
export const SEARCH_FILTERS: Record<string, InstrumentCategory[]> = {
  'NSE-10': ['EQ', 'INDEX'],
  'NFO-11': ['FUTIDX'], 'NFO-12': ['FUTSTK'], 'NFO-13': ['OPTIDX'], 'NFO-14': ['OPTSTK'],
  'MCX-11': ['FUTCOM'], 'MCX-12': ['OPTFUT'], 'MCX-13': ['FUTIDX'], 'MCX-14': ['OPTIDX'],
}

function toLine(r: MasterRecord): string {
  return FIELDS.map(f => String(r[f] ?? '').replace(/[\t\n\r]/g, ' ')).join('\t')
}

function fromLine(line: string): MasterRecord {
  const p = line.split('\t')
  return {
    key: p[0], ticker: p[1], name: p[2], exchange: p[3], cat: p[4] as InstrumentCategory,
    lot: Number(p[5]) || 1, tick: Number(p[6]) || 0.05, expiry: p[7] || '', ref: p[8],
  }
}

/** Splits one CSV line, honouring double-quoted fields */
export function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',')
  const out: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

export function category(cat: InstrumentCategory): string {
  if (cat === 'EQ' || cat === 'INDEX') return cat
  return cat.startsWith('FUT') ? 'FUT' : 'OPT'
}

/** Last 08:30 IST at or before `nowMs`: lists published before then are stale */
function lastPublishMs(nowMs: number): number {
  const ist = new Date(nowMs + IST_MS)
  let t = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 8, 30) - IST_MS
  if (t > nowMs) t -= 24 * 3600 * 1000
  return t
}

export class InstrumentMaster {
  private lines: string[] = []
  private byKey = new Map<string, number>()
  private byRef = new Map<string, number>()
  /** "NFO:TATAELXSI" → futures line indexes */
  private futuresByUnderlying = new Map<string, number[]>()
  private loading: Promise<void> | null = null
  private loadedAt = 0
  private failedAt = 0
  private lastError: Error | null = null
  readonly file: string

  constructor(
    private readonly broker: string,
    /** Downloads and normalizes the broker's list */
    private readonly download: () => Promise<MasterRecord[]>,
    /** A real list has tens of thousands; fewer means a broken download */
    private readonly minRecords = 1000,
  ) {
    this.file = path.join(DATA_DIR, `${broker}_master`, 'instruments.tsv')
  }

  get size() { return this.lines.length }
  get lastSync() { return this.loadedAt }

  /** Uses these records as today's list without downloading or saving (tests) */
  setRecords(records: MasterRecord[]) {
    this.index(records.map(toLine))
    this.loadedAt = Date.now()
  }

  isFresh(nowMs = Date.now()): boolean {
    try {
      return fs.statSync(this.file).mtimeMs >= lastPublishMs(nowMs)
    } catch {
      return false
    }
  }

  /** Loads the list (downloading today's when the saved one is older). Safe to call often. */
  async ensureLoaded(): Promise<void> {
    if (this.lines.length && this.loadedAt >= lastPublishMs(Date.now())) return
    // No list at all and the download just failed: don't retry on every symbol lookup
    if (!this.lines.length && this.lastError && Date.now() - this.failedAt < 60_000) throw this.lastError
    if (!this.loading) {
      this.loading = this.load(false).finally(() => { this.loading = null })
    }
    return this.loading
  }

  /** Re-downloads the list now (the 08:30 refresh, or the app's "sync symbols" button) */
  refresh(): Promise<void> {
    if (!this.loading) this.loading = this.load(true).finally(() => { this.loading = null })
    return this.loading
  }

  private async load(force: boolean) {
    if (force || !this.isFresh()) {
      try {
        const started = Date.now()
        const records = await this.download()
        if (records.length < this.minRecords) throw new Error(`only ${records.length} instruments in the list`)
        fs.mkdirSync(path.dirname(this.file), { recursive: true })
        const tmp = `${this.file}.tmp`
        await fs.promises.writeFile(tmp, records.map(toLine).join('\n'))
        await fs.promises.rename(tmp, this.file)
        console.log(`[${this.broker}] Instrument list downloaded: ${records.length} instruments (${((Date.now() - started) / 1000).toFixed(1)}s)`)
      } catch (err: any) {
        if (!fs.existsSync(this.file)) {
          this.failedAt = Date.now()
          this.lastError = new Error(`${this.broker} instrument list download failed: ${err?.message || err}`)
          throw this.lastError
        }
        console.warn(`[${this.broker}] Instrument list download failed (${err?.message || err}); using the saved list`)
      }
    }
    const text = await fs.promises.readFile(this.file, 'utf8')
    this.index(text.split('\n').filter(Boolean))
    this.loadedAt = Date.now()
  }

  private index(lines: string[]) {
    const byKey = new Map<string, number>()
    const byRef = new Map<string, number>()
    const futures = new Map<string, number[]>()
    lines.forEach((line, i) => {
      const t1 = line.indexOf('\t')
      const key = line.slice(0, t1)
      byKey.set(key, i)
      byRef.set(line.slice(line.lastIndexOf('\t') + 1), i)
      if (key.endsWith('FUT')) {
        // NFO:TATAELXSI26OCTFUT → NFO:TATAELXSI
        const u = key.slice(0, -8)
        const list = futures.get(u)
        if (list) list.push(i); else futures.set(u, [i])
      }
    })
    this.lines = lines
    this.byKey = byKey
    this.byRef = byRef
    this.futuresByUnderlying = futures
  }

  get(key: string): MasterRecord | undefined {
    const i = this.byKey.get(key)
    return i === undefined ? undefined : fromLine(this.lines[i])
  }

  getByRef(ref: string): MasterRecord | undefined {
    const i = this.byRef.get(ref)
    return i === undefined ? undefined : fromLine(this.lines[i])
  }

  /** Nearest unexpired future of an underlying key ("NFO:TATAELXSI") */
  nearestFuture(underlyingKey: string, nowMs = Date.now()): MasterRecord | undefined {
    const today = new Date(nowMs + IST_MS).toISOString().slice(0, 10)
    let best: MasterRecord | undefined
    for (const i of this.futuresByUnderlying.get(underlyingKey) || []) {
      const r = fromLine(this.lines[i])
      if (r.expiry >= today && (!best || r.expiry < best.expiry)) best = r
    }
    return best
  }

  /** The instrument a stored symbol name means, or undefined if the broker doesn't list it */
  resolve(raw: string, exchangeHint?: string, typeHint?: string): MasterRecord | undefined {
    const parsed: ParsedSymbol = parseSymbol(raw, exchangeHint, typeHint)
    if (parsed.kind === 'NEAREST_FUT') return this.nearestFuture(parsed.key)
    const hit = this.get(parsed.key)
    if (hit) return hit
    // A plain ticker stored as EQ may be an index the alias table doesn't know
    if (parsed.kind === 'EQ') return this.get(`${parsed.exchange}:${parsed.key.slice(4)}-INDEX`)
    return undefined
  }

  search(query: string, filter?: string, limit = 100): InstrumentInfo[] {
    const q = query.trim().toUpperCase()
    if (!q) return []
    let exchange: string | null = null
    let cats: InstrumentCategory[] | null = null
    if (filter && filter !== 'ALL') {
      if (SEARCH_FILTERS[filter]) cats = SEARCH_FILTERS[filter]
      exchange = filter.split('-')[0]
    }
    const exact: MasterRecord[] = []
    const prefix: MasterRecord[] = []
    const other: MasterRecord[] = []
    for (const line of this.lines) {
      if (!line.toUpperCase().includes(q)) continue
      const r = fromLine(line)
      if (exchange && r.exchange !== exchange) continue
      if (cats && !cats.includes(r.cat)) continue
      const t = r.ticker.toUpperCase()
      if (t === q) exact.push(r)
      else if (t.startsWith(q)) prefix.push(r)
      else if (t.includes(q) || r.name.toUpperCase().includes(q)) other.push(r)
      if (exact.length + prefix.length >= limit) break
    }
    const byExpiry = (a: MasterRecord, b: MasterRecord) => a.expiry.localeCompare(b.expiry) || a.ticker.localeCompare(b.ticker)
    return [...exact, ...prefix.sort(byExpiry), ...other.sort(byExpiry)].slice(0, limit).map(r => ({
      instrumentId: r.key,
      exchange: r.exchange,
      ticker: r.ticker,
      instrumentType: category(r.cat),
      lotSize: r.lot,
      tickSize: r.tick,
    }))
  }
}
