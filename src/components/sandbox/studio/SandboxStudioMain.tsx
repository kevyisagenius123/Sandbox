import React, { lazy, Suspense, useCallback } from 'react'
import SandboxMap2D from '../../map/SandboxMap2D'
import { NewsroomMomentsPanel } from '../../sandbox/NewsroomMomentsPanel'
import { useSandboxTheme } from '../../../design/SandboxThemeProvider'
import { WebGLErrorBoundary } from '../../map/WebGLErrorBoundary'
import type { CountyGeoMetadata, CountyResult, CountySimulationState, NewsroomEvent } from '../../../types/sandbox'
import type { SimulationStatus } from './types'

// Lazy-load the 3D maps so the bundle only pulls them when needed
const StudioMap3D = lazy(() => import('../../studio/StudioMap3D'))
const SandboxMap3D = lazy(() => import('../../map/SandboxMap3D'))
const SandboxMapBabylon = lazy(() => import('../../map/SandboxMapBabylon'))

type SandboxStudioMainProps = {
  isScenarioLoaded: boolean
  showWelcome: boolean
  onHideWelcome: () => void
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  editedCounties: Set<string>
  onCountyClick: (fips: string, meta?: CountyGeoMetadata) => void
  progress: number
  currentTimeSeconds: number
  isPlaying: boolean
  status: SimulationStatus
  isFullscreenMode: boolean
  onPause: () => void
  onExitFullscreen: () => void
  mapMode: '3D' | '2D' | 'THREE' | 'BABYLON'
  onMapModeChange?: (mode: '3D' | '2D' | 'THREE' | 'BABYLON') => void
  newsroomEvents: NewsroomEvent[]
  variant?: 'classic' | 'workspace'
  scope?: 'ALL' | 'CUSTOM'
  customStates?: string[]
  onScopeChange?: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange?: (states: string[]) => void
  selectedStates?: string[]
  onSelectedStatesChange?: (states: string[]) => void
}

export const SandboxStudioMain: React.FC<SandboxStudioMainProps> = ({
  isScenarioLoaded,
  showWelcome,
  onHideWelcome,
  countyResults,
  countyStates,
  editedCounties,
  onCountyClick,
  progress,
  currentTimeSeconds,
  isPlaying,
  status,
  isFullscreenMode,
  onPause,
  onExitFullscreen,
  mapMode,
  newsroomEvents,
  onMapModeChange,
  variant = 'classic',
  scope,
  customStates,
  onScopeChange,
  onCustomStatesChange,
  selectedStates,
  onSelectedStatesChange
}) => {
  const { theme } = useSandboxTheme()
  const isWorkspaceVariant = variant === 'workspace'

  const containerClasses = isWorkspaceVariant
    ? 'absolute inset-0 flex flex-col overflow-hidden px-0 py-0'
    : isFullscreenMode
      ? 'fixed inset-0 z-30 flex-1 overflow-hidden px-0 py-0'
      : 'relative flex-1 overflow-hidden px-4 py-6 sm:px-6'

  const innerWrapperClasses = isWorkspaceVariant
    ? 'flex h-full w-full flex-col'
    : isFullscreenMode
      ? 'flex h-full w-full flex-col gap-4 px-6 py-6'
      : 'mx-auto flex h-full max-w-7xl flex-col gap-6'

  const mapContainerClasses = isWorkspaceVariant
    ? 'relative flex-1 overflow-hidden'
    : isFullscreenMode
      ? 'relative flex-1 overflow-hidden rounded-none border'
      : 'relative flex-1 overflow-hidden rounded-3xl border'

  const handleWebglFailure = useCallback(() => {
    onMapModeChange?.('2D')
  }, [onMapModeChange])

  return (
    <main
      className={containerClasses}
      style={isWorkspaceVariant ? theme.surfaces.mapFullscreen : isFullscreenMode ? theme.surfaces.mainFullscreen : theme.surfaces.main}
    >
      <div className={innerWrapperClasses}>
        {!isWorkspaceVariant && !isFullscreenMode && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>Geospatial Simulation Canvas</h2>
              <p className="text-sm" style={{ color: theme.palette.text.secondary }}>
                {isScenarioLoaded
                  ? mapMode === '3D'
                    ? 'Live 3D county choropleth rendered with Deck.gl.'
                    : mapMode === 'THREE'
                      ? 'Full Three.js scene for advanced newsroom walk-throughs.'
                      : mapMode === 'BABYLON'
                        ? 'Immersive Babylon.js decision desk with stylized vote bars.'
                        : 'Lightweight 2D choropleth optimized for lower-spec machines.'
                  : 'Upload results to project the reporting timeline onto the map.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: theme.palette.text.muted }}>
              <span>
                Status:
                <strong className="ml-1" style={{ color: theme.palette.text.primary }}>{status.toUpperCase()}</strong>
              </span>
              <span>Progress: {progress.toFixed(1)}%</span>
              <span>Clock: {formatClock(currentTimeSeconds)}</span>
              <span>{isPlaying ? 'Playing' : 'Paused'}</span>
              {editedCounties.size > 0 && (
                <span
                  className="rounded-full border px-3 py-1 font-semibold"
                  style={{
                    borderColor: theme.palette.accent.warning,
                    background: 'rgba(250,204,21,0.18)',
                    color: theme.palette.accent.warning
                  }}
                >
                  {editedCounties.size} counties edited
                </span>
              )}
            </div>
          </div>
        )}

        <div
          className={mapContainerClasses}
          style={isWorkspaceVariant ? theme.surfaces.mapFullscreen : isFullscreenMode ? theme.surfaces.mapFullscreen : theme.surfaces.map}
        >
          {isFullscreenMode && (
            <div className="pointer-events-none absolute top-4 right-4 z-40 flex flex-col gap-2">
              <button
                type="button"
                onClick={onPause}
                className="pointer-events-auto rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow"
                style={{
                  background: theme.palette.accent.primary,
                  color: theme.palette.text.primary
                }}
              >
                Pause
              </button>
              <button
                type="button"
                onClick={onExitFullscreen}
                className="pointer-events-auto rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow"
                style={{
                  background: 'rgba(15,23,42,0.72)',
                  borderColor: theme.palette.text.muted,
                  color: theme.palette.text.primary
                }}
              >
                Exit Fullscreen
              </button>
            </div>
          )}
          {mapMode === 'THREE' ? (
            <WebGLErrorBoundary onError={handleWebglFailure}>
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading Three.js view…</div>}>
                <StudioMap3D
                  countyResults={countyResults}
                  countyStates={countyStates}
                  onCountyClick={onCountyClick}
                  editedCounties={editedCounties}
                  scope={scope}
                  customStates={customStates}
                  onScopeChange={onScopeChange}
                  onCustomStatesChange={onCustomStatesChange}
                  selectedStates={selectedStates}
                  onSelectedStatesChange={onSelectedStatesChange}
                />
              </Suspense>
            </WebGLErrorBoundary>
          ) : mapMode === '3D' ? (
            <WebGLErrorBoundary onError={handleWebglFailure}>
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading Deck.gl 3D view…</div>}>
                <SandboxMap3D
                  countyResults={countyResults}
                  countyStates={countyStates}
                  onCountyClick={onCountyClick}
                  editedCounties={editedCounties}
                  onWebGLFailure={handleWebglFailure}
                />
              </Suspense>
            </WebGLErrorBoundary>
          ) : mapMode === 'BABYLON' ? (
            <WebGLErrorBoundary onError={handleWebglFailure}>
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading Babylon.js studio…</div>}>
                <SandboxMapBabylon
                  countyResults={countyResults}
                  countyStates={countyStates}
                  onCountyClick={onCountyClick}
                  editedCounties={editedCounties}
                  selectedStates={selectedStates}
                  onStateSelect={(stateFips) => {
                    onSelectedStatesChange((previous) => {
                      if (previous.includes(stateFips)) {
                        return previous.filter((entry) => entry !== stateFips)
                      }
                      return [...previous, stateFips]
                    })
                  }}
                  opacity={1.0}
                  highQuality={true}
                />
              </Suspense>
            </WebGLErrorBoundary>
          ) : (
            <SandboxMap2D
              countyResults={countyResults}
              countyStates={countyStates}
              onCountyClick={onCountyClick}
              editedCounties={editedCounties}
            />
          )}

          <NewsroomMomentsPanel events={newsroomEvents} />

          {!isScenarioLoaded && showWelcome && (
            <EmptyStateOverlay onDismiss={onHideWelcome} variant={variant} />
          )}

          {showWelcome && isScenarioLoaded && !isWorkspaceVariant && (
            <WelcomeOverlay onDismiss={onHideWelcome} />
          )}
        </div>
      </div>
    </main>
  )
}

type WelcomeOverlayProps = {
  onDismiss: () => void
}

const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onDismiss }) => (
  <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-6">
    <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-4 text-sm text-gray-100 shadow-lg">
      <p className="font-semibold text-white">Sandbox tips</p>
      <ul className="mt-2 space-y-1 text-xs text-gray-300">
        <li>- Hover over counties to inspect live reporting shares.</li>
        <li>- Click a county to manually tweak vote totals.</li>
        <li>- Press A to toggle the analytics drawer or ? for shortcuts.</li>
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 inline-flex items-center rounded bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        Dismiss overlay
      </button>
    </div>
  </div>
)

type EmptyStateOverlayProps = {
  onDismiss: () => void
  variant: 'classic' | 'workspace'
}

const EmptyStateOverlay: React.FC<EmptyStateOverlayProps> = ({ onDismiss, variant }) => {
  if (variant === 'workspace') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85">
        <div className="pointer-events-auto max-w-lg space-y-4 rounded-2xl border border-slate-700/60 bg-slate-900/95 px-8 py-6 shadow-[0_20px_60px_rgba(2,6,23,0.75)] text-center">
          <h3 className="text-2xl font-semibold text-white">Load a scenario to begin</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Drag a county-level CSV into the Scenario Uploader panel (click the dock button at the top to open it). 
            Optionally include exit polls and reporting order JSON to unlock deeper analytics.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-blue-500/40 bg-blue-500/15 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-200 transition hover:bg-blue-500/25"
          >
            Hide overlay
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950/85 text-center text-gray-300">
      <h3 className="text-xl font-semibold text-white">No scenario loaded</h3>
      <p className="max-w-md text-sm text-gray-400">
        Upload a county-level results CSV in the left panel to spin up a new backend simulation. Optional exit polls and reporting configs can be added later.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded border border-blue-500/50 bg-blue-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
      >
        Hide message
      </button>
    </div>
  )
}

const formatClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default SandboxStudioMain
