import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SandboxLandingPage from './pages/SandboxLandingPage'
import SandboxStudioPage from './pages/SandboxStudioPage'
import SandboxPlayerPage from './pages/SandboxPlayerPage'
import SandboxStudioDesignPreviewPage from './pages/SandboxStudioDesignPreviewPage'
import LoginPage from './pages/LoginPage'
import MapTestPage from './pages/MapTestPage'
import VizrtGraphicsTestPage from './pages/VizrtGraphicsTestPage'
import BabylonElectionMapPage from './pages/BabylonElectionMapPage'
import BabylonCallPage from './pages/BabylonCallPage'
import BroadcastCallPage from './pages/BroadcastCallPage'
import { AnalyticsTestPage } from './pages/AnalyticsTestPage'
import { VotingPrototypePage } from './pages/VotingPrototypePage'
import { CountyMapTestPage } from './pages/CountyMapTestPage'
import SwingometerPage from './pages/SwingometerPage'
import SandboxUXTestPage from './pages/SandboxUXTestPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { SandboxThemeProvider } from './design/SandboxThemeProvider'
import './index.css'

if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_WEBGL_DEBUG === 'true') {
  void import('./utils/webglDebug')
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then(registrations => {
      registrations.forEach(registration => {
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL

        if (scriptUrl?.includes('MockGovSim') || scriptUrl?.includes('sw.js')) {
          registration.unregister().then(() => {
            window.location.reload()
          }).catch(() => {
            window.location.reload()
          })
        }
      })
    })
    .catch(() => {
      /* noop - service worker cleanup is best effort */
    })
}

const routerBase = import.meta.env.BASE_URL ?? '/'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <SandboxThemeProvider>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<SandboxLandingPage />} />
          
          {/* Map test page */}
          <Route path="/map-test" element={<MapTestPage />} />
          <Route path="/babylon-map" element={<BabylonElectionMapPage />} />
          <Route path="/babylon-call" element={<BabylonCallPage />} />
          <Route path="/swingometer" element={<SwingometerPage />} />

          {/* Vizrt graphics testbed */}
          <Route path="/vizrt-test" element={<VizrtGraphicsTestPage />} />
          <Route path="/broadcast/call" element={<BroadcastCallPage />} />
          <Route path="/analytics-test" element={<AnalyticsTestPage />} />
          <Route path="/voting-prototype" element={<VotingPrototypePage />} />
          <Route path="/county-map-test" element={<CountyMapTestPage />} />
          <Route path="/ux-test" element={<SandboxUXTestPage />} />
          
          {/* Authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected studio routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/studio" element={<SandboxStudioPage />} />
            <Route path="/studio/design" element={<SandboxStudioDesignPreviewPage />} />
          </Route>
          
          {/* Player - view simulation */}
          <Route path="/player/:scenarioId" element={<SandboxPlayerPage />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SandboxThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
