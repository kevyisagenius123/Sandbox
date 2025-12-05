import React from 'react'
import type { MarginShiftItem } from './types'

interface MarginShiftTickerProps {
  items: MarginShiftItem[]
}

const partyColor: Record<MarginShiftItem['party'], string> = {
  DEM: 'text-indigo-300',
  GOP: 'text-amber-200',
  TIE: 'text-slate-300'
}

export const MarginShiftTicker: React.FC<MarginShiftTickerProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/75 p-3 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
        Margin moves will populate here once reporting picks up speed.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/80">
      <div className="flex gap-4 overflow-x-auto px-4 py-3 text-xs text-slate-200">
        {items.map((item) => {
          const deltaPrefix = item.deltaPercent >= 0 ? '+' : '-'
          const deltaValue = Math.abs(item.deltaPercent).toFixed(1)
          const party = partyColor[item.party]

          return (
            <div key={item.id} className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{item.label}</span>
              <span className={`font-semibold ${party}`}>
                {item.party === 'TIE' ? 'Even' : item.party === 'DEM' ? 'D' : 'R'} {item.marginPercent.toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-400">
                Delta {deltaPrefix}{deltaValue} pts
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MarginShiftTicker
