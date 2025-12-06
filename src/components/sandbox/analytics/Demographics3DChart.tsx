/**
 * Demographics 3D Chart (legacy analytics view)
 *
 * Updated to be compatible with the Java-based DemographicSynthesisResponse,
 * which exposes list-style breakdowns (race_breakdown_list, etc.).
 * Still supports the original object-style breakdown shape for backwards
 * compatibility so older recordings or fixtures render correctly.
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import type { DemographicSynthesisResponse } from '../../../services/demographicService'

interface Demographics3DChartProps {
  data: DemographicSynthesisResponse
  category: 'race' | 'education' | 'age'
  width?: string | number
  height?: string | number
}

// Normalize a single group from either snake_case or camelCase
const normalizeGroup = (group: any) => {
  if (!group) {
    return {
      demPct: 0,
      gopPct: 0
    }
  }
  return {
    demPct: Number(group.dem_pct ?? group.demPct ?? 0),
    gopPct: Number(group.gop_pct ?? group.gopPct ?? 0)
  }
}

// Build a label → group map from a list-style breakdown
const buildLabelMap = (list: any[] | undefined | null) => {
  const map = new Map<string, any>()
  if (!Array.isArray(list)) return map
  list.forEach(item => {
    const label = String(item?.group ?? item?.label ?? '')
    if (label) {
      map.set(label.toLowerCase(), item)
    }
  })
  return map
}

export default function Demographics3DChart({
  data,
  category,
  width = '100%',
  height = '500px'
}: Demographics3DChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current)
    }

    const chart = chartInstanceRef.current

    // Prepare data based on category
    let groups: string[] = []
    let demData: number[] = []
    let gopData: number[] = []

    const anyData: any = data as any

    if (category === 'race') {
      groups = ['White NH', 'Black NH', 'Asian NH', 'Hispanic']

      if (Array.isArray(anyData?.race_breakdown_list)) {
        // Java list-style breakdown
        const raceMap = buildLabelMap(anyData.race_breakdown_list)
        const white = normalizeGroup(raceMap.get('white'))
        const black = normalizeGroup(raceMap.get('black'))
        const asian = normalizeGroup(raceMap.get('asian'))
        const hispanic = normalizeGroup(raceMap.get('hispanic'))
        demData = [white.demPct, black.demPct, asian.demPct, hispanic.demPct]
        gopData = [white.gopPct, black.gopPct, asian.gopPct, hispanic.gopPct]
      } else if (anyData?.race_breakdown) {
        // Legacy object-style breakdown
        const breakdown = anyData.race_breakdown
        const white = normalizeGroup(breakdown.white_nh)
        const black = normalizeGroup(breakdown.black_nh)
        const asian = normalizeGroup(breakdown.asian_nh)
        const hispanic = normalizeGroup(breakdown.hispanic)
        demData = [white.demPct, black.demPct, asian.demPct, hispanic.demPct]
        gopData = [white.gopPct, black.gopPct, asian.gopPct, hispanic.gopPct]
      }
    } else if (category === 'education') {
      groups = ['HS or Less', 'Some College', "Bachelor's+"]

      if (Array.isArray(anyData?.education_breakdown_list)) {
        const eduMap = buildLabelMap(anyData.education_breakdown_list)
        const hs = normalizeGroup(eduMap.get('high school or less'))
        const someCollege = normalizeGroup(eduMap.get('some college'))
        const bachelors = normalizeGroup(eduMap.get("bachelor's degree or higher"))
        demData = [hs.demPct, someCollege.demPct, bachelors.demPct]
        gopData = [hs.gopPct, someCollege.gopPct, bachelors.gopPct]
      } else if (anyData?.education_breakdown) {
        const breakdown = anyData.education_breakdown
        const hs = normalizeGroup(breakdown.hs_or_less)
        const someCollege = normalizeGroup(breakdown.some_college)
        const bachelors = normalizeGroup(breakdown.bachelors_plus)
        demData = [hs.demPct, someCollege.demPct, bachelors.demPct]
        gopData = [hs.gopPct, someCollege.gopPct, bachelors.gopPct]
      }
    } else {
      groups = ['Under 30', '30-44', '45-64', '65+']

      if (Array.isArray(anyData?.age_breakdown_list)) {
        const ageMap = buildLabelMap(anyData.age_breakdown_list)
        const under30 = normalizeGroup(ageMap.get('18-29'))
        const age30_44 = normalizeGroup(ageMap.get('30-44'))
        const age45_64 = normalizeGroup(ageMap.get('45-64'))
        const age65plus = normalizeGroup(ageMap.get('65+'))
        demData = [under30.demPct, age30_44.demPct, age45_64.demPct, age65plus.demPct]
        gopData = [under30.gopPct, age30_44.gopPct, age45_64.gopPct, age65plus.gopPct]
      } else if (anyData?.age_breakdown) {
        const breakdown = anyData.age_breakdown
        const under30 = normalizeGroup(breakdown.under_30)
        const age30_44 = normalizeGroup(breakdown['30_44'])
        const age45_64 = normalizeGroup(breakdown['45_64'])
        const age65plus = normalizeGroup(breakdown['65_plus'])
        demData = [under30.demPct, age30_44.demPct, age45_64.demPct, age65plus.demPct]
        gopData = [under30.gopPct, age30_44.gopPct, age45_64.gopPct, age65plus.gopPct]
      }
    }

    // Guard: if we still have no data, show an empty state
    if (!groups.length || !demData.length || !gopData.length) {
      chart.clear()
      chart.setOption({
        title: {
          text: 'No demographic data available',
          left: 'center',
          top: 'middle',
          textStyle: { fontSize: 14, color: '#6b7280' }
        }
      })
      return
    }

    // Build 3D bar chart data
    const data3D: [number, number, number][] = []
    const parties = ['DEM', 'GOP']
    const allData = [demData, gopData]

    groups.forEach((_, groupIdx) => {
      parties.forEach((_, partyIdx) => {
        const value = allData[partyIdx][groupIdx]
        data3D.push([groupIdx, partyIdx, value])
      })
    })

    const option: echarts.EChartsOption = {
      tooltip: {
        formatter: (params: any) => {
          const [groupIdx, partyIdx, value] = params.value
          return `${groups[groupIdx]}<br/>${parties[partyIdx]}: ${Number(value).toFixed(1)}%`
        }
      },
      visualMap: {
        max: 100,
        min: 0,
        inRange: {
          color: [
            '#ffffff',
            '#f0f0f0',
            '#d9d9d9',
            '#bfbfbf',
            '#8c8c8c',
            '#595959',
            '#262626'
          ]
        },
        show: false
      },
      xAxis3D: {
        type: 'category',
        data: groups,
        name: 'Demographic Group',
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 11,
          interval: 0,
          rotate: category === 'race' ? 15 : 0
        }
      },
      yAxis3D: {
        type: 'category',
        data: ['DEM', 'GOP'],
        name: 'Party',
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 11,
          formatter: (value: string) => (value === 'DEM' ? 'DEM 🔵' : 'GOP 🔴')
        }
      },
      zAxis3D: {
        type: 'value',
        name: 'Vote %',
        max: 100,
        nameTextStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        },
        axisLabel: {
          formatter: '{value}%'
        }
      },
      grid3D: {
        boxWidth: 200,
        boxDepth: 80,
        viewControl: {
          projection: 'orthographic',
          autoRotate: true,
          autoRotateSpeed: 5,
          rotateSensitivity: 1,
          zoomSensitivity: 1,
          panSensitivity: 1,
          alpha: 30,
          beta: 40,
          distance: 250,
          minDistance: 150,
          maxDistance: 400
        },
        light: {
          main: {
            intensity: 1.2,
            shadow: true,
            alpha: 45,
            beta: 45
          },
          ambient: {
            intensity: 0.4
          }
        },
        environment: '#f0f0f0',
        postEffect: {
          enable: true,
          bloom: {
            enable: false
          },
          SSAO: {
            enable: true,
            radius: 2,
            intensity: 1
          }
        }
      },
      // @ts-ignore - echarts-gl bar3D not in base echarts types
      series: [
        {
          type: 'bar3D',
          data: data3D.map(([groupIdx, partyIdx, value]) => ({
            value: [groupIdx, partyIdx, value],
            itemStyle: {
              color: partyIdx === 0 ? '#1e40af' : '#dc2626',
              opacity: 0.9
            }
          })),
          shading: 'realistic',
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              formatter: (params: any) => `${Number(params.value[2]).toFixed(1)}%`,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff'
            },
            itemStyle: {
              color: 'inherit',
              opacity: 1
            }
          },
          barSize: 15
        }
      ]
    }

    chart.setOption(option)

    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [data, category])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose()
        chartInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={chartRef}
      style={{ width, height }}
      className="demographic-3d-chart"
    />
  )
}
