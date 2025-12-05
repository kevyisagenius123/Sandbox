import React, { useEffect, useRef, memo } from 'react'
import * as echarts from 'echarts'
import type { OutstandingVotesByState } from './types'
import { chartTheme } from './chartTheme'

interface OutstandingVotesChartProps {
  byState: OutstandingVotesByState[]
  height?: number
  topN?: number // Show only top N states by impact
}

const OutstandingVotesChart: React.FC<OutstandingVotesChartProps> = ({ 
  byState, 
  height = 350,
  topN = 10,
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  // Initialize chart once
  useEffect(() => {
    if (!chartRef.current) return

    chartInstanceRef.current = echarts.init(chartRef.current)

    return () => {
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  // Update chart when data changes
  useEffect(() => {
    if (!chartInstanceRef.current || byState.length === 0) return

    const chart = chartInstanceRef.current

    // Sort by potential swing and take top N
    const sortedStates = [...byState]
      .sort((a, b) => b.potentialSwing - a.potentialSwing)
      .slice(0, topN)

    // Prepare data for stacked horizontal bars
    const stateNames = sortedStates.map((s) => s.stateCode)
    const demLeanData = sortedStates.map((s) => s.demLean)
    const uncertainData = sortedStates.map((s) => s.uncertain)
    const gopLeanData = sortedStates.map((s) => s.gopLean)

    const option: echarts.EChartsOption = {
      ...chartTheme.animationConfig,
      backgroundColor: 'transparent',
      grid: {
        left: '8%',
        right: '5%',
        top: '8%',
        bottom: '8%',
        containLabel: true,
      },
      tooltip: {
        ...chartTheme.tooltipStyle,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          
          const dataIndex = params[0].dataIndex
          const state = sortedStates[dataIndex]
          
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${state.state} (${state.stateCode})
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${state.outstanding.toLocaleString()} outstanding votes (${state.outstandingPercent.toFixed(1)}%)
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <div style="width: 10px; height: 10px; background: ${chartTheme.partyColors.democratic}; border-radius: 2px; margin-right: 6px;"></div>
              <span style="font-size: 11px;">DEM Lean: ${state.demLean.toLocaleString()}</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
              <div style="width: 10px; height: 10px; background: ${chartTheme.partyColors.other}; border-radius: 2px; margin-right: 6px;"></div>
              <span style="font-size: 11px;">Uncertain: ${state.uncertain.toLocaleString()}</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
              <div style="width: 10px; height: 10px; background: ${chartTheme.partyColors.republican}; border-radius: 2px; margin-right: 6px;"></div>
              <span style="font-size: 11px;">GOP Lean: ${state.gopLean.toLocaleString()}</span>
            </div>
            <div style="font-size: 11px; font-weight: 600; color: #1e293b; border-top: 1px solid #e2e8f0; padding-top: 4px;">
              Potential Swing: ±${state.potentialSwing.toLocaleString()} votes
            </div>
          `
        },
      },
      legend: {
        ...chartTheme.legendStyle,
        data: ['DEM Lean', 'Uncertain', 'GOP Lean'],
        top: 0,
      },
      xAxis: {
        type: 'value',
        name: 'Outstanding Votes',
        nameLocation: 'middle',
        nameGap: 25,
        nameTextStyle: {
          color: '#64748b',
          fontSize: 11,
        },
        ...chartTheme.axisStyle,
        axisLabel: {
          ...chartTheme.axisStyle.axisLabel,
          formatter: (value: number) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
            return value.toString()
          },
        },
      },
      yAxis: {
        type: 'category',
        data: stateNames,
        ...chartTheme.axisStyle,
        axisLabel: {
          ...chartTheme.axisStyle.axisLabel,
          fontSize: 11,
          fontWeight: 600,
        },
      },
      series: [
        {
          name: 'DEM Lean',
          type: 'bar',
          stack: 'total',
          data: demLeanData,
          itemStyle: {
            color: chartTheme.partyColors.democratic,
          },
          emphasis: {
            focus: 'series',
          },
        },
        {
          name: 'Uncertain',
          type: 'bar',
          stack: 'total',
          data: uncertainData,
          itemStyle: {
            color: chartTheme.partyColors.other,
          },
          emphasis: {
            focus: 'series',
          },
        },
        {
          name: 'GOP Lean',
          type: 'bar',
          stack: 'total',
          data: gopLeanData,
          itemStyle: {
            color: chartTheme.partyColors.republican,
          },
          emphasis: {
            focus: 'series',
          },
        },
      ],
    }

    chart.setOption(option, { notMerge: false, lazyUpdate: true })
  }, [byState, topN])

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />
}

// Custom comparator for memoization
const areEqual = (prevProps: OutstandingVotesChartProps, nextProps: OutstandingVotesChartProps): boolean => {
  // Check byState array length
  if (prevProps.byState.length !== nextProps.byState.length) return false

  // Check first few states for changes
  const checkCount = Math.min(5, prevProps.byState.length)
  for (let i = 0; i < checkCount; i++) {
    const prev = prevProps.byState[i]
    const next = nextProps.byState[i]
    if (
      prev.stateCode !== next.stateCode ||
      prev.outstanding !== next.outstanding ||
      prev.potentialSwing !== next.potentialSwing
    ) {
      return false
    }
  }

  // Check other props
  if (prevProps.height !== nextProps.height) return false
  if (prevProps.topN !== nextProps.topN) return false

  return true
}

export default memo(OutstandingVotesChart, areEqual)
