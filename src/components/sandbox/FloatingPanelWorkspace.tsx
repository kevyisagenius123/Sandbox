import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BottomAnalyticsDock } from './BottomAnalyticsDock'
import { SandboxStudioMain } from './studio/SandboxStudioMain'
import IntegratedStudioHeader from './studio/IntegratedStudioHeader.tsx'
import { ScenarioUploaderPanel } from './panels/ScenarioUploaderPanel'
import { SimulationControlsPanel } from './panels/SimulationControlsPanel'
import { AnalyticsDockPanel } from './panels/AnalyticsDockPanel'
import { ReportingConfigPanel } from './panels/ReportingConfigPanel'
import { DemographicsPanel } from './panels/DemographicsPanel'
import { CountyEditorPanel } from './panels/CountyEditorPanel'
import { StateSelectionPanel } from './panels/StateSelectionPanel'
import type {
  CountyGeoMetadata,
  CountyResult,
  CountySimulationState,
  ExitPoll,
  ReportingConfig,
  NewsroomEvent
} from '../../types/sandbox'
import type { SimulationStatus } from './studio/types'

// Regional preset logic now lives inside StateSelectionPanel

type PanelSize = {
  width: number
  height: number
}

type PanelId =
  | 'uploader'
  | 'controls'
  | 'analytics'
  | 'reporting'
  | 'demographics'
  | 'countyEdit'
  | 'stateSelection'

type PanelInstance = PanelSize & {
  id: PanelId
  x: number
  y: number
  zIndex: number
  minimized: boolean
}

type PanelDefinition = {
  title: string
  subtitle?: string
  render: () => React.ReactNode
  defaultSize: PanelSize
  minSize?: PanelSize
  expandedSize?: PanelSize
}

export type FloatingPanelWorkspaceProps = {
  scenarioName: string
  isScenarioLoaded: boolean
  showWelcome: boolean
  onDismissWelcome: () => void
  exitPolls: ExitPoll | null
  onExitPollsLoaded: (polls: ExitPoll) => void
  onCountyDataLoaded: (data: CountyResult[], rawCsv: string) => void
  onReportingConfigLoaded: (config: ReportingConfig) => void
  reportingConfig: ReportingConfig | undefined
  isPlaying: boolean
  speed: number
  currentTimeSeconds: number
  progress: number
  timelinePercent: number
  status: SimulationStatus
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (value: number) => void
  onJumpTo: (seconds: number) => void
  totalDurationSeconds: number
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  demographicData?: Map<string, any>
  nationalMargin?: number
  reportingStats: {
    countiesReporting: number
    countiesTotal: number
    resolvedTotalFrames: number
    dynamicFrameTimeline: boolean
  }
  analyticsOpen: boolean
  toggleAnalytics: () => void
  onCountyClick: (fips: string, meta?: CountyGeoMetadata) => void
  editedCounties: Set<string>
  onHideWelcome: () => void
  onExitFullscreen: () => void
  mapMode: '3D' | '2D' | 'THREE' | 'BABYLON'
  is3DAvailable: boolean
  newsroomEvents: NewsroomEvent[]
  error: string | null
  statusClass: string
  statusLabel: string
  onScenarioNameChange: (name: string) => void
  onToggleWelcome: () => void
  onMapModeChange: (mode: '3D' | '2D' | 'THREE' | 'BABYLON') => void
  onShowKeyboardHelp: () => void
  selectedCounty: CountyResult | null
  onCountySave: (fips: string, updates: Partial<CountyResult>) => void
  onCountyEditClose: () => void
  scope: 'ALL' | 'CUSTOM'
  customStates: string[]
  onScopeChange: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange: (states: string[]) => void
  selectedStates: string[]
  onSelectedStatesChange: (states: string[]) => void
}

const clampPositionValue = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (!Number.isFinite(max) || max <= 0) return value
  return Math.min(value, max)
}

const clampPanelPosition = (x: number, y: number, width: number, height: number): { x: number; y: number } => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width + x
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height + y
  const maxX = viewportWidth - width - 24
  const maxY = viewportHeight - height - 24
  return {
    x: clampPositionValue(x, maxX),
    y: clampPositionValue(y, maxY)
  }
}

const clampPanelSize = (
  id: PanelId,
  definitions: Record<PanelId, PanelDefinition>,
  x: number,
  y: number,
  width: number,
  height: number
): { width: number; height: number } => {
  const definition = definitions[id]
  const minWidth = definition.minSize?.width ?? definition.defaultSize.width
  const minHeight = definition.minSize?.height ?? definition.defaultSize.height
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width + x
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height + y
  const maxWidth = viewportWidth - x - 24
  const maxHeight = viewportHeight - y - 24
  return {
    width: Math.min(Math.max(width, minWidth), Math.max(maxWidth, minWidth)),
    height: Math.min(Math.max(height, minHeight), Math.max(maxHeight, minHeight))
  }
}

const formatTimecode = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }
  const clamped = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

type FloatingPanelProps = {
  instance: PanelInstance
  definition: PanelDefinition
  isActive: boolean
  onMove: (id: PanelId, x: number, y: number) => void
  onResize: (id: PanelId, width: number, height: number) => void
  onFocus: (id: PanelId) => void
  onToggleMinimize: (id: PanelId) => void
  onToggleExpand: (id: PanelId) => void
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  instance,
  definition,
  isActive,
  onMove,
  onResize,
  onFocus,
  onToggleMinimize,
  onToggleExpand
}) => {
  const { id, x, y, width, height, zIndex, minimized } = instance
  const expandedSize = definition.expandedSize
  const isExpanded = expandedSize
    ? Math.abs(width - expandedSize.width) < 16 && Math.abs(height - expandedSize.height) < 16
    : false

  const startPointerSession = useCallback(
    (event: React.PointerEvent, cursor: string, handleMove: (moveEvent: PointerEvent) => void) => {
      event.preventDefault()
      event.stopPropagation()
      document.body.style.userSelect = 'none'
      document.body.style.cursor = cursor

      const handlePointerUp = () => {
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    []
  )

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onFocus(id)
      const startX = event.clientX
      const startY = event.clientY
      const initialX = x
      const initialY = y

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY
        onMove(id, initialX + deltaX, initialY + deltaY)
      }

      startPointerSession(event, 'grabbing', onPointerMove)
    },
    [id, onFocus, onMove, startPointerSession, x, y]
  )

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onFocus(id)
      const startX = event.clientX
      const startY = event.clientY
      const initialWidth = width
      const initialHeight = height

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY
        onResize(id, initialWidth + deltaX, initialHeight + deltaY)
      }

      startPointerSession(event, 'se-resize', onPointerMove)
    },
    [height, id, onFocus, onResize, startPointerSession, width]
  )

  if (minimized) {
    return null
  }

  return (
    <section
      style={{ left: x, top: y, width, height, zIndex }}
      className={`pointer-events-auto absolute flex flex-col rounded-2xl border border-slate-800/70 bg-slate-950/85 backdrop-blur-md shadow-[0_26px_55px_rgba(8,15,35,0.55)] transition-all ${
        isActive ? 'ring-2 ring-sky-400/40' : 'ring-1 ring-slate-900'
      }`}
      onPointerDown={() => onFocus(id)}
    >
      <header
        className="flex cursor-grab items-center justify-between rounded-t-2xl border-b border-slate-800/80 bg-slate-900/90 px-4 py-3 text-[11px] text-slate-400"
        onPointerDown={handleDragStart}
        onDoubleClick={() => {
          if (definition.expandedSize) onToggleExpand(id)
        }}
      >
        <div>
          <p className="text-sm font-semibold text-slate-100 tracking-wide">{definition.title}</p>
          {definition.subtitle && <p className="text-[11px] text-slate-400/80">{definition.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {definition.expandedSize && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpand(id)
              }}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200 transition hover:bg-slate-700"
            >
              {isExpanded ? 'Reduce' : 'Expand'}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleMinimize(id)
            }}
            className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200 transition hover:bg-slate-700"
          >
            {minimized ? 'Restore' : 'Dock'}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-4 text-sm text-slate-200/90">{definition.render()}</div>
      {!minimized && (
        <div
          className="absolute bottom-2 right-2 h-4 w-4 cursor-se-resize"
          onPointerDown={handleResizeStart}
        ></div>
      )}
    </section>
  )
}

export const FloatingPanelWorkspace: React.FC<FloatingPanelWorkspaceProps> = ({
  scenarioName,
  isScenarioLoaded,
  showWelcome,
  onDismissWelcome,
  exitPolls,
  onExitPollsLoaded,
  onCountyDataLoaded,
  onReportingConfigLoaded,
  reportingConfig,
  isPlaying,
  speed,
  currentTimeSeconds,
  progress,
  timelinePercent,
  status,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onJumpTo,
  totalDurationSeconds,
  countyResults,
  countyStates,
  demographicData,
  nationalMargin,
  reportingStats,
  analyticsOpen,
  toggleAnalytics,
  onCountyClick,
  editedCounties,
  onHideWelcome,
  onExitFullscreen,
  mapMode,
  is3DAvailable,
  newsroomEvents,
  error,
  statusClass,
  statusLabel,
  onScenarioNameChange,
  onToggleWelcome,
  onMapModeChange,
  onShowKeyboardHelp,
  selectedCounty,
  onCountySave,
  onCountyEditClose,
  scope,
  customStates,
  onScopeChange,
  onCustomStatesChange,
  selectedStates,
  onSelectedStatesChange
}) => {
  const panelDefinitions = useMemo<Record<PanelId, PanelDefinition>>(() => {
    return {
      uploader: {
        title: 'Scenario Uploader',
        subtitle: 'Upload CSV, exit polls, and reporting config',
        render: () => (
          <ScenarioUploaderPanel
            showWelcome={showWelcome}
            onDismissWelcome={onDismissWelcome}
            exitPolls={exitPolls}
            onCountyDataLoaded={onCountyDataLoaded}
            onExitPollsLoaded={onExitPollsLoaded}
            onReportingConfigLoaded={onReportingConfigLoaded}
          />
        ),
        defaultSize: { width: 400, height: 480 },
        minSize: { width: 340, height: 380 },
        expandedSize: { width: 480, height: 560 }
      },
      controls: {
        title: 'Simulation Controls',
        subtitle: 'Timeline playback, speed, and frame scrub',
        render: () => (
          <SimulationControlsPanel
            isPlaying={isPlaying}
            speed={speed}
            currentTimeSeconds={currentTimeSeconds}
            timelinePercent={timelinePercent}
            reportingPercent={progress}
            totalDurationSeconds={totalDurationSeconds}
            onPlay={onPlay}
            onPause={onPause}
            onReset={onReset}
            onSpeedChange={onSpeedChange}
            onJumpTo={onJumpTo}
          />
        ),
        defaultSize: { width: 480, height: 320 },
        minSize: { width: 400, height: 280 },
        expandedSize: { width: 560, height: 360 }
      },
      analytics: {
        title: 'Analytics Dock',
        subtitle: 'Monitor live totals, exports, and turnout',
        render: () => (
          <AnalyticsDockPanel
            countyResults={countyResults}
            countyStates={countyStates}
            currentTimeSeconds={currentTimeSeconds}
            isOpen={analyticsOpen}
            reportingConfig={reportingConfig}
            onToggle={toggleAnalytics}
          />
        ),
        defaultSize: { width: 420, height: 520 },
        minSize: { width: 360, height: 420 },
        expandedSize: { width: 520, height: 580 }
      },
      reporting: {
        title: 'Reporting Configuration',
        subtitle: 'Define when precincts report over time',
        render: () => (
          <ReportingConfigPanel
            countyResults={countyResults}
            scenarioName={scenarioName}
            reportingConfig={reportingConfig}
            onChange={onReportingConfigLoaded}
          />
        ),
        defaultSize: { width: 420, height: 380 },
        minSize: { width: 360, height: 320 },
        expandedSize: { width: 520, height: 440 }
      },
      demographics: {
        title: 'Demographic Voting Patterns',
        subtitle: selectedCounty ? `${selectedCounty.county}, ${selectedCounty.state}` : 'Click a county to explore demographics',
        render: () => (
          <DemographicsPanel
            selectedCounty={selectedCounty}
            demographicData={demographicData}
            countyStates={countyStates}
            status={status}
          />
        ),
        defaultSize: { width: 440, height: 520 },
        minSize: { width: 380, height: 420 },
        expandedSize: { width: 560, height: 620 }
      },
      countyEdit: {
        title: 'County Editor',
        subtitle: selectedCounty ? `${selectedCounty.county}, ${selectedCounty.state}` : 'No county selected',
        render: () => (
          <CountyEditorPanel
            selectedCounty={selectedCounty}
            status={status}
            onCountySave={onCountySave}
            onCountyEditClose={onCountyEditClose}
          />
        ),
        defaultSize: { width: 380, height: 420 },
        minSize: { width: 340, height: 380 },
        expandedSize: { width: 460, height: 500 }
      },
      stateSelection: {
        title: 'State Selection',
        subtitle: scope === 'ALL' ? 'All states' : `${customStates.length} custom states`,
        render: () => (
          <StateSelectionPanel
            scope={scope}
            customStates={customStates}
            selectedStates={selectedStates}
            onScopeChange={onScopeChange}
            onCustomStatesChange={onCustomStatesChange}
            onSelectedStatesChange={onSelectedStatesChange}
          />
        ),
        defaultSize: { width: 340, height: 280 },
        minSize: { width: 300, height: 240 },
        expandedSize: { width: 420, height: 480 }
      }
    }
  }, [
    analyticsOpen,
    countyResults,
    countyStates,
    currentTimeSeconds,
    timelinePercent,
    exitPolls,
    isPlaying,
    onCountyDataLoaded,
    onDismissWelcome,
    onExitPollsLoaded,
    onJumpTo,
    onPause,
    onPlay,
    onReportingConfigLoaded,
    onReset,
    onSpeedChange,
    progress,
    reportingConfig,
    scenarioName,
    showWelcome,
    toggleAnalytics,
    totalDurationSeconds,
    selectedCounty,
    demographicData,
    status,
    onCountySave,
    onCountyEditClose,
    scope,
    customStates,
    onScopeChange,
    onCustomStatesChange,
    selectedStates,
    onSelectedStatesChange
  ])

  const [isMobile, setIsMobile] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const toggleMobilePanelsDrawer = useCallback(() => {
    setMobilePanelOpen((open) => !open)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobilePanelOpen(false)
    }
  }, [isMobile])

  const [panels, setPanels] = useState<PanelInstance[]>(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900
    const createPanel = (
      id: PanelId,
      x: number,
      y: number,
      size: PanelSize,
      zIndex: number,
      minimized: boolean
    ): PanelInstance => {
      const clampedPosition = clampPanelPosition(x, y, size.width, size.height)
      return {
        id,
        x: clampedPosition.x,
        y: clampedPosition.y,
        width: size.width,
        height: size.height,
        zIndex,
        minimized
      }
    }

    const horizontalMargin = 48
    const analyticsTop = 80
    const rightSide = Math.max(horizontalMargin, viewportWidth - panelDefinitions.analytics.defaultSize.width - horizontalMargin)
  const secondaryColumnX = horizontalMargin + panelDefinitions.uploader.defaultSize.width + 32
  const countyEditY = 80
  const demographicsY = countyEditY + panelDefinitions.countyEdit.defaultSize.height + 32

    const controlsPreferredY = 360
    const controlsMaxY = Math.max(160, viewportHeight - panelDefinitions.controls.defaultSize.height - 64)
    const controlsY = Math.min(controlsPreferredY, controlsMaxY)

    const analyticsBottom = analyticsTop + panelDefinitions.analytics.defaultSize.height
    const reportingPreferredY = analyticsBottom + 32
    const reportingMaxY = Math.max(analyticsBottom, viewportHeight - panelDefinitions.reporting.defaultSize.height - 48)
    const reportingY = Math.min(reportingPreferredY, reportingMaxY)

    const stateSelectionPreferredY = reportingY + panelDefinitions.reporting.defaultSize.height + 32
    const stateSelectionMaxY = Math.max(reportingY, viewportHeight - panelDefinitions.stateSelection.defaultSize.height - 32)
    const stateSelectionY = Math.min(stateSelectionPreferredY, stateSelectionMaxY)

    return [
      createPanel('uploader', horizontalMargin, 80, panelDefinitions.uploader.defaultSize, 1, true),
      createPanel('controls', horizontalMargin, controlsY, panelDefinitions.controls.defaultSize, 2, true),
      createPanel('analytics', rightSide, analyticsTop, panelDefinitions.analytics.defaultSize, 3, true),
      createPanel('reporting', rightSide, reportingY, panelDefinitions.reporting.defaultSize, 4, true),
      createPanel('countyEdit', secondaryColumnX, countyEditY, panelDefinitions.countyEdit.defaultSize, 5, true),
      createPanel('demographics', secondaryColumnX, demographicsY, panelDefinitions.demographics.defaultSize, 6, true),
      createPanel('stateSelection', rightSide, stateSelectionY, panelDefinitions.stateSelection.defaultSize, 7, true)
    ]
  })
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  // Reveal county editor when a selection is made during paused state
  useEffect(() => {
    if (!selectedCounty || status === 'running') return
    setPanels((previous) => {
      const highest = Math.max(...previous.map((p) => p.zIndex))
      return previous.map((panel) => {
        if (panel.id === 'countyEdit') {
          return { ...panel, minimized: false, zIndex: highest + 1 }
        }
        return panel
      })
    })
    setActivePanel('countyEdit')
  }, [selectedCounty, status])

  const bringToFront = useCallback((id: PanelId) => {
    setPanels((previous) => {
      const highest = Math.max(...previous.map((panel) => panel.zIndex)) + 1
      return previous.map((panel) => (panel.id === id ? { ...panel, zIndex: highest } : panel))
    })
    setActivePanel(id)
  }, [])

  const movePanel = useCallback((id: PanelId, x: number, y: number) => {
    setPanels((previous) =>
      previous.map((panel) => {
        if (panel.id !== id) return panel
        const clamped = clampPanelPosition(x, y, panel.width, panel.height)
        return { ...panel, ...clamped }
      })
    )
  }, [])

  const resizePanel = useCallback(
    (id: PanelId, width: number, height: number) => {
      setPanels((previous) =>
        previous.map((panel) => {
          if (panel.id !== id) return panel
          const clampedSize = clampPanelSize(id, panelDefinitions, panel.x, panel.y, width, height)
          return { ...panel, ...clampedSize }
        })
      )
    },
    [panelDefinitions]
  )

  const toggleMinimize = useCallback(
    (id: PanelId) => {
      let activate: PanelId | null = null
      let shouldClearActive = false
      setPanels((previous) => {
        const highest = Math.max(...previous.map((panel) => panel.zIndex))
        return previous.map((panel) => {
          if (panel.id !== id) return panel
          const nextMinimized = !panel.minimized
          if (nextMinimized) {
            if (activePanel === id) shouldClearActive = true
            return { ...panel, minimized: true }
          }
          activate = id
          return { ...panel, minimized: false, zIndex: highest + 1 }
        })
      })
      if (activate) {
        setActivePanel(activate)
      } else if (shouldClearActive) {
        setActivePanel(null)
      }
    },
    [activePanel]
  )

  const toggleExpand = useCallback(
    (id: PanelId) => {
      const definition = panelDefinitions[id]
      if (!definition?.expandedSize) return

      setPanels((previous) =>
        previous.map((panel) => {
          if (panel.id !== id) return panel
          const expanded = definition.expandedSize!
          const isExpanded = Math.abs(panel.width - expanded.width) < 16 && Math.abs(panel.height - expanded.height) < 16
          const targetSize = isExpanded ? definition.defaultSize : expanded
          const clampedSize = clampPanelSize(id, panelDefinitions, panel.x, panel.y, targetSize.width, targetSize.height)
          return { ...panel, ...clampedSize }
        })
      )
      setActivePanel(id)
    },
    [panelDefinitions]
  )

  useEffect(() => {
    const handleResize = () => {
      setPanels((previous) =>
        previous.map((panel) => {
          const adjustedSize = clampPanelSize(panel.id, panelDefinitions, panel.x, panel.y, panel.width, panel.height)
          const adjustedPosition = clampPanelPosition(panel.x, panel.y, adjustedSize.width, adjustedSize.height)
          return { ...panel, ...adjustedSize, ...adjustedPosition }
        })
      )
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panelDefinitions])

  const minimizedPanels = useMemo(() => panels.filter((panel) => panel.minimized), [panels])
  const normalizedProgress = useMemo(() => {
    if (!Number.isFinite(progress)) return 0
    const scaled = progress > 1 ? progress / 100 : progress
    return Math.max(0, Math.min(scaled, 1))
  }, [progress])
  const safeCurrentTime = useMemo(() => (Number.isFinite(currentTimeSeconds) ? currentTimeSeconds : 0), [currentTimeSeconds])
  const safeTotalDuration = useMemo(
    () => (Number.isFinite(totalDurationSeconds) && totalDurationSeconds > 0 ? totalDurationSeconds : 0),
    [totalDurationSeconds]
  )
  const currentTimecode = formatTimecode(safeCurrentTime)
  const totalTimecode = formatTimecode(safeTotalDuration)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03050A] text-[#E4ECFF]">
      <div 
        className="absolute inset-0 z-0" 
        style={{ paddingBottom: isMobile ? '80px' : 'calc(var(--bottom-dock-height, 320px) + 16px)' }}
      >
        <SandboxStudioMain
          isScenarioLoaded={isScenarioLoaded}
          showWelcome={showWelcome}
          onHideWelcome={onHideWelcome}
          countyResults={countyResults}
          countyStates={countyStates}
          editedCounties={editedCounties}
          onCountyClick={onCountyClick}
          progress={progress}
          currentTimeSeconds={currentTimeSeconds}
          isPlaying={isPlaying}
          status={status}
          isFullscreenMode={false}
          onPause={onPause}
          onExitFullscreen={onExitFullscreen}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          newsroomEvents={newsroomEvents}
          variant="workspace"
          scope={scope}
          customStates={customStates}
          onScopeChange={onScopeChange}
          onCustomStatesChange={onCustomStatesChange}
          selectedStates={selectedStates}
          onSelectedStatesChange={onSelectedStatesChange}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(56,132,255,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(128,86,255,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#02050C]/75 via-transparent to-[#010205]" />
      </div>

      {/* Integrated Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[200]">
        <div className="pointer-events-auto px-3 pt-3 md:px-0 md:pt-0">
          <IntegratedStudioHeader
            scenarioName={scenarioName}
            onScenarioNameChange={onScenarioNameChange}
            status={status}
            statusLabel={statusLabel}
            statusClass={statusClass}
            progress={normalizedProgress}
            isPlaying={isPlaying}
            currentTimeSeconds={safeCurrentTime}
            totalDurationSeconds={safeTotalDuration}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
            is3DAvailable={is3DAvailable}
            minimizedPanels={minimizedPanels.map((panel) => panel.id)}
            onPanelToggle={toggleMinimize}
            panelDefinitions={panelDefinitions}
            onShowIntro={onToggleWelcome}
            onShowKeyboardHelp={onShowKeyboardHelp}
            onExit={onExitFullscreen}
            error={error}
            isScenarioLoaded={isScenarioLoaded}
            editedCounties={editedCounties}
            isMobile={isMobile}
            mobilePanelOpen={mobilePanelOpen}
            onToggleMobilePanels={toggleMobilePanelsDrawer}
          />
        </div>
      </div>

      {/* Desktop Floating Panels */}
      {!isMobile && (
        <div className="absolute inset-0 z-[300] pointer-events-none">
          {panels.map((panel) => (
            <FloatingPanel
              key={panel.id}
              instance={panel}
              definition={panelDefinitions[panel.id]}
              isActive={panel.id === activePanel}
              onMove={movePanel}
              onResize={resizePanel}
              onFocus={bringToFront}
              onToggleMinimize={toggleMinimize}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}

      {/* Mobile Panel Drawer */}
      {isMobile && mobilePanelOpen && (
        <div className="pointer-events-auto fixed inset-x-0 top-16 bottom-0 z-[200] overflow-y-auto bg-slate-950/95 backdrop-blur-md px-4 py-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Scenario Data</h3>
              <div className="mt-3 space-y-3">
                {panelDefinitions.uploader.render()}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Simulation Controls</h3>
              <div className="mt-3 space-y-3">
                {panelDefinitions.controls.render()}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Analytics</h3>
              <div className="mt-3 space-y-3">
                {panelDefinitions.analytics.render()}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Reporting Config</h3>
              <div className="mt-3 space-y-3">
                {panelDefinitions.reporting.render()}
              </div>
            </div>

            {selectedCounty && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <h3 className="text-sm font-semibold text-slate-100">County Editor</h3>
                <div className="mt-3 space-y-3">
                  {panelDefinitions.countyEdit.render()}
                </div>
              </div>
            )}

            {selectedCounty && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Demographics</h3>
                <div className="mt-3 space-y-3">
                  {panelDefinitions.demographics.render()}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <h3 className="text-sm font-semibold text-slate-100">State Selection</h3>
              <div className="mt-3 space-y-3">
                {panelDefinitions.stateSelection.render()}
              </div>
            </div>

            <div className="h-24" />
          </div>
        </div>
      )}

      {/* Bottom Analytics Dock */}
      {!isMobile && (
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[200]">
          <BottomAnalyticsDock
            timelinePercent={timelinePercent}
            reportingPercent={progress}
            currentTimeSeconds={currentTimeSeconds}
            totalDuration={totalDurationSeconds}
            countyStates={countyStates}
            isPlaying={isPlaying}
            countyResults={countyResults}
            isScrubEnabled={status === 'completed'}
            newsroomEvents={newsroomEvents}
            selectedCounty={selectedCounty}
            demographicData={demographicData}
            nationalMargin={nationalMargin}
            reportingStats={reportingStats}
            onScrub={(percent) => {
              const targetSeconds = (percent / 100) * totalDurationSeconds
              onJumpTo(targetSeconds)
            }}
            onScrubEnd={() => {
              // Optionally resume playback after scrubbing
            }}
          />
        </div>
      )}

      {/* Mobile Simple Timeline */}
      {isMobile && !mobilePanelOpen && (
        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-50 rounded-lg border border-slate-800 bg-slate-950/90 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusClass}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-200">{statusLabel}</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-100">{Math.round(normalizedProgress * 100)}% complete</div>
              <div className="text-[10px] text-slate-500">{currentTimecode} / {totalTimecode}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
            <span className="tabular-nums text-slate-300">{currentTimecode}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${Math.round(normalizedProgress * 100)}%` }}
              />
            </div>
            <span className="tabular-nums">{totalTimecode}</span>
          </div>
        </div>
      )}
    </div>
  )
}
