import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { geoAlbersUsa, geoPath, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import statesTopology from 'us-atlas/states-10m.json'
import countiesTopology from 'us-atlas/counties-10m.json'
import Papa from 'papaparse'
import { getMarginColor } from '../../lib/election/colors'
import { MapTooltip3D } from './MapTooltip3D'

type CountyCsvRow = {
  fips?: string
  dem_votes?: string | number
  rep_votes?: string | number
  gop_votes?: string | number
  total_votes?: string | number
}

type StateOutcome = {
  marginPct: number
  winner: 'DEM' | 'GOP' | null
  turnoutRatio: number
  totalVotes: number
}

type CountyOutcome = {
  stateFips: string
  marginPct: number
  winner: 'DEM' | 'GOP' | null
  turnoutRatio: number
  totalVotes: number
}

type StateVisual = {
  fips: string
  name: string
  centroid: [number, number]
  geometries: THREE.ExtrudeGeometry[]
  material: THREE.MeshStandardMaterial
  meshes: Array<THREE.Mesh | null>
  labelRef: React.RefObject<THREE.Object3D>
  currentHeight: number
  targetHeight: number
  color: THREE.Color
  targetColor: THREE.Color
  emissive: THREE.Color
  targetEmissive: THREE.Color
  opacity: number
  targetOpacity: number
  hovered: boolean
}

type CountyVisual = {
  fips: string
  stateFips: string
  name: string
  centroid: [number, number]
  geometries: THREE.ExtrudeGeometry[]
  material: THREE.MeshStandardMaterial
  meshes: Array<THREE.Mesh | null>
  currentHeight: number
  targetHeight: number
  color: THREE.Color
  targetColor: THREE.Color
  emissive: THREE.Color
  targetEmissive: THREE.Color
  hovered: boolean
}

type TopologySource = Parameters<typeof feature>[0]
type TopologyGeometry = Parameters<typeof feature>[1]

const MAP_WIDTH = 8
const MAP_HEIGHT = 5
const MIN_HEIGHT = 0.12
const UNIFORM_HEIGHT = 0.35
const COUNTY_EXTRUSION_HEIGHT = 0.28
const HEIGHT_SMOOTHING = 0.085
const COLOR_SMOOTHING = 0.12
const NEUTRAL_COLOR = new THREE.Color('#1e293b')
const NEUTRAL_EMISSIVE = new THREE.Color('#10213a')

const topologyData = statesTopology as unknown as TopologySource
const topologyObjects = topologyData.objects as Record<string, TopologyGeometry | undefined>
const statesGeometry = topologyObjects.states
const emptyFeatureCollection: FeatureCollection = { type: 'FeatureCollection', features: [] }
const statesFeatureCollection: FeatureCollection = statesGeometry
  ? (feature(topologyData, statesGeometry) as FeatureCollection)
  : emptyFeatureCollection

const countiesTopologyData = countiesTopology as unknown as TopologySource
const countiesObjects = countiesTopologyData.objects as Record<string, TopologyGeometry | undefined>
const countiesGeometry = countiesObjects.counties
const countiesFeatureCollection: FeatureCollection = countiesGeometry
  ? (feature(countiesTopologyData, countiesGeometry) as FeatureCollection)
  : emptyFeatureCollection

const countiesByState = new Map<string, Feature[]>()
if (countiesFeatureCollection.features.length) {
  for (const countyFeature of countiesFeatureCollection.features as Feature[]) {
    const rawId = countyFeature.id ?? (countyFeature.properties as any)?.GEO_ID ?? (countyFeature.properties as any)?.geoid
    if (rawId == null) continue
    const countyFips = String(rawId).padStart(5, '0')
    if (countyFips.length !== 5) continue
    const stateFips = countyFips.slice(0, 2)
    if (!stateFips) continue
    const list = countiesByState.get(stateFips)
    if (list) list.push(countyFeature)
    else countiesByState.set(stateFips, [countyFeature])
  }
}

function resolveStaticAsset(path: string): string {
  const base = (import.meta as any).env?.BASE_URL ?? '/'
  const normalizedBase = typeof base === 'string' ? base.replace(/\/$/, '') : ''
  const normalizedPath = path.replace(/^\//, '')
  return `${normalizedBase}/${normalizedPath}`
}

function parseNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function buildStateOutcomes(rows: CountyCsvRow[]): Map<string, StateOutcome> {
  const stateTotals = new Map<string, { dem: number; gop: number; total: number }>()

  for (const row of rows) {
    const fipsRaw = row.fips?.toString().trim()
    if (!fipsRaw || fipsRaw.length < 2) continue
    const stateFips = fipsRaw.slice(0, 2)

    const demVotes = parseNumber(row.dem_votes)
    const gopVotes = parseNumber(row.rep_votes ?? row.gop_votes)
    const totalVotes = parseNumber(row.total_votes)

    if (totalVotes <= 0) continue

    const entry = stateTotals.get(stateFips) ?? { dem: 0, gop: 0, total: 0 }
    entry.dem += demVotes
    entry.gop += gopVotes
    entry.total += totalVotes
    stateTotals.set(stateFips, entry)
  }

  let maxTotalVotes = 0
  stateTotals.forEach((entry) => {
    if (entry.total > maxTotalVotes) maxTotalVotes = entry.total
  })

  const outcomes = new Map<string, StateOutcome>()
  stateTotals.forEach((entry, fips) => {
    const { dem, gop, total } = entry
    if (total <= 0) return

    const marginPct = ((dem - gop) / total) * 100
    const diff = dem - gop
    let winner: 'DEM' | 'GOP' | null = null
    if (Math.abs(diff) > 0) {
      winner = diff > 0 ? 'DEM' : 'GOP'
    }

    const turnoutRatio = maxTotalVotes > 0 ? total / maxTotalVotes : 0
    outcomes.set(fips, {
      marginPct,
      winner,
      turnoutRatio,
      totalVotes: total
    })
  })

  return outcomes
}

function buildCountyOutcomes(rows: CountyCsvRow[]): Map<string, CountyOutcome> {
  const countyTotals = new Map<string, { dem: number; gop: number; total: number; stateFips: string }>()
  const maxByState = new Map<string, number>()

  for (const row of rows) {
    const fipsRaw = row.fips?.toString().trim()
    if (!fipsRaw || fipsRaw.length < 5) continue
    const countyFips = fipsRaw.padStart(5, '0')
    if (countyFips.length !== 5) continue
    const stateFips = countyFips.slice(0, 2)

    const demVotes = parseNumber(row.dem_votes)
    const gopVotes = parseNumber(row.rep_votes ?? row.gop_votes)
    const totalVotes = parseNumber(row.total_votes)
    if (totalVotes <= 0) continue

    const entry = countyTotals.get(countyFips) ?? { dem: 0, gop: 0, total: 0, stateFips }
    entry.dem += demVotes
    entry.gop += gopVotes
    entry.total += totalVotes
    countyTotals.set(countyFips, entry)

    const currentMax = maxByState.get(stateFips) ?? 0
    if (entry.total > currentMax) {
      maxByState.set(stateFips, entry.total)
    }
  }

  const outcomes = new Map<string, CountyOutcome>()
  countyTotals.forEach((entry, countyFips) => {
    const { dem, gop, total, stateFips } = entry
    if (total <= 0) return
    const marginPct = ((dem - gop) / total) * 100
    const diff = dem - gop
    let winner: 'DEM' | 'GOP' | null = null
    if (Math.abs(diff) > 0) {
      winner = diff > 0 ? 'DEM' : 'GOP'
    }
    const maxStateTotal = maxByState.get(stateFips) ?? total
    const turnoutRatio = maxStateTotal > 0 ? total / maxStateTotal : 0
    outcomes.set(countyFips, {
      stateFips,
      marginPct,
      winner,
      turnoutRatio,
      totalVotes: total
    })
  })

  return outcomes
}

function createShapesFromFeature(featureGeom: Polygon | MultiPolygon, projection: GeoProjection): THREE.Shape[] {
  const polygons = featureGeom.type === 'Polygon' ? [featureGeom.coordinates] : featureGeom.coordinates
  const shapes: THREE.Shape[] = []

  polygons.forEach((polygon) => {
    if (!polygon.length) return
    const [outer, ...holes] = polygon
    if (!outer || !outer.length) return

    const shape = new THREE.Shape()
    let validPoints = 0

    outer.forEach(([lon, lat], idx) => {
      const projected = projection([lon, lat])
      if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) return
      const [px, py] = projected
      const x = px - MAP_WIDTH / 2
      const y = -(py - MAP_HEIGHT / 2)
      if (idx === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
      validPoints++
    })

    if (validPoints < 3) return

    holes.forEach((ring) => {
      if (!ring.length) return
      const path = new THREE.Path()
      let validHolePoints = 0
      ring.forEach(([lon, lat], idx) => {
        const projected = projection([lon, lat])
        if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) return
        const [px, py] = projected
        const x = px - MAP_WIDTH / 2
        const y = -(py - MAP_HEIGHT / 2)
        if (idx === 0) path.moveTo(x, y)
        else path.lineTo(x, y)
        validHolePoints++
      })
      if (validHolePoints >= 3 && path.curves.length) shape.holes.push(path)
    })

    shapes.push(shape)
  })

  return shapes
}

function StateMeshes({
  projection,
  outcomes,
  selectedStates,
  onStateSelect,
  onStateHover
}: {
  projection: GeoProjection
  outcomes: Map<string, StateOutcome>
  selectedStates: string[]
  onStateSelect: (stateFips: string) => void
  onStateHover: (stateFips: string | null, position: [number, number, number] | null) => void
}) {
  const states = useMemo<StateVisual[]>(() => {
    if (!statesFeatureCollection.features.length) return []

    const pathGenerator = geoPath(projection)

    return statesFeatureCollection.features
      .map((featureItem) => {
        if (!featureItem || !featureItem.geometry) return null

        const shapes = createShapesFromFeature(featureItem.geometry as Polygon | MultiPolygon, projection)
        if (shapes.length === 0) return null

        const geometries = shapes.map((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 1,
            bevelEnabled: false,
            steps: 1,
            curveSegments: 2
          })
          geometry.rotateX(-Math.PI / 2)
          return geometry
        })

        const featureCentroid = pathGenerator.centroid(featureItem as Feature)
        const centroid: [number, number] = featureCentroid
          ? [featureCentroid[0] - MAP_WIDTH / 2, -(featureCentroid[1] - MAP_HEIGHT / 2)]
          : [0, 0]

        const material = new THREE.MeshStandardMaterial({
          color: NEUTRAL_COLOR.clone(),
          emissive: NEUTRAL_EMISSIVE.clone(),
          emissiveIntensity: 0.65,
          metalness: 0.85,
          roughness: 0.3,
          transparent: true,
          opacity: 1
        })

        return {
          fips: String(featureItem.id ?? '').padStart(2, '0'),
          name: (featureItem.properties as any)?.name ?? 'State',
          centroid,
          geometries,
          material,
          meshes: new Array<THREE.Mesh | null>(geometries.length).fill(null),
          labelRef: React.createRef<THREE.Object3D>(),
          currentHeight: UNIFORM_HEIGHT,
          targetHeight: UNIFORM_HEIGHT,
          color: NEUTRAL_COLOR.clone(),
          targetColor: NEUTRAL_COLOR.clone(),
          emissive: NEUTRAL_EMISSIVE.clone(),
          targetEmissive: NEUTRAL_EMISSIVE.clone(),
          opacity: 1,
          targetOpacity: 1,
          hovered: false
        } as StateVisual
      })
      .filter((state): state is StateVisual => Boolean(state))
  }, [projection])

  useEffect(() => {
    return () => {
      states.forEach((state) => {
        state.geometries.forEach((geom) => geom.dispose())
        state.material.dispose()
      })
    }
  }, [states])

  useEffect(() => {
    const selectedSet = new Set(selectedStates)
    states.forEach((state) => {
      const outcome = outcomes.get(state.fips)
      if (!outcome) {
        state.targetColor.copy(NEUTRAL_COLOR)
        state.targetEmissive.copy(NEUTRAL_EMISSIVE)
        const isSelected = selectedSet.has(state.fips)
        state.targetHeight = isSelected ? MIN_HEIGHT : UNIFORM_HEIGHT
        state.targetOpacity = isSelected ? 0.3 : 1
        return
      }

      const colorHex = getMarginColor(outcome.marginPct, outcome.winner)
      state.targetColor.set(colorHex)
      state.targetEmissive.copy(new THREE.Color(colorHex).multiplyScalar(0.42))
      const isSelected = selectedSet.has(state.fips)
      state.targetHeight = isSelected ? MIN_HEIGHT : UNIFORM_HEIGHT
      state.targetOpacity = isSelected ? 0.3 : 1
    })
  }, [outcomes, selectedStates, states])

  useFrame(() => {
    states.forEach((state) => {
      state.currentHeight = THREE.MathUtils.lerp(state.currentHeight, state.targetHeight, HEIGHT_SMOOTHING)
      if (Math.abs(state.currentHeight - state.targetHeight) < 0.002) {
        state.currentHeight = state.targetHeight
      }

      state.color.lerp(state.targetColor, COLOR_SMOOTHING)
      state.emissive.lerp(state.targetEmissive, COLOR_SMOOTHING)
      state.opacity = THREE.MathUtils.lerp(state.opacity, state.targetOpacity, COLOR_SMOOTHING)
      state.material.color.copy(state.color)
      state.material.emissive.copy(state.emissive)
      state.material.opacity = state.opacity

      state.meshes.forEach((mesh) => {
        if (!mesh) return
        const height = Math.max(state.currentHeight, MIN_HEIGHT)
        mesh.scale.y = height
      })

      const label = state.labelRef.current
      if (label) {
        label.position.set(state.centroid[0], state.currentHeight + 0.25, state.centroid[1])
      }
    })
  })

  return (
    <group>
      {states.map((state) => (
        <group key={state.fips}>
          {state.geometries.map((geometry, index) => (
            <mesh
              key={`${state.fips}-${index}`}
              geometry={geometry}
              material={state.material}
              castShadow
              receiveShadow
              onClick={(event) => {
                event.stopPropagation()
                onStateSelect(state.fips)
              }}
              onPointerOver={(event) => {
                event.stopPropagation()
                state.hovered = true
                const point = event.point
                onStateHover(state.fips, [point.x, point.y + 0.35, point.z])
              }}
              onPointerMove={(event) => {
                if (!state.hovered) return
                event.stopPropagation()
                const point = event.point
                onStateHover(state.fips, [point.x, point.y + 0.35, point.z])
              }}
              onPointerOut={(event) => {
                event.stopPropagation()
                state.hovered = false
                onStateHover(null, null)
              }}
              ref={(mesh) => {
                state.meshes[index] = mesh
                if (mesh) mesh.scale.y = Math.max(state.currentHeight, MIN_HEIGHT)
              }}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

function CountyMeshes({
  projection,
  selectedStates,
  countyOutcomes
}: {
  projection: GeoProjection
  selectedStates: string[]
  countyOutcomes: Map<string, CountyOutcome>
}) {
  const countyCacheRef = useRef<Map<string, CountyVisual[]>>(new Map())
  const pathGenerator = useMemo(() => geoPath(projection), [projection])
  const previousSelectedRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      const cache = countyCacheRef.current
      cache.forEach((visuals) => {
        visuals.forEach((county) => {
          county.geometries.forEach((geom) => geom.dispose())
          county.material.dispose()
        })
      })
      cache.clear()
    }
  }, [])

  const counties = useMemo<CountyVisual[]>(() => {
    if (!selectedStates.length) return []

    const cache = countyCacheRef.current
    const visuals: CountyVisual[] = []

    for (const stateFips of selectedStates) {
      let stateVisuals = cache.get(stateFips)

      if (!stateVisuals) {
        const countyFeatures = countiesByState.get(stateFips)
        if (!countyFeatures || countyFeatures.length === 0) {
          cache.set(stateFips, [])
          continue
        }

        stateVisuals = countyFeatures
          .map((featureItem) => {
            if (!featureItem.geometry) return null
            const shapes = createShapesFromFeature(featureItem.geometry as Polygon | MultiPolygon, projection)
            if (shapes.length === 0) return null

            const rawId =
              featureItem.id ?? (featureItem.properties as any)?.GEO_ID ?? (featureItem.properties as any)?.geoid
            if (!rawId) return null
            const countyFips = String(rawId).padStart(5, '0')
            if (countyFips.length !== 5) return null

            const geometries = shapes.map((shape) => {
              const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: 0.9,
                bevelEnabled: false,
                steps: 1,
                curveSegments: 2
              })
              geometry.rotateX(-Math.PI / 2)
              return geometry
            })

            const featureCentroid = pathGenerator.centroid(featureItem as Feature)
            const centroid: [number, number] = featureCentroid
              ? [featureCentroid[0] - MAP_WIDTH / 2, -(featureCentroid[1] - MAP_HEIGHT / 2)]
              : [0, 0]

            const material = new THREE.MeshStandardMaterial({
              color: NEUTRAL_COLOR.clone(),
              emissive: NEUTRAL_EMISSIVE.clone(),
              emissiveIntensity: 0.75,
              metalness: 0.9,
              roughness: 0.32,
              transparent: true,
              opacity: 0.95
            })

            return {
              fips: countyFips,
              stateFips,
              name: (featureItem.properties as any)?.name ?? 'County',
              centroid,
              geometries,
              material,
              meshes: new Array<THREE.Mesh | null>(geometries.length).fill(null),
              currentHeight: MIN_HEIGHT,
              targetHeight: MIN_HEIGHT,
              color: NEUTRAL_COLOR.clone(),
              targetColor: NEUTRAL_COLOR.clone(),
              emissive: NEUTRAL_EMISSIVE.clone(),
              targetEmissive: NEUTRAL_EMISSIVE.clone()
            } as CountyVisual
          })
          .filter((county): county is CountyVisual => Boolean(county))

        cache.set(stateFips, stateVisuals)
      }

      if (stateVisuals && stateVisuals.length) {
        visuals.push(...stateVisuals)
      }
    }

    return visuals
  }, [pathGenerator, projection, selectedStates])

  useEffect(() => {
    const previous = previousSelectedRef.current
    const removed = previous.filter((stateFips) => !selectedStates.includes(stateFips))
    if (removed.length) {
      const cache = countyCacheRef.current
      removed.forEach((stateFips) => {
        const visuals = cache.get(stateFips)
        if (!visuals) return
        visuals.forEach((county) => {
          county.geometries.forEach((geom) => geom.dispose())
          county.material.dispose()
          county.targetHeight = MIN_HEIGHT
          county.currentHeight = MIN_HEIGHT
          county.targetColor.copy(NEUTRAL_COLOR)
          county.targetEmissive.copy(NEUTRAL_EMISSIVE)
          county.meshes.forEach((mesh) => {
            if (!mesh) return
            mesh.scale.y = MIN_HEIGHT
            mesh.position.y = MIN_HEIGHT + MIN_HEIGHT / 2
          })
        })
        cache.delete(stateFips)
      })
    }
    previousSelectedRef.current = selectedStates
  }, [selectedStates])

  useEffect(() => {
    counties.forEach((county) => {
      const outcome = countyOutcomes.get(county.fips)
      if (!outcome) {
        county.targetColor.copy(NEUTRAL_COLOR)
        county.targetEmissive.copy(NEUTRAL_EMISSIVE)
        county.targetHeight = COUNTY_EXTRUSION_HEIGHT
        return
      }

      const colorHex = getMarginColor(outcome.marginPct, outcome.winner)
      county.targetColor.set(colorHex)
      county.targetEmissive.copy(new THREE.Color(colorHex).multiplyScalar(0.5))
      county.targetHeight = COUNTY_EXTRUSION_HEIGHT
    })
  }, [counties, countyOutcomes])

  useFrame(() => {
    counties.forEach((county) => {
      county.currentHeight = THREE.MathUtils.lerp(county.currentHeight, county.targetHeight, HEIGHT_SMOOTHING)
      if (Math.abs(county.currentHeight - county.targetHeight) < 0.002) {
        county.currentHeight = county.targetHeight
      }

      county.color.lerp(county.targetColor, COLOR_SMOOTHING)
      county.emissive.lerp(county.targetEmissive, COLOR_SMOOTHING)
      county.material.color.copy(county.color)
      county.material.emissive.copy(county.emissive)

      county.meshes.forEach((mesh) => {
        if (!mesh) return
        const height = Math.max(county.currentHeight, 0.001)
        mesh.scale.y = height
        mesh.position.y = MIN_HEIGHT + height / 2
      })
    })
  })

  if (!selectedStates.length || counties.length === 0) {
    return null
  }

  return (
    <group>
      {counties.map((county) => (
        <group key={county.fips}>
          {county.geometries.map((geometry, index) => (
            <mesh
              key={`${county.fips}-${index}`}
              geometry={geometry}
              material={county.material}
              castShadow
              receiveShadow
              ref={(mesh) => {
                county.meshes[index] = mesh
                if (mesh) {
                  mesh.scale.y = Math.max(county.currentHeight, 0.001)
                  mesh.position.y = MIN_HEIGHT + Math.max(county.currentHeight, 0.001) / 2
                }
              }}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

function MapScene({
  outcomes,
  countyOutcomes,
  selectedStates,
  onStateSelect,
  onStateHover
}: {
  outcomes: Map<string, StateOutcome>
  countyOutcomes: Map<string, CountyOutcome>
  selectedStates: string[]
  onStateSelect: (stateFips: string) => void
  onStateHover: (stateFips: string | null, position: [number, number, number] | null) => void
}) {
  const projection = useMemo(() => {
    const mapProjection = geoAlbersUsa()
    if (statesFeatureCollection.features.length) {
      mapProjection.fitSize([MAP_WIDTH, MAP_HEIGHT], statesFeatureCollection)
    }
    return mapProjection
  }, [])

  return (
    <group>
      <StateMeshes
        projection={projection}
        outcomes={outcomes}
        selectedStates={selectedStates}
        onStateSelect={onStateSelect}
        onStateHover={onStateHover}
      />
      <CountyMeshes
        projection={projection}
        selectedStates={selectedStates}
        countyOutcomes={countyOutcomes}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH + 2, MAP_HEIGHT + 2]} />
        <meshStandardMaterial color="#0b172c" metalness={0.75} roughness={0.28} />
      </mesh>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={0.85} castShadow color="#6aa8ff" />
      <pointLight position={[-5, 3, 2]} intensity={0.42} color="#93c5fd" />
    </group>
  )
}

export const USStatesMap3D: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 500
}) => {
  const [stateOutcomes, setStateOutcomes] = useState<Map<string, StateOutcome>>(new Map())
  const [countyOutcomes, setCountyOutcomes] = useState<Map<string, CountyOutcome>>(new Map())
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [hoveredState, setHoveredState] = useState<{ fips: string; position: [number, number, number] } | null>(null)
  
  const statesWithCountyData = useMemo(() => {
    const set = new Set<string>()
    countyOutcomes.forEach((outcome) => {
      set.add(outcome.stateFips)
    })
    return set
  }, [countyOutcomes])

  useEffect(() => {
    let mounted = true

    const loadOutcomes = async () => {
      try {
        const response = await fetch(resolveStaticAsset('data/2024_sandbox.csv'))
        if (!response.ok) throw new Error(`Failed to load state data (${response.status})`)
        const text = await response.text()
        const parsed = Papa.parse<CountyCsvRow>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false
        })

        if (!mounted) return
        const stateResults = buildStateOutcomes(parsed.data)
        const countyResults = buildCountyOutcomes(parsed.data)
        setStateOutcomes(stateResults)
        setCountyOutcomes(countyResults)
      } catch (error) {
        console.error('USStatesMap3D failed to load results:', error)
        if (mounted) setStateOutcomes(new Map())
        if (mounted) setCountyOutcomes(new Map())
      }
    }

    loadOutcomes()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setSelectedStates((prev) => {
      if (!prev.length) return prev

      const filtered = prev.filter((stateFips) => {
        if (!stateOutcomes.has(stateFips)) return false
        if (!countiesByState.has(stateFips)) return false
        return statesWithCountyData.has(stateFips)
      })

      if (filtered.length === prev.length) return prev
      return filtered
    })
  }, [stateOutcomes, statesWithCountyData])

  const handleStateSelect = (stateFips: string) => {
    if (!stateFips) return
    if (!countiesByState.has(stateFips)) {
      setSelectedStates((prev) => prev.filter((entry) => entry !== stateFips))
      return
    }

    setSelectedStates((prev) => {
      const exists = prev.includes(stateFips)
      if (exists) return prev.filter((entry) => entry !== stateFips)
      return [...prev, stateFips]
    })
  }

  const handleStateHover = (stateFips: string | null, position: [number, number, number] | null) => {
    if (stateFips && position) {
      setHoveredState({ fips: stateFips, position })
    } else {
      setHoveredState(null)
    }
  }

  return (
    <div className={className} style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      <Canvas shadows style={{ pointerEvents: 'auto' }}>
        <PerspectiveCamera makeDefault position={[0, 6, 8]} fov={45} />
        <MapScene
          outcomes={stateOutcomes}
          countyOutcomes={countyOutcomes}
          selectedStates={selectedStates}
          onStateSelect={handleStateSelect}
          onStateHover={handleStateHover}
        />
        {hoveredState && (
          <MapTooltip3D
            stateFips={hoveredState.fips}
            position={hoveredState.position}
            outcome={stateOutcomes.get(hoveredState.fips)}
          />
        )}
        <OrbitControls
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(2 * Math.PI) / 5}
          autoRotate
          autoRotateSpeed={0.35}
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
        />
      </Canvas>
    </div>
  )
}

export default USStatesMap3D
