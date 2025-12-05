import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { debugWarn } from '../../utils/debugLogger'

// Dynamic import of echarts-gl guarded by WebGL2 capability.
// Vite/ESM does not provide CommonJS require; use import() for code-splitting.
let echartsGlLoaded = false
const detectWebGL2 = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}
const canUseWebGL2 = detectWebGL2()

if (canUseWebGL2) {
  // Trigger async load; chart effect will check flag after load.
  import('echarts-gl')
    .then(() => {
      echartsGlLoaded = true
      // Optionally fire a custom event so listeners can re-render when 3D becomes available.
      window.dispatchEvent(new Event('echarts-gl-loaded'))
    })
    .catch(e => {
      console.error('[Demographics3DPanel] Failed dynamic import of echarts-gl:', e)
    })
}
import { useSandboxThemeOrDefault } from '../../design/SandboxThemeProvider'
import type { DemographicSynthesisResponse } from '../../services/demographicService'
import type { CountySimulationState } from '../../types/sandbox'

type PanelDemographicGroup = {
  label: string
  key: string
  demVotes: number
  gopVotes: number
  totalVotes: number
  demPct: number
  gopPct: number
  populationPct: number
}

// Accept either snake_case (backend JSON via @JsonProperty) or camelCase (fallback)
const normalizeGroup = (group: any) => {
  if (!group) {
    debugWarn('[Demographics3DPanel] normalizeGroup received null/undefined group')
    return {
      demVotes: 0,
      gopVotes: 0,
      totalVotes: 0,
      demPct: 0,
      gopPct: 0,
      populationPct: 0
    }
  }
  const result = {
    demVotes: Number(group?.dem_votes ?? group?.demVotes ?? 0),
    gopVotes: Number(group?.gop_votes ?? group?.gopVotes ?? 0),
    totalVotes: Number(group?.total_votes ?? group?.totalVotes ?? 0),
    demPct: Number(group?.dem_pct ?? group?.demPct ?? 0),
    gopPct: Number(group?.gop_pct ?? group?.gopPct ?? 0),
    populationPct: Number(group?.population_pct ?? group?.populationPct ?? 0)
  }
  // Debug-only: normalizeGroup transformation (kept commented to avoid console spam in normal use)
  // console.debug('[Demographics3DPanel] normalizeGroup:', group, '→', result)
  return result
}

const toPanelGroup = (label: string, key: string, group: any): PanelDemographicGroup => {
  const g = normalizeGroup(group)
  return {
    label,
    key,
    demVotes: g.demVotes,
    gopVotes: g.gopVotes,
    totalVotes: g.totalVotes,
    demPct: g.demPct,
    gopPct: g.gopPct,
    populationPct: g.populationPct
  }
}

const formatVotes = (votes: number): string => {
  if (Number.isNaN(votes)) {
    return '0'
  }
  if (Math.abs(votes) >= 1_000_000) {
    return `${(votes / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(votes) >= 1_000) {
    return `${(votes / 1_000).toFixed(0)}K`
  }
  return Math.round(votes).toLocaleString()
}

const formatPercent = (value?: number, digits = 1): string => {
  if (!Number.isFinite(value ?? NaN)) {
    return '—'
  }
  return `${Number(value).toFixed(digits)}%`
}

const describeMargin = (demPct: number, gopPct: number): { label: string; value: string } => {
  if (!Number.isFinite(demPct) || !Number.isFinite(gopPct)) {
    return { label: 'Margin', value: '—' }
  }
  const diff = demPct - gopPct
  if (diff === 0) {
    return { label: 'Even', value: `${demPct.toFixed(1)}% / ${gopPct.toFixed(1)}%` }
  }
  const leaning = diff > 0 ? 'DEM + ' : 'GOP + '
  return {
    label: `${leaning}${Math.abs(diff).toFixed(1)} pts`,
    value: `${demPct.toFixed(1)}% / ${gopPct.toFixed(1)}%`
  }
}

// Responsive height hook
const useResponsiveHeight = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile ? 300 : 400
}

type Demographics3DPanelProps = {
  selectedCountyGeoid?: string
  demographics?: DemographicSynthesisResponse | null
  countyState?: CountySimulationState // current per-frame county state (partial reporting)
  isLoading?: boolean
}

export const Demographics3DPanel: React.FC<Demographics3DPanelProps> = ({
  selectedCountyGeoid,
  demographics,
  countyState,
  isLoading = false
}) => {
  const theme = useSandboxThemeOrDefault()
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const lastChartDiagnosticRef = useRef<string>('')
  const lastPanelDiagnosticRef = useRef<string>('')
  const [activeTab, setActiveTab] = useState<'race' | 'education' | 'age'>('race')
  // Default expanded so the chart renders without an extra click
  const [isExpanded, setIsExpanded] = useState(true)
  const chartHeight = useResponsiveHeight()

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border border-white/5 bg-white/5 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-6 w-full animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
    </div>
  )

  const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
      <div className="h-10 w-10 rounded-full bg-white/10" />
      <p className="text-sm" style={{ color: textMuted }}>
        {message}
      </p>
      <p className="text-xs" style={{ color: textMuted }}>
        Keep the simulation running; demographics synthesize after reporting and vote totals meet thresholds.
      </p>
    </div>
  )

  const textPrimary = theme.palette.text.primary
  const textMuted = theme.palette.text.muted
  const panelBg = theme.surfaces.dockPanel.background
  const panelBorder = theme.surfaces.dockPanel.borderColor

  const breakdowns = useMemo(() => {
    if (!demographics) {
      // No demographics yet for the selected county; render friendly empty state without logging.
      return null
    }

    // The backend (JavaDemographicSynthesisService) already calculates demographics based on
    // the ACTUAL vote totals at the time of enrichment. We should NOT apply additional scaling
    // here because that would cause double-scaling and show decreasing votes as reporting increases.
    // The reportingPct is kept for reference but scaling is disabled.
    const reportingPct = countyState?.currentReportingPercent ?? 100

    const scaleGroup = (label: string, key: string, g: any): PanelDemographicGroup => {
      // No scaling needed - backend already calculated correct vote totals
      return toPanelGroup(label, key, g)
    }

    // Support both legacy snake_case object shape and new Java list shape
    const anyDemo: any = demographics as any

    let race: PanelDemographicGroup[] = []
    let education: PanelDemographicGroup[] = []
    let age: PanelDemographicGroup[] = []

  if (anyDemo?.race_breakdown && anyDemo?.education_breakdown && anyDemo?.age_breakdown) {
      // Legacy shape
      race = [
        scaleGroup('White (Non-Hispanic)', 'white_nh', anyDemo.race_breakdown.white_nh),
        scaleGroup('Black (Non-Hispanic)', 'black_nh', anyDemo.race_breakdown.black_nh),
        scaleGroup('Asian (Non-Hispanic)', 'asian_nh', anyDemo.race_breakdown.asian_nh),
        scaleGroup('Hispanic', 'hispanic', anyDemo.race_breakdown.hispanic)
      ]
      education = [
        scaleGroup('High School or Less', 'hs_or_less', anyDemo.education_breakdown.hs_or_less),
        scaleGroup('Some College', 'some_college', anyDemo.education_breakdown.some_college),
        scaleGroup("Bachelor's Degree +", 'bachelors_plus', anyDemo.education_breakdown.bachelors_plus)
      ]
      age = [
        scaleGroup('Under 30', 'under_30', anyDemo.age_breakdown.under_30),
        scaleGroup('30-44', '30_44', anyDemo.age_breakdown['30_44']),
        scaleGroup('45-64', '45_64', anyDemo.age_breakdown['45_64']),
        scaleGroup('65+', '65_plus', anyDemo.age_breakdown['65_plus'])
      ]
    } else if (Array.isArray(anyDemo?.race_breakdown_list)) {
      // Java snake_case list shape (from @JsonProperty annotations)
      const byLabel = (list: any[]) => {
        const map = new Map<string, any>()
        list.forEach(g => {
          const label: string = String(g?.group ?? g?.label ?? '')
          map.set(label.toLowerCase(), g)
        })
        return map
      }
      const raceMap = byLabel(anyDemo.race_breakdown_list)
      race = [
        scaleGroup('White (Non-Hispanic)', 'white_nh', raceMap.get('white')),
        scaleGroup('Black (Non-Hispanic)', 'black_nh', raceMap.get('black')),
        scaleGroup('Hispanic', 'hispanic', raceMap.get('hispanic')),
        scaleGroup('Asian (Non-Hispanic)', 'asian_nh', raceMap.get('asian')),
        scaleGroup('Other', 'other', raceMap.get('other'))
      ].filter(g => g.totalVotes > 0) // Filter out groups with no data
  const eduMap = byLabel(anyDemo.education_breakdown_list || [])
      education = [
        scaleGroup('High School or Less', 'hs_or_less', eduMap.get('high school or less')),
        scaleGroup('Some College', 'some_college', eduMap.get('some college')),
        scaleGroup("Bachelor's Degree or Higher", 'bachelors_plus', eduMap.get("bachelor's degree or higher"))
      ].filter(g => g.totalVotes > 0)
  const ageMap = byLabel(anyDemo.age_breakdown_list || [])
      age = [
        scaleGroup('18-29', 'under_30', ageMap.get('18-29')),
        scaleGroup('30-44', '30_44', ageMap.get('30-44')),
        scaleGroup('45-64', '45_64', ageMap.get('45-64')),
        scaleGroup('65+', '65_plus', ageMap.get('65+'))
      ].filter(g => g.totalVotes > 0)
    } else {
      debugWarn('[Demographics3DPanel] Unknown demographics shape', demographics)
    }

  // Debug-only: final breakdown counts (kept commented to avoid console noise in normal usage)
  // console.debug('[Demographics3DPanel] Final breakdowns:', { race: race.length, education: education.length, age: age.length })

    return { race, education, age, reportingPct }
  }, [demographics, countyState?.currentReportingPercent])

  const activeBreakdown = useMemo(() => {
    if (!breakdowns) {
      return [] as PanelDemographicGroup[]
    }
    switch (activeTab) {
      case 'race':
        return breakdowns.race
      case 'education':
        return breakdowns.education
      case 'age':
      default:
        return breakdowns.age
    }
  }, [breakdowns, activeTab])

  // Validation score color
  const getValidationColor = (score: number) => {
    if (score >= 90) return '#10b981' // green
    if (score >= 70) return '#f59e0b' // yellow
    return '#ef4444' // red
  }

  useEffect(() => {
    if (!selectedCountyGeoid) {
      lastPanelDiagnosticRef.current = ''
      return
    }

    let reason: string
    if (isLoading) {
      reason = 'loading'
    } else if (!demographics) {
      reason = 'missing-demographics'
    } else if (!breakdowns) {
      reason = 'missing-breakdowns'
    } else if (activeBreakdown.length === 0) {
      reason = 'empty-active-breakdown'
    } else {
      reason = 'render-ready'
    }

    const signature = `${selectedCountyGeoid}:${reason}:${activeBreakdown.length}:${activeTab}`
    if (lastPanelDiagnosticRef.current === signature) {
      return
    }
    lastPanelDiagnosticRef.current = signature

    console.info('[DemographicsPanel] Rendering state', {
      selectedCountyGeoid,
      reason,
      isLoading,
      activeTab,
      activeGroups: activeBreakdown.length,
      reportingPercent: breakdowns?.reportingPct ?? countyState?.currentReportingPercent ?? null,
      availableBreakdowns: breakdowns
        ? {
            race: breakdowns.race.length,
            education: breakdowns.education.length,
            age: breakdowns.age.length
          }
        : null,
      demographicsKeys: demographics ? Object.keys(demographics as Record<string, unknown>) : []
    })
  }, [
    selectedCountyGeoid,
    demographics,
    breakdowns,
    activeBreakdown.length,
    isLoading,
    countyState?.currentReportingPercent,
    activeTab
  ])

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width || container.offsetWidth || container.clientWidth || 0
    const height = rect.height || container.offsetHeight || container.clientHeight || 0
    const chartDiagSignature = `${width}x${height}:${Boolean(breakdowns)}:${activeBreakdown.length}:${isLoading}:${echartsGlLoaded}`
    if (lastChartDiagnosticRef.current !== chartDiagSignature) {
      lastChartDiagnosticRef.current = chartDiagSignature
      console.info('[DemographicsPanel] Chart container state', {
        width,
        height,
        hasBreakdowns: Boolean(breakdowns),
        activeGroups: activeBreakdown.length,
        isLoading,
        echartsGlLoaded
      })
      if (width === 0 || height === 0) {
        console.warn('[DemographicsPanel] Chart container has zero width/height', {
          width,
          height,
          isExpanded,
          chartHeight,
          selectedCountyGeoid
        })
      }
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(container)
    }

    const chart = chartInstance.current

    if (!breakdowns) {
      const message = isLoading ? 'Synthesizing demographics...' : 'Awaiting synthesized demographics'
      chart.clear()
      chart.setOption({
        title: {
          text: message,
          left: 'center',
          top: 'middle',
          textStyle: { color: textMuted, fontSize: 14 }
        }
      })
      return
    }

    if (activeBreakdown.length === 0) {
      const message = isLoading ? 'Synthesizing demographics...' : 'No demographic data available yet'
      chart.clear()
      chart.setOption({
        title: {
          text: message,
          left: 'center',
          top: 'middle',
          textStyle: { color: textMuted, fontSize: 14 }
        }
      })
      return
    }

    const groupNames = activeBreakdown.map(group => group.label)
    const demData = activeBreakdown.map((group, index) => [index, 0, group.demVotes])
    const gopData = activeBreakdown.map((group, index) => [index, 1, group.gopVotes])

    // If 3D not available, show a simple 2D bar chart placeholder
    if (!echartsGlLoaded) {
      chart.clear()
      chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: '3D view requires WebGL2 — showing 2D preview',
          left: 'center',
          textStyle: { color: textMuted, fontSize: 12 }
        },
        tooltip: { trigger: 'axis' },
        legend: { data: ['Democratic', 'Republican'], textStyle: { color: textMuted } },
        xAxis: { type: 'category', data: groupNames, axisLabel: { color: textMuted, rotate: 30 } },
        yAxis: { type: 'value', axisLabel: { color: textMuted }, axisLine: { show: false } },
        series: [
          { type: 'bar', name: 'Democratic', data: activeBreakdown.map(g => g.demVotes), itemStyle: { color: '#3b82f6' } },
          { type: 'bar', name: 'Republican', data: activeBreakdown.map(g => g.gopVotes), itemStyle: { color: '#ef4444' } }
        ]
      })
      return
    }

    const reportingPct = breakdowns?.reportingPct ?? 100
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: 'rgba(59,130,246,0.35)',
        borderWidth: 1,
        padding: 12,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        extraCssText: 'border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.45);',
        formatter: (params: any) => {
          const group = activeBreakdown[params.value[0]] as PanelDemographicGroup
          const party = params.value[1] === 0 ? 'Democratic' : 'Republican'
          const votes = Number(params.value[2])
          const pct = params.value[1] === 0 ? group.demPct : group.gopPct
          const totalVotes = group.demVotes + group.gopVotes
          const margin = describeMargin(group.demPct, group.gopPct)
          return `
            <div style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
              <div style="font-size:13px;font-weight:600;color:#fff;">${group.label}</div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span>${party}</span>
                <span>${formatVotes(votes)} (${formatPercent(pct)})</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span>Total votes (grp)</span>
                <span>${formatVotes(totalVotes)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span>${margin.label}</span>
                <span>${margin.value}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span>Population share</span>
                <span>${formatPercent(group.populationPct)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;">
                <span>County reporting</span>
                <span>${formatPercent(reportingPct)}</span>
              </div>
            </div>
          `
        }
      },
      xAxis3D: {
        type: 'category',
        data: groupNames,
        name: 'Demographic Group',
        nameTextStyle: { color: textMuted, fontSize: 11 },
        axisLabel: {
          color: textMuted,
          fontSize: 10,
          rotate: 30,
          interval: 0
        }
      },
      yAxis3D: {
        type: 'category',
        data: ['DEM', 'GOP'],
        name: 'Party',
        nameTextStyle: { color: textMuted, fontSize: 11 },
        axisLabel: { color: textMuted, fontSize: 10 }
      },
      zAxis3D: {
        type: 'value',
        name: 'Votes',
        nameTextStyle: { color: textMuted, fontSize: 11 },
        axisLabel: {
          color: textMuted,
          fontSize: 10,
          formatter: (val: number) => formatVotes(val)
        }
      },
      grid3D: {
        boxWidth: 100,
        boxHeight: chartHeight * 0.15,
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
          type: 'bar3D' as const,
          name: 'Democratic',
          data: demData,
          shading: 'realistic',
          itemStyle: {
            color: '#3b82f6',
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#2563eb'
            }
          },
          label: {
            show: false
          }
        },
        {
          type: 'bar3D' as const,
          name: 'Republican',
          data: gopData,
          shading: 'realistic',
          itemStyle: {
            color: '#ef4444',
            opacity: 0.9
          },
          emphasis: {
            itemStyle: {
              color: '#dc2626'
            }
          },
          label: {
            show: false
          }
        }
      ] as any
    }

    chart.setOption(option)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    // If echarts-gl loads after this effect (slow network), listen once and re-render.
    const handleGlLoaded = () => {
      if (!chartRef.current || !echartsGlLoaded) {
        return
      }
      chartInstance.current?.dispose()
      chartInstance.current = echarts.init(chartRef.current)
      chartInstance.current.setOption(option)
    }
    window.addEventListener('echarts-gl-loaded', handleGlLoaded)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('echarts-gl-loaded', handleGlLoaded)
    }
  }, [
    breakdowns,
    activeBreakdown,
    textMuted,
    isLoading,
    chartHeight,
    echartsGlLoaded,
    selectedCountyGeoid,
    activeTab
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  if (!selectedCountyGeoid) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{ background: panelBg, borderColor: panelBorder }}
      >
        <div className="mb-4 flex items-center justify-center">
          <svg className="h-16 w-16 opacity-40" fill="currentColor" viewBox="0 0 24 24" style={{ color: textMuted }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold" style={{ color: textPrimary }}>
          Explore Demographic Voting Patterns
        </h3>
        <p className="text-sm" style={{ color: textMuted }}>
          Click on any county in the map to see detailed race, education, and age voting breakdowns synthesized from similar baseline counties.
        </p>
      </div>
    )
  }

  return (
    <div
      className="relative rounded-2xl border shadow-lg"
      style={{ background: panelBg, borderColor: panelBorder }}
    >
      {/* Collapsible Header */}
      <div 
        className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-opacity-80"
        onClick={() => setIsExpanded(prev => !prev)}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(prev => !prev)
          }
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold" style={{ color: textPrimary }}>
              Demographic Voting Patterns
            </h3>
            {demographics && (
              (() => {
                const validationValue = (demographics as any).validation_score ?? (demographics as any).validationScore ?? 0
                return (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: getValidationColor(validationValue),
                      color: '#fff'
                    }}
                    title={`Confidence based on similarity to ${((demographics as any).similar_counties || (demographics as any).similarCounties || []).length}`}
                  >
                    {validationValue.toFixed(1)}%
                  </span>
                )
              })()
            )}
          </div>
          {demographics ? (
            (() => {
              const baseline: any = (demographics as any).baseline || {}
              const countyName = baseline.county_name || baseline.countyName || 'County'
              const stateName = baseline.state_name || baseline.stateName || 'State'
              const population = baseline.population ? Number(baseline.population).toLocaleString() : 'N/A'
              return (
                <p className="text-xs" style={{ color: textMuted }}>
                  {countyName}, {stateName} • Population: {population} {' '}
                  {countyState && countyState.currentReportingPercent < 100 && (
                    <span>
                      • Reporting: {countyState.currentReportingPercent.toFixed(1)}%
                    </span>
                  )}
                </p>
              )
            })()
          ) : (
            <p className="text-xs" style={{ color: textMuted }}>
              {isLoading ? 'Synthesizing demographics...' : 'Awaiting synthesized demographics'}{' '}
              {selectedCountyGeoid ? `for ${selectedCountyGeoid}` : ''}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <svg 
            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{ color: textMuted }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t p-4" style={{ borderColor: panelBorder }}>
          {/* Loading or Empty states */}
          {isLoading && !demographics ? (
            renderLoadingSkeleton()
          ) : !isLoading && (!demographics || activeBreakdown.length === 0) ? (
            renderEmptyState('Awaiting synthesized demographics for this county.')
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="mb-4 flex gap-2">
                {(['race', 'education', 'age'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveTab(tab)
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition"
                    style={{
                      background: activeTab === tab ? theme.palette.accent.secondary : 'rgba(255,255,255,0.04)',
                      color: activeTab === tab ? '#fff' : textMuted,
                      border: `1px solid ${activeTab === tab ? theme.palette.accent.secondary : panelBorder}`
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* 3D Chart */}
              <div
                ref={chartRef}
                style={{ width: '100%', height: `${chartHeight}px` }}
                className={isLoading ? 'opacity-50' : ''}
              />

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-sm" style={{ color: textMuted }}>
                    Loading demographic data...
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
