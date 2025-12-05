import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { PolygonMeshBuilder } from '@babylonjs/core/Meshes/polygonMesh'
import '@babylonjs/core/Rendering/outlineRenderer'
import '@babylonjs/core/Culling/ray'
import earcut from 'earcut'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { CountyResult, CountySimulationState } from '../../types/sandbox'
import { getMarginColor } from '../../utils/electionColor'
import { VoteBarChart3DTooltip } from './VoteBarChart3DTooltip'

interface VoteBarChart3DProps {
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  isOpen: boolean
  onToggle: () => void
}

type VotePolygonProperties = {
  countyName: string
  countyFips: string
  demVotes: number
  gopVotes: number
  totalVotes: number
  reportingPercent: number
  fillColorHex: string
}

type VotePolygonFeature = Feature<Polygon | MultiPolygon, VotePolygonProperties>

type HoverInfo = {
  x: number
  y: number
  data: VotePolygonProperties
}

const DEFAULT_CENTER = { lng: -98.5795, lat: 39.8283 }
const MAP_SCALE = 2.0
const MIN_BAR_HEIGHT = 2.0

const getMarginHex = (demVotes: number, gopVotes: number): string => {
  const total = demVotes + gopVotes
  if (total === 0) return '#969696'
  const marginPct = ((gopVotes - demVotes) / total) * 100
  return getMarginColor(marginPct)
}

const hexToColor3 = (hex: string): Color3 => {
  const sanitized = hex.replace('#', '')
  const r = parseInt(sanitized.slice(0, 2), 16) / 255
  const g = parseInt(sanitized.slice(2, 4), 16) / 255
  const b = parseInt(sanitized.slice(4, 6), 16) / 255
  return new Color3(r, g, b)
}

export const VoteBarChart3D: React.FC<VoteBarChart3DProps> = ({ countyResults, countyStates, isOpen, onToggle }) => {
  const [geojson, setGeojson] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null)
  const [isGeoLoading, setIsGeoLoading] = useState(true)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const countyMeshesRef = useRef<Mesh[]>([])
  const hoveredMeshRef = useRef<Mesh | null>(null)
  const materialCacheRef = useRef<Map<string, StandardMaterial>>(new Map())

  useEffect(() => {
    let mounted = true

    const loadGeoJSON = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL || '/'
        const response = await fetch(`${baseUrl}gz_2010_us_050_00_500k.json`)
        if (!response.ok) throw new Error(`HTTP error ${response.status}`)
        const data = (await response.json()) as FeatureCollection<Polygon | MultiPolygon>
        if (mounted) {
          setGeojson(data)
        }
      } catch (error) {
        console.error('[VoteBarChart3D] Failed to load county geojson:', error)
      } finally {
        if (mounted) {
          setIsGeoLoading(false)
        }
      }
    }

    loadGeoJSON()
    return () => {
      mounted = false
    }
  }, [])

  const countyPolygons = useMemo(() => {
    if (!geojson || countyResults.length === 0) return []

    const fipsToVotes = new Map<string, {
      countyName: string
      demVotes: number
      gopVotes: number
      totalVotes: number
      reportingPercent: number
    }>()

    countyResults.forEach(county => {
      const state = countyStates.get(county.fips)
      if (state) {
        fipsToVotes.set(county.fips, {
          countyName: county.county,
          demVotes: state.currentDemVotes,
          gopVotes: state.currentGopVotes,
          totalVotes: state.currentTotalVotes,
          reportingPercent: state.currentReportingPercent
        })
      }
    })

    const features: VotePolygonFeature[] = []

    for (const feature of geojson.features) {
      const fips = feature.properties?.GEO_ID?.slice(-5)
      if (!fips) continue

      const votes = fipsToVotes.get(fips)
      if (!votes || votes.totalVotes === 0) continue

      features.push({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          countyName: votes.countyName,
          countyFips: fips,
          demVotes: votes.demVotes,
          gopVotes: votes.gopVotes,
          totalVotes: votes.totalVotes,
          reportingPercent: votes.reportingPercent,
          fillColorHex: getMarginHex(votes.demVotes, votes.gopVotes)
        }
      })
    }

    return features
  }, [geojson, countyResults, countyStates])

  const maxVotes = useMemo(() => {
    return countyPolygons.reduce((max, feature) => Math.max(max, feature.properties.totalVotes), 0)
  }, [countyPolygons])

  const mapCenter = useMemo(() => {
    if (countyPolygons.length === 0) return DEFAULT_CENTER

    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity

    countyPolygons.forEach(feature => {
      const geometries = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates

      geometries.forEach(poly => {
        poly.forEach(ring => {
          ring.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng
            if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          })
        })
      })
    })

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
      return DEFAULT_CENTER
    }

    return {
      lng: (minLng + maxLng) / 2,
      lat: (minLat + maxLat) / 2
    }
  }, [countyPolygons])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.03, 0.04, 0.08, 1)

    const camera = new ArcRotateCamera('vote-camera', -Math.PI / 2.2, Math.PI / 2.8, 200, Vector3.Zero(), scene)
    camera.attachControl(canvas, true)
    camera.lowerRadiusLimit = 50
    camera.upperRadiusLimit = 500
    camera.wheelPrecision = 40
    camera.panningSensibility = 900
    camera.allowUpsideDown = false

    const light = new HemisphericLight('vote-light', new Vector3(0.2, 1, -0.2), scene)
    light.intensity = 1.2

    sceneRef.current = scene
    engineRef.current = engine

    engine.runRenderLoop(() => {
      scene.render()
    })

    const resize = () => engine.resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      countyMeshesRef.current.forEach(mesh => mesh.dispose())
      countyMeshesRef.current = []
      materialCacheRef.current.forEach(material => material.dispose())
      materialCacheRef.current.clear()
      scene.dispose()
      engine.dispose()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const preventScroll = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    const preventDrag = (event: MouseEvent | TouchEvent) => event.stopPropagation()

    container.addEventListener('wheel', preventScroll, { passive: false })
    container.addEventListener('mousedown', preventDrag)
    container.addEventListener('touchstart', preventDrag)

    return () => {
      container.removeEventListener('wheel', preventScroll)
      container.removeEventListener('mousedown', preventDrag)
      container.removeEventListener('touchstart', preventDrag)
    }
  }, [])

  const getOrCreateMaterial = useCallback((scene: Scene, hex: string) => {
    const cache = materialCacheRef.current
    const existing = cache.get(hex)
    if (existing) return existing

    const mat = new StandardMaterial(`county-mat-${cache.size}`, scene)
    const baseColor = hexToColor3(hex)
    mat.diffuseColor = baseColor
    mat.emissiveColor = baseColor.scale(0.25)
    mat.specularColor = new Color3(0.15, 0.15, 0.15)
    mat.alpha = 0.96
    cache.set(hex, mat)
    return mat
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    countyMeshesRef.current.forEach(mesh => mesh.dispose())
    countyMeshesRef.current = []

    if (countyPolygons.length === 0) {
      return
    }

    const newMeshes: Mesh[] = []
    const depthScale = maxVotes > 0 ? 150 / maxVotes : 0.1

    countyPolygons.forEach(feature => {
      const geometries = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates

      geometries.forEach((poly, index) => {
        const outerRing = poly[0]?.map(([lng, lat]) => new Vector2(
          (lng - mapCenter.lng) * MAP_SCALE,
          (lat - mapCenter.lat) * MAP_SCALE
        ))

        if (!outerRing || outerRing.length < 3) return

        const builder = new PolygonMeshBuilder(`county-${feature.properties.countyFips}-${index}`, outerRing, scene, earcut)
        for (let i = 1; i < poly.length; i++) {
          const hole = poly[i].map(([lng, lat]) => new Vector2(
            (lng - mapCenter.lng) * MAP_SCALE,
            (lat - mapCenter.lat) * MAP_SCALE
          ))
          if (hole.length >= 3) {
            builder.addHole(hole)
          }
        }

        const height = Math.max(feature.properties.totalVotes * depthScale, MIN_BAR_HEIGHT)
        const mesh = builder.build(true, height)
        mesh.position.y = height / 2
        mesh.metadata = { type: 'county', data: feature.properties }

        const material = getOrCreateMaterial(scene, feature.properties.fillColorHex)
        mesh.material = material
        mesh.renderOutline = false

        newMeshes.push(mesh)
      })
    })

    countyMeshesRef.current = newMeshes

    return () => {
      newMeshes.forEach(mesh => mesh.dispose())
    }
  }, [countyPolygons, getOrCreateMaterial, mapCenter, maxVotes])

  const highlightMesh = useCallback((mesh: Mesh | null) => {
    if (hoveredMeshRef.current === mesh) return
    if (hoveredMeshRef.current) {
      hoveredMeshRef.current.renderOutline = false
    }
    hoveredMeshRef.current = mesh
    if (mesh) {
      mesh.renderOutline = true
      mesh.outlineColor = Color3.White()
      mesh.outlineWidth = 0.02
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    const container = containerRef.current
    if (!scene || !container) return

    const observer = scene.onPointerObservable.add(pointerInfo => {
      if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return

      const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => Boolean(mesh?.metadata?.type === 'county'))
      if (pick?.hit && pick.pickedMesh?.metadata?.data) {
        highlightMesh(pick.pickedMesh as Mesh)
        const event = pointerInfo.event as PointerEvent | undefined
        if (event) {
          const rect = container.getBoundingClientRect()
          setHoverInfo({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            data: pick.pickedMesh.metadata.data as VotePolygonProperties
          })
        }
      } else {
        highlightMesh(null)
        setHoverInfo(null)
      }
    })

    return () => {
      scene.onPointerObservable.remove(observer)
    }
  }, [highlightMesh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleLeave = () => {
      highlightMesh(null)
      setHoverInfo(null)
    }

    container.addEventListener('mouseleave', handleLeave)
    return () => container.removeEventListener('mouseleave', handleLeave)
  }, [highlightMesh])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-slate-900/90 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Vote Totals (3D)</h3>
            <p className="mt-1 text-xs text-slate-400">Bar height = total votes • Color = margin buckets</p>
          </div>
          <button
            onClick={onToggle}
            className="pointer-events-auto rounded-md bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60 hover:text-white"
          >
            {isOpen ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {(isGeoLoading || countyPolygons.length === 0) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70 text-sm text-slate-300">
          {isGeoLoading ? 'Loading county boundaries...' : 'No county data available'}
        </div>
      )}

      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-30"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
        >
          <VoteBarChart3DTooltip
            county={hoverInfo.data.countyName}
            fips={hoverInfo.data.countyFips}
            demVotes={hoverInfo.data.demVotes}
            gopVotes={hoverInfo.data.gopVotes}
            totalVotes={hoverInfo.data.totalVotes}
            reportingPercent={hoverInfo.data.reportingPercent}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-900/90 to-transparent p-3 text-xs">
        <div className="flex items-center justify-between text-slate-300">
          <span>{countyPolygons.length.toLocaleString()} counties reporting</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> DEM</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> GOP</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-16 z-20 rounded bg-slate-900/70 px-2 py-1 text-[10px] text-slate-400">
        Drag to orbit • Scroll to zoom
      </div>
    </div>
  )
}
