import { useMemo } from 'react'
import type { NewsroomEvent } from '../../types/sandbox'

interface NewsroomMomentsPanelProps {
  events: NewsroomEvent[]
}

const severityStyles: Record<string, string> = {
  success: 'border-emerald-500/70 bg-emerald-950/80 text-emerald-100',
  warning: 'border-amber-500/70 bg-amber-950/85 text-amber-100',
  danger: 'border-rose-500/70 bg-rose-950/85 text-rose-100',
  info: 'border-slate-500/60 bg-slate-950/80 text-slate-100',
}

const formatSimClock = (rawSeconds: number | undefined) => {
  if (rawSeconds == null || Number.isNaN(rawSeconds)) return '0:00'
  const totalSeconds = Math.max(0, Math.round(rawSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const toSeverityClass = (severity?: string) => {
  if (!severity) return severityStyles.info
  const key = severity.toLowerCase()
  return severityStyles[key] ?? severityStyles.info
}

export function NewsroomMomentsPanel({ events }: NewsroomMomentsPanelProps) {
  const spotlightEvents = useMemo(() => {
    if (!Array.isArray(events)) return []
    return events
      .filter((event) => event.type?.toUpperCase() !== 'TICKER')
      .slice(-4)
      .reverse()
  }, [events])

  if (spotlightEvents.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-start" aria-live="polite">
      <div className="pointer-events-none mt-4 flex w-full justify-end pr-6">
        <div className="flex w-80 flex-col gap-3">
          {spotlightEvents.map((event) => {
            const severityClass = toSeverityClass(event.severity)
            return (
              <article
                key={event.id}
                className={`overflow-hidden rounded-lg border px-4 py-3 shadow-lg shadow-black/40 transition-transform duration-300 ${severityClass}`}
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight tracking-tight">{event.headline}</h3>
                  <span className="text-xs font-medium text-slate-200/80">
                    {formatSimClock(event.simulationTimeSeconds)}
                  </span>
                </header>
                {event.detail && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-100/90">{event.detail}</p>
                )}
                <footer className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-slate-200/70">
                  {event.state && <span>{event.state}</span>}
                  {typeof event.reportingPercent === 'number' && (
                    <span>{event.reportingPercent.toFixed(1)}% reporting</span>
                  )}
                  {typeof event.margin === 'number' && !Number.isNaN(event.margin) && (
                    <span>
                      {event.margin >= 0 ? 'D+' : 'R+'}
                      {Math.abs(event.margin).toFixed(1)}
                    </span>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default NewsroomMomentsPanel
