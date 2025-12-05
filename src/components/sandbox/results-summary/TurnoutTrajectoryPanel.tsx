import React, { useMemo } from 'react'
import type { TrajectoryPoint } from './types'

interface TurnoutTrajectoryPanelProps {
  points: TrajectoryPoint[]
}

const SVG_WIDTH = 280
const SVG_HEIGHT = 160
const PADDING = 22

export const TurnoutTrajectoryPanel: React.FC<TurnoutTrajectoryPanelProps> = ({ points }) => {
  const safePoints = points.length >= 2 ? points : [
    { label: 'Start', actual: 0, expected: 0 },
    { label: 'Projected', actual: 0, expected: 0 }
  ]

  const { actualPath, expectedPath, coordinates, lastX } = useMemo(() => {
    const total = safePoints.length - 1
    const buildPath = (key: 'actual' | 'expected') => safePoints
      .map((point, index) => {
        const x = PADDING + (index / Math.max(total, 1)) * (SVG_WIDTH - PADDING * 2)
        const y = SVG_HEIGHT - PADDING - (Math.min(Math.max(point[key], 0), 100) / 100) * (SVG_HEIGHT - PADDING * 2)
        return `${index === 0 ? 'M' : 'L'}${x} ${y}`
      })
      .join(' ')

    const coords = safePoints.map((point, index) => {
      const x = PADDING + (index / Math.max(total, 1)) * (SVG_WIDTH - PADDING * 2)
      const yActual = SVG_HEIGHT - PADDING - (Math.min(Math.max(point.actual, 0), 100) / 100) * (SVG_HEIGHT - PADDING * 2)
      const yExpected = SVG_HEIGHT - PADDING - (Math.min(Math.max(point.expected, 0), 100) / 100) * (SVG_HEIGHT - PADDING * 2)
      return { x, yActual, yExpected }
    })

    return {
      actualPath: buildPath('actual'),
      expectedPath: buildPath('expected'),
      coordinates: coords,
      lastX: coords[coords.length - 1]?.x ?? PADDING
    }
  }, [safePoints])

  return (
    <article className="rounded-3xl border border-slate-800/70 bg-slate-950/75 p-4 text-slate-200">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Turnout Trajectory</h3>
          <p className="text-xs text-slate-500">Comparing reported vote share against projected pacing.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" />Actual</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-600" />Expected</span>
        </div>
      </header>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full">
        <defs>
          <linearGradient id="trajectory-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
          </linearGradient>
        </defs>
        <rect x={PADDING} y={PADDING} width={SVG_WIDTH - PADDING * 2} height={SVG_HEIGHT - PADDING * 2} fill="rgba(15,23,42,0.35)" rx={12} />
        <path d={expectedPath} fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth={2} strokeDasharray="6 6" />
        <path d={actualPath} fill="none" stroke="url(#trajectory-fill)" strokeWidth={3} />
  <path d={`${actualPath} L${lastX} ${SVG_HEIGHT - PADDING} L${PADDING} ${SVG_HEIGHT - PADDING} Z`} fill="url(#trajectory-fill)" />
        {coordinates.map((coord, index) => (
          <g key={safePoints[index]?.label ?? index}>
            <circle cx={coord.x} cy={coord.yActual} r={3} fill="#38bdf8" />
            <circle cx={coord.x} cy={coord.yExpected} r={2} fill="#94a3b8" />
          </g>
        ))}
      </svg>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
        {safePoints.map((point) => (
          <div key={point.label}>
            <dt className="uppercase tracking-[0.18em] text-slate-500">{point.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2 text-slate-300">
              <span className="text-sm font-semibold text-slate-100">{point.actual.toFixed(1)}%</span>
              <span className="text-[11px]">vs {point.expected.toFixed(1)}% projected</span>
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default TurnoutTrajectoryPanel
