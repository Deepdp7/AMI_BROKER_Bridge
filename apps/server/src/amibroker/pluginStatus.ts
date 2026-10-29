/**
 * The DataBridge light in AmiBroker's status bar, and its right-click menu.
 *
 * Every few seconds (and when it changes) the engine tells the plugin what to show:
 *   STATUS|level|short|long    level 0 green (all good), 1 yellow (busy / waiting), 2 red (a problem);
 *                              short goes in the status bar, long is its tooltip
 * The plugin also reports AmiBroker reloading whole histories again and again (its in-memory
 * cache can't hold the symbols at that many bars each):
 *   NOTE|RELOADS|symbols|numBars   the light turns yellow for a while and says what to change
 * The right-click menu sends commands back:
 *   CMD|REPAIR|TICKER          check the symbol's whole history, download what is missing
 *   CMD|TODAY|TICKER           re-download today's bars of one symbol
 *   CMD|TODAY_ALL              … of every symbol
 */
import { stmts } from '../db'
import { brokerManager } from '../brokers/BrokerManager'
import { BROKERS } from '../brokers/brokerAuth'
import { backfillQueue } from '../market/BackfillQueue'
import { liveFeed } from '../market/liveFeed'
import { isMarketSession } from '../market/MarketCalendar'
import { refreshToday } from '../market/refreshToday'
import { repairHistory } from '../brokers/BrokerLifecycle'

export interface PluginStatus { level: 0 | 1 | 2; short: string; long: string }

export interface StatusInputs {
  /** Names of the brokers logged in now ("Fyers") */
  brokers: string[]
  symbols: number
  /** Symbols with history still to download */
  downloading: number
  paused: boolean
  marketOpen: boolean
  /** Since the newest tick of any symbol (Infinity when none yet) */
  lastTickAgoMs: number
  /** AmiBroker keeps reloading full histories (NOTE|RELOADS), recently */
  reloading?: { symbols: number; numBars: number }
}

/** What the light says, from the engine's state */
export function pluginStatusFrom(s: StatusInputs): PluginStatus {
  if (!s.brokers.length) {
    return { level: 2, short: 'No broker', long: 'DataBridge Pro: no broker is logged in. Open DataBridge Pro > Broker Connection.' }
  }
  const who = s.brokers.join(' + ')
  if (s.reloading) {
    const bars = s.reloading.numBars > 0 ? `${s.reloading.numBars.toLocaleString('en-IN')} bars` : 'its bars'
    return {
      level: 1, short: 'Reloading',
      long: `AmiBroker keeps reloading ${s.reloading.symbols} symbol${s.reloading.symbols === 1 ? '' : 's'} with all ${bars} each, which makes it pause. ` +
        'Fix: Tools > Preferences > Data: raise the in-memory cache, or File > Database Settings: lower Number of bars.',
    }
  }
  if (s.downloading > 0 && !s.paused) {
    return { level: 1, short: `History ${s.downloading}`, long: `DataBridge Pro (${who}): downloading history, ${s.downloading} symbol${s.downloading === 1 ? '' : 's'} to go. Charts fill in as it arrives.` }
  }
  if (s.marketOpen && s.symbols > 0) {
    if (s.lastTickAgoMs <= 60_000) {
      return { level: 0, short: 'Live', long: `DataBridge Pro: ${who} live, ${s.symbols} symbol${s.symbols === 1 ? '' : 's'} streaming.` }
    }
    const ago = Number.isFinite(s.lastTickAgoMs) ? `for ${Math.round(s.lastTickAgoMs / 1000)} s` : 'yet'
    return { level: 1, short: 'No ticks', long: `DataBridge Pro (${who}): market is open but no price updates ${ago}.` }
  }
  const paused = s.downloading > 0 && s.paused ? ' History download paused.' : ''
  return { level: 0, short: 'OK', long: `DataBridge Pro: ${who} connected, ${s.symbols} symbol${s.symbols === 1 ? '' : 's'}. Market closed.${paused}` }
}

/** The light from the engine's current state */
export function currentPluginStatus(nowMs = Date.now()): PluginStatus {
  const brokers = brokerManager.getActiveIds().map(id => {
    const type = (stmts.getBrokerById.get(id) as any)?.broker_type as keyof typeof BROKERS | undefined
    return (type && BROKERS[type]?.name) || id
  })
  const statuses = liveFeed.getFeedStatuses()
  const lastTick = statuses.reduce((m, s) => Math.max(m, s.lastTickUtcMs || 0), 0)
  return pluginStatusFrom({
    brokers: [...new Set(brokers)],
    symbols: statuses.length,
    downloading: new Set(backfillQueue.queuedTickers()).size,
    paused: backfillQueue.isPaused(),
    marketOpen: isMarketSession(nowMs, 'NSE'),
    lastTickAgoMs: lastTick ? nowMs - lastTick : Infinity,
    reloading: reloadNote && nowMs < reloadNote.until ? reloadNote : undefined,
  })
}

// The last NOTE|RELOADS, shown on the light for 15 minutes
let reloadNote: { symbols: number; numBars: number; until: number } | null = null

/** A note from the plugin (NOTE|RELOADS|symbols|numBars) */
export function handlePluginNote(line: string, nowMs = Date.now()) {
  const [, kind, a, b] = line.trim().split('|')
  if (kind !== 'RELOADS') return
  const symbols = Number(a) || 0, numBars = Number(b) || 0
  reloadNote = { symbols, numBars, until: nowMs + 15 * 60_000 }
  console.warn(`[AmiBroker] It keeps reloading the whole history of ${symbols} symbol(s)${numBars ? ` (${numBars} bars each)` : ''}: its in-memory cache is too small for them, so scans and charts pause on every reload. ` +
    'In AmiBroker: Tools > Preferences > Data > raise "In-memory cache", or File > Database Settings > lower "Number of bars".')
}

/** The line for the plugin ('|' and line breaks can't be in the texts) */
export function statusLine(s: PluginStatus): string {
  const clean = (t: string) => t.replace(/[|\r\n]/g, ' ')
  return `STATUS|${s.level}|${clean(s.short)}|${clean(s.long)}\n`
}

/** Runs a right-click menu command from the plugin; what it did, for the log */
export async function runPluginCommand(line: string): Promise<string> {
  const [, cmd, ticker] = line.trim().split('|')
  if (cmd === 'TODAY_ALL') {
    const r = refreshToday(null)
    return `today's bars again for ${r.queued} symbols`
  }
  if (!ticker) return 'ignored (no symbol)'
  if (cmd === 'TODAY') {
    const r = refreshToday([ticker])
    return r.queued ? `today's bars again for ${ticker}` : `${ticker}: no broker for it`
  }
  if (cmd === 'REPAIR') {
    const r = await repairHistory([ticker])
    return r.queued ? `downloading missing history of ${ticker}` : r.noBroker ? `${ticker}: no broker for it` : `${ticker}: history already complete`
  }
  return `unknown command ${cmd}`
}
