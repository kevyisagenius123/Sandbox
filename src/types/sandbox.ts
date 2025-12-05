// State Sandbox Simulation - TypeScript Interfaces
// Based on STATE_SANDBOX_SIMULATION_DESIGN.md

/**
 * County-level election result
 */
export interface CountyResult {
  fips: string
  state: string
  county: string
  gopVotes: number
  demVotes: number
  otherVotes: number
  totalVotes: number
  reportingPercent: number
  population?: number
  geography?: 'rural' | 'suburban' | 'urban'
}

export interface CountyGeoMetadata {
  countyName?: string
  stateFips?: string
  stateName?: string
}

/**
 * Party vote breakdown for a demographic group
 */
export interface PartyBreakdown {
  dem: number
  gop: number
  other: number
}

/**
 * Exit poll data structure
 */
export interface ExitPoll {
  year: number
  state: string
  demographics: {
    race?: Record<string, PartyBreakdown>
    education?: Record<string, PartyBreakdown>
    geography?: Record<string, PartyBreakdown>
    age?: Record<string, PartyBreakdown>
  }
  turnoutRates?: Record<string, number>
}

/**
 * Reporting wave configuration for a single county
 */
export interface ReportingWave {
  atSeconds: number
  percent: number
  votesDem?: number  // Optional: override actual votes
  votesGop?: number
}

/**
 * County-specific reporting configuration
 */
export interface CountyReporting {
  fips: string
  mode?: 'schedule' | 'manual' | 'batch'
  reportingWaves: ReportingWave[]
  manualTrigger?: boolean
  batchGroup?: string
  batchTriggerTime?: number
}

/**
 * Group-based reporting rule
 */
export interface GroupRule {
  name: string
  filter: Record<string, any>
  pattern: {
    startSeconds: number
    endSeconds: number
    initialPercent: number
    finalPercent: number
  }
}

/**
 * Randomization configuration
 */
export interface RandomizationConfig {
  enabled: boolean
  jitterSeconds: number
  seed?: number
}

/**
 * Complete reporting configuration
 */
export interface ReportingConfig {
  version: string
  description?: string
  baseTimestamp: string
  counties: CountyReporting[]
  groupRules: GroupRule[]
  randomization?: RandomizationConfig
}

/**
 * Scenario metadata
 */
export interface ScenarioMetadata {
  year: number
  scope: 'national' | 'state' | 'county'
  states: string[]
  totalCounties: number
  totalVotes: number
  license: string
}

/**
 * Complete scenario definition
 */
export interface Scenario {
  id: string
  name: string
  description: string
  author: string
  created: string
  tags: string[]
  visibility: 'public' | 'unlisted' | 'private'
  countyResults: CountyResult[]
  exitPolls?: ExitPoll
  reportingConfig?: ReportingConfig
  metadata: ScenarioMetadata
}

export interface NewsroomEvent {
  id: string
  type: string
  headline: string
  detail?: string
  state?: string
  stateFips?: string
  margin?: number
  reportingPercent?: number
  simulationTimeSeconds: number
  severity?: 'info' | 'success' | 'warning' | 'danger' | string
  timestamp: string
}

/**
 * Simulation state (for runtime)
 */
export interface SimulationState {
  isPlaying: boolean
  isPaused: boolean
  currentTimeSeconds: number
  speed: number
  countyStates: Map<string, CountySimulationState>
}

/**
 * Runtime state for a single county during simulation
 */
export interface CountySimulationState {
  fips: string
  currentReportingPercent: number
  currentDemVotes: number
  currentGopVotes: number
  currentOtherVotes: number
  currentTotalVotes: number
  lastUpdateTime: number
  isFullyReported: boolean
}

/**
 * Upload validation result
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  row?: number
  column?: string
  message: string
  severity: 'error'
}

export interface ValidationWarning {
  row?: number
  column?: string
  message: string
  severity: 'warning'
}

/**
 * CSV upload format (raw from file)
 */
export interface CountyResultCSV {
  fips: string
  state: string
  county: string
  // Support multiple column name variants for GOP/Republican votes
  gop_votes?: string | number
  rep_votes?: string | number
  republican_votes?: string | number
  votes_gop?: string | number
  votes_rep?: string | number
  // Democrat votes
  dem_votes: string | number
  other_votes?: string | number
  total_votes: string | number
  reporting_percent?: string | number
  population?: string | number
  geography?: string
}
