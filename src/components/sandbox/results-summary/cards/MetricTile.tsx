import React from 'react'

interface MetricTileProps {
  label: string
  value: string
  helper?: string
  trend?: 'up' | 'down' | 'neutral'
}

const TREND_ICONS: Record<'up' | 'down' | 'neutral', string> = {
  up: '▲',
  down: '▼',
  neutral: '◆'
}

export const MetricTile: React.FC<MetricTileProps> = ({ label, value, helper, trend = 'neutral' }) => {
  const trendIcon = TREND_ICONS[trend]
  return (
    <article className="flex flex-col gap-1 rounded-2xl border border-slate-800/70 bg-slate-950/70 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
        <span>{label}</span>
        {helper && <span className="text-slate-500">·</span>}
        {helper && <span className="font-normal tracking-[0.1em] text-slate-500">{helper}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-50">{value}</span>
        <span className="text-xs text-slate-500">{trendIcon}</span>
      </div>
    </article>
  )
}

export default MetricTile
