import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { geoAlbersUsa, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection } from 'geojson'
import statesTopology from 'us-atlas/states-10m.json'
import countiesTopology from 'us-atlas/counties-10m.json'
import type { CountyGeoMetadata, CountyResult, CountySimulationState } from '../../types/sandbox'
import { MapHoverTooltip, type MapHoverInfo } from '../map/MapHoverTooltip'
import StudioMapScene, {
  type CountyRuntimeOutcome,
  type StateRuntimeOutcome
} from './StudioMapScene.tsx'

type TopologySource = Parameters<typeof feature>[0]
type TopologyGeometry = Parameters<typeof feature>[1]

const MAP_WIDTH = 8
const MAP_HEIGHT = 5

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

const countiesByStateSource = new Map<string, Feature[]>()
if (countiesFeatureCollection.features.length) {
  for (const countyFeature of countiesFeatureCollection.features as Feature[]) {
    const rawId = countyFeature.id ?? (countyFeature.properties as any)?.GEO_ID ?? (countyFeature.properties as any)?.geoid
    if (!rawId) continue
    const countyFips = String(rawId).padStart(5, '0')
    if (countyFips.length !== 5) continue
    const stateFips = countyFips.slice(0, 2)
    if (!stateFips) continue
    const bucket = countiesByStateSource.get(stateFips)
    if (bucket) bucket.push(countyFeature)
    else countiesByStateSource.set(stateFips, [countyFeature])
  }
}

type CountyBaseline = {
  stateFips: string
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  reportingPercent: number
}

type SimulationOutcomes = {
  stateOutcomes: Map<string, StateRuntimeOutcome>
  countyOutcomes: Map<string, CountyRuntimeOutcome>
  statesWithData: Set<string>
}

type StudioMapCanvasProps = {
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

const StudioMapCanvas = React.memo(
  ({
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
  }: StudioMapCanvasProps) => {
    return (
      <Canvas
        shadows
        frameloop="demand"
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false
        }}
        onCreated={(state) => {
          state.gl.setClearColor('#0a1220')
          state.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          state.setFrameloop('demand')
          // Enable tone mapping for better lighting
          state.gl.toneMappingExposure = 1.2
        }}
        onPointerLeave={() => onHoverChange?.(null)}
      >
        <PerspectiveCamera makeDefault position={[0, 6, 8]} fov={45} />
        <StudioMapScene
          projection={projection}
          stateFeatures={stateFeatures}
          countiesByState={countiesByState}
          stateOutcomes={stateOutcomes}
          countyOutcomes={countyOutcomes}
          selectedStates={selectedStates}
          onStateSelect={onStateSelect}
          onCountySelect={onCountySelect}
          editedCounties={editedCounties}
          onHoverChange={onHoverChange}
        />
        <StudioOrbitControls />
      </Canvas>
    )
  }
)

type StudioMap3DProps = {
  countyResults: CountyResult[]
  countyStates: Map<string, CountySimulationState>
  onCountyClick?: (fips: string, meta?: CountyGeoMetadata) => void
  editedCounties?: Set<string>
  scope?: 'ALL' | 'CUSTOM'
  customStates?: string[]
  onScopeChange?: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange?: (states: string[]) => void
  selectedStates?: string[]
  onSelectedStatesChange?: (states: string[]) => void
  height?: number
  className?: string
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const StudioOrbitControls: React.FC = () => {
  const { invalidate, camera } = useThree()

  return (
    <OrbitControls
      makeDefault
      camera={camera}
      target={[0, 0, 0]}
      enableZoom={true}
      enableRotate={true}
      enablePan={true}
      enableDamping={true}
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={40}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      panSpeed={1.2}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      mouseButtons={{
        LEFT: 2,   // ROTATE
        MIDDLE: 1, // DOLLY (zoom)
        RIGHT: 0   // PAN
      }}
      touches={{
        ONE: 2,  // ROTATE
        TWO: 3   // DOLLY_PAN
      }}
      onChange={() => invalidate()}
    />
  )
}

function buildBaseline(countyResults: CountyResult[]): Map<string, CountyBaseline> {
  const map = new Map<string, CountyBaseline>()

  for (const county of countyResults) {
    const rawFips = county.fips?.toString().padStart(5, '0')
    if (!rawFips || rawFips.length !== 5) continue
    const stateFips = rawFips.slice(0, 2)

    const demVotes = Number(county.demVotes ?? 0)
    const gopVotes = Number(county.gopVotes ?? 0)
    const otherVotes = Number(county.otherVotes ?? Math.max(0, county.totalVotes - demVotes - gopVotes))
    const totalVotes = Number(county.totalVotes ?? demVotes + gopVotes + otherVotes)
    const reportingPercent = Number(county.reportingPercent ?? 0)

    map.set(rawFips, {
      stateFips,
      demVotes,
      gopVotes,
      otherVotes,
      totalVotes,
      reportingPercent
    })
  }

  return map
}

function computeSimulationOutcomes(
  baseline: Map<string, CountyBaseline>,
  countyStates: Map<string, CountySimulationState>
): SimulationOutcomes {
  const stateAggregates = new Map<
    string,
    {
      demVotes: number
      gopVotes: number
      otherVotes: number
      totalVotes: number
      expectedVotes: number
      reportingWeighted: number
    }
  >()
  const countyOutcomes = new Map<string, CountyRuntimeOutcome>()
  const statesWithData = new Set<string>()

  baseline.forEach((baselineCounty, countyFips) => {
    const stateFips = baselineCounty.stateFips
    const simulation = countyStates.get(countyFips)

    const demVotes = simulation?.currentDemVotes ?? 0
    const gopVotes = simulation?.currentGopVotes ?? 0
    const totalVotes = simulation?.currentTotalVotes ?? 0
    const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
    const expectedVotes = Math.max(1, baselineCounty.totalVotes)
    const diffVotes = demVotes - gopVotes
    const winner: 'DEM' | 'GOP' | null = totalVotes > 0 && Math.abs(diffVotes) > 0 ? (diffVotes >= 0 ? 'DEM' : 'GOP') : null
    const marginPct = totalVotes > 0 ? (diffVotes / totalVotes) * 100 : 0
    const reportingPercent = simulation?.currentReportingPercent ?? 0
    const reportingRatio = clamp01(reportingPercent / 100)
    const turnoutRatio = expectedVotes > 0 ? clamp(totalVotes / expectedVotes, 0, 1.2) : 0

    countyOutcomes.set(countyFips, {
      stateFips,
      marginPct,
      winner,
      reportingRatio,
      turnoutRatio,
      totalVotes,
      expectedVotes,
      isFullyReported: simulation?.isFullyReported ?? false,
      demVotes,
      gopVotes,
      otherVotes,
      reportingPercent
    })

    statesWithData.add(stateFips)

    const aggregate = stateAggregates.get(stateFips) ?? {
      demVotes: 0,
      gopVotes: 0,
      otherVotes: 0,
      totalVotes: 0,
      expectedVotes: 0,
      reportingWeighted: 0
    }

    aggregate.demVotes += demVotes
    aggregate.gopVotes += gopVotes
    aggregate.otherVotes += otherVotes
    aggregate.totalVotes += totalVotes
    aggregate.expectedVotes += expectedVotes
    aggregate.reportingWeighted += reportingRatio * expectedVotes

    stateAggregates.set(stateFips, aggregate)
  })

  const stateOutcomes = new Map<string, StateRuntimeOutcome>()
  stateAggregates.forEach((aggregate, stateFips) => {
    const diffVotes = aggregate.demVotes - aggregate.gopVotes
    const winner: 'DEM' | 'GOP' | null =
      aggregate.totalVotes > 0 && Math.abs(diffVotes) > 0 ? (diffVotes >= 0 ? 'DEM' : 'GOP') : null
    const marginPct = aggregate.totalVotes > 0 ? (diffVotes / aggregate.totalVotes) * 100 : 0
    const turnoutRatio = aggregate.expectedVotes > 0 ? clamp(aggregate.totalVotes / aggregate.expectedVotes, 0, 1.2) : 0
    const reportingRatio = aggregate.expectedVotes > 0
      ? clamp01(aggregate.reportingWeighted / aggregate.expectedVotes)
      : 0

    stateOutcomes.set(stateFips, {
      marginPct,
      winner,
      reportingRatio,
      turnoutRatio,
      demVotes: aggregate.demVotes,
      gopVotes: aggregate.gopVotes,
      otherVotes: aggregate.otherVotes,
      totalVotes: aggregate.totalVotes,
      reportingPercent: reportingRatio * 100
    })
  })

  return { stateOutcomes, countyOutcomes, statesWithData }
}

const StudioMap3D: React.FC<StudioMap3DProps> = ({
  countyResults,
  countyStates,
  onCountyClick,
  editedCounties,
  scope = 'ALL',
  customStates,
  selectedStates: controlledSelectedStates,
  onSelectedStatesChange,
  height = 600,
  className = ''
}) => {
  const [internalSelectedStates, setInternalSelectedStates] = useState<string[]>([])
  const isControlled = Array.isArray(controlledSelectedStates)
  const selectedStates = isControlled ? controlledSelectedStates! : internalSelectedStates
  const [hoverInfo, setHoverInfo] = useState<MapHoverInfo | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const baseline = useMemo(() => buildBaseline(countyResults), [countyResults])

  // Maintain stable Map references - only create new ones when actual data changes
  const outcomesRef = useRef<SimulationOutcomes>({
    stateOutcomes: new Map(),
    countyOutcomes: new Map(),
    statesWithData: new Set()
  })

  const { stateOutcomes, countyOutcomes, statesWithData } = useMemo(() => {
    const fresh = computeSimulationOutcomes(baseline, countyStates)
    
    // Reuse existing Maps if data is identical
    let statesSame = fresh.stateOutcomes.size === outcomesRef.current.stateOutcomes.size
    let countiesSame = fresh.countyOutcomes.size === outcomesRef.current.countyOutcomes.size
    
    if (statesSame) {
      for (const [fips, outcome] of fresh.stateOutcomes) {
        const prev = outcomesRef.current.stateOutcomes.get(fips)
        if (!prev ||
            prev.marginPct !== outcome.marginPct ||
            prev.winner !== outcome.winner ||
            prev.totalVotes !== outcome.totalVotes ||
            prev.reportingRatio !== outcome.reportingRatio) {
          statesSame = false
          break
        }
      }
    }
    
    if (countiesSame) {
      for (const [fips, outcome] of fresh.countyOutcomes) {
        const prev = outcomesRef.current.countyOutcomes.get(fips)
        if (!prev ||
            prev.marginPct !== outcome.marginPct ||
            prev.winner !== outcome.winner ||
            prev.totalVotes !== outcome.totalVotes ||
            prev.reportingRatio !== outcome.reportingRatio) {
          countiesSame = false
          break
        }
      }
    }
    
    if (statesSame && countiesSame) {
      // Data unchanged - return stable references
      return outcomesRef.current
    }
    
    // Data changed - update ref and return new Maps
    outcomesRef.current = fresh
    return fresh
  }, [baseline, countyStates])

  const activeStateFilterRef = useRef<Set<string> | null>(null)
  const activeStateFilter = useMemo(() => {
    // Build the new Set
    let newFilter: Set<string> | null = null
    if (scope === 'CUSTOM' && Array.isArray(customStates) && customStates.length > 0) {
      newFilter = new Set(customStates.map((fips) => fips.padStart(2, '0')))
    } else if (statesWithData.size > 0) {
      newFilter = new Set(statesWithData)
    }

    // Check if content actually changed
    const prev = activeStateFilterRef.current
    if (!newFilter && !prev) return null
    if (!newFilter || !prev || newFilter.size !== prev.size) {
      activeStateFilterRef.current = newFilter
      return newFilter
    }

    // Deep equality check
    let changed = false
    newFilter.forEach((fips) => {
      if (!prev.has(fips)) changed = true
    })

    if (changed) {
      activeStateFilterRef.current = newFilter
      return newFilter
    }

    // Contents identical - return previous reference
    return prev
  }, [scope, customStates, statesWithData])

  const stateFeatures = useMemo(() => {
    const features = statesFeatureCollection.features as Feature[]
    if (!activeStateFilter) return features
    return features.filter((featureItem) => {
      const fips = String(featureItem.id ?? '').padStart(2, '0')
      return activeStateFilter.has(fips)
    })
  }, [activeStateFilter])

  const projection = useMemo<GeoProjection>(() => {
    const mapProjection = geoAlbersUsa()
    const featureCollection: FeatureCollection = stateFeatures.length
      ? { type: 'FeatureCollection', features: stateFeatures }
      : statesFeatureCollection
    mapProjection.fitSize([MAP_WIDTH, MAP_HEIGHT], featureCollection)
    return mapProjection
  }, [stateFeatures])

  const countiesByState = useMemo(() => {
    if (activeStateFilter) {
      const filtered = new Map<string, Feature[]>()
      countiesByStateSource.forEach((features, stateFips) => {
        if (activeStateFilter.has(stateFips)) {
          filtered.set(stateFips, features)
        }
      })
      return filtered
    }
    return countiesByStateSource
  }, [activeStateFilter])

  const updateSelectedStates = useCallback(
    (updater: (prev: string[]) => string[]) => {
      if (isControlled) {
        const next = updater(controlledSelectedStates ?? [])
        if (onSelectedStatesChange) {
          onSelectedStatesChange(next)
        }
        return
      }

      setInternalSelectedStates((previous) => {
        const next = updater(previous)
        if (onSelectedStatesChange) {
          onSelectedStatesChange(next)
        }
        return next
      })
    },
    [isControlled, controlledSelectedStates, onSelectedStatesChange]
  )

  useEffect(() => {
    const allowedStates = new Set<string>()
    if (activeStateFilter) {
      activeStateFilter.forEach((fips) => allowedStates.add(fips))
    } else if (statesWithData.size > 0) {
      statesWithData.forEach((fips) => allowedStates.add(fips))
    } else {
      for (const featureItem of statesFeatureCollection.features as Feature[]) {
        const fips = String(featureItem.id ?? '').padStart(2, '0')
        if (fips) allowedStates.add(fips)
      }
    }

    const filtered = selectedStates.filter((fips) => allowedStates.has(fips))
    const isSameLength = filtered.length === selectedStates.length
    if (isSameLength) return
    updateSelectedStates(() => filtered)
  }, [selectedStates, statesWithData, activeStateFilter, updateSelectedStates])

  const handleStateSelect = useCallback(
    (stateFips: string) => {
      updateSelectedStates((previous) => {
        if (previous.includes(stateFips)) {
          return previous.filter((entry) => entry !== stateFips)
        }
        return [...previous, stateFips]
      })
    },
    [updateSelectedStates]
  )

  const handleCountySelect = useCallback(
    (countyFips: string) => {
      if (onCountyClick) onCountyClick(countyFips)
    },
    [onCountyClick]
  )

  const handleHoverChange = useCallback(
    (info: MapHoverInfo | null) => {
      if (!info) {
        setHoverInfo(null)
        return
      }

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        setHoverInfo(info)
        return
      }

      setHoverInfo({
        ...info,
        x: info.x - rect.left,
        y: info.y - rect.top
      })
    },
    []
  )

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: `${height}px`, width: '100%', position: 'relative' }}
      onPointerLeave={() => handleHoverChange(null)}
    >
      <MapHoverTooltip info={hoverInfo} />
      <StudioMapCanvas
        projection={projection}
        stateFeatures={stateFeatures}
        countiesByState={countiesByState}
        stateOutcomes={stateOutcomes}
        countyOutcomes={countyOutcomes}
        selectedStates={selectedStates}
        onStateSelect={handleStateSelect}
        onCountySelect={handleCountySelect}
        editedCounties={editedCounties}
        onHoverChange={handleHoverChange}
      />
    </div>
  )
}

export default StudioMap3D
