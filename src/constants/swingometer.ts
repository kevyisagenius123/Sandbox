import type { SwingKnobKey, SwingKnobs } from '../types/swingometer'

export const DEFAULT_KNOBS: SwingKnobs = {
  nationalShift: -1.5,
  turnoutMultiplier: 0.97,
  persuasionCeiling: 1.2,
  thirdPartyShare: 2.4,
  demSwingPct: 0,
  gopSwingPct: 0,
  turnoutShiftPct: 0,
  whiteTurnoutAdjust: 0,
  blackTurnoutAdjust: 0,
  hispanicTurnoutAdjust: 0,
  asianTurnoutAdjust: 0,
  collegeTurnoutAdjust: 0,
  ruralTurnoutAdjust: 0,
  suburbanTurnoutAdjust: 0,
  urbanTurnoutAdjust: 0
}

export interface SwingKnobConfig {
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
  description?: string
  unit?: string
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`
const formatPercentWhole = (value: number) => `${value.toFixed(0)}%`
const formatMultiplier = (value: number) => `${value.toFixed(2)}×`

export const SWING_KNOB_CONFIG: Record<SwingKnobKey, SwingKnobConfig> = {
  nationalShift: {
    label: 'National swing',
    min: -8,
    max: 8,
    step: 0.1,
    format: formatPercent,
    description: 'Points added to Democratic vote share nationally'
  },
  turnoutMultiplier: {
    label: 'Turnout multiplier',
    min: 0.85,
    max: 1.15,
    step: 0.005,
    format: formatMultiplier,
    description: 'Scales projected turnout relative to 2020 baseline'
  },
  persuasionCeiling: {
    label: 'Persuasion ceiling',
    min: 0,
    max: 4,
    step: 0.05,
    format: formatPercent,
    description: 'Maximum persuasion lift granted to target party'
  },
  thirdPartyShare: {
    label: 'Third-party floor',
    min: 0,
    max: 8,
    step: 0.1,
    format: formatPercent,
    description: 'Floor placed under non-major-party share'
  },
  demSwingPct: {
    label: 'Democratic swing',
    min: -12,
    max: 12,
    step: 0.1,
    format: formatPercent,
    description: 'Additive pp swing applied to Democratic vote share'
  },
  gopSwingPct: {
    label: 'Republican swing',
    min: -12,
    max: 12,
    step: 0.1,
    format: formatPercent,
    description: 'Additive pp swing applied to Republican vote share'
  },
  turnoutShiftPct: {
    label: 'Turnout shift',
    min: -25,
    max: 25,
    step: 0.5,
    format: formatPercent,
    description: 'Scales total votes before demographic adjustments'
  },
  whiteTurnoutAdjust: {
    label: 'White turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Delta applied to white turnout weighting'
  },
  blackTurnoutAdjust: {
    label: 'Black turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Delta applied to Black turnout weighting'
  },
  hispanicTurnoutAdjust: {
    label: 'Hispanic turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Delta applied to Hispanic turnout weighting'
  },
  asianTurnoutAdjust: {
    label: 'Asian turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Delta applied to Asian turnout weighting'
  },
  collegeTurnoutAdjust: {
    label: 'College-educated',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Adjusts turnout for college-educated cohorts'
  },
  ruralTurnoutAdjust: {
    label: 'Rural turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Adjusts turnout for rural counties'
  },
  suburbanTurnoutAdjust: {
    label: 'Suburban turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Adjusts turnout for suburban counties'
  },
  urbanTurnoutAdjust: {
    label: 'Urban turnout',
    min: -50,
    max: 50,
    step: 1,
    format: formatPercentWhole,
    description: 'Adjusts turnout for urban counties'
  }
}
