import React from 'react'
import { ScenarioUploader } from '../ScenarioUploader'
import type { CountyResult, ExitPoll, ReportingConfig } from '../../../types/sandbox'

interface ScenarioUploaderPanelProps {
  showWelcome: boolean
  onDismissWelcome: () => void
  exitPolls: ExitPoll | null
  onCountyDataLoaded: (data: CountyResult[], rawCsv: string) => void
  onExitPollsLoaded: (polls: ExitPoll) => void
  onReportingConfigLoaded: (config: ReportingConfig) => void
}

export const ScenarioUploaderPanel: React.FC<ScenarioUploaderPanelProps> = ({
  showWelcome,
  onDismissWelcome,
  exitPolls,
  onCountyDataLoaded,
  onExitPollsLoaded,
  onReportingConfigLoaded
}) => {
  return (
    <div className="space-y-4">
      {showWelcome && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 px-5 py-4 text-sm text-blue-100 shadow">
          <p className="font-semibold text-blue-200">Welcome to Sandbox Studio</p>
          <p className="mt-2 text-xs text-blue-100/80">
            Start by uploading a county-level CSV. Optional exit polls and reporting JSON unlock deeper analytics.
          </p>
          <button
            type="button"
            onClick={onDismissWelcome}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
          >
            Got it
          </button>
        </div>
      )}
      <ScenarioUploader
        onCountyDataLoaded={onCountyDataLoaded}
        onExitPollsLoaded={onExitPollsLoaded}
        onReportingConfigLoaded={onReportingConfigLoaded}
      />
      {exitPolls && (
        <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs text-purple-100">
          <div className="flex items-center justify-between text-sm font-semibold text-purple-200">
            <span>
              {exitPolls.state || 'Statewide'} | {exitPolls.year}
            </span>
            <span className="text-purple-300">
              {Object.keys(exitPolls.demographics ?? {}).length} cohorts
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
