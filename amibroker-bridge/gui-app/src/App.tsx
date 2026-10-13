import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import { Sidebar } from './components/Sidebar'
import { FeedStatusPage } from './pages/FeedStatus'
import { BrokerConnectionPage } from './pages/BrokerConnection'
import { SymbolSetupPage } from './pages/SymbolSetup'
import { SettingsPage } from './pages/Settings'
import { LogsPage } from './pages/Logs'
import { ConsolePage } from './pages/Console'
import { AssistantPage } from './pages/Assistant'
import { AboutPage } from './pages/About'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { MasterDownloadOverlay } from './components/MasterDownloadOverlay'
import { useApiSync } from './hooks/useApiSync'
import { Wifi, WifiOff, Loader } from 'lucide-react'
import { useEffect } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/feed-status': 'Feed Status',
  '/broker-connection': 'Broker Connection',
  '/symbol-setup': 'Symbol Setup',
  '/settings': 'Settings',
  '/logs': 'Logs & Diagnostics',
  '/console': 'Live Console',
  '/assistant': 'AI Assistant',
  '/about': 'About',
}

function ApiStatusBadge({ state }: { state: 'checking' | 'connected' | 'offline' }) {
  if (state === 'checking') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.68rem', color: '#f59e0b' }}>
      <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
      Connecting to API...
    </div>
  )
  if (state === 'connected') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.68rem', color: '#00d4aa' }}>
      <Wifi size={11} />
      API Live :7890
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.68rem', color: '#8b9199' }}>
      <WifiOff size={11} />
      API Offline — check :7890
    </div>
  )
}

function MainLayout() {
  const { apiState } = useApiSync()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'DataBridge Pro'

  // Update Zustand activePage for backward compatibility if needed
  const { setActivePage } = useAppStore()
  useEffect(() => {
    setActivePage(location.pathname.replace('/', '') || 'feed-status')
  }, [location.pathname, setActivePage])

  return (
    <div
      id="app-root"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#0e0e0e',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background: [
          'radial-gradient(ellipse 60% 40% at 20% 0%, rgba(0,212,170,0.07) 0%, transparent 70%)',
          'radial-gradient(ellipse 40% 60% at 80% 100%, rgba(47,47,47,0.5) 0%, transparent 70%)',
        ].join(', '),
      }} />

      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Sidebar />
      </div>

      <main
        id="main-content"
        style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          height: '40px',
          background: 'rgba(23,23,23,0.7)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '0.5rem',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '6px', marginRight: '0.5rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28ca41' }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#575d66', flex: 1 }}>
            DataBridge Pro · <span style={{ color: '#8b9199' }}>{title}</span>
          </div>
          <ApiStatusBadge state={apiState} />
        </div>

        <div
          id="route-container"
          style={{
            flex: 1, width: '100%', position: 'relative',
            overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <ErrorBoundary key={location.pathname} fallbackTitle={`Error in ${title}`}>
            <div className="animate-fade-in" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
              <Routes>
                <Route path="/feed-status" element={<FeedStatusPage />} />
                <Route path="/broker-connection" element={<BrokerConnectionPage />} />
                <Route path="/symbol-setup" element={<SymbolSetupPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/console" element={<ConsolePage />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<Navigate to="/feed-status" replace />} />
              </Routes>
            </div>
          </ErrorBoundary>
        </div>
      </main>

      <MasterDownloadOverlay />
      <ToastContainer />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function App() {
  return <MainLayout />
}

export default App
