import React from 'react'
import { formatNumber, formatPercent, formatShortClock } from './formatters'
import type { AggregateResults } from './types'

interface HeroStripProps {
  aggregates: AggregateResults
  elapsedSeconds: number
  isPlaying: boolean
}

export const HeroStrip: React.FC<HeroStripProps> = ({ aggregates, elapsedSeconds, isPlaying }) => {
  const leaderLabel = aggregates.leader === 'TIE'
    ? 'Tied Race'
    : aggregates.leader === 'GOP'
      ? 'Republican Lead'
      : 'Democratic Lead'

  const leaderColor = aggregates.leader === 'TIE'
    ? 'text-slate-300'
    : aggregates.leader === 'GOP'
      ? 'text-rose-300'
      : 'text-sky-300'

  const marginLabel = `${aggregates.voteMarginAbsolute >= 0 ? 'R+' : 'D+'}${Math.abs(aggregates.voteMarginPercent).toFixed(1)} pts`

  return (
    <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-slate-800/70 bg-slate-950/80 px-6 py-5 shadow-[0_30px_80px_-45px_rgba(2,6,23,0.8)]">
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Sandbox Live Desk</div>
        <div className="flex items-center gap-3 text-2xl font-semibold text-slate-50">
          <span>National Results Snapshot</span>
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
            {formatPercent(aggregates.reportingPercent)} counties reporting
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span className={`${leaderColor} font-semibold uppercase tracking-[0.2em]`}>{leaderLabel}</span>
          <span>Margin {marginLabel}</span>
          <span>Votes Counted {formatNumber(aggregates.totalVotes)}</span>
          <span>Remaining {formatNumber(aggregates.votesRemaining)}</span>
          <span>{isPlaying ? 'Live' : 'Paused'} · T+{formatShortClock(elapsedSeconds)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Win Probability (heuristic)</div>
          <div className="text-3xl font-semibold text-slate-50">{aggregates.winProbability.toFixed(0)}%</div>
        </div>
        <div className="w-64">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Vote Reporting</div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400"
              style={{ width: `${Math.min(100, Math.max(0, aggregates.voteReportingPercent)).toFixed(1)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {formatPercent(aggregates.voteReportingPercent)} of expected turnout · {formatPercent(aggregates.reportingPercent)} counties
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroStrip
