/**
 * DataBridge Pro — API Sync Hook
 * Connects the Zustand store to the real local API server.
 * Falls back to mock data if the API is unavailable.
 */
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { api, wsManager, isApiAvailable } from '../api/apiClient'
import { toast } from '../components/Toast'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

type ApiState = 'checking' | 'connected' | 'offline'

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
      const available = await isApiAvailable()
      if (!mounted) return

      if (!available) {
        setApiState('offline')
        return
      }

      setApiState('connected')
      toast.success('API Connected', 'Live data feed active on localhost:7890', 3000)

      // Load initial settings
      try {
        const settings = await api.getSettings()
        useAppStore.getState().updateSettings(settings as any)
      } catch { /* keep defaults */ }

      // Load initial brokers
      try {
        const brokers = await api.getBrokers()
        if (Array.isArray(brokers)) {
          useAppStore.setState({ brokers: brokers as any })
        }
      } catch { /* keep defaults */ }

      // Load initial feed status
      try {
        const feedStatus = await api.getFeedStatus()
        feedStatus.symbols.forEach(sym => {
          // Add symbol if not already in store
          if (!useAppStore.getState().symbols.find(s => s.ticker === sym.ticker)) {
            addSymbol({
              ticker: sym.ticker,
              exchange: sym.exchange as any,
              instrumentType: sym.instrumentType as any,
              lastPrice: sym.lastPrice,
              prevClose: sym.prevClose,
              lastTickUtcMs: sym.lastTickUtcMs,
              barsPerMin: sym.barsPerMin,
              internalLatencyMs: sym.internalLatencyMs,
              status: sym.status as any,
              change: sym.change,
              changePercent: sym.changePercent,
              volume: sym.volume,
            })
          } else {
            updateSymbolFeed(sym.ticker, sym as any)
          }
        })
        updateCoreStats(feedStatus.coreEngine as any)
      } catch { /* keep mock */ }

      // Load initial logs (last 50)
      try {
        const logs = await api.getLogs({ limit: 50 })
        logs.forEach(l => addLog(l as any))
      } catch { /* keep mock */ }

      // Load initial backfill statuses
      try {
        const bfData = await api.getBackfillStatus()
        if (bfData && Array.isArray(bfData.statuses)) {
          bfData.statuses.forEach((s: any) => updateBackfillStatus(s.ticker, s))
        }
      } catch { /* keep mock */ }

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
        // We no longer clear from banner after 10 seconds to keep overall total intact
        if (await ensureNotificationPermission()) {
          sendNotification({
            title: 'Plugin status',
            body: `DataBridge Pro | Backfill Complete: ${payload.ticker} (${(payload.candlesFetched || 0).toLocaleString()} candles)`
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
    }
  }, [apiState])

  return { apiState }
}

export type { ApiState }
