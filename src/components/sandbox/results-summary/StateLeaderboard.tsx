import React from 'react'
import type { StateLeaderboardRow } from './types'
import { formatNumber, formatPercent } from './formatters'

interface StateLeaderboardProps {
  rows: StateLeaderboardRow[]
}

const leaderBadgeClass = (leader: StateLeaderboardRow['leader']): string => {
  switch (leader) {
    case 'D':
      return 'bg-sky-500/20 text-sky-200 border-sky-400/40'
    case 'R':
      return 'bg-rose-500/20 text-rose-200 border-rose-400/40'
    default:
      return 'bg-slate-500/20 text-slate-200 border-slate-400/40'
  }
}

export const StateLeaderboard: React.FC<StateLeaderboardProps> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 px-4 py-6 text-sm text-slate-400">
        State level rollups will appear once county results are loaded.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">State Board</h3>
          <p className="text-xs text-slate-400">Top movements by margin</p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Live feed</span>
      </header>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <article key={row.label} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/60 px-3 py-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">{row.label}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.26em] ${leaderBadgeClass(row.leader)}`}>
                  {row.leader === 'D' ? 'Dem' : row.leader === 'R' ? 'GOP' : 'Tie'}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {formatPercent(row.reportingPercent)} reporting · Margin {row.marginVotes >= 0 ? 'R+' : 'D+'}{Math.abs(row.marginPercent).toFixed(1)} pts
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Counted {formatNumber(row.reported)} / {formatNumber(row.expected)} · Dem {formatNumber(row.demVotes)} vs GOP {formatNumber(row.gopVotes)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default StateLeaderboard
