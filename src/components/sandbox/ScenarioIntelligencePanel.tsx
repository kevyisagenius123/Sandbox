import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { NewsroomEvent } from '../../types/sandbox'

const Metrics3DPanel = lazy(() => import('./Metrics3DPanel').then(m => ({ default: m.Metrics3DPanel })))

export interface InsightSnapshot {
  timestamp: number
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  marginVotes: number
  marginPct: number
  reportingPercent: number
  voteReportingPercent: number
  votesRemaining: number
}

interface ScenarioIntelligencePanelProps {
  history: InsightSnapshot[]
  currentTimeSeconds: number
  totalDuration: number
  newsroomEvents?: NewsroomEvent[]
}

const numberFormatter = new Intl.NumberFormat('en-US')
const percentFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const formatNumber = (value: number) => numberFormatter.format(Math.round(value))
const formatPercent = (value: number) => `${percentFormatter.format(value)}%`

const formatSimTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const EVENT_SEVERITY_COLORS: Record<string, string> = {
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  info: '#38bdf8'
}

type EventMarkerPoint = {
  value: [number, number]
  meta: {
    headline: string
    detail?: string
    reportingPercent?: number
    timestampLabel?: string
    severity: string
    id: string
  }
  itemStyle: {
    color: string
    borderColor: string
    borderWidth: number
    shadowBlur: number
    shadowColor: string
  }
}

const computeWinProbability = (snapshot: InsightSnapshot | null) => {
  if (!snapshot) return 50

  const { marginVotes, votesRemaining, totalVotes } = snapshot

  const safeTotal = Math.max(totalVotes, 1)
  const marginShare = marginVotes / safeTotal
  const outstandingShare = votesRemaining / (totalVotes + votesRemaining)

  const scaling = 1 - Math.min(0.95, outstandingShare)
  const probability = 50 + (marginShare * 100 * scaling)

  return Math.min(100, Math.max(0, probability))
}

const buildNarrative = (history: InsightSnapshot[]): string => {
  if (history.length === 0) {
    return 'Awaiting simulation data to generate insights.'
  }

  const latest = history[history.length - 1]
  const previous = history.length > 1 ? history[history.length - 2] : null

  const leader = latest.marginVotes === 0
    ? 'The race is tied'
    : latest.marginVotes > 0
      ? 'Republicans lead'
      : 'Democrats lead'

  const marginPts = latest.marginPct
  const remaining = latest.votesRemaining
  const reporting = latest.voteReportingPercent || latest.reportingPercent

  if (!previous || Math.abs(latest.marginPct - previous.marginPct) < 0.1) {
    return `${leader} by ${Math.abs(marginPts).toFixed(1)} pts with ${formatPercent(reporting)} reporting and ${formatNumber(remaining)} ballots outstanding.`
  }

  const trend = latest.marginPct > previous.marginPct ? 'expanding' : 'narrowing'
  const delta = Math.abs(latest.marginPct - previous.marginPct).toFixed(1)

  return `${leader}; margin ${trend} by ${delta} pts in the latest update. ${formatPercent(reporting)} of expected vote in; ${formatNumber(remaining)} ballots remain.`
}

export const ScenarioIntelligencePanel: React.FC<ScenarioIntelligencePanelProps> = ({
  history,
  currentTimeSeconds,
  totalDuration,
  newsroomEvents = []
}) => {
  const marginChartRef = useRef<HTMLDivElement>(null)
  const gaugeChartRef = useRef<HTMLDivElement>(null)
  const marginChartInstance = useRef<echarts.ECharts | null>(null)
  const gaugeChartInstance = useRef<echarts.ECharts | null>(null)
  const [view3D, setView3D] = useState(false)

  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null
  const winProbability = useMemo(() => computeWinProbability(latestSnapshot), [latestSnapshot])
  const narrative = useMemo(() => buildNarrative(history), [history])

  const timelineData = useMemo(() => {
    if (!history.length) return []
    return history.map((snapshot) => ({
      time: snapshot.timestamp,
      margin: snapshot.marginPct
    }))
  }, [history])

  const eventMarkers = useMemo<EventMarkerPoint[]>(() => {
    if (!history.length || !newsroomEvents.length) return []

    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp)

    const findNearestSnapshot = (time: number) => {
      let nearest = sortedHistory[0]
      let minDiff = Math.abs(sortedHistory[0].timestamp - time)
      for (let i = 1; i < sortedHistory.length; i += 1) {
        const candidate = sortedHistory[i]
        const diff = Math.abs(candidate.timestamp - time)
        if (diff < minDiff) {
          minDiff = diff
          nearest = candidate
        }
      }
      return nearest
    }

    const MAX_EVENTS = 12

    return newsroomEvents
      .filter((event) => Number.isFinite(event.simulationTimeSeconds))
      .slice(-MAX_EVENTS)
      .map((event) => {
        const time = Math.max(0, Number(event.simulationTimeSeconds) || 0)
        const nearest = findNearestSnapshot(time)
        const severityKey = event.severity ? event.severity.toLowerCase() : 'info'
        const color = EVENT_SEVERITY_COLORS[severityKey] ?? EVENT_SEVERITY_COLORS.info

        const marker: EventMarkerPoint = {
          value: [time, nearest.marginPct] as [number, number],
          meta: {
            headline: event.headline ?? 'Newsroom update',
            detail: event.detail,
            reportingPercent: nearest.reportingPercent,
            timestampLabel: event.timestamp,
            severity: severityKey,
            id: String(event.id ?? `${event.timestamp}-${event.headline ?? 'event'}`)
          },
          itemStyle: {
            color,
            borderColor: '#f8fafc',
            borderWidth: 1.5,
            shadowBlur: 10,
            shadowColor: `${color}33`
          }
        }
        return marker
      })
  }, [history, newsroomEvents])

  const hasHistory = history.length > 0

  useEffect(() => {
    if (!hasHistory || marginChartInstance.current || !marginChartRef.current) {
      return
    }

    const chart = echarts.init(marginChartRef.current, 'dark', { renderer: 'canvas' })
    marginChartInstance.current = chart
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    chart.on('finished', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.off('finished', handleResize)
    }
  }, [hasHistory])

  useEffect(() => {
    if (!marginChartInstance.current) return

    requestAnimationFrame(() => {
      marginChartInstance.current?.resize()
    })
  }, [view3D])

  useEffect(() => {
    if (!hasHistory || gaugeChartInstance.current || !gaugeChartRef.current) {
      return
    }

    const chart = echarts.init(gaugeChartRef.current, 'dark', { renderer: 'canvas' })
    gaugeChartInstance.current = chart
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    chart.on('finished', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.off('finished', handleResize)
    }
  }, [hasHistory])

  // Cleanup all chart instances on unmount
  useEffect(() => {
    return () => {
      if (marginChartInstance.current) {
        marginChartInstance.current.dispose()
        marginChartInstance.current = null
      }
      if (gaugeChartInstance.current) {
        gaugeChartInstance.current.dispose()
        gaugeChartInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!gaugeChartInstance.current) return

    requestAnimationFrame(() => {
      gaugeChartInstance.current?.resize()
    })
  }, [view3D])

  useEffect(() => {
    if (!marginChartInstance.current) return

    const times = timelineData.map((entry) => entry.time)
    const margins = timelineData.map((entry) => entry.margin)
    const chartData = times.map((time, idx) => [time, margins[idx]])
    const eventMaxTime = eventMarkers.length
      ? Math.max(...eventMarkers.map((marker) => marker.value[0]))
      : 0
    const timelineMaxTime = times.length ? times[times.length - 1] : 0
    const xAxisMax = Math.max(totalDuration, timelineMaxTime, eventMaxTime)
    const latestTime = times.length ? times[times.length - 1] : 0

    const isMobile = window.innerWidth < 640

    const lineSeries: echarts.SeriesOption = {
      type: 'line',
      name: 'Margin',
      data: chartData,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: '#38bdf8', width: isMobile ? 2 : 2.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(56, 189, 248, 0.32)' },
          { offset: 1, color: 'rgba(56, 189, 248, 0.05)' }
        ])
      },
      markLine: latestSnapshot && times.length ? ({
        symbol: 'none',
        lineStyle: {
          type: 'dashed',
          color: latestSnapshot.marginPct >= 0 ? '#f97316' : '#3b82f6'
        },
        label: {
          formatter: `Current ${latestSnapshot.marginPct >= 0 ? 'GOP' : 'DEM'} margin`,
          color: '#cbd5f5',
          fontSize: isMobile ? 10 : 12
        },
        data: [
          [{ coord: [latestTime, latestSnapshot.marginPct] }, { coord: [0, latestSnapshot.marginPct] }]
        ]
      } as echarts.MarkLineComponentOption) : undefined
    }

    const scatterSeries: echarts.SeriesOption | null = eventMarkers.length ? ({
      type: 'scatter',
      name: 'News Events',
      data: eventMarkers,
      symbolSize: isMobile ? 12 : 14,
      emphasis: {
        scale: true,
        focus: 'series',
        label: {
          show: true,
          formatter: (params: any) => {
            const data = params?.data as EventMarkerPoint | undefined
            return data?.meta.headline ?? ''
          },
          color: '#f8fafc',
          backgroundColor: 'rgba(15,23,42,0.85)',
          borderRadius: 6,
          padding: [4, 8],
          fontSize: isMobile ? 10 : 11
        }
      },
      label: { show: false },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: {
          color: '#e2e8f0',
          fontSize: isMobile ? 11 : 12
        },
        formatter: (params: any) => {
          const data = params?.data as EventMarkerPoint | undefined
          if (!data?.meta) return ''
          const time = Array.isArray(data.value) ? data.value[0] : 0
          const margin = Array.isArray(data.value) ? data.value[1] : 0
          const headline = data.meta.headline
          const detail = data.meta.detail ? `<br/>${data.meta.detail}` : ''
          const reporting = Number.isFinite(data.meta.reportingPercent)
            ? `<br/>${Number(data.meta.reportingPercent).toFixed(1)}% reporting`
            : ''
          const timestampLabel = data.meta.timestampLabel ? `<br/><span class="text-slate-400">${data.meta.timestampLabel}</span>` : ''
          return `<strong>${headline}</strong><br/>${formatSimTime(time)} · Margin ${Number(margin).toFixed(2)} pts${reporting}${detail}${timestampLabel}`
        }
      }
    }) : null

    const series: echarts.SeriesOption[] = [lineSeries]
    if (scatterSeries) {
      series.push(scatterSeries)
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: 'Margin Evolution',
        left: 'center',
        top: isMobile ? 4 : 6,
        textStyle: {
          color: '#f8fafc',
          fontSize: isMobile ? 12 : 14,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: isMobile ? [8, 10] : [10, 14],
        textStyle: {
          color: '#e2e8f0',
          fontSize: isMobile ? 11 : 12
        },
        formatter: (params) => {
          const entries = Array.isArray(params) ? params : [params]
          const eventEntry = entries.find((entry: any) => entry?.seriesType === 'scatter')
          if (eventEntry) {
            const data = eventEntry.data as EventMarkerPoint | undefined
            if (data?.meta) {
              const time = Array.isArray(data.value) ? data.value[0] : 0
              const marginValue = Array.isArray(data.value) ? data.value[1] : 0
              const reporting = Number.isFinite(data.meta.reportingPercent)
                ? ` · ${Number(data.meta.reportingPercent).toFixed(1)}% reporting`
                : ''
              const detail = data.meta.detail ? `<br/>${data.meta.detail}` : ''
              const timestampText = data.meta.timestampLabel ? `<br/><span class="text-slate-400">${data.meta.timestampLabel}</span>` : ''
              return `<strong>${data.meta.headline}</strong><br/>${formatSimTime(time)} · Margin ${Number(marginValue).toFixed(2)} pts${reporting}${detail}${timestampText}`
            }
          }

          const point = entries[0]
          if (!point) return ''
          const raw = (point as any).value as [number, number] | number[] | number
          const arrayValue = Array.isArray(raw) ? raw : [Number(raw) || 0, 0]
          const [time, marginValue] = arrayValue
          return `${formatSimTime(Number(time))}<br/>Margin: ${Number(marginValue).toFixed(2)} pts`
        }
      },
      grid: {
        left: isMobile ? 35 : 40,
        right: isMobile ? 12 : 16,
        top: isMobile ? 40 : 50,
        bottom: isMobile ? 24 : 28
      },
      xAxis: {
        type: 'value',
        name: 'Seconds',
        nameTextStyle: {
          fontSize: isMobile ? 10 : 12
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: isMobile ? 10 : 11,
          formatter: (value: number) => `${Math.round(value / 60)}m`
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
        min: 0,
        max: xAxisMax
      },
      yAxis: {
        type: 'value',
        name: 'Margin (pts)',
        nameTextStyle: {
          fontSize: isMobile ? 10 : 12
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: isMobile ? 10 : 11
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#1e293b' } }
      },
      series
    }

    marginChartInstance.current.setOption(option)
    requestAnimationFrame(() => {
      marginChartInstance.current?.resize()
    })
  }, [timelineData, totalDuration, latestSnapshot, eventMarkers])

  useEffect(() => {
    if (!gaugeChartInstance.current) return

    const isMobile = window.innerWidth < 640

    // Create smooth red-to-blue gradient for the gauge track
    const gradientColors: [number, string][] = [
      [0, '#7f1d1d'],    // 0% - Deep red
      [0.1, '#991b1b'],  // 10% - Dark red
      [0.2, '#dc2626'],  // 20% - Red
      [0.3, '#ef4444'],  // 30% - Bright red
      [0.4, '#f87171'],  // 40% - Light red
      [0.45, '#fca5a5'], // 45% - Lighter red
      [0.5, '#e5e7eb'],  // 50% - Neutral gray
      [0.55, '#93c5fd'], // 55% - Light blue
      [0.6, '#60a5fa'],  // 60% - Lighter blue
      [0.7, '#3b82f6'],  // 70% - Bright blue
      [0.8, '#2563eb'],  // 80% - Blue
      [0.9, '#1d4ed8'],  // 90% - Dark blue
      [1, '#1e3a8a']     // 100% - Deep blue
    ]

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          center: ['50%', isMobile ? '60%' : '65%'],
          radius: isMobile ? '90%' : '95%',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 10,
          progress: {
            show: false
          },
          pointer: {
            show: true,
            length: '75%',
            width: isMobile ? 4 : 5,
            itemStyle: {
              color: '#f8fafc',
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              shadowBlur: 10
            }
          },
          axisLine: {
            lineStyle: {
              width: isMobile ? 18 : 22,
              color: gradientColors
            }
          },
          axisTick: {
            distance: isMobile ? -22 : -26,
            length: isMobile ? 6 : 8,
            lineStyle: { 
              color: '#ffffff', 
              width: 1.5,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 2
            }
          },
          splitLine: {
            distance: isMobile ? -26 : -30,
            length: isMobile ? 10 : 12,
            lineStyle: { 
              color: '#ffffff', 
              width: 2,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              shadowBlur: 3
            }
          },
          axisLabel: {
            distance: isMobile ? -42 : -48,
            color: '#f8fafc',
            fontSize: isMobile ? 11 : 13,
            fontWeight: 600,
            formatter: (value: number) => {
              // Only show labels at key intervals
              if (value === 0 || value === 50 || value === 100 || value % 20 === 0) {
                return `${value}`
              }
              return ''
            }
          },
          title: {
            show: true,
            offsetCenter: [0, isMobile ? '75%' : '80%'],
            fontSize: isMobile ? 11 : 13,
            color: '#94a3b8',
            fontWeight: 500
          },
          detail: {
            valueAnimation: true,
            fontSize: isMobile ? 28 : 36,
            fontWeight: 700,
            offsetCenter: [0, isMobile ? '40%' : '45%'],
            color: '#f8fafc',
            formatter: (value: number) => `${value.toFixed(0)}`
          },
          data: [
            { 
              value: winProbability,
              name: latestSnapshot 
                ? `${latestSnapshot.marginPct >= 0 ? 'Sherrill' : 'Opponent'}'s % Chance to Win`
                : 'Win Probability'
            }
          ]
        }
      ]
    }

    gaugeChartInstance.current.setOption(option)
    requestAnimationFrame(() => {
      gaugeChartInstance.current?.resize()
    })
  }, [winProbability])

  if (!history.length) {
    return (
      <div className="mt-3 rounded-2xl border border-gray-800/70 bg-gray-900/70 p-3 text-sm text-gray-300 sm:mt-4 sm:p-4">
        <h3 className="text-sm font-semibold text-white">Scenario Intelligence</h3>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">Load or play a simulation to begin generating professional insights.</p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-800/70 bg-gray-900/70 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400 sm:text-[11px]">Scenario Intelligence</p>
          <h3 className="text-base font-semibold text-white sm:text-lg">Margin Trajectory &amp; Win Odds</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView3D(!view3D)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              view3D
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            title="Toggle 3D visualization"
          >
            {view3D ? '2D View' : '3D View'}
          </button>
          <div className="text-xs text-gray-400">
            t={formatNumber(currentTimeSeconds)}s • {history.length} snapshots
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 overflow-hidden">
          <div className={view3D ? 'h-[360px] sm:h-[420px] p-2' : 'h-48 w-full sm:h-56'}>
            {view3D ? (
              <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-gray-400">Loading 3D view…</div>}>
                <Metrics3DPanel
                  history={history}
                  currentTimeSeconds={currentTimeSeconds}
                  totalDuration={totalDuration}
                  height="100%"
                  width="100%"
                />
              </Suspense>
            ) : (
              <div ref={marginChartRef} className="h-full w-full" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Automated narrative</div>
            <p className="mt-2 text-xs leading-relaxed text-gray-200 sm:text-sm">{narrative}</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-gray-950/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Win probability (heuristic)</div>
            {!view3D && (
              <>
                <div ref={gaugeChartRef} className="mt-2 h-32 sm:h-40" />
                <p className="mt-2 text-[10px] leading-relaxed text-gray-500 sm:text-[11px]">
                  Estimated likelihood based on current margin and outstanding ballots. Confidence tightens as remaining vote shrinks.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
