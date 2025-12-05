import React, { useMemo, useState } from 'react'
import type { DemographicAdjustments, ScenarioParams } from '../../types/swingometer'

type ScenarioSliderKey = 'demSwingPct' | 'gopSwingPct' | 'turnoutShiftPct'

interface SliderConfig<K extends string> {
  key: K
  label: string
  min: number
  max: number
  step: number
  format?: (val: number) => string
  helper?: string
}

interface SwingometerOverlayProps {
  scenarioParams: ScenarioParams | null
  availableBaseYears: number[]
  onScenarioChange: (patch: Partial<ScenarioParams>) => void
  demographicAdjustments: DemographicAdjustments
  onDemographicChange: (key: keyof DemographicAdjustments, value: number) => void
  onResetDemographics: () => void
  useDemographicTurnout: boolean
  onToggleDemographicTurnout: (enabled: boolean) => void
  demographicSaving?: boolean
}

const SCENARIO_SLIDERS: SliderConfig<ScenarioSliderKey>[] = [
  { key: 'demSwingPct', label: 'Democratic Swing (pp)', min: -12, max: 12, step: 0.1, format: (v) => `${v.toFixed(1)}%`, helper: 'Applied to Democratic share before normalization' },
  { key: 'gopSwingPct', label: 'Republican Swing (pp)', min: -12, max: 12, step: 0.1, format: (v) => `${v.toFixed(1)}%`, helper: 'Applied to Republican share before normalization' },
  { key: 'turnoutShiftPct', label: 'Turnout Shift', min: -25, max: 25, step: 0.5, format: (v) => `${v.toFixed(1)}%`, helper: 'Scales county totals before demographic engine' }
]

const DEMOGRAPHIC_SLIDERS: SliderConfig<keyof DemographicAdjustments>[] = [
  { key: 'whiteTurnoutAdjust', label: 'White Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'blackTurnoutAdjust', label: 'Black Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'hispanicTurnoutAdjust', label: 'Hispanic Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'asianTurnoutAdjust', label: 'Asian Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'collegeTurnoutAdjust', label: 'College-Educated', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'ruralTurnoutAdjust', label: 'Rural Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'suburbanTurnoutAdjust', label: 'Suburban Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent },
  { key: 'urbanTurnoutAdjust', label: 'Urban Turnout', min: -25, max: 25, step: 0.5, format: formatSignedPercent }
]

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export const SwingometerOverlay: React.FC<SwingometerOverlayProps> = ({
  scenarioParams,
  availableBaseYears,
  onScenarioChange,
  demographicAdjustments,
  onDemographicChange,
  onResetDemographics,
  useDemographicTurnout,
  onToggleDemographicTurnout,
  demographicSaving
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'general' | 'demographics'>('general')

  const sortedYears = useMemo(() => [...availableBaseYears].sort((a, b) => b - a), [availableBaseYears])
  const scenarioReady = Boolean(scenarioParams)

  const renderScenarioSlider = (config: SliderConfig<ScenarioSliderKey>) => {
    if (!scenarioParams) return null
    const current = scenarioParams[config.key] ?? 0
    return (
      <div key={config.key} className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-medium text-slate-300">{config.label}</label>
          <span className="text-xs font-mono text-cyan-400">
            {config.format ? config.format(current) : current.toFixed(2)}
          </span>
        </div>
        {config.helper && <p className="mb-1 text-[11px] text-slate-500">{config.helper}</p>}
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={current}
          onChange={(e) => {
            const nextValue = parseFloat(e.target.value)
            onScenarioChange({ [config.key]: nextValue } as Partial<ScenarioParams>)
          }}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        />
      </div>
    )
  }

  const renderDemographicSlider = (config: SliderConfig<keyof DemographicAdjustments>) => {
    const value = demographicAdjustments[config.key] ?? 0
    return (
      <div key={config.key} className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-medium text-slate-300">{config.label}</label>
          <span className="text-xs font-mono text-amber-300">
            {config.format ? config.format(value) : value.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => onDemographicChange(config.key, parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700 text-slate-200 px-4 py-2 rounded-md shadow-lg hover:bg-slate-800 transition-colors z-50 font-medium text-sm backdrop-blur-sm"
      >
        Show Controls
      </button>
    )
  }

  return (
    <div className="absolute top-4 right-4 w-96 max-w-full bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-md z-50 flex flex-col max-h-[calc(100vh-2rem)]">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Swingometer Controls</h2>
          <p className="text-[11px] text-slate-500">Live parameters from the swingometer service</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3 border-b border-slate-800">
        <label className="block text-xs font-medium text-slate-300">Baseline Year</label>
        <select
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          disabled={!scenarioReady}
          value={scenarioParams?.baseYear ?? ''}
          onChange={(e) => onScenarioChange({ baseYear: Number(e.target.value) })}
        >
          <option value="" disabled>Select year</option>
          {sortedYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Demographic Turnout Engine</span>
          <button
            onClick={() => onToggleDemographicTurnout(!useDemographicTurnout)}
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${useDemographicTurnout ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/60' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}
          >
            {useDemographicTurnout ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'general' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}
        >
          Scenario
        </button>
        <button
          onClick={() => setActiveTab('demographics')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'demographics' ? 'text-amber-300 border-b-2 border-amber-300 bg-slate-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}
        >
          Demographics
        </button>
      </div>

      <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
        {activeTab === 'general' && (
          scenarioReady ? SCENARIO_SLIDERS.map(renderScenarioSlider) : <p className="text-xs text-slate-500">Loading scenario parameters…</p>
        )}
        {activeTab === 'demographics' && (
          <>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
              <span>Adjust demographic-specific turnout deltas</span>
              {demographicSaving ? <span className="text-amber-300">Saving…</span> : null}
            </div>
            {DEMOGRAPHIC_SLIDERS.map(renderDemographicSlider)}
            <button
              onClick={onResetDemographics}
              className="mt-2 w-full border border-slate-700 text-xs font-medium text-slate-200 rounded-md py-2 hover:bg-slate-800/60"
            >
              Reset Demographic Overrides
            </button>
          </>
        )}
      </div>
    </div>
  )
}
