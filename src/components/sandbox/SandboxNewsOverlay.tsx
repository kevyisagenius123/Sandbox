import React, { useMemo } from 'react'
import EventTicker, { type NewsEvent } from '../news/EventTicker'
import { useSandboxTheme } from '../../design/SandboxThemeProvider'

export type SandboxNewsOverlayData = {
  stateName: string
  scenarioName: string
  reportingPercent: number
  demVotes: number
  gopVotes: number
  otherVotes: number
  demShare: number
  gopShare: number
  totalReported: number
  totalExpected: number
  remainingVotes: number
  marginVotes: number
  marginPercent: number
  winProbDem: number
  winProbGop: number
  phase: string
  leader: 'DEM' | 'GOP' | null
  clock: string
  progress: number
  speed: number
}

type SandboxNewsOverlayProps = {
  data: SandboxNewsOverlayData
  events: NewsEvent[]
  isPlaying: boolean
  onPause: () => void
}

const formatNumber = (value: number) => Number.isFinite(value) ? Math.round(value).toLocaleString() : '0'
const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
const formatProbability = (value: number) => `${Math.round(Math.min(Math.max(value * 100, 0), 100))}%`

const SandboxNewsOverlay: React.FC<SandboxNewsOverlayProps> = ({ data, events, isPlaying, onPause }) => {
  const { theme } = useSandboxTheme()

  const primaryCardStyle = useMemo(() => ({
    background: 'rgba(12,20,38,0.9)',
    border: `1px solid ${theme.surfaces.mapFullscreen.borderColor}`,
    boxShadow: '0 28px 70px -40px rgba(9,17,34,0.95)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    color: theme.palette.text.primary
  }), [theme])

  const statRailStyle = useMemo(() => ({
    background: 'rgba(8,14,28,0.85)',
    border: `1px solid ${theme.surfaces.sidebar.borderColor}`,
    boxShadow: '0 18px 45px -36px rgba(6,12,24,0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    color: theme.palette.text.secondary
  }), [theme])

  const statusClusterStyle = useMemo(() => ({
    background: 'rgba(10,18,32,0.88)',
    border: `1px solid ${theme.surfaces.header.borderColor}`,
    boxShadow: '0 16px 40px -24px rgba(6,12,24,0.85)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)'
  }), [theme])

  const tickerStyle = useMemo(() => ({
    background: 'linear-gradient(90deg, rgba(5,12,28,0.92) 0%, rgba(6,18,38,0.92) 100%)',
    borderTop: `1px solid ${theme.surfaces.dockPanel.borderColor}`,
    boxShadow: '0 -18px 45px -24px rgba(4,10,22,0.85)',
    color: theme.palette.text.primary
  }), [theme])

  const demPercent = Number.isFinite(data.demShare) ? (data.demShare * 100) : 0
  const gopPercent = Number.isFinite(data.gopShare) ? (data.gopShare * 100) : 0
  const marginLabel = data.marginVotes === 0
    ? 'Tied race'
    : `${Math.abs(data.marginVotes).toLocaleString()} vote ${data.leader === 'DEM' ? 'Dem lead' : 'GOP lead'}`
  const marginPercentLabel = data.marginVotes === 0
    ? '0.0 pt difference'
    : `${Math.abs(data.marginPercent).toFixed(1)} pt advantage`
  const remainingLabel = formatNumber(data.remainingVotes)
  const totalExpectedLabel = data.totalExpected > 0 ? formatNumber(data.totalExpected) : '—'
  const totalReportedLabel = data.totalReported > 0 ? formatNumber(data.totalReported) : '—'
  const otherSharePercent = data.totalReported > 0 ? (data.otherVotes / data.totalReported) * 100 : 0
  const reportingClamp = Math.min(Math.max(data.reportingPercent, 0), 100)

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col">
      <div className="flex justify-end px-6 pt-6">
        <div className="pointer-events-auto rounded-2xl border px-5 py-4 text-xs font-medium uppercase tracking-[0.3em]" style={statusClusterStyle}>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: isPlaying ? theme.palette.accent.secondary : 'rgba(148,163,184,0.25)',
                color: theme.palette.text.primary
              }}
            >
              {isPlaying ? 'Live' : 'Paused'}
            </span>
            <span style={{ color: theme.palette.text.secondary }}>Clock {data.clock}</span>
            <span style={{ color: theme.palette.text.secondary }}>Speed {data.speed.toFixed(1)}×</span>
          </div>
          <button
            type="button"
            onClick={onPause}
            className="mt-3 inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.2em] shadow"
            style={{
              borderColor: theme.surfaces.header.borderColor,
              background: 'rgba(255,255,255,0.06)',
              color: theme.palette.text.primary
            }}
          >
            Pause &amp; Exit
          </button>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-6 px-6 pb-28">
        <div className="pointer-events-auto w-full max-w-[500px] rounded-3xl border px-7 py-6 shadow-xl" style={primaryCardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: theme.palette.text.muted }}>
                Sandbox Live Desk
              </div>
              <h2 className="text-2xl font-semibold" style={{ color: theme.palette.text.primary }}>
                {data.stateName} Results Briefing
              </h2>
            </div>
            <span className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.palette.text.secondary }}>
              {data.reportingPercent.toFixed(1)}% reporting
            </span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.palette.text.secondary }}>
                Democratic
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold" style={{ color: '#60a5fa' }}>
                  {formatNumber(data.demVotes)}
                </span>
                <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                  ({formatPercent(demPercent)})
                </span>
              </div>
              <div className="text-[11px]" style={{ color: theme.palette.text.secondary }}>
                Win probability {formatProbability(data.winProbDem)}
              </div>
            </div>
            <div className="text-center text-xs" style={{ color: theme.palette.text.secondary }}>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: theme.palette.text.primary
                }}
              >
                {data.phase}
              </span>
              <div className="mt-2 text-lg font-semibold" style={{ color: theme.palette.text.primary }}>
                {marginLabel}
              </div>
              <div>{marginPercentLabel}</div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.palette.text.secondary }}>
                Republican
              </div>
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                  ({formatPercent(gopPercent)})
                </span>
                <span className="text-4xl font-semibold" style={{ color: '#f87171' }}>
                  {formatNumber(data.gopVotes)}
                </span>
              </div>
              <div className="text-[11px]" style={{ color: theme.palette.text.secondary }}>
                Win probability {formatProbability(data.winProbGop)}
              </div>
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full" style={{ background: theme.timeline.track }}>
            <div
              className="h-full"
              style={{
                width: `${reportingClamp}%`,
                background: `linear-gradient(90deg, ${theme.timeline.progressFrom}, ${theme.timeline.progressTo})`,
                boxShadow: theme.timeline.indicatorShadow
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px]" style={{ color: theme.palette.text.secondary }}>
            <span>Counted {totalReportedLabel}{totalExpectedLabel !== '—' ? ` of ${totalExpectedLabel}` : ''}</span>
            <span>Remaining ballots {remainingLabel}</span>
            <span>Other votes {formatNumber(data.otherVotes)}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex w-full max-w-[260px] flex-col gap-4">
          <div className="rounded-2xl border px-5 py-4 text-xs uppercase tracking-[0.25em]" style={statRailStyle}>
            <div className="text-[10px]" style={{ color: theme.palette.text.muted }}>
              Scenario
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: theme.palette.text.primary }}>
              {data.scenarioName}
            </div>
            <div className="mt-2 text-[11px]" style={{ color: theme.palette.text.secondary }}>
              {data.progress.toFixed(1)}% overall timeline
            </div>
          </div>
          <div className="rounded-2xl border px-5 py-4 text-xs" style={statRailStyle}>
            <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.palette.text.muted }}>
              Rapid notes
            </div>
            <div className="mt-1 space-y-1 text-[11px]" style={{ color: theme.palette.text.secondary }}>
              <div>Lead margin {marginPercentLabel}</div>
              <div>Projected turnout {totalExpectedLabel}</div>
              <div>Other share {formatPercent(otherSharePercent)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none px-6 pb-8">
        <div className="mx-auto w-full max-w-5xl rounded-t-3xl px-6 py-4" style={tickerStyle}>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em]" style={{ color: theme.palette.text.secondary }}>
            <span>Live desk updates</span>
            <span>{events.length ? events[0].timestamp : ''}</span>
          </div>
          <div className="mt-2">
            <EventTicker events={events} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SandboxNewsOverlay
