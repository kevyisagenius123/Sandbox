import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CountyEditModal } from '../components/sandbox/CountyEditModal'
import { KeyboardShortcutsHelp } from '../components/sandbox/KeyboardShortcutsHelp'
import { useBackendSimulation } from '../hooks/useBackendSimulation'
import { SandboxThemeProvider } from '../design/SandboxThemeProvider'
import type { CountyResult, CountySimulationState, ReportingConfig, ExitPoll } from '../types/sandbox'
import { SandboxStudioLayout } from '../layouts/SandboxStudioLayout'
import { SandboxStudioHeader } from '../components/sandbox/studio/SandboxStudioHeader'
import { SandboxStudioSidebar } from '../components/sandbox/studio/SandboxStudioSidebar'
import { SandboxStudioMain } from '../components/sandbox/studio/SandboxStudioMain'
import { SandboxStudioFooter } from '../components/sandbox/studio/SandboxStudioFooter'
import type { SimulationStatus } from '../components/sandbox/studio/types'

const STATUS_CLASS: Record<SimulationStatus | 'default', string> = {
  idle: 'bg-gray-500',
  uploading: 'bg-blue-500',
  ready: 'bg-yellow-500',
  running: 'bg-green-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-emerald-500',
  error: 'bg-red-500',
  default: 'bg-gray-500'
}

const STATUS_LABEL: Record<SimulationStatus | 'default', string> = {
  idle: 'Idle',
  uploading: 'Uploading…',
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  error: 'Error',
  default: 'Idle'
}

const SandboxStudioPageContent: React.FC = () => {
  const [scenarioName, setScenarioName] = useState('State Sandbox Scenario')
  const [countyResults, setCountyResults] = useState<CountyResult[]>([])
  const [rawCountyCsv, setRawCountyCsv] = useState('')
  const [reportingConfig, setReportingConfig] = useState<ReportingConfig | undefined>()
  const [exitPolls, setExitPolls] = useState<ExitPoll | null>(null)

  const [selectedCounty, setSelectedCounty] = useState<CountyResult | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [editedCounties, setEditedCounties] = useState<Set<string>>(new Set())
  const [mapMode, setMapMode] = useState<'3D' | '2D'>('3D')

  const {
    countyStates,
    currentTimeSeconds,
    error,
    isPlaying,
    newsroomEvents,
    playback,
    pauseSimulation,
    progress,
    resumeSimulation,
    setSpeed,
    speed,
    startSimulation,
    status,
    stopSimulation
  } = useBackendSimulation({
    csvData: rawCountyCsv,
    scenarioName,
    reportingConfig
  })

  const simulationStatus = status as SimulationStatus
  const isScenarioLoaded = countyResults.length > 0 && rawCountyCsv.length > 0
  const isFullscreenMode = isScenarioLoaded && isPlaying
  const timelineDurationSeconds = playback.totalDurationSeconds > 0 ? playback.totalDurationSeconds : TOTAL_SECONDS
  const timelinePercent = timelineDurationSeconds > 0
    ? Math.min(100, Math.max(0, (currentTimeSeconds / timelineDurationSeconds) * 100))
    : progress
  const isPlaybackReady = playback.isReady
  
  // Log timeline info for debugging
  useEffect(() => {
    if (playback.totalDurationSeconds > 0) {
      console.log('[SandboxStudio] Timeline duration:', {
        fromPlayback: playback.totalDurationSeconds,
        fallback: TOTAL_SECONDS,
        using: timelineDurationSeconds,
        isReady: isPlaybackReady
      })
    }
  }, [playback.totalDurationSeconds, timelineDurationSeconds, isPlaybackReady])
  const countyByFips = useMemo(() => {
    const map = new Map<string, CountyResult>()
    countyResults.forEach((county) => {
      map.set(county.fips.padStart(5, '0'), county)
    })
    return map
  }, [countyResults])

  const handleCountyClick = useCallback((fips: string) => {
    const county = countyByFips.get(fips.padStart(5, '0'))
    if (!county) return

    setSelectedCounty(county)
    setIsEditModalOpen(true)
  }, [countyByFips])

  const handleCountySave = useCallback((fips: string, updates: Partial<CountyResult>) => {
    setCountyResults((previous) => previous.map((county) => {
      if (county.fips.padStart(5, '0') !== fips.padStart(5, '0')) {
        return county
      }

      const merged: CountyResult = {
        ...county,
        ...updates
      }

      if (updates.totalVotes == null) {
        const demVotes = updates.demVotes ?? county.demVotes
        const gopVotes = updates.gopVotes ?? county.gopVotes
        const otherVotes = updates.otherVotes ?? county.otherVotes
        merged.totalVotes = demVotes + gopVotes + otherVotes
      }

      return merged
    }))

    setEditedCounties((previous) => {
      const next = new Set(previous)
      next.add(fips.padStart(5, '0'))
      return next
    })
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable
      if (isTyping) return

      if ((event.key === ' ' || event.key === 'Spacebar') && isScenarioLoaded) {
        event.preventDefault()
        if (simulationStatus === 'running') {
          void pauseSimulation()
        } else if (simulationStatus === 'paused') {
          void resumeSimulation()
        } else if (simulationStatus === 'ready' || simulationStatus === 'completed' || simulationStatus === 'idle') {
          void startSimulation()
        }
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        setAnalyticsOpen((previous) => !previous)
      }

      if (event.key === '?') {
        event.preventDefault()
        setShowKeyboardHelp(true)
      }

      if (event.key === 'Escape') {
        if (isEditModalOpen) {
          setIsEditModalOpen(false)
          setSelectedCounty(null)
        }
        if (analyticsOpen) {
          setAnalyticsOpen(false)
        }
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false)
        }
      }

      if (event.key >= '1' && event.key <= '5' && isScenarioLoaded) {
        event.preventDefault()
        const presets = [1, 2, 5, 10, 20]
        const preset = presets[Number(event.key) - 1]
        if (preset) {
          void setSpeed(preset)
        }
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [analyticsOpen, isEditModalOpen, isScenarioLoaded, pauseSimulation, resumeSimulation, setSpeed, showKeyboardHelp, startSimulation, simulationStatus])

  const statusClass = STATUS_CLASS[simulationStatus] ?? STATUS_CLASS.default
  const statusLabel = STATUS_LABEL[simulationStatus] ?? STATUS_LABEL.default

  const handlePlay = useCallback(() => {
    if (!isScenarioLoaded) return
    if (simulationStatus === 'paused') {
      void resumeSimulation()
    } else if (simulationStatus !== 'running') {
      void startSimulation()
    }
  }, [isScenarioLoaded, resumeSimulation, simulationStatus, startSimulation])

  const handlePause = useCallback(() => {
    if (simulationStatus === 'running') {
      void pauseSimulation()
    }
  }, [pauseSimulation, simulationStatus])

  const handleExitFullscreen = useCallback(() => {
    if (!isScenarioLoaded) return
    if (simulationStatus === 'running') {
      void pauseSimulation()
    }
  }, [isScenarioLoaded, pauseSimulation, simulationStatus])

  const handleReset = useCallback(() => {
    void stopSimulation()
  }, [stopSimulation])

  const handleSpeedChange = useCallback((value: number) => {
    void setSpeed(value)
  }, [setSpeed])

  const handleJumpTo = useCallback((seconds: number) => {
    if (!playback.isReady) return
    playback.seekToSeconds(seconds)
  }, [playback])

  const handleTimelineScrub = useCallback((percent: number) => {
    if (!playback.isReady) return
    playback.seekToPercent(percent)
  }, [playback])

  const sidebarNode = !isFullscreenMode ? (
    <SandboxStudioSidebar
      scenarioName={scenarioName}
      isFullscreenMode={isFullscreenMode}
      isScenarioLoaded={isScenarioLoaded}
      showWelcome={showWelcome}
      onDismissWelcome={() => setShowWelcome(false)}
      exitPolls={exitPolls}
      onExitPollsLoaded={setExitPolls}
      onCountyDataLoaded={(data, rawCsv) => {
        setCountyResults(data)
        setRawCountyCsv(rawCsv)
        setEditedCounties(new Set())
        setShowWelcome(false)
      }}
      onReportingConfigLoaded={setReportingConfig}
      reportingConfig={reportingConfig}
      isPlaying={isPlaying}
      speed={speed}
      currentTimeSeconds={currentTimeSeconds}
      progress={progress}
      timelinePercent={timelinePercent}
      status={simulationStatus}
      onPlay={handlePlay}
      onPause={handlePause}
      onReset={handleReset}
      onSpeedChange={handleSpeedChange}
      onJumpTo={handleJumpTo}
      totalDurationSeconds={timelineDurationSeconds}
      countyResults={countyResults}
      countyStates={countyStates}
      analyticsOpen={analyticsOpen}
      toggleAnalytics={() => setAnalyticsOpen((previous) => !previous)}
    />
  ) : null

  const mainNode = (
    <SandboxStudioMain
      isScenarioLoaded={isScenarioLoaded}
      showWelcome={showWelcome}
      onHideWelcome={() => setShowWelcome(false)}
      countyResults={countyResults}
      countyStates={countyStates}
      editedCounties={editedCounties}
      onCountyClick={handleCountyClick}
      progress={progress}
      currentTimeSeconds={currentTimeSeconds}
      isPlaying={isPlaying}
      status={simulationStatus}
      isFullscreenMode={isFullscreenMode}
      onPause={handlePause}
      onExitFullscreen={handleExitFullscreen}
      mapMode={mapMode}
      onMapModeChange={setMapMode}
      newsroomEvents={newsroomEvents}
    />
  )

  const footerNode = !isFullscreenMode ? (
    <SandboxStudioFooter
      isScenarioLoaded={isScenarioLoaded}
      countyCount={countyResults.length}
      isPlaying={isPlaying}
      speed={speed}
      progress={progress}
      timelinePercent={timelinePercent}
      currentTimeSeconds={currentTimeSeconds}
      countyStates={countyStates}
      countyResults={countyResults}
      totalDurationSeconds={timelineDurationSeconds}
      isPlaybackReady={isPlaybackReady}
      onTimelineScrub={isPlaybackReady ? handleTimelineScrub : undefined}
      onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
      newsroomEvents={newsroomEvents}
    />
  ) : null

  const modalsNode = (
    <>
      <CountyEditModal
        county={selectedCounty}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedCounty(null)
        }}
        onSave={handleCountySave}
      />

      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </>
  )

  return (
    <SandboxStudioLayout
      header={(
        <SandboxStudioHeader
          scenarioName={scenarioName}
          onScenarioNameChange={setScenarioName}
          showWelcome={showWelcome}
          onToggleWelcome={() => setShowWelcome((previous) => !previous)}
          statusClass={statusClass}
          statusLabel={statusLabel}
          error={error}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
        />
      )}
      sidebar={sidebarNode}
      main={mainNode}
      footer={footerNode}
      modals={modalsNode}
      isSidebarVisible={!isFullscreenMode}
    />
  )
}



type MainPanelProps = {
  isScenarioLoaded: boolean
  showWelcome: boolean
  onHideWelcome: () => void
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  editedCounties: Set<string>
  onCountyClick: (fips: string) => void
  progress: number
  currentTimeSeconds: number
  isPlaying: boolean
  status: SimulationStatus
  isFullscreenMode: boolean
  onPause: () => void
  onExitFullscreen: () => void
  mapMode: '3D' | '2D'
  newsroomEvents: NewsroomEvent[]
}

const MainPanel: React.FC<MainPanelProps> = ({
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
  newsroomEvents
}) => {
  const { theme } = useSandboxTheme()
  const containerClasses = isFullscreenMode
    ? 'fixed inset-0 z-30 flex-1 overflow-hidden px-0 py-0'
    : 'relative flex-1 overflow-hidden px-4 py-6 sm:px-6'

  const innerWrapperClasses = isFullscreenMode
    ? 'flex h-full w-full flex-col gap-4 px-6 py-6'
    : 'mx-auto flex h-full max-w-7xl flex-col gap-6'

  const mapContainerClasses = isFullscreenMode
    ? 'relative flex-1 overflow-hidden rounded-none border'
    : 'relative flex-1 overflow-hidden rounded-3xl border'

  return (
    <main
      className={containerClasses}
      style={isFullscreenMode ? theme.surfaces.mainFullscreen : theme.surfaces.main}
    >
      <div className={innerWrapperClasses}>
        {!isFullscreenMode && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>Geospatial Simulation Canvas</h2>
              <p className="text-sm" style={{ color: theme.palette.text.secondary }}>
                {isScenarioLoaded
                  ? mapMode === '3D'
                    ? 'Live 3D county choropleth with Deck.gl rendering.'
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
          style={isFullscreenMode ? theme.surfaces.mapFullscreen : theme.surfaces.map}
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
          {mapMode === '3D' ? (
            <SandboxMap3D
              countyResults={countyResults}
              countyStates={countyStates}
              onCountyClick={onCountyClick}
              editedCounties={editedCounties}
            />
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
            <EmptyStateOverlay onDismiss={onHideWelcome} />
          )}

          {showWelcome && isScenarioLoaded && (
            <WelcomeOverlay onDismiss={onHideWelcome} />
          )}
        </div>
      </div>
    </main>
  )
}

type PageFooterProps = {
  isScenarioLoaded: boolean
  countyCount: number
  isPlaying: boolean
  speed: number
  progress: number
  timelinePercent: number
  currentTimeSeconds: number
  countyStates: Map<string, CountySimulationState>
  countyResults: CountyResult[]
  totalDurationSeconds: number
  isPlaybackReady: boolean
  onTimelineScrub?: (percent: number) => void
  onShowKeyboardHelp: () => void
}

const PageFooter: React.FC<PageFooterProps> = ({
  isScenarioLoaded,
  countyCount,
  isPlaying,
  speed,
  progress,
  timelinePercent,
  currentTimeSeconds,
  countyStates,
  countyResults,
  totalDurationSeconds,
  isPlaybackReady,
  onTimelineScrub,
  onShowKeyboardHelp
}) => {
  const { theme } = useSandboxTheme()
  return (
    <footer
      className="border-t"
      style={{
        background: theme.surfaces.footer.background,
        borderColor: theme.surfaces.footer.borderColor,
        boxShadow: theme.surfaces.footer.boxShadow
      }}
    >
      <div
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs"
        style={{ color: theme.palette.text.muted }}
      >
        <span>{isScenarioLoaded ? `${countyCount.toLocaleString()} counties loaded` : 'Awaiting scenario upload'}</span>
        <div className="flex items-center gap-4">
          <span>{isPlaying ? 'Live playback' : 'Paused'} | {speed.toFixed(1)}x</span>
          <button
            type="button"
            onClick={onShowKeyboardHelp}
            className="rounded border px-3 py-1 text-xs font-medium transition"
            style={{
              borderColor: theme.surfaces.footer.borderColor,
              color: theme.palette.text.primary,
              background: 'rgba(255,255,255,0.04)'
            }}
          >
            Keyboard Shortcuts
          </button>
        </div>
      </div>
      <BottomAnalyticsDock
        timelinePercent={timelinePercent}
        reportingPercent={progress}
        currentTimeSeconds={currentTimeSeconds}
        totalDuration={totalDurationSeconds}
        countyStates={countyStates}
        isPlaying={isPlaying}
        countyResults={countyResults}
        isScrubEnabled={isPlaybackReady}
        onScrub={onTimelineScrub}
      />
    </footer>
  )
}

type WelcomeCardProps = {
  isScenarioLoaded: boolean
  onDismiss: () => void
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ isScenarioLoaded, onDismiss }) => (
  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 px-5 py-4 text-sm text-blue-100 shadow">
    <p className="font-semibold text-blue-200">Welcome to the Sandbox Studio</p>
    <p className="mt-2 text-xs text-blue-100/80">
      {isScenarioLoaded ? 'Feel free to reopen this guide anytime from the header.' : 'Start by uploading a county-level CSV. Optional exit polls and reporting JSON unlock deeper analytics.'}
    </p>
    <button
      type="button"
      onClick={onDismiss}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
    >
      Got it
    </button>
  </div>
)

type ExitPollSummaryProps = {
  exitPolls: ExitPoll
}

const ExitPollSummary: React.FC<ExitPollSummaryProps> = ({ exitPolls }) => {
  const segments = Object.entries(exitPolls.demographics ?? {})
    .filter(([, value]) => value && Object.keys(value).length > 0)
    .map(([key]) => key)

  return (
    <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs text-purple-100">
      <div className="flex items-center justify-between text-sm font-semibold text-purple-200">
  <span>{exitPolls.state || 'Statewide'} | {exitPolls.year}</span>
        <span className="text-purple-300">{segments.length} cohorts</span>
      </div>
      <p className="mt-1 text-[11px] text-purple-100/80">
        {segments.length > 0 ? `Loaded breakdowns: ${segments.join(', ')}` : 'No demographic breakdowns detected.'}
      </p>
    </div>
  )
}

type StatusHintProps = {
  status: SimulationStatus
}

const StatusHint: React.FC<StatusHintProps> = ({ status }) => (
  <div className="rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-xs text-gray-400">
    {status === 'idle' && 'Press play once data is uploaded to begin generating frames from the backend.'}
    {status === 'ready' && 'Scenario is ready. Start playback to open the live websocket feed.'}
    {status === 'running' && 'Simulation is streaming. Adjust speed or edit counties to test outcomes.'}
    {status === 'paused' && 'Paused. Resume or reset to regenerate the timeline.'}
    {status === 'completed' && 'Simulation reached 100% reporting. Reset to iterate on a new run.'}
    {status === 'uploading' && 'Uploading scenario assets to backend. Large CSVs may take a moment.'}
    {status === 'error' && 'An error occurred. Check backend logs or retry uploading the data.'}
  </div>
)

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
}

const EmptyStateOverlay: React.FC<EmptyStateOverlayProps> = ({ onDismiss }) => (
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

// Format seconds into HH:MM:SS for status badges
const formatClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const SandboxStudioPage: React.FC = () => (
  <SandboxThemeProvider>
    <SandboxStudioPageContent />
  </SandboxThemeProvider>
)

export default SandboxStudioPage
