import React from 'react'
import { ReportingConfigEditor } from '../ReportingConfigEditor'
import type { CountyResult, ReportingConfig } from '../../../types/sandbox'

interface ReportingConfigPanelProps {
  countyResults: CountyResult[]
  scenarioName: string
  reportingConfig: ReportingConfig | undefined
  onChange: (config: ReportingConfig) => void
}

export const ReportingConfigPanel: React.FC<ReportingConfigPanelProps> = ({ countyResults, scenarioName, reportingConfig, onChange }) => {
  return (
    <ReportingConfigEditor
      countyResults={countyResults}
      scenarioName={scenarioName}
      value={reportingConfig}
      onChange={onChange}
    />
  )
}
