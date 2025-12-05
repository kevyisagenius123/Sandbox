import React from 'react'
import { BottomAnalyticsDock } from '../../sandbox/BottomAnalyticsDock'
import { useSandboxTheme } from '../../../design/SandboxThemeProvider'
import type { CountyResult, CountySimulationState, NewsroomEvent } from '../../../types/sandbox'
import type { DemographicSynthesisResponse } from '../../../services/demographicService'

type SandboxStudioFooterProps = {
  isScenarioLoaded: boolean
  countyCount: number
  isPlaying: boolean
  speed: number
  progress: number
  timelinePercent: number
  currentTimeSeconds: number
  countyStates: Map<string, CountySimulationState>
  countyResults: CountyResult[]
  totalDurationSeconds: number
  isPlaybackReady: boolean
  onTimelineScrub?: (percent: number) => void
  onShowKeyboardHelp: () => void
  newsroomEvents: NewsroomEvent[]
  demographicData?: Map<string, DemographicSynthesisResponse>
  nationalMargin?: number
}

export const SandboxStudioFooter: React.FC<SandboxStudioFooterProps> = ({
  isScenarioLoaded,
  countyCount,
  isPlaying,
  speed,
  progress,
  timelinePercent,
  currentTimeSeconds,
  countyStates,
  countyResults,
  totalDurationSeconds,
  isPlaybackReady,
  onTimelineScrub,
  onShowKeyboardHelp,
  newsroomEvents,
  demographicData,
  nationalMargin
}) => {
  const { theme } = useSandboxTheme()

  return (
    <footer
      className="border-t"
      style={{
        background: theme.surfaces.footer.background,
        borderColor: theme.surfaces.footer.borderColor,
        boxShadow: theme.surfaces.footer.boxShadow
      }}
    >
      <div
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-xs"
        style={{ color: theme.palette.text.muted }}
      >
        <span>{isScenarioLoaded ? `${countyCount.toLocaleString()} counties loaded` : 'Awaiting scenario upload'}</span>
        <div className="flex items-center gap-4">
          <span>{isPlaying ? 'Live playback' : 'Paused'} | {speed.toFixed(1)}x</span>
          <button
            type="button"
            onClick={onShowKeyboardHelp}
            className="rounded border px-3 py-1 text-xs font-medium transition"
            style={{
              borderColor: theme.surfaces.footer.borderColor,
              color: theme.palette.text.primary,
              background: 'rgba(255,255,255,0.04)'
            }}
          >
            Keyboard Shortcuts
          </button>
        </div>
      </div>
      <BottomAnalyticsDock
        timelinePercent={timelinePercent}
        reportingPercent={progress}
        currentTimeSeconds={currentTimeSeconds}
        totalDuration={totalDurationSeconds}
        countyStates={countyStates}
        isPlaying={isPlaying}
        countyResults={countyResults}
        isScrubEnabled={isPlaybackReady}
        onScrub={onTimelineScrub}
        newsroomEvents={newsroomEvents}
        demographicData={demographicData}
        nationalMargin={nationalMargin}
      />
    </footer>
  )
}

export default SandboxStudioFooter
