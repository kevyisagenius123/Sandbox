import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionManager,
  Animation,
  ArcRotateCamera,
  CircleEase,
  Color3,
  Color4,
  EasingFunction,
  Engine,
  ExecuteCodeAction,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  PolygonMeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector2,
  Vector3
} from '@babylonjs/core'
import earcut from 'earcut'
import { iowaMarginRgba } from '../../lib/election/swing'
import { ALL_US_STATES } from '../../constants/usStates'
import { Tooltip3D } from './Tooltip3D'
import type { CountyGeoMetadata, CountyResult, CountySimulationState } from '../../types/sandbox'

const STATE_FIPS_BY_ABBR = new Map(ALL_US_STATES.map((state) => [state.abbr.toUpperCase(), state.fips]))
const STATE_NAME_BY_FIPS = new Map(ALL_US_STATES.map((state) => [state.fips, state.name]))
const GEOJSON_BASE_URL = (import.meta as any)?.env?.BASE_URL || '/'
const EMPTY_STATE_ARRAY: string[] = []
const NO_DATA_RGB: [number, number, number] = [100 / 255, 116 / 255, 139 / 255]
const COLOR_SMOOTHING = 0.18
const COLOR_EPSILON = 0.003

export interface SandboxMapBabylonProps {
  className?: string
  countyResults: (CountyResult & { name?: string })[]
  countyStates: Map<string, CountySimulationState>
  editedCounties: Set<string>
  onCountyClick: (fips: string, meta?: CountyGeoMetadata) => void
  selectedStates?: string[]
  onStateSelect?: (stateFips: string) => void
  opacity?: number
  highQuality?: boolean
}

export const SandboxMapBabylon: React.FC<SandboxMapBabylonProps> = ({
  className,
  countyResults,
  countyStates,
  onCountyClick,
  selectedStates,
  onStateSelect,
  opacity = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  
  // Refs to access latest data inside Babylon callbacks/render loop
  const countyStatesRef = useRef(countyStates)
  const countyMaterialsRef = useRef<Map<string, StandardMaterial>>(new Map())
  const stateMeshesRef = useRef<Map<string, Mesh[]>>(new Map())
  const stateMaterialsRef = useRef<Map<string, StandardMaterial>>(new Map())
  const stateTotalsRef = useRef<Map<string, { dem: number; gop: number; other: number; total: number }>>(new Map())
  const countyNamesRef = useRef<Map<string, string>>(new Map())
  const hoveredItemRef = useRef<{ type: 'county' | 'state'; id: string; label?: string } | null>(null)
  const countyCleanupRef = useRef<Map<string, () => void>>(new Map())
  const pendingCountyLoadsRef = useRef<Set<string>>(new Set())
  const pendingColorTweensRef = useRef<Map<string, [number, number, number]>>(new Map())
  const lastPaintedMarginRef = useRef<Map<string, number | null>>(new Map())
  const pendingStateColorTweensRef = useRef<Map<string, [number, number, number]>>(new Map())
  const lastStateMarginRef = useRef<Map<string, number | null>>(new Map())
  const loadCountyMeshesRef = useRef<((stateId: string) => Promise<() => void>) | null>(null)
  const latestSelectedStatesRef = useRef<string[]>([])
  const latestSelectedStatesSetRef = useRef<Set<string>>(new Set())
  const statesWithDataRef = useRef<Set<string>>(new Set())
  const onStateSelectRef = useRef(onStateSelect)

  useEffect(() => {
    onStateSelectRef.current = onStateSelect
  }, [onStateSelect])

  const disposeCountyMeshes = useCallback(() => {
    countyCleanupRef.current.forEach((cleanup) => cleanup())
    countyCleanupRef.current.clear()
    pendingCountyLoadsRef.current.clear()
    pendingColorTweensRef.current.clear()
    lastPaintedMarginRef.current.clear()
  }, [])

  const disposeStateMaterials = useCallback(() => {
    stateMaterialsRef.current.forEach((mat) => mat.dispose())
    stateMaterialsRef.current.clear()
    stateMaterialsRef.current = new Map<string, StandardMaterial>()
    pendingStateColorTweensRef.current.clear()
    lastStateMarginRef.current.clear()
  }, [])

  const enqueueColorTween = useCallback((fips: string, rgb: [number, number, number], margin: number | null) => {
    const lastMargin = lastPaintedMarginRef.current.get(fips)
    if (lastMargin != null && margin != null && Math.abs(lastMargin - margin) < 0.1) {
      return
    }
    lastPaintedMarginRef.current.set(fips, margin)
    pendingColorTweensRef.current.set(fips, rgb)
  }, [])

  const enqueueStateColorTween = useCallback((stateId: string, rgb: [number, number, number], margin: number | null) => {
    const lastMargin = lastStateMarginRef.current.get(stateId)
    if (lastMargin != null && margin != null && Math.abs(lastMargin - margin) < 0.1) {
      return
    }
    lastStateMarginRef.current.set(stateId, margin)
    pendingStateColorTweensRef.current.set(stateId, rgb)
  }, [])

  const stepTweenMap = (
    pendingMap: Map<string, [number, number, number]>,
    materialsMap: Map<string, StandardMaterial>,
    marginMap: Map<string, number | null>
  ) => {
    if (!pendingMap.size) return

    for (const [key, target] of pendingMap.entries()) {
      const material = materialsMap.get(key)
      if (!material) {
        pendingMap.delete(key)
        marginMap.delete(key)
        continue
      }

      const color = material.diffuseColor
      color.r += (target[0] - color.r) * COLOR_SMOOTHING
      color.g += (target[1] - color.g) * COLOR_SMOOTHING
      color.b += (target[2] - color.b) * COLOR_SMOOTHING

      const done =
        Math.abs(color.r - target[0]) < COLOR_EPSILON &&
        Math.abs(color.g - target[1]) < COLOR_EPSILON &&
        Math.abs(color.b - target[2]) < COLOR_EPSILON

      if (done) {
        color.r = target[0]
        color.g = target[1]
        color.b = target[2]
        pendingMap.delete(key)
      }
    }
  }

  const normalizedSelectedStates = useMemo(() => {
    if (!selectedStates || selectedStates.length === 0) return EMPTY_STATE_ARRAY
    return selectedStates.map((value) => String(value).padStart(2, '0'))
  }, [selectedStates])

  const statesWithData = useMemo(() => {
    if (!countyResults || countyResults.length === 0) return new Set<string>()
    const set = new Set<string>()
    countyResults.forEach((county) => {
      if (county?.fips) {
        set.add(String(county.fips).padStart(5, '0').slice(0, 2))
        return
      }
      if (county?.state) {
        const fips = STATE_FIPS_BY_ABBR.get(county.state.trim().toUpperCase())
        if (fips) set.add(fips)
      }
    })
    return set
  }, [countyResults])

  const syncStateAppearance = useCallback(() => {
    const stateMeshes = stateMeshesRef.current
    const loader = loadCountyMeshesRef.current
    if (!stateMeshes || stateMeshes.size === 0) return

    const selectedSet = latestSelectedStatesSetRef.current
    const dataSet = statesWithDataRef.current
    const shouldFilterByData = dataSet.size > 0
    const visibleValue = Math.max(0, Math.min(1, opacity))

    stateMeshes.forEach((meshes, stateId) => {
      const stateHasData = !shouldFilterByData || dataSet.has(stateId)
      const isSelected = selectedSet.has(stateId)
      const shouldShowState = stateHasData && !isSelected
      meshes.forEach((mesh) => {
        mesh.isVisible = shouldShowState
        mesh.isPickable = stateHasData && !isSelected
        mesh.visibility = shouldShowState ? visibleValue : 0
      })
    })

    const statesToRemove: string[] = []
    countyCleanupRef.current.forEach((cleanup, stateId) => {
      const stateHasData = !shouldFilterByData || dataSet.has(stateId)
      if (!selectedSet.has(stateId) || !stateHasData) {
        cleanup()
        statesToRemove.push(stateId)
      }
    })
    statesToRemove.forEach((stateId) => countyCleanupRef.current.delete(stateId))

    if (!loader) return

    selectedSet.forEach((stateId) => {
      const stateHasData = !shouldFilterByData || dataSet.has(stateId)
      if (!stateHasData) return
      if (!stateMeshes.has(stateId)) return
      if (countyCleanupRef.current.has(stateId) || pendingCountyLoadsRef.current.has(stateId)) return
      pendingCountyLoadsRef.current.add(stateId)
      loader(stateId)
        .then((cleanup) => {
          pendingCountyLoadsRef.current.delete(stateId)
          if (latestSelectedStatesSetRef.current.has(stateId)) {
            countyCleanupRef.current.set(stateId, cleanup)
          } else {
            cleanup()
          }
        })
        .catch((error) => {
          pendingCountyLoadsRef.current.delete(stateId)
          console.error('[SandboxMapBabylon] Failed to render counties for state', stateId, error)
        })
    })
  }, [opacity])

  useEffect(() => {
    latestSelectedStatesRef.current = normalizedSelectedStates
    latestSelectedStatesSetRef.current = new Set(normalizedSelectedStates)
    syncStateAppearance()
  }, [normalizedSelectedStates, syncStateAppearance])

  useEffect(() => {
    statesWithDataRef.current = new Set(statesWithData)
    syncStateAppearance()
  }, [statesWithData, syncStateAppearance])

  useEffect(() => {
    syncStateAppearance()
  }, [syncStateAppearance])

  useEffect(() => {
    countyStatesRef.current = countyStates
  }, [countyStates])

  useEffect(() => {
    if (!countyResults) return
    const map = new Map<string, string>()
    countyResults.forEach(c => {
      if (c.fips && c.name) {
        map.set(String(c.fips).padStart(5, '0'), c.name)
      }
    })
    countyNamesRef.current = map
  }, [countyResults])

  // Effect to update colors when data changes
  useEffect(() => {
    const materials = countyMaterialsRef.current
    const states = countyStatesRef.current

    if (!materials.size) return

    materials.forEach((_mat, fips) => {
      const state = states.get(fips)
      if (state) {
        const demVotes = state.currentDemVotes ?? 0
        const gopVotes = state.currentGopVotes ?? 0
        const otherVotes = state.currentOtherVotes ?? Math.max((state.currentTotalVotes ?? 0) - demVotes - gopVotes, 0)
        const totalVotes = Math.max(state.currentTotalVotes ?? demVotes + gopVotes + otherVotes, 1)
        const margin = ((gopVotes - demVotes) / totalVotes) * 100
        const [r, g, b] = iowaMarginRgba(margin)
        enqueueColorTween(fips, [r / 255, g / 255, b / 255], margin)
      } else {
        enqueueColorTween(fips, NO_DATA_RGB, null)
      }
    })
  }, [countyStates, enqueueColorTween])

  const applyStateColorTargets = useCallback(() => {
    const stateMaterials = stateMaterialsRef.current
    if (!stateMaterials.size) return

    const totals = new Map<string, { dem: number; gop: number; other: number; total: number }>()

    countyStatesRef.current.forEach((countyState) => {
      if (!countyState?.fips) return
      const stateId = countyState.fips.slice(0, 2)
      if (!stateId) return
      if (!totals.has(stateId)) {
        totals.set(stateId, { dem: 0, gop: 0, other: 0, total: 0 })
      }
      const entry = totals.get(stateId)!
      const demVotes = countyState.currentDemVotes ?? 0
      const gopVotes = countyState.currentGopVotes ?? 0
      const otherVotes = countyState.currentOtherVotes ?? Math.max((countyState.currentTotalVotes ?? 0) - demVotes - gopVotes, 0)
      const totalVotes = Math.max(countyState.currentTotalVotes ?? demVotes + gopVotes + otherVotes, 0)
      entry.dem += demVotes
      entry.gop += gopVotes
      entry.other += otherVotes
      entry.total += totalVotes
    })

    stateTotalsRef.current = totals

    stateMaterials.forEach((_mat, stateId) => {
      const entry = totals.get(stateId)
      if (!entry || entry.total <= 0) {
        enqueueStateColorTween(stateId, NO_DATA_RGB, null)
        return
      }
      const margin = ((entry.gop - entry.dem) / Math.max(entry.total, 1)) * 100
      const [r, g, b] = iowaMarginRgba(margin)
      enqueueStateColorTween(stateId, [r / 255, g / 255, b / 255], margin)
    })
  }, [enqueueStateColorTween])

  useEffect(() => {
    applyStateColorTargets()
  }, [countyStates, applyStateColorTargets])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: Engine | null = null
    let scene: Scene | null = null
    const assetBase = GEOJSON_BASE_URL

    const projectToBoard = (lon: number, lat: number): Vector2 => {
      const minLon = -125
      const maxLon = -66
      const minLat = 24
      const maxLat = 50
      const width = 24
      const height = 14

      const normalizedX = (lon - minLon) / (maxLon - minLon)
      const normalizedY = (lat - minLat) / (maxLat - minLat)

      const x = (normalizedX - 0.5) * width
      const z = (0.5 - normalizedY) * height

      return new Vector2(x, z)
    }

    const loadCountiesGeometry = async (targetScene: Scene, parent: TransformNode, stateId: string, tooltip: Tooltip3D) => {
      try {
        const response = await fetch(`${assetBase}gz_2010_us_050_00_500k.json`)
        if (!response.ok) throw new Error(`Failed to fetch counties GeoJSON: ${response.status}`)
        const data = await response.json()
        const features = data.features?.filter((f: any) => f?.properties?.STATE === stateId)
        if (!features || features.length === 0) throw new Error(`Counties missing for state ${stateId} in GeoJSON asset`)

        // Palette for randomizing county colors to distinguish them
        // Using Slate-500 (#64748b) as base for no-data state
        const baseColor = Color3.FromHexString('#64748b')

        const createdMeshes: Mesh[] = []

        const buildMeshFromPolygon = (
          polygon: number[][],
          holeGroups: number[][][],
          name: string,
          fips: string,
          countyName: string
        ) => {
          const shape = polygon.map(([lon, lat]) => projectToBoard(lon, lat))
          const builder = new PolygonMeshBuilder(name, shape, targetScene, earcut)
          holeGroups.forEach((hole) => builder.addHole(hole.map(([lon, lat]) => projectToBoard(lon, lat))))
          const mesh = builder.build(true, 0.1) as Mesh
          mesh.rotationQuaternion = null
          mesh.position.y = 0.15
          mesh.scaling.z = -1
          mesh.scaling.y = 0 // Start flat for animation
          mesh.parent = parent
          
          const mat = new StandardMaterial(`${name}-mat`, targetScene)
          
          // Initial color assignment
          const state = countyStatesRef.current.get(fips)
          if (state) {
            const demVotes = state.currentDemVotes ?? 0
            const gopVotes = state.currentGopVotes ?? 0
            const otherVotes = state.currentOtherVotes ?? Math.max((state.currentTotalVotes ?? 0) - demVotes - gopVotes, 0)
            const totalVotes = Math.max(state.currentTotalVotes ?? demVotes + gopVotes + otherVotes, 1)
            const margin = ((gopVotes - demVotes) / totalVotes) * 100
            const [r, g, b] = iowaMarginRgba(margin)
            mat.diffuseColor = new Color3(r / 255, g / 255, b / 255)
            lastPaintedMarginRef.current.set(fips, margin)
          } else {
            mat.diffuseColor = baseColor.clone()
            lastPaintedMarginRef.current.set(fips, null)
          }
          
          mat.specularColor = new Color3(0.2, 0.2, 0.2)
          mesh.material = mat
          
          // Store material for updates
          countyMaterialsRef.current.set(fips, mat)
          
          // Store FIPS in metadata for cleanup
          mesh.metadata = { fips, label: countyName }

          // Enable edges to make boundaries distinct
          mesh.enableEdgesRendering()
          mesh.edgesWidth = 2.0
          mesh.edgesColor = new Color4(0, 0, 0, 0.4)
          
          // Click action for counties
          mesh.actionManager = new ActionManager(targetScene)
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
              onCountyClick(fips)
            })
          )
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
              const label = countyNamesRef.current.get(fips) ?? countyName
              hoveredItemRef.current = { type: 'county', id: fips, label }
            })
          )
          mesh.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
              if (hoveredItemRef.current?.id === fips) {
                hoveredItemRef.current = null
                tooltip.update(null, Vector3.Zero())
              }
            })
          )

          createdMeshes.push(mesh)

          // Animate scaling Y
          const animation = new Animation(
            'scaleY',
            'scaling.y',
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
          )
          const keys = [
            { frame: 0, value: 0 },
            { frame: 60, value: 1 }
          ]
          animation.setKeys(keys)
          const easingFunction = new CircleEase()
          easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
          animation.setEasingFunction(easingFunction)
          mesh.animations.push(animation)
          targetScene.beginAnimation(mesh, 0, 60, false)
        }

        features.forEach((feature: any, index: number) => {
          const countyName = String(feature?.properties?.NAME ?? 'Unknown County').trim()
          const name = `county-${countyName}-${index}`
          // Construct FIPS from STATE + COUNTY
          const fips = feature.properties.STATE + feature.properties.COUNTY
          const geometry = feature.geometry
          if (geometry.type === 'Polygon') {
            const [outer, ...holes] = geometry.coordinates
            buildMeshFromPolygon(outer, holes, name, fips, countyName)
          } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((poly: number[][][], pIndex: number) => {
              const [outer, ...holes] = poly
              buildMeshFromPolygon(outer, holes, `${name}-p${pIndex}`, fips, countyName)
            })
          }
        })

        return () => {
          createdMeshes.forEach((mesh) => {
            // Remove from materials map
            if (mesh.metadata?.fips) {
              countyMaterialsRef.current.delete(mesh.metadata.fips)
              pendingColorTweensRef.current.delete(mesh.metadata.fips)
              lastPaintedMarginRef.current.delete(mesh.metadata.fips)
            }
            mesh.material?.dispose()
            mesh.dispose()
          })
        }
      } catch (error) {
        console.error('[SandboxMapBabylon] Failed to render counties geometry', error)
        return () => {}
      }
    }

    const loadStatesGeometry = async (targetScene: Scene, parent: TransformNode, onClick: (stateId: string) => void, tooltip: Tooltip3D) => {
      try {
        const response = await fetch(`${assetBase}gz_2010_us_040_00_500k.json`)
        if (!response.ok) throw new Error(`Failed to fetch states GeoJSON: ${response.status}`)
        const data = await response.json()
        const features = data.features
        if (!features || features.length === 0) throw new Error('No features found in GeoJSON asset')

        const createdMeshes: Mesh[] = []
        const meshesByState: Map<string, Mesh[]> = new Map()
        const materialsByState: Map<string, StandardMaterial> = new Map()

        const getStateMaterial = (stateId: string) => {
          if (!materialsByState.has(stateId)) {
            const mat = new StandardMaterial(`stateMaterial-${stateId}`, targetScene)
            mat.diffuseColor = Color3.FromHexString('#64748b')
            mat.specularColor = new Color3(0.2, 0.2, 0.2)
            mat.emissiveColor = new Color3(0, 0, 0)
            mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
            materialsByState.set(stateId, mat)
            lastStateMarginRef.current.set(stateId, null)
          }
          return materialsByState.get(stateId)!
        }

        const buildMeshFromPolygon = (polygon: number[][], holeGroups: number[][][], name: string, normalizedStateId: string) => {
          const shape = polygon.map(([lon, lat]) => projectToBoard(lon, lat))
          const builder = new PolygonMeshBuilder(name, shape, targetScene, earcut)
          holeGroups.forEach((hole) => builder.addHole(hole.map(([lon, lat]) => projectToBoard(lon, lat))))
          const mesh = builder.build(true, 0.15) as Mesh
          mesh.rotationQuaternion = null
          mesh.position.y = 0.15
          mesh.scaling.z = -1
          mesh.parent = parent
          mesh.material = getStateMaterial(normalizedStateId)
          mesh.metadata = { stateId: normalizedStateId }

          mesh.enableEdgesRendering()
          mesh.edgesWidth = 1.4
          mesh.edgesColor = new Color4(0.1, 0.1, 0.1, 0.35)

          createdMeshes.push(mesh)

          if (!meshesByState.has(normalizedStateId)) {
            meshesByState.set(normalizedStateId, [])
          }
          meshesByState.get(normalizedStateId)!.push(mesh)
        }

        const processGeometry = (geometry: any, name: string, rawStateId: string) => {
          const normalizedStateId = rawStateId ? String(rawStateId).padStart(2, '0') : ''
          if (!normalizedStateId || normalizedStateId === '00') return
          if (geometry.type === 'Polygon') {
            const [outer, ...holes] = geometry.coordinates
            buildMeshFromPolygon(outer, holes, name, normalizedStateId)
          } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((poly: number[][][], pIndex: number) => {
              const [outer, ...holes] = poly
              buildMeshFromPolygon(outer, holes, `${name}-p${pIndex}`, normalizedStateId)
            })
          }
        }

        features.forEach((feature: any, index: number) => {
          const name = `state-${feature.properties.NAME}-${index}`
          processGeometry(feature.geometry, name, feature.properties.STATE)
        })

        meshesByState.forEach((meshes, stateId) => {
          meshes.forEach((mesh) => {
            mesh.actionManager = new ActionManager(targetScene)
            mesh.actionManager.registerAction(
              new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
                onClick(stateId)
              })
            )
            mesh.actionManager.registerAction(
              new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
                  const label = STATE_NAME_BY_FIPS.get(stateId) ?? 'State'
                  hoveredItemRef.current = { type: 'state', id: stateId, label }
              })
            )
            mesh.actionManager.registerAction(
              new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
                if (hoveredItemRef.current?.id === stateId) {
                  hoveredItemRef.current = null
                  tooltip.update(null, Vector3.Zero())
                }
              })
            )
          })
        })

        return {
          dispose: () => {
            createdMeshes.forEach((mesh) => {
              if (!mesh.isDisposed()) mesh.dispose()
            })
          },
          meshesByState,
          materialsByState
        }
      } catch (error) {
        console.error('[SandboxMapBabylon] Failed to render states geometry', error)
        return { dispose: () => {}, meshesByState: new Map<string, Mesh[]>(), materialsByState: new Map<string, StandardMaterial>() }
      }
    }

    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, true)
      scene = new Scene(engine)
      scene.clearColor = Color4.FromHexString('#020617ff')

      const tooltip = new Tooltip3D(scene)

      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          const hovered = hoveredItemRef.current
          const pickInfo = pointerInfo.pickInfo
          const pickedPoint = pickInfo?.pickedPoint

          if (!hovered || !pickedPoint) {
            tooltip.update(null, Vector3.Zero())
            return
          }

          const x = scene!.pointerX
          const y = scene!.pointerY
          
          if (hovered.type === 'county') {
            const fips = hovered.id
            const state = countyStatesRef.current.get(fips)
            const label = hovered.label ?? countyNamesRef.current.get(fips) ?? fips
            if (state) {
              const demVotes = state.currentDemVotes ?? 0
              const gopVotes = state.currentGopVotes ?? 0
              const otherVotes = state.currentOtherVotes ?? 0
              const totalVotes = state.currentTotalVotes ?? (demVotes + gopVotes + otherVotes)
              const margin = totalVotes > 0 ? ((gopVotes - demVotes) / totalVotes) * 100 : 0
              
              tooltip.update({
                x,
                y,
                id: fips,
                label,
                subtitle: STATE_NAME_BY_FIPS.get(fips.substring(0, 2)),
                type: 'county',
                stateFips: fips.substring(0, 2),
                demVotes,
                gopVotes,
                otherVotes,
                totalVotes,
                reportingPercent: state.currentReportingPercent ?? 0,
                marginPct: margin
              }, pickedPoint)
            }
          } else if (hovered.type === 'state') {
            const stateId = hovered.id
            const totals = stateTotalsRef.current.get(stateId)
            const label = hovered.label ?? STATE_NAME_BY_FIPS.get(stateId) ?? stateId
            if (totals) {
              const margin = totals.total > 0 ? ((totals.gop - totals.dem) / totals.total) * 100 : 0
              tooltip.update({
                x,
                y,
                id: stateId,
                label,
                type: 'state',
                stateFips: stateId,
                demVotes: totals.dem,
                gopVotes: totals.gop,
                otherVotes: totals.other,
                totalVotes: totals.total,
                reportingPercent: 100,
                marginPct: margin
              }, pickedPoint)
            }
          }
        }
      })

      const camera = new ArcRotateCamera('sandboxCamera', -Math.PI / 2.25, Math.PI / 3, 32, Vector3.Zero(), scene)
      camera.lowerRadiusLimit = 2
      camera.upperRadiusLimit = 60
      camera.wheelDeltaPercentage = 0.025
      camera.panningSensibility = 100
      camera.attachControl(canvas, false)

      new HemisphericLight('ambient', new Vector3(0.2, 1, 0.2), scene)

      const keyLight = new HemisphericLight('key', new Vector3(0.8, 0.8, 0.2), scene)
      keyLight.intensity = 0.65

      const fillLight = new HemisphericLight('fill', new Vector3(-0.3, 0.6, -0.8), scene)
      fillLight.groundColor = new Color3(0.12, 0.27, 0.54)
      fillLight.intensity = 0.4

      const surfaceNode = new TransformNode('sandboxSurface', scene)

      loadCountyMeshesRef.current = (stateId: string) => loadCountiesGeometry(scene!, surfaceNode, stateId, tooltip)

      const board = MeshBuilder.CreateGround('sandboxBoard', { width: 24, height: 14, subdivisions: 4 }, scene)
      const boardMaterial = new StandardMaterial('sandboxBoardMaterial', scene)
      boardMaterial.diffuseColor = Color3.FromHexString('#1f2937')
      boardMaterial.specularColor = new Color3(0.2, 0.2, 0.25)
      boardMaterial.emissiveColor = new Color3(0.02, 0.04, 0.08)
      board.material = boardMaterial
      board.parent = surfaceNode

      const rim = MeshBuilder.CreateGround('sandboxRim', { width: 24.5, height: 14.5, subdivisions: 2 }, scene)
      const rimMaterial = new StandardMaterial('sandboxRimMaterial', scene)
      rimMaterial.wireframe = true
      rimMaterial.diffuseColor = Color3.FromHexString('#94a3b8')
      rimMaterial.emissiveColor = Color3.FromHexString('#94a3b8')
      rimMaterial.alpha = 0.6
      rim.material = rimMaterial
      rim.position.y = 0.02
      rim.parent = surfaceNode

      scene.registerBeforeRender(() => {
        const t = performance.now() * 0.0002
        surfaceNode.rotation.y = Math.sin(t) * 0.05
        stepTweenMap(pendingColorTweensRef.current, countyMaterialsRef.current, lastPaintedMarginRef.current)
        stepTweenMap(pendingStateColorTweensRef.current, stateMaterialsRef.current, lastStateMarginRef.current)
      })

      const handleResize = () => {
        engine?.resize()
      }

      let stateControls: { dispose: () => void } | undefined

      const onStateClick = (stateId: string) => {
        const normalizedStateId = stateId ? String(stateId).padStart(2, '0') : ''
        if (normalizedStateId) {
          onStateSelectRef.current?.(normalizedStateId)
        }
      }

      loadStatesGeometry(scene, surfaceNode, onStateClick, tooltip)
        .then(({ dispose, meshesByState, materialsByState }) => {
          stateControls = { dispose }
          stateMeshesRef.current = meshesByState
          stateMaterialsRef.current = materialsByState
          pendingStateColorTweensRef.current.clear()
          applyStateColorTargets()
          syncStateAppearance()
        })
        .catch((error) => {
          console.error('[SandboxMapBabylon] Unable to load states mesh', error)
        })

      window.addEventListener('resize', handleResize)
      engine.runRenderLoop(() => {
        scene?.render()
      })

      return () => {
        window.removeEventListener('resize', handleResize)
        stateControls?.dispose()
        disposeStateMaterials()
        disposeCountyMeshes()
        stateMeshesRef.current.clear()
        loadCountyMeshesRef.current = null
        tooltip.dispose()
        scene?.dispose()
        engine?.dispose()
      }
    } catch (err) {
      console.error('[SandboxMapBabylon] Failed to init Babylon.js scene', err)
      setInitError('Unable to initialize the Babylon.js scene. Check WebGL support and try again.')
    }

    return () => {
      disposeStateMaterials()
      disposeCountyMeshes()
      stateMeshesRef.current.clear()
      loadCountyMeshesRef.current = null
      scene?.dispose()
      engine?.dispose()
    }
  }, [applyStateColorTargets])

  return (
    <div className={`relative h-full w-full bg-slate-950 ${className ?? ''}`.trim()}>
      {initError ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-rose-200">
          {initError}
        </div>
      ) : null}
      <canvas ref={canvasRef} className="h-full w-full outline-none touch-none" />
      <div className="pointer-events-none absolute left-4 bottom-4 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-200">
        Prototype surface
      </div>
    </div>
  )
}

export default SandboxMapBabylon
