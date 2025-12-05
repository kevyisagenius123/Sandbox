import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { geoPath, type GeoProjection } from 'd3-geo'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { getMarginColor } from '../../lib/election/colors'
import { STATE_META_BY_FIPS } from '../../constants/usStates'
import type { MapHoverInfo } from '../map/MapHoverTooltip'

const MAP_WIDTH = 8
const MAP_HEIGHT = 5
const MIN_HEIGHT = 0.1
const STATE_HEIGHT_BASE = 0.32
const STATE_TURNOUT_SCALE = 0.7
const COUNTY_BASE_HEIGHT = 0.05
const COUNTY_MAX_HEIGHT = 0.45
const HEIGHT_SMOOTHING = 0.095
const COLOR_SMOOTHING = 0.14
const OPACITY_SMOOTHING = 0.12
const NEUTRAL_COLOR = new THREE.Color('#8C9BAF')  // Matches Deck.gl neutral gray RGB(140, 155, 175)
const NEUTRAL_EMISSIVE = new THREE.Color('#4a5568')  // Lighter emissive to match
const HIGHLIGHT_EMISSIVE = new THREE.Color('#facc15')

export type StateRuntimeOutcome = {
  marginPct: number
  winner: 'DEM' | 'GOP' | null
  reportingRatio: number
  turnoutRatio: number
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  reportingPercent: number
}

export type CountyRuntimeOutcome = {
  stateFips: string
  marginPct: number
  winner: 'DEM' | 'GOP' | null
  reportingRatio: number
  turnoutRatio: number
  totalVotes: number
  expectedVotes: number
  isFullyReported: boolean
  demVotes: number
  gopVotes: number
  otherVotes: number
  reportingPercent: number
}

type StateVisual = {
  fips: string
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
  opacity: number
  targetOpacity: number
}

type CountyVisual = {
  fips: string
  stateFips: string
  name: string
  geometries: THREE.ExtrudeGeometry[]
  material: THREE.MeshStandardMaterial
  meshes: Array<THREE.Mesh | null>
  color: THREE.Color
  targetColor: THREE.Color
  emissive: THREE.Color
  targetEmissive: THREE.Color
  currentHeight: number
  targetHeight: number
  currentOpacity: number
  targetOpacity: number
}

type StudioMapSceneProps = {
  projection: GeoProjection
  stateFeatures: Feature[]
  countiesByState: Map<string, Feature[]>
  stateOutcomes: Map<string, StateRuntimeOutcome>
  countyOutcomes: Map<string, CountyRuntimeOutcome>
  selectedStates: string[]
  onStateSelect: (stateFips: string) => void
  onCountySelect?: (countyFips: string) => void
  editedCounties?: Set<string>
  onHoverChange?: (info: MapHoverInfo | null) => void
}

function createShapesFromFeature(featureGeom: Polygon | MultiPolygon, projection: GeoProjection): THREE.Shape[] {
  const polygons = featureGeom.type === 'Polygon' ? [featureGeom.coordinates] : featureGeom.coordinates
  const shapes: THREE.Shape[] = []

  polygons.forEach((polygon) => {
    if (!polygon.length) return
    const [outer, ...holes] = polygon
    if (!outer || outer.length < 4) return // Need at least 4 points for a closed polygon

    const shape = new THREE.Shape()
    const validPoints: [number, number][] = []

    // Collect valid projected points
    outer.forEach(([lon, lat]) => {
      const projected = projection([lon, lat])
      if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) return
      const x = projected[0] - MAP_WIDTH / 2
      const y = -(projected[1] - MAP_HEIGHT / 2)
      validPoints.push([x, y])
    })

    if (validPoints.length < 3) return

    // Build shape from valid points
    validPoints.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })

    // Close the shape explicitly
    if (validPoints.length > 0) {
      const [firstX, firstY] = validPoints[0]
      const [lastX, lastY] = validPoints[validPoints.length - 1]
      const distance = Math.sqrt(Math.pow(lastX - firstX, 2) + Math.pow(lastY - firstY, 2))
      if (distance > 0.001) {
        shape.lineTo(firstX, firstY)
      }
    }

    // Process holes with same safeguards
    holes.forEach((ring) => {
      if (!ring.length || ring.length < 4) return
      const path = new THREE.Path()
      const holePoints: [number, number][] = []

      ring.forEach(([lon, lat]) => {
        const projected = projection([lon, lat])
        if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) return
        const x = projected[0] - MAP_WIDTH / 2
        const y = -(projected[1] - MAP_HEIGHT / 2)
        holePoints.push([x, y])
      })

      if (holePoints.length >= 3) {
        holePoints.forEach(([x, y], index) => {
          if (index === 0) path.moveTo(x, y)
          else path.lineTo(x, y)
        })
        
        // Close hole path
        const [firstX, firstY] = holePoints[0]
        const [lastX, lastY] = holePoints[holePoints.length - 1]
        const distance = Math.sqrt(Math.pow(lastX - firstX, 2) + Math.pow(lastY - firstY, 2))
        if (distance > 0.001) {
          path.lineTo(firstX, firstY)
        }
        
        if (path.curves.length > 0) {
          shape.holes.push(path)
        }
      }
    })

    if (shape.curves.length > 0) {
      shapes.push(shape)
    }
  })

  return shapes
}

const StateMesh = React.memo(
  ({
    state,
    index,
    geometry,
    outcomes,
    onStateSelect,
    onHoverChange
  }: {
    state: StateVisual
    index: number
    geometry: THREE.ExtrudeGeometry
    outcomes: Map<string, StateRuntimeOutcome>
    onStateSelect: (stateFips: string) => void
    onHoverChange?: (info: MapHoverInfo | null) => void
  }) => {
    return (
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
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          if (!onHoverChange) return
          const outcome = outcomes.get(state.fips)
          const meta = STATE_META_BY_FIPS.get(state.fips)
          onHoverChange({
            x: event.clientX + 12,
            y: event.clientY + 12,
            type: 'state',
            id: state.fips,
            stateFips: state.fips,
            label: state.name,
            subtitle: meta ? `${meta.name} (${meta.abbr})` : undefined,
            demVotes: outcome?.demVotes ?? 0,
            gopVotes: outcome?.gopVotes ?? 0,
            otherVotes: outcome?.otherVotes ?? 0,
            totalVotes: outcome?.totalVotes ?? 0,
            reportingPercent: outcome?.reportingPercent ?? 0,
            marginPct: outcome?.marginPct ?? 0
          })
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          if (!onHoverChange) return
          const outcome = outcomes.get(state.fips)
          const meta = STATE_META_BY_FIPS.get(state.fips)
          onHoverChange({
            x: event.clientX + 12,
            y: event.clientY + 12,
            type: 'state',
            id: state.fips,
            stateFips: state.fips,
            label: state.name,
            subtitle: meta ? `${meta.name} (${meta.abbr})` : undefined,
            demVotes: outcome?.demVotes ?? 0,
            gopVotes: outcome?.gopVotes ?? 0,
            otherVotes: outcome?.otherVotes ?? 0,
            totalVotes: outcome?.totalVotes ?? 0,
            reportingPercent: outcome?.reportingPercent ?? 0,
            marginPct: outcome?.marginPct ?? 0
          })
        }}
        onPointerOut={() => {
          onHoverChange?.(null)
        }}
        ref={(mesh) => {
          state.meshes[index] = mesh
          if (mesh) {
            mesh.scale.y = state.currentHeight
            mesh.position.y = state.currentHeight / 2
          }
        }}
      />
    )
  }
)

function StateMeshes({
  projection,
  features,
  outcomes,
  selectedStates,
  onStateSelect,
  onHoverChange
}: {
  projection: GeoProjection
  features: Feature[]
  outcomes: Map<string, StateRuntimeOutcome>
  selectedStates: string[]
  onStateSelect: (stateFips: string) => void
  onHoverChange?: (info: MapHoverInfo | null) => void
}) {
  const states = useMemo<StateVisual[]>(() => {
    if (!features.length) return []
    const pathGenerator = geoPath(projection)

    return features
      .map((featureItem) => {
        if (!featureItem.geometry) return null
        
        try {
          const shapes = createShapesFromFeature(featureItem.geometry as Polygon | MultiPolygon, projection)
          if (shapes.length === 0) return null

          const geometries = shapes.map((shape) => {
            try {
              const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: 1,
                bevelEnabled: false,
                steps: 1,
                curveSegments: 1 // Reduced from 2 for better performance
              })
              geometry.rotateX(-Math.PI / 2)
              return geometry
            } catch (err) {
              console.warn('Failed to create state geometry:', err)
              return null
            }
          }).filter((g): g is THREE.ExtrudeGeometry => g !== null)

          if (geometries.length === 0) return null

          const centroidRaw = pathGenerator.centroid(featureItem)
          const centroid: [number, number] = centroidRaw
            ? [centroidRaw[0] - MAP_WIDTH / 2, -(centroidRaw[1] - MAP_HEIGHT / 2)]
            : [0, 0]

          const material = new THREE.MeshStandardMaterial({
            color: NEUTRAL_COLOR.clone(),
            emissive: NEUTRAL_EMISSIVE.clone(),
            emissiveIntensity: 0.6,
            metalness: 0.85,
            roughness: 0.28,
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
            currentHeight: STATE_HEIGHT_BASE,
            targetHeight: STATE_HEIGHT_BASE,
            color: NEUTRAL_COLOR.clone(),
            targetColor: NEUTRAL_COLOR.clone(),
            emissive: NEUTRAL_EMISSIVE.clone(),
            targetEmissive: NEUTRAL_EMISSIVE.clone(),
            opacity: 1,
            targetOpacity: 1
          } as StateVisual
        } catch (err) {
          console.warn('Failed to process state feature:', err)
          return null
        }
      })
      .filter((state): state is StateVisual => Boolean(state))
  }, [features, projection])

  useEffect(() => {
    return () => {
      states.forEach((state) => {
        state.geometries.forEach((geometry) => geometry.dispose())
        state.material.dispose()
      })
    }
  }, [states])

  useEffect(() => {
    states.forEach((state) => {
      const outcome = outcomes.get(state.fips)
      if (!outcome || outcome.totalVotes === 0) {
        // No data yet - stay neutral
        state.targetColor.copy(NEUTRAL_COLOR)
        state.targetEmissive.copy(NEUTRAL_EMISSIVE)
        state.targetHeight = STATE_HEIGHT_BASE
        state.targetOpacity = 1
        return
      }

      const colorHex = getMarginColor(outcome.marginPct, outcome.winner)
      state.targetColor.set(colorHex)
      state.targetEmissive.copy(new THREE.Color(colorHex).multiplyScalar(0.42))
      const heightBoost = outcome.turnoutRatio * STATE_TURNOUT_SCALE
      state.targetHeight = STATE_HEIGHT_BASE + heightBoost
      state.targetOpacity = 1
    })
  }, [outcomes, selectedStates, states])

  useFrame((frameState) => {
    let needsUpdate = false
    
    states.forEach((state) => {
      const heightDiff = Math.abs(state.currentHeight - state.targetHeight)
      const colorDiff =
        Math.abs(state.color.r - state.targetColor.r) +
        Math.abs(state.color.g - state.targetColor.g) +
        Math.abs(state.color.b - state.targetColor.b)
      const opacityDiff = Math.abs(state.opacity - state.targetOpacity)
      
      if (heightDiff > 0.001 || colorDiff > 0.01 || opacityDiff > 0.01) {
        needsUpdate = true
        state.currentHeight = THREE.MathUtils.lerp(state.currentHeight, state.targetHeight, HEIGHT_SMOOTHING)
        state.color.lerp(state.targetColor, COLOR_SMOOTHING)
        state.emissive.lerp(state.targetEmissive, COLOR_SMOOTHING)
        state.opacity = THREE.MathUtils.lerp(state.opacity, state.targetOpacity, OPACITY_SMOOTHING)

        state.material.color.copy(state.color)
        state.material.emissive.copy(state.emissive)
        state.material.opacity = state.opacity

        state.meshes.forEach((mesh) => {
          if (!mesh) return
          const height = Math.max(state.currentHeight, MIN_HEIGHT)
          mesh.scale.y = height
          mesh.position.y = height / 2
        })
      }
    })
    
    if (needsUpdate) {
      frameState.invalidate()
    }
  })

  return (
    <group>
      {states
        .filter((state) => !selectedStates.includes(state.fips)) // Hide selected states
        .map((state) => (
          <group key={state.fips}>
            {state.geometries.map((geometry, index) => (
              <StateMesh
                key={`${state.fips}-${index}`}
                state={state}
                index={index}
                geometry={geometry}
                outcomes={outcomes}
                onStateSelect={onStateSelect}
                onHoverChange={onHoverChange}
              />
            ))}
          </group>
        ))}
    </group>
  )
}

function CountyMeshes({
  projection,
  countiesByState,
  selectedStates,
  outcomes,
  editedCounties,
  onCountySelect,
  onHoverChange
}: {
  projection: GeoProjection
  countiesByState: Map<string, Feature[]>
  selectedStates: string[]
  outcomes: Map<string, CountyRuntimeOutcome>
  editedCounties?: Set<string>
  onCountySelect?: (countyFips: string) => void
  onHoverChange?: (info: MapHoverInfo | null) => void
}) {
  const countyCacheRef = useRef<Map<string, CountyVisual[]>>(new Map())
  const previousSelectedRef = useRef<string[]>([])
  useEffect(() => {
    const cache = countyCacheRef.current
    return () => {
      cache.forEach((visuals) => {
        visuals.forEach((county) => {
          county.geometries.forEach((geometry) => geometry.dispose())
          county.material.dispose()
        })
      })
      cache.clear()
    }
  }, [projection])

  useEffect(() => {
    const previous = previousSelectedRef.current
    const removed = previous.filter((stateFips) => !selectedStates.includes(stateFips))
    if (removed.length) {
      const cache = countyCacheRef.current
      removed.forEach((stateFips) => {
        const visuals = cache.get(stateFips)
        if (!visuals) return
        visuals.forEach((county) => {
          county.geometries.forEach((geometry) => geometry.dispose())
          county.material.dispose()
        })
        cache.delete(stateFips)
      })
    }
    previousSelectedRef.current = selectedStates
  }, [selectedStates])

  const counties = useMemo<CountyVisual[]>(() => {
    if (!selectedStates.length) return []
    const cache = countyCacheRef.current
    const visuals: CountyVisual[] = []

    selectedStates.forEach((stateFips) => {
      const cached = cache.get(stateFips)
      if (cached) {
        visuals.push(...cached)
        return
      }

      const features = countiesByState.get(stateFips) ?? []
      const built: CountyVisual[] = features
        .map((featureItem) => {
          if (!featureItem.geometry) return null
          
          try {
            const shapes = createShapesFromFeature(featureItem.geometry as Polygon | MultiPolygon, projection)
            if (shapes.length === 0) return null

            const rawId =
              featureItem.id ?? (featureItem.properties as any)?.GEO_ID ?? (featureItem.properties as any)?.geoid
            if (!rawId) return null
            const countyFips = String(rawId).padStart(5, '0')
            if (countyFips.length !== 5) return null

            const geometries = shapes.map((shape) => {
              try {
                // 3D extruded geometry with depth
                const geometry = new THREE.ExtrudeGeometry(shape, {
                  depth: COUNTY_BASE_HEIGHT,
                  bevelEnabled: false
                })
                geometry.rotateX(-Math.PI / 2)
                return geometry
              } catch (err) {
                console.warn('Failed to create county geometry:', err)
                return null
              }
            }).filter((g): g is THREE.ExtrudeGeometry => g !== null)

            if (geometries.length === 0) return null

            const material = new THREE.MeshStandardMaterial({
              color: NEUTRAL_COLOR.clone(),
              emissive: NEUTRAL_EMISSIVE.clone(),
              emissiveIntensity: 0.72,
              metalness: 0.88,
              roughness: 0.32,
              transparent: true,
              opacity: 0 // Start invisible for fade-in
            })

            return {
              fips: countyFips,
              stateFips,
              name: (featureItem.properties as any)?.name ?? 'County',
              geometries,
              material,
              meshes: new Array<THREE.Mesh | null>(geometries.length).fill(null),
              color: NEUTRAL_COLOR.clone(),
              targetColor: NEUTRAL_COLOR.clone(),
              emissive: NEUTRAL_EMISSIVE.clone(),
              targetEmissive: NEUTRAL_EMISSIVE.clone(),
              currentHeight: COUNTY_BASE_HEIGHT,
              targetHeight: COUNTY_BASE_HEIGHT,
              currentOpacity: 0,
              targetOpacity: 0.96
            } as CountyVisual
          } catch (err) {
            console.warn('Failed to process county feature:', err)
            return null
          }
        })
        .filter((county): county is CountyVisual => Boolean(county))

      cache.set(stateFips, built)
      visuals.push(...built)
    })

    return visuals
  }, [countiesByState, projection, selectedStates])

  // Update target colors when outcomes change, but don't rebuild meshes
  useEffect(() => {
    counties.forEach((county) => {
      const outcome = outcomes.get(county.fips)
      if (!outcome || outcome.totalVotes === 0) {
        // No data yet - keep neutral
        county.targetColor.copy(NEUTRAL_COLOR)
        county.targetEmissive.copy(NEUTRAL_EMISSIVE)
        county.targetHeight = COUNTY_BASE_HEIGHT
        return
      }

      const colorHex = getMarginColor(outcome.marginPct, outcome.winner)
      const baseColor = new THREE.Color(colorHex)
      county.targetColor.copy(baseColor)

      if (editedCounties?.has(county.fips)) {
        county.targetEmissive.copy(HIGHLIGHT_EMISSIVE.clone().lerp(baseColor, 0.35))
      } else {
        county.targetEmissive.copy(baseColor.clone().multiplyScalar(0.45))
      }

      // Set height based on reporting percentage
      const reportingRatio = (outcome.reportingPercent ?? 0) / 100
      county.targetHeight = COUNTY_BASE_HEIGHT + (COUNTY_MAX_HEIGHT - COUNTY_BASE_HEIGHT) * reportingRatio
    })
  }, [counties, outcomes, editedCounties])

  useFrame((frameState) => {
    let needsUpdate = false
    
    counties.forEach((county) => {
      const colorDiff =
        Math.abs(county.color.r - county.targetColor.r) +
        Math.abs(county.color.g - county.targetColor.g) +
        Math.abs(county.color.b - county.targetColor.b)
      
      const heightDiff = Math.abs(county.currentHeight - county.targetHeight)
      const opacityDiff = Math.abs(county.currentOpacity - county.targetOpacity)
      
      if (colorDiff > 0.01 || heightDiff > 0.001 || opacityDiff > 0.01) {
        needsUpdate = true
        county.color.lerp(county.targetColor, COLOR_SMOOTHING)
        county.emissive.lerp(county.targetEmissive, COLOR_SMOOTHING)

        county.material.color.copy(county.color)
        county.material.emissive.copy(county.emissive)

        // Smooth height transition
        if (heightDiff > 0.001) {
          county.currentHeight += (county.targetHeight - county.currentHeight) * HEIGHT_SMOOTHING
          
          // Update all meshes for this county
          county.meshes.forEach((mesh) => {
            if (mesh) {
              mesh.scale.y = county.currentHeight / COUNTY_BASE_HEIGHT
            }
          })
        }

        // Smooth opacity transition (fade-in effect)
        if (opacityDiff > 0.01) {
          county.currentOpacity += (county.targetOpacity - county.currentOpacity) * OPACITY_SMOOTHING
          county.material.opacity = county.currentOpacity
        }
      }
    })
    
    if (needsUpdate) {
      frameState.invalidate()
    }
  })

  if (!counties.length) return null

  return (
    <group>
      {counties.map((county) =>
        county.geometries.map((geometry, index) => (
          <mesh
              key={`${county.fips}-${index}`}
              geometry={geometry}
              material={county.material}
              position={[0, 0.02, 0]} // Slight elevation above base plane
              ref={(ref) => {
                county.meshes[index] = ref
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                if (onHoverChange) {
                  const outcome = outcomes.get(county.fips)
                  onHoverChange({
                    type: 'county',
                    label: county.name,
                    stateFips: county.stateFips,
                    demVotes: outcome?.demVotes ?? 0,
                    gopVotes: outcome?.gopVotes ?? 0,
                    otherVotes: outcome?.otherVotes ?? 0,
                    totalVotes: outcome?.totalVotes ?? 0,
                    reportingPercent: outcome?.reportingPercent,
                    marginPct: outcome?.marginPct,
                    x: e.clientX,
                    y: e.clientY
                  })
                }
              }}
              onPointerMove={(e) => {
                if (onHoverChange) {
                  const outcome = outcomes.get(county.fips)
                  onHoverChange({
                    type: 'county',
                    label: county.name,
                    stateFips: county.stateFips,
                    demVotes: outcome?.demVotes ?? 0,
                    gopVotes: outcome?.gopVotes ?? 0,
                    otherVotes: outcome?.otherVotes ?? 0,
                    totalVotes: outcome?.totalVotes ?? 0,
                    reportingPercent: outcome?.reportingPercent,
                    marginPct: outcome?.marginPct,
                    x: e.clientX,
                    y: e.clientY
                  })
                }
              }}
              onPointerOut={() => {
                if (onHoverChange) {
                  onHoverChange(null)
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (onCountySelect) {
                  onCountySelect(county.fips)
                }
              }}
            />
          ))
      )}
    </group>
  )
}

const StudioMapScene: React.FC<StudioMapSceneProps> = ({
  projection,
  stateFeatures,
  countiesByState,
  stateOutcomes,
  countyOutcomes,
  selectedStates,
  onStateSelect,
  onCountySelect,
  editedCounties,
  onHoverChange
}) => {
  const { invalidate } = useThree()

  // Invalidate on data changes
  useEffect(() => {
    invalidate()
  }, [stateOutcomes, countyOutcomes, selectedStates, editedCounties, invalidate])

  return (
    <group>
      {/* Main ambient light for base illumination */}
      <ambientLight intensity={0.4} color="#ffffff" />
      
      {/* Key light - main directional light from top-right */}
      <directionalLight 
        position={[8, 12, 8]} 
        intensity={1.2} 
        castShadow 
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      
      {/* Fill light - softer light from opposite side */}
      <directionalLight 
        position={[-6, 8, -4]} 
        intensity={0.5} 
        color="#a8c5ff" 
      />
      
      {/* Rim light - highlights edges from behind */}
      <directionalLight 
        position={[0, 4, -10]} 
        intensity={0.6} 
        color="#7a9fff" 
      />
      
      {/* Hemisphere light for natural sky/ground gradient */}
      <hemisphereLight 
        color="#6b8fc4"      // Sky color (top)
        groundColor="#1a2742" // Ground color (bottom)
        intensity={0.5} 
      />
      
      {/* Point lights for accent highlights */}
      <pointLight position={[3, 5, 3]} intensity={0.4} color="#ffffff" distance={15} decay={2} />
      <pointLight position={[-3, 5, -3]} intensity={0.3} color="#8fa8ff" distance={15} decay={2} />

      <StateMeshes
        projection={projection}
        features={stateFeatures}
        outcomes={stateOutcomes}
        selectedStates={selectedStates}
        onStateSelect={onStateSelect}
        onHoverChange={onHoverChange}
      />

      <CountyMeshes
        projection={projection}
        countiesByState={countiesByState}
        selectedStates={selectedStates}
        outcomes={countyOutcomes}
        editedCounties={editedCounties}
        onCountySelect={onCountySelect}
        onHoverChange={onHoverChange}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_WIDTH + 2.5, MAP_HEIGHT + 2.5]} />
        <meshStandardMaterial 
          color="#0a1220" 
          metalness={0.3} 
          roughness={0.7}
          envMapIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

export default StudioMapScene
