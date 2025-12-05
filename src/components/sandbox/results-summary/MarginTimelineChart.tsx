import React, { useEffect, useRef, memo } from 'react'
import * as echarts from 'echarts'
import type { HistoricalSnapshot, MarginEvent } from './types'

interface MarginTimelineChartProps {
  snapshots: HistoricalSnapshot[]
  events?: MarginEvent[]
  height?: number
}

const MarginTimelineChart: React.FC<MarginTimelineChartProps> = ({ snapshots, events = [], height = 300 }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  // Initialize chart once
  useEffect(() => {
    if (!chartRef.current) return

    const chart = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' })
    chartInstanceRef.current = chart

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  // Update chart when data changes
  useEffect(() => {
    if (!chartInstanceRef.current || snapshots.length === 0) return

    const chart = chartInstanceRef.current
    const isMobile = window.innerWidth < 640

    // Prepare timeline data
    const times = snapshots.map((s) => s.elapsedMinutes * 60) // Convert to seconds for consistency
    const margins = snapshots.map((s) => s.marginPercent)
    const chartData = times.map((time, idx) => [time, margins[idx]])

    // Prepare event markers
    const eventMarkers = events.map((event) => {
      const time = event.elapsedMinutes * 60
      const severityColors: Record<string, string> = {
        danger: '#f87171',
        warning: '#fbbf24',
        success: '#34d399',
        info: '#38bdf8',
        milestone: '#a78bfa'
      }
      const color = severityColors[event.type || 'milestone'] || '#38bdf8'

      return {
        value: [time, 0], // Will snap to line
        meta: {
          headline: event.label,
          detail: event.description,
          id: event.timestamp.toString()
        },
        itemStyle: {
          color,
          borderColor: '#f8fafc',
          borderWidth: 1.5,
          shadowBlur: 10,
          shadowColor: `${color}33`
        }
      }
    })

    const latestSnapshot = snapshots[snapshots.length - 1]
    const latestTime = times[times.length - 1] || 0
    const xAxisMax = Math.max(...times, ...eventMarkers.map(m => m.value[0]))

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
      markLine: latestSnapshot ? {
        symbol: 'none',
        lineStyle: {
          type: 'dashed',
          color: latestSnapshot.marginPercent >= 0 ? '#f97316' : '#3b82f6'
        },
        label: {
          formatter: `Current ${latestSnapshot.marginPercent >= 0 ? 'GOP' : 'DEM'} margin`,
          color: '#cbd5e1',
          fontSize: isMobile ? 10 : 12
        },
        data: [
          [{ coord: [latestTime, latestSnapshot.marginPercent] }, { coord: [0, latestSnapshot.marginPercent] }]
        ]
      } : undefined
    }

    const scatterSeries: echarts.SeriesOption | null = eventMarkers.length ? {
      type: 'scatter',
      name: 'Events',
      data: eventMarkers,
      symbolSize: isMobile ? 12 : 14,
      emphasis: {
        scale: true,
        focus: 'series',
        label: {
          show: true,
          formatter: (params: any) => params?.data?.meta?.headline || '',
          color: '#f8fafc',
          backgroundColor: 'rgba(15,23,42,0.85)',
          borderRadius: 6,
          padding: [4, 8],
          fontSize: isMobile ? 10 : 11
        }
      },
      label: { show: false }
    } : null

    const series: echarts.SeriesOption[] = [lineSeries]
    if (scatterSeries) {
      series.push(scatterSeries)
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
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
        formatter: (params: any) => {
          const entries = Array.isArray(params) ? params : [params]
          const point = entries[0]
          if (!point) return ''
          
          const raw = point.value as [number, number] | number[]
          const [time, marginValue] = Array.isArray(raw) ? raw : [0, 0]
          const minutes = Math.floor(time / 60)
          const seconds = Math.floor(time % 60)
          const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
          
          return `${timeStr}<br/>Margin: ${marginValue.toFixed(2)} pts`
        }
      },
      grid: {
        left: isMobile ? 35 : 40,
        right: isMobile ? 12 : 16,
        top: isMobile ? 20 : 30,
        bottom: isMobile ? 24 : 28
      },
      xAxis: {
        type: 'value',
        name: 'Time',
        nameTextStyle: {
          fontSize: isMobile ? 10 : 12,
          color: '#94a3b8'
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
          fontSize: isMobile ? 10 : 12,
          color: '#94a3b8'
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

    chart.setOption(option)
    requestAnimationFrame(() => {
      chart.resize()
    })
  }, [snapshots, events])

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />
}

// Custom comparator for memoization
const areEqual = (prevProps: MarginTimelineChartProps, nextProps: MarginTimelineChartProps): boolean => {
  if (prevProps.snapshots.length !== nextProps.snapshots.length) return false
  if (prevProps.events?.length !== nextProps.events?.length) return false
  if (prevProps.height !== nextProps.height) return false

  // Check last snapshot
  if (prevProps.snapshots.length > 0 && nextProps.snapshots.length > 0) {
    const prevLast = prevProps.snapshots[prevProps.snapshots.length - 1]
    const nextLast = nextProps.snapshots[nextProps.snapshots.length - 1]
    if (
      prevLast.timestamp !== nextLast.timestamp ||
      prevLast.marginPercent !== nextLast.marginPercent
    ) {
      return false
    }
  }

  return true
}

export default memo(MarginTimelineChart, areEqual)
