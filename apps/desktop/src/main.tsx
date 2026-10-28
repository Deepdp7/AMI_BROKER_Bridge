import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/index.css'
import App from './app/App.tsx'
import { installNativeFeel } from './lib/nativeFeel'
import { applyMotionPref, applyTheme } from './hooks/usePref'

installNativeFeel()
applyMotionPref()
applyTheme() // before the first paint, so the chosen colours never flash the default

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
