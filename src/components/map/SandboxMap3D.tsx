import React, { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { GeoJsonLayer } from '@deck.gl/layers'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import { extrusionFromMarginIOWA, turnoutHeightFromVotesIOWA, clamp, hexToRgba } from '../../lib/election/swing'
import { GOP_BUCKETS, DEM_BUCKETS } from '../../utils/electionColor'
import type { CountyGeoMetadata, CountyResult } from '../../types/sandbox'
import { STATE_META_BY_FIPS } from '../../constants/usStates'
import { MapHoverTooltip, MapHoverInfo } from './MapHoverTooltip'
import { detectWebGLSupport, type WebGLSupport } from '../../utils/webglSupport'
import { useVoteBarChartLayer } from '../sandbox/map/VoteBarChartLayer'
import { debugLog, debugWarn } from '../../utils/debugLogger'

type ViewState = { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number }

export interface SandboxMap3DProps {
  countyResults: CountyResult[]
  countyStates: Map<string, { // runtime per-county status
    fips: string
    currentReportingPercent: number
    currentDemVotes: number
    currentGopVotes: number
    currentTotalVotes: number
    isFullyReported: boolean
  }>
  opacity?: number // 0..1
  scope?: 'ALL' | 'CUSTOM'
  customStates?: string[]
  onScopeChange?: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange?: (states: string[]) => void
  selectedStates?: string[]
  onSelectedStatesChange?: (states: string[]) => void
  onCountyClick?: (fips: string, meta?: CountyGeoMetadata) => void
  editedCounties?: Set<string>
  onWebGLFailure?: () => void
}

function to2(v: any){ return v==null? null : String(v).padStart(2,'0') }

export const SandboxMap3D: React.FC<SandboxMap3DProps> = ({ 
  countyResults, 
  countyStates, 
  opacity=0.92,
  scope: externalScope,
  customStates: externalCustomStates,
  onScopeChange,
  onCustomStatesChange,
  selectedStates: externalSelectedStates,
  onSelectedStatesChange,
  onCountyClick,
  editedCounties,
  onWebGLFailure
}) => {
  // Detect WebGL support once - result is cached
  const [webglStatus] = useState<WebGLSupport>(() => detectWebGLSupport())
  const [use3D, setUse3D] = useState<boolean>(() => webglStatus === 'supported')
  const isWebGLAvailable = webglStatus === 'supported'
  const [viewState, setViewState] = useState<ViewState>({ longitude: -96.5, latitude: 39.8, zoom: 3.7, pitch: 45, bearing: -10 })
  const deckRef = useRef<any>(null) // DeckGL instance ref for cleanup
  const mountedRef = useRef<boolean>(true) // Track component mount state
  const allStatesRef = useRef<FeatureCollection | null>(null)
  const allCountiesRef = useRef<FeatureCollection | null>(null)
  const statesRef = useRef<FeatureCollection | null>(null)
  const countiesRef = useRef<FeatureCollection | null>(null)
  const [, setTickKey] = useState(0)
  const [geoVersion, setGeoVersion] = useState(0) // bumps when geojson finishes loading so filters rerun
  const stateHeightScale = 0.6
  const countyHeightScale = 1.75
  const [hoverInfo, setHoverInfo] = useState<MapHoverInfo | null>(null)
  const notifiedFailureRef = useRef(false)
  
  // Bar chart layer controls
  const [showBarChart, setShowBarChart] = useState(false)
  const [barHeightScale, setBarHeightScale] = useState(0.1)
  const [barRadiusScale, setBarRadiusScale] = useState(5000)
  
  // Listen for deck.gl errors and disable 3D if shader compilation fails
  useEffect(() => {
    if (!isWebGLAvailable) {
      setUse3D(false)
      return
    }

    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Compilation error') || event.message?.includes('shader')) {
        debugWarn('3D shader compilation failed, falling back to 2D mode')
        setUse3D(false)
      }
    }
    
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      debugWarn('WebGL context lost, disabling 3D mode')
      setUse3D(false)
    }
    
    window.addEventListener('error', handleError, true)
    window.addEventListener('webglcontextlost', handleContextLost)
    
    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('webglcontextlost', handleContextLost)
    }
  }, [isWebGLAvailable])

  useEffect(() => {
    if ((!isWebGLAvailable || !use3D) && !notifiedFailureRef.current) {
      notifiedFailureRef.current = true
      onWebGLFailure?.()
    }
  }, [isWebGLAvailable, onWebGLFailure, use3D])

  // Critical cleanup on unmount - dispose DeckGL resources
  useEffect(() => {
    mountedRef.current = true
    
    return () => {
      mountedRef.current = false
      
      // Dispose DeckGL instance and free WebGL resources
      if (deckRef.current) {
        try {
          // DeckGL exposes finalize() method to clean up WebGL context
          if (typeof deckRef.current.deck?.finalize === 'function') {
            deckRef.current.deck.finalize()
          }
          deckRef.current = null
        } catch (e) {
          debugWarn('Error disposing DeckGL instance:', e)
        }
      }
      
      // Clear all refs to help GC
      allStatesRef.current = null
      allCountiesRef.current = null
      statesRef.current = null
      countiesRef.current = null
      
      debugLog('[SandboxMap3D] Cleaned up WebGL resources on unmount')
    }
  }, [])

  if (!isWebGLAvailable || !use3D) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-center text-sm text-slate-400">
        WebGL 2 is unavailable in this browser, so the 3D map is disabled. Switch to the 2D view to continue.
      </div>
    )
  }
  
  // Local state for scope/selection if not controlled externally
  const [internalScope] = useState<'ALL'|'CUSTOM'>('ALL')
  const [internalCustomStates] = useState<string[]>(['17', '18', '26', '27', '39', '42', '55']) // Default to Rust Belt
  // Use external props if provided, otherwise use internal state
  const scope = externalScope ?? internalScope
  const customStates = externalCustomStates ?? internalCustomStates
  
  const [internalSelectedStates, setInternalSelectedStates] = useState<string[]>([])
  
  // Use external selectedStates if provided, otherwise use internal state
  const selectedStates = externalSelectedStates ?? internalSelectedStates
  
  const handleSelectedStatesChange = (newStates: string[]) => {
    if (onSelectedStatesChange) {
      onSelectedStatesChange(newStates)
    } else {
      setInternalSelectedStates(newStates)
    }
  }
  
  // Track whether we've filtered states based on uploaded data
  const hasFilteredRef = useRef(false)

  useEffect(() => {
    // Scope callbacks are driven by the floating workspace; referencing them prevents unused warnings when provided.
    void onScopeChange
    void onCustomStatesChange
  }, [onScopeChange, onCustomStatesChange])

  // Use Rustbelt color buckets: map margin (R-D in pp) to bucket hex, then to RGBA
  function rustbeltMarginRgba(marginPct: number, alpha: number = 235): [number,number,number,number] {
    if (!isFinite(marginPct)) return [100,116,139,alpha]
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

  // Build FIPS lookup and default-selected states from uploaded results (multi-select by default)
  const countyByFips = useMemo(() => {
    const map = new Map<string, CountyResult>()
    for (const c of countyResults) map.set(c.fips.padStart(5,'0'), c)
    return map
  }, [countyResults])

  useEffect(() => {
    // Default selection = unique state FIPS present in uploaded data
    const uniq = new Set<string>()
    countyResults.forEach(c => {
      const st = (c.state || '').trim()
      if (st && st.length===2) {
        // We need numeric state FIPS; derive from GeoJSON when loaded. For default, collect 2-letter state; we'll map later.
        uniq.add(st)
      }
    })
    // If none, keep empty to show only states layer
  }, [countyResults])

  // Load national geojson (states and counties)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const baseUrl = (import.meta as any).env?.BASE_URL || '/'
        const s = await fetch(`${baseUrl}gz_2010_us_040_00_500k.json`).then(r=>r.json())
        if (!alive || !mountedRef.current) return
        allStatesRef.current = s
        statesRef.current = s
        const c = await fetch(`${baseUrl}gz_2010_us_050_00_500k.json`).then(r=>r.json())
        if (!alive || !mountedRef.current) return
        allCountiesRef.current = c
        countiesRef.current = c
        debugLog('[SandboxMap3D] GeoJSON layers ready')
        if (mountedRef.current) {
          setGeoVersion(v => v + 1)
          setTickKey(k => k + 1)
        }
        
        // Don't auto-select states when CSV is uploaded - let user control visibility
        // Only initialize selection for CUSTOM scope
        if (scope === 'CUSTOM' && countyResults.length === 0) {
          // Default to showing counties for custom states when no data uploaded
          handleSelectedStatesChange([...customStates])
        }
      } catch (e) {
        console.error('[SandboxMap3D] GeoJSON load failed', e)
      }
    })()
    return () => { alive = false }
  }, [countyByFips])

  // Update current scoped geojson when scope or customStates changes
  useEffect(()=>{
    try{
      if (!allStatesRef.current || !allCountiesRef.current) return
      
      if (scope==='CUSTOM'){
        // CUSTOM: filter to user-selected states ONLY (ignore uploaded data)
        const sf = (allStatesRef.current.features||[]).filter((f:any)=> customStates.includes(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
        statesRef.current = { type:'FeatureCollection', features: sf }
        const cf = (allCountiesRef.current.features||[]).filter((f:any)=> customStates.includes(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
        countiesRef.current = { type:'FeatureCollection', features: cf }
        // Prune selection to custom states only
        const filteredSelection = selectedStates.filter(s=> customStates.includes(s))
        handleSelectedStatesChange(filteredSelection)
      } else {
        // ALL: Find states that have uploaded data
        const statesWithData = new Set<string>()
        for (const f of (allCountiesRef.current.features||[]) as any[]) {
          const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
          if (countyByFips.has(String(fips).padStart(5,'0'))) {
            const stFips = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
            if (stFips) statesWithData.add(stFips)
          }
        }
        
        // ALL: if data is uploaded, show ONLY states with data (no counties yet - user must click to drill down)
        // Otherwise show all states ONLY if we've never had data before
        if (statesWithData.size > 0) {
          const sf = (allStatesRef.current.features||[]).filter((f:any)=> {
            const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
            return st && statesWithData.has(st)
          })
          statesRef.current = { type:'FeatureCollection', features: sf }
          const cf = (allCountiesRef.current.features||[]).filter((f:any)=> {
            const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
            return st && statesWithData.has(st)
          })
          countiesRef.current = { type:'FeatureCollection', features: cf }
          hasFilteredRef.current = true // Mark that we've filtered
          // Don't automatically select states - keep selectedStates empty so counties stay hidden
        } else if (!hasFilteredRef.current) {
          // No data uploaded AND we haven't filtered yet; show everything
          statesRef.current = allStatesRef.current
          countiesRef.current = allCountiesRef.current
        } else {
          // Had data before but lost it temporarily - keep existing filtered state
        }
      }
      setTickKey(k=>k+1)
    }catch{}
  }, [scope, customStates, countyByFips, geoVersion])

  // Vote-weighted state margin from current simulation state (R−D, pp) - MEMOIZED
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

    if (!countiesRef.current) {
      return { stateStats: stats, stateMargins: margins }
    }

    const feats = (countiesRef.current.features || []) as any[]
    for (const f of feats) {
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      if (!st) continue

      const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
      const paddedFips = String(fips).padStart(5,'0')
      const sim = countyStates.get(paddedFips)
      const baseline = countyByFips.get(paddedFips)

      const demVotes = sim?.currentDemVotes ?? 0
      const gopVotes = sim?.currentGopVotes ?? 0
      const totalVotes = sim?.currentTotalVotes ?? 0
      const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
      const expectedVotes = baseline?.totalVotes ?? 0

      const existing = stats.get(st) || { demVotes: 0, gopVotes: 0, otherVotes: 0, totalVotes: 0, expectedVotes: 0, reportingPercent: 0 }
      existing.demVotes += demVotes
      existing.gopVotes += gopVotes
      existing.otherVotes += otherVotes
      existing.totalVotes += totalVotes
      existing.expectedVotes += expectedVotes
      stats.set(st, existing)
    }

    stats.forEach((value, key) => {
      const { demVotes, gopVotes, totalVotes, expectedVotes } = value
      const margin = totalVotes > 0 ? ((gopVotes - demVotes) / totalVotes) * 100 : 0
      margins.set(key, margin)
      value.reportingPercent = expectedVotes > 0 ? Math.min((totalVotes / expectedVotes) * 100, 100) : 0
    })

    return { stateStats: stats, stateMargins: margins }
  }, [countiesRef.current, countyStates, countyByFips])

  // State layer (exclude selected states so counties show on top when selected)
  const statesLayer = useMemo(() => {
    if (!statesRef.current) return null
    const src = statesRef.current
    const features = (src.features||[]).filter((f:any)=>{
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      return !(selectedStates.length>0 && st && selectedStates.includes(st))
    })
    const data = { type:'FeatureCollection', features } as FeatureCollection
    const finalAlpha = clamp(Math.round(255 * opacity), 30, 255)

    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-states',
      data: data as any,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: use3D,
      parameters: ({ depthTest: true } as any),
      getLineColor: [255,255,255,255],
      getFillColor: (f:any) => {
        const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
        const m = st ? (stateMargins.get(st) || 0) : 0
        return rustbeltMarginRgba(m, finalAlpha)
      },
      lineWidthMinPixels: 1.6,
      getElevation: (f:any) => {
        const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
        if (!st) return 0
        const m = stateMargins.get(st) || 0
        const base = extrusionFromMarginIOWA(m)
        return base * stateHeightScale * 0.6
      },
      transitions: {
        getElevation: { duration: 800, easing: (t: number) => t * t * (3 - 2 * t) },
        getFillColor: { duration: 600 }
      },
      onHover: ({x,y,object}:any) => {
        if (!object || x == null || y == null) {
          setHoverInfo(null)
          return
        }

        const name = object?.properties?.NAME || 'State'
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        const stats = st ? stateStats.get(st) : undefined
        const margin = st ? stateMargins.get(st) ?? 0 : 0
        const meta = st ? STATE_META_BY_FIPS.get(st) : undefined

        setHoverInfo({
          x: x + 10,
          y: y + 10,
          type: 'state',
          id: st ?? undefined,
          stateFips: st ?? undefined,
          label: name,
          subtitle: meta ? `${meta.name} (${meta.abbr})` : undefined,
          demVotes: stats?.demVotes ?? 0,
          gopVotes: stats?.gopVotes ?? 0,
          otherVotes: stats?.otherVotes ?? 0,
          totalVotes: stats?.totalVotes ?? 0,
          reportingPercent: stats?.reportingPercent ?? 0,
          marginPct: margin
        })
      },
      onClick: ({object}:any) => {
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        if (!st) return
        const newSelection = selectedStates.includes(st) 
          ? selectedStates.filter(s=>s!==st) 
          : [...selectedStates, st]
        handleSelectedStatesChange(newSelection)
      },
      updateTriggers: {
        getFillColor: [stateMargins, opacity, selectedStates],
        getElevation: [stateMargins, stateHeightScale, selectedStates]
      }
    })
  }, [statesRef.current, stateMargins, stateStats, selectedStates, stateHeightScale, opacity, use3D])

  // Counties layer (only for selected states)
  const countiesLayer = useMemo(() => {
    if (!countiesRef.current || selectedStates.length===0) return null
    const src = countiesRef.current
    const feats = (src.features||[]).filter((f:any)=>{
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      return !!st && selectedStates.includes(st)
    })
    const data = { type:'FeatureCollection', features: feats.map((f:any)=> ({...f})) } as FeatureCollection
    const finalAlpha = clamp(Math.min(220, Math.round(255 * opacity)), 30, 255)

    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-counties',
      data: data as any,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: use3D,
      wireframe: false,
      parameters: ({ depthTest: false } as any),
      getFillColor: (f:any) => {
        const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
        const paddedFips = String(fips).padStart(5,'0')
        const s = countyStates.get(paddedFips)
        
        // Highlight edited counties with a yellow tint
        const isEdited = editedCounties?.has(paddedFips) || false
        
        if (!s || s.currentTotalVotes<=0) {
          return isEdited ? [255, 215, 0, finalAlpha] : [100,116,139,finalAlpha]
        }
        
        const margin = ((s.currentGopVotes - s.currentDemVotes) / Math.max(1, s.currentTotalVotes)) * 100
        const baseColor = rustbeltMarginRgba(margin, finalAlpha)
        
        // If edited, add yellow overlay
        if (isEdited) {
          return [
            Math.min(255, baseColor[0] + 40),
            Math.min(255, baseColor[1] + 40),
            baseColor[2],
            finalAlpha
          ] as [number, number, number, number]
        }
        return baseColor
      },
      getElevation: (f:any) => {
        const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
        const s = countyStates.get(String(fips).padStart(5,'0'))
        if (!s) return 1000
        // Use turnout height based on currently reported total votes; if zero, flat base
        const statsP95 = 1_000_000 // heuristic; sandbox lacks precomputed p95, pick a stable value
        const turnoutHeight = turnoutHeightFromVotesIOWA(Math.max(0, s.currentTotalVotes||0), 1.0, statsP95)
        // Also incorporate margin-based height for hybrid feel
        const margin = (s.currentTotalVotes>0)? ((s.currentGopVotes - s.currentDemVotes)/s.currentTotalVotes)*100 : 0
        const marginHeight = extrusionFromMarginIOWA(margin)
        const h = 0.6*marginHeight + 0.4*turnoutHeight
        return h * countyHeightScale
      },
      getLineColor: [255,255,255,200],
      lineWidthMinPixels: 0.5,
      transitions: {
        getFillColor: { duration: 600 },
        getElevation: { duration: 1000, enter: () => 0 }
      },
      updateTriggers: {
        getFillColor: [countyStates, opacity, editedCounties],
        getElevation: [countyStates, countyHeightScale]
      },
      onHover: ({ x,y,object }:any) => {
        if (!object || x == null || y == null) {
          setHoverInfo(null)
          return
        }

        const fips = object?.properties?.GEO_ID?.slice(-5) || object?.properties?.FIPS || object?.properties?.COUNTYFP || ''
        const paddedFips = String(fips).padStart(5,'0')
        const sim = countyStates.get(paddedFips)
        const baseline = countyByFips.get(paddedFips)
        const stateCode = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        const meta = stateCode ? STATE_META_BY_FIPS.get(stateCode) : undefined
        const countyName = object?.properties?.NAME || 'County'

        const totalVotes = sim?.currentTotalVotes ?? 0
        const demVotes = sim?.currentDemVotes ?? 0
        const gopVotes = sim?.currentGopVotes ?? 0
        const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
        const reportingPercent = baseline?.totalVotes
          ? Math.min((totalVotes / Math.max(baseline.totalVotes, 1)) * 100, 100)
          : sim?.currentReportingPercent ?? 0
        const marginPct = totalVotes > 0 ? ((gopVotes - demVotes) / totalVotes) * 100 : 0

        setHoverInfo({
          x: x + 10,
          y: y + 10,
          type: 'county',
          id: paddedFips,
          stateFips: stateCode ?? undefined,
          label: `${countyName} County`,
          subtitle: meta ? `${meta.name} (${meta.abbr})` : undefined,
          demVotes,
          gopVotes,
          otherVotes,
          totalVotes,
          reportingPercent,
          marginPct,
          isEdited: editedCounties?.has(paddedFips)
        })
      },
      onClick: ({object}:any) => {
        const fips = object?.properties?.GEO_ID?.slice(-5) || object?.properties?.FIPS || object?.properties?.COUNTYFP || ''
        if (fips && onCountyClick) {
          onCountyClick(String(fips).padStart(5,'0'))
        }
      }
    })
  }, [countiesRef.current, countyStates, selectedStates, countyHeightScale, opacity, editedCounties, onCountyClick, countyByFips, use3D])

  const layers = useMemo(() => {
    const arr:any[] = []
    if (statesLayer) arr.push(statesLayer)
    if (countiesLayer) arr.push(countiesLayer)
    return arr
  }, [statesLayer, countiesLayer])

  // Keep re-rendering when simulation state updates (external) by bumping tickKey
  useEffect(()=>{ setTickKey(k=>k+1) }, [countyStates])

  if (webglStatus === 'unsupported') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-6 text-center text-slate-200">
        <p className="text-base font-semibold">3D map unavailable</p>
        <p className="text-sm text-slate-300">
          This browser session cannot create a WebGL context. Switch to the 2D map mode or enable hardware acceleration to view the 3D map.
        </p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      {/* State Selection Controls moved to draggable FloatingPanel */}
      
      <MapHoverTooltip info={hoverInfo} />
      
      {/* DeckGL Map */}
      <DeckGL
        ref={deckRef}
        layers={layers}
        viewState={viewState as any}
        controller={true}
        onViewStateChange={(v:any)=> setViewState(v.viewState)}
        getCursor={({ isDragging }:any)=> (isDragging? 'grabbing' : 'default')}
        style={{ position:'absolute', inset:'0' }}
        onLoad={() => debugLog('[SandboxMap3D] DeckGL loaded')}
      />
    </div>
  )
}

export default SandboxMap3D
