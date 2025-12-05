import { useMemo, useRef, useState, useEffect } from 'react'
import type {
  ResultsSummaryProps,
  SummaryData,
  AggregateResults,
  StateLeaderboardRow,
  HeatmapEntry,
  TrajectoryPoint,
  MarginShiftItem,
  CountyFocusSnapshot,
  MarginParty,
  AlertNotice,
  HistoricalSnapshot,
  MarginEvent,
  OutstandingVotesByState,
  CountyTreemapNode,
  MLWinProbability,
  NarrativeInsights
} from './types'
import { formatNumber, formatPercent, formatDuration } from './formatters'
import {
  getEnhancedWinProbability,
  generateNarrative,
  transformAggregates,
  transformCounties,
  evaluateRaceCall,
  findSimilarElections,
  rankCountyImportance,
  checkServiceHealth,
  type RaceCallResponse,
  type HistoricalMatchResponse,
  type CountyImportanceResponse
} from '../../../services/pythonAnalytics'
import { debugLog, debugWarn } from '../../../utils/debugLogger'

const PYTHON_SERVICE_FAILURE_COOLDOWN_MS = 60_000
const PYTHON_SERVICE_SUCCESS_RECHECK_MS = 30_000

const computeWinProbability = (aggregates: AggregateResults): number => {
  const safeTotal = Math.max(aggregates.totalVotes + aggregates.votesRemaining, 1)
  const marginShare = Math.abs(aggregates.voteMarginAbsolute) / safeTotal
  const marginContribution = marginShare * 160 // heuristic scaling
  const direction = aggregates.leader === 'GOP' ? 1 : aggregates.leader === 'DEM' ? -1 : 0
  const base = 50 + direction * marginContribution
  return Math.max(0, Math.min(100, base))
}

const resolveMarginParty = (marginVotes: number): MarginParty => {
  if (marginVotes === 0) return 'TIE'
  return marginVotes > 0 ? 'GOP' : 'DEM'
}

export const useResultsSummaryData = ({
  countyStates,
  countyResults = [],
  elapsedSeconds = 0,
  totalDuration: totalDurationSeconds = 0,
  isPlaying = false,
  newsroomEvents = [],
  reportingStats,
  simulationId
}: ResultsSummaryProps): SummaryData => {
  // Historical snapshot tracking (persist across re-renders)
  const snapshotHistoryRef = useRef<HistoricalSnapshot[]>([])
  const lastSnapshotTimeRef = useRef<number>(0)

  // Python analytics state
  const [mlWinProbability, setMlWinProbability] = useState<MLWinProbability | null>(null)
  const [narrativeInsights, setNarrativeInsights] = useState<NarrativeInsights | null>(null)
  const [raceCallData, setRaceCallData] = useState<RaceCallResponse | null>(null)
  const [historicalMatchData, setHistoricalMatchData] = useState<HistoricalMatchResponse | null>(null)
  const [countyImportanceData, setCountyImportanceData] = useState<CountyImportanceResponse | null>(null)
  const lastAnalyticsFetchRef = useRef<number>(0)
  const pythonServiceStateRef = useRef({
    status: 'unknown' as 'unknown' | 'available' | 'unavailable',
    retryAfter: 0,
    consecutiveFailures: 0
  })

  const countyLookup = useMemo(() => {
    const map = new Map<string, (typeof countyResults)[number]>()
    countyResults.forEach((county) => {
      const normalized = (county.fips ?? '').padStart(5, '0')
      map.set(normalized, county)
    })
    return map
  }, [countyResults])

  const stateBaselines = useMemo(() => {
    const accumulator = new Map<string, { expected: number; dem: number; gop: number }>()
    countyResults.forEach((county) => {
      const stateLabel = (county.state || 'Unknown').toUpperCase()
      const existing = accumulator.get(stateLabel) ?? { expected: 0, dem: 0, gop: 0 }
      existing.expected += county.totalVotes ?? 0
      existing.dem += county.demVotes ?? 0
      existing.gop += county.gopVotes ?? 0
      accumulator.set(stateLabel, existing)
    })

    const baselines = new Map<string, { marginPercent: number }>()
    accumulator.forEach((value, key) => {
      const marginPercent = value.expected > 0 ? ((value.gop - value.dem) / value.expected) * 100 : 0
      baselines.set(key, { marginPercent })
    })
    return baselines
  }, [countyResults])

  const aggregates = useMemo<AggregateResults>(() => {
    let totalDem = 0
    let totalGop = 0
    let totalOther = 0
    let totalVotes = 0
    let countiesReporting = 0
    let fullyReported = 0
    let inProgress = 0
    let notStarted = 0

    countyStates.forEach((state) => {
      totalDem += state.currentDemVotes
      totalGop += state.currentGopVotes
      totalOther += state.currentOtherVotes
      totalVotes += state.currentTotalVotes

      if (state.currentReportingPercent > 0) {
        countiesReporting += 1
        if (state.currentReportingPercent >= 99.9 || state.isFullyReported) {
          fullyReported += 1
        } else {
          inProgress += 1
        }
      } else {
        notStarted += 1
      }
    })

    const totalCounties = countyStates.size
    const resolvedTotalCounties = reportingStats?.countiesTotal && reportingStats.countiesTotal > 0
      ? reportingStats.countiesTotal
      : totalCounties
    const resolvedCountiesReporting = typeof reportingStats?.countiesReporting === 'number'
      ? reportingStats.countiesReporting
      : countiesReporting
    const demPercent = totalVotes > 0 ? (totalDem / totalVotes) * 100 : 0
    const gopPercent = totalVotes > 0 ? (totalGop / totalVotes) * 100 : 0
    const otherPercent = totalVotes > 0 ? (totalOther / totalVotes) * 100 : 0
    const reportingPercent = resolvedTotalCounties > 0
      ? (resolvedCountiesReporting / resolvedTotalCounties) * 100
      : 0

    const expectedTotalVotes = countyResults.reduce((sum, county) => sum + (county.totalVotes ?? 0), 0)
    const votesRemaining = Math.max(expectedTotalVotes - totalVotes, 0)
    const voteReportingPercent = expectedTotalVotes > 0
      ? Math.min((totalVotes / expectedTotalVotes) * 100, 100)
      : reportingPercent

    const voteMarginAbsolute = totalGop - totalDem
    const voteMarginPercent = gopPercent - demPercent

    const leader: MarginParty = resolveMarginParty(voteMarginAbsolute)

    const reportingVelocityPerSecond = elapsedSeconds > 0
      ? reportingPercent / Math.max(elapsedSeconds, 1)
      : 0

    const voteVelocityPerSecond = elapsedSeconds > 0
      ? voteReportingPercent / Math.max(elapsedSeconds, 1)
      : 0

    const reportingEtaSeconds = reportingVelocityPerSecond > 0
      ? Math.max((100 - reportingPercent) / reportingVelocityPerSecond, 0)
      : null

    const voteEtaSeconds = voteVelocityPerSecond > 0
      ? Math.max((100 - voteReportingPercent) / voteVelocityPerSecond, 0)
      : null

    const aggregatesPartial: AggregateResults = {
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
  countiesReporting: resolvedCountiesReporting,
  totalCounties: resolvedTotalCounties,
      fullyReported,
      inProgress,
      notStarted,
      voteMarginPercent,
      voteMarginAbsolute,
      leader,
      winProbability: 50, // temporary, updated below
      reportingEtaSeconds,
      voteEtaSeconds
    }

    const winProbability = computeWinProbability(aggregatesPartial)

    return {
      ...aggregatesPartial,
      winProbability
    }
  }, [countyStates, countyResults, elapsedSeconds, reportingStats])

  const metrics = useMemo<SummaryData['metrics']>(() => {
    const reportingVelocityPerSecond = elapsedSeconds > 0
      ? aggregates.reportingPercent / Math.max(elapsedSeconds, 1)
      : 0
    const voteVelocityPerSecond = elapsedSeconds > 0
      ? aggregates.voteReportingPercent / Math.max(elapsedSeconds, 1)
      : 0

    const reportingVelocityPerMinute = reportingVelocityPerSecond * 60
    const voteVelocityPerMinute = voteVelocityPerSecond * 60

    return [
      {
        id: 'counted',
        label: 'Votes Counted',
        value: `${formatNumber(aggregates.totalVotes)} / ${formatNumber(aggregates.expectedTotalVotes)}`,
        helper: `${formatPercent(aggregates.voteReportingPercent)} of expected`
      },
      {
        id: 'remaining',
        label: 'Ballots Remaining',
        value: formatNumber(aggregates.votesRemaining),
        helper: `${formatPercent(aggregates.reportingPercent)} counties reporting`
      },
      {
        id: 'velocity',
        label: 'Reporting Velocity',
        value: `${formatPercent(reportingVelocityPerMinute, 2)} / min`,
        helper: `${formatPercent(voteVelocityPerMinute, 2)} vote% / min`
      },
      {
        id: 'eta',
        label: 'Projected Completion',
        value: formatDuration(aggregates.voteEtaSeconds ?? aggregates.reportingEtaSeconds),
        helper: isPlaying ? 'Live feed' : 'Paused'
      }
    ]
  }, [aggregates, elapsedSeconds, isPlaying])

  const leaderboard = useMemo<StateLeaderboardRow[]>(() => {
    if (countyResults.length === 0) return []

    const stateMap = new Map<string, StateLeaderboardRow>()

    countyResults.forEach((county) => {
      const stateLabel = (county.state || 'Unknown').toUpperCase()
      const existing = stateMap.get(stateLabel) ?? {
        label: stateLabel,
        reported: 0,
        expected: 0,
        demVotes: 0,
        gopVotes: 0,
        reportingPercent: 0,
        leader: 'Tie' as const,
        marginVotes: 0,
        marginPercent: 0
      }

      existing.expected += county.totalVotes ?? 0

      const normalized = (county.fips ?? '').padStart(5, '0')
      const simState = countyStates.get(normalized) ?? countyStates.get(county.fips)
      if (simState) {
        existing.reported += simState.currentTotalVotes
        existing.demVotes += simState.currentDemVotes
        existing.gopVotes += simState.currentGopVotes
      }

      stateMap.set(stateLabel, existing)
    })

    return Array.from(stateMap.values())
      .map((row) => {
        const reportingPercent = row.expected > 0 ? (row.reported / row.expected) * 100 : 0
        const marginVotes = row.gopVotes - row.demVotes
        const marginPercent = row.reported > 0 ? (marginVotes / Math.max(row.reported, 1)) * 100 : 0
        const leader: StateLeaderboardRow['leader'] = marginVotes === 0 ? 'Tie' : marginVotes > 0 ? 'R' : 'D'
        return {
          ...row,
          reportingPercent,
          marginVotes,
          marginPercent,
          leader
        }
      })
      .filter((row) => row.expected > 0)
      .sort((a, b) => Math.abs(b.marginPercent) - Math.abs(a.marginPercent))
      .slice(0, 8)
  }, [countyResults, countyStates])

  const { heatmap, focusCounty } = useMemo(() => {
    const entries: HeatmapEntry[] = []
    let focus: CountyFocusSnapshot | null = null

    countyStates.forEach((state) => {
      const normalized = (state.fips ?? '').padStart(5, '0')
      const countyMeta = countyLookup.get(normalized) ?? countyLookup.get(state.fips)
      const marginVotes = state.currentGopVotes - state.currentDemVotes
      const party = resolveMarginParty(marginVotes)
      const totalVotes = Math.max(state.currentTotalVotes, 1)
      const marginPercent = (marginVotes / totalVotes) * 100
      const expectedTotal = countyMeta?.totalVotes ?? state.currentTotalVotes
      const remainingVotes = Math.max((expectedTotal ?? 0) - state.currentTotalVotes, 0)
      const name = countyMeta?.county ?? `County ${state.fips}`
      const stateName = (countyMeta?.state ?? '').toUpperCase()

      const entry: HeatmapEntry = {
        fips: state.fips,
        name,
        state: stateName,
        reportingPercent: state.currentReportingPercent,
        marginPercent,
        marginVotes,
        party,
        remainingVotes
      }

      entries.push(entry)

      if (!focus || entry.remainingVotes > focus.remainingVotes) {
        focus = {
          fips: entry.fips,
          name: entry.name,
          state: entry.state,
          reportingPercent: entry.reportingPercent,
          marginVotes: entry.marginVotes,
          marginPercent: entry.marginPercent,
          party: entry.party,
          remainingVotes: entry.remainingVotes,
          trend: [
            { label: 'Start', reportingPercent: 0 },
            { label: 'Now', reportingPercent: entry.reportingPercent },
            { label: 'Projected', reportingPercent: 100 }
          ]
        }
      }
    })

    const prioritized = entries
      .sort((a, b) => {
        const byReporting = b.reportingPercent - a.reportingPercent
        if (byReporting !== 0) return byReporting
        return b.remainingVotes - a.remainingVotes
      })
      .slice(0, 12)

    return {
      heatmap: prioritized,
      focusCounty: focus
    }
  }, [countyStates, countyLookup])

  const turnoutTrajectory = useMemo<TrajectoryPoint[]>(() => {
    const playbackPercent = totalDurationSeconds > 0
      ? Math.min((elapsedSeconds / Math.max(totalDurationSeconds, 1)) * 100, 100)
      : aggregates.reportingPercent

    const quarterActual = Math.min(aggregates.voteReportingPercent * 0.4, aggregates.voteReportingPercent)
    const halfActual = Math.min(aggregates.voteReportingPercent * 0.7, aggregates.voteReportingPercent)
    const projectedActual = Math.min(aggregates.voteReportingPercent + Math.max(5, aggregates.winProbability / 3), 100)

    return [
      { label: 'Start', actual: 0, expected: 0 },
      { label: '25%', actual: Number(quarterActual.toFixed(1)), expected: 25 },
      { label: '50%', actual: Number(halfActual.toFixed(1)), expected: 50 },
      { label: 'Current', actual: Number(aggregates.voteReportingPercent.toFixed(1)), expected: Number(playbackPercent.toFixed(1)) },
      { label: 'Projected', actual: Number(projectedActual.toFixed(1)), expected: 100 }
    ]
  }, [aggregates.voteReportingPercent, aggregates.winProbability, aggregates.reportingPercent, elapsedSeconds, totalDurationSeconds])

  const marginShifts = useMemo<MarginShiftItem[]>(() => {
    if (leaderboard.length === 0) return []

    return leaderboard
      .map((row) => {
        const baseline = stateBaselines.get(row.label)
        const baselineMargin = baseline?.marginPercent ?? 0
        const deltaPercent = row.marginPercent - baselineMargin
        const party = resolveMarginParty(row.marginVotes)
        return {
          id: row.label,
          label: row.label,
          deltaPercent,
          marginPercent: row.marginPercent,
          party,
          timestamp: newsroomEvents[0]?.timestamp ?? new Date().toISOString()
        }
      })
      .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
      .slice(0, 8)
  }, [leaderboard, stateBaselines, newsroomEvents])

  const alerts = useMemo<AlertNotice[]>(() => {
    if (newsroomEvents.length === 0) return []

    const supportedSeverities = new Set(['info', 'success', 'warning', 'danger'])

    return newsroomEvents.slice(0, 5).map((event) => ({
      id: event.id,
      headline: event.headline,
      detail: event.detail,
      severity: supportedSeverities.has(event.severity ?? '')
        ? (event.severity as AlertNotice['severity'])
        : 'neutral',
      timestamp: event.timestamp
    }))
  }, [newsroomEvents])

  const fallbackVoteShare = useMemo(() => ([
    { name: 'Democratic', value: Math.max(aggregates.totalDem, 0) },
    { name: 'Republican', value: Math.max(aggregates.totalGop, 0) },
    { name: 'Other', value: Math.max(aggregates.totalOther, 0) }
  ]), [aggregates.totalDem, aggregates.totalGop, aggregates.totalOther])

  const [backendVoteShare, setBackendVoteShare] = useState<{ name: string; value: number }[]>(fallbackVoteShare)

  // Keep local fallback in sync when no simulation id is provided
  useEffect(() => {
    if (simulationId) return
    setBackendVoteShare(fallbackVoteShare)
  }, [simulationId, fallbackVoteShare])

  // Fetch vote share from backend when a simulation id is available
  useEffect(() => {
    if (!simulationId) return undefined

    let cancelled = false

    const fetchVoteShare = async () => {
      try {
        const response = await fetch(`http://localhost:8080/api/sandbox/${simulationId}/vote-share`)
        if (response.ok) {
          const data = await response.json()
          if (!cancelled && data.voteShareSeries) {
            setBackendVoteShare(data.voteShareSeries)
          }
        }
      } catch (error) {
        console.error('Failed to fetch vote share:', error)
      }
    }

    fetchVoteShare()
    const interval = setInterval(fetchVoteShare, 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [simulationId])

  const voteShareSeries = simulationId ? backendVoteShare : fallbackVoteShare

  // ===== Phase 1: Historical Snapshots =====
  const historicalSnapshots = useMemo(() => {
    // Record current state as a snapshot (throttled to avoid too many points)
    const currentTimestamp = Date.now()
    const shouldRecord = currentTimestamp - lastSnapshotTimeRef.current > 5000 // Every 5 seconds

    if (shouldRecord && aggregates.totalVotes > 0) {
      const snapshot: HistoricalSnapshot = {
        timestamp: currentTimestamp,
        elapsedMinutes: elapsedSeconds / 60,
        reportingPercent: aggregates.reportingPercent,
        demVotes: aggregates.totalDem,
        gopVotes: aggregates.totalGop,
        otherVotes: aggregates.totalOther,
        totalVotes: aggregates.totalVotes,
        margin: aggregates.voteMarginAbsolute,
        marginPercent: aggregates.voteMarginPercent,
        leader: aggregates.leader
      }

      snapshotHistoryRef.current.push(snapshot)
      lastSnapshotTimeRef.current = currentTimestamp

      // Keep only last 100 snapshots to prevent memory issues
      if (snapshotHistoryRef.current.length > 100) {
        snapshotHistoryRef.current = snapshotHistoryRef.current.slice(-100)
      }
    }

    return snapshotHistoryRef.current
  }, [aggregates, elapsedSeconds])

  // ===== Phase 1: Margin Events =====
  const marginEvents = useMemo<MarginEvent[]>(() => {
    // Generate events from newsroom events
    return newsroomEvents
      .filter((event) => event.severity === 'info' || event.severity === 'success')
      .slice(0, 10)
      .map((event) => ({
        timestamp: new Date(event.timestamp).getTime(),
        elapsedMinutes: elapsedSeconds / 60,
        label: event.headline.substring(0, 30),
        description: event.detail,
        type: 'milestone' as const
      }))
  }, [newsroomEvents, elapsedSeconds])

  // ===== Phase 1: Outstanding Votes by State =====
  const outstandingVotesByState = useMemo<OutstandingVotesByState[]>(() => {
    const stateData = new Map<string, {
      state: string
      stateCode: string
      expected: number
      reported: number
      demVotes: number
      gopVotes: number
    }>()

    // Aggregate by state
    countyResults.forEach((county) => {
      const stateLabel = (county.state || 'Unknown').toUpperCase()
      const stateCode = stateLabel.substring(0, 2)

      const existing = stateData.get(stateLabel) ?? {
        state: stateLabel,
        stateCode,
        expected: 0,
        reported: 0,
        demVotes: 0,
        gopVotes: 0
      }

      existing.expected += county.totalVotes ?? 0

      const normalized = (county.fips ?? '').padStart(5, '0')
      const simState = countyStates.get(normalized) ?? countyStates.get(county.fips)
      if (simState) {
        existing.reported += simState.currentTotalVotes
        existing.demVotes += simState.currentDemVotes
        existing.gopVotes += simState.currentGopVotes
      }

      stateData.set(stateLabel, existing)
    })

    // Compute outstanding and estimated leans
    return Array.from(stateData.values())
      .map((state) => {
        const outstanding = Math.max(state.expected - state.reported, 0)
        const outstandingPercent = state.expected > 0 ? (outstanding / state.expected) * 100 : 0
        const currentMargin = state.gopVotes - state.demVotes
        const reportingPercent = state.expected > 0 ? (state.reported / state.expected) * 100 : 0

        // Estimate leans based on current voting patterns
        const demShare = state.reported > 0 ? state.demVotes / state.reported : 0.48
        const gopShare = state.reported > 0 ? state.gopVotes / state.reported : 0.48

        const demLean = Math.round(outstanding * demShare * 0.95) // Conservative estimate
        const gopLean = Math.round(outstanding * gopShare * 0.95)
        const uncertain = outstanding - demLean - gopLean

        const potentialSwing = Math.max(demLean, gopLean)

        return {
          state: state.state,
          stateCode: state.stateCode,
          outstanding,
          outstandingPercent,
          demLean,
          gopLean,
          uncertain,
          potentialSwing,
          currentMargin,
          reportingPercent
        }
      })
      .filter((s) => s.outstanding > 0)
      .sort((a, b) => b.potentialSwing - a.potentialSwing)
  }, [countyResults, countyStates])

  // ===== Phase 1: County Treemap Nodes =====
  const countyTreemapNodes = useMemo<CountyTreemapNode[]>(() => {
    const nodes: CountyTreemapNode[] = []

    countyStates.forEach((state) => {
      const normalized = (state.fips ?? '').padStart(5, '0')
      const countyMeta = countyLookup.get(normalized) ?? countyLookup.get(state.fips)

      if (countyMeta && state.currentTotalVotes > 0) {
        const marginVotes = state.currentGopVotes - state.currentDemVotes
        const marginPercent = state.currentTotalVotes > 0
          ? (marginVotes / state.currentTotalVotes) * 100
          : 0
        const leader = resolveMarginParty(marginVotes)

        nodes.push({
          name: countyMeta.county ?? `County ${state.fips}`,
          fips: state.fips,
          state: (countyMeta.state ?? '').toUpperCase(),
          stateCode: ((countyMeta.state ?? '').substring(0, 2)).toUpperCase(),
          value: state.currentTotalVotes,
          reportingPercent: state.currentReportingPercent,
          demVotes: state.currentDemVotes,
          gopVotes: state.currentGopVotes,
          otherVotes: state.currentOtherVotes,
          margin: marginVotes,
          marginPercent,
          leader,
          isKeyCounty: state.currentTotalVotes > 50000 && Math.abs(marginPercent) < 5 // High volume + competitive
        })
      }
    })

    return nodes.sort((a, b) => b.value - a.value).slice(0, 200) // Top 200 counties
  }, [countyStates, countyLookup])

  // ===== Python Analytics Integration =====
  // Fetch enhanced analytics from Python service (throttled to every 10 seconds)
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastAnalyticsFetchRef.current
    const serviceState = pythonServiceStateRef.current

    // Only fetch if:
    // 1. At least 10 seconds have passed since last fetch
    // 2. We have meaningful data (reporting > 0%)
    if (timeSinceLastFetch < 10000 || aggregates.reportingPercent === 0) {
      return
    }

    if (serviceState.status === 'unavailable' && now < serviceState.retryAfter) {
      debugLog('[Python Analytics] Skipping analytics fetch during cooldown', {
        retryInMs: serviceState.retryAfter - now,
        consecutiveFailures: serviceState.consecutiveFailures
      })
      return
    }

    lastAnalyticsFetchRef.current = now

    const fetchEnhancedAnalytics = async () => {
      const attemptStartedAt = Date.now()

      try {
        let currentState = pythonServiceStateRef.current
        const shouldCheckHealth =
          currentState.status !== 'available' ||
          attemptStartedAt >= currentState.retryAfter

        if (shouldCheckHealth) {
          const healthy = await checkServiceHealth()

          currentState = pythonServiceStateRef.current

          if (!healthy) {
            pythonServiceStateRef.current = {
              status: 'unavailable',
              retryAfter: attemptStartedAt + PYTHON_SERVICE_FAILURE_COOLDOWN_MS,
              consecutiveFailures: currentState.consecutiveFailures + 1
            }
            debugWarn('[Python Analytics] Service health check failed; skipping analytics request', {
              retryInMs: pythonServiceStateRef.current.retryAfter - attemptStartedAt,
              attempts: pythonServiceStateRef.current.consecutiveFailures
            })
            return
          }

          pythonServiceStateRef.current = {
            status: 'available',
            retryAfter: attemptStartedAt + PYTHON_SERVICE_SUCCESS_RECHECK_MS,
            consecutiveFailures: 0
          }
        }

        debugLog('[Python Analytics] Fetching enhanced analytics...', {
          reportingPercent: aggregates.reportingPercent,
          totalVotes: aggregates.totalVotes,
          margin: aggregates.voteMarginPercent
        })

        const elapsedMinutes = elapsedSeconds / 60
        const aggregatesPayload = transformAggregates(aggregates)
        const countiesPayload = transformCounties(
          Array.from(countyStates.values()).slice(0, 100)
        ) // Limit to 100 counties for performance

        debugLog('[Python Analytics] Payloads prepared:', {
          aggregates: aggregatesPayload,
          counties: countiesPayload.length
        })

        const [
          winProbResult,
          narrativeResult,
          raceCallResult,
          historicalResult,
          importanceResult
        ] = await Promise.allSettled([
          getEnhancedWinProbability(
            aggregatesPayload,
            countiesPayload,
            elapsedMinutes,
            aggregates.expectedTotalVotes
          ),
          generateNarrative(
            aggregatesPayload,
            countiesPayload
          ),
          evaluateRaceCall(
            aggregates.voteMarginPercent,
            Math.round(aggregates.voteMarginAbsolute),
            Math.round(aggregates.votesRemaining),
            aggregates.reportingPercent,
            countiesPayload
          ),
          findSimilarElections(
            {
              current_margin: aggregates.voteMarginPercent,
              reporting_percent: aggregates.reportingPercent
            },
            5,
            true
          ),
          rankCountyImportance(
            countiesPayload,
            aggregates.voteMarginPercent
          )
        ])

        const extractValue = <T,>(result: PromiseSettledResult<T>): T | null =>
          result.status === 'fulfilled' ? result.value : null

        const winProbResponse = extractValue(winProbResult)
        const narrativeResponse = extractValue(narrativeResult)
        const raceCallResponse = extractValue(raceCallResult)
        const historicalResponse = extractValue(historicalResult)
        const importanceResponse = extractValue(importanceResult)

        const successfulCount = [
          winProbResponse,
          narrativeResponse,
          raceCallResponse,
          historicalResponse,
          importanceResponse
        ].filter(Boolean).length

        if (successfulCount === 0) {
          const updatedState = pythonServiceStateRef.current
          pythonServiceStateRef.current = {
            status: 'unavailable',
            retryAfter: Date.now() + PYTHON_SERVICE_FAILURE_COOLDOWN_MS,
            consecutiveFailures: updatedState.consecutiveFailures + 1
          }
          debugWarn('[Python Analytics] Analytics responses were all empty; entering cooldown', {
            retryInMs: pythonServiceStateRef.current.retryAfter - Date.now(),
            attempts: pythonServiceStateRef.current.consecutiveFailures
          })
          return
        }

        pythonServiceStateRef.current = {
          status: 'available',
          retryAfter: Date.now() + PYTHON_SERVICE_SUCCESS_RECHECK_MS,
          consecutiveFailures: 0
        }

        debugLog('[Python Analytics] Responses received:', {
          winProbability: winProbResponse ? 'success' : 'null',
          narrative: narrativeResponse ? 'success' : 'null',
          raceCall: raceCallResponse ? 'success' : 'null',
          historical: historicalResponse ? 'success' : 'null',
          importance: importanceResponse ? 'success' : 'null'
        })

        if (winProbResponse) {
          setMlWinProbability({
            probability: winProbResponse.win_probability,
            confidenceInterval: winProbResponse.confidence_interval,
            leader: winProbResponse.leader,
            method: winProbResponse.method,
            featuresUsed: winProbResponse.features_used,
            timestamp: winProbResponse.timestamp
          })
        }

        if (narrativeResponse) {
          setNarrativeInsights({
            headline: narrativeResponse.headline,
            insights: narrativeResponse.insights,
            detailedAnalysis: narrativeResponse.detailed_analysis,
            sentiment: narrativeResponse.sentiment,
            timestamp: narrativeResponse.timestamp
          })
        }

        if (raceCallResponse) {
          setRaceCallData(raceCallResponse)
        }

        if (historicalResponse) {
          setHistoricalMatchData(historicalResponse)
        }

        if (importanceResponse) {
          debugLog('[Python Analytics] County importance data:', {
            rankedCount: importanceResponse.ranked_counties.length,
            bellwethers: importanceResponse.bellwethers.length,
            swingCounties: importanceResponse.swing_counties.length,
            topCounty: importanceResponse.ranked_counties[0]?.name
          })
          setCountyImportanceData(importanceResponse)
        }
      } catch (error) {
        const updatedState = pythonServiceStateRef.current
        pythonServiceStateRef.current = {
          status: 'unavailable',
          retryAfter: Date.now() + PYTHON_SERVICE_FAILURE_COOLDOWN_MS,
          consecutiveFailures: updatedState.consecutiveFailures + 1
        }
        debugWarn('Python analytics fetch error:', {
          error,
          retryInMs: pythonServiceStateRef.current.retryAfter - Date.now(),
          attempts: pythonServiceStateRef.current.consecutiveFailures
        })
      }
    }

    fetchEnhancedAnalytics()
  }, [aggregates, countyStates, elapsedSeconds])

  return {
    aggregates,
    metrics,
    leaderboard,
    voteShareSeries,
    newsroomEvents,
    heatmap,
    turnoutTrajectory,
    marginShifts,
    focusCounty,
    alerts,
    // Phase 1 Enhancement Data
    historicalSnapshots,
    marginEvents,
    outstandingVotesByState,
    countyTreemapNodes,
    // Python Analytics Enhancement Data
    mlWinProbability,
    narrativeInsights,
    raceCallData,
    historicalMatchData,
    countyImportanceData
  }
}
