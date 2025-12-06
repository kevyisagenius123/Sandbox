import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'

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

interface Metrics3DPanelProps {
  history: InsightSnapshot[]
  currentTimeSeconds: number
  totalDuration: number
  width?: string
  height?: string
}

export const Metrics3DPanel: React.FC<Metrics3DPanelProps> = ({
  history,
  currentTimeSeconds,
  width = '100%',
  height = '500px'
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [viewMode, setViewMode] = useState<'scatter' | 'bar' | 'surface'>('scatter')
  const [autoRotate, setAutoRotate] = useState(true)
  const animationFrameRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle keyboard events - ensure shortcuts reach window listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the target is a canvas element
      if (e.target instanceof HTMLCanvasElement) {
        // Blur the canvas so shortcuts can work
        (e.target as HTMLCanvasElement).blur()
      }
    }

    // Use capture phase to intercept before canvas
    container.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => container.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // Memoize processed data to prevent recalculation
  const scatterData = useMemo(() => {
    return history.map((snapshot, index) => {
      const progress = (snapshot.timestamp / Math.max(currentTimeSeconds, 1)) * 100
      const isRecent = index >= history.length - 10
      
      return {
        value: [
          progress,
          snapshot.reportingPercent,
          snapshot.marginPct
        ],
        itemStyle: {
          color: snapshot.marginVotes > 0 ? '#ef4444' : '#3b82f6',
          opacity: isRecent ? 0.9 : 0.6
        },
        symbolSize: Math.max(5, Math.abs(snapshot.marginVotes) / 100000),
        dataIndex: index
      }
    })
  }, [history.length, currentTimeSeconds])

  const barData = useMemo(() => {
    if (history.length === 0) return []
    
    // Get the latest snapshot for final vote totals
    const latest = history[history.length - 1]

    const barData: any[] = [
      {
        value: [0, 0, latest.demVotes],
        itemStyle: { color: '#3b82f6' } // Democrat - Blue
      },
      {
        value: [1, 0, latest.gopVotes],
        itemStyle: { color: '#ef4444' } // Republican - Red
      },
      {
        value: [2, 0, latest.otherVotes],
        itemStyle: { color: '#6b7280' } // Other - Gray
      }
    ]

    return barData
  }, [history.length])

  const surfaceData = useMemo(() => {
    if (history.length === 0) return []

    const surfaceData: number[][] = []
    const timeSteps = 20
    const reportingSteps = 20
    
    for (let t = 0; t < timeSteps; t++) {
      for (let r = 0; r < reportingSteps; r++) {
        const timeProgress = t / (timeSteps - 1)
        const reportingProgress = r / (reportingSteps - 1)
        
        const targetTime = timeProgress * (history[history.length - 1]?.timestamp || 1)
        const targetReporting = reportingProgress * 100
        
        let closestSnapshot = history[0]
        let minDistance = Infinity
        
        history.forEach(snapshot => {
          const timeDist = Math.abs(snapshot.timestamp - targetTime)
          const reportDist = Math.abs(snapshot.reportingPercent - targetReporting)
          const distance = timeDist + reportDist * 10
          
          if (distance < minDistance) {
            minDistance = distance
            closestSnapshot = snapshot
          }
        })
        
        surfaceData.push([t, r, closestSnapshot?.marginPct || 0])
      }
    }

    return surfaceData
  }, [history.length])

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
      
      chartInstance.current = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' })
      
      // Prevent canvas from capturing keyboard events
      const setupCanvas = () => {
        const canvas = chartRef.current?.querySelector('canvas')
        if (canvas) {
          canvas.style.outline = 'none'
          canvas.setAttribute('tabindex', '-1')
          // Prevent canvas from getting focus on click
          canvas.addEventListener('mousedown', (e) => {
            e.preventDefault()
            canvas.blur()
          }, { passive: false })
          
          canvas.addEventListener('focus', (e) => {
            e.preventDefault()
            canvas.blur()
          })
        }
      }
      
      // Setup immediately
      setupCanvas()
      
      // Also setup after a delay in case canvas is created async
      setTimeout(setupCanvas, 100)
      
      // Trigger initial option setting
      if (history.length > 0) {
        const option = get3DOption(viewMode, scatterData, barData, surfaceData, autoRotate)
        chartInstance.current.setOption(option)
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
    }, 150)
    
    return () => clearTimeout(resizeTimer)
  }, [width, height])

  useEffect(() => {
    if (!chartInstance.current || history.length === 0) return

    // Debounce updates to prevent excessive rerenders
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!chartInstance.current) return

      const option = get3DOption(viewMode, scatterData, barData, surfaceData, autoRotate)
      chartInstance.current.setOption(option, { 
        notMerge: true, // Replace the entire option to prevent issues
        lazyUpdate: false,
        silent: false
      })
    })
  }, [viewMode, scatterData, barData, surfaceData, autoRotate])

  const get3DOption = useCallback((
    mode: 'scatter' | 'bar' | 'surface',
    scatterData: any[],
    barData: any[],
    surfaceData: number[][],
    rotate: boolean
  ) => {
    const baseOption = {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 800,
      grid3D: {
        viewControl: {
          alpha: 25,
          beta: 40,
          distance: 180,
          autoRotate: rotate,
          autoRotateSpeed: 5,
          rotateSensitivity: 1,
          zoomSensitivity: 1,
          panSensitivity: 1
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
      }
    }

    switch (mode) {
      case 'scatter':
        return getScatter3DOption(scatterData, history, baseOption)
      case 'bar':
        return getBar3DOption(barData, baseOption)
      case 'surface':
        return getSurface3DOption(surfaceData, baseOption)
      default:
        return baseOption
    }
  }, [history])

  const getScatter3DOption = useCallback((scatterData: any[], history: InsightSnapshot[], baseOption: any) => {

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
          const idx = params.data.dataIndex
          const snapshot = history[idx]
          if (!snapshot) return ''
          
          const marginColor = snapshot.marginVotes > 0 ? '#ef4444' : '#3b82f6'
          const leader = snapshot.marginVotes > 0 ? 'GOP' : 'DEM'
          
          return `
            <div style="font-weight:600;color:${marginColor};margin-bottom:8px;font-size:13px;">
              ${leader} +${Math.abs(snapshot.marginPct).toFixed(1)}%
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Time:</span> 
              <span style="font-weight:500;">${(snapshot.timestamp / 60).toFixed(1)} min</span>
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Reporting:</span> 
              <span style="font-weight:500;">${snapshot.reportingPercent.toFixed(1)}%</span>
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Total Votes:</span> 
              <span style="font-weight:500;">${snapshot.totalVotes.toLocaleString()}</span>
            </div>
            <div>
              <span style="color:#94a3b8;">Remaining:</span> 
              <span style="font-weight:500;">${snapshot.votesRemaining.toLocaleString()}</span>
            </div>
          `
        }
      },
      xAxis3D: {
        name: 'Time Progress (%)',
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontSize: 10
        },
        nameTextStyle: {
          color: '#aaa',
          fontSize: 12
        }
      },
      yAxis3D: {
        name: 'Reporting (%)',
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontSize: 10
        },
        nameTextStyle: {
          color: '#aaa',
          fontSize: 12
        }
      },
      zAxis3D: {
        name: 'Margin (%)',
        type: 'value',
        axisLabel: {
          formatter: (val: number) => `${val > 0 ? 'R' : 'D'}${Math.abs(val).toFixed(0)}`,
          fontSize: 10
        },
        nameTextStyle: {
          color: '#aaa',
          fontSize: 12
        }
      },
      series: [{
        type: 'scatter3D',
        data: scatterData,
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

  const getBar3DOption = useCallback((barData: any[], baseOption: any) => {

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
          
          return `
            <div style="font-weight:600;color:${colors[party]};margin-bottom:8px;font-size:13px;">
              ${partyNames[party]}
            </div>
            <div>
              <span style="color:#94a3b8;">Votes:</span> 
              <span style="font-weight:500;">${votes.toLocaleString()}</span>
            </div>
          `
        }
      },
      grid3D: {
        viewControl: {
          alpha: 25,
          beta: 40,
          distance: 150,
          autoRotate: false,
          rotateSensitivity: 1,
          zoomSensitivity: 1,
          panSensitivity: 1
        },
        boxWidth: 100,
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
        data: barData,
        shading: 'lambert',
        emphasis: {
          itemStyle: {
            color: '#fbbf24'
          }
        }
      }]
    }
  }, [])

  const getSurface3DOption = useCallback((surfaceData: number[][], baseOption: any) => {
    const timeSteps = 20
    const reportingSteps = 20

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
          const [x, y, z] = params.value
          const marginColor = z > 0 ? '#ef4444' : '#3b82f6'
          const leader = z > 0 ? 'GOP' : 'DEM'
          
          return `
            <div style="font-weight:600;color:${marginColor};margin-bottom:8px;font-size:13px;">
              ${leader} +${Math.abs(z).toFixed(1)}%
            </div>
            <div style="margin-bottom:4px;">
              <span style="color:#94a3b8;">Time Progress:</span> 
              <span style="font-weight:500;">${((x / timeSteps) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span style="color:#94a3b8;">Reporting:</span> 
              <span style="font-weight:500;">${((y / reportingSteps) * 100).toFixed(0)}%</span>
            </div>
          `
        }
      },
      xAxis3D: {
        name: 'Time Progress',
        type: 'value',
        min: 0,
        max: timeSteps - 1,
        axisLabel: { fontSize: 10 },
        nameTextStyle: { color: '#aaa', fontSize: 12 }
      },
      yAxis3D: {
        name: 'Reporting %',
        type: 'value',
        min: 0,
        max: reportingSteps - 1,
        axisLabel: { fontSize: 10 },
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
      visualMap: {
        show: false,
        dimension: 2,
        min: -10,
        max: 10,
        inRange: {
          color: [
            '#1e3a8a', '#3b82f6', '#93c5fd', '#ffffff', 
            '#fecaca', '#ef4444', '#991b1b'
          ]
        }
      },
      series: [{
        type: 'surface',
        data: surfaceData,
        shading: 'realistic',
        realisticMaterial: {
          roughness: 0.4,
          metalness: 0.6
        },
        itemStyle: {
          opacity: 0.9
        }
      }]
    }
  }, [])

  if (history.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-900/50 rounded-lg backdrop-blur-sm border border-gray-800"
        style={{ width, height }}
      >
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">3D Metrics Visualization</div>
          <div className="text-sm">Run a simulation to see 3D vote metrics</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col bg-gray-900/50 rounded-lg backdrop-blur-sm border border-gray-800" 
      style={{ width, height, minHeight: height }}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-800 bg-gray-900/80 flex-shrink-0">
        <div className="text-sm font-medium text-gray-300 mr-2">View:</div>
        <button
          onClick={() => setViewMode('scatter')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            viewMode === 'scatter'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          3D Scatter
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
          onClick={() => setViewMode('surface')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            viewMode === 'surface'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          Surface
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
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 p-4 min-h-0" style={{ minHeight: '400px' }}>
        <div 
          ref={chartRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            minHeight: '350px',
            minWidth: '300px',
            position: 'relative',
            pointerEvents: 'auto' // Allow mouse events for chart interaction
          }} 
        />
      </div>
    </div>
  )
}
