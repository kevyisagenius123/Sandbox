export interface SwingKnobs {
  nationalShift: number
  turnoutMultiplier: number
  persuasionCeiling: number
  thirdPartyShare: number
  demSwingPct: number
  gopSwingPct: number
  turnoutShiftPct: number
  whiteTurnoutAdjust: number
  blackTurnoutAdjust: number
  hispanicTurnoutAdjust: number
  asianTurnoutAdjust: number
  collegeTurnoutAdjust: number
  ruralTurnoutAdjust: number
  suburbanTurnoutAdjust: number
  urbanTurnoutAdjust: number
}

export type SwingKnobKey = keyof SwingKnobs

export interface CountyBaselineRecord {
  fips: string
  stateFips: string
  countyName: string
  year: number
  totalVotes: number
  votesGop: number
  votesDem: number
  baselineMarginPct: number
  votesGop2024?: number
  votesDem2024?: number
  totalVotes2024?: number
}

export interface CountyFrameSnapshot {
  fips: string
  gop: number
  dem: number
  total: number
  reportingPct: number
  marginPct: number
  leader: 'GOP' | 'DEM' | 'TIED' | 'NONE'
  ts: number
}

export interface ScenarioParams {
  demSwingPct: number
  gopSwingPct: number
  turnoutShiftPct: number
  baseYear?: number | null
  running?: boolean
  useDemographicTurnout?: boolean
}

export interface DemographicAdjustments {
  whiteTurnoutAdjust?: number
  blackTurnoutAdjust?: number
  hispanicTurnoutAdjust?: number
  asianTurnoutAdjust?: number
  collegeTurnoutAdjust?: number
  ruralTurnoutAdjust?: number
  suburbanTurnoutAdjust?: number
  urbanTurnoutAdjust?: number
  whiteDemSharePct?: number | null
  blackDemSharePct?: number | null
  hispanicDemSharePct?: number | null
  asianDemSharePct?: number | null
  collegeDemSharePct?: number | null
  noncollegeDemSharePct?: number | null
  ruralDemSharePct?: number | null
  suburbanDemSharePct?: number | null
  urbanDemSharePct?: number | null
}

export type TimelineResponse = Record<number, CountyBaselineRecord[]>

export interface ExitPollResponse {
  year: number
  demographics: Record<string, { gopShare: number; demShare: number }>
}

export interface BaselineResponse {
  states: string[]
  counties: CountyBaselineRecord[]
}

export interface BaselineYearsResponse {
  years: number[]
  activeBaseYear?: number | null
}
