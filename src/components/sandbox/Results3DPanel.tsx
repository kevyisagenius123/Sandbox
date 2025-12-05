import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import type { CountySimulationState, CountyResult } from '../../types/sandbox'

interface Results3DPanelProps {
  countyStates: Map<string, CountySimulationState>
  countyResults?: CountyResult[]
  width?: string
  height?: string
}

export const Results3DPanel: React.FC<Results3DPanelProps> = ({
  countyStates,
  countyResults = [],
  width = '100%',
  height = '500px'
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [viewMode, setViewMode] = useState<'scatter' | 'bar' | 'pie3d'>('scatter')
  const [autoRotate, setAutoRotate] = useState(true)
  const animationFrameRef = useRef<number | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Memoize county data for 3D visualization
  const county3DData = useMemo(() => {
    const data: any[] = []
    
    countyStates.forEach((state, fips) => {
      const countyResult = countyResults.find(c => 
        c.fips === fips || c.fips.padStart(5, '0') === fips
      )
      
      if (!countyResult) return
      
      const totalVotes = state.currentTotalVotes
      if (totalVotes === 0) return
      
      const demPct = (state.currentDemVotes / totalVotes) * 100
      const gopPct = (state.currentGopVotes / totalVotes) * 100
      const margin = gopPct - demPct
      const reportingPct = state.currentReportingPercent
      
      // Create a readable name for the county
      const countyName = countyResult.county && countyResult.state
        ? `${countyResult.county}, ${countyResult.state}`
        : countyResult.county || fips
      
      data.push({
        fips,
        name: countyName, // Use county name instead of FIPS
        totalVotes,
        demVotes: state.currentDemVotes,
        gopVotes: state.currentGopVotes,
        otherVotes: state.currentOtherVotes,
        demPct,
        gopPct,
        margin,
        reportingPct,
        isFullyReported: state.isFullyReported || reportingPct >= 99.9,
        value: [
          Math.log10(Math.max(1, totalVotes)), // X: Log of total votes (population proxy)
          reportingPct, // Y: Reporting %
          margin // Z: Margin (R-D)
        ]
      })
    })
    
    return data
  }, [countyStates, countyResults])

  // Aggregate totals for bar/pie charts
  const aggregateTotals = useMemo(() => {
    let totalDem = 0
    let totalGop = 0
    let totalOther = 0
    
    countyStates.forEach(state => {
      totalDem += state.currentDemVotes
      totalGop += state.currentGopVotes
      totalOther += state.currentOtherVotes
    })
    
    return { totalDem, totalGop, totalOther }
  }, [countyStates])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInstance.current) return // Already initialized

    // Wait for container to have dimensions
    const initChart = () => {
      if (!chartRef.current) return
      const rect = chartRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // Container not ready, try again
        setTimeout(initChart, 100)
        return
      }

      try {
        chartInstance.current = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' })
        
        // Trigger initial option setting
        if (county3DData.length > 0) {
          const option = get3DOption(viewMode, county3DData, aggregateTotals, autoRotate)
          chartInstance.current.setOption(option)
        }
      } catch (error) {
        console.error('Failed to initialize 3D chart:', error)
      }
    }

    initChart()
    
    const handleResize = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        chartInstance.current?.resize()
      })
    }
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  // Resize chart when width/height props change (e.g., when toggling to 3D view)
  useEffect(() => {
    if (!chartInstance.current) return
    
    const resizeTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        chartInstance.current?.resize()
      })
    }, 100)
    
    return () => clearTimeout(resizeTimer)
  }, [width, height])

  useEffect(() => {
    if (!chartInstance.current || county3DData.length === 0) return

    // Throttle updates to max once every 100ms for data changes
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    const performUpdate = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        if (!chartInstance.current) return

        const option = get3DOption(viewMode, county3DData, aggregateTotals, autoRotate)
        // Only use notMerge when changing view modes, otherwise merge for performance
        chartInstance.current.setOption(option, {
          notMerge: false,
          lazyUpdate: true,
          silent: false
        })
        lastUpdateRef.current = Date.now()
      })
    }

    if (timeSinceLastUpdate < 100) {
      // Throttle: schedule update after remaining time
      updateTimeoutRef.current = setTimeout(performUpdate, 100 - timeSinceLastUpdate)
    } else {
      performUpdate()
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [county3DData, aggregateTotals, autoRotate])

  // Separate effect for view mode changes - these need immediate update with notMerge
  useEffect(() => {
    if (!chartInstance.current || county3DData.length === 0) return

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!chartInstance.current) return

      const option = get3DOption(viewMode, county3DData, aggregateTotals, autoRotate)
      chartInstance.current.setOption(option, {
        notMerge: true, // Force full update when changing view mode
        lazyUpdate: false,
        silent: false
      })
    })
  }, [viewMode])

  const get3DOption = useCallback((
    mode: 'scatter' | 'bar' | 'pie3d',
    data: any[],
    totals: { totalDem: number; totalGop: number; totalOther: number },
    rotate: boolean
  ) => {
    const baseOption = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 800
    }

    switch (mode) {
      case 'scatter':
        return getScatter3DOption(data, baseOption, rotate)
      case 'bar':
        return getBar3DOption(totals, baseOption, rotate)
      case 'pie3d':
        return getPie3DOption(totals, baseOption)
      default:
        return baseOption
    }
  }, [])

  const getScatter3DOption = useCallback((data: any[], baseOption: any, rotate: boolean) => {
    return {
      ...baseOption,
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 500
        },
        extraCssText: 'border-radius:12px;backdrop-filter:blur(6px);',
        formatter: (params: any) => {
          const county = params.data.countyData
          if (!county) return ''
          
          const marginColor = county.margin > 0 ? '#ef4444' : '#3b82f6'
          const marginLabel = county.margin > 0 ? 'R' : 'D'
          
          return `
            <div style="font-weight:600;color:${marginColor};margin-bottom:8px;font-size:13px;">
              ${county.name}
            </div>
            <div style="margin-bottom:6px;">
              <span style="color:#94a3b8;">Margin:</span> 
              <span style="font-weight:600;color:${marginColor};">${marginLabel} +${Math.abs(county.margin).toFixed(1)}%</span>
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Reporting:</span> 
              <span style="font-weight:500;">${county.reportingPct.toFixed(1)}%</span>
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Total Votes:</span> 
              <span style="font-weight:500;">${county.totalVotes.toLocaleString()}</span>
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">DEM:</span> 
              <span style="font-weight:500;color:#3b82f6;">${county.demPct.toFixed(1)}%</span> 
              <span style="color:#64748b;">(${county.demVotes.toLocaleString()})</span>
            </div>
            <div>
              <span style="color:#94a3b8;">GOP:</span> 
              <span style="font-weight:500;color:#ef4444;">${county.gopPct.toFixed(1)}%</span> 
              <span style="color:#64748b;">(${county.gopVotes.toLocaleString()})</span>
            </div>
          `
        }
      },
      grid3D: {
        viewControl: {
          alpha: 25,
          beta: 40,
          distance: 200,
          autoRotate: rotate,
          autoRotateSpeed: 5
        },
        boxWidth: 100,
        boxHeight: 60,
        boxDepth: 100,
        light: {
          main: {
            intensity: 1.2,
            shadow: true,
            shadowQuality: 'high' as any
          },
          ambient: {
            intensity: 0.4
          }
        },
        postEffect: {
          enable: true,
          bloom: {
            enable: true,
            intensity: 0.1
          },
          SSAO: {
            enable: true,
            radius: 2,
            intensity: 1
          }
        }
      },
      xAxis3D: {
        name: 'County Size (log votes)',
        type: 'value',
        min: 0,
        max: 7,
        axisLabel: {
          formatter: (val: number) => {
            const votes = Math.pow(10, val)
            return votes >= 1000000 ? `${(votes / 1000000).toFixed(0)}M` :
                   votes >= 1000 ? `${(votes / 1000).toFixed(0)}K` : 
                   votes.toFixed(0)
          },
          fontSize: 10
        },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      yAxis3D: {
        name: 'Reporting %',
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontSize: 10
        },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      zAxis3D: {
        name: 'Margin %',
        type: 'value',
        axisLabel: {
          formatter: (val: number) => `${val > 0 ? 'R' : 'D'}${Math.abs(val).toFixed(0)}`,
          fontSize: 10
        },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      series: [{
        type: 'scatter3D',
        data: data.map(county => ({
          value: county.value,
          countyData: county,
          itemStyle: {
            color: county.margin > 0 ? '#ef4444' : '#3b82f6',
            opacity: county.isFullyReported ? 0.9 : 0.6
          },
          symbolSize: Math.max(5, Math.log10(county.totalVotes + 1) * 2)
        })),
        emphasis: {
          itemStyle: {
            color: '#fbbf24',
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      }]
    }
  }, [])

  const getBar3DOption = useCallback((
    totals: { totalDem: number; totalGop: number; totalOther: number },
    baseOption: any,
    rotate: boolean
  ) => {
    const total = totals.totalDem + totals.totalGop + totals.totalOther
    const barData = [
      [0, 0, totals.totalDem],
      [1, 0, totals.totalGop],
      [2, 0, totals.totalOther]
    ]

    return {
      ...baseOption,
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 500
        },
        extraCssText: 'border-radius:12px;backdrop-filter:blur(6px);',
        formatter: (params: any) => {
          const [party, , votes] = params.value
          const partyNames = ['Democrat', 'Republican', 'Other']
          const colors = ['#3b82f6', '#ef4444', '#6b7280']
          const pct = total > 0 ? ((votes / total) * 100).toFixed(1) : '0.0'
          
          return `
            <div style="font-weight:600;color:${colors[party]};margin-bottom:8px;font-size:13px;">
              ${partyNames[party]}
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Votes:</span> 
              <span style="font-weight:500;">${votes.toLocaleString()}</span>
            </div>
            <div>
              <span style="color:#94a3b8;">Share:</span> 
              <span style="font-weight:600;color:${colors[party]};">${pct}%</span>
            </div>
          `
        }
      },
      grid3D: {
        viewControl: {
          alpha: 25,
          beta: 30,
          distance: 150,
          autoRotate: rotate,
          autoRotateSpeed: 5
        },
        boxWidth: 80,
        boxHeight: 80,
        boxDepth: 40,
        light: {
          main: { intensity: 1.2, shadow: true },
          ambient: { intensity: 0.4 }
        }
      },
      xAxis3D: {
        name: 'Party',
        type: 'category',
        data: ['DEM', 'GOP', 'Other'],
        axisLabel: { fontSize: 12 },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      yAxis3D: {
        name: '',
        type: 'value',
        show: false
      },
      zAxis3D: {
        name: 'Votes',
        type: 'value',
        axisLabel: {
          formatter: (val: number) => (val / 1000000).toFixed(1) + 'M',
          fontSize: 10
        },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      series: [{
        type: 'bar3D',
        data: barData.map(([party, y, votes]) => ({
          value: [party, y, votes],
          itemStyle: {
            color: party === 0 ? '#3b82f6' : party === 1 ? '#ef4444' : '#6b7280'
          }
        })),
        shading: 'lambert',
        emphasis: {
          itemStyle: {
            color: '#fbbf24'
          }
        },
        barSize: 15
      }]
    }
  }, [])

  const getPie3DOption = useCallback((
    totals: { totalDem: number; totalGop: number; totalOther: number },
    baseOption: any
  ) => {
    const total = totals.totalDem + totals.totalGop + totals.totalOther
    const pieData = [
      { 
        name: 'Democrat', 
        value: totals.totalDem,
        itemStyle: { color: '#3b82f6' }
      },
      { 
        name: 'Republican', 
        value: totals.totalGop,
        itemStyle: { color: '#ef4444' }
      },
      { 
        name: 'Other', 
        value: totals.totalOther,
        itemStyle: { color: '#6b7280' }
      }
    ]

    return {
      ...baseOption,
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 500
        },
        extraCssText: 'border-radius:12px;backdrop-filter:blur(6px);',
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0'
          return `
            <div style="font-weight:600;color:${params.color};margin-bottom:8px;font-size:13px;">
              ${params.name}
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Votes:</span> 
              <span style="font-weight:500;">${params.value.toLocaleString()}</span>
            </div>
            <div>
              <span style="color:#94a3b8;">Share:</span> 
              <span style="font-weight:600;color:${params.color};">${pct}%</span>
            </div>
          `
        }
      },
      series: [{
        type: 'pie',
        radius: ['20%', '60%'],
        center: ['50%', '50%'],
        data: pieData,
        label: {
          show: true,
          formatter: (params: any) => {
            const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0'
            return `{name|${params.name}}\n{value|${pct}%}`
          },
          rich: {
            name: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff',
              lineHeight: 20
            },
            value: {
              fontSize: 12,
              color: '#aaa',
              lineHeight: 18
            }
          }
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 20
        },
        itemStyle: {
          borderRadius: 8,
          borderColor: '#1a1a2e',
          borderWidth: 2
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: {
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        animationType: 'scale',
        animationEasing: 'elasticOut'
      }]
    }
  }, [])

  if (county3DData.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-900/50 rounded-lg backdrop-blur-sm border border-gray-800"
        style={{ width, height }}
      >
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">3D Results Visualization</div>
          <div className="text-sm">Run a simulation to see county results in 3D</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width, height }} className="flex flex-col bg-gray-900 rounded-lg border border-gray-800">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 mr-2">View:</span>
        <button
          onClick={() => setViewMode('scatter')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            viewMode === 'scatter'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          County Scatter
        </button>
        <button
          onClick={() => setViewMode('bar')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            viewMode === 'bar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          3D Bars
        </button>
        <button
          onClick={() => setViewMode('pie3d')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            viewMode === 'pie3d'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          Pie Chart
        </button>
        
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="rounded"
            />
            Auto-rotate
          </label>
          <div className="text-xs text-gray-500">
            {county3DData.length} counties
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 p-4">
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

export default Results3DPanel
