import React from 'react'
import type { AlertNotice } from './types'

interface AlertStackProps {
  alerts: AlertNotice[]
}

const severityAccent: Record<AlertNotice['severity'], string> = {
  info: 'border-sky-400/60 text-sky-200',
  success: 'border-emerald-400/60 text-emerald-200',
  warning: 'border-amber-400/60 text-amber-200',
  danger: 'border-rose-500/60 text-rose-200',
  neutral: 'border-slate-600/60 text-slate-200'
}

export const AlertStack: React.FC<AlertStackProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return null
  }

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Newsroom Alerts</h3>
      <ul className="mt-3 space-y-3" aria-live="polite">
        {alerts.map((alert) => {
          const accent = severityAccent[alert.severity]

          return (
            <li key={alert.id} className={`rounded-2xl border ${accent} bg-slate-900/60 p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{alert.headline}</p>
                  {alert.detail && <p className="mt-1 text-[11px] text-slate-400">{alert.detail}</p>}
                </div>
                <time className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </time>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default AlertStack
