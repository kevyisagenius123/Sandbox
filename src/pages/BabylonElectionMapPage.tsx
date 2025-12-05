/*
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { feature } from 'topojson-client'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { geoAlbersUsa, geoAlbers } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import earcut from 'earcut'
import statesTopology from 'us-atlas/states-10m.json'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import '@babylonjs/core/Culling/ray'
import type { Nullable } from '@babylonjs/core/types'
import { ALL_US_STATES } from '../constants/usStates'
import { getElectoralVotes } from '../constants/electoralVotes'
import { getMarginColor } from '../lib/election/colors'

const MAP_TARGET_WIDTH = 14
const RESULTS_CSV_PATH = 'data/2024_sandbox.csv'
const RACE_CALL_DEMO_FIPS = '26'

type Winner = 'dem' | 'rep'

type CoordinatePair = [number, number]
type CoordinateRing = CoordinatePair[]
type PolygonCoordinates = CoordinateRing[]

const toPolygonList = (geometry: Polygon | MultiPolygon): PolygonCoordinates[] => {
  if (geometry.type === 'Polygon') {
    import React, { useEffect, useMemo, useState } from 'react'
    import Papa from 'papaparse'
    import SandboxMap3D from '../components/map/SandboxMap3D'
    import SandboxMapBabylon from '../components/map/SandboxMapBabylon'
    import type { CountyResult, CountyResultCSV, CountySimulationState } from '../types/sandbox'
    import { ALL_US_STATES } from '../constants/usStates'

    const RESULTS_CSV_PATH = 'data/2024_sandbox.csv'

    const resolveStaticAsset = (path: string): string => {
      const base = (import.meta as any)?.env?.BASE_URL ?? '/'
      const normalizedBase = typeof base === 'string' ? base.replace(/\/$/, '') : ''
      return `${normalizedBase}/${path.replace(/^\//, '')}`
    }

    const parseNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const cleaned = value.trim().replace(/,/g, '')
        const parsed = Number(cleaned)
        if (Number.isFinite(parsed)) return parsed
      }
      return 0
    }

    const normalizeCountyRow = (row: CountyResultCSV): CountyResult | null => {
      const rawFips = row.fips?.toString().padStart(5, '0')
      if (!rawFips || rawFips.length !== 5) {
        return null
      }

      const stateFips = rawFips.slice(0, 2)
      const stateMeta = ALL_US_STATES.find(state => state.fips === stateFips)

      const gop = parseNumber(row.gop_votes ?? row.rep_votes ?? row.republican_votes ?? row.votes_gop ?? row.votes_rep)
      const dem = parseNumber(row.dem_votes)
      const other = parseNumber(row.other_votes)
      const total = parseNumber(row.total_votes) || gop + dem + other
      const reportingPercent = parseNumber(row.reporting_percent ?? 100)

      const normalizedState = row.state?.toString().trim().toUpperCase() || stateMeta?.abbr || stateMeta?.name || ''

      return {
        fips: rawFips,
        state: normalizedState,
        county: row.county?.toString().trim() || 'County',
        gopVotes: gop,
        demVotes: dem,
        otherVotes: other,
        totalVotes: total,
        reportingPercent
      }
    }

    const buildCountyStates = (counties: CountyResult[]): Map<string, CountySimulationState> => {
      const result = new Map<string, CountySimulationState>()
      counties.forEach(county => {
        const paddedFips = county.fips.padStart(5, '0')
        result.set(paddedFips, {
          fips: paddedFips,
          currentReportingPercent: county.reportingPercent,
          currentDemVotes: county.demVotes,
          currentGopVotes: county.gopVotes,
          currentOtherVotes: county.otherVotes,
          currentTotalVotes: county.totalVotes,
          lastUpdateTime: 0,
          isFullyReported: county.reportingPercent >= 100
        })
      })
      return result
    }

    const formatNumber = (value: number): string => {
      if (!Number.isFinite(value)) return '—'
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return value.toLocaleString()
    }

    const formatPercent = (value: number): string => `${value.toFixed(1)}%`

    const lookupStateLabel = (fips: string): string => {
      const match = ALL_US_STATES.find(state => state.fips === fips)
      return match ? `${match.name} (${match.abbr})` : fips
    }

    type MapDisplayMode = 'THREE' | 'BABYLON' | 'DUAL'
    type ScopeMode = 'ALL' | 'CUSTOM'

    const BabylonElectionMapPage: React.FC = () => {
      const [countyResults, setCountyResults] = useState<CountyResult[]>([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<string | null>(null)
      const [mapMode, setMapMode] = useState<MapDisplayMode>('DUAL')
      const [selectedStates, setSelectedStates] = useState<string[]>([])
      const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null)
      const [scope, setScope] = useState<ScopeMode>('ALL')
      const [customStatesInput, setCustomStatesInput] = useState('06,12,26,36,42')
      const [opacity, setOpacity] = useState(0.92)

      useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        Papa.parse<CountyResultCSV>(resolveStaticAsset(RESULTS_CSV_PATH), {
          import React, { useEffect, useMemo, useState } from 'react'

      const handleScopeChange = (next: ScopeMode) => {
        setScope(next)
      }

      const handleCustomStatesChange = (states: string[]) => {
        setCustomStatesInput(states.join(','))
      }

      const shouldShowThree = mapMode === 'THREE' || mapMode === 'DUAL'
      const shouldShowBabylon = mapMode === 'BABYLON' || mapMode === 'DUAL'
      const layoutClass = shouldShowThree && shouldShowBabylon ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'grid grid-cols-1 gap-4'

      const statesWithData = useMemo(() => {
        const unique = new Set<string>()
        countyResults.forEach(county => unique.add(county.fips.slice(0, 2)))
        return Array.from(unique).sort()
      }, [countyResults])

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Parity test stage</p>
              <h1 className="text-3xl font-semibold text-white">Babylon.js vs Three.js election map</h1>
              <p className="max-w-3xl text-sm text-slate-300">
                This page feeds the exact same county-level dataset into both the reference Deck.gl/Three.js map and the Babylon.js map.
                Toggle map modes, adjust state scope, and click states/counties to verify feature parity without affecting the main studio experience.
              </p>
            </header>

            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {(['THREE', 'BABYLON', 'DUAL'] as MapDisplayMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMapMode(mode)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${mapMode === mode ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {mode === 'THREE' ? 'Three.js only' : mode === 'BABYLON' ? 'Babylon only' : 'Dual view'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-2 text-slate-300">
                  Scope
                  <select
                    value={scope}
                    onChange={event => handleScopeChange(event.target.value as ScopeMode)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="ALL">States with data</option>
                    <option value="CUSTOM">Custom FIPS list</option>
                  </select>
                </label>
                {scope === 'CUSTOM' && (
                  <label className="flex items-center gap-2 text-slate-300">
                    Custom states
                    <input
                      value={customStatesInput}
                      onChange={event => setCustomStatesInput(event.target.value)}
                      className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      placeholder="06,12,26"
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 text-slate-300">
                  Opacity
                  <input
                    type="range"
                    min="0.4"
                    max="1"
                    step="0.02"
                    import React, { useEffect, useMemo, useState } from 'react'
                  </div>
                )}

                {shouldShowBabylon && (
                  <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
                    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.4em] text-slate-300">
                      Babylon.js parity candidate
                    </div>
                    <SandboxMapBabylon
                      countyResults={countyResults}
                      countyStates={countyStates}
                      onCountyClick={handleCountyClick}
                      editedCounties={editedCounties}
                      opacity={opacity}
                      selectedStates={selectedStates}
                      onStateSelect={handleStateSelect}
                    />
                  </div>
                )}
              </div>
            )}

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Selected county</h2>
                {selectedCounty ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-2xl font-semibold text-white">{selectedCounty.county}</p>
                    <p className="text-slate-300">FIPS {selectedCounty.fips} · State {lookupStateLabel(selectedCounty.fips.slice(0, 2))}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                        DEM {formatNumber(selectedCounty.demVotes)}
                      </div>
                      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                        GOP {formatNumber(selectedCounty.gopVotes)}
                      </div>
                      <div className="rounded-2xl border border-slate-500/30 bg-slate-500/10 px-3 py-2">
                        Other {formatNumber(selectedCounty.otherVotes)}
                      </div>
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                        Total {formatNumber(selectedCounty.totalVotes)}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Reporting {formatPercent(selectedCounty.reportingPercent)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Click any county on either map to inspect vote breakdowns.</p>
                )}
              </div>

              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">State selection</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedStates([])}
                    className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 hover:text-white"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto text-sm">
                  {(selectedStates.length ? selectedStates : statesWithData).map(fips => (
                    <div key={fips} className={`rounded-2xl border px-3 py-2 ${selectedStates.includes(fips) ? 'border-sky-500/40 bg-sky-500/10 text-sky-100' : 'border-slate-700/60 bg-slate-800/40 text-slate-200'}`}>
                      {lookupStateLabel(fips)}
                    </div>
                  ))}
                  {selectedStates.length === 0 && (
                    <p className="text-xs text-slate-400">No states selected yet—click a state on either map to drill down into its counties.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )
    }

    export default BabylonElectionMapPage

    const countyGeoJson = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>
    const { projection, puertoRicoProjection, normalizeProjectedPoint } = normalization

    const projectCoordinate = (lon: number, lat: number, stateFips: string) => {
      const base = projection([lon, lat])
      if (base) return base
      if (stateFips === '72') {
        return puertoRicoProjection([lon, lat])
      }
      return null
    }

    const normalizeRing = (ring: CoordinateRing, stateFips: string): Vector2[] =>
      ring
        .map(([lon, lat]) => {
          const projected = projectCoordinate(lon, lat, stateFips)
          return projected ? normalizeProjectedPoint(projected as [number, number]) : null
        })
        .filter((point): point is Vector2 => point !== null)

    countyGeoJson.features.forEach(featureEntry => {
      if (!featureEntry.geometry || !featureEntry.properties) return
      const countyFips = featureEntry.properties.GEO_ID?.slice(-5) ?? featureEntry.properties.GEOID
      if (!countyFips || countyFips.length !== 5) return
      const stateFips = countyFips.slice(0, 2)
      const polygons = toPolygonList(featureEntry.geometry)

      const preparedPolygons: PreparedPolygon[] = polygons
        .map(polygon => {
          const [outer, ...holes] = polygon
          if (!outer?.length) return null

          const normalizedOuter = normalizeRing(outer, stateFips)
          if (normalizedOuter.length >= 3) {
            normalizedOuter.reverse()
          }
          const validOuter = normalizedOuter.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
          if (validOuter.length < 3) return null

          const normalizedHoles = holes
            .map(hole => normalizeRing(hole, stateFips).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)))
            .filter(hole => hole.length >= 3)

          return { outer: validOuter, holes: normalizedHoles }
        })
        .filter((poly): poly is PreparedPolygon => Boolean(poly))

      if (!preparedPolygons.length) {
        return
      }

      const entry: PreparedCountyShape = { countyFips, stateFips, polygons: preparedPolygons }
      const list = countyShapesByState.get(stateFips)
      if (list) list.push(entry)
      else countyShapesByState.set(stateFips, [entry])
    })
  } catch (error) {
    console.error('Failed to load county GeoJSON', error)
  }

  return countyShapesByState
}

const aggregateResults = (rows: CountyCsvRow[]) => {
  const stateTotals = new Map<string, { dem: number; rep: number; total: number }>()
  const countyTotals = new Map<string, { dem: number; rep: number; total: number; name: string; stateFips: string }>()
  const maxCountyTotalsByState = new Map<string, number>()

  rows.forEach(row => {
    const fipsRaw = row.fips?.toString().trim()
    if (!fipsRaw) return
    const countyFips = fipsRaw.padStart(5, '0')
    if (countyFips.length !== 5) return
    const stateFips = countyFips.slice(0, 2)
    const dem = parseVoteNumber(row.dem_votes)
    const rep = parseVoteNumber(row.rep_votes ?? row.gop_votes)
    const total = Math.max(parseVoteNumber(row.total_votes), dem + rep + parseVoteNumber(row.other_votes))
    if (total <= 0) return

    const stateEntry = stateTotals.get(stateFips) ?? { dem: 0, rep: 0, total: 0 }
    stateEntry.dem += dem
    stateEntry.rep += rep
    stateEntry.total += total
    stateTotals.set(stateFips, stateEntry)

    countyTotals.set(countyFips, { dem, rep, total, name: row.county?.toString() ?? 'County', stateFips })
    const currentMax = maxCountyTotalsByState.get(stateFips) ?? 0
    if (total > currentMax) maxCountyTotalsByState.set(stateFips, total)
  })

  const stateResults: StateResult[] = ALL_US_STATES.map(state => {
    const totals = stateTotals.get(state.fips)
    if (!totals || totals.total <= 0) {
      const ev = getElectoralVotes(state.abbr)
      return {
        fips: state.fips,
        abbr: state.abbr,
        name: state.name,
        winner: 'rep',
        margin: 0,
        voteShareDem: 0,
        voteShareRep: 0,
        totalVotes: 0,
        ev,
      }
    }

    const diff = totals.dem - totals.rep
    const marginPct = Math.abs((diff / totals.total) * 100)
    const winner: Winner = diff >= 0 ? 'dem' : 'rep'
    const voteShareDem = Math.round((totals.dem / totals.total) * 1000) / 10
    const voteShareRep = Math.round((totals.rep / totals.total) * 1000) / 10
    const ev = getElectoralVotes(state.abbr)

    return {
      fips: state.fips,
      abbr: state.abbr,
      name: state.name,
      winner,
      margin: Math.round(marginPct * 10) / 10,
      voteShareDem: Math.round(voteShareDem * 10) / 10,
      voteShareRep: Math.round(voteShareRep * 10) / 10,
      totalVotes: totals.total,
      ev,
    }
  })

  const countyResults = new Map<string, CountyResult>()

  countyTotals.forEach((entry, countyFips) => {
    const diff = entry.dem - entry.rep
    const winner: Winner = diff >= 0 ? 'dem' : 'rep'
    const marginPct = Math.abs((diff / entry.total) * 100)
    const voteShareDem = Math.round((entry.dem / entry.total) * 1000) / 10
    const voteShareRep = Math.round((entry.rep / entry.total) * 1000) / 10
    const maxStateTotal = maxCountyTotalsByState.get(entry.stateFips) ?? entry.total
    const turnoutRatio = maxStateTotal > 0 ? entry.total / maxStateTotal : 0

    const county: CountyResult = {
      countyFips,
      stateFips: entry.stateFips,
      name: entry.name,
      winner,
      marginPct: Math.round(marginPct * 10) / 10,
      voteShareDem,
      voteShareRep,
      turnoutRatio,
      totalVotes: entry.total,
    }

    countyResults.set(countyFips, county)
  })

  return { stateResults, countyResults }
}

const formatNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

const BabylonElectionMapPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const barUpdaterRef = useRef<(county: CountyResult | null) => void>(() => {})

  const { stateShapes, normalization } = useMemo(() => prepareStateGeometry(), [])

  const [countyShapesByState, setCountyShapesByState] = useState<Map<string, PreparedCountyShape[]>>(new Map())
  const [stateResults, setStateResults] = useState<StateResult[]>([])
  const [countyResults, setCountyResults] = useState<Map<string, CountyResult>>(new Map())
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const focusStateResult = useMemo(() => stateResults.find(state => state.fips === FOCUS_STATE_FIPS) ?? null, [stateResults])
  const selectedCounty = useMemo(() => (selectedCountyFips ? countyResults.get(selectedCountyFips) ?? null : null), [selectedCountyFips, countyResults])

  useEffect(() => {
    prepareCountyGeometry(normalization).then(setCountyShapesByState)
  }, [normalization])

  useEffect(() => {
    let cancelled = false
    setLoadingData(true)
    setDataError(null)

    Papa.parse<CountyCsvRow>(resolveStaticAsset(RESULTS_CSV_PATH), {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data }) => {
        if (cancelled) return
        const rows = data.filter(row => row.fips)
        const { stateResults, countyResults } = aggregateResults(rows)
        setStateResults(stateResults)
        setCountyResults(countyResults)
        setLoadingData(false)
      },
      error: err => {
        if (cancelled) return
        setDataError(err.message ?? 'Unable to load 2024 results CSV.')
        setLoadingData(false)
      },
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedCountyFips || countyResults.size === 0) return
    const focusCounties = Array.from(countyResults.values()).filter(county => county.stateFips === FOCUS_STATE_FIPS)
    if (!focusCounties.length) return
    focusCounties.sort((a, b) => b.totalVotes - a.totalVotes)
    setSelectedCountyFips(focusCounties[0].countyFips)
  }, [countyResults, selectedCountyFips])

  useEffect(() => {
    const canvas = canvasRef.current
    const focusStateShape = stateShapes.find(shape => shape.fips === FOCUS_STATE_FIPS)
    const countyShapes = countyShapesByState.get(FOCUS_STATE_FIPS)
    if (!canvas || !focusStateShape || !countyShapes?.length || !countyResults.size || !focusStateResult) {
      return
    }

    const engine = new Engine(canvas, true, { antialias: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(3 / 255, 8 / 255, 18 / 255, 1)

    const camera = new ArcRotateCamera('camera', Math.PI / 1.8, Math.PI / 2.4, 11, new Vector3(0, 1.6, 0), scene)
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 16
    camera.wheelPrecision = 45
    camera.pinchPrecision = 60
    camera.attachControl(canvas, true)

    const light = new HemisphericLight('light', new Vector3(-0.4, 1, -0.25), scene)
    light.intensity = 1.15

    const stage = MeshBuilder.CreateGround('stage', { width: 16, height: 9 }, scene)
    const stageMat = new StandardMaterial('stage-mat', scene)
    stageMat.diffuseColor = new Color3(0.04, 0.07, 0.14)
    stageMat.specularColor = new Color3(0.2, 0.2, 0.35)
    stageMat.emissiveColor = new Color3(0.01, 0.02, 0.06)
    stage.material = stageMat

  const mapRoot = new TransformNode('map-root', scene)
  mapRoot.position = new Vector3(1.4, 0.02, 0.25)
  mapRoot.rotation = new Vector3(0, -Math.PI / 14, 0)

    const countyMeshes: Mesh[] = []
    const hoveredColor = Color3.White()
    let hoveredMesh: Nullable<Mesh> = null

    const createCountyMaterial = (county: CountyResult) => {
      const colorHex = getMarginColor(county.marginPct, county.winner === 'dem' ? 'DEM' : 'GOP')
      const color = Color3.FromHexString(colorHex)
      const material = new StandardMaterial(`county-${county.countyFips}-mat`, scene)
      material.diffuseColor = color
      material.emissiveColor = color.scale(0.4)
      material.specularColor = Color3.Black()
      material.alpha = 0.95
      return material
    }

  const COUNTY_BASE_OFFSET = 0.15

    countyShapes.forEach(countyShape => {
      const outcome = countyResults.get(countyShape.countyFips)
      if (!outcome) return

      countyShape.polygons.forEach((polygon, polygonIndex) => {
        if (!polygon.outer.length) return
        const builder = new PolygonMeshBuilder(`county-${countyShape.countyFips}-${polygonIndex}`, polygon.outer, scene, earcut)
        polygon.holes.forEach(hole => builder.addHole(hole))

        const turnoutLift = Math.min(outcome.turnoutRatio, 1) * 0.7
        const competitivenessLift = 1 - Math.min(Math.abs(outcome.marginPct) / 40, 1)
        const height = 0.1 + turnoutLift * 0.6 + competitivenessLift * 0.3

  const mesh = builder.build(false, height)
  mesh.parent = mapRoot
  mesh.position.y = COUNTY_BASE_OFFSET + height / 2
        mesh.isPickable = true
        mesh.material = createCountyMaterial(outcome)
        mesh.metadata = { countyFips: outcome.countyFips }
        countyMeshes.push(mesh)
      })
    })

    const createPanel = (
      name: string,
      width: number,
      height: number,
      draw: (ctx: CanvasRenderingContext2D, dims: { width: number; height: number }) => void
    ) => {
      const texture = new DynamicTexture(`${name}-texture`, { width: 1024, height: 512 }, scene, true)
      texture.hasAlpha = true
      const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
      draw(ctx, texture.getSize())
      texture.update()

      const material = new StandardMaterial(`${name}-mat`, scene)
      material.diffuseTexture = texture
      material.opacityTexture = texture
      material.specularColor = Color3.Black()
      material.emissiveColor = Color3.White()
      material.backFaceCulling = false

      const plane = MeshBuilder.CreatePlane(name, { width, height }, scene)
      plane.material = material
      plane.billboardMode = Mesh.BILLBOARDMODE_NONE
      return { plane, texture }
    }

    const analyticsRoot = new TransformNode('analytics-root', scene)
    analyticsRoot.position = new Vector3(3.6, 0, -0.2)
    analyticsRoot.rotation = new Vector3(0, Math.PI / 9, 0)

    const analyticsBase = MeshBuilder.CreateBox('analytics-base', { width: 5, depth: 2.2, height: 0.08 }, scene)
    analyticsBase.parent = analyticsRoot
    analyticsBase.position.y = 0.04
    const analyticsMat = new StandardMaterial('analytics-mat', scene)
    analyticsMat.diffuseColor = new Color3(0.05, 0.07, 0.13)
    analyticsMat.emissiveColor = new Color3(0.03, 0.04, 0.08)
    analyticsBase.material = analyticsMat

    const { plane: countyInfoPlane, texture: countyInfoTexture } = createPanel('county-info', 4.6, 1.1, () => {})
    countyInfoPlane.parent = analyticsRoot
    countyInfoPlane.position = new Vector3(0, 1, 0.35)

    type BarKey = 'dem' | 'gop' | 'other'

    const barRoot = new TransformNode('county-bars-root', scene)
    barRoot.parent = analyticsRoot
    barRoot.position = new Vector3(0, 0.05, -0.4)

  const barHandles = {} as Record<BarKey, { mesh: Mesh; labelTexture: DynamicTexture }>
  const BAR_KEYS: BarKey[] = ['dem', 'gop', 'other']
    const barConfigs = [
      { key: 'dem', label: 'DEM', color: '#38bdf8', offset: -1.1 },
      { key: 'gop', label: 'GOP', color: '#f87171', offset: 0 },
      { key: 'other', label: 'OTH', color: '#94a3b8', offset: 1.1 },
    ] as const

    barConfigs.forEach(config => {
      const bar = MeshBuilder.CreateBox(`county-bar-${config.key}`, { width: 0.6, height: 1, depth: 0.6 }, scene)
      bar.parent = barRoot
      bar.position = new Vector3(config.offset, 0.5, 0)
      const mat = new StandardMaterial(`county-bar-${config.key}-mat`, scene)
      const color = Color3.FromHexString(config.color)
      mat.diffuseColor = color
      mat.emissiveColor = color.scale(0.55)
      mat.specularColor = color.scale(0.3)
      bar.material = mat

      const { plane, texture } = createPanel(`county-bar-label-${config.key}`, 0.9, 0.55, () => {})
      plane.parent = bar
      plane.position = new Vector3(0, 0.7, 0)
      barHandles[config.key as BarKey] = { mesh: bar, labelTexture: texture }
    })

    const updateCountyVisuals = (county: CountyResult | null) => {
      const ctx = countyInfoTexture.getContext()
      const dims = countyInfoTexture.getSize()
      ctx.clearRect(0, 0, dims.width, dims.height)
      ctx.fillStyle = 'rgba(6,10,24,0.95)'
      ctx.fillRect(0, 0, dims.width, dims.height)
      ctx.font = '600 120px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(county ? county.name : 'Select a county', 60, 150)

      if (county) {
        ctx.font = '500 80px "Inter", "Segoe UI", sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(`${formatNumber(county.totalVotes)} votes reported`, 60, 260)
        ctx.fillText(`${county.marginPct.toFixed(1)} pt margin`, 60, 360)
      }
      countyInfoTexture.update()

      const shares: Record<BarKey, number> = county
        ? {
            dem: county.voteShareDem,
            gop: county.voteShareRep,
            other: Math.max(0, 100 - county.voteShareDem - county.voteShareRep),
          }
        : { dem: 0, gop: 0, other: 0 }

      BAR_KEYS.forEach(key => {
        const handle = barHandles[key]
        const value = shares[key]
        const height = county ? Math.max(0.15, (value / 100) * 2.6) : 0.15
        handle.mesh.scaling.y = height
        handle.mesh.position.y = height / 2

        const labelCtx = handle.labelTexture.getContext()
        const labelDims = handle.labelTexture.getSize()
        labelCtx.clearRect(0, 0, labelDims.width, labelDims.height)
        labelCtx.fillStyle = 'rgba(10,16,32,0.95)'
        labelCtx.fillRect(0, 0, labelDims.width, labelDims.height)
        labelCtx.font = '700 160px "Inter", "Segoe UI", sans-serif'
        labelCtx.fillStyle = '#f8fafc'
        labelCtx.fillText(`${value.toFixed(1)}%`, 40, 210)
        labelCtx.font = '600 120px "Inter", "Segoe UI", sans-serif'
        labelCtx.fillStyle = '#94a3b8'
        labelCtx.fillText(barConfigs.find(cfg => cfg.key === key)?.label ?? key.toUpperCase(), 40, 360)
        handle.labelTexture.update()
      })
    }

  barUpdaterRef.current = updateCountyVisuals
  updateCountyVisuals(null)

  const callRoot = new TransformNode('call-root', scene)
  callRoot.position = new Vector3(-0.6, 2.1, -0.1)
  callRoot.rotation = new Vector3(-Math.PI / 26, -Math.PI / 10, 0)

    const basePlinth = MeshBuilder.CreateBox('call-base-plinth', { width: 6, depth: 1.6, height: 0.2 }, scene)
    basePlinth.parent = callRoot
    basePlinth.position = new Vector3(0, -1.05, 0.15)
    const plinthMat = new StandardMaterial('call-base-plinth-mat', scene)
    plinthMat.diffuseColor = new Color3(0.02, 0.04, 0.08)
    plinthMat.specularColor = new Color3(0.05, 0.08, 0.16)
    plinthMat.emissiveColor = new Color3(0.01, 0.02, 0.05)
    basePlinth.material = plinthMat

    const plinthAccent = MeshBuilder.CreateBox('call-base-accent', { width: 6, depth: 1.6, height: 0.04 }, scene)
    plinthAccent.parent = callRoot
    plinthAccent.position = new Vector3(0, -0.93, 0.2)
    const accentMat = new StandardMaterial('call-base-accent-mat', scene)
    const accentColor = Color3.FromHexString('#0ea5e9')
    accentMat.diffuseColor = accentColor.scale(0.4)
    accentMat.emissiveColor = accentColor.scale(0.8)
    accentMat.alpha = 0.95
    plinthAccent.material = accentMat

    const strutMaterial = new StandardMaterial('call-strut-mat', scene)
    strutMaterial.diffuseColor = new Color3(0.08, 0.12, 0.2)
    strutMaterial.emissiveColor = new Color3(0.03, 0.05, 0.1)

    const createStrut = (name: string, x: number) => {
      const strut = MeshBuilder.CreateCylinder(name, { height: 1.7, diameterTop: 0.18, diameterBottom: 0.26, tessellation: 16 }, scene)
      strut.parent = callRoot
      strut.position = new Vector3(x, -0.25, -0.05)
      strut.material = strutMaterial
      return strut
    }

    createStrut('call-strut-left', -2.5)
    createStrut('call-strut-right', 2.5)

    const cantilever = MeshBuilder.CreateBox('call-cantilever', { width: 5.8, height: 0.22, depth: 0.5 }, scene)
    cantilever.parent = callRoot
    cantilever.position = new Vector3(0, 0.15, -0.08)
    const cantileverMat = new StandardMaterial('call-cantilever-mat', scene)
    cantileverMat.diffuseColor = new Color3(0.05, 0.09, 0.17)
    cantileverMat.emissiveColor = new Color3(0.02, 0.03, 0.07)
    cantilever.material = cantileverMat

    const frameShell = MeshBuilder.CreateBox('call-frame-shell', { width: 5.1, height: 1.7, depth: 0.25 }, scene)
    frameShell.parent = callRoot
    frameShell.position = new Vector3(0, 0.65, -0.08)
    const frameMat = new StandardMaterial('call-frame-mat', scene)
    frameMat.diffuseColor = new Color3(0.08, 0.13, 0.26)
    frameMat.emissiveColor = new Color3(0.03, 0.05, 0.11)
    frameMat.specularColor = new Color3(0.2, 0.25, 0.35)
    frameShell.material = frameMat

    const innerGlass = MeshBuilder.CreateBox('call-inner-glass', { width: 4.8, height: 1.45, depth: 0.06 }, scene)
    innerGlass.parent = callRoot
    innerGlass.position = new Vector3(0, 0.66, 0)
    const glassMat = new StandardMaterial('call-glass-mat', scene)
    glassMat.diffuseColor = new Color3(0.02, 0.05, 0.12)
    glassMat.emissiveColor = new Color3(0.01, 0.02, 0.05)
    glassMat.alpha = 0.92
    innerGlass.material = glassMat

    const edgeStrip = MeshBuilder.CreateBox('call-edge-strip', { width: 5.2, height: 0.08, depth: 0.12 }, scene)
    edgeStrip.parent = callRoot
    edgeStrip.position = new Vector3(0, 1.08, 0.05)
    const stripMat = new StandardMaterial('call-strip-mat', scene)
    const stripColor = Color3.FromHexString('#38bdf8')
    stripMat.diffuseColor = stripColor.scale(0.7)
    stripMat.emissiveColor = stripColor
    stripMat.alpha = 0.85
    edgeStrip.material = stripMat

    const canopy = MeshBuilder.CreateBox('call-canopy', { width: 4.6, height: 0.2, depth: 0.5 }, scene)
    canopy.parent = callRoot
    canopy.position = new Vector3(0, 1.25, 0.12)
    canopy.rotation = new Vector3(-Math.PI / 16, 0, 0)
    const canopyMat = new StandardMaterial('call-canopy-mat', scene)
    canopyMat.diffuseColor = new Color3(0.05, 0.08, 0.16)
    canopyMat.emissiveColor = new Color3(0.02, 0.03, 0.06)
    canopy.material = canopyMat

    const { plane: callPanel } = createPanel('call-panel', 4.55, 1.35, (ctx, { width, height }) => {
      ctx.clearRect(0, 0, width, height)

      const accent = focusStateResult.winner === 'dem' ? '#38bdf8' : '#f87171'
      const baseLeft = focusStateResult.winner === 'dem' ? '#0f172a' : '#450a0a'
      const baseMid = focusStateResult.winner === 'dem' ? '#1d4ed8' : '#991b1b'
      const baseRight = '#0b1120'

      const leftWidth = width * 0.43
      const centerWidth = width * 0.24
      const gap = 24
      const rightWidth = width - leftWidth - centerWidth - gap * 2

      const leftGradient = ctx.createLinearGradient(0, 0, leftWidth, height)
      leftGradient.addColorStop(0, focusStateResult.winner === 'dem' ? '#0c4a6e' : '#7f1d1d')
      leftGradient.addColorStop(1, focusStateResult.winner === 'dem' ? '#1d4ed8' : '#ef4444')
      ctx.fillStyle = leftGradient
      ctx.fillRect(0, 0, leftWidth, height)

      ctx.fillStyle = '#f8fafc'
      ctx.font = '800 140px "Inter", "Segoe UI", sans-serif'
      const stateLines = FOCUS_STATE_NAME.split(' ')
      stateLines.forEach((line, index) => {
        ctx.fillText(line.toUpperCase(), 70, 190 + index * 140)
      })

      ctx.font = '600 70px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(248,250,252,0.9)'
      ctx.fillText('RACE PROJECTION', 70, 80)

      ctx.font = '600 60px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(241,245,249,0.85)'
      ctx.fillText(`EV ${focusStateResult.ev}`, 70, 440)

      ctx.font = '500 60px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(241,245,249,0.75)'
      ctx.fillText(`Margin ${focusStateResult.margin.toFixed(1)} pts`, 70, 520)

      const centerX = leftWidth + gap
      ctx.fillStyle = baseMid
      ctx.fillRect(centerX, 0, centerWidth, height)
      ctx.fillStyle = '#0b0f1a'
      ctx.fillRect(centerX + 30, 80, centerWidth - 60, height - 160)
      ctx.fillStyle = 'rgba(15,23,42,0.95)'
      ctx.fillRect(centerX + 45, 95, centerWidth - 90, height - 190)
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(centerX + 55, 110, centerWidth - 110, height - 220)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(centerX + centerWidth / 2 - 50, 90, 100, 20)
      ctx.fillStyle = '#f8fafc'
      ctx.textAlign = 'center'
      ctx.font = '700 100px "Inter", "Segoe UI", sans-serif'
      ctx.fillText(focusStateResult.winner === 'dem' ? 'DEM' : 'GOP', centerX + centerWidth / 2, height / 2)
      ctx.textAlign = 'left'

      const rightX = centerX + centerWidth + gap
      ctx.fillStyle = baseRight
      ctx.fillRect(rightX, 0, rightWidth, height)

      ctx.fillStyle = 'rgba(248,250,252,0.8)'
      ctx.font = '600 60px "Inter", "Segoe UI", sans-serif'
      ctx.fillText('PROJECTED WINNER', rightX + 40, 90)

      ctx.font = '800 110px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = accent
      ctx.fillText(focusStateResult.winner === 'dem' ? 'DEMOCRATS' : 'REPUBLICANS', rightX + 40, 200)

      ctx.font = '500 60px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = '#cbd5f5'
      ctx.fillText(`${focusStateResult.voteShareDem.toFixed(1)}% D`, rightX + 40, 300)
      ctx.fillText(`${focusStateResult.voteShareRep.toFixed(1)}% R`, rightX + 40, 370)

      ctx.font = '600 70px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = '#f8fafc'
      ctx.fillText(`${focusStateResult.margin.toFixed(1)} pt edge`, rightX + 40, 470)

      ctx.font = '500 56px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(148,163,184,0.9)'
      ctx.fillText(`${formatNumber(focusStateResult.totalVotes)} votes`, rightX + 40, 540)

      ctx.fillStyle = accent
      ctx.fillRect(rightX + 40, height - 110, rightWidth - 80, 70)
      ctx.font = '700 60px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = '#0b1120'
      ctx.textAlign = 'center'
      ctx.fillText('CALL CONFIRMED', rightX + rightWidth / 2, height - 60)
      ctx.textAlign = 'left'
    })
  callPanel.parent = callRoot
  callPanel.position = new Vector3(0, 0.66, 0.12)
  callPanel.rotation = new Vector3(0, Math.PI, 0)

    scene.onPointerDown = (_evt, pickResult) => {
      const countyFips = pickResult.pickedMesh?.metadata?.countyFips
      if (countyFips) {
        setSelectedCountyFips(countyFips)
      }
    }

    scene.onPointerMove = (_evt, pickResult) => {
      if (pickResult.hit && pickResult.pickedMesh?.metadata?.countyFips) {
        if (hoveredMesh && hoveredMesh !== pickResult.pickedMesh) {
          hoveredMesh.renderOutline = false
        }
        hoveredMesh = pickResult.pickedMesh as Mesh
        hoveredMesh.renderOutline = true
        hoveredMesh.outlineColor = hoveredColor
        hoveredMesh.outlineWidth = 0.02
      } else if (hoveredMesh) {
        hoveredMesh.renderOutline = false
        hoveredMesh = null
      }
    }

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scene.onPointerDown = undefined
      scene.onPointerMove = undefined
      hoveredMesh = null
      countyMeshes.forEach(mesh => mesh.dispose())
      scene.dispose()
      engine.dispose()
    }
  }, [stateShapes, countyShapesByState, countyResults, focusStateResult])

  useEffect(() => {
    const updater = barUpdaterRef.current
    const county = selectedCountyFips ? countyResults.get(selectedCountyFips) ?? null : null
    updater(county)
  }, [selectedCountyFips, countyResults])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative h-screen w-screen">
        <canvas ref={canvasRef} className="h-full w-full bg-slate-950" />
        <div className="pointer-events-none absolute left-6 top-6 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">VizOps Babylon Studio</p>
          <p className="text-lg font-semibold text-white">California decision desk</p>
        </div>
        {focusStateResult && (
          <div className="pointer-events-none absolute right-6 top-6 flex max-w-xs flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">State call</p>
            <p className="text-lg font-semibold text-white">{FOCUS_STATE_NAME}</p>
            <p className="text-slate-300">{focusStateResult.margin.toFixed(1)} pt lead · {focusStateResult.ev} EV</p>
            <p className="text-sky-300 font-semibold">DEM {focusStateResult.voteShareDem.toFixed(1)}%</p>
            <p className="text-rose-300 font-semibold">GOP {focusStateResult.voteShareRep.toFixed(1)}%</p>
            <p className="text-slate-400">Total votes {formatNumber(focusStateResult.totalVotes)}</p>
          </div>
        )}
        {selectedCounty && (
          <div className="pointer-events-none absolute left-6 bottom-6 flex max-w-sm flex-col gap-2 rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4 text-sm shadow-[0_20px_60px_rgba(2,6,23,0.65)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-slate-400">County focus</p>
            <p className="text-2xl font-bold text-white">{selectedCounty.name}</p>
            <p className="text-slate-300">{formatNumber(selectedCounty.totalVotes)} votes</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 px-2 py-2 text-sky-100">
                DEM {selectedCounty.voteShareDem.toFixed(1)}%
              </div>
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-2 py-2 text-rose-100">
                GOP {selectedCounty.voteShareRep.toFixed(1)}%
              </div>
              <div className="rounded-2xl border border-slate-500/40 bg-slate-500/10 px-2 py-2 text-slate-200">
                Margin {selectedCounty.marginPct.toFixed(1)}
              </div>
            </div>
          </div>
        )}
        {loadingData && (
          <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-xl border border-slate-800 bg-slate-900/75 px-4 py-2 text-sm text-slate-200">
            Loading 2024 sandbox CSV…
          </div>
        )}
        {dataError && (
          <div className="pointer-events-auto absolute left-1/2 top-6 -translate-x-1/2 rounded-xl border border-rose-700/50 bg-rose-900/40 px-4 py-2 text-sm text-rose-100">
            {dataError}
          </div>
        )}
      </div>
    </div>
  )
}

export default BabylonElectionMapPage
*/

import React, { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import SandboxMap3D from '../components/map/SandboxMap3D'
import SandboxMapBabylon from '../components/map/SandboxMapBabylon'
import type { CountyResult, CountyResultCSV, CountySimulationState } from '../types/sandbox'
import { ALL_US_STATES } from '../constants/usStates'

const RESULTS_CSV_PATH = 'data/2024_sandbox.csv'

const resolveStaticAsset = (path: string): string => {
  const base = (import.meta as any)?.env?.BASE_URL ?? '/'
  const normalizedBase = typeof base === 'string' ? base.replace(/\/$/, '') : ''
  return `${normalizedBase}/${path.replace(/^\//, '')}`
}

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '')
    const parsed = Number(cleaned)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const normalizeCountyRow = (row: CountyResultCSV): CountyResult | null => {
  const rawFips = row.fips?.toString().padStart(5, '0')
  if (!rawFips || rawFips.length !== 5) {
    return null
  }

  const stateFips = rawFips.slice(0, 2)
  const stateMeta = ALL_US_STATES.find(state => state.fips === stateFips)

  const gop = parseNumber(row.gop_votes ?? row.rep_votes ?? row.republican_votes ?? row.votes_gop ?? row.votes_rep)
  const dem = parseNumber(row.dem_votes)
  const other = parseNumber(row.other_votes)
  const total = parseNumber(row.total_votes) || gop + dem + other
  const reportingPercent = parseNumber(row.reporting_percent ?? 100)

  const normalizedState = row.state?.toString().trim().toUpperCase() || stateMeta?.abbr || stateMeta?.name || ''

  return {
    fips: rawFips,
    state: normalizedState,
    county: row.county?.toString().trim() || 'County',
    gopVotes: gop,
    demVotes: dem,
    otherVotes: other,
    totalVotes: total,
    reportingPercent,
  }
}

const buildCountyStates = (counties: CountyResult[]): Map<string, CountySimulationState> => {
  const result = new Map<string, CountySimulationState>()
  counties.forEach(county => {
    const paddedFips = county.fips.padStart(5, '0')
    result.set(paddedFips, {
      fips: paddedFips,
      currentReportingPercent: county.reportingPercent,
      currentDemVotes: county.demVotes,
      currentGopVotes: county.gopVotes,
      currentOtherVotes: county.otherVotes,
      currentTotalVotes: county.totalVotes,
      lastUpdateTime: 0,
      isFullyReported: county.reportingPercent >= 100,
    })
  })
  return result
}

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const lookupStateLabel = (fips: string): string => {
  const match = ALL_US_STATES.find(state => state.fips === fips)
  return match ? `${match.name} (${match.abbr})` : fips
}

type MapDisplayMode = 'THREE' | 'BABYLON' | 'DUAL'
type ScopeMode = 'ALL' | 'CUSTOM'

const BabylonElectionMapPage: React.FC = () => {
  const [countyResults, setCountyResults] = useState<CountyResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<MapDisplayMode>('DUAL')
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null)
  const [scope, setScope] = useState<ScopeMode>('ALL')
  const [customStatesInput, setCustomStatesInput] = useState('06,12,26,36,42')
  const [opacity, setOpacity] = useState(0.92)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Papa.parse<CountyResultCSV>(resolveStaticAsset(RESULTS_CSV_PATH), {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data }) => {
        if (cancelled) return
        const normalized = data
          .map(normalizeCountyRow)
          .filter((entry): entry is CountyResult => Boolean(entry))
        setCountyResults(normalized)
        setSelectedCountyFips(normalized[0]?.fips ?? null)
        setLoading(false)
      },
      error: err => {
        if (cancelled) return
        setError(err.message ?? 'Unable to load sandbox CSV.')
        setLoading(false)
      },
    })

    return () => {
      cancelled = true
    }
  }, [])

  const countyStates = useMemo(() => buildCountyStates(countyResults), [countyResults])
  const countyByFips = useMemo(() => new Map(countyResults.map(county => [county.fips, county])), [countyResults])
  const editedCounties = useMemo(() => new Set<string>(), [])
  const customStates = useMemo(
    () =>
      customStatesInput
        .split(',')
        .map(token => token.trim().padStart(2, '0'))
        .filter(token => token.length === 2),
    [customStatesInput]
  )

  const selectedCounty = selectedCountyFips ? countyByFips.get(selectedCountyFips) ?? null : null

  const handleCountyClick = (fips: string) => {
    const normalized = fips.padStart(5, '0')
    setSelectedCountyFips(normalized)
  }

  const handleStateSelect = (stateFips: string) => {
    setSelectedStates((previous) => {
      if (previous.includes(stateFips)) {
        return previous.filter((entry) => entry !== stateFips)
      }
      return [...previous, stateFips]
    })
  }

  // For Three.js SandboxMap3D which uses array-based selection
  const handleSelectedStatesChange = (states: string[]) => {
    setSelectedStates(states)
  }

  const handleScopeChange = (next: ScopeMode) => {
    setScope(next)
  }

  const handleCustomStatesChange = (states: string[]) => {
    setCustomStatesInput(states.join(','))
  }

  const shouldShowThree = mapMode === 'THREE' || mapMode === 'DUAL'
  const shouldShowBabylon = mapMode === 'BABYLON' || mapMode === 'DUAL'
  const layoutClass = shouldShowThree && shouldShowBabylon ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'grid grid-cols-1 gap-4'

  const statesWithData = useMemo(() => {
    const unique = new Set<string>()
    countyResults.forEach(county => unique.add(county.fips.slice(0, 2)))
    return Array.from(unique).sort()
  }, [countyResults])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Parity test stage</p>
          <h1 className="text-3xl font-semibold text-white">Babylon.js vs Three.js election map</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            This page feeds the exact same county-level dataset into both the reference Deck.gl/Three.js map and the Babylon.js map.
            Toggle map modes, adjust state scope, and click states/counties to verify feature parity without affecting the main studio experience.
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['THREE', 'BABYLON', 'DUAL'] as MapDisplayMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setMapMode(mode)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${mapMode === mode ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {mode === 'THREE' ? 'Three.js only' : mode === 'BABYLON' ? 'Babylon only' : 'Dual view'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-300">
              Scope
              <select
                value={scope}
                onChange={event => handleScopeChange(event.target.value as ScopeMode)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="ALL">States with data</option>
                <option value="CUSTOM">Custom FIPS list</option>
              </select>
            </label>
            {scope === 'CUSTOM' && (
              <label className="flex items-center gap-2 text-slate-300">
                Custom states
                <input
                  value={customStatesInput}
                  onChange={event => setCustomStatesInput(event.target.value)}
                  className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  placeholder="06,12,26"
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-slate-300">
              Opacity
              <input
                type="range"
                min="0.4"
                max="1"
                step="0.02"
                value={opacity}
                onChange={event => setOpacity(Number(event.target.value))}
                className="w-32"
              />
              <span className="w-10 text-right text-slate-100">{opacity.toFixed(2)}</span>
            </label>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center text-sm text-slate-300">
            Loading 2024 sandbox CSV…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-700/40 bg-rose-900/30 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {!loading && !error && countyResults.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center text-sm text-slate-300">
            No county results available in the CSV.
          </div>
        )}

        {!loading && !error && countyResults.length > 0 && (
          <div className={layoutClass}>
            {shouldShowThree && (
              <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
                <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.4em] text-slate-300">
                  Three.js reference
                </div>
                <SandboxMap3D
                  countyResults={countyResults}
                  countyStates={countyStates}
                  editedCounties={editedCounties}
                  onCountyClick={handleCountyClick}
                  scope={scope}
                  customStates={customStates}
                  onScopeChange={handleScopeChange}
                  onCustomStatesChange={handleCustomStatesChange}
                  selectedStates={selectedStates}
                  onSelectedStatesChange={handleSelectedStatesChange}
                  opacity={opacity}
                />
              </div>
            )}

            {shouldShowBabylon && (
              <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
                <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.4em] text-slate-300">
                  Babylon.js parity candidate
                </div>
                <SandboxMapBabylon
                  countyResults={countyResults}
                  countyStates={countyStates}
                  onCountyClick={handleCountyClick}
                  editedCounties={editedCounties}
                  opacity={opacity}
                  selectedStates={selectedStates}
                  onStateSelect={handleStateSelect}
                />
              </div>
            )}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Selected county</h2>
            {selectedCounty ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-2xl font-semibold text-white">{selectedCounty.county}</p>
                <p className="text-slate-300">FIPS {selectedCounty.fips} · State {lookupStateLabel(selectedCounty.fips.slice(0, 2))}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                    DEM {formatNumber(selectedCounty.demVotes)}
                  </div>
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                    GOP {formatNumber(selectedCounty.gopVotes)}
                  </div>
                  <div className="rounded-2xl border border-slate-500/30 bg-slate-500/10 px-3 py-2">
                    Other {formatNumber(selectedCounty.otherVotes)}
                  </div>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    Total {formatNumber(selectedCounty.totalVotes)}
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Reporting {formatPercent(selectedCounty.reportingPercent)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Click any county on either map to inspect vote breakdowns.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">State selection</h2>
              <button
                type="button"
                onClick={() => setSelectedStates([])}
                className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-300 hover:text-white"
              >
                Clear
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto text-sm">
              {(selectedStates.length ? selectedStates : statesWithData).map(fips => (
                <div
                  key={fips}
                  className={`rounded-2xl border px-3 py-2 ${selectedStates.includes(fips) ? 'border-sky-500/40 bg-sky-500/10 text-sky-100' : 'border-slate-700/60 bg-slate-800/40 text-slate-200'}`}
                >
                  {lookupStateLabel(fips)}
                </div>
              ))}
              {selectedStates.length === 0 && (
                <p className="text-xs text-slate-400">No states selected yet—click a state on either map to drill down into its counties.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default BabylonElectionMapPage
