/**
 * DataBridge Pro — API Sync Hook
 * Connects the Zustand store to the real local API server.
 * Falls back to mock data if the API is unavailable.
 */
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { api, wsManager, isApiAvailable } from '../api/apiClient'
import { toast } from '../components/Toast'
import { setAssistantView } from '../pages/Assistant'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

type ApiState = 'checking' | 'connected' | 'offline'

let resyncing: Promise<void> | null = null
let wsOpenedBefore = false

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
      tasks.push(api.getSettings().then(settings => store.updateSettings(settings as any)).catch(() => {}))
      tasks.push(api.getLogs({ limit: 50 }).then(logs => logs.forEach(l => store.addLog(l as any))).catch(() => {}))
    }

    tasks.push(api.getBrokers().then(brokers => {
      if (Array.isArray(brokers)) useAppStore.setState({ brokers: brokers as any })
    }).catch(() => {}))

    // Symbols: the engine's list is authoritative (drops symbols deleted elsewhere, adds new ones)
    tasks.push(api.getFeedStatus().then(feedStatus => {
      const current = new Map(useAppStore.getState().symbols.map(s => [s.ticker, s]))
      const next = feedStatus.symbols.map((sym: any) => ({
        ...(current.get(sym.ticker) || {}),
        ticker: sym.ticker,
        exchange: sym.exchange,
        instrumentType: sym.instrumentType,
        lastPrice: sym.lastPrice,
        prevClose: sym.prevClose,
        lastTickUtcMs: sym.lastTickUtcMs,
        barsPerMin: sym.barsPerMin,
        internalLatencyMs: sym.internalLatencyMs,
        status: sym.status,
        change: sym.change,
        changePercent: sym.changePercent,
        volume: sym.volume,
      }))
      useAppStore.setState({ symbols: next as any })
      store.updateCoreStats(feedStatus.coreEngine as any)
    }).catch(() => {}))

    // Backfill: only downloads still in progress (finished ones would re-open an old notification);
    // entries already on screen are brought up to date
    tasks.push(api.getBackfillStatus().then(bfData => {
      if (!bfData || !Array.isArray(bfData.statuses)) return
      const shown = useAppStore.getState().backfillStatuses
      bfData.statuses.forEach((s: any) => {
        if (s.status === 'pending' || s.status === 'running' || shown[s.ticker]) store.updateBackfillStatus(s.ticker, s)
      })
    }).catch(() => {}))

    await Promise.all(tasks)
    resyncListeners.forEach(fn => { try { fn() } catch { /* ignore */ } })
  })().finally(() => { resyncing = null })
  return resyncing
}

const resyncListeners = new Set<() => void>()

/**
 * Re-run `load` whenever the app resyncs with the engine (reconnect, window focus, every 60 s).
 * For page-level data that isn't pushed over the WebSocket.
 */
export function useEngineRefresh(load: () => void) {
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
  const {
    updateSymbolFeed, updateCoreStats, addLog,
    updateBrokerStatus, addSymbol, symbols,
    updateBackfillStatus, clearBackfillStatus,
    setMarketStatus,
  } = useAppStore()
  const initializedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      // The data engine starts alongside the UI (and restarts after crashes),
      // so keep polling until it answers instead of giving up after one try.
      while (!(await isApiAvailable())) {
        if (!mounted) return
        setApiState('offline')
        await new Promise(r => setTimeout(r, 2000))
      }
      if (!mounted) return

      setApiState('connected')
      toast.success('API Connected', 'Live data feed active on localhost:7890', 3000)

      await resyncFromEngine(true)

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
          }
        }))
        useAppStore.getState().batchUpdateSymbolFeeds(updates)
        pendingUpdates.clear()
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
      // Compute initial market status immediately from the IST clock
      // (no need to wait 60s for the server to broadcast)
      const now = new Date()
      const istMs = now.getTime() + 5.5 * 3600 * 1000
      const ist = new Date(istMs)
      const day = ist.getUTCDay()
      const totalMin = ist.getUTCHours() * 60 + ist.getUTCMinutes()
      const open = day !== 0 && day !== 6 && totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30
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
      // Update store for the banner
      updateBackfillStatus(payload.ticker, payload)
    })

    const offBackfillCompleted = wsManager.on('backfill_completed', async (payload: any) => {
      if (payload?.ticker) {
        // Update store to show completed
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
      offMarketStatus?.()
      offBackfillFailed?.()
      offResyncTriggers()
      offBrief()
    }
  }, [apiState])

  return { apiState }
}

export type { ApiState }
