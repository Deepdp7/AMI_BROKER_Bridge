/**
 * DataBridge Pro — API Sync Hook
 * Connects the Zustand store to the real local API server.
 * Falls back to mock data if the API is unavailable.
 */
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { api, wsManager, isApiAvailable } from '../api/apiClient'
import { toast } from '../components/ui/Toast'
import { setAssistantView } from '../lib/assistantView'
import { restoredFromSnapshot, startSnapshotSaving } from '../lib/startupSnapshot'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { invoke } from '@tauri-apps/api/core'

type ApiState = 'checking' | 'connected' | 'offline'

let resyncing: Promise<void> | null = null
let wsOpenedBefore = false
let amiBrokerStartTried = false

/** Settings → "Open AmiBroker automatically": once per app start, as soon as the saved settings are known */
export function maybeStartAmiBroker(settings: any) {
  if (amiBrokerStartTried || !(window as any).__TAURI_INTERNALS__) return
  if (settings?.autoStartAmiBroker !== true && settings?.autoStartAmiBroker !== 'true') return
  amiBrokerStartTried = true
  invoke<{ alreadyOpen: boolean }>('start_amibroker', { path: settings.amiBrokerPath || null })
    .then(r => { if (!r.alreadyOpen) toast.info('AmiBroker opened', 'Opened automatically, as set in Settings.', 4000) })
    .catch(err => toast.error("Couldn't open AmiBroker", String(err), 8000))
}

/** NSE cash session by the IST clock (weekday 09:15-15:30); the engine's broadcast refines it */
function marketOpenByClock(nowMs = Date.now()): boolean {
  const ist = new Date(nowMs + 5.5 * 3600 * 1000)
  const day = ist.getUTCDay()
  const totalMin = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return day !== 0 && day !== 6 && totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30
}

/** Tells the desktop shell the first data is on screen, so it shows the window (once) */
let revealed = false
export function revealWindow() {
  if (revealed || !(window as any).__TAURI_INTERNALS__) return
  revealed = true
  invoke('app_ready').catch(() => { /* older shell: it showed the window itself */ })
}

const SYMBOL_FIELDS = ['ticker', 'exchange', 'instrumentType', 'brokerId', 'rawSymbol', 'lastPrice', 'prevClose', 'lastTickUtcMs',
  'barsPerMin', 'internalLatencyMs', 'status', 'change', 'changePercent', 'volume'] as const

/** A symbol as the engine reports it, on top of what the screen already had */
export function freshSymbol(sym: any, old?: object): any {
  const out: any = { ...(old || {}) }
  for (const k of SYMBOL_FIELDS) out[k] = sym[k]
  return out
}

export function sameSymbol(a: any, b: any): boolean {
  return SYMBOL_FIELDS.every(k => a[k] === b[k])
}

/**
 * Pull the engine's current state into the store. Runs at startup and again whenever the
 * engine reconnects (restart/crash), the window regains focus, and periodically — so the
 * screens never show a stale snapshot. Later runs keep unsaved Settings edits and logs.
 */
export function resyncFromEngine(initial = false): Promise<void> {
  if (resyncing) return resyncing
  resyncing = (async () => {
    const store = useAppStore.getState()
    const tasks: Promise<unknown>[] = []

    if (initial) {
      tasks.push(api.getSettings().then(settings => {
        store.updateSettings(settings as any)
        maybeStartAmiBroker(settings)
      }).catch(() => {}))
      tasks.push(api.getLogs({ limit: 50 }).then(logs => logs.forEach(l => store.addLog(l as any))).catch(() => {}))
    }

    tasks.push(api.getBrokers().then(brokers => {
      if (Array.isArray(brokers) && JSON.stringify(brokers) !== JSON.stringify(useAppStore.getState().brokers)) {
        useAppStore.setState({ brokers: brokers as any })
      }
    }).catch(() => {}))

    // Symbols: the engine's list is authoritative (drops symbols deleted elsewhere, adds new ones).
    // Symbols that didn't change keep their object, so nothing redraws for them.
    tasks.push(api.getFeedStatus().then(feedStatus => {
      const before = useAppStore.getState().symbols
      const current = new Map(before.map(s => [s.ticker, s]))
      const next = feedStatus.symbols.map((sym: any) => {
        const old = current.get(sym.ticker)
        const fresh = freshSymbol(sym, old)
        return old && sameSymbol(old, fresh) ? old : fresh
      })
      const unchanged = next.length === before.length && next.every((s: any, i: number) => s === before[i])
      if (!unchanged) useAppStore.setState({ symbols: next as any })
      store.updateCoreStats(feedStatus.coreEngine as any)
    }).catch(() => {}))

    // Backfill: only downloads still in progress (finished ones would re-open an old notification);
    // entries already on screen are brought up to date
    tasks.push(api.getBackfillStatus().then(bfData => {
      if (!bfData || !Array.isArray(bfData.statuses)) return
      if (typeof bfData.paused === 'boolean') useAppStore.getState().setBackfillPaused(bfData.paused)
      const shown = useAppStore.getState().backfillStatuses
      bfData.statuses.forEach((s: any) => {
        if (s.status === 'pending' || s.status === 'running' || shown[s.ticker]) store.updateBackfillStatus(s.ticker, s)
      })
    }).catch(() => {}))

    await Promise.all(tasks)
    // Page-level loads (auto-refresh state, history health…); the first start waits a moment for them
    lastPageLoads = Promise.all([...resyncListeners].map(fn => { try { return Promise.resolve(fn()).catch(() => {}) } catch { return Promise.resolve() } }))
  })().finally(() => { resyncing = null })
  return resyncing
}

const resyncListeners = new Set<() => unknown>()
let lastPageLoads: Promise<unknown> = Promise.resolve()

/**
 * Re-run `load` whenever the app resyncs with the engine (reconnect, window focus, every 60 s).
 * For page-level data that isn't pushed over the WebSocket.
 */
export function useEngineRefresh(load: () => unknown) {
  const ref = useRef(load)
  ref.current = load
  useEffect(() => {
    const fn = () => ref.current()
    resyncListeners.add(fn)
    return () => { resyncListeners.delete(fn) }
  }, [])
}

export function useApiSync() {
  const [apiState, setApiState] = useState<ApiState>('checking')
  // Actions never change, so read them once: subscribing to the store here would redraw the
  // whole app (this hook runs in the main layout) on every live price update
  const {
    updateCoreStats, addLog, updateBrokerStatus, updateBackfillStatus, setMarketStatus,
  } = useAppStore.getState()
  const initializedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      setMarketStatus(marketOpenByClock() ? 'open' : 'closed')
      // The window stays hidden until data is on screen (revealWindow), so it never opens on an
      // empty "Connecting…" page. With the last session's data (startupSnapshot) that is right
      // away, and the engine's data replaces it in place a moment later. Without it (first
      // ever start) the window waits for the engine; a slow start shows it anyway after 6 s.
      if (restoredFromSnapshot) requestAnimationFrame(() => requestAnimationFrame(revealWindow))
      const slowStart = window.setTimeout(revealWindow, 6000)
      startSnapshotSaving()

      // The data engine starts alongside the UI (and restarts after crashes), so keep polling
      // until it answers: quickly while it is starting (it is usually up within a second or
      // two of opening the app), then every 2 s, showing "offline" only after that.
      const startedAt = Date.now()
      let waited = false
      while (!(await isApiAvailable())) {
        if (!mounted) return
        waited = true
        const starting = Date.now() - startedAt < 20_000
        setApiState(starting ? 'checking' : 'offline')
        await new Promise(r => setTimeout(r, starting ? 100 : 2000))
      }
      if (!mounted) return

      // Data first, then "connected" and the window: it opens with everything filled in
      await resyncFromEngine(true)
      // The pages' own first loads usually finish within milliseconds; a slow one (history
      // health) doesn't hold the window back
      if (!restoredFromSnapshot) await Promise.race([lastPageLoads, new Promise(r => setTimeout(r, 400))])
      if (!mounted) return
      setApiState('connected')
      window.clearTimeout(slowStart)
      // Paint the filled page before the window appears
      requestAnimationFrame(() => requestAnimationFrame(revealWindow))
      // Only worth a message when the user saw it waiting
      if (waited && Date.now() - startedAt > 6000) toast.success('Data service connected', 'Live data is flowing again.', 3000)

      // Connect WebSocket for live updates
      wsManager.connect()
    }

    if (!initializedRef.current) {
      initializedRef.current = true
      init()
    } else if (apiState === 'checking') {
      // If we are remounted but still checking, run init again
      init()
    }

    return () => { mounted = false }
  }, [])

  // Wire WebSocket events to store
  useEffect(() => {
    let pendingUpdates: Map<string, any> = new Map()
    // Download progress, one store update per flush: adding a few hundred symbols sends an
    // event for each of them at once
    let pendingBackfill: Record<string, any> = {}
    let lastCoreStats: any = null
    let rafId: number | null = null

    const flushUpdates = () => {
      if (pendingUpdates.size > 0) {
        const updates = Array.from(pendingUpdates.entries()).map(([ticker, sym]) => ({
          ticker,
          update: {
            lastPrice: sym.lastPrice,
            lastTickUtcMs: sym.lastTickUtcMs,
            internalLatencyMs: sym.internalLatencyMs,
            barsPerMin: sym.barsPerMin,
            status: sym.status,
            change: sym.change,
            changePercent: sym.changePercent,
            volume: sym.volume,
            ...(sym.openInterest ? { openInterest: sym.openInterest } : {}),
          }
        }))
        useAppStore.getState().batchUpdateSymbolFeeds(updates)
        pendingUpdates.clear()
      }
      if (Object.keys(pendingBackfill).length) {
        useAppStore.getState().updateBackfillStatuses(pendingBackfill)
        pendingBackfill = {}
      }
      if (lastCoreStats) {
        updateCoreStats(lastCoreStats)
        lastCoreStats = null
      }
      rafId = null
    }

    const offFeed = wsManager.on('feed_update', (payload: any) => {
      if (payload?.symbols) {
        payload.symbols.forEach((sym: any) => {
          pendingUpdates.set(sym.ticker, sym)
        })
      }
      if (payload?.coreEngine) {
        lastCoreStats = payload.coreEngine
      }
      if (!rafId) {
        rafId = window.setTimeout(flushUpdates, 200) // Throttle to 5 updates/sec
      }
    })

    const offLog = wsManager.on('log_entry', (payload: any) => {
      if (payload?.id) addLog(payload)
    })

    const offBrokerStatus = wsManager.on('broker_status', (payload: any) => {
      const brokerId = payload?.brokerId || payload?.id
      if (brokerId && payload?.status) {
        updateBrokerStatus(brokerId, payload.status)
      }
    })

    const offOpen = wsManager.on('open', () => {
      setApiState('connected')
      // Reconnected (engine restarted): refresh everything, but don't repeat the market toast
      if (wsOpenedBefore) { resyncFromEngine(); return }
      wsOpenedBefore = true
      // Initial market status from the IST clock (no need to wait 60s for the server to broadcast)
      const open = marketOpenByClock()
      setMarketStatus(open ? 'open' : 'closed')
      if (!open) {
        toast.info('Market Closed', 'NSE market is closed. Live streaming will auto-start at 09:15 IST.', 6000)
      }
    })

    // Pre-market brief finished → notify, with a button that opens it
    let briefWasGenerating = false
    const offBrief = wsManager.on('morning_brief', (p: any) => {
      if (briefWasGenerating && !p?.generating && p?.latest && !p?.lastError) {
        toast.success('Pre-market brief ready', 'Market mood, stocks in the news and your watchlist for today.', 10000, {
          label: 'Open brief',
          onClick: () => { setAssistantView('brief'); window.location.hash = '#/assistant' },
        })
      }
      briefWasGenerating = !!p?.generating
    })

    // Window comes back to the front, or every minute as a safety net: resync quietly
    const onFocus = () => { if (document.visibilityState === 'visible') resyncFromEngine() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const resyncTimer = window.setInterval(() => { if (document.visibilityState === 'visible') resyncFromEngine() }, 60_000)
    const offResyncTriggers = () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(resyncTimer)
    }

    const offClose = wsManager.on('close', () => {
      if (apiState === 'connected') {
        setApiState('offline')
      }
    })

    // Backfill OS Notifications
    const ensureNotificationPermission = async () => {
      try {
        let permissionGranted = await isPermissionGranted()
        if (!permissionGranted) {
          const permission = await requestPermission()
          permissionGranted = permission === 'granted'
        }
        return permissionGranted
      } catch (e) {
        return false
      }
    }

    const offBackfillProgress = wsManager.on('backfill_progress', async (payload: any) => {
      if (!payload?.ticker) return
      // Into the store with the next flush (the banner and Activity read it)
      pendingBackfill[payload.ticker] = payload
      if (!rafId) rafId = window.setTimeout(flushUpdates, 200)
    })

    const offBackfillCompleted = wsManager.on('backfill_completed', async (payload: any) => {
      if (payload?.ticker) {
        // Update store to show completed (a progress event still waiting for its frame is older)
        delete pendingBackfill[payload.ticker]
        updateBackfillStatus(payload.ticker, { ...payload, status: 'completed', progress: 100 })
        // One notification per batch (not one per symbol): when nothing is pending or running
        const all = Object.values(useAppStore.getState().backfillStatuses)
        const busy = all.some(st => st.status === 'pending' || st.status === 'running')
        if (!busy && all.length > 0 && await ensureNotificationPermission()) {
          const done = all.filter(st => st.status === 'completed')
          const failed = all.length - done.length
          const candles = done.reduce((n, st) => n + (st.candlesFetched || 0), 0)
          sendNotification({
            title: 'DataBridge Pro',
            body: `History download complete: ${done.length} symbol(s), ${candles.toLocaleString()} candles${failed ? ` · ${failed} failed` : ''}`
          })
        }
      }
    })

    // Paused / resumed / cancelled (from the download card, or another window)
    const offBackfillControl = wsManager.on('backfill_control', (payload: any) => {
      const store = useAppStore.getState()
      if (typeof payload?.paused === 'boolean') store.setBackfillPaused(payload.paused)
      if (payload?.cancelled) store.clearAllBackfills()
    })

    // Market status (open / closed transitions)
    let _prevMarketOpen: boolean | null = null
    const offMarketStatus = wsManager.on('market_status', (payload: any) => {
      const open: boolean = !!payload?.open
      setMarketStatus(open ? 'open' : 'closed')
      if (_prevMarketOpen !== null && _prevMarketOpen !== open) {
        if (open) {
          toast.success('Market Open 🟢', 'NSE is now open — live data streaming started!', 8000)
        } else {
          toast.info('Market Closed 🔴', 'NSE has closed for the day. Historical data is still available.', 8000)
        }
      }
      _prevMarketOpen = open
    })

    // Backfill failed
    const offBackfillFailed = wsManager.on('backfill_failed', (payload: any) => {
      if (payload?.ticker) {
        delete pendingBackfill[payload.ticker]
        updateBackfillStatus(payload.ticker, { ...payload, status: 'failed' })
        toast.error('Backfill Failed', `${payload.ticker}: ${payload.error || 'Unknown error'}`, 5000)
      }
    })

    return () => {
      if (rafId) window.clearTimeout(rafId)
      offFeed?.()
      offLog?.()
      offBrokerStatus?.()
      offOpen?.()
      offClose?.()
      offBackfillProgress?.()
      offBackfillCompleted?.()
      offBackfillControl?.()
      offMarketStatus?.()
      offBackfillFailed?.()
      offResyncTriggers()
      offBrief()
    }
  }, [apiState])

  return { apiState }
}

export type { ApiState }
