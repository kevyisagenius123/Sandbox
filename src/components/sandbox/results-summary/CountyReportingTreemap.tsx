import React, { useEffect, useRef, memo } from 'react'
import * as echarts from 'echarts'
import type { CountyTreemapNode } from './types'
import { chartTheme } from './chartTheme'

interface CountyReportingTreemapProps {
  counties: CountyTreemapNode[]
  height?: number
}

const CountyReportingTreemap: React.FC<CountyReportingTreemapProps> = ({ counties, height = 400 }) => {
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
    if (!chartInstanceRef.current || counties.length === 0) return

    const chart = chartInstanceRef.current

    // Group counties by state
    const stateGroups = new Map<string, CountyTreemapNode[]>()
    counties.forEach((county) => {
      if (!stateGroups.has(county.state)) {
        stateGroups.set(county.state, [])
      }
      stateGroups.get(county.state)!.push(county)
    })

    // Build hierarchical data
    const treemapData = Array.from(stateGroups.entries()).map(([state, stateCounties]) => {
      const stateTotal = stateCounties.reduce((sum, c) => sum + c.value, 0)

      return {
        name: state,
        value: stateTotal,
        itemStyle: {
          borderColor: '#1e293b',
          borderWidth: 3,
          gapWidth: 3,
        },
        children: stateCounties.map((county) => {
          // Color by reporting status
          let color: string
          if (county.reportingPercent >= 100) {
            color = '#10b981' // emerald-500 (complete)
          } else if (county.reportingPercent >= 50) {
            color = '#f59e0b' // amber-500 (in progress)
          } else if (county.reportingPercent > 0) {
            color = '#64748b' // slate-500 (started)
          } else {
            color = '#334155' // slate-700 (not started)
          }

          return {
            name: county.name,
            value: county.value,
            fips: county.fips,
            reportingPercent: county.reportingPercent,
            demVotes: county.demVotes,
            gopVotes: county.gopVotes,
            margin: county.margin,
            marginPercent: county.marginPercent,
            leader: county.leader,
            isKeyCounty: county.isKeyCounty,
            itemStyle: {
              color,
              borderColor: county.isKeyCounty ? '#fbbf24' : '#0f172a',
              borderWidth: county.isKeyCounty ? 2 : 1,
            },
          }
        }),
      }
    })

    const option: echarts.EChartsOption = {
      ...chartTheme.animationConfig,
      backgroundColor: 'transparent',
      tooltip: {
        ...chartTheme.tooltipStyle,
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data
          if (!data || !data.fips) {
            return `
              <div style="font-weight: 600; margin-bottom: 4px; color: #f8fafc;">
                ${params.name}
              </div>
              <div style="font-size: 11px; color: #94a3b8;">
                ${data.value.toLocaleString()} total votes
              </div>
            `
          }

          const leaderLabel = data.leader === 'GOP' ? 'GOP' : data.leader === 'DEM' ? 'DEM' : 'Tie'
          const leaderColor =
            data.leader === 'GOP'
              ? chartTheme.partyColors.republican
              : data.leader === 'DEM'
                ? chartTheme.partyColors.democratic
                : chartTheme.partyColors.other

          let statusLabel = ''
          let statusColor = ''
          if (data.reportingPercent >= 100) {
            statusLabel = '✓ Complete'
            statusColor = '#10b981'
          } else if (data.reportingPercent >= 50) {
            statusLabel = '⟳ In Progress'
            statusColor = '#f59e0b'
          } else if (data.reportingPercent > 0) {
            statusLabel = '⋯ Started'
            statusColor = '#64748b'
          } else {
            statusLabel = '○ Not Started'
            statusColor = '#64748b'
          }

          return `
            <div style="font-weight: 600; margin-bottom: 4px; color: #f8fafc;">
              ${data.name}${data.isKeyCounty ? ' ⭐' : ''}
            </div>
            <div style="color: ${leaderColor}; font-weight: 600; margin-bottom: 4px;">
              ${leaderLabel} +${Math.abs(data.marginPercent).toFixed(1)}%
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              ${data.demVotes.toLocaleString()} DEM | ${data.gopVotes.toLocaleString()} GOP
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">
              ${data.value.toLocaleString()} total votes
            </div>
            <div style="font-size: 11px; font-weight: 600; color: ${statusColor};">
              ${statusLabel}: ${data.reportingPercent.toFixed(1)}%
            </div>
          `
        },
      },
      series: [
        {
          type: 'treemap',
          data: treemapData,
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: {
            show: true,
            height: 24,
            bottom: 0,
            itemStyle: {
              color: 'rgba(15, 23, 42, 0.95)',
              borderColor: '#334155',
              borderWidth: 1,
              shadowBlur: 4,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
              textStyle: {
                color: '#e2e8f0',
                fontSize: 11,
                fontWeight: 600,
              },
            },
            emphasis: {
              itemStyle: {
                color: 'rgba(30, 41, 59, 1)',
                textStyle: {
                  color: '#f1f5f9',
                },
              },
            },
          },
          label: {
            show: true,
            formatter: (params: any) => {
              if (params.data.fips) {
                const name = params.name.length > 12 ? params.name.substring(0, 9) + '...' : params.name
                return `{name|${name}}\n{percent|${params.data.reportingPercent.toFixed(0)}%}`
              }
              return params.name
            },
            rich: {
              name: {
                fontSize: 11,
                color: '#f8fafc',
                fontWeight: 600,
                lineHeight: 14,
              },
              percent: {
                fontSize: 10,
                color: '#cbd5e1',
                fontWeight: 500,
              },
            },
            overflow: 'truncate',
            ellipsis: '...',
          },
          upperLabel: {
            show: true,
            height: 28,
            color: '#f8fafc',
            fontSize: 13,
            fontWeight: 700,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            borderWidth: 1,
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
          levels: [
            {
              itemStyle: {
                borderWidth: 0,
              },
            },
            {
              itemStyle: {
                borderWidth: 3,
                borderColor: '#1e293b',
                gapWidth: 3,
                color: '#0f172a',
              },
              upperLabel: {
                show: true,
              },
            },
            {
              itemStyle: {
                borderWidth: 1,
              },
              label: {
                show: true,
              },
            },
          ],
        },
      ],
    }

    chart.setOption(option, { notMerge: false, lazyUpdate: true })
  }, [counties])

  return <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />
}

const areEqual = (prevProps: CountyReportingTreemapProps, nextProps: CountyReportingTreemapProps): boolean => {
  if (prevProps.counties.length !== nextProps.counties.length) return false

  if (prevProps.counties.length > 0) {
    const indices = [0, Math.floor(prevProps.counties.length / 2), prevProps.counties.length - 1]
    for (const i of indices) {
      const prev = prevProps.counties[i]
      const next = nextProps.counties[i]
      if (prev.fips !== next.fips || prev.reportingPercent !== next.reportingPercent || prev.value !== next.value) {
        return false
      }
    }
  }

  if (prevProps.height !== nextProps.height) return false

  return true
}

export default memo(CountyReportingTreemap, areEqual)
