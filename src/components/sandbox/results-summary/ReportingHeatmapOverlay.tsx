import React from 'react'
import type { HeatmapEntry } from './types'
import { formatPercent, formatNumber } from './formatters'

interface ReportingHeatmapOverlayProps {
  data: HeatmapEntry[]
}

const partyGradient: Record<HeatmapEntry['party'], string> = {
  DEM: 'from-indigo-500/80 via-indigo-400/70 to-sky-400/80',
  GOP: 'from-amber-500/80 via-orange-400/70 to-rose-500/80',
  TIE: 'from-slate-500/80 via-slate-400/70 to-zinc-300/80'
}

export const ReportingHeatmapOverlay: React.FC<ReportingHeatmapOverlayProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/80 p-4 text-xs text-slate-400">
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Reporting Heatmap</h3>
        <p className="mt-3">No live counties available yet. Check back as results begin to flow.</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/85 p-4 text-xs text-slate-200 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.85)]">
      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Reporting Heatmap</h3>
      <ul className="mt-3 space-y-2">
        {data.map((entry) => {
          const gradient = partyGradient[entry.party]
          const marginLabel = `${entry.party === 'DEM' ? 'D' : entry.party === 'GOP' ? 'R' : 'Tie'} ${Math.abs(entry.marginPercent).toFixed(1)}%`

          return (
            <li key={entry.fips} className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <span className="truncate pr-2 text-slate-300">{entry.name}</span>
                <span>{formatPercent(entry.reportingPercent, 1)} in</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/70">
                <div
                  className={`h-full bg-gradient-to-r ${gradient}`}
                  style={{ width: `${Math.min(Math.max(entry.reportingPercent, 0), 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{marginLabel}</span>
                <span>{formatNumber(entry.remainingVotes)} outstanding</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ReportingHeatmapOverlay
