import React, { useMemo } from 'react'

export interface NewsEvent {
  id: string | number
  timestamp: string
  headline: string
  detail?: string
  type?: string
  severity?: 'info' | 'success' | 'warning' | 'danger' | string
  source?: string
}

interface EventTickerProps {
  events?: NewsEvent[]
  maxVisible?: number
}

const severityBadgeClass: Record<string, string> = {
  success: 'border-emerald-500/60 text-emerald-200',
  warning: 'border-amber-500/60 text-amber-200',
  danger: 'border-rose-500/60 text-rose-200',
  info: 'border-sky-500/60 text-sky-200'
}

const severityDotColor: Record<string, string> = {
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f472b6',
  info: '#38bdf8'
}

const formatDisplayTime = (rawTimestamp: string) => {
  if (!rawTimestamp) return ''
  const parsed = Number.isFinite(Number(rawTimestamp))
    ? new Date(Number(rawTimestamp))
    : new Date(rawTimestamp)
  if (Number.isNaN(parsed.getTime())) {
    return rawTimestamp
  }
  const hours = parsed.getHours()
  const minutes = parsed.getMinutes().toString().padStart(2, '0')
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}

const EventTicker: React.FC<EventTickerProps> = ({ events = [], maxVisible = 6 }) => {
  const items = useMemo(() => {
    if (!Array.isArray(events)) return []
    return events
      .filter((event) => Boolean(event) && Boolean(event.headline))
      .slice(-maxVisible)
      .reverse()
  }, [events, maxVisible])

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-[12px] text-slate-300/70">
        No live updates yet. Events will appear here during the simulation.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-live="polite">
      {items.map((event) => {
        const severity = event.severity ? event.severity.toLowerCase() : 'info'
        const badgeClass = severityBadgeClass[severity] ?? severityBadgeClass.info
        const dotColor = severityDotColor[severity] ?? severityDotColor.info
        const key = String(event.id ?? `${event.timestamp}-${event.headline}`)

        return (
          <article
            key={key}
            className={`flex items-center gap-3 rounded-2xl border bg-slate-900/40 px-4 py-3 text-xs text-slate-200 shadow-[0_18px_40px_-24px_rgba(6,12,24,0.9)] ${badgeClass}`}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-300/80">
              {formatDisplayTime(event.timestamp)}
            </span>
            <div className="flex-1">
              <h4 className="text-[12px] font-semibold leading-tight text-slate-100">
                {event.headline}
              </h4>
              {event.detail && (
                <p className="mt-1 text-[11px] text-slate-300/80">{event.detail}</p>
              )}
              {event.source && (
                <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-slate-400/70">{event.source}</p>
              )}
            </div>
            <span
              aria-hidden
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_14px_rgba(56,189,248,0.45)]"
              style={{ backgroundColor: dotColor }}
            />
          </article>
        )
      })}
    </div>
  )
}

export default EventTicker
