export const formatNumber = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) return '—'
  return Math.round(Number(value)).toLocaleString('en-US')
}

export const formatPercent = (value: number | null | undefined, digits = 1): string => {
  if (!Number.isFinite(value)) return '0.0%'
  return `${Number(value).toFixed(digits)}%`
}

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  if (seconds === Infinity) return '—'
  const safeSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}

export const formatShortClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
