import React, { useEffect, useRef, memo } from 'react'
import * as echarts from 'echarts'

interface VoteShareChartProps {
  series: { name: string; value: number }[]
}

const VoteShareChartComponent: React.FC<VoteShareChartProps> = ({ series }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return
    
    chartRef.current = echarts.init(containerRef.current, 'dark', { renderer: 'canvas' })
    
    const handleResize = () => {
      chartRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  // Update chart options when data changes
  useEffect(() => {
    if (!chartRef.current) return

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,23,42,0.94)',
        borderColor: '#1e293b',
        textStyle: { color: '#e2e8f0' },
        formatter: (params: any) => {
          const item = params?.data as { name: string; value: number } | undefined
          const percent = typeof params?.percent === 'number' ? params.percent : 0
          if (!item) return ''
          const safePercent = percent.toFixed(1)
          const safeValue = Number.isFinite(item.value) ? Math.round(Number(item.value)).toLocaleString('en-US') : '0'
          return `<strong>${item.name}</strong><br/>${safeValue} votes<br/>${safePercent}% share`
        }
      },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'center',
        textStyle: { color: '#cbd5f5', fontSize: 12 },
        itemHeight: 12,
        itemWidth: 12
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 12,
            color: '#e2e8f0'
          },
          labelLine: {
            length: 12,
            length2: 10,
            lineStyle: { color: '#94a3b8' }
          },
          itemStyle: {
            borderColor: '#0f172a',
            borderWidth: 2
          },
          data: series.map(item => ({
            ...item,
            itemStyle: {
              color: item.name === 'Republican' 
                ? '#dc2626' 
                : item.name === 'Democratic' 
                ? '#3b82f6' 
                : '#94a3b8'
            }
          }))
        }
      ]
    }

    chartRef.current.setOption(option)
  }, [series])

  return <div ref={containerRef} className="h-64 w-full" />
}

// Custom comparison to check if series data has actually changed
const areEqual = (prevProps: VoteShareChartProps, nextProps: VoteShareChartProps) => {
  if (prevProps.series.length !== nextProps.series.length) return false
  return prevProps.series.every((item, idx) => {
    const nextItem = nextProps.series[idx]
    return item.name === nextItem?.name && item.value === nextItem?.value
  })
}

export const VoteShareChart = memo(VoteShareChartComponent, areEqual)

export default VoteShareChart
