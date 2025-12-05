import React, { useEffect } from 'react'
import * as echarts from 'echarts'
import type { HistoricalMatchResponse } from '../../../services/pythonAnalytics'
import { debugLog } from '../../../utils/debugLogger'

interface HistoricalComparisonChartProps {
  historicalData: HistoricalMatchResponse | null
  currentMargin: number
}

export const HistoricalComparisonChart: React.FC<HistoricalComparisonChartProps> = ({
  historicalData,
  currentMargin
}) => {
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstance = React.useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !historicalData) return

    debugLog('[HistoricalComparisonChart] Historical data:', {
      matches: historicalData.similar_elections.length,
      predictedMargin: historicalData.predicted_margin,
      confidence: historicalData.confidence,
      topMatches: historicalData.similar_elections.slice(0, 3).map(e => ({
        year: e.year,
        state: e.state,
        margin: e.final_margin,
        similarity: e.similarity_score
      }))
    })

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    // Prepare data for scatter plot
    const scatterData = historicalData.similar_elections.map((election, idx) => ({
      value: [
        election.final_margin,
        election.similarity_score * 100,
        election.year
      ],
      name: `${election.year} ${election.state}`,
      itemStyle: {
        color: election.final_margin > 0 ? '#60a5fa' : '#f87171',
        opacity: 0.7 + (idx * 0.05)
      }
    }))

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${data.name}</div>
            <div style="font-size: 12px;">
              <div>Final Margin: <span style="color: ${data.itemStyle.color}; font-weight: bold;">${data.value[0] > 0 ? '+' : ''}${data.value[0].toFixed(2)}%</span></div>
              <div>Similarity: <span style="font-weight: bold;">${data.value[1].toFixed(1)}%</span></div>
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
        left: 50,
        right: 30,
        top: 40,
        bottom: 50
      },
      xAxis: {
        type: 'value',
        name: 'Final Margin (%)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: '#94a3b8',
          fontSize: 11
        },
        axisLine: {
          lineStyle: { color: '#334155' }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (value: number) => `${value > 0 ? '+' : ''}${value}`
        },
        splitLine: {
          lineStyle: {
            color: '#1e293b',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Similarity Score (%)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          color: '#94a3b8',
          fontSize: 11
        },
        axisLine: {
          lineStyle: { color: '#334155' }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (value: number) => `${value}%`
        },
        splitLine: {
          lineStyle: {
            color: '#1e293b',
            type: 'dashed'
          }
        },
        min: 50,
        max: 100
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: (data: any) => {
            // Size based on similarity score
            return 10 + (data[1] / 100) * 20
          },
          emphasis: {
            itemStyle: {
              borderColor: '#f1f5f9',
              borderWidth: 2
            }
          },
          markLine: {
            silent: true,
            lineStyle: {
              color: '#fbbf24',
              type: 'solid',
              width: 2
            },
            label: {
              show: true,
              position: 'end',
              formatter: 'Current',
              color: '#fbbf24',
              fontSize: 10
            },
            data: [
              {
                xAxis: currentMargin,
                label: {
                  show: true,
                  formatter: `Current: ${currentMargin > 0 ? '+' : ''}${currentMargin.toFixed(2)}%`
                }
              }
            ]
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
  }, [historicalData, currentMargin])

  if (!historicalData) {
    return (
      <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
        <header className="mb-3">
          <h3 className="text-xs font-semibold text-slate-400">Historical Comparisons</h3>
        </header>
        <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
          Python analytics unavailable
        </div>
      </article>
    )
  }

  const getConfidenceColor = () => {
    if (!historicalData.confidence) return 'slate'
    switch (historicalData.confidence) {
      case 'high': return 'emerald'
      case 'medium': return 'amber'
      case 'low': return 'red'
      default: return 'slate'
    }
  }

  const confidenceColor = getConfidenceColor()

  return (
    <article className="rounded-lg border border-indigo-800/30 bg-gradient-to-br from-indigo-950/20 to-slate-950/40 p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-indigo-100">Similar Historical Elections</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
          k-NN Pattern Matching
        </span>
      </header>

      <div ref={chartRef} className="h-64 mb-4" />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-900/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Predicted Margin</div>
          <div className={`mt-1 text-xl font-bold ${
            historicalData.predicted_margin && historicalData.predicted_margin > 0 ? 'text-blue-400' : 'text-red-400'
          }`}>
            {historicalData.predicted_margin !== null 
              ? `${historicalData.predicted_margin > 0 ? '+' : ''}${historicalData.predicted_margin.toFixed(2)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="rounded-lg bg-slate-900/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Confidence</div>
          <div className={`mt-1 text-xl font-bold text-${confidenceColor}-400 uppercase`}>
            {historicalData.confidence || 'Unknown'}
          </div>
        </div>

        <div className="rounded-lg bg-slate-900/50 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Matches Found</div>
          <div className="mt-1 text-xl font-bold text-slate-300">
            {historicalData.similar_elections.length}
          </div>
        </div>
      </div>

      <footer className="mt-4 border-t border-slate-800/50 pt-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Top Matches</div>
        <div className="space-y-1">
          {historicalData.similar_elections.slice(0, 3).map((election, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {election.year} {election.state}
              </span>
              <span className={`font-medium ${election.final_margin > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {election.final_margin > 0 ? '+' : ''}{election.final_margin.toFixed(2)}%
              </span>
              <span className="text-slate-500">
                {(election.similarity_score * 100).toFixed(1)}% similar
              </span>
            </div>
          ))}
        </div>
      </footer>
    </article>
  )
}

export default HistoricalComparisonChart
