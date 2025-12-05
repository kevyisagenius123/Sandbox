import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { GeoJsonLayer } from '@deck.gl/layers'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import type { CountyGeoMetadata, CountyResult, CountySimulationState } from '../../types/sandbox'
import { GOP_BUCKETS, DEM_BUCKETS } from '../../utils/electionColor'
import { hexToRgba, clamp } from '../../lib/election/swing'
import { MapHoverTooltip, MapHoverInfo } from './MapHoverTooltip'
import { ALL_US_STATES, STATE_META_BY_FIPS } from '../../constants/usStates'
import type { DeckGLRef } from '@deck.gl/react'

type ViewState = { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number }

interface SandboxMap2DProps {
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  opacity?: number
  scope?: 'ALL' | 'CUSTOM'
  customStates?: string[]
  onScopeChange?: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange?: (states: string[]) => void
  onCountyClick?: (fips: string, meta?: CountyGeoMetadata) => void
  editedCounties?: Set<string>
}

const REGIONAL_PRESETS: Record<string, string[]> = {
  'Rust Belt': ['17', '18', '26', '27', '39', '42', '55'],
  'Blue Wall': ['26', '42', '55'],
  'Sun Belt': ['04', '12', '13', '32', '35', '37', '48'],
  'Swing States 2024': ['04', '13', '26', '32', '37', '42', '55'],
  'Northeast': ['09', '23', '25', '33', '34', '36', '44', '50'],
  'Southeast': ['01', '12', '13', '21', '28', '37', '45', '47', '51', '54'],
  'Midwest': ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'],
  'Mountain West': ['04', '08', '16', '30', '32', '35', '49', '56'],
  'Pacific': ['02', '06', '15', '41', '53'],
  'Deep South': ['01', '05', '22', '28', '45'],
  'Great Lakes': ['17', '18', '26', '27', '39', '55'],
  'Border States': ['10', '21', '24', '29', '40', '47', '48', '54']
}

const to2 = (value: any) => (value == null ? null : String(value).padStart(2, '0'))

const toCountyFips = (value: any) => String(value ?? '').padStart(5, '0')

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

const rustbeltMarginRgba = (marginPct: number, alpha: number = 235): [number, number, number, number] => {
  if (!Number.isFinite(marginPct)) return [100, 116, 139, alpha]
  const abs = Math.abs(marginPct)
  let idx = 5
  if (abs < 1) idx = 0
  else if (abs < 5) idx = 1
  else if (abs < 10) idx = 2
  else if (abs < 20) idx = 3
  else if (abs < 30) idx = 4
  const hex = marginPct >= 0 ? GOP_BUCKETS[idx] : DEM_BUCKETS[idx]
  return hexToRgba(hex, alpha)
}

const featureStateFips = (feature: any) =>
  to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')

const featureCountyFips = (feature: any) =>
  toCountyFips(
    feature?.properties?.GEO_ID?.slice(-5) ||
      feature?.properties?.FIPS ||
      feature?.properties?.COUNTYFP
  )

const resolveBaseUrl = () => ((import.meta as any).env?.BASE_URL || '/')

const normalizeCountyMap = (countyResults: CountyResult[]) => {
  const map = new Map<string, CountyResult>()
  countyResults.forEach((county) => {
    map.set(county.fips.padStart(5, '0'), county)
  })
  return map
}

const SandboxMap2D: React.FC<SandboxMap2DProps> = ({
  countyResults,
  countyStates,
  opacity = 0.92,
  scope: externalScope,
  customStates: externalCustomStates,
  onScopeChange,
  onCustomStatesChange,
  onCountyClick,
  editedCounties
}) => {
  // 2D view: flat perspective, no pitch
  const [viewState, setViewState] = useState<ViewState>({ 
    longitude: -96.5, 
    latitude: 39.8, 
    zoom: 3.7, 
    pitch: 0,  // Flat view
    bearing: 0 
  })
  const deckRef = useRef<DeckGLRef | null>(null)
  
  const allStatesRef = useRef<FeatureCollection | null>(null)
  const allCountiesRef = useRef<FeatureCollection | null>(null)
  const statesRef = useRef<FeatureCollection | null>(null)
  const countiesRef = useRef<FeatureCollection | null>(null)
  const [, setTickKey] = useState(0)
  const [geoVersion, setGeoVersion] = useState(0)
  const [status, setStatus] = useState('Loading…')
  const [hoverInfo, setHoverInfo] = useState<MapHoverInfo | null>(null)
  
  const [internalScope, setInternalScope] = useState<'ALL' | 'CUSTOM'>('ALL')
  const [internalCustomStates, setInternalCustomStates] = useState<string[]>(['17', '18', '26', '27', '39', '42', '55'])
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const hasFilteredRef = useRef(false)

  const latestCountyStatesRef = useRef(countyStates)
  const latestEditedCountiesRef = useRef<Set<string>>(editedCounties ?? new Set<string>())
  const frameRequestedRef = useRef(false)
  const frameHandleRef = useRef<number | null>(null)
  const [renderTick, setRenderTick] = useState(0)

  const countyFeatureOrderRef = useRef<string[]>([])
  const countyColorViewsRef = useRef<[number, number, number, number][]>([])

  const scope = externalScope ?? internalScope
  const customStates = externalCustomStates ?? internalCustomStates
  const finalAlpha = clamp(Math.round(255 * opacity), 30, 255)
  const selectedStatesKey = useMemo(() => selectedStates.join(','), [selectedStates])

  const countyByFips = useMemo(() => normalizeCountyMap(countyResults), [countyResults])

  const scheduleFrame = useCallback(() => {
    if (frameRequestedRef.current) return
    frameRequestedRef.current = true
    frameHandleRef.current = requestAnimationFrame(() => {
      frameRequestedRef.current = false
      frameHandleRef.current = null
      setRenderTick((tick) => tick + 1)
    })
  }, [])

  useEffect(() => {
    latestCountyStatesRef.current = countyStates
    scheduleFrame()
  }, [countyStates, scheduleFrame])

  useEffect(() => {
    latestEditedCountiesRef.current = editedCounties ?? new Set<string>()
    scheduleFrame()
  }, [editedCounties, scheduleFrame])

  useEffect(() => () => {
    if (frameHandleRef.current != null) {
      cancelAnimationFrame(frameHandleRef.current)
      frameHandleRef.current = null
    }
    frameRequestedRef.current = false
  }, [])

  const filteredCountyFeatures = useMemo(() => {
    if (!countiesRef.current || selectedStates.length === 0) return []
    const source = countiesRef.current.features || []
    return source.filter((feature: any) => {
      const st = featureStateFips(feature)
      return !!st && selectedStates.includes(st)
    })
  }, [selectedStatesKey, geoVersion])

  const countyFeatureCollection: FeatureCollection | null = useMemo(() => {
    if (filteredCountyFeatures.length === 0) return null
    return { type: 'FeatureCollection', features: filteredCountyFeatures as any[] }
  }, [filteredCountyFeatures])

  useEffect(() => {
    const order = filteredCountyFeatures.map((feature) => featureCountyFips(feature))
    countyFeatureOrderRef.current = order

    if (countyColorViewsRef.current.length !== order.length) {
      countyColorViewsRef.current = order.map(() => [100, 116, 139, finalAlpha] as [number, number, number, number])
    }
  }, [filteredCountyFeatures, finalAlpha])

  useEffect(() => {
    const order = countyFeatureOrderRef.current
    const colors = countyColorViewsRef.current
    if (order.length === 0 || colors.length !== order.length) return

    const latestStates = latestCountyStatesRef.current
    const edited = latestEditedCountiesRef.current
    const alpha = clamp(Math.round(255 * opacity), 30, 255)

    for (let index = 0; index < order.length; index += 1) {
      const fips = order[index]
      const target = colors[index]
      const sim = latestStates.get(fips)

      if (!sim || sim.currentTotalVotes <= 0) {
        if (edited.has(fips)) {
          target[0] = 255
          target[1] = 215
          target[2] = 0
          target[3] = alpha
        } else {
          target[0] = 100
          target[1] = 116
          target[2] = 139
          target[3] = alpha
        }
        continue
      }

      const margin = ((sim.currentGopVotes - sim.currentDemVotes) / Math.max(1, sim.currentTotalVotes)) * 100
      const baseColor = rustbeltMarginRgba(margin, alpha)

      if (edited.has(fips)) {
        target[0] = Math.min(255, baseColor[0] + 40)
        target[1] = Math.min(255, baseColor[1] + 40)
        target[2] = baseColor[2]
        target[3] = alpha
      } else {
        target[0] = baseColor[0]
        target[1] = baseColor[1]
        target[2] = baseColor[2]
        target[3] = baseColor[3]
      }
    }
  }, [renderTick, opacity, filteredCountyFeatures])

  const handleScopeChange = (newScope: 'ALL' | 'CUSTOM') => {
    if (onScopeChange) onScopeChange(newScope)
    else setInternalScope(newScope)
  }

  const handleCustomStatesChange = (newStates: string[]) => {
    if (onCustomStatesChange) onCustomStatesChange(newStates)
    else setInternalCustomStates(newStates)
  }

  // Load GeoJSON
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const baseUrl = resolveBaseUrl()
        const states = await fetch(`${baseUrl}gz_2010_us_040_00_500k.json`).then((res) => res.json())
        if (!alive) return
        allStatesRef.current = states
        statesRef.current = states

        const counties = await fetch(`${baseUrl}gz_2010_us_050_00_500k.json`).then((res) => res.json())
        if (!alive) return
        allCountiesRef.current = counties
        countiesRef.current = counties

        setStatus('Ready')
        setGeoVersion((v) => v + 1)
        setTickKey((k) => k + 1)
      } catch (err) {
        console.error('SandboxMap2D geo load failed', err)
        setStatus('Geo load failed')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Filter GeoJSON based on scope
  useEffect(() => {
    try {
      if (!allStatesRef.current || !allCountiesRef.current) return

      let allowedStates: Set<string> | null = null

      if (scope === 'CUSTOM') {
        allowedStates = new Set(customStates)
        const statesFeatures = (allStatesRef.current.features || []).filter((feature: any) => {
          const st = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
          return st ? allowedStates!.has(st) : false
        })
        const countyFeatures = (allCountiesRef.current.features || []).filter((feature: any) => {
          const st = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
          return st ? allowedStates!.has(st) : false
        })
        statesRef.current = { type: 'FeatureCollection', features: statesFeatures }
        countiesRef.current = { type: 'FeatureCollection', features: countyFeatures }
      } else {
        const statesWithData = new Set<string>()
        for (const feature of (allCountiesRef.current.features || []) as any[]) {
          const rawFips = feature?.properties?.GEO_ID?.slice(-5) || feature?.properties?.FIPS || feature?.properties?.COUNTYFP
          const countyFips = toCountyFips(rawFips)
          if (countyByFips.has(countyFips)) {
            const st = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
            if (st) statesWithData.add(st)
          }
        }

        if (statesWithData.size > 0) {
          const statesFeatures = (allStatesRef.current.features || []).filter((feature: any) => {
            const st = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
            return st ? statesWithData.has(st) : false
          })
          const countyFeatures = (allCountiesRef.current.features || []).filter((feature: any) => {
            const st = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
            return st ? statesWithData.has(st) : false
          })
          statesRef.current = { type: 'FeatureCollection', features: statesFeatures }
          countiesRef.current = { type: 'FeatureCollection', features: countyFeatures }
          hasFilteredRef.current = true
          allowedStates = statesWithData
        } else if (!hasFilteredRef.current) {
          statesRef.current = allStatesRef.current
          countiesRef.current = allCountiesRef.current
        }
      }

      if (allowedStates) {
        setSelectedStates((prev) => prev.filter((state) => allowedStates!.has(state)))
      }

      setTickKey((k) => k + 1)
    } catch (err) {
      console.error('SandboxMap2D filtering failed', err)
    }
  }, [scope, customStates, countyByFips, geoVersion])

  // Calculate state stats
  const { stateStats, stateMargins } = useMemo(() => {
    const stats = new Map<string, {
      demVotes: number
      gopVotes: number
      otherVotes: number
      totalVotes: number
      expectedVotes: number
      reportingPercent: number
    }>()
    const margins = new Map<string, number>()

    const features = (countiesRef.current?.features || []) as any[]
    for (const feature of features) {
      const stateFips = to2(feature?.properties?.STATE || feature?.properties?.STATEFP || feature?.properties?.STATEFP10 || '')
      if (!stateFips) continue

      const countyFips = toCountyFips(feature?.properties?.GEO_ID?.slice(-5) || feature?.properties?.FIPS || feature?.properties?.COUNTYFP)
      const sim = countyStates.get(countyFips)
      if (!sim) continue

      const baseline = countyByFips.get(countyFips)
      const demVotes = sim.currentDemVotes ?? 0
      const gopVotes = sim.currentGopVotes ?? 0
      const totalVotes = sim.currentTotalVotes ?? 0
      const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
      const expectedVotes = baseline?.totalVotes ?? 0

      const entry = stats.get(stateFips) ?? {
        demVotes: 0,
        gopVotes: 0,
        otherVotes: 0,
        totalVotes: 0,
        expectedVotes: 0,
        reportingPercent: 0
      }

      entry.demVotes += demVotes
      entry.gopVotes += gopVotes
      entry.otherVotes += otherVotes
      entry.totalVotes += totalVotes
      entry.expectedVotes += expectedVotes
      stats.set(stateFips, entry)
    }

    stats.forEach((value, key) => {
      const margin = value.totalVotes > 0 ? ((value.gopVotes - value.demVotes) / value.totalVotes) * 100 : 0
      margins.set(key, margin)
      value.reportingPercent = value.expectedVotes > 0 ? Math.min((value.totalVotes / Math.max(value.expectedVotes, 1)) * 100, 100) : 0
    })

    return { stateStats: stats, stateMargins: margins }
  }, [countyStates, countyByFips, geoVersion])

  // State layer (exclude selected states so counties show)
  const statesLayer = useMemo(() => {
    if (!statesRef.current) return null
    const src = statesRef.current
    const features = (src.features || []).filter((f: any) => {
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      return !(selectedStates.length > 0 && st && selectedStates.includes(st))
    })
    const data = { type: 'FeatureCollection', features } as FeatureCollection

    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-states-2d',
      data: data as any,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false, // 2D: no extrusion
      getLineColor: [148, 163, 184, 160],
      getFillColor: (f: any) => {
        const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
        const m = st ? (stateMargins.get(st) || 0) : 0
        return rustbeltMarginRgba(m, finalAlpha)
      },
      lineWidthMinPixels: 1.2,
      transitions: {
        getFillColor: { duration: 600, easing: (t: number) => t * t * (3 - 2 * t) }
      },
      onHover: ({ x, y, object }: any) => {
        if (!object || x == null || y == null) {
          setHoverInfo(null)
          return
        }

        const name = object?.properties?.NAME || 'State'
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        const stats = st ? stateStats.get(st) : undefined
        const margin = st ? stateMargins.get(st) ?? 0 : 0
        const stateMeta = st ? STATE_META_BY_FIPS.get(st) : undefined

        setHoverInfo({
          x: x + 10,
          y: y + 10,
          type: 'state',
          id: st ?? undefined,
          stateFips: st ?? undefined,
          label: name,
          subtitle: stateMeta ? `${stateMeta.name} (${stateMeta.abbr})` : undefined,
          demVotes: stats?.demVotes ?? 0,
          gopVotes: stats?.gopVotes ?? 0,
          otherVotes: stats?.otherVotes ?? 0,
          totalVotes: stats?.totalVotes ?? 0,
          reportingPercent: stats?.reportingPercent ?? 0,
          marginPct: margin
        })
      },
      onClick: ({ object }: any) => {
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        if (!st) return
        setSelectedStates((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]))
      },
      updateTriggers: {
        getFillColor: [stateMargins, opacity, selectedStates]
      }
    })
  }, [statesRef.current, stateMargins, stateStats, selectedStates, opacity, finalAlpha])

  // Counties layer (only for selected states)
  const countiesLayer = useMemo(() => {
    if (!countyFeatureCollection) return null

    const fallbackColor: [number, number, number, number] = [100, 116, 139, clamp(Math.round(255 * opacity), 30, 255)]

    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-counties-2d',
      data: countyFeatureCollection as any,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getFillColor: (_: any, { index }: { index: number }) => {
        const color = countyColorViewsRef.current[index]
        return color ?? fallbackColor
      },
      getLineColor: (feature: any) => {
        const paddedFips = featureCountyFips(feature)
        return latestEditedCountiesRef.current.has(paddedFips) ? [250, 204, 21, 240] : [148, 163, 184, 120]
      },
      lineWidthMinPixels: 0.8,
      transitions: {
        getFillColor: { duration: 300, easing: (t: number) => t * t * (3 - 2 * t) },
        getLineColor: { duration: 250 }
      },
      onHover: ({ x, y, object }: any) => {
        if (!object || x == null || y == null) {
          setHoverInfo(null)
          return
        }

        const paddedFips = featureCountyFips(object)
        const name = object?.properties?.NAME || 'County'
        const st = featureStateFips(object)
        const meta = st ? STATE_META_BY_FIPS.get(st) : undefined
        const sim = latestCountyStatesRef.current.get(paddedFips)
        const baseline = countyByFips.get(paddedFips)

        const demVotes = sim?.currentDemVotes ?? 0
        const gopVotes = sim?.currentGopVotes ?? 0
        const totalVotes = sim?.currentTotalVotes ?? 0
        const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
        const margin = totalVotes > 0 ? ((gopVotes - demVotes) / totalVotes) * 100 : 0
        const expectedVotes = baseline?.totalVotes ?? 0
        const reportingPercent = expectedVotes > 0
          ? clampPercent((totalVotes / Math.max(expectedVotes, 1)) * 100)
          : clampPercent(sim?.currentReportingPercent ?? 0)

        setHoverInfo({
          x: x + 10,
          y: y + 10,
          type: 'county',
          id: paddedFips,
          stateFips: st ?? undefined,
          label: `${name} County`,
          subtitle: meta ? `${meta.name} (${meta.abbr})` : undefined,
          demVotes,
          gopVotes,
          otherVotes,
          totalVotes,
          reportingPercent,
          marginPct: margin,
          isEdited: latestEditedCountiesRef.current.has(paddedFips)
        })
      },
      onClick: ({ object }: any) => {
        const paddedFips = featureCountyFips(object)
        if (!onCountyClick) return
        const countyName = object?.properties?.NAME || undefined
        const stateFips = featureStateFips(object) || undefined
        const stateMeta = stateFips ? STATE_META_BY_FIPS.get(stateFips) : undefined
        const metadata: CountyGeoMetadata = {
          countyName,
          stateFips,
          stateName: stateMeta?.abbr ?? stateMeta?.name
        }
        onCountyClick(paddedFips, metadata)
      },
      updateTriggers: {
        getFillColor: renderTick,
        getLineColor: renderTick
      }
    })
  }, [countyFeatureCollection, renderTick, opacity, onCountyClick, countyByFips])

  const layers = [statesLayer, countiesLayer].filter(Boolean)

  return (
    <div className="absolute inset-0">
      <div className="absolute top-3 left-3 z-20 max-w-md rounded-lg border border-slate-700 bg-slate-900/90 p-3">
        <div className="mb-2 flex items-center gap-3">
          <label className="text-[11px] font-semibold text-slate-300">Scope:</label>
          <select
            value={scope}
            onChange={(event) => handleScopeChange(event.target.value as 'ALL' | 'CUSTOM')}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px]"
          >
            <option value="ALL">All States</option>
            <option value="CUSTOM">Custom Selection</option>
          </select>
          {scope === 'CUSTOM' && (
            <button
              type="button"
              onClick={() => setStatePickerOpen((open) => !open)}
              className="rounded border border-blue-500 bg-blue-600 px-2 py-1 text-[10px] transition-colors hover:bg-blue-700"
            >
              {statePickerOpen ? 'Close' : 'Pick States'} ({customStates.length})
            </button>
          )}
        </div>
        <div className="text-xs text-slate-400">{status}</div>

        {selectedStates.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] text-slate-400">Drilled into: {selectedStates.length} state(s)</div>
            <button
              type="button"
              onClick={() => setSelectedStates([])}
              className="rounded bg-slate-800/70 px-2 py-1 text-[10px] text-slate-200 transition hover:bg-slate-700"
            >
              Clear drill-down
            </button>
          </div>
        )}

        {scope === 'CUSTOM' && statePickerOpen && (
          <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-slate-600 bg-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-200">Select States</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCustomStatesChange(ALL_US_STATES.map((state) => state.fips))}
                  className="rounded border border-blue-500 bg-blue-600 px-2 py-0.5 text-[10px] text-white transition hover:bg-blue-700"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomStatesChange([])}
                  className="rounded border border-rose-500 bg-rose-600 px-2 py-0.5 text-[10px] text-white transition hover:bg-rose-700"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mb-3 border-b border-slate-700 pb-3">
              <div className="mb-1.5 text-[10px] font-semibold text-slate-400">Regional Presets:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(REGIONAL_PRESETS).map(([label, states]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleCustomStatesChange([...states])}
                    className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-left text-[10px] text-slate-200 transition hover:bg-slate-600"
                  >
                    {label} <span className="text-slate-400">({states.length})</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-1.5 text-[10px] font-semibold text-slate-400">Individual States:</div>
            <div className="grid grid-cols-3 gap-1">
              {ALL_US_STATES.map((state) => {
                const isSelected = customStates.includes(state.fips)
                return (
                  <label
                    key={state.fips}
                    className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${
                      isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          handleCustomStatesChange([...customStates, state.fips])
                        } else {
                          handleCustomStatesChange(customStates.filter((fips) => fips !== state.fips))
                        }
                      }}
                      className="h-3 w-3"
                    />
                    <span className="flex-1">{state.abbr}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <DeckGL
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as ViewState)}
        controller={true}
        layers={layers}
        parameters={{
          clearColor: [15, 23, 42, 1]
        } as any}
      >
        <MapHoverTooltip info={hoverInfo} />
      </DeckGL>
    </div>
  )
}

export default SandboxMap2D
