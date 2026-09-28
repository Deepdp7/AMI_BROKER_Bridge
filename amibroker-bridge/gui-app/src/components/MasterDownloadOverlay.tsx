import { useEffect, useState, useRef } from 'react'
import { api, wsManager } from '../api/apiClient'
import { useAppStore } from '../store/appStore'
import { CheckCircle, AlertCircle } from 'lucide-react'

export function MasterDownloadOverlay() {
  const { brokers } = useAppStore()
  
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('Checking master contracts...')
  const [status, setStatus] = useState<'checking' | 'downloading' | 'complete' | 'error'>('checking')
  
  const syncingRef = useRef<Set<string>>(new Set())
  const checkedBrokersRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const connectedBrokers = brokers.filter(b => b.status === 'connected')
    if (connectedBrokers.length === 0) return

    const syncBrokers = async () => {
      for (const b of connectedBrokers) {
        if (checkedBrokersRef.current.has(b.id) || syncingRef.current.has(b.id)) continue
        checkedBrokersRef.current.add(b.id)

        try {
          const res = await api.getMasterStatus(b.id)
          if (!res.isDownloadedToday && !res.isDownloading) {
            syncingRef.current.add(b.id)
            setIsVisible(true)
            setStatus('downloading')
            setText(`Syncing ${b.label || b.brokerType} symbols...`)
            await api.syncMaster(b.id)
          }
        } catch (err) {
          console.error('Failed to sync master for', b.id, err)
          syncingRef.current.delete(b.id)
        }
      }
    }

    syncBrokers()
  }, [brokers])

  useEffect(() => {
    const ws = wsManager.ws
    if (!ws) return

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (data.event === 'master_sync_progress') {
          setIsVisible(true)
          setStatus('downloading')
          setProgress(data.progress || 0)
          setText(data.text || 'Syncing...')
        } else if (data.event === 'master_sync_complete') {
          setProgress(100)
          setText(data.text || 'Symbols database up to date.')
          setStatus('complete')
          syncingRef.current.clear()
          setTimeout(() => setIsVisible(false), 2000)
        } else if (data.event === 'master_sync_error') {
          setStatus('error')
          setText(data.error || 'Contract sync failed.')
          syncingRef.current.clear()
          setTimeout(() => setIsVisible(false), 4000)
        }
      } catch (err) {}
    }

    ws.addEventListener('message', handleMessage)
    return () => ws.removeEventListener('message', handleMessage)
  }, [wsManager.ws])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col pointer-events-none transition-all duration-300">
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl p-4 w-80 relative overflow-hidden flex items-center gap-4">
        
        <div className="relative z-10 flex items-center justify-center shrink-0">
          {status === 'downloading' || status === 'checking' ? (
            <div className="relative w-10 h-10">
              <svg className="animate-spin w-full h-full text-blue-600/30" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="10" stroke="currentColor" />
              </svg>
              <svg className="absolute top-0 left-0 animate-spin w-full h-full text-blue-500" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="10" stroke="currentColor" strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
              </svg>
            </div>
          ) : status === 'complete' ? (
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle size={24} />
            </div>
          ) : (
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <AlertCircle size={24} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 truncate">
            {status === 'complete' ? 'Sync Complete' : status === 'error' ? 'Sync Failed' : 'Updating Master Symbols'}
          </h3>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {text}
          </p>
        </div>
        
      </div>
    </div>
  )
}
