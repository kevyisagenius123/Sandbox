import React, { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { GeoJsonLayer } from '@deck.gl/layers'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import { extrusionFromMarginIOWA, turnoutHeightFromVotesIOWA, clamp, hexToRgba } from '../../lib/election/swing'
import { GOP_BUCKETS, DEM_BUCKETS } from '../../utils/electionColor'
import type { CountyGeoMetadata, CountyResult } from '../../types/sandbox'

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
  onCountyClick?: (fips: string, meta?: CountyGeoMetadata) => void
  editedCounties?: Set<string>
}

// All US states with FIPS codes for custom selection
const ALL_US_STATES = [
  { fips: '01', name: 'Alabama', abbr: 'AL' },
  { fips: '02', name: 'Alaska', abbr: 'AK' },
  { fips: '04', name: 'Arizona', abbr: 'AZ' },
  { fips: '05', name: 'Arkansas', abbr: 'AR' },
  { fips: '06', name: 'California', abbr: 'CA' },
  { fips: '08', name: 'Colorado', abbr: 'CO' },
  { fips: '09', name: 'Connecticut', abbr: 'CT' },
  { fips: '10', name: 'Delaware', abbr: 'DE' },
  { fips: '11', name: 'District of Columbia', abbr: 'DC' },
  { fips: '12', name: 'Florida', abbr: 'FL' },
  { fips: '13', name: 'Georgia', abbr: 'GA' },
  { fips: '15', name: 'Hawaii', abbr: 'HI' },
  { fips: '16', name: 'Idaho', abbr: 'ID' },
  { fips: '17', name: 'Illinois', abbr: 'IL' },
  { fips: '18', name: 'Indiana', abbr: 'IN' },
  { fips: '19', name: 'Iowa', abbr: 'IA' },
  { fips: '20', name: 'Kansas', abbr: 'KS' },
  { fips: '21', name: 'Kentucky', abbr: 'KY' },
  { fips: '22', name: 'Louisiana', abbr: 'LA' },
  { fips: '23', name: 'Maine', abbr: 'ME' },
  { fips: '24', name: 'Maryland', abbr: 'MD' },
  { fips: '25', name: 'Massachusetts', abbr: 'MA' },
  { fips: '26', name: 'Michigan', abbr: 'MI' },
  { fips: '27', name: 'Minnesota', abbr: 'MN' },
  { fips: '28', name: 'Mississippi', abbr: 'MS' },
  { fips: '29', name: 'Missouri', abbr: 'MO' },
  { fips: '30', name: 'Montana', abbr: 'MT' },
  { fips: '31', name: 'Nebraska', abbr: 'NE' },
  { fips: '32', name: 'Nevada', abbr: 'NV' },
  { fips: '33', name: 'New Hampshire', abbr: 'NH' },
  { fips: '34', name: 'New Jersey', abbr: 'NJ' },
  { fips: '35', name: 'New Mexico', abbr: 'NM' },
  { fips: '36', name: 'New York', abbr: 'NY' },
  { fips: '37', name: 'North Carolina', abbr: 'NC' },
  { fips: '38', name: 'North Dakota', abbr: 'ND' },
  { fips: '39', name: 'Ohio', abbr: 'OH' },
  { fips: '40', name: 'Oklahoma', abbr: 'OK' },
  { fips: '41', name: 'Oregon', abbr: 'OR' },
  { fips: '42', name: 'Pennsylvania', abbr: 'PA' },
  { fips: '44', name: 'Rhode Island', abbr: 'RI' },
  { fips: '45', name: 'South Carolina', abbr: 'SC' },
  { fips: '46', name: 'South Dakota', abbr: 'SD' },
  { fips: '47', name: 'Tennessee', abbr: 'TN' },
  { fips: '48', name: 'Texas', abbr: 'TX' },
  { fips: '49', name: 'Utah', abbr: 'UT' },
  { fips: '50', name: 'Vermont', abbr: 'VT' },
  { fips: '51', name: 'Virginia', abbr: 'VA' },
  { fips: '53', name: 'Washington', abbr: 'WA' },
  { fips: '54', name: 'West Virginia', abbr: 'WV' },
  { fips: '55', name: 'Wisconsin', abbr: 'WI' },
  { fips: '56', name: 'Wyoming', abbr: 'WY' },
]

// Regional presets for quick access
const REGIONAL_PRESETS = {
  'Rust Belt': ['17', '18', '26', '27', '39', '42', '55'], // IL, IN, MI, MN, OH, PA, WI
  'Blue Wall': ['26', '42', '55'], // MI, PA, WI
  'Sun Belt': ['04', '12', '13', '32', '35', '37', '48'], // AZ, FL, GA, NV, NM, NC, TX
  'Swing States 2024': ['04', '13', '26', '32', '37', '42', '55'], // AZ, GA, MI, NV, NC, PA, WI
  'Northeast': ['09', '23', '25', '33', '34', '36', '44', '50'], // CT, ME, MA, NH, NJ, NY, RI, VT
  'Southeast': ['01', '12', '13', '21', '28', '37', '45', '47', '51', '54'], // AL, FL, GA, KY, MS, NC, SC, TN, VA, WV
  'Midwest': ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'], // IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI
  'Mountain West': ['04', '08', '16', '30', '32', '35', '49', '56'], // AZ, CO, ID, MT, NV, NM, UT, WY
  'Pacific': ['02', '06', '15', '41', '53'], // AK, CA, HI, OR, WA
  'Deep South': ['01', '05', '22', '28', '45'], // AL, AR, LA, MS, SC
  'Great Lakes': ['17', '18', '26', '27', '39', '55'], // IL, IN, MI, MN, OH, WI
  'Border States': ['10', '21', '24', '29', '40', '47', '48', '54'], // DE, KY, MD, MO, OK, TN, TX, WV
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
  onCountyClick,
  editedCounties
}) => {
  const [viewState, setViewState] = useState<ViewState>({ longitude: -96.5, latitude: 39.8, zoom: 3.7, pitch: 45, bearing: -10 })
  const allStatesRef = useRef<FeatureCollection | null>(null)
  const allCountiesRef = useRef<FeatureCollection | null>(null)
  const statesRef = useRef<FeatureCollection | null>(null)
  const countiesRef = useRef<FeatureCollection | null>(null)
  const [tickKey, setTickKey] = useState(0)
  const [status, setStatus] = useState('Loading…')
  const [qualityMode, setQualityMode] = useState<'performance'|'balanced'|'quality'>('balanced')
  const [fillAlpha, setFillAlpha] = useState(Math.round(255 * opacity))
  const [stateHeightScale, setStateHeightScale] = useState(0.6)
  const [countyHeightScale, setCountyHeightScale] = useState(1.75)
  
  // Track if simulation is actively playing to disable transitions
  const [isSimulationPlaying, setIsSimulationPlaying] = useState(false)
  const lastUpdateTimeRef = useRef<number>(Date.now())
  
  // Local state for scope/selection if not controlled externally
  const [internalScope, setInternalScope] = useState<'ALL'|'CUSTOM'>('ALL')
  const [internalCustomStates, setInternalCustomStates] = useState<string[]>(['17', '18', '26', '27', '39', '42', '55']) // Default to Rust Belt
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  
  // Use external props if provided, otherwise use internal state
  const scope = externalScope ?? internalScope
  const customStates = externalCustomStates ?? internalCustomStates
  
  const handleScopeChange = (newScope: 'ALL' | 'CUSTOM') => {
    if (onScopeChange) {
      onScopeChange(newScope)
    } else {
      setInternalScope(newScope)
    }
  }
  
  const handleCustomStatesChange = (newStates: string[]) => {
    if (onCustomStatesChange) {
      onCustomStatesChange(newStates)
    } else {
      setInternalCustomStates(newStates)
    }
  }
  
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const selectionKey = useMemo(()=> selectedStates.join(','), [selectedStates])

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
        if (!alive) return
        allStatesRef.current = s
        statesRef.current = s
        const c = await fetch(`${baseUrl}gz_2010_us_050_00_500k.json`).then(r=>r.json())
        if (!alive) return
        allCountiesRef.current = c
        countiesRef.current = c
        setStatus('Ready')
        setTickKey(k=>k+1)
        
        // Initialize selection based on uploaded data OR default to custom states for CUSTOM scope
        if (countyResults.length > 0) {
          const stSet = new Set<string>()
          for (const f of (c.features||[]) as any[]) {
            const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
            const county = countyByFips.get(String(fips).padStart(5,'0'))
            if (county) {
              const stFips = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
              if (stFips) stSet.add(stFips)
            }
          }
          if (stSet.size>0) setSelectedStates(Array.from(stSet))
        } else if (scope === 'CUSTOM') {
          // Default to showing counties for custom states when no data uploaded
          setSelectedStates([...customStates])
        }
      } catch (e) {
        setStatus('Geo load failed')
      }
    })()
    return () => { alive = false }
  }, [countyByFips])

  // Update current scoped geojson when scope or customStates changes
  useEffect(()=>{
    try{
      if (!allStatesRef.current || !allCountiesRef.current) return
      
      // Find states that have uploaded data
      const statesWithData = new Set<string>()
      for (const f of (allCountiesRef.current.features||[]) as any[]) {
        const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
        if (countyByFips.has(String(fips).padStart(5,'0'))) {
          const stFips = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
          if (stFips) statesWithData.add(stFips)
        }
      }
      
      if (scope==='CUSTOM'){
        // CUSTOM: filter to user-selected states
        const sf = (allStatesRef.current.features||[]).filter((f:any)=> customStates.includes(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
        statesRef.current = { type:'FeatureCollection', features: sf }
        const cf = (allCountiesRef.current.features||[]).filter((f:any)=> customStates.includes(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
        countiesRef.current = { type:'FeatureCollection', features: cf }
        // Prune selection to custom states only
        setSelectedStates(prev => prev.filter(s=> customStates.includes(s)))
      } else {
        // ALL: if data is uploaded, show only states with data; otherwise show all
        if (statesWithData.size > 0) {
          const sf = (allStatesRef.current.features||[]).filter((f:any)=> statesWithData.has(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
          statesRef.current = { type:'FeatureCollection', features: sf }
          const cf = (allCountiesRef.current.features||[]).filter((f:any)=> statesWithData.has(to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10) || ''))
          countiesRef.current = { type:'FeatureCollection', features: cf }
        } else {
          // No data uploaded yet; show everything
          statesRef.current = allStatesRef.current
          countiesRef.current = allCountiesRef.current
        }
      }
      setTickKey(k=>k+1)
    }catch{}
  }, [scope, customStates, countyByFips])

  // Vote-weighted state margin from current simulation state (R−D, pp)
  const computeStateProjectedMargin = (stateFips: string): number => {
    if (!countiesRef.current) return 0
    const feats = (countiesRef.current.features||[]) as any[]
    let T = 0, sum = 0
    for (const f of feats) {
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      if (st !== stateFips) continue
      const fips = f?.properties?.GEO_ID?.slice(-5) || f?.properties?.FIPS || f?.properties?.COUNTYFP || ''
      const s = countyStates.get(String(fips).padStart(5,'0'))
      if (!s) continue
      const t = Math.max(0, s.currentTotalVotes||0)
      const margin = ((s.currentGopVotes - s.currentDemVotes) / Math.max(1, t)) * 100
      T += t
      sum += (margin/100) * t
    }
    return T>0 ? (sum/T)*100 : 0
  }

  // State layer (exclude selected states so counties show on top when selected)
  const statesLayer = useMemo(() => {
    if (!statesRef.current) return null
    const src = statesRef.current
    // Render all states; don't remove selected states so the base state fill never disappears
    const data = { type:'FeatureCollection', features: (src.features||[]).map((f:any)=> ({...f})) } as FeatureCollection
  // Make state fills clearly visible even on dark background during simulation
  const finalAlpha = clamp(Math.round(255 * opacity), 220, 255)
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-states',
      data: data as any,
      pickable: true,
      stroked: true,
      filled: true,
      // Render states as flat fills (no lighting) to avoid visual fading
      extruded: false,
      // Force draws even when depth buffer has county extrusions
      parameters: ({ depthTest: false } as any),
      opacity: 1,
      getLineColor: [255,255,255,255],
      getFillColor: (f:any) => {
        try {
          const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
          const m = st ? computeStateProjectedMargin(st) : 0
          const color = rustbeltMarginRgba(isFinite(m) ? m : 0, finalAlpha)
          return color
        } catch {
          // Fallback neutral if anything goes wrong during rapid updates
          return [120, 130, 150, finalAlpha]
        }
      },
      lineWidthMinPixels: qualityMode==='quality'? 1.6 : 1.0,
      getElevation: (f:any) => {
        const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
        if (!st) return 0
        const m = computeStateProjectedMargin(st)
        const base = extrusionFromMarginIOWA(m)
        return base * stateHeightScale * 0.6
      },
      transitions: isSimulationPlaying ? undefined : {
        getFillColor: { 
          duration: (qualityMode==='performance'? 0 : (qualityMode==='quality'? 800 : 600)), 
          enter: (d: any) => [128, 128, 128, finalAlpha] 
        }
      },
      onHover: ({x,y,object}:any) => {
        const tip = document.getElementById('sb-tip')
        if (!object) { if (tip) tip.style.display='none'; return }
        const name = object?.properties?.NAME || 'State'
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        const projM = st? computeStateProjectedMargin(st) : 0
        if (tip) {
          tip.style.display = 'block'
          tip.style.left = `${x+10}px`
          tip.style.top = `${y+10}px`
          tip.innerHTML = `<div style='font-weight:600'>${name}</div>
              <div style='font-size:11px;color:#cbd5e1'>Projected margin: ${projM.toFixed(2)} pp (R−D)</div>`
        }
      },
      onClick: ({object}:any) => {
        const st = to2(object?.properties?.STATE || object?.properties?.STATEFP || object?.properties?.STATEFP10 || '')
        if (!st) return
        setSelectedStates(prev => (prev.includes(st) ? prev.filter(s=>s!==st) : [...prev, st]))
      },
      updateTriggers: {
        getFillColor: [tickKey, qualityMode, selectionKey, fillAlpha],
        getElevation: [tickKey, qualityMode, selectionKey, stateHeightScale]
      }
    })
  }, [statesRef.current, qualityMode, tickKey, selectionKey, stateHeightScale, opacity, isSimulationPlaying, countyStates])

  // Counties layer (only for selected states)
  const countiesLayer = useMemo(() => {
    if (!countiesRef.current || selectedStates.length===0) return null
    const src = countiesRef.current
    const feats = (src.features||[]).filter((f:any)=>{
      const st = to2(f?.properties?.STATE || f?.properties?.STATEFP || f?.properties?.STATEFP10 || '')
      return !!st && selectedStates.includes(st)
    })
    const data = { type:'FeatureCollection', features: feats.map((f:any)=> ({...f})) } as FeatureCollection
    const perf = qualityMode === 'performance'
    const qual = qualityMode === 'quality'
    const finalAlpha = clamp(Math.min(220, Math.round(255 * opacity)), 30, 255)
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-counties',
      data: data as any,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: true,
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
          ]
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
      getLineColor: [255,255,255,180],
      lineWidthMinPixels: 0.9,
      transitions: {
        getFillColor: { 
          duration: isSimulationPlaying ? 0 : (perf ? 0 : (qual ? 800 : 600)), 
          enter: (d: any) => [128, 128, 128, finalAlpha] 
        },
        getElevation: { 
          duration: isSimulationPlaying ? 0 : (perf ? 0 : (qual ? 1200 : 900)), 
          enter: () => [0] 
        }
      },
      updateTriggers: {
        getFillColor: [tickKey, qualityMode, selectionKey, countyStates, editedCounties],
        getElevation: [tickKey, qualityMode, selectionKey, countyStates, countyHeightScale]
      },
      onHover: ({ x,y,object }:any) => {
        if (!object) return
        const fips = object?.properties?.GEO_ID?.slice(-5) || object?.properties?.FIPS || object?.properties?.COUNTYFP || ''
        const name = object?.properties?.NAME || 'County'
        const s = countyStates.get(String(fips).padStart(5,'0'))
        const tip = document.getElementById('sb-tip')
        if (tip) {
          tip.style.display = 'block'
          tip.style.left = `${x+10}px`
          tip.style.top = `${y+10}px`
          if (s && s.currentTotalVotes>0) {
            const margin = ((s.currentGopVotes - s.currentDemVotes)/s.currentTotalVotes)*100
            tip.innerHTML = `<div style='font-weight:600'>${name}</div>
              <div style='font-size:11px;color:#cbd5e1'>Reporting: ${s.currentReportingPercent.toFixed(1)}%</div>
              <div style='font-size:11px;color:#cbd5e1'>Votes: R ${s.currentGopVotes.toLocaleString()} • D ${s.currentDemVotes.toLocaleString()}</div>
              <div style='font-size:11px;color:#cbd5e1'>Margin: ${margin.toFixed(2)} pp (R−D)</div>`
          } else {
            tip.innerHTML = `<div style='font-weight:600'>${name}</div>
              <div style='font-size:11px;color:#cbd5e1'>Not yet reporting</div>`
          }
        }
      },
      onClick: ({object}:any) => {
        const fips = object?.properties?.GEO_ID?.slice(-5) || object?.properties?.FIPS || object?.properties?.COUNTYFP || ''
        if (fips && onCountyClick) {
          onCountyClick(String(fips).padStart(5,'0'))
        }
      }
    })
  }, [countiesRef.current, selectionKey, countyStates, qualityMode, countyHeightScale, opacity, onCountyClick, isSimulationPlaying])

  // Always-on-top state borders layer to prevent visual fade when counties are extruded
  const stateBordersLayer = useMemo(() => {
    if (!statesRef.current) return null
    const src = statesRef.current
    const data = { type: 'FeatureCollection', features: (src.features || []).map((f:any)=> ({...f})) } as FeatureCollection
    return new GeoJsonLayer<Feature<Geometry, any>>({
      id: 'sb-state-borders',
      data: data as any,
      pickable: false,
      stroked: true,
      filled: false,
      extruded: false,
      // Disable depth test so borders render over 3D county extrusions
      parameters: ({ depthTest: false } as any),
      getLineColor: [255,255,255,255],
      lineWidthMinPixels: qualityMode==='quality'? 1.6 : 1.0,
      updateTriggers: {
        getLineColor: [qualityMode]
      }
    })
  }, [statesRef.current, qualityMode])

  const layers = useMemo(() => {
    const arr:any[] = []
    // Draw counties first (background), then state fills, then borders on top
    if (countiesLayer) arr.push(countiesLayer)
    if (statesLayer) arr.push(statesLayer)
    // Draw borders last so they appear above everything
    if (stateBordersLayer) arr.push(stateBordersLayer)
    return arr
  }, [statesLayer, countiesLayer, stateBordersLayer])

  // Keep re-rendering when simulation state updates (external) by bumping tickKey
  // Auto-detect if simulation is actively playing based on update frequency
  useEffect(() => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current
    lastUpdateTimeRef.current = now
    
    // If updates come faster than 500ms, we're in active playback
    if (timeSinceLastUpdate < 500) {
      setIsSimulationPlaying(true)
    } else {
      // Slow updates or manual edits - enable transitions
      setIsSimulationPlaying(false)
    }
    
    setTickKey(k => k + 1)
  }, [countyStates])

  return (
    <div className="absolute inset-0">
      {/* Scope and State Selection Controls */}
      <div className="absolute top-3 left-3 z-20 bg-slate-900/90 rounded-lg border border-slate-700 p-3 max-w-md">
        <div className="flex items-center gap-3 mb-2">
          <label className="text-[11px] text-slate-300 font-semibold">Scope:</label>
          <select 
            value={scope} 
            onChange={e=> handleScopeChange(e.target.value as 'ALL'|'CUSTOM')} 
            className="text-[11px] bg-slate-800 border border-slate-700 rounded px-2 py-1"
          >
            <option value="ALL">All States</option>
            <option value="CUSTOM">Custom Selection</option>
          </select>
          {scope==='CUSTOM' && (
            <button 
              onClick={() => setStatePickerOpen(!statePickerOpen)} 
              className="px-2 py-1 text-[10px] rounded bg-blue-600 hover:bg-blue-700 border border-blue-500 transition-colors"
            >
              {statePickerOpen ? 'Close' : 'Pick States'} ({customStates.length})
            </button>
          )}
        </div>
        
        <div className="text-xs text-slate-400">{status}</div>

        {/* Clear interactive state selection (counties layer) like other maps */}
        {selectedStates.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[10px] text-slate-400">Selected states: {selectedStates.length}</div>
            <button
              onClick={() => setSelectedStates([])}
              className="px-2 py-1 text-[10px] rounded bg-slate-800/70 border border-slate-700 hover:bg-slate-700"
            >
              Clear state selection
            </button>
          </div>
        )}
        
        {/* State Picker Modal */}
        {scope==='CUSTOM' && statePickerOpen && (
          <div className="mt-3 p-3 rounded-md bg-slate-800 border border-slate-600 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-slate-200 font-semibold">Select States</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCustomStatesChange(ALL_US_STATES.map(s => s.fips))}
                  className="px-2 py-0.5 text-[10px] rounded bg-blue-600 hover:bg-blue-700 border border-blue-500"
                >
                  All
                </button>
                <button 
                  onClick={() => handleCustomStatesChange([])}
                  className="px-2 py-0.5 text-[10px] rounded bg-rose-600 hover:bg-rose-700 border border-rose-500"
                >
                  Clear
                </button>
              </div>
            </div>
            
            {/* Regional Presets */}
            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="text-[10px] text-slate-400 font-semibold mb-1.5">Regional Presets:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(REGIONAL_PRESETS).map(([name, fips]) => (
                  <button
                    key={name}
                    onClick={() => handleCustomStatesChange([...fips])}
                    className="px-2 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 border border-slate-600 text-left transition-colors"
                  >
                    {name} <span className="text-slate-400">({fips.length})</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Individual State Selection */}
            <div className="text-[10px] text-slate-400 font-semibold mb-1.5">Individual States:</div>
            <div className="grid grid-cols-3 gap-1">
              {ALL_US_STATES.map(state => {
                const isSelected = customStates.includes(state.fips)
                return (
                  <label 
                    key={state.fips} 
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleCustomStatesChange([...customStates, state.fips])
                        } else {
                          handleCustomStatesChange(customStates.filter(f => f !== state.fips))
                        }
                      }}
                      className="w-3 h-3"
                    />
                    <span className="flex-1">{state.abbr}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Tooltip */}
      <div id="sb-tip" className="absolute z-30 pointer-events-none rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1.5 text-[11px] shadow" style={{ display:'none', left:0, top:0 }} />
      
      {/* DeckGL Map */}
      <DeckGL
        layers={layers}
        viewState={viewState as any}
        controller={true}
        onViewStateChange={(v:any)=> setViewState(v.viewState)}
        getCursor={({ isDragging }:any)=> (isDragging? 'grabbing' : 'default')}
        style={{ position:'absolute', inset:'0' }}
      />
    </div>
  )
}

export default SandboxMap3D
