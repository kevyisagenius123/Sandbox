/**
 * Python Analytics Service Client
 * 
 * Interfaces with the Python FastAPI analytics microservice for:
 * - ML-based win probability predictions
 * - Natural language narrative generation
 * - Anomaly detection in reporting patterns
 */

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_ANALYTICS_URL || 'http://localhost:8082'

const PYTHON_REQUEST_TIMEOUT_MS = Number.parseInt(
  import.meta.env.VITE_PYTHON_ANALYTICS_TIMEOUT_MS ?? '2500',
  10
)

const resolvedTimeout = Number.isFinite(PYTHON_REQUEST_TIMEOUT_MS) && PYTHON_REQUEST_TIMEOUT_MS > 0
  ? PYTHON_REQUEST_TIMEOUT_MS
  : 2500

const createTimeoutSignal = () => AbortSignal.timeout(resolvedTimeout)

// ============================================================================
// Types
// ============================================================================

export interface WinProbabilityResponse {
  win_probability: number
  confidence_interval: [number, number]
  leader: 'DEM' | 'GOP' | 'TIE'
  method: string
  features_used: string[]
  timestamp: string
}

export interface NarrativeResponse {
  headline: string
  insights: string[]
  detailed_analysis: string
  sentiment: 'tight' | 'comfortable_dem' | 'comfortable_gop'
  timestamp: string
}

export interface AnomalyResponse {
  anomalies_detected: boolean
  anomalous_counties: Array<{
    fips: string
    name: string
    state: string
    anomaly_type: string
    severity: number
    description: string
    z_score?: number
    turnout_ratio?: number
    margin_percent?: number
  }>
  overall_score: number
  timestamp: string
}

export interface ReportingOrderResponse {
  predicted_order: Array<{
    fips: string
    name: string
    state: string
    reporting_speed_score: number
    predicted_reporting_minutes: number
  }>
  batches: Record<number, string[]>
  timestamp: string
}

export interface ExitPoll {
  dem_support: number
  gop_support: number
  sample_size: number
  quality: string
  days_old?: number
}

export interface ExitPollBlendResponse {
  dem_support: number
  gop_support: number
  margin: number
  uncertainty: number
  confidence_interval: [number, number]
  method: string
  polls_used: number
  reporting_percent: number
  timestamp: string
}

export interface HistoricalElection {
  election: {
    year: number
    state: string
    final_margin: number
    reporting_percent: number
    [key: string]: any
  }
  similarity_score: number
  year: number
  state: string
  final_margin: number
  reporting_percent: number
}

export interface HistoricalMatchResponse {
  similar_elections: HistoricalElection[]
  predicted_margin: number | null
  confidence: string | null
  timestamp: string
}

export interface RaceCallResponse {
  callable: boolean
  reason: string
  confidence: number
  winner?: string
  certainty?: string
  recommendation?: string
  timestamp: string
}

export interface CountyImportanceResponse {
  ranked_counties: Array<{
    name: string
    importance_score: number
    vote_share: number
    swing_potential: number
    bellwether_accuracy: number
    reporting_speed_rank: number
    impact_type: string
    rank: number
  }>
  bellwethers: Array<{
    name: string
    accuracy: number
    elections_tracked: number
    current_margin: number
    vote_share: number
  }>
  swing_counties: Array<{
    name: string
    margin: number
    vote_share: number
    swing_potential: number
    population: number
  }>
  timestamp: string
}

interface AggregatesPayload {
  dem_votes: number
  gop_votes: number
  total_votes: number
  votes_remaining: number
  reporting_percent: number
  margin_percent: number
  leader: string
}

interface CountyPayload {
  fips: string
  name: string
  state: string
  dem_votes: number
  gop_votes: number
  total_votes: number
  reporting_percent: number
  expected_votes: number
  is_key_county?: boolean
  population?: number
  county_type?: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get ML-based win probability prediction
 * 
 * @param aggregates - Aggregate vote totals
 * @param counties - County-level results
 * @param elapsedMinutes - Time elapsed in simulation
 * @returns Win probability with confidence interval, or null on error
 */
export async function getEnhancedWinProbability(
  aggregates: AggregatesPayload,
  counties: CountyPayload[],
  elapsedMinutes: number,
  totalExpectedVotes: number = 250000000
): Promise<WinProbabilityResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/predict/win-probability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(), // Configurable timeout
      body: JSON.stringify({
        aggregates,
        counties,
        elapsed_minutes: elapsedMinutes,
        total_expected_votes: totalExpectedVotes
      })
    })
    
    if (!response.ok) {
      console.warn(`Python analytics returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Python analytics timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Python analytics unavailable:', error)
    }
    return null // Graceful degradation
  }
}

/**
 * Generate natural language narrative about race state
 * 
 * @param aggregates - Aggregate vote totals
 * @param counties - County-level results
 * @param historicalMargin - Optional historical margin for comparison
 * @param keyEvents - Optional list of key events
 * @returns Narrative with headline, insights, analysis, or null on error
 */
export async function generateNarrative(
  aggregates: AggregatesPayload,
  counties: CountyPayload[],
  historicalMargin?: number,
  keyEvents?: string[]
): Promise<NarrativeResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/narrative/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(),
      body: JSON.stringify({
        aggregates,
        counties,
        historical_margin: historicalMargin,
        key_events: keyEvents
      })
    })
    
    if (!response.ok) {
      console.warn(`Python narrative returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Narrative generation timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Narrative generation unavailable:', error)
    }
    return null
  }
}

/**
 * Detect anomalies in county reporting patterns
 * 
 * @param counties - County-level results
 * @param reportingVelocity - Counties reporting per minute
 * @returns Anomaly detection results, or null on error
 */
export async function detectAnomalies(
  counties: CountyPayload[],
  reportingVelocity: number
): Promise<AnomalyResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/anomaly/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(),
      body: JSON.stringify({
        counties,
        reporting_velocity: reportingVelocity
      })
    })
    
    if (!response.ok) {
      console.warn(`Python anomaly detection returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Anomaly detection timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Anomaly detection unavailable:', error)
    }
    return null
  }
}

/**
 * Check if Python analytics service is available
 * 
 * @returns true if service is healthy, false otherwise
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/health`, {
  signal: AbortSignal.timeout(Math.min(resolvedTimeout, 2000))
    })
    return response.ok
  } catch {
    return false
  }
}

// ============================================================================
// Advanced Analytics Functions
// ============================================================================

/**
 * Predict county reporting order using ML features
 * 
 * @param counties - County-level data
 * @param state - State code
 * @returns Predicted reporting order and batch assignments, or null on error
 */
export async function predictReportingOrder(
  counties: CountyPayload[],
  state: string
): Promise<ReportingOrderResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/predict/reporting-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(),
      body: JSON.stringify({
        counties,
        state
      })
    })
    
    if (!response.ok) {
      console.warn(`Reporting order prediction returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Reporting order prediction timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Reporting order prediction unavailable:', error)
    }
    return null
  }
}

/**
 * Blend exit polls using Bayesian inference
 * 
 * @param polls - Array of exit poll data
 * @param actualResults - Optional actual vote results to blend with polls
 * @param reportingPercent - Percentage of votes counted
 * @returns Blended poll estimate with uncertainty, or null on error
 */
export async function blendExitPolls(
  polls: ExitPoll[],
  actualResults?: AggregatesPayload,
  reportingPercent: number = 0
): Promise<ExitPollBlendResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/polls/bayesian-blend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(),
      body: JSON.stringify({
        polls,
        actual_results: actualResults,
        reporting_percent: reportingPercent
      })
    })
    
    if (!response.ok) {
      console.warn(`Exit poll blending returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Exit poll blending timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Exit poll blending unavailable:', error)
    }
    return null
  }
}

/**
 * Find similar historical elections using k-NN pattern matching
 * 
 * @param currentRace - Current race data with margin evolution
 * @param k - Number of similar elections to find
 * @param includeIncomplete - Whether to include incomplete historical counts
 * @returns Similar elections with predicted margin, or null on error
 */
export async function findSimilarElections(
  currentRace: {
    current_margin: number
    reporting_percent: number
    urban_vote_share?: number
    turnout_rate?: number
    mail_ballot_pct?: number
    early_vote_pct?: number
    key_county_correlation?: number
    margin_history?: number[]
  },
  k: number = 5,
  includeIncomplete: boolean = false
): Promise<HistoricalMatchResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/analysis/historical-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
  signal: createTimeoutSignal(),
      body: JSON.stringify({
        current_race: currentRace,
        k,
        include_incomplete: includeIncomplete
      })
    })
    
    if (!response.ok) {
      console.warn(`Historical matching returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Historical matching timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Historical matching unavailable:', error)
    }
    return null
  }
}

/**
 * Evaluate whether race can be called with statistical confidence
 * 
 * @param currentMargin - Current margin in percentage points
 * @param currentMarginVotes - Current margin in absolute votes
 * @param outstandingVotes - Estimated votes still to be counted
 * @param reportingPercent - Percentage of precincts reporting
 * @param counties - County-level data
 * @returns Race call decision with confidence and reasoning, or null on error
 */
export async function evaluateRaceCall(
  currentMargin: number,
  currentMarginVotes: number,
  outstandingVotes: number,
  reportingPercent: number,
  counties: CountyPayload[]
): Promise<RaceCallResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/predict/race-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: createTimeoutSignal(),
      body: JSON.stringify({
        current_margin: currentMargin,
        current_margin_votes: currentMarginVotes,
        outstanding_votes: outstandingVotes,
        reporting_percent: reportingPercent,
        county_data: counties
      })
    })
    
    if (!response.ok) {
      console.warn(`Race call evaluation returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`Race call evaluation timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('Race call evaluation unavailable:', error)
    }
    return null
  }
}

/**
 * Rank counties by importance using mutual information
 * 
 * @param counties - County-level data
 * @param stateMargin - Current statewide margin
 * @returns County importance rankings with bellwethers and swing counties, or null on error
 */
export async function rankCountyImportance(
  counties: CountyPayload[],
  stateMargin: number
): Promise<CountyImportanceResponse | null> {
  try {
    const response = await fetch(`${PYTHON_API_BASE}/api/analysis/county-importance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: createTimeoutSignal(),
      body: JSON.stringify({
        counties,
        state_margin: stateMargin
      })
    })
    
    if (!response.ok) {
      console.warn(`County importance analysis returned ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`County importance analysis timeout (${resolvedTimeout}ms)`)
    } else {
      console.warn('County importance analysis unavailable:', error)
    }
    return null
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to transform ResultsSummary aggregates to Python format
 */
export function transformAggregates(aggregates: any): AggregatesPayload {
  return {
    dem_votes: Math.round(aggregates.totalDem || 0),
    gop_votes: Math.round(aggregates.totalGop || 0),
    total_votes: Math.round(aggregates.totalVotes || 0),
    votes_remaining: Math.round(aggregates.votesRemaining || 0),
    reporting_percent: aggregates.reportingPercent || 0,
    margin_percent: aggregates.voteMarginPercent || 0,
    leader: aggregates.leader || 'TIE'
  }
}

/**
 * Helper to transform county results to Python format
 */
export function transformCounties(counties: any[]): CountyPayload[] {
  return counties.map(county => ({
    fips: county.fips || '',
    name: county.name || '',
    state: county.state || '',
    dem_votes: Math.round(county.demVotes || 0),
    gop_votes: Math.round(county.gopVotes || 0),
    total_votes: Math.round(county.totalVotes || 0),
    reporting_percent: county.reportingPercent || 0,
    expected_votes: Math.round(county.expectedVotes || county.totalVotes || 0),
    is_key_county: county.isKeyCounty || false,
    population: county.population,
    county_type: county.countyType
  }))
}
