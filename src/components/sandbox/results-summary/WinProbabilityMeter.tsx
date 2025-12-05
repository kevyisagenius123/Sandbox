import React, { useMemo } from 'react'
import type { AggregateResults, MarginParty } from './types'
import { formatNumber, formatPercent } from './formatters'

interface WinProbabilityMeterProps {
  aggregates: AggregateResults
  variant?: 'standard' | 'compact'
}

const palette: Record<MarginParty, { fill: string; track: string; accent: string; label: string }> = {
  DEM: {
    fill: '#6366f1',
    track: '#1e293b',
    accent: 'text-indigo-300',
    label: 'Dem'
  },
  GOP: {
    fill: '#f97316',
    track: '#1e293b',
    accent: 'text-amber-200',
    label: 'GOP'
  },
  TIE: {
    fill: '#94a3b8',
    track: '#1e293b',
    accent: 'text-slate-200',
    label: 'Even'
  }
}

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100)

export const WinProbabilityMeter: React.FC<WinProbabilityMeterProps> = ({ aggregates, variant = 'standard' }) => {
  const theme = palette[aggregates.leader]
  const winPercent = clampPercent(Number(aggregates.winProbability.toFixed(1)))
  const marginPercent = Number(aggregates.voteMarginPercent.toFixed(1))
  const marginLabel = aggregates.leader === 'TIE'
    ? 'Dead heat'
    : `${theme.label} +${Math.abs(marginPercent).toFixed(1)} pts`

  const meterStyle = useMemo(() => ({
    background: `conic-gradient(${theme.fill} 0deg, ${theme.fill} ${winPercent * 3.6}deg, ${theme.track} ${winPercent * 3.6}deg, ${theme.track} 360deg)`
  }), [theme.fill, theme.track, winPercent])

  const shellClasses = variant === 'compact'
    ? 'rounded-3xl border border-slate-800/70 bg-slate-950/75 p-3 text-xs text-slate-200'
    : 'rounded-3xl border border-slate-800/70 bg-slate-950/75 p-4 text-slate-200'

  return (
    <article className={shellClasses}>
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Win Probability</h3>
        <span className={`text-xs uppercase tracking-[0.25em] ${theme.accent}`}>{marginLabel}</span>
      </header>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-900/60">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-950" style={meterStyle}>
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-slate-950 text-slate-200">
              <span className="text-2xl font-semibold">{winPercent.toFixed(0)}%</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Chance</span>
            </div>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-3 text-xs text-slate-400">
          <div>
            <dt className="uppercase tracking-[0.18em]">Margin</dt>
            <dd className={`mt-1 text-lg font-semibold ${theme.accent}`}>{marginLabel}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.18em]">Votes Remaining</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100">{formatNumber(aggregates.votesRemaining)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.18em]">Counted</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100">{formatPercent(aggregates.voteReportingPercent)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.18em]">Leader Votes</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100">
              {formatNumber(aggregates.leader === 'GOP' ? aggregates.totalGop : aggregates.totalDem)}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  )
}

export default WinProbabilityMeter
