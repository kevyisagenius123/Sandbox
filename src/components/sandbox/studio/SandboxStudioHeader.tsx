import React, { useCallback, useMemo } from 'react'
import type { SandboxThemeId } from '../../../design/sandboxThemes'
import { useSandboxTheme } from '../../../design/SandboxThemeProvider'

type SandboxStudioHeaderProps = {
  scenarioName: string
  onScenarioNameChange: (value: string) => void
  showWelcome: boolean
  onToggleWelcome: () => void
  statusClass: string
  statusLabel: string
  error: string | null
  mapMode: '3D' | '2D'
  onMapModeChange: (mode: '3D' | '2D') => void
}

export const SandboxStudioHeader: React.FC<SandboxStudioHeaderProps> = ({
  scenarioName,
  onScenarioNameChange,
  showWelcome,
  onToggleWelcome,
  statusClass,
  statusLabel,
  error,
  mapMode,
  onMapModeChange
}) => {
  const { theme, themeId, availableThemes, setThemeId } = useSandboxTheme()

  const headerStyle = useMemo(() => ({
    background: theme.surfaces.header.background,
    borderColor: theme.surfaces.header.borderColor,
    boxShadow: theme.surfaces.header.boxShadow
  }), [theme])

  const handleThemeSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setThemeId(event.target.value as SandboxThemeId)
  }, [setThemeId])

  const activeMapButtonStyle = {
    background: theme.palette.accent.primary,
    color: theme.palette.text.primary
  }

  const inactiveMapButtonStyle = {
    background: 'transparent',
    color: theme.palette.text.secondary
  }

  return (
    <header className="flex flex-col gap-4 border-b px-6 py-4 lg:flex-row lg:items-center lg:justify-between" style={headerStyle}>
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex items-center gap-3" style={{ color: theme.palette.text.secondary }}>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ backgroundColor: `${theme.palette.accent.primary}`, color: theme.palette.text.primary }}
          >
            Sandbox
          </span>
          <h1 className="text-2xl font-semibold leading-tight" style={{ color: theme.palette.text.primary }}>
            State Simulation Studio
          </h1>
        </div>
        <div className="hidden h-6 w-px lg:block" style={{ background: theme.surfaces.header.borderColor }} />
        <input
          type="text"
          value={scenarioName}
          onChange={(event) => onScenarioNameChange(event.target.value)}
          className="w-full max-w-xs rounded-xl border px-4 py-2 text-sm shadow-inner transition focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: theme.surfaces.header.borderColor,
            color: theme.palette.text.primary
          }}
          placeholder="Scenario name..."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{
            borderColor: theme.surfaces.header.borderColor,
            background: 'rgba(255,255,255,0.04)',
            color: theme.palette.text.secondary
          }}
        >
          <span className="text-[10px]">Theme</span>
          <span
            className="inline-block h-4 w-4 rounded-full border"
            style={{
              background: theme.preview.swatch,
              borderColor: theme.palette.text.muted
            }}
            aria-hidden
          />
          <select
            value={themeId}
            onChange={handleThemeSelect}
            className="bg-transparent text-xs font-medium uppercase outline-none"
            style={{ color: theme.palette.text.primary }}
          >
            {availableThemes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{
            borderColor: theme.surfaces.header.borderColor,
            background: 'rgba(255,255,255,0.04)',
            color: theme.palette.text.secondary
          }}
        >
          <span className="text-[10px]">Map</span>
          <div className="flex overflow-hidden rounded-md border" style={{ borderColor: theme.surfaces.header.borderColor }}>
            <button
              type="button"
              onClick={() => onMapModeChange('3D')}
              className="px-3 py-1 text-[11px] font-semibold transition"
              style={mapMode === '3D' ? activeMapButtonStyle : inactiveMapButtonStyle}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => onMapModeChange('2D')}
              className="px-3 py-1 text-[11px] font-semibold transition"
              style={mapMode === '2D' ? activeMapButtonStyle : inactiveMapButtonStyle}
            >
              2D
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleWelcome}
          className="rounded-lg border px-4 py-2 text-sm font-medium shadow transition"
          style={{
            borderColor: theme.palette.accent.primary,
            background: 'rgba(255,255,255,0.04)',
            color: theme.palette.text.primary
          }}
        >
          {showWelcome ? 'Hide Intro' : 'Show Intro'}
        </button>
        <a
          href="/"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition"
          style={{
            borderColor: theme.surfaces.header.borderColor,
            color: theme.palette.text.secondary
          }}
        >
          Back to Map
        </a>
        <div className="flex items-center gap-2 text-xs" style={{ color: theme.palette.text.muted }}>
          <span className={`h-2 w-2 rounded-full ${statusClass}`} />
          <span>{statusLabel}</span>
        </div>
        {error && <span className="text-xs" style={{ color: theme.palette.accent.negative }}>{error}</span>}
      </div>
    </header>
  )
}

export default SandboxStudioHeader
