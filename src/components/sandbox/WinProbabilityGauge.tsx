import React, { useEffect, useMemo, useRef, memo } from 'react'
import * as echarts from 'echarts'
import type { AggregateResults } from './results-summary/types'
import { debugLog } from '../../utils/debugLogger'

interface WinProbabilityGaugeProps {
  aggregates: AggregateResults
  height?: number | string
  className?: string
}

const computeWinProbability = (aggregates: AggregateResults): { value: number; leader: 'DEM' | 'GOP' | 'TIE' } => {
  const { voteMarginAbsolute: marginVotes, votesRemaining, totalVotes } = aggregates

  const safeTotal = Math.max(totalVotes, 1)
  const marginShare = marginVotes / safeTotal
  const outstandingShare = votesRemaining / (totalVotes + votesRemaining)

  const scaling = 1 - Math.min(0.95, outstandingShare)
  const probability = Math.abs(marginShare * 100 * scaling)

  // DEBUG: Log calculation details
  debugLog('[WinProbabilityGauge] Calculation:', {
    marginVotes,
    totalVotes,
    votesRemaining,
    marginShare: marginShare.toFixed(4),
    outstandingShare: outstandingShare.toFixed(4),
    scaling: scaling.toFixed(4),
    probability: probability.toFixed(2)
  })

  // GOP positive margin = GOP leading, DEM negative margin = DEM leading
  const leader = marginVotes > 0 ? 'GOP' : marginVotes < 0 ? 'DEM' : 'TIE'
  const clampedProb = Math.min(100, Math.max(0, probability))

  return { value: clampedProb, leader }
}

const WinProbabilityGaugeComponent: React.FC<WinProbabilityGaugeProps> = ({
  aggregates,
  height = 200,
  className = ''
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const winProbResult = useMemo(() => computeWinProbability(aggregates), [aggregates])
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const leaderName = winProbResult.leader === 'GOP' ? 'Republican' : winProbResult.leader === 'DEM' ? 'Democratic' : 'Tie'

  // Initialize chart once
  useEffect(() => {
    if (!chartRef.current || chartInstance.current) return

    chartInstance.current = echarts.init(chartRef.current)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        chartInstance.current?.resize()
      })
      resizeObserverRef.current.observe(chartRef.current)
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  // Update chart options when data changes
  useEffect(() => {
    if (!chartInstance.current) return

    // Center at 0, with -100 (DEM) to +100 (GOP)
    const gaugeValue = winProbResult.leader === 'DEM' ? -winProbResult.value : winProbResult.leader === 'GOP' ? winProbResult.value : 0

    const gradientColors: [number, string][] = [
      [0, '#1e3a8a'],     // -100: Deep blue (DEM)
      [0.1, '#1d4ed8'],   // -80: Dark blue
      [0.2, '#2563eb'],   // -60: Blue
      [0.3, '#3b82f6'],   // -40: Bright blue
      [0.4, '#60a5fa'],   // -20: Light blue
      [0.45, '#93c5fd'],  // -10: Lighter blue
      [0.5, '#e5e7eb'],   // 0: Neutral gray (center)
      [0.55, '#fca5a5'],  // +10: Light red
      [0.6, '#f87171'],   // +20: Lighter red
      [0.7, '#ef4444'],   // +40: Bright red
      [0.8, '#dc2626'],   // +60: Red
      [0.9, '#991b1b'],   // +80: Dark red
      [1, '#7f1d1d']      // +100: Deep red (GOP)
    ]

    const option: echarts.EChartsOption = {
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: -100,
          max: 100,
          splitNumber: 10,
          radius: isMobile ? '80%' : '85%',
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
            fontSize: isMobile ? 10 : 12,
            fontWeight: 600,
            formatter: (value: number) => {
              if (value === -100 || value === -50 || value === 0 || value === 50 || value === 100) {
                return `${Math.abs(value)}`
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
            formatter: () => `${winProbResult.value.toFixed(1)}`
          },
          data: [
            {
              value: gaugeValue,
              name: `${leaderName} Win Probability`
            }
          ]
        }
      ] as echarts.GaugeSeriesOption[]
    }

    chartInstance.current.setOption(option)
  }, [winProbResult, isMobile, leaderName])

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    />
  )
}

// Custom comparison - only re-render if key aggregate values change
const areEqual = (prevProps: WinProbabilityGaugeProps, nextProps: WinProbabilityGaugeProps) => {
  const prev = prevProps.aggregates
  const next = nextProps.aggregates
  return (
    prev.voteMarginAbsolute === next.voteMarginAbsolute &&
    prev.votesRemaining === next.votesRemaining &&
    prev.totalVotes === next.totalVotes &&
    prev.leader === next.leader &&
    prevProps.height === nextProps.height &&
    prevProps.className === nextProps.className
  )
}

export const WinProbabilityGauge = memo(WinProbabilityGaugeComponent, areEqual)

export default WinProbabilityGauge
