/**
 * Adding symbols to an account: saved, streamed live, history queued, and sent to AmiBroker's
 * symbol list. Used by Symbol Setup (POST /api/brokers/:id/symbols) and by imports (a Chartink
 * scan's stocks).
 */
import { stmts, getAllSettings } from '../db'
import { liveFeed } from '../market/liveFeed'
import { backfillQueue } from '../market/BackfillQueue'
import { brokerManager } from './BrokerManager'
import { schedulePush as pushSymbolDetailsSoon } from '../amibroker/symbolDetails'

export interface NewSymbol { ticker: string; instrumentId?: string; exchange?: string; instrumentType?: string }

export async function addSymbolsToBroker(brokerId: string, symbols: NewSymbol[]): Promise<{ added: number; total: number }> {
  const now = Date.now()
  let added = 0
  for (const sym of symbols) {
    try {
      // The instrument id from search is the broker's own name (e.g. NSE:ITC26OCTFUT); without
      // one the broker resolves the ticker
      let rawSymbol = sym.instrumentId || sym.ticker
      const adapter = brokerManager.getAdapter(brokerId) as any
      if ((!rawSymbol || rawSymbol === sym.ticker) && adapter?.resolveSymbol) {
        rawSymbol = await adapter.resolveSymbol(sym.ticker, sym.exchange)
      }

      stmts.insertSymbol.run({
        broker_id: brokerId,
        instrument_id: rawSymbol,
        amibroker_ticker: sym.ticker,
        exchange: sym.exchange || 'NSE',
        instrument_type: sym.instrumentType || 'EQ',
        raw_symbol: rawSymbol,
        created_at: now,
      })

      liveFeed.addSymbolByTicker(sym.ticker, brokerId, sym.exchange, sym.instrumentType, rawSymbol)

      try {
        await brokerManager.subscribe(brokerId, [rawSymbol])
        console.log(`[ADD_SYMBOL] "${sym.ticker}" → "${rawSymbol}" subscribed to live feed.`)
      } catch (subErr) {
        console.error(`[ADD_SYMBOL] Failed to subscribe "${sym.ticker}" → "${rawSymbol}":`, subErr)
      }

      const backfillDepth = Number((getAllSettings() as any)?.backfillDepthDays) || 365
      backfillQueue.allowHistory([sym.ticker]) // added again after a cancel
      backfillQueue.enqueue(sym.ticker, brokerId, rawSymbol, backfillDepth)
      console.log(`[ADD_SYMBOL] "${sym.ticker}" backfill queued (${backfillDepth} days).`)
      added++
    } catch (symErr) {
      console.error(`[ADD_SYMBOL] Error adding symbol "${sym.ticker}":`, symErr)
    }
  }
  // Into AmiBroker's symbol list, with lot size, tick size and name (when it is running)
  if (added > 0) pushSymbolDetailsSoon()
  return { added, total: symbols.length }
}
