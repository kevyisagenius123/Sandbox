import React, { useEffect } from 'react'
import * as echarts from 'echarts'
import type { RaceCallResponse } from '../../../services/pythonAnalytics'
import { debugLog } from '../../../utils/debugLogger'

interface RaceCallStatusPanelProps {
  raceCallData: RaceCallResponse | null
  currentMargin: number
  reportingPercent: number
}

export const RaceCallStatusPanel: React.FC<RaceCallStatusPanelProps> = ({
  raceCallData,
  currentMargin,
  reportingPercent
}) => {
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstance = React.useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !raceCallData) return

    debugLog('[RaceCallStatusPanel] Race call data:', {
      callable: raceCallData.callable,
      confidence: raceCallData.confidence,
      winner: raceCallData.winner,
      reason: raceCallData.reason
    })

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    // Confidence gauge visualization
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '65%'],
          radius: '90%',
          min: 0,
          max: 100,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 8,
              color: [
                [0.5, '#ef4444'],
                [0.8, '#fbbf24'],
                [0.995, '#22c55e'],
                [1, '#10b981']
              ]
            }
          },
          pointer: {
            icon: 'path://M2090.36389,615.30999 L2090.36389,615.30999 C2091.48372,615.30999 2092.40383,616.194028 2092.44859,617.312956 L2096.90698,728.755929 C2097.05155,732.369577 2094.2393,735.416212 2090.62566,735.56078 C2090.53845,735.564269 2090.45117,735.566014 2090.36389,735.566014 L2090.36389,735.566014 C2086.74736,735.566014 2083.81557,732.63423 2083.81557,729.017692 C2083.81557,728.930412 2083.81732,728.84314 2083.82081,728.755929 L2088.2792,617.312956 C2088.32396,616.194028 2089.24407,615.30999 2090.36389,615.30999 Z',
            length: '75%',
            width: 12,
            offsetCenter: [0, '5%'],
            itemStyle: {
              color: raceCallData.callable ? '#10b981' : '#fbbf24'
            }
          },
          axisTick: {
            length: 8,
            lineStyle: {
              color: '#475569',
              width: 1
            }
          },
          splitLine: {
            length: 12,
            lineStyle: {
              color: '#475569',
              width: 2
            }
          },
          axisLabel: {
            distance: 20,
            color: '#94a3b8',
            fontSize: 11,
            formatter: (value: number) => `${value}%`
          },
          title: {
            show: false
          },
          detail: {
            valueAnimation: true,
            formatter: () => {
              const confidence = Math.round(raceCallData.confidence * 100)
              return `{value|${confidence}%}\n{label|${raceCallData.certainty || 'Analyzing'}}`
            },
            rich: {
              value: {
                fontSize: 32,
                fontWeight: 'bold',
                color: raceCallData.callable ? '#10b981' : '#fbbf24',
                lineHeight: 40
              },
              label: {
                fontSize: 12,
                color: '#94a3b8',
                // ECharts rich text style supports limited CSS; avoid unsupported properties in type defs
              }
            },
            offsetCenter: [0, '-10%']
          },
          data: [
            {
              value: raceCallData.confidence * 100,
              name: ''
            }
          ]
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
  }, [raceCallData])

  if (!raceCallData) {
    return (
      <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
        <header className="mb-3">
          <h3 className="text-xs font-semibold text-slate-400">Race Call Analysis</h3>
        </header>
        <div className="flex h-48 items-center justify-center text-slate-500 text-sm">
          Python analytics unavailable
        </div>
      </article>
    )
  }

  const getStatusColor = () => {
    if (raceCallData.callable) return 'emerald'
    if (raceCallData.confidence > 0.8) return 'amber'
    return 'slate'
  }

  const statusColor = getStatusColor()

  return (
    <article className={`rounded-lg border border-${statusColor}-800/30 bg-gradient-to-br from-${statusColor}-950/20 to-slate-950/40 p-5`}>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-${statusColor}-500/10 text-${statusColor}-400`}>
            {raceCallData.callable ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h3 className={`text-sm font-semibold text-${statusColor}-100`}>
            {raceCallData.callable ? 'RACE CALLABLE' : 'Awaiting Certainty'}
          </h3>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full bg-${statusColor}-500/10 px-2 py-0.5 text-[10px] font-medium text-${statusColor}-300`}>
          Statistical Analysis
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div ref={chartRef} className="h-48" />
        </div>
        
        <div className="flex flex-col justify-center space-y-3">
          <div className="rounded-lg bg-slate-900/50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Reason</div>
            <div className={`mt-1 text-sm font-medium text-${statusColor}-200`}>
              {raceCallData.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          </div>

          {raceCallData.winner && (
            <div className="rounded-lg bg-slate-900/50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Projected Winner</div>
              <div className={`mt-1 text-lg font-bold ${raceCallData.winner === 'DEM' ? 'text-blue-400' : 'text-red-400'}`}>
                {raceCallData.winner}
              </div>
            </div>
          )}

          {raceCallData.recommendation && (
            <div className="rounded-lg bg-slate-900/50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Recommendation</div>
              <div className="mt-1 text-xs text-slate-300 leading-relaxed">
                {raceCallData.recommendation}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-slate-800/50 pt-3 text-[10px] text-slate-500">
        <span>Confidence: {Math.round(raceCallData.confidence * 100)}%</span>
        <span>Reporting: {(reportingPercent ?? 0).toFixed(1)}%</span>
        <span>Margin: {(currentMargin ?? 0) > 0 ? '+' : ''}{(currentMargin ?? 0).toFixed(2)}%</span>
      </footer>
    </article>
  )
}

export default RaceCallStatusPanel
