import React from 'react'
import { AnalyticsPanel } from '../AnalyticsPanel'
import type { CountyResult, CountySimulationState, ReportingConfig } from '../../../types/sandbox'

interface AnalyticsDockPanelProps {
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  currentTimeSeconds: number
  isOpen: boolean
  reportingConfig: ReportingConfig | undefined
  onToggle: () => void
}

export const AnalyticsDockPanel: React.FC<AnalyticsDockPanelProps> = (props) => {
  return <AnalyticsPanel {...props} />
}
