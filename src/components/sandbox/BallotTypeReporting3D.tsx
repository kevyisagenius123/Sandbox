import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useSandboxThemeOrDefault } from '../../design/SandboxThemeProvider'
import type { CountySimulationState } from '../../types/sandbox'

type BallotTypeReporting3DProps = {
  countyStates: Map<string, CountySimulationState>
  isOpen?: boolean
  onToggle?: () => void
  selectedCountyFips?: string | null
}

export const BallotTypeReporting3D: React.FC<BallotTypeReporting3DProps> = ({
  countyStates,
  isOpen = true,
  onToggle,
  selectedCountyFips
}) => {
  const theme = useSandboxThemeOrDefault()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const selectedCounty = selectedCountyFips ? countyStates.get(selectedCountyFips) : null

  useEffect(() => {
    if (!chartRef.current || !isOpen || !selectedCounty) return

    // Check if county has votes yet
    if (selectedCounty.currentTotalVotes === 0) {
      return
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    const chart = chartInstance.current

    // Ballot types
    const ballotTypes = ['Early Vote', 'Election Day', 'Mail-In', 'Provisional']

    // Determine county type and calculate distributions
    const totalVotes = selectedCounty.currentTotalVotes
    const isUrban = totalVotes > 100000
    const isSuburban = totalVotes > 50000 && totalVotes <= 100000
    
    const distributions = ballotTypes.map((_, typeIdx) => {
      let typeShare: number
      if (typeIdx === 0) { // Early Vote
        typeShare = isUrban ? 0.45 : isSuburban ? 0.35 : 0.25
      } else if (typeIdx === 1) { // Election Day
        typeShare = isUrban ? 0.20 : isSuburban ? 0.35 : 0.55
      } else if (typeIdx === 2) { // Mail-In
        typeShare = isUrban ? 0.30 : isSuburban ? 0.20 : 0.15
      } else { // Provisional
        typeShare = 0.05
      }
      return Math.round(totalVotes * typeShare)
    })

    // Safe color variables
    const textMutedColor = theme.palette.text.muted || '#999999'

    // Ballot type colors matching the style
    const ballotTypeColors = {
      earlyVote: '#4cabce',
      electionDay: '#e5323e',
      mailIn: '#003366',
      provisional: '#999999'
    }

    const option: any = {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params: any) => {
          const typeIdx = params.value[0]
          const votes = params.value[2]
          const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '0.0'
          return `<strong>${ballotTypes[typeIdx]}</strong><br/>
                  ${votes.toLocaleString()} votes (${percentage}%)`
        }
      },
      xAxis3D: {
        type: 'category',
        data: ballotTypes,
        name: 'Ballot Type',
        nameTextStyle: { color: textMutedColor, fontSize: 11 },
        axisLabel: { 
          color: textMutedColor,
          fontSize: 10,
          rotate: 30,
          interval: 0
        }
      },
      yAxis3D: {
        type: 'category',
        data: ['Count'],
        name: '',
        nameTextStyle: { color: textMutedColor, fontSize: 11 },
        axisLabel: { show: false }
      },
      zAxis3D: {
        type: 'value',
        name: 'Votes',
        nameTextStyle: { color: textMutedColor, fontSize: 11 },
        axisLabel: { 
          color: textMutedColor,
          fontSize: 10,
          formatter: (val: number) => val.toLocaleString()
        }
      },
      grid3D: {
        boxWidth: 100,
        boxHeight: 60,
        boxDepth: 80,
        viewControl: {
          projection: 'perspective',
          autoRotate: false,
          distance: 180,
          alpha: 25,
          beta: 35
        },
        light: {
          main: {
            intensity: 1.2,
            shadow: true
          },
          ambient: {
            intensity: 0.5
          }
        }
      },
      series: [
        {
          type: 'bar3D',
          name: 'Early Vote',
          data: [[0, 0, distributions[0]]],
          shading: 'realistic',
          itemStyle: {
            color: ballotTypeColors.earlyVote,
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#3a9bb0'
            }
          },
          label: {
            show: false
          }
        },
        {
          type: 'bar3D',
          name: 'Election Day',
          data: [[1, 0, distributions[1]]],
          shading: 'realistic',
          itemStyle: {
            color: ballotTypeColors.electionDay,
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#d12837'
            }
          },
          label: {
            show: false
          }
        },
        {
          type: 'bar3D',
          name: 'Mail-In',
          data: [[2, 0, distributions[2]]],
          shading: 'realistic',
          itemStyle: {
            color: ballotTypeColors.mailIn,
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#002955'
            }
          },
          label: {
            show: false
          }
        },
        {
          type: 'bar3D',
          name: 'Provisional',
          data: [[3, 0, distributions[3]]],
          shading: 'realistic',
          itemStyle: {
            color: ballotTypeColors.provisional,
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#808080'
            }
          },
          label: {
            show: false
          }
        }
      ]
    }

    chart.setOption(option)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [selectedCounty, isOpen, theme])

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  const textPrimary = theme.palette.text.primary || '#ffffff'
  const textMuted = theme.palette.text.muted || '#999999'
  const panelBg = theme.surfaces.dockPanel.background || '#1a1a1a'
  const panelBorder = theme.surfaces.dockPanel.borderColor || '#333333'

  const countyType = selectedCounty 
    ? selectedCounty.currentTotalVotes > 100000 
      ? 'Urban' 
      : selectedCounty.currentTotalVotes > 50000 
        ? 'Suburban' 
        : 'Rural'
    : null

  return (
    <div
      className="rounded-2xl border shadow-lg"
      style={{
        background: panelBg,
        borderColor: panelBorder
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
            Ballot Type Distribution (3D)
          </h3>
          <p className="mt-1 text-xs" style={{ color: textMuted }}>
            {selectedCounty 
              ? `${selectedCountyFips} - ${countyType} County` 
              : 'Click a county on the map to see ballot type breakdown'}
          </p>
        </div>
        <svg
          className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: textMuted }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          {selectedCounty && selectedCounty.currentTotalVotes > 0 ? (
            <>
              <div className="mb-3 rounded-lg p-3" style={{ background: 'rgba(74, 171, 206, 0.1)' }}>
                <p className="text-xs" style={{ color: textMuted }}>
                  📊 {countyType} counties show distinct patterns: 
                  {countyType === 'Rural' && ' Election Day voting dominates (55%)'}
                  {countyType === 'Suburban' && ' Balanced mix across all types'}
                  {countyType === 'Urban' && ' Early voting leads (45%), higher mail-in rates'}
                </p>
              </div>
              <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
            </>
          ) : selectedCounty && selectedCounty.currentTotalVotes === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                className="mb-4 h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: textMuted, opacity: 0.5 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: textMuted }}>
                {selectedCountyFips} - Waiting for votes to be reported...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                className="mb-4 h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: textMuted, opacity: 0.5 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm" style={{ color: textMuted }}>
                Select a county on the map to view its ballot type distribution
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
