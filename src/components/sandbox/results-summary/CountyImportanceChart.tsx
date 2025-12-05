import React, { useEffect } from 'react'
import * as echarts from 'echarts'
import type { CountyImportanceResponse } from '../../../services/pythonAnalytics'
import { debugLog } from '../../../utils/debugLogger'

interface CountyImportanceChartProps {
  importanceData: CountyImportanceResponse | null
}

export const CountyImportanceChart: React.FC<CountyImportanceChartProps> = ({
  importanceData
}) => {
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstance = React.useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !importanceData) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    // Take top 12 counties for visualization
    const topCounties = importanceData.ranked_counties.slice(0, 12)
    
  debugLog('[CountyImportanceChart] Top counties:', topCounties.map(c => ({ name: c.name, score: c.importance_score })))
    
    // Prepare data for horizontal bar chart
    const countyNames = topCounties.map(c => c.name)
    const importanceScores = topCounties.map(c => c.importance_score * 100)
    const types = topCounties.map(c => c.impact_type)

    // Color mapping for county types
    const getBarColor = (type: string) => {
      switch (type) {
        case 'bellwether': return '#10b981' // emerald
        case 'swing': return '#f59e0b' // amber
        case 'high_impact': return '#3b82f6' // blue
        default: return '#64748b' // slate
      }
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const param = params[0]
          const idx = param.dataIndex
          const county = topCounties[idx]
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${county.name}</div>
            <div style="font-size: 12px;">
              <div>Importance: <span style="font-weight: bold;">${(county.importance_score * 100).toFixed(1)}%</span></div>
              <div>Type: <span style="font-weight: bold; text-transform: capitalize;">${county.impact_type.replace('_', ' ')}</span></div>
              <div>Vote Share: <span style="font-weight: bold;">${(county.vote_share * 100).toFixed(1)}%</span></div>
              ${county.bellwether_accuracy ? `<div>Bellwether: <span style="font-weight: bold;">${(county.bellwether_accuracy * 100).toFixed(0)}%</span></div>` : ''}
            </div>
          </div>`
        },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: {
          color: '#e2e8f0'
        }
      },
      grid: {
        left: 120,
        right: 30,
        top: 20,
        bottom: 30
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLine: {
          lineStyle: { color: '#334155' }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: '{value}%'
        },
        splitLine: {
          lineStyle: {
            color: '#1e293b',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'category',
        data: countyNames,
        axisLine: {
          lineStyle: { color: '#334155' }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (value: string) => {
            // Truncate long names
            return value.length > 18 ? value.substring(0, 16) + '...' : value
          }
        },
        axisTick: {
          show: false
        }
      },
      series: [
        {
          type: 'bar',
          data: importanceScores.map((score, idx) => ({
            value: score,
            itemStyle: {
              color: getBarColor(types[idx])
            }
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            color: '#94a3b8',
            fontSize: 10,
            formatter: (params: any) => {
              return `${params.value.toFixed(1)}%`
            }
          },
          emphasis: {
            itemStyle: {
              borderColor: '#f1f5f9',
              borderWidth: 2
            }
          }
        }
      ]
    }

    chart.setOption(option)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartInstance.current = null
    }
  }, [importanceData])

  if (!importanceData) {
    return (
      <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
        <header className="mb-3">
          <h3 className="text-xs font-semibold text-slate-400">County Importance Rankings</h3>
        </header>
        <div className="flex h-96 items-center justify-center text-slate-500 text-sm">
          Python analytics unavailable
        </div>
      </article>
    )
  }

  // Calculate category counts
  const bellwetherCount = importanceData.bellwethers.length
  const swingCount = importanceData.swing_counties.length
  const highImpactCount = importanceData.ranked_counties.filter(c => c.impact_type === 'high_impact').length

  return (
    <article className="rounded-lg border border-emerald-800/30 bg-gradient-to-br from-emerald-950/20 to-slate-950/40 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-emerald-100">Key County Rankings</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          Mutual Information Analysis
        </span>
      </header>

      <div ref={chartRef} className="h-96 mb-4" />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-emerald-900/30 p-3 border border-emerald-700/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">Bellwethers</div>
          </div>
          <div className="text-xl font-bold text-emerald-300">{bellwetherCount}</div>
          <div className="text-[9px] text-emerald-500/70 mt-0.5">Historical predictors</div>
        </div>

        <div className="rounded-lg bg-amber-900/30 p-3 border border-amber-700/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-amber-400"></div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-400">Swing Counties</div>
          </div>
          <div className="text-xl font-bold text-amber-300">{swingCount}</div>
          <div className="text-[9px] text-amber-500/70 mt-0.5">Volatile margins</div>
        </div>

        <div className="rounded-lg bg-blue-900/30 p-3 border border-blue-700/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-400">High Impact</div>
          </div>
          <div className="text-xl font-bold text-blue-300">{highImpactCount}</div>
          <div className="text-[9px] text-blue-500/70 mt-0.5">Large influence</div>
        </div>
      </div>

      <footer className="border-t border-slate-800/50 pt-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Top 3 Most Important</div>
        <div className="space-y-2">
          {importanceData.ranked_counties.slice(0, 3).map((county, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/40 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300">
                  {idx + 1}
                </span>
                <span className="text-slate-300 font-medium">{county.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-[10px]">
                  {(county.vote_share * 100).toFixed(1)}% share
                </span>
                <span className="font-semibold text-emerald-400">
                  {(county.importance_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </article>
  )
}

export default CountyImportanceChart
