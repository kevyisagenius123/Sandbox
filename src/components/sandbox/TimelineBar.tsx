import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSandboxThemeOrDefault } from '../../design/SandboxThemeProvider'

const DEFAULT_TOTAL_SECONDS = 7200

type TimelineVariant = 'full' | 'panel' | 'dock'

type TimelineBarProps = {
  progress: number
  currentTimeSeconds: number
  totalDuration?: number
  variant?: TimelineVariant
  interactive?: boolean
  onScrub?: (percent: number) => void
  onScrubEnd?: () => void
}

const formatTimestamp = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${hrs}:${mins}:${secs}`
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  progress,
  currentTimeSeconds,
  totalDuration = DEFAULT_TOTAL_SECONDS,
  variant = 'full',
  interactive = false,
  onScrub,
  onScrubEnd
}) => {
  const theme = useSandboxThemeOrDefault()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const containerClass = useMemo(() => {
    if (variant === 'full') return 'flex h-20 items-center px-6 border'
    if (variant === 'panel') return 'rounded-xl px-4 py-4 border'
    return 'rounded-2xl p-6 border'
  }, [variant])

  const trackClass = useMemo(() => {
    if (variant === 'full') return 'h-3'
    return 'h-2.5'
  }, [variant])

  const containerStyle = useMemo(() => theme.timeline.container[variant], [theme, variant])

  const updateFromClientX = useCallback((clientX: number) => {
    if (!interactive || !onScrub || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    if (rect.width === 0) return
    const relative = ((clientX - rect.left) / rect.width) * 100
    const clamped = Math.min(Math.max(relative, 0), 100)
    onScrub(clamped)
  }, [interactive, onScrub])

  useEffect(() => {
    if (!interactive || !isDragging) return

    const handlePointerMove = (event: MouseEvent) => {
      updateFromClientX(event.clientX)
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        updateFromClientX(event.touches[0].clientX)
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      onScrubEnd?.()
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handlePointerUp)
    window.addEventListener('touchcancel', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handlePointerUp)
      window.removeEventListener('touchcancel', handlePointerUp)
    }
  }, [interactive, isDragging, onScrubEnd, updateFromClientX])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    setIsDragging(true)
    updateFromClientX(event.clientX)
  }, [interactive, updateFromClientX])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !isDragging) return
    updateFromClientX(event.clientX)
  }, [interactive, isDragging, updateFromClientX])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return
    setIsDragging(true)
    if (event.touches.length > 0) {
      updateFromClientX(event.touches[0].clientX)
    }
  }, [interactive, updateFromClientX])

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive || !isDragging) return
    if (event.touches.length > 0) {
      updateFromClientX(event.touches[0].clientX)
    }
  }, [interactive, isDragging, updateFromClientX])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onScrub) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      onScrub(Math.min(Math.max(progress + delta, 0), 100))
      onScrubEnd?.()
    }

    if (event.key === 'Home') {
      event.preventDefault()
      onScrub(0)
      onScrubEnd?.()
    }

    if (event.key === 'End') {
      event.preventDefault()
      onScrub(100)
      onScrubEnd?.()
    }
  }, [interactive, onScrub, onScrubEnd, progress])

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="w-full">
        <div className="space-y-2">
          <div
            className="flex justify-between text-xs"
            style={{ color: theme.timeline.label }}
          >
            <span style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>Timeline</span>
            <span style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>{progress.toFixed(1)}% complete</span>
          </div>
          <div
            className={`relative w-full ${trackClass} overflow-hidden rounded-full ${interactive ? 'cursor-pointer' : ''}`}
            aria-label="Simulation timeline progress"
            role={interactive ? 'slider' : 'progressbar'}
            aria-valuemin={0}
            aria-valuemax={totalDuration}
            aria-valuenow={currentTimeSeconds}
            aria-valuetext={formatTimestamp(currentTimeSeconds)}
            tabIndex={interactive ? 0 : -1}
            ref={trackRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onKeyDown={handleKeyDown}
            style={{ background: theme.timeline.track }}
          >
            <div
              className="absolute left-0 top-0 h-full transition-all"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${theme.timeline.progressFrom}, ${theme.timeline.progressTo})`
              }}
            />
            <div
              className={`absolute top-0 h-full w-1 ${interactive ? 'scale-y-125' : ''}`}
              style={{
                left: `${progress}%`,
                background: theme.timeline.indicator,
                boxShadow: theme.timeline.indicatorShadow
              }}
            />
          </div>
          <div
            className="flex justify-between text-xs"
            style={{ color: theme.timeline.subLabel, fontFamily: 'var(--sandbox-numeric-font)' }}
          >
            <span>00:00:00</span>
            <span>{formatTimestamp(currentTimeSeconds)}</span>
            <span>{formatTimestamp(totalDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
