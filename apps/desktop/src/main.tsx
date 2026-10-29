import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/index.css'
import App from './app/App.tsx'
import { installNativeFeel } from './lib/nativeFeel'
import { applyMotionPref, applyTheme } from './hooks/usePref'
import { restoreSnapshot } from './lib/startupSnapshot'

installNativeFeel()
applyMotionPref()
applyTheme() // before the first paint, so the chosen colours never flash the default
restoreSnapshot() // last session's symbols and prices: the window opens filled in

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
