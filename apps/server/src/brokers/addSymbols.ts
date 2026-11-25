/**
 * Adding symbols to an account: saved, streamed live, history queued, and sent to AmiBroker's
 * symbol list. Used by Symbol Setup (POST /api/brokers/:id/symbols), by imports (a Chartink
 * scan's stocks, Import CSV).
 *
 * Many symbols are added in one pass, not one after the other: the names are resolved a few at a
 * time, saved in one transaction, subscribed in one call and queued for history in one go, with one
 * line in the log. Adding 500 symbols one by one made 500 subscribe calls and about 2,000 log lines.
 */
import { stmts, getAllSettings } from '../db'
import { liveFeed } from '../market/liveFeed'
import { backfillQueue } from '../market/BackfillQueue'
import { brokerManager } from './BrokerManager'
import { schedulePush as pushSymbolDetailsSoon } from '../amibroker/symbolDetails'

export interface NewSymbol { ticker: string; instrumentId?: string; exchange?: string; instrumentType?: string }

/** Names are looked up this many at a time (the broker's list is in memory: this only bounds a slow lookup) */
const RESOLVE_AT_ONCE = 8

/**
 * `opts.resolve: false` stores `instrumentId` (or the ticker) as the broker's name without asking the
 * broker's list (Import CSV: the file has no broker names).
 */
export async function addSymbolsToBroker(brokerId: string, symbols: NewSymbol[], opts: { resolve?: boolean } = {}): Promise<{ added: number; total: number }> {
  const now = Date.now()
  const adapter = brokerManager.getAdapter(brokerId) as any

  // 1. The broker's own name of each symbol. The instrument id from search is already it (e.g.
  //    NSE:ITC26OCTFUT); without one the broker resolves the ticker
  const names: Array<string | null> = new Array(symbols.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < symbols.length) {
      const i = next++
      const sym = symbols[i]
      try {
        let rawSymbol = sym.instrumentId || sym.ticker
        if (opts.resolve !== false && (!rawSymbol || rawSymbol === sym.ticker) && adapter?.resolveSymbol) {
          rawSymbol = await adapter.resolveSymbol(sym.ticker, sym.exchange)
        }
        names[i] = rawSymbol || sym.ticker
      } catch (symErr) {
        console.error(`[ADD_SYMBOL] Error adding symbol "${sym.ticker}":`, symErr)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(RESOLVE_AT_ONCE, symbols.length) }, worker))

  const good: Array<{ sym: NewSymbol; rawSymbol: string }> = []
  symbols.forEach((sym, i) => { if (names[i] !== null) good.push({ sym, rawSymbol: names[i] as string }) })
  if (!good.length) return { added: 0, total: symbols.length }

  // 2. Saved in one transaction
  stmts.insertSymbols.run(good.map(({ sym, rawSymbol }) => ({
    broker_id: brokerId,
    instrument_id: rawSymbol,
    amibroker_ticker: sym.ticker,
    exchange: sym.exchange || 'NSE',
    instrument_type: sym.instrumentType || 'EQ',
    raw_symbol: rawSymbol,
    created_at: now,
  })))

  // 3. Live feed state
  liveFeed.addSymbolsByTicker(good.map(({ sym, rawSymbol }) => ({ ticker: sym.ticker, brokerId, exchange: sym.exchange, instrumentType: sym.instrumentType, brokerToken: rawSymbol })))

  // 4. One subscribe for all of them (the broker's client sends them on in batches of its own size)
  try {
    await brokerManager.subscribe(brokerId, good.map(x => x.rawSymbol))
  } catch (subErr) {
    console.error(`[ADD_SYMBOL] Failed to subscribe ${good.length} symbol(s):`, subErr)
  }

  // 5. History
  const backfillDepth = Number((getAllSettings() as any)?.backfillDepthDays) || 365
  backfillQueue.allowHistory(good.map(x => x.sym.ticker)) // added again after a cancel
  backfillQueue.enqueueBatch(good.map(({ sym, rawSymbol }) => ({ ticker: sym.ticker, brokerId, brokerToken: rawSymbol, depthDays: backfillDepth })))

  console.log(`[ADD_SYMBOL] ${good.length} symbol(s) added to ${brokerId}${good.length <= 5 ? ` (${good.map(x => `"${x.sym.ticker}" → "${x.rawSymbol}"`).join(', ')})` : ''}: subscribed to the live feed, ${backfillDepth} days of history queued.`)

  // Into AmiBroker's symbol list, with lot size, tick size and name (when it is running)
  pushSymbolDetailsSoon(undefined, 'added')
  return { added: good.length, total: symbols.length }
}
