import type { CountyResult, CountySimulationState, NewsroomEvent } from '../../../types/sandbox'

export interface ReportingStats {
  countiesReporting?: number
  countiesTotal?: number
}

export interface ResultsSummaryProps {
  countyStates: Map<string, CountySimulationState>
  countyResults?: CountyResult[]
  elapsedSeconds?: number
  totalDuration?: number
  isPlaying?: boolean
  newsroomEvents?: NewsroomEvent[]
  reportingStats?: ReportingStats
  simulationId?: string
}

import type { 
  RaceCallResponse, 
  HistoricalMatchResponse, 
  CountyImportanceResponse 
} from '../../../services/pythonAnalytics'

export type MarginParty = 'DEM' | 'GOP' | 'TIE'

export interface AggregateResults {
  totalDem: number
  totalGop: number
  totalOther: number
  totalVotes: number
  demPercent: number
  gopPercent: number
  otherPercent: number
  reportingPercent: number
  voteReportingPercent: number
  expectedTotalVotes: number
  votesRemaining: number
  countiesReporting: number
  totalCounties: number
  fullyReported: number
  inProgress: number
  notStarted: number
  voteMarginPercent: number
  voteMarginAbsolute: number
  leader: MarginParty
  winProbability: number
  reportingEtaSeconds: number | null
  voteEtaSeconds: number | null
}

export interface StateLeaderboardRow {
  label: string
  reported: number
  expected: number
  reportingPercent: number
  demVotes: number
  gopVotes: number
  leader: 'D' | 'R' | 'Tie'
  marginVotes: number
  marginPercent: number
}

export interface HeatmapEntry {
  fips: string
  name: string
  state: string
  reportingPercent: number
  marginPercent: number
  marginVotes: number
  party: MarginParty
  remainingVotes: number
}

export interface TrajectoryPoint {
  label: string
  actual: number
  expected: number
}

export interface MarginShiftItem {
  id: string
  label: string
  deltaPercent: number
  marginPercent: number
  party: MarginParty
  timestamp: string
}

export interface CountyFocusSnapshot {
  fips: string
  name: string
  state: string
  reportingPercent: number
  marginVotes: number
  marginPercent: number
  party: MarginParty
  remainingVotes: number
  trend: Array<{ label: string; reportingPercent: number }>
}

export interface AlertNotice {
  id: string
  headline: string
  detail?: string
  severity: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  timestamp: string
}

export interface SummaryData {
  aggregates: AggregateResults
  metrics: Array<{
    id: string
    label: string
    value: string
    helper?: string
    trend?: 'up' | 'down' | 'neutral'
  }>
  leaderboard: StateLeaderboardRow[]
  voteShareSeries: { name: string; value: number }[]
  newsroomEvents: NewsroomEvent[]
  heatmap: HeatmapEntry[]
  turnoutTrajectory: TrajectoryPoint[]
  marginShifts: MarginShiftItem[]
  focusCounty: CountyFocusSnapshot | null
  alerts: AlertNotice[]
  // Phase 1 Enhancement Data
  historicalSnapshots: HistoricalSnapshot[]
  marginEvents: MarginEvent[]
  outstandingVotesByState: OutstandingVotesByState[]
  countyTreemapNodes: CountyTreemapNode[]
  // Python Analytics Enhancement Data
  mlWinProbability: MLWinProbability | null
  narrativeInsights: NarrativeInsights | null
  raceCallData: RaceCallResponse | null
  historicalMatchData: HistoricalMatchResponse | null
  countyImportanceData: CountyImportanceResponse | null
}

/**
 * ML-based win probability from Python analytics service
 */
export interface MLWinProbability {
  probability: number // 0-100
  confidenceInterval: [number, number] // [lower, upper]
  leader: MarginParty
  method: string // e.g., "ml_ensemble"
  featuresUsed: string[]
  timestamp: string
}

/**
 * Auto-generated narrative insights from Python analytics service
 */
export interface NarrativeInsights {
  headline: string // Main headline
  insights: string[] // Bullet points (3-5)
  detailedAnalysis: string // Full paragraph
  sentiment: 'tight' | 'comfortable_dem' | 'comfortable_gop'
  timestamp: string
}

// ===== Phase 1 Enhancement Types =====

/**
 * Historical snapshot of margin at a point in time
 * Used for MarginTimelineChart to show evolution
 */
export interface HistoricalSnapshot {
  timestamp: number // Unix timestamp in milliseconds
  elapsedMinutes: number // Minutes since simulation start
  reportingPercent: number // 0-100
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  margin: number // Absolute vote margin (positive = GOP lead, negative = DEM lead)
  marginPercent: number // Margin as percentage of total votes
  leader: MarginParty
}

/**
 * Key event marker for timeline charts
 * E.g., "Major county reported", "Projection made", etc.
 */
export interface MarginEvent {
  timestamp: number // Unix timestamp in milliseconds
  elapsedMinutes: number
  label: string // Short label for mark line
  description?: string // Detailed description for tooltip
  type?: 'county-report' | 'projection' | 'milestone' | 'other'
}

/**
 * Outstanding votes analysis by state
 * Used for OutstandingVotesChart
 */
export interface OutstandingVotesByState {
  state: string // Full state name
  stateCode: string // Two-letter code
  outstanding: number // Total outstanding votes
  outstandingPercent: number // % of total state expected votes
  demLean: number // Estimated votes for Democratic candidate
  gopLean: number // Estimated votes for Republican candidate
  uncertain: number // Swing/uncertain votes
  potentialSwing: number // Maximum margin change if all go one way
  currentMargin: number // Current vote margin in state
  reportingPercent: number // Current reporting %
}

/**
 * County data for treemap visualization
 * Used for CountyReportingTreemap
 */
export interface CountyTreemapNode {
  name: string // County name
  fips: string
  state: string // State name for grouping
  stateCode: string
  value: number // Total votes (for size)
  reportingPercent: number // 0-100 (for color)
  demVotes: number
  gopVotes: number
  otherVotes: number
  margin: number
  marginPercent: number
  leader: MarginParty
  isKeyCounty?: boolean // Bellwether or high-impact
}

/**
 * Key county with normalized metrics for radar charts
 * Used for KeyCountiesRadar (Phase 3)
 */
export interface KeyCounty {
  name: string
  fips: string
  state: string
  stateCode: string
  // Normalized metrics (0-100 scale)
  turnout: number // Turnout performance vs expected
  marginShift: number // How much margin shifted from baseline
  voteVolume: number // Relative vote size
  reportingSpeed: number // How fast votes were counted
  vsBaseline: number // Performance vs historical baseline
  // Raw values for tooltips
  rawTurnoutPercent: number
  rawMarginPercent: number
  rawTotalVotes: number
}

/**
 * County metrics for parallel coordinates and other multi-dimensional charts
 * Used for ParallelCoordinatesChart (Phase 4)
 */
export interface CountyMetrics {
  name: string
  fips: string
  state: string
  stateCode: string
  // Multiple dimensions for analysis
  turnoutPercent: number
  marginPercent: number
  totalVotes: number
  reportingSpeed: number // Votes per minute
  vsExpected: number // Performance delta vs expected margin
  densityScore: number // Urban/rural score
  competitivenessScore: number // How competitive the county is
}
