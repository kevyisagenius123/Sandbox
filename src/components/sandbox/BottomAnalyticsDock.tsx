import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResultsSummary } from './ResultsSummary'
import { VoteBarChart3D } from './VoteBarChart3D'
import { BallotTypeReporting3D } from './BallotTypeReporting3D'
import { VoteMarginGauge3D } from './VoteMarginGauge3D'
import { TimelineBar } from './TimelineBar'
import { WebGLErrorBoundary } from '../map/WebGLErrorBoundary'
import type { CountySimulationState, CountyResult, NewsroomEvent } from '../../types/sandbox'
import { useSandboxThemeOrDefault } from '../../design/SandboxThemeProvider'
import type { DemographicSynthesisResponse } from '../../services/demographicService'
import type { AggregateResults } from './results-summary/types'

const Demographics3DPanel = lazy(() => 
  import('./Demographics3DPanel').then(module => ({ default: module.Demographics3DPanel }))
)

type ReportingStats = {
  countiesReporting?: number
  countiesTotal?: number
  resolvedTotalFrames?: number
  dynamicFrameTimeline?: boolean
}

const computeAggregateResults = (
  countyStates: Map<string, CountySimulationState>,
  reportingStats?: ReportingStats
): AggregateResults => {
  let totalDem = 0
  let totalGop = 0
  let totalOther = 0
  let currentTotalVotes = 0
  let countiesReporting = 0
  let fullyReported = 0
  let inProgress = 0
  let notStarted = 0
  let expectedVotesEstimate = 0

  countyStates.forEach((state) => {
    const demVotes = state.currentDemVotes ?? 0
    const gopVotes = state.currentGopVotes ?? 0
    const otherVotes = state.currentOtherVotes ?? Math.max(state.currentTotalVotes - demVotes - gopVotes, 0)
    const reportingPercent = state.currentReportingPercent ?? 0
    const countyTotalVotes = state.currentTotalVotes ?? demVotes + gopVotes + otherVotes

    totalDem += demVotes
    totalGop += gopVotes
    totalOther += otherVotes
    currentTotalVotes += countyTotalVotes

    if (reportingPercent > 0) {
      countiesReporting += 1
      if (reportingPercent >= 99.9 || state.isFullyReported) {
        fullyReported += 1
      } else {
        inProgress += 1
      }
    } else {
      notStarted += 1
    }

    if (reportingPercent > 1) {
      const progress = reportingPercent / 100
      expectedVotesEstimate += progress > 0 ? countyTotalVotes / progress : countyTotalVotes
    } else {
      expectedVotesEstimate += countyTotalVotes
    }
  })

  const derivedTotalCounties = countyStates.size
  const totalCounties = reportingStats?.countiesTotal ?? derivedTotalCounties
  const countiesReportingOverride = reportingStats?.countiesReporting ?? countiesReporting
  const reportingPercent = totalCounties > 0 ? (countiesReportingOverride / totalCounties) * 100 : 0

  const totalVotes = totalDem + totalGop + totalOther
  const expectedTotalVotes = Math.max(totalVotes, Math.round(expectedVotesEstimate))
  const votesRemaining = Math.max(expectedTotalVotes - totalVotes, 0)
  const voteReportingPercent = expectedTotalVotes > 0
    ? Math.min((totalVotes / expectedTotalVotes) * 100, 100)
    : reportingPercent

  const demPercent = totalVotes > 0 ? (totalDem / totalVotes) * 100 : 0
  const gopPercent = totalVotes > 0 ? (totalGop / totalVotes) * 100 : 0
  const otherPercent = totalVotes > 0 ? (totalOther / totalVotes) * 100 : 0

  const voteMarginAbsolute = totalDem - totalGop
  const voteMarginPercent = totalVotes > 0 ? (voteMarginAbsolute / totalVotes) * 100 : 0
  const leader: AggregateResults['leader'] = voteMarginAbsolute === 0
    ? 'TIE'
    : voteMarginAbsolute > 0
      ? 'DEM'
      : 'GOP'
  const leaderAdvantage = Math.min(Math.abs(voteMarginPercent), 45)
  const winProbability = leader === 'TIE'
    ? 50
    : leader === 'DEM'
      ? 50 + leaderAdvantage
      : 50 - leaderAdvantage

  return {
    totalDem,
    totalGop,
    totalOther,
    totalVotes,
    demPercent,
    gopPercent,
    otherPercent,
    reportingPercent,
    voteReportingPercent,
    expectedTotalVotes,
    votesRemaining,
    countiesReporting: countiesReportingOverride,
    totalCounties,
    fullyReported,
    inProgress,
    notStarted,
    voteMarginPercent,
    voteMarginAbsolute,
    leader,
    winProbability,
    reportingEtaSeconds: null,
    voteEtaSeconds: null
  }
}

type BottomAnalyticsDockProps = {
  timelinePercent: number
  reportingPercent: number
  currentTimeSeconds: number
  totalDuration: number
  countyStates: Map<string, CountySimulationState>
  isPlaying: boolean
  countyResults?: CountyResult[]
  isScrubEnabled?: boolean
  onScrub?: (percent: number) => void
  onScrubEnd?: () => void
  newsroomEvents?: NewsroomEvent[]
  selectedCounty?: CountyResult | null
  demographicData?: Map<string, DemographicSynthesisResponse>
  nationalMargin?: number
  reportingStats?: ReportingStats
  simulationId?: string
}

export const BottomAnalyticsDock: React.FC<BottomAnalyticsDockProps> = ({
  timelinePercent,
  reportingPercent,
  currentTimeSeconds,
  totalDuration,
  countyStates,
  isPlaying,
  countyResults = [],
  isScrubEnabled = false,
  onScrub,
  onScrubEnd,
  newsroomEvents: _newsroomEvents = [],
  selectedCounty = null,
  demographicData,
  nationalMargin: _nationalMargin = 0,
  reportingStats,
  simulationId
}) => {
  const theme = useSandboxThemeOrDefault()
  const [isExpanded, setIsExpanded] = useState(true)
  const [panelHeight, setPanelHeight] = useState<number>(320)
  const [isDragging, setIsDragging] = useState(false)
  const dragDataRef = useRef<{ startY: number; startHeight: number }>({ startY: 0, startHeight: 320 })
  const draggingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lastScrollTopRef = useRef(0)
  const scrollRestoreFrame = useRef<number | null>(null)

  const demographicMap = demographicData ?? new Map<string, DemographicSynthesisResponse>()
  
  // Compute aggregates from county states for win probability gauge
  const aggregates = useMemo(() => computeAggregateResults(countyStates, reportingStats), [countyStates, reportingStats])
  
  // Get current simulation state for selected county
  const selectedCountyState = selectedCounty?.fips 
    ? countyStates.get(selectedCounty.fips)
    : undefined
  
  // Only fetch demographics if:
  // Demographics now come from backend simulation frames (no HTTP calls needed)
  // Just use the demographicData map which is populated during simulation
  const selectedDemographics = selectedCounty && demographicMap.has(selectedCounty.fips)
    ? demographicMap.get(selectedCounty.fips)
    : null
  const isDemographicsLoading = false // No async loading - data is in frames

  const MIN_HEIGHT = 120

  const getViewportMaxHeight = useCallback(() => {
    if (typeof window === 'undefined') return 900
    return Math.max(MIN_HEIGHT + 40, window.innerHeight - 16)
  }, [])

  const [maxHeight, setMaxHeight] = useState<number>(() => getViewportMaxHeight())

  const captureScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current) return
    lastScrollTopRef.current = scrollContainerRef.current.scrollTop
  }, [])

  const restoreScrollPosition = useCallback(() => {
    const node = scrollContainerRef.current
    if (!node) return
    const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)
    node.scrollTop = Math.min(lastScrollTopRef.current, maxScroll)
  }, [])

  const scheduleScrollRestore = useCallback(() => {
    if (typeof window === 'undefined') return
    if (scrollRestoreFrame.current !== null) {
      window.cancelAnimationFrame(scrollRestoreFrame.current)
    }
    scrollRestoreFrame.current = window.requestAnimationFrame(() => {
      restoreScrollPosition()
      scrollRestoreFrame.current = null
    })
  }, [restoreScrollPosition])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      captureScrollPosition()
      const nextMax = getViewportMaxHeight()
      setMaxHeight(nextMax)
      setPanelHeight(prev => {
        const clamped = Math.min(Math.max(prev, MIN_HEIGHT), nextMax)
        if (clamped !== prev) {
          scheduleScrollRestore()
        }
        return clamped
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [captureScrollPosition, getViewportMaxHeight, scheduleScrollRestore])

  // Publish dock height as CSS variable so workspace can adjust padding dynamically
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    let frame: number | null = window.requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--bottom-dock-height', `${Math.round(panelHeight)}px`)
      frame = null
    })
    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [panelHeight])

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty('--bottom-dock-height')
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && scrollRestoreFrame.current !== null) {
        window.cancelAnimationFrame(scrollRestoreFrame.current)
      }
    }
  }, [])

  const textMuted = theme.palette.text.muted
  const textPrimary = theme.palette.text.primary
  const dockHeaderBackground = 'linear-gradient(125deg, rgba(4,7,18,0.96), rgba(2,5,12,0.88))'
  const dockBodyBackground = 'linear-gradient(180deg, rgba(2,4,10,0.96), rgba(3,6,15,0.94))'
  const glassCardBackground = 'rgba(7,11,22,0.72)'
  const deepGlassCardBackground = 'linear-gradient(150deg, rgba(6,10,22,0.9), rgba(3,6,14,0.9))'
  
  const [barChartOpen, setBarChartOpen] = useState(true)
  const [perceptionOpen, setPerceptionOpen] = useState(true)

  const updateHeight = useCallback((clientY: number) => {
    const { startY, startHeight } = dragDataRef.current
    const delta = startY - clientY
    const nextHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, startHeight + delta))
    setPanelHeight(nextHeight)
  }, [MIN_HEIGHT, maxHeight])

  const adjustHeightBy = useCallback((delta: number) => {
    setPanelHeight(prev => {
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, prev + delta))
      return next
    })
  }, [MIN_HEIGHT, maxHeight])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!draggingRef.current) return
    event.preventDefault()
    updateHeight(event.clientY)
  }, [updateHeight])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!draggingRef.current) return
    event.preventDefault()
    const touch = event.touches[0]
    if (!touch) return
    updateHeight(touch.clientY)
  }, [updateHeight])

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', endDrag)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', endDrag)
    window.removeEventListener('touchcancel', endDrag)
  }, [handleMouseMove, handleTouchMove])

  const startDrag = useCallback((clientY: number) => {
    dragDataRef.current = { startY: clientY, startHeight: panelHeight }
    draggingRef.current = true
    setIsDragging(true)
    setIsExpanded(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', endDrag)
    window.addEventListener('touchcancel', endDrag)
  }, [panelHeight, handleMouseMove, handleTouchMove, endDrag])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    startDrag(event.clientY)
  }, [startDrag])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault()
    const touch = event.touches[0]
    if (touch) {
      startDrag(touch.clientY)
    }
  }, [startDrag])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        setIsExpanded(true)
        adjustHeightBy(24)
        break
      case 'ArrowDown':
        event.preventDefault()
        adjustHeightBy(-24)
        break
      case 'Home':
        event.preventDefault()
        setIsExpanded(true)
        setPanelHeight(maxHeight)
        break
      case 'End':
        event.preventDefault()
        setPanelHeight(MIN_HEIGHT)
        break
      default:
        break
    }
  }, [adjustHeightBy, setIsExpanded, setPanelHeight, maxHeight, MIN_HEIGHT])

  useEffect(() => () => endDrag(), [endDrag])

  const reportingPercentDisplay = Number.isFinite(aggregates.reportingPercent)
    ? aggregates.reportingPercent
    : reportingPercent
  const countyProgressLabel = aggregates.totalCounties > 0
    ? `${aggregates.countiesReporting.toLocaleString()} / ${aggregates.totalCounties.toLocaleString()} counties`
    : `${aggregates.countiesReporting.toLocaleString()} counties`
  const remainingSeconds = Math.max(0, Math.round(totalDuration - currentTimeSeconds))
  
  // Check if we have real backend metadata (not just using the fallback 900s)
  const hasBackendDuration = reportingStats?.dynamicFrameTimeline || 
    (reportingStats?.resolvedTotalFrames ?? 0) > 0 || 
    currentTimeSeconds > 0
  const timeRemainingLabel = hasBackendDuration
    ? `${remainingSeconds.toLocaleString()}s remaining`
    : 'Awaiting simulation...'
  const leaderLabel = aggregates.leader === 'DEM' ? 'Democrats' : aggregates.leader === 'GOP' ? 'Republicans' : 'Tied'
  const timelineProgressLabel = totalDuration > 0
    ? `${Math.max(0, Math.min(100, Math.round((currentTimeSeconds / totalDuration) * 100)))}%`
    : '0%'
  const leaderHelper = aggregates.voteMarginAbsolute === 0
    ? 'Margin locked at parity'
    : `${aggregates.voteMarginAbsolute > 0 ? '+' : '-'}${Math.abs(aggregates.voteMarginAbsolute).toLocaleString()} votes`
  const headerMetrics = useMemo(
    () => [
      {
        label: 'Reporting Progress',
        value: `${reportingPercentDisplay.toFixed(1)}%`,
        helper: countyProgressLabel
      },
      {
        label: 'Race Leader',
        value: leaderLabel,
        helper: leaderHelper
      },
      {
        label: 'Timeline Status',
        value: timelineProgressLabel,
        helper: timeRemainingLabel
      }
    ],
    [
      countyProgressLabel,
      currentTimeSeconds,
      hasBackendDuration,
      leaderLabel,
      leaderHelper,
      timelineProgressLabel,
      reportingPercentDisplay,
      timeRemainingLabel,
      totalDuration
    ]
  )

  const outstandingVotesLabel = aggregates.expectedTotalVotes > 0
    ? `${Math.max(aggregates.expectedTotalVotes - aggregates.totalVotes, 0).toLocaleString()} ballots outstanding`
    : 'Awaiting expected turnout model'

  const signalCards = useMemo(
    () => [
      {
        label: 'Outstanding Votes',
        value: aggregates.votesRemaining.toLocaleString(),
        helper: outstandingVotesLabel,
        tone: 'amber'
      },
      {
        label: 'Vote Reporting',
        value: `${aggregates.voteReportingPercent.toFixed(1)}%`,
        helper: 'of expected ballots processed',
        tone: 'cyan'
      },
      {
        label: 'Margin Delta',
        value: `${Math.abs(aggregates.voteMarginPercent).toFixed(1)} pts`,
        helper: leaderHelper,
        tone: aggregates.leader === 'DEM' ? 'blue' : aggregates.leader === 'GOP' ? 'rose' : 'slate'
      },
      {
        label: 'Frame Cache',
        value: (reportingStats?.resolvedTotalFrames ?? 0).toLocaleString(),
        helper: reportingStats?.dynamicFrameTimeline ? 'Dynamic timeline enabled' : 'Warming render buffer',
        tone: 'violet'
      }
    ],
    [
      aggregates.leader,
      aggregates.voteMarginPercent,
      aggregates.voteReportingPercent,
      aggregates.votesRemaining,
      leaderHelper,
      outstandingVotesLabel,
      reportingStats?.dynamicFrameTimeline,
      reportingStats?.resolvedTotalFrames
    ]
  )

  const countyInsightHeadline = selectedCounty
    ? `${selectedCounty.county}, ${selectedCounty.state}`
    : 'Focus county'

  const countyInsightBody = selectedCountyState
    ? `${selectedCountyState.currentReportingPercent.toFixed(1)}% reported · ${selectedCountyState.currentTotalVotes.toLocaleString()} votes logged`
    : 'Select a county on the map to surface live segmentation, turnout pace, and frame variance.'

  const newsroomTicker = simulationId
    ? `Scenario ${simulationId} · ${isPlaying ? 'Live ingestion' : 'Paused for review'}`
    : isPlaying
      ? 'Ad hoc simulation · Live'
      : 'Ad hoc simulation · Paused'

  return (
    <section
      className="border-t relative flex flex-col"
      style={{
        background: theme.surfaces.dockShell.background,
        borderColor: theme.surfaces.dockShell.borderColor,
        boxShadow: theme.surfaces.dockShell.boxShadow,
        height: panelHeight,
        minHeight: MIN_HEIGHT,
        maxHeight: maxHeight,
        transition: isDragging ? 'none' : 'height 0.2s ease'
      }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-1/2 -top-3 z-20 h-6 w-32 -translate-x-1/2 cursor-row-resize flex items-center justify-center group"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-label="Resize analytics panel"
        aria-orientation="horizontal"
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={Math.round(maxHeight)}
        aria-valuenow={Math.round(panelHeight)}
        tabIndex={0}
      >
          <div className="h-1.5 w-16 rounded-full bg-gray-600/50 transition group-hover:bg-gray-500/80" />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col overflow-hidden">
        {/* Toolbar Header */}
        <div
          className="flex flex-col gap-6 rounded-b-3xl border-b px-6 py-5"
          style={{
            borderColor: theme.surfaces.dockShell.borderColor,
            background: dockHeaderBackground
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-300/80">Newsroom Console</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                National desk operations
              </p>
              <p className="text-sm text-white/60">{newsroomTicker}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-1 text-[10px] font-semibold tracking-[0.3em] ${isPlaying ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-slate-500/60 bg-slate-900/60 text-slate-200'}`}
              >
                {isPlaying ? 'LIVE FEED' : 'PAUSED'}
              </span>
              {simulationId && (
                <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-white/70">
                  {simulationId}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.35em] transition hover:bg-white/5"
                style={{ borderColor: theme.surfaces.dockPanel.borderColor, color: textPrimary }}
                aria-expanded={isExpanded}
              >
                {isExpanded ? 'Collapse Summary' : 'Expand Summary'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {headerMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border px-4 py-3 backdrop-blur"
                style={{ borderColor: theme.surfaces.dockPanel.borderColor, background: glassCardBackground }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: textPrimary }}>
                  {metric.value}
                </p>
                <p className="text-[11px] text-white/60">{metric.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {signalCards.map((card) => {
              const toneMap: Record<string, { border: string; glow: string }> = {
                amber: { border: 'rgba(251,191,36,0.4)', glow: 'rgba(251,191,36,0.12)' },
                cyan: { border: 'rgba(34,211,238,0.35)', glow: 'rgba(45,212,191,0.08)' },
                blue: { border: 'rgba(96,165,250,0.4)', glow: 'rgba(59,130,246,0.1)' },
                rose: { border: 'rgba(251,113,133,0.45)', glow: 'rgba(244,114,182,0.12)' },
                violet: { border: 'rgba(167,139,250,0.4)', glow: 'rgba(196,181,253,0.12)' },
                slate: { border: 'rgba(148,163,184,0.3)', glow: 'rgba(148,163,184,0.08)' }
              }
              const tone = toneMap[card.tone] ?? toneMap.slate
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: tone.border,
                    background: `linear-gradient(140deg, rgba(6,9,18,0.85), ${tone.glow})`,
                    boxShadow: `0 20px 40px -28px ${tone.glow}`
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">{card.label}</p>
                  <p className="mt-1 text-xl font-semibold" style={{ color: textPrimary }}>
                    {card.value}
                  </p>
                  <p className="text-[11px] text-white/70">{card.helper}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden px-6 pb-4 pt-4" style={{ background: dockBodyBackground }}>
          <div ref={scrollContainerRef} className="h-full space-y-6 overflow-y-auto pr-1">
            {/* Timeline + Focus */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div
                className="rounded-3xl border px-5 py-4"
                style={{
                  borderColor: theme.surfaces.dockPanel.borderColor,
                  background: deepGlassCardBackground
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">Timeline Control</p>
                    <p className="text-sm text-white/70">Playback + frame scrubbing</p>
                  </div>
                  <span className="text-[11px] font-semibold text-white/60">
                    {isScrubEnabled ? 'Scrubbing unlocked' : 'Rendering in progress'}
                  </span>
                </div>
                <div className="mt-4">
                  <TimelineBar
                    progress={timelinePercent}
                    currentTimeSeconds={currentTimeSeconds}
                    totalDuration={totalDuration}
                    variant="dock"
                    interactive={isScrubEnabled}
                    onScrub={onScrub}
                    onScrubEnd={onScrubEnd}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-white/60">
                    <span>{timelineProgressLabel} elapsed</span>
                    <span>{timeRemainingLabel}</span>
                  </div>
                  {!isScrubEnabled && (
                    <p className="mt-2 text-[11px] text-amber-200/80">
                      Caching frames
                      <span className="ml-1 text-white/50">(scrubbing unlocks once the buffer is ready)</span>
                    </p>
                  )}
                </div>
              </div>

              <div
                className="rounded-3xl border px-5 py-4"
                style={{
                  borderColor: theme.surfaces.dockPanel.borderColor,
                  background: deepGlassCardBackground
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">Focus county</p>
                    <p className="mt-1 text-lg font-semibold" style={{ color: textPrimary }}>
                      {countyInsightHeadline}
                    </p>
                    <p className="text-sm text-white/70">{countyInsightBody}</p>
                  </div>
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-white/70">
                    {selectedCounty ? 'Linked' : 'Idle'}
                  </span>
                </div>
                <p className="mt-4 text-[11px] text-white/55">
                  Use the floating panel or county map to change focus counties. Demographic particle view updates instantly
                  while this dock streams aggregated context for top-of-show storytelling.
                </p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Vote Chart */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: textMuted }}>Vote Distribution</label>
                <div
                  className="rounded-3xl border px-3 py-3"
                  style={{
                    borderColor: theme.surfaces.dockPanel.borderColor,
                    background: deepGlassCardBackground
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">Vote distribution</p>
                      <p className="text-sm text-white/70">Live totals vs projections</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBarChartOpen((prev) => !prev)}
                      className="text-[11px] font-semibold text-white/70 hover:text-white"
                    >
                      {barChartOpen ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  <div style={{ height: 400 }}>
                    <VoteBarChart3D
                      countyResults={countyResults}
                      countyStates={countyStates}
                      isOpen={barChartOpen}
                      onToggle={() => setBarChartOpen((prev) => !prev)}
                    />
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: textMuted }}>Demographics</label>
                <div
                  className="rounded-3xl border px-4 py-4"
                  style={{
                    borderColor: theme.surfaces.dockPanel.borderColor,
                    background: deepGlassCardBackground
                  }}
                >
                  <WebGLErrorBoundary>
                    <Suspense
                      fallback={
                        <div className="flex h-64 items-center justify-center text-[10px]" style={{ color: textMuted }}>
                          Loading demographic visualization...
                        </div>
                      }
                    >
                      <Demographics3DPanel
                        selectedCountyGeoid={selectedCounty?.fips}
                        demographics={selectedDemographics ?? null}
                        countyState={selectedCountyState}
                        isLoading={isDemographicsLoading}
                      />
                    </Suspense>
                  </WebGLErrorBoundary>
                </div>
              </div>
            </div>

            {/* Secondary Metrics Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Ballot Types */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: textMuted }}>Ballot Processing</label>
                <div
                  className="rounded-3xl border px-4 py-4"
                  style={{
                    borderColor: theme.surfaces.dockPanel.borderColor,
                    background: deepGlassCardBackground
                  }}
                >
                  <BallotTypeReporting3D
                    countyStates={countyStates}
                    isOpen={barChartOpen}
                    onToggle={() => setBarChartOpen(!barChartOpen)}
                    selectedCountyFips={selectedCounty?.fips || null}
                  />
                </div>
              </div>

              {/* Win Probability */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: textMuted }}>Win Probability</label>
                <div
                  className="rounded-3xl border px-4 py-4"
                  style={{
                    borderColor: theme.surfaces.dockPanel.borderColor,
                    background: deepGlassCardBackground
                  }}
                >
                  <VoteMarginGauge3D
                    aggregates={aggregates}
                    isOpen={perceptionOpen}
                    onToggle={() => setPerceptionOpen(!perceptionOpen)}
                  />
                </div>
              </div>
            </div>

            <div
              className={`transition-all duration-300 ease-in-out ${
                isExpanded
                  ? 'opacity-100'
                  : 'pointer-events-none -mt-4 max-h-0 overflow-hidden opacity-0'
              }`}
            >
              <ResultsSummary
                countyStates={countyStates}
                elapsedSeconds={currentTimeSeconds}
                totalDuration={totalDuration}
                isPlaying={isPlaying}
                countyResults={countyResults}
                reportingStats={reportingStats}
                simulationId={simulationId}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
