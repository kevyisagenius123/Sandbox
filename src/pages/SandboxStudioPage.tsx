import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardShortcutsHelp } from '../components/sandbox/KeyboardShortcutsHelp'
import { SandboxThemeProvider } from '../design/SandboxThemeProvider'
import { useBackendSimulation } from '../hooks/useBackendSimulation'
import { FloatingPanelWorkspace } from '../components/sandbox/FloatingPanelWorkspace'
import type { CountyGeoMetadata, CountyResult, ExitPoll, ReportingConfig } from '../types/sandbox'
import type { SimulationStatus } from '../components/sandbox/studio/types'
import { detectWebGLSupport, type WebGLSupport } from '../utils/webglSupport'
import { STATE_META_BY_FIPS } from '../constants/usStates'

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
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [editedCounties, setEditedCounties] = useState<Set<string>>(new Set())
  const [webglSupport] = useState<WebGLSupport>(() => detectWebGLSupport())
  const isWebGLAvailable = webglSupport === 'supported'
  
  // Initialize mapMode based on WebGL support - only runs once on mount
  const [mapMode, setMapMode] = useState<'3D' | '2D' | 'THREE' | 'BABYLON'>(() => (isWebGLAvailable ? '3D' : '2D'))
  
  const [scope, setScope] = useState<'ALL' | 'CUSTOM'>('ALL')
  const [customStates, setCustomStates] = useState<string[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [manualMode, setManualMode] = useState(false)
  const lastCountyDiagnosticRef = useRef<string>('')

  useEffect(() => {
    if (!isWebGLAvailable && (mapMode === '3D' || mapMode === 'THREE' || mapMode === 'BABYLON')) {
      setMapMode('2D')
    }
  }, [isWebGLAvailable, mapMode])

  const {
    countyStates,
    currentTimeSeconds,
    demographicData,
    error,
    isPlaying,
    nationalMargin,
    newsroomEvents,
    playback,
    reportingStats,
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
  const timelineDurationSeconds = playback.totalDurationSeconds
  const timelinePercent = timelineDurationSeconds > 0
    ? Math.min(100, Math.max(0, (currentTimeSeconds / timelineDurationSeconds) * 100))
    : progress

  useEffect(() => {
    if (!selectedCounty) {
      lastCountyDiagnosticRef.current = ''
      return
    }

    const normalizedFips = selectedCounty.fips.padStart(5, '0')
    const countyState = countyStates.get(normalizedFips)
    const demographics = demographicData.get(normalizedFips)
    const hasDemographics = Boolean(demographics)
    const diagnosticsKey = [
      normalizedFips,
      hasDemographics ? 'has-demo' : 'no-demo',
      countyState?.currentReportingPercent ?? 'no-state',
      simulationStatus
    ].join('|')

    if (lastCountyDiagnosticRef.current === diagnosticsKey) {
      return
    }

    lastCountyDiagnosticRef.current = diagnosticsKey

    console.info('[DemographicsPipeline] Selected county snapshot', {
      fips: normalizedFips,
      county: selectedCounty.county,
      state: selectedCounty.state,
      simulationStatus,
      reportingPercent: countyState?.currentReportingPercent ?? null,
      hasDemographics,
      demographicKeys: hasDemographics ? Object.keys(demographics ?? {}) : [],
      manualMode
    })
  }, [selectedCounty, countyStates, demographicData, manualMode, simulationStatus])

  const countyByFips = useMemo(() => {
    const map = new Map<string, CountyResult>()
    countyResults.forEach((county) => {
      map.set(county.fips.padStart(5, '0'), county)
    })
    return map
  }, [countyResults])

  const createManualCounty = useCallback((rawFips: string, meta?: CountyGeoMetadata): CountyResult => {
    const normalizedFips = rawFips.padStart(5, '0')
    const inferredStateFips = (meta?.stateFips ?? normalizedFips.slice(0, 2)).padStart(2, '0')
    const stateMeta = STATE_META_BY_FIPS.get(inferredStateFips)
    const baseCountyName = meta?.countyName ?? `County ${normalizedFips}`
    const countyName = baseCountyName.toLowerCase().includes('county') ? baseCountyName : `${baseCountyName} County`
    const stateLabel = meta?.stateName ?? stateMeta?.abbr ?? stateMeta?.name ?? 'Unknown State'

    return {
      fips: normalizedFips,
      state: stateLabel,
      county: countyName,
      demVotes: 0,
      gopVotes: 0,
      otherVotes: 0,
      totalVotes: 0,
      reportingPercent: 0
    }
  }, [])

  const serializeCountyResultsToCsv = useCallback((results: CountyResult[]) => {
    const escapeValue = (value: string | number) => {
      const str = `${value ?? ''}`
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    const rows = results.map((county) => {
      const gopVotes = Number(county.gopVotes ?? 0)
      const demVotes = Number(county.demVotes ?? 0)
      const otherVotes = Number(county.otherVotes ?? Math.max(0, county.totalVotes - demVotes - gopVotes))
      const totalVotes = Number(county.totalVotes ?? gopVotes + demVotes + otherVotes)
      const reportingPercent = Number(county.reportingPercent ?? 0)

      return [
        county.fips.padStart(5, '0'),
        escapeValue(county.state ?? ''),
        escapeValue(county.county ?? ''),
        gopVotes,
        demVotes,
        otherVotes,
        totalVotes,
        reportingPercent
      ].join(',')
    })

    return ['fips,state,county,gop_votes,dem_votes,other_votes,total_votes,reporting_percent', ...rows].join('\n')
  }, [])

  useEffect(() => {
    if (!manualMode) return
    if (countyResults.length === 0) {
      if (rawCountyCsv !== '') {
        setRawCountyCsv('')
      }
      return
    }

    const csvPayload = serializeCountyResultsToCsv(countyResults)
    if (csvPayload !== rawCountyCsv) {
      setRawCountyCsv(csvPayload)
    }
  }, [countyResults, manualMode, rawCountyCsv, serializeCountyResultsToCsv])

  const handleCountyClick = useCallback(
    (fips: string, metadata?: CountyGeoMetadata) => {
      const normalizedFips = fips.padStart(5, '0')
      const county = countyByFips.get(normalizedFips)

      if (county) {
        setSelectedCounty(county)
        if (simulationStatus === 'running') {
          return
        }
      } else if (simulationStatus === 'running') {
        // Do not spawn manual edit stubs while a simulation is live
        return
      }

      const stub = createManualCounty(normalizedFips, metadata)
      setManualMode(true)
      setCountyResults((previous) => {
        if (previous.some((entry) => entry.fips.padStart(5, '0') === normalizedFips)) {
          return previous
        }
        return [...previous, stub]
      })
      setEditedCounties((previous) => {
        const next = new Set(previous)
        next.add(normalizedFips)
        return next
      })
      setSelectedCounty(stub)
    },
    [countyByFips, createManualCounty, simulationStatus]
  )

  const handleCountyEditClose = useCallback(() => {
    setSelectedCounty(null)
  }, [])

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
        if (selectedCounty) {
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
  }, [analyticsOpen, selectedCounty, isScenarioLoaded, pauseSimulation, resumeSimulation, setSpeed, showKeyboardHelp, startSimulation, simulationStatus])

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
    // Explicit hard reset: clear results and playback state
    void stopSimulation(true)
  }, [stopSimulation])

  const handleSpeedChange = useCallback((value: number) => {
    void setSpeed(value)
  }, [setSpeed])

  const handleJumpTo = useCallback((seconds: number) => {
    if (!playback.isReady) return
    playback.seekToSeconds(seconds)
  }, [playback])

  return (
    <>
      <FloatingPanelWorkspace
        scenarioName={scenarioName}
        isScenarioLoaded={isScenarioLoaded}
        showWelcome={showWelcome}
        onDismissWelcome={() => setShowWelcome(false)}
        exitPolls={exitPolls}
        onExitPollsLoaded={setExitPolls}
        onCountyDataLoaded={(data: CountyResult[], rawCsv: string) => {
          setCountyResults(data)
          setRawCountyCsv(rawCsv)
          setEditedCounties(new Set())
          setShowWelcome(false)
          setManualMode(false)
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
        demographicData={demographicData}
        nationalMargin={nationalMargin}
  reportingStats={reportingStats}
        analyticsOpen={analyticsOpen}
        toggleAnalytics={() => setAnalyticsOpen((previous) => !previous)}
        onCountyClick={handleCountyClick}
        editedCounties={editedCounties}
        onHideWelcome={() => setShowWelcome(false)}
        onExitFullscreen={handleExitFullscreen}
        mapMode={mapMode}
  is3DAvailable={isWebGLAvailable}
        newsroomEvents={newsroomEvents}
        error={error}
        statusClass={statusClass}
        statusLabel={statusLabel}
        onScenarioNameChange={setScenarioName}
  onToggleWelcome={() => setShowWelcome((previous) => !previous)}
  onMapModeChange={setMapMode}
        onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
        selectedCounty={selectedCounty}
        onCountySave={handleCountySave}
        onCountyEditClose={handleCountyEditClose}
        scope={scope}
        customStates={customStates}
        onScopeChange={setScope}
        onCustomStatesChange={setCustomStates}
        selectedStates={selectedStates}
        onSelectedStatesChange={setSelectedStates}
      />

      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </>
  )
}

const SandboxStudioPage: React.FC = () => (
  <SandboxThemeProvider>
    <SandboxStudioPageContent />
  </SandboxThemeProvider>
)

export default SandboxStudioPage
