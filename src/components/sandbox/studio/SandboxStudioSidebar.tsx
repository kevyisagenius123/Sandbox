import React from 'react'
import { ScenarioUploader } from '../../sandbox/ScenarioUploader'
import { SimulationControls } from '../../sandbox/SimulationControls'
import { AnalyticsPanel } from '../../sandbox/AnalyticsPanel'
import { SidebarSection } from '../../sandbox/SidebarSection'
import { ReportingConfigEditor } from '../../sandbox/ReportingConfigEditor'
import { useSandboxTheme } from '../../../design/SandboxThemeProvider'
import type { CountyResult, CountySimulationState, ExitPoll, ReportingConfig } from '../../../types/sandbox'
import type { SimulationStatus } from './types'

export type SandboxStudioSidebarProps = {
  scenarioName: string
  isFullscreenMode: boolean
  isScenarioLoaded: boolean
  showWelcome: boolean
  onDismissWelcome: () => void
  exitPolls: ExitPoll | null
  onExitPollsLoaded: (polls: ExitPoll) => void
  onCountyDataLoaded: (data: CountyResult[], rawCsv: string) => void
  onReportingConfigLoaded: (config: ReportingConfig) => void
  reportingConfig: ReportingConfig | undefined
  isPlaying: boolean
  speed: number
  currentTimeSeconds: number
  progress: number
  timelinePercent: number
  status: SimulationStatus
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (value: number) => void
  onJumpTo: (seconds: number) => void
  totalDurationSeconds: number
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  analyticsOpen: boolean
  toggleAnalytics: () => void
}

export const SandboxStudioSidebar: React.FC<SandboxStudioSidebarProps> = ({
  scenarioName,
  isFullscreenMode,
  isScenarioLoaded,
  showWelcome,
  onDismissWelcome,
  exitPolls,
  onExitPollsLoaded,
  onCountyDataLoaded,
  onReportingConfigLoaded,
  reportingConfig,
  isPlaying,
  speed,
  currentTimeSeconds,
  progress,
  timelinePercent,
  status,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onJumpTo,
  totalDurationSeconds,
  countyResults,
  countyStates,
  analyticsOpen,
  toggleAnalytics
}) => {
  const { theme } = useSandboxTheme()

  if (isFullscreenMode) {
    return null
  }

  return (
    <aside
      className="w-full flex-shrink-0 overflow-y-auto border-b lg:max-w-[370px] lg:border-b-0 lg:border-r"
      style={{
        background: theme.surfaces.sidebar.background,
        borderColor: theme.surfaces.sidebar.borderColor,
        boxShadow: theme.surfaces.sidebar.boxShadow,
        backdropFilter: theme.surfaces.sidebar.backdropFilter
      }}
    >
      <div className="space-y-6 px-5 py-6">
        {showWelcome && (
          <WelcomeCard isScenarioLoaded={isScenarioLoaded} onDismiss={onDismissWelcome} />
        )}

        <SidebarSection title="Scenario Upload" description="Load baseline results, exit polls, and optional reporting config.">
          <ScenarioUploader
            onCountyDataLoaded={onCountyDataLoaded}
            onExitPollsLoaded={onExitPollsLoaded}
            onReportingConfigLoaded={onReportingConfigLoaded}
          />
        </SidebarSection>

        <SidebarSection title="Exit Poll Context" description="Optional data to power analytics comparisons.">
          {exitPolls ? (
            <ExitPollSummary exitPolls={exitPolls} />
          ) : (
            <p className="mt-3 text-xs text-gray-500">Upload exit polls alongside your scenario to unlock demographic readouts.</p>
          )}
        </SidebarSection>

        <ReportingConfigEditor
          countyResults={countyResults}
          scenarioName={scenarioName}
          value={reportingConfig}
          onChange={onReportingConfigLoaded}
        />

        <SimulationControls
          isPlaying={isPlaying}
          speed={speed}
          currentTimeSeconds={currentTimeSeconds}
          timelinePercent={timelinePercent}
          reportingPercent={progress}
          totalDurationSeconds={totalDurationSeconds}
          onPlay={onPlay}
          onPause={onPause}
          onReset={onReset}
          onSpeedChange={onSpeedChange}
          onJumpTo={onJumpTo}
        />

        <SidebarSection title="Analytics" description="Monitor live totals, exports, and turnout as precincts report.">
          <AnalyticsPanel
            countyResults={countyResults}
            countyStates={countyStates}
            currentTimeSeconds={currentTimeSeconds}
            isOpen={analyticsOpen}
            reportingConfig={reportingConfig}
            onToggle={toggleAnalytics}
          />
        </SidebarSection>

        <StatusHint status={status} />
      </div>
    </aside>
  )
}

type WelcomeCardProps = {
  isScenarioLoaded: boolean
  onDismiss: () => void
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ isScenarioLoaded, onDismiss }) => (
  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 px-5 py-4 text-sm text-blue-100 shadow">
    <p className="font-semibold text-blue-200">Welcome to the Sandbox Studio</p>
    <p className="mt-2 text-xs text-blue-100/80">
      {isScenarioLoaded ? 'Feel free to reopen this guide anytime from the header.' : 'Start by uploading a county-level CSV. Optional exit polls and reporting JSON unlock deeper analytics.'}
    </p>
    <button
      type="button"
      onClick={onDismiss}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/20"
    >
      Got it
    </button>
  </div>
)

type ExitPollSummaryProps = {
  exitPolls: ExitPoll
}

const ExitPollSummary: React.FC<ExitPollSummaryProps> = ({ exitPolls }) => {
  const segments = Object.entries(exitPolls.demographics ?? {})
    .filter(([, value]) => value && Object.keys(value).length > 0)
    .map(([key]) => key)

  return (
    <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs text-purple-100">
      <div className="flex items-center justify-between text-sm font-semibold text-purple-200">
        <span>{exitPolls.state || 'Statewide'} | {exitPolls.year}</span>
        <span className="text-purple-300">{segments.length} cohorts</span>
      </div>
      <p className="mt-1 text-[11px] text-purple-100/80">
        {segments.length > 0 ? `Loaded breakdowns: ${segments.join(', ')}` : 'No demographic breakdowns detected.'}
      </p>
    </div>
  )
}

type StatusHintProps = {
  status: SimulationStatus
}

const StatusHint: React.FC<StatusHintProps> = ({ status }) => (
  <div className="rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-xs text-gray-400">
    {status === 'idle' && 'Press play once data is uploaded to begin generating frames from the backend.'}
    {status === 'ready' && 'Scenario is ready. Start playback to open the live websocket feed.'}
    {status === 'running' && 'Simulation is streaming. Adjust speed or edit counties to test outcomes.'}
    {status === 'paused' && 'Paused. Resume or reset to regenerate the timeline.'}
    {status === 'completed' && 'Simulation reached 100% reporting. Reset to iterate on a new run.'}
    {status === 'uploading' && 'Uploading scenario assets to backend. Large CSVs may take a moment.'}
    {status === 'error' && 'An error occurred. Check backend logs or retry uploading the data.'}
  </div>
)

export default SandboxStudioSidebar
