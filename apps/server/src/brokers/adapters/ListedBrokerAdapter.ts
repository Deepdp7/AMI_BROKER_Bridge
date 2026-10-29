/**
 * ListedBrokerAdapter.ts
 *
 * Shared part of the brokers whose instruments come from a downloaded list (Kite, Dhan):
 * symbol lookup and search, live-feed bookkeeping (a tick carries back the exact symbol name
 * it was subscribed under, which is how liveFeed finds the AmiBroker ticker), the
 * daily symbol-list sync the app's Symbols page drives, and the token expiry alarm.
 */
import { EventEmitter } from 'events'
import { stmts } from '../../db'
import type { IBrokerAdapter, BrokerCredentials, SessionInfo, InstrumentInfo, InstrumentDetails, Bar } from './IBrokerAdapter'
import type { InstrumentMaster, MasterRecord } from './InstrumentMaster'

export interface FeedTick {
  lastPrice: number
  lastQty?: number
  totalVolume?: number
  timestampMs: number
  openInterest?: number
}

export abstract class ListedBrokerAdapter extends EventEmitter implements IBrokerAdapter {
  abstract readonly maxIntradayHistoryDays: number
  /** "Kite", "Dhan" — for logs */
  protected abstract readonly label: string
  protected abstract readonly master: InstrumentMaster

  /** broker ref → the symbol name it was subscribed under */
  private subscribedAs = new Map<string, string>()
  private refOfName = new Map<string, string>()
  private expiryTimer: NodeJS.Timeout | null = null
  isDownloadingMaster = false

  abstract connect(credentials: BrokerCredentials): Promise<SessionInfo>
  abstract disconnect(): Promise<void>
  abstract getHistoricalBars(instrumentToken: string, interval: string, from: Date, to: Date): Promise<Bar[]>
  /** Start streaming these instruments */
  protected abstract feedSubscribe(records: MasterRecord[]): void
  /** Stop streaming these refs */
  protected abstract feedUnsubscribe(refs: string[]): void

  getCapabilities() {
    return { supportsTickData: true, supports1sBars: false, supportsDepth: true }
  }

  /** The instrument a stored symbol name means (uses the symbol's exchange / type columns as hints) */
  protected async lookup(name: string): Promise<MasterRecord | undefined> {
    await this.master.ensureLoaded()
    const sym = (stmts.getSymbols.all() as any[]).find(s => s.rawSymbol === name || s.instrumentId === name || s.amiBrokerTicker === name)
    return this.master.resolve(name, sym?.exchange, sym?.instrumentType)
  }

  /** Error for a symbol the broker doesn't list (expired contract, wrong name) */
  protected unknownSymbol(name: string) {
    return Object.assign(new Error(`Invalid symbol: ${name} is not in the ${this.label} instrument list (expired contract?)`), { code: -300, fromApi: true })
  }

  async resolveSymbol(ticker: string, dbExchange?: string): Promise<string> {
    await this.master.ensureLoaded()
    return this.master.resolve(ticker, dbExchange)?.key || ticker
  }

  async searchSymbols(query: string, exchange?: string): Promise<InstrumentInfo[]> {
    await this.master.ensureLoaded()
    return this.master.search(query, exchange)
  }

  async listFutures(kind: 'stock' | 'index'): Promise<InstrumentInfo[]> {
    await this.master.ensureLoaded()
    return this.master.futures([kind === 'stock' ? 'FUTSTK' : 'FUTIDX']).filter(f => f.exchange === 'NFO')
  }

  async instrumentDetails(names: string[]): Promise<Map<string, InstrumentDetails>> {
    const out = new Map<string, InstrumentDetails>()
    for (const name of names) {
      const r = await this.lookup(name)
      if (r) out.set(name, { name: r.name, lotSize: r.lot, tickSize: r.tick, expiry: r.expiry })
    }
    return out
  }

  async subscribe(instruments: string[]): Promise<void> {
    try {
      await this.master.ensureLoaded()
    } catch (err: any) {
      console.error(`[${this.label}] Cannot subscribe: ${err?.message || err}`)
      return
    }
    const records: MasterRecord[] = []
    const missing: string[] = []
    for (const name of instruments) {
      const rec = await this.lookup(name)
      if (!rec) { missing.push(name); continue }
      this.subscribedAs.set(rec.ref, name)
      this.refOfName.set(name, rec.ref)
      records.push(rec)
    }
    if (missing.length) {
      console.warn(`[${this.label}] ${missing.length} symbol(s) not in the instrument list, no live ticks for them (expired contracts?): ${missing.slice(0, 8).join(', ')}`)
    }
    if (records.length) this.feedSubscribe(records)
  }

  async unsubscribe(instruments: string[]): Promise<void> {
    const refs = new Set<string>()
    for (const name of instruments) {
      const ref = this.refOfName.get(name) ?? (await this.lookup(name).catch(() => undefined))?.ref
      if (!ref) continue
      refs.add(ref)
      this.refOfName.delete(name)
    }
    for (const ref of refs) {
      const as = this.subscribedAs.get(ref)
      if (as) this.refOfName.delete(as)
      this.subscribedAs.delete(ref)
    }
    if (refs.size) this.feedUnsubscribe([...refs])
  }

  /** Refs currently streamed (re-sent after a reconnect) */
  protected subscribedRefs(): string[] {
    return [...this.subscribedAs.keys()]
  }

  /** Hands a live update to the app under the name the symbol was subscribed with */
  protected emitTick(ref: string, t: FeedTick) {
    const name = this.subscribedAs.get(ref)
    if (!name || !(t.lastPrice > 0)) return
    this.emit('tick', {
      instrumentId: name,
      lastPrice: t.lastPrice,
      volume: t.lastQty || 0,
      totalVolume: t.totalVolume,
      timestamp: t.timestampMs,
      openInterest: t.openInterest,
    })
  }

  /** Reports the token dead at `expiresAtMs` (nothing else notices while the market is closed) */
  protected scheduleExpiry(expiresAtMs: number | null) {
    this.clearExpiry()
    if (!expiresAtMs) return
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null
      console.log(`[${this.label}] Access token expired`)
      this.emit('auth_failed')
    }, Math.min(Math.max(0, expiresAtMs - Date.now()), 2 ** 31 - 1))
    this.expiryTimer.unref()
  }

  protected clearExpiry() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = null
  }

  // --- Symbol list sync (Symbols page "sync" button, 08:30 IST cron) ---
  get lastMasterSync() { return this.master.lastSync }
  get masterContracts() { return { length: this.master.size } }

  isMasterDownloadedToday(): boolean {
    return this.master.isFresh()
  }

  async downloadMasterContracts(brokerId?: string): Promise<void> {
    if (this.isDownloadingMaster) return
    this.isDownloadingMaster = true
    const id = brokerId || this.label.toLowerCase()
    try {
      this.emit('master_sync_progress', { brokerId: id, progress: 20, text: `Downloading ${this.label} instrument list...` })
      await this.master.refresh()
      this.emit('master_sync_progress', { brokerId: id, progress: 100, text: 'Symbols sync complete.' })
      this.emit('master_sync_complete', { brokerId: id, count: this.master.size, text: `${this.master.size.toLocaleString('en-IN')} instruments up to date.` })
    } catch (err: any) {
      this.emit('master_sync_error', { brokerId: id, error: err?.message || String(err) })
      this.emit('log_entry', { level: 'error', component: `${this.label}Adapter`, message: `Instrument list download failed: ${err?.message || err}` })
    } finally {
      this.isDownloadingMaster = false
    }
  }
}
