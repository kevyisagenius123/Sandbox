import React from 'react'
import type { CountyFocusSnapshot } from './types'
import { formatPercent, formatNumber } from './formatters'

interface CountyFocusDrawerProps {
  focus: CountyFocusSnapshot | null
}

export const CountyFocusDrawer: React.FC<CountyFocusDrawerProps> = ({ focus }) => {
  if (!focus) {
    return (
      <article className="rounded-3xl border border-slate-800/70 bg-slate-950/75 p-4 text-xs text-slate-400">
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">County Focus</h3>
        <p className="mt-3">Select a county on the 3D desk to surface margin and reporting detail.</p>
      </article>
    )
  }

  const partyLabel = focus.party === 'DEM' ? 'Dem' : focus.party === 'GOP' ? 'GOP' : 'Tie'
  const marginDescriptor = focus.party === 'TIE'
    ? 'Dead heat'
    : `${partyLabel} +${Math.abs(focus.marginPercent).toFixed(1)} pts`

  return (
    <article className="rounded-3xl border border-slate-800/70 bg-slate-950/75 p-4 text-slate-200">
      <header>
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">County Focus</h3>
        <p className="mt-1 text-xs text-slate-500">{focus.name}{focus.state ? `, ${focus.state}` : ''}</p>
      </header>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
        <div>
          <dt className="uppercase tracking-[0.18em]">Reporting</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-100">{formatPercent(focus.reportingPercent, 1)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.18em]">Margin</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-100">{marginDescriptor}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.18em]">Outstanding</dt>
          <dd className="mt-1 text-lg font-semibold text-amber-200">{formatNumber(focus.remainingVotes)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.18em]">Votes</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-100">{formatNumber(Math.abs(focus.marginVotes))}</dd>
        </div>
      </dl>
      <div className="mt-4 space-y-2 text-xs text-slate-400">
        {focus.trend.map((point) => (
          <div key={point.label}>
            <div className="flex items-center justify-between">
              <span className="uppercase tracking-[0.18em] text-slate-500">{point.label}</span>
              <span>{formatPercent(point.reportingPercent, 1)} in</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 to-sky-400/80"
                style={{ width: `${Math.min(Math.max(point.reportingPercent, 0), 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

export default CountyFocusDrawer
