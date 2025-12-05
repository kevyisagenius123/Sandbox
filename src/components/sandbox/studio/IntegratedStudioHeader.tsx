import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SandboxThemeId } from '../../../design/sandboxThemes'
import { useSandboxTheme } from '../../../design/SandboxThemeProvider'

type PanelId =
  | 'uploader'
  | 'controls'
  | 'analytics'
  | 'reporting'
  | 'demographics'
  | 'stateSelection'
  | 'countyEdit'

type PanelDefinition = {
  title: string
  subtitle?: string
}

type IntegratedStudioHeaderProps = {
  scenarioName: string
  onScenarioNameChange: (value: string) => void
  status: string
  statusLabel: string
  statusClass: string
  progress: number
  isPlaying: boolean
  currentTimeSeconds: number
  totalDurationSeconds: number
  mapMode: '3D' | '2D' | 'THREE' | 'BABYLON'
  onMapModeChange: (mode: '3D' | '2D' | 'THREE' | 'BABYLON') => void
  is3DAvailable: boolean
  minimizedPanels: PanelId[]
  onPanelToggle: (panelId: PanelId) => void
  panelDefinitions: Record<PanelId, PanelDefinition>
  onShowIntro: () => void
  onShowKeyboardHelp: () => void
  onExit: () => void
  error: string | null
  isScenarioLoaded: boolean
  editedCounties: Set<string>
  isMobile?: boolean
  mobilePanelOpen?: boolean
  onToggleMobilePanels?: () => void
}

const PANEL_ORDER: PanelId[] = ['uploader', 'controls', 'analytics', 'reporting', 'demographics', 'stateSelection', 'countyEdit']

const SHORT_LABEL_FALLBACK: Record<PanelId, string> = {
  uploader: 'Uploader',
  controls: 'Controls',
  analytics: 'Analytics',
  reporting: 'Reporting',
  demographics: 'Demo',
  stateSelection: 'States',
  countyEdit: 'Counties'
}

const MIN_HEADER_HEIGHT = 130
const DEFAULT_HEADER_HEIGHT = 360

const getViewportMaxHeaderHeight = () => {
  if (typeof window === 'undefined') {
    return 640
  }
  const capped = Math.min(window.innerHeight - 120, 720)
  return Math.max(MIN_HEADER_HEIGHT + 40, capped)
}

const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const themeButtonActive = (theme: ReturnType<typeof useSandboxTheme>['theme']) => ({
  background: theme.palette.accent.primary,
  color: theme.palette.text.primary
})

const themeButtonInactive = (theme: ReturnType<typeof useSandboxTheme>['theme']) => ({
  background: 'transparent',
  color: theme.palette.text.secondary
})

export const IntegratedStudioHeader: React.FC<IntegratedStudioHeaderProps> = ({
  scenarioName,
  onScenarioNameChange,
  status,
  statusLabel,
  statusClass,
  progress,
  isPlaying,
  currentTimeSeconds,
  totalDurationSeconds,
  mapMode,
  onMapModeChange,
  minimizedPanels,
  onPanelToggle,
  panelDefinitions,
  onShowIntro,
  onShowKeyboardHelp,
  onExit,
  error,
  isScenarioLoaded,
  editedCounties,
  is3DAvailable,
  isMobile = false,
  mobilePanelOpen,
  onToggleMobilePanels
}) => {
  const { theme, themeId, availableThemes, setThemeId } = useSandboxTheme()

  const headerRef = useRef<HTMLElement | null>(null)
  const [headerHeight, setHeaderHeight] = useState<number>(() => DEFAULT_HEADER_HEIGHT)
  const [maxHeaderHeight, setMaxHeaderHeight] = useState<number>(() => getViewportMaxHeaderHeight())
  const [isDraggingHeader, setIsDraggingHeader] = useState(false)
  const dragDataRef = useRef<{ startY: number; startHeight: number }>({
    startY: 0,
    startHeight: DEFAULT_HEADER_HEIGHT
  })
  const draggingRef = useRef(false)
  const hasMeasuredHeightRef = useRef(false)

  const clampHeaderHeight = useCallback(
    (value: number) => Math.min(Math.max(value, MIN_HEADER_HEIGHT), maxHeaderHeight),
    [maxHeaderHeight]
  )

  const updateHeaderHeight = useCallback(
    (clientY: number) => {
      const { startY, startHeight } = dragDataRef.current
      const delta = clientY - startY
      setHeaderHeight(clampHeaderHeight(startHeight + delta))
    },
    [clampHeaderHeight]
  )

  const adjustHeaderHeightBy = useCallback(
    (delta: number) => {
      setHeaderHeight((previous) => clampHeaderHeight(previous + delta))
    },
    [clampHeaderHeight]
  )

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingRef.current) return
      event.preventDefault()
      updateHeaderHeight(event.clientY)
    },
    [updateHeaderHeight]
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!draggingRef.current) return
      event.preventDefault()
      const touch = event.touches[0]
      if (!touch) return
      updateHeaderHeight(touch.clientY)
    },
    [updateHeaderHeight]
  )

  const endHeaderDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDraggingHeader(false)
    document.body.style.userSelect = ''
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', endHeaderDrag)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', endHeaderDrag)
      window.removeEventListener('touchcancel', endHeaderDrag)
    }
  }, [handleMouseMove, handleTouchMove])

  const startHeaderDrag = useCallback(
    (clientY: number) => {
      if (isMobile || typeof window === 'undefined') return
      dragDataRef.current = { startY: clientY, startHeight: headerHeight }
      draggingRef.current = true
      setIsDraggingHeader(true)
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', endHeaderDrag)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', endHeaderDrag)
      window.addEventListener('touchcancel', endHeaderDrag)
    },
    [endHeaderDrag, handleMouseMove, handleTouchMove, headerHeight, isMobile]
  )

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return
      event.preventDefault()
      startHeaderDrag(event.clientY)
    },
    [isMobile, startHeaderDrag]
  )

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (isMobile) return
      event.preventDefault()
      const touch = event.touches[0]
      if (touch) {
        startHeaderDrag(touch.clientY)
      }
    },
    [isMobile, startHeaderDrag]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isMobile) return
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          adjustHeaderHeightBy(24)
          break
        case 'ArrowDown':
          event.preventDefault()
          adjustHeaderHeightBy(-24)
          break
        case 'Home':
          event.preventDefault()
          setHeaderHeight(maxHeaderHeight)
          break
        case 'End':
          event.preventDefault()
          setHeaderHeight(MIN_HEADER_HEIGHT)
          break
        default:
          break
      }
    },
    [adjustHeaderHeightBy, isMobile, maxHeaderHeight]
  )

  useEffect(() => {
    if (isMobile || typeof window === 'undefined') return
    const handleResize = () => {
      const nextMax = getViewportMaxHeaderHeight()
      setMaxHeaderHeight(nextMax)
      setHeaderHeight((previous) => Math.min(Math.max(previous, MIN_HEADER_HEIGHT), nextMax))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobile])

  useEffect(() => {
    if (isMobile || hasMeasuredHeightRef.current || !headerRef.current) return
    const measured = headerRef.current.scrollHeight
    const clamped = clampHeaderHeight(measured)
    setHeaderHeight(clamped)
    dragDataRef.current.startHeight = clamped
    hasMeasuredHeightRef.current = true
  }, [clampHeaderHeight, isMobile])

  useEffect(() => {
    if (isMobile) return
    document.documentElement.style.setProperty('--studio-header-height', `${Math.round(headerHeight)}px`)
    return () => {
      document.documentElement.style.removeProperty('--studio-header-height')
    }
  }, [headerHeight, isMobile])

  useEffect(() => () => endHeaderDrag(), [endHeaderDrag])

  const headerStyle = useMemo(
    () => ({
      background: theme.surfaces.header.background,
      borderColor: theme.surfaces.header.borderColor,
      boxShadow: theme.surfaces.header.boxShadow
    }),
    [theme]
  )

  const handleThemeSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setThemeId(event.target.value as SandboxThemeId)
    },
    [setThemeId]
  )

  const panelTabs = useMemo(
    () =>
      PANEL_ORDER.map((id) => {
        const definition = panelDefinitions[id]
        return {
          id,
          label: definition?.title ?? SHORT_LABEL_FALLBACK[id],
          shortLabel: SHORT_LABEL_FALLBACK[id]
        }
      }),
    [panelDefinitions]
  )

  const panelTabButtons = useMemo(
    () =>
      panelTabs.map((tab) => {
        const isMinimized = minimizedPanels.includes(tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onPanelToggle(tab.id)}
            className="relative flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition md:px-4 md:py-2 md:text-xs"
            style={{
              background: isMinimized ? 'transparent' : 'rgba(255,255,255,0.08)',
              borderBottom: isMinimized ? 'none' : `2px solid ${theme.palette.accent.primary}`,
              color: isMinimized ? theme.palette.text.muted : theme.palette.text.primary
            }}
            title={tab.label}
          >
            <span className="hidden lg:inline">{tab.label}</span>
            <span className="lg:hidden">{tab.shortLabel}</span>
            {!isMinimized && (
              <span
                className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full md:top-1 md:right-1 md:h-1.5 md:w-1.5"
                style={{ background: theme.palette.accent.primary }}
              />
            )}
          </button>
        )
      }),
    [minimizedPanels, onPanelToggle, panelTabs, theme]
  )

  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  const progressPercent = Math.round(clampedProgress * 100)
  const showProgress = progressPercent > 0 && progressPercent <= 100
  const currentTimeLabel = formatTime(currentTimeSeconds)
  // Always show total time label to match BottomAnalyticsDock behavior
  const totalTimeLabel = formatTime(totalDurationSeconds)
  const datasetStatusLabel = isScenarioLoaded ? 'Dataset ready' : 'Awaiting data'
  const editedCountiesLabel = `${editedCounties.size} edits`

  const statusPillStyle = {
    borderColor: theme.surfaces.header.borderColor,
    background: 'rgba(255,255,255,0.04)',
    color: theme.palette.text.secondary
  }

  const accentButtonStyle = {
    borderColor: theme.palette.accent.primary,
    background: 'rgba(255,255,255,0.06)',
    color: theme.palette.text.primary
  }

  const neutralButtonStyle = {
    borderColor: theme.surfaces.header.borderColor,
    background: 'rgba(255,255,255,0.02)',
    color: theme.palette.text.secondary
  }

  const errorBanner = !error
    ? null
    : (
        <div
          className="flex-shrink-0 px-3 py-1.5 text-[10px] font-medium md:px-6 md:py-2 md:text-xs"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderTop: `1px solid ${theme.palette.accent.negative}`,
            color: theme.palette.accent.negative
          }}
        >
          {error}
        </div>
      )

  if (isMobile) {
    return (
      <header
        className="flex flex-col rounded-2xl border bg-slate-950/95 backdrop-blur-md shadow-[0_24px_48px_rgba(7,13,31,0.65)]"
        style={headerStyle}
        data-status={status}
      >
        <div className="flex items-center justify-between px-3 pt-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
            style={neutralButtonStyle}
          >
            ← Back
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]" style={statusPillStyle}>
              <span className={`h-2 w-2 rounded-full ${statusClass}`} />
              <span className="font-medium">{statusLabel}</span>
            </div>
            <button
              type="button"
              onClick={onShowIntro}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={accentButtonStyle}
            >
              Intro
            </button>
            <button
              type="button"
              onClick={onShowKeyboardHelp}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={neutralButtonStyle}
              title="Keyboard Shortcuts"
            >
              ?
            </button>
          </div>
        </div>

        <div className="px-3 pt-2">
          <input
            type="text"
            value={scenarioName}
            onChange={(event) => onScenarioNameChange(event.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-xs shadow-inner transition focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: theme.surfaces.header.borderColor,
              color: theme.palette.text.primary
            }}
            placeholder="Scenario name..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1 text-[10px]" style={{ color: theme.palette.text.secondary }}>
            <span className="rounded-full border px-2 py-0.5" style={statusPillStyle}>{datasetStatusLabel}</span>
            <span className="rounded-full border px-2 py-0.5" style={statusPillStyle}>{editedCountiesLabel}</span>
            {showProgress && (
              <span className="rounded-full border px-2 py-0.5 font-semibold" style={statusPillStyle}>
                {progressPercent}%
              </span>
            )}
            <span className="rounded-full border px-2 py-0.5 font-mono" style={statusPillStyle}>
              {currentTimeLabel} / {totalTimeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex overflow-hidden rounded-md border" style={{ borderColor: theme.surfaces.header.borderColor }}>
              <button
                type="button"
                  onClick={() => {
                    if (is3DAvailable) {
                      onMapModeChange('3D')
                    }
                  }}
                  disabled={!is3DAvailable}
                  className="px-2 py-0.5 text-[10px] font-semibold transition"
                  style={mapMode === '3D'
                    ? themeButtonActive(theme)
                    : {
                        ...themeButtonInactive(theme),
                        opacity: is3DAvailable ? 1 : 0.5,
                        cursor: is3DAvailable ? 'pointer' : 'not-allowed'
                      }}
                  title={is3DAvailable ? 'Enable 3D Deck.gl map' : 'WebGL 2 required for 3D view'}
              >
                3D
              </button>
              <button
                type="button"
                onClick={() => onMapModeChange('2D')}
                className="px-2 py-0.5 text-[10px] font-semibold transition"
                style={mapMode === '2D' ? themeButtonActive(theme) : themeButtonInactive(theme)}
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => {
                  if (is3DAvailable) {
                    onMapModeChange('THREE')
                  }
                }}
                disabled={!is3DAvailable}
                className="px-2 py-0.5 text-[10px] font-semibold transition"
                style={mapMode === 'THREE'
                  ? themeButtonActive(theme)
                  : {
                      ...themeButtonInactive(theme),
                      opacity: is3DAvailable ? 1 : 0.5,
                      cursor: is3DAvailable ? 'pointer' : 'not-allowed'
                    }}
                title={is3DAvailable ? 'Enable Three.js 3D map' : 'WebGL 2 required for Three.js view'}
              >
                THREE
              </button>
              <button
                type="button"
                onClick={() => {
                  if (is3DAvailable) {
                    onMapModeChange('BABYLON')
                  }
                }}
                disabled={!is3DAvailable}
                className="px-2 py-0.5 text-[10px] font-semibold transition"
                style={mapMode === 'BABYLON'
                  ? themeButtonActive(theme)
                  : {
                      ...themeButtonInactive(theme),
                      opacity: is3DAvailable ? 1 : 0.5,
                      cursor: is3DAvailable ? 'pointer' : 'not-allowed'
                    }}
                title={is3DAvailable ? 'Enable Babylon.js broadcast view' : 'WebGL 2 required for Babylon.js view'}
              >
                BABYLON
              </button>
            </div>
            <button
              type="button"
              onClick={onToggleMobilePanels}
              disabled={!onToggleMobilePanels}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
              style={accentButtonStyle}
            >
              {mobilePanelOpen ? 'Hide Panels' : 'Panels'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em]" style={{ color: theme.palette.text.muted }}>
            Panels
          </span>
          {panelTabButtons}
        </div>

        {errorBanner}
      </header>
    )
  }

  return (
    <header
      ref={headerRef}
      className="relative rounded-b-3xl border border-white/5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
      style={{
        ...headerStyle,
        height: headerHeight,
        minHeight: MIN_HEADER_HEIGHT,
        maxHeight: maxHeaderHeight,
        transition: isDraggingHeader ? 'none' : 'height 0.2s ease',
        overflow: 'hidden'
      }}
      data-status={status}
    >
      <div className="flex h-full flex-col">
        <div
          className="flex flex-col border-b"
          style={{ borderColor: theme.surfaces.header.borderColor, background: 'rgba(4,7,18,0.9)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.palette.text.primary }}>
                Election Sandbox
              </h1>
              <div
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]"
                style={statusPillStyle}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusClass}`} />
                <span>{statusLabel}</span>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]" style={statusPillStyle}>
                {datasetStatusLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: theme.palette.text.secondary }}>Theme</span>
                <select
                  value={themeId}
                  onChange={handleThemeSelect}
                  className="rounded border bg-transparent px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] outline-none transition hover:bg-white/5"
                  style={{ borderColor: theme.surfaces.header.borderColor, color: theme.palette.text.primary }}
                >
                  {availableThemes.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex overflow-hidden rounded border" style={{ borderColor: theme.surfaces.header.borderColor }}>
                {(['3D', '2D', 'THREE', 'BABYLON'] as Array<'3D' | '2D' | 'THREE' | 'BABYLON'>).map((mode) => {
                  const disabled = !is3DAvailable && mode !== '2D'
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (!disabled) {
                          onMapModeChange(mode)
                        }
                      }}
                      disabled={disabled}
                      className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] transition"
                      style={mapMode === mode
                        ? themeButtonActive(theme)
                        : {
                            ...themeButtonInactive(theme),
                            opacity: disabled ? 0.4 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer'
                          }}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={onShowIntro}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition hover:bg-white/5"
                style={accentButtonStyle}
              >
                Intro
              </button>
              <button
                type="button"
                onClick={onShowKeyboardHelp}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition hover:bg-white/5"
                style={neutralButtonStyle}
              >
                Shortcuts
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition hover:bg-white/5"
                style={neutralButtonStyle}
              >
                Exit
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t px-6 py-3" style={{ borderColor: theme.surfaces.header.borderColor }}>
            <input
              type="text"
              value={scenarioName}
              onChange={(event) => onScenarioNameChange(event.target.value)}
              className="flex-1 rounded-lg border bg-white/5 px-3 py-1.5 text-sm font-medium transition focus:bg-white/10 focus:outline-none"
              style={{ borderColor: theme.surfaces.header.borderColor, color: theme.palette.text.primary }}
              placeholder="Scenario name"
            />
            <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]" style={statusPillStyle}>
              {editedCountiesLabel}
            </span>
            {showProgress && (
              <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]" style={statusPillStyle}>
                {progressPercent}%
              </span>
            )}
            <span className="rounded-full border px-3 py-1 font-mono text-xs" style={statusPillStyle}>
              {currentTimeLabel} / {totalTimeLabel}
            </span>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 border-t px-6 py-2"
            style={{ borderColor: theme.surfaces.header.borderColor }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-[0.3em]" style={{ color: theme.palette.text.muted }}>
              Panels
            </span>
            {panelTabButtons}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-[rgba(2,5,12,0.92)]">
          <div className="h-full overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-white/5 px-4 py-4" style={{ borderColor: theme.surfaces.header.borderColor }}>
                <div className="flex items-center justify-between text-[11px] text-white/70">
                  <span>Timeline</span>
                  <span>{isPlaying ? 'Live' : 'Paused'}</span>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, background: theme.palette.accent.primary }} />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-xs text-white/70">
                  <span>{currentTimeLabel}</span>
                  <span>{totalTimeLabel}</span>
                </div>
              </div>
              <div className="rounded-2xl border bg-white/5 px-4 py-4" style={{ borderColor: theme.surfaces.header.borderColor }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Operations</p>
                <p className="mt-2 text-sm text-white/80">
                  {isPlaying ? 'Automation streaming' : 'Manual review active'} · Map stack: {mapMode}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
                  <span className="rounded-full border px-3 py-1" style={statusPillStyle}>{datasetStatusLabel}</span>
                  <span className="rounded-full border px-3 py-1" style={statusPillStyle}>{editedCountiesLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorBanner}
      </div>

      <div
        className="absolute bottom-2 left-1/2 h-2 w-16 -translate-x-1/2 cursor-row-resize rounded-full bg-gray-600/70"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        role="separator"
        aria-label="Resize studio header"
        aria-orientation="horizontal"
        aria-valuemin={MIN_HEADER_HEIGHT}
        aria-valuemax={Math.round(maxHeaderHeight)}
        aria-valuenow={Math.round(headerHeight)}
        tabIndex={0}
      />
    </header>
  )
}

export default IntegratedStudioHeader
