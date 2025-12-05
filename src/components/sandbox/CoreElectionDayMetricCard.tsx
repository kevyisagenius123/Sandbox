import React, { useEffect, useMemo, useRef } from 'react'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import '@babylonjs/core/Rendering/outlineRenderer'

export type TurnoutHourBucket = {
  label: string
  value: number
  percent: number
}

export type CoreTurnoutMetrics = {
  totalTurnout: number
  expectedTurnout: number
  registeredVoters?: number | null
  turnoutPercentRegistered?: number | null
  countiesReporting: number
  countiesTotal: number
  turnoutByHour: TurnoutHourBucket[]
  turnoutVsBaseline?: number | null
  firstTimeTurnout?: number | null
}

const DEFAULT_METRICS: CoreTurnoutMetrics = {
  totalTurnout: 0,
  expectedTurnout: 1,
  countiesReporting: 0,
  countiesTotal: 0,
  turnoutByHour: [
    { label: 'Early', value: 0, percent: 0 },
    { label: 'Mid-day', value: 0, percent: 0 },
    { label: 'Late', value: 0, percent: 0 }
  ]
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

const formatInt = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—'
  return Math.round(value as number).toLocaleString()
}

const formatPercent = (value?: number | null, digits = 1) => {
  if (!Number.isFinite(value ?? NaN)) return '—'
  return `${(value as number).toFixed(digits)}%`
}

const metricPalette = ['#38bdf8', '#818cf8', '#f472b6', '#fb923c', '#34d399', '#facc15']

type ColumnData = {
  id: string
  label: string
  value: number
  normalized: number
  color: string
  position: Vector3
  emphasis?: boolean
}

export type CoreElectionDayMetricCardProps = {
  metrics?: CoreTurnoutMetrics
}

export const CoreElectionDayMetricCard: React.FC<CoreElectionDayMetricCardProps> = ({ metrics = DEFAULT_METRICS }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const columnMeshesRef = useRef<AbstractMesh[]>([])
  const baseMeshesRef = useRef<AbstractMesh[]>([])

  const resolvedMetrics = metrics ?? DEFAULT_METRICS

  const countyPercent = resolvedMetrics.countiesTotal > 0
    ? (resolvedMetrics.countiesReporting / resolvedMetrics.countiesTotal)
    : 0
  const baselineDelta = resolvedMetrics.turnoutVsBaseline ?? null
  const firstTimePercent = resolvedMetrics.firstTimeTurnout && resolvedMetrics.totalTurnout > 0
    ? (resolvedMetrics.firstTimeTurnout / resolvedMetrics.totalTurnout) * 100
    : null

  const columnData = useMemo<ColumnData[]>(() => {
    const expected = resolvedMetrics.expectedTurnout > 0 ? resolvedMetrics.expectedTurnout : Math.max(resolvedMetrics.totalTurnout, 1)

    const normalize = (value: number, max: number, bias = 0.2) => {
      if (!Number.isFinite(value) || max <= 0) return bias
      return clamp01(value / max) * (1 - bias) + bias
    }

    const baselineNormalized = baselineDelta !== null
      ? clamp01((baselineDelta + 20) / 40)
      : 0.45

    const firstTimeNormalized = firstTimePercent !== null
      ? clamp01(firstTimePercent / 40)
      : 0.35

    const turnoutPctRegistered = resolvedMetrics.turnoutPercentRegistered ?? null

    return [
      {
        id: 'total-turnout',
        label: 'Total Turnout',
        value: resolvedMetrics.totalTurnout,
        normalized: normalize(resolvedMetrics.totalTurnout, expected),
        color: metricPalette[0],
        position: new Vector3(-5, 0, -1.5),
        emphasis: true
      },
      {
        id: 'turnout-percent',
        label: 'Registered %',
        value: turnoutPctRegistered ?? 0,
        normalized: turnoutPctRegistered !== null ? clamp01(turnoutPctRegistered / 100) : 0.35,
        color: metricPalette[1],
        position: new Vector3(-1.5, 0, -1.5)
      },
      {
        id: 'county-coverage',
        label: 'County Coverage',
        value: countyPercent * 100,
        normalized: clamp01(countyPercent),
        color: metricPalette[2],
        position: new Vector3(2, 0, -1.5)
      },
      {
        id: 'baseline-delta',
        label: 'Vs Baseline',
        value: baselineDelta ?? 0,
        normalized: baselineNormalized,
        color: metricPalette[3],
        position: new Vector3(-3.5, 0, 1.9)
      },
      {
        id: 'first-time',
        label: 'First-Time',
        value: firstTimePercent ?? 0,
        normalized: firstTimeNormalized,
        color: metricPalette[4],
        position: new Vector3(0, 0, 1.9)
      },
      {
        id: 'hour-peak',
        label: 'Peak Hour',
        value: resolvedMetrics.turnoutByHour.reduce((max, bucket) => Math.max(max, bucket.percent), 0),
        normalized: clamp01(resolvedMetrics.turnoutByHour.reduce((max, bucket) => Math.max(max, bucket.percent), 0) / 100),
        color: metricPalette[5],
        position: new Vector3(3.5, 0, 1.9)
      }
    ]
  }, [baselineDelta, countyPercent, firstTimePercent, resolvedMetrics])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.01, 0.02, 0.05, 1)

    const camera = new ArcRotateCamera('core-metrics-camera', -Math.PI / 2.8, Math.PI / 2.6, 22, Vector3.Zero(), scene)
    camera.attachControl(canvas, true)
    camera.lowerRadiusLimit = 12
    camera.upperRadiusLimit = 32
    camera.wheelPrecision = 35
    camera.panningSensibility = 1200
    camera.allowUpsideDown = false

    const hemi = new HemisphericLight('core-metrics-hemi', new Vector3(0.2, 1, -0.3), scene)
    hemi.intensity = 1.1

    const rimLight = new HemisphericLight('core-metrics-rim', new Vector3(-0.4, 0.5, 0.6), scene)
    rimLight.diffuse = new Color3(0.2, 0.4, 0.6)
    rimLight.specular = new Color3(0.4, 0.6, 0.9)
    rimLight.intensity = 0.4

    const base = MeshBuilder.CreateBox('metrics-base', { width: 16, depth: 9, height: 0.35 }, scene)
    base.position.y = -0.2
    const baseMaterial = new StandardMaterial('metrics-base-mat', scene)
    baseMaterial.diffuseColor = new Color3(0.05, 0.07, 0.12)
    baseMaterial.specularColor = new Color3(0.1, 0.1, 0.15)
    baseMaterial.emissiveColor = new Color3(0.02, 0.03, 0.05)
    base.material = baseMaterial
    baseMeshesRef.current.push(base)

    const grid = MeshBuilder.CreateGround('metrics-grid', { width: 16, height: 9, subdivisions: 16 }, scene)
    grid.position.y = -0.2
    const gridMaterial = new StandardMaterial('metrics-grid-mat', scene)
    gridMaterial.diffuseColor = new Color3(0.08, 0.11, 0.2)
    gridMaterial.alpha = 0.4
    grid.material = gridMaterial
    baseMeshesRef.current.push(grid)

    sceneRef.current = scene
    engineRef.current = engine

    engine.runRenderLoop(() => {
      scene.render()
    })

    const resize = () => engine.resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      columnMeshesRef.current.forEach(mesh => mesh.dispose())
      columnMeshesRef.current = []
      baseMeshesRef.current.forEach(mesh => mesh.dispose())
      baseMeshesRef.current = []
      scene.dispose()
      engine.dispose()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    columnMeshesRef.current.forEach(mesh => mesh.dispose())
    columnMeshesRef.current = []

    columnData.forEach((column, index) => {
      const height = 0.5 + column.normalized * 6.5
      const mesh = MeshBuilder.CreateBox(`core-metric-column-${column.id}-${index}`, {
        width: column.emphasis ? 1.35 : 1,
        depth: column.emphasis ? 1.35 : 1,
        height
      }, scene)
      mesh.position = new Vector3(column.position.x, height / 2 + 0.05, column.position.z)
      mesh.renderOutline = true
      mesh.outlineColor = new Color3(1, 1, 1).scale(0.25)
      mesh.outlineWidth = 0.03

      const mat = new StandardMaterial(`core-metric-column-mat-${column.id}-${index}`, scene)
      const color = Color3.FromHexString(column.color)
      mat.diffuseColor = color
      mat.emissiveColor = color.scale(0.35)
      mat.specularColor = new Color3(0.3, 0.3, 0.35)
      mat.alpha = 0.96
      mesh.material = mat

      columnMeshesRef.current.push(mesh)
    })

    return () => {
      columnMeshesRef.current.forEach(mesh => mesh.dispose())
      columnMeshesRef.current = []
    }
  }, [columnData])

  const turnoutByHourLabels = useMemo(() => {
    return resolvedMetrics.turnoutByHour.map(bucket => `${bucket.label}: ${formatInt(bucket.value)} (${bucket.percent.toFixed(0)}%)`).join(' • ')
  }, [resolvedMetrics.turnoutByHour])

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/60">
      <div className="relative h-48 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 text-xs text-slate-300">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">Core Election Day Metrics</p>
            <p className="text-[10px] text-slate-400">Live turnout telemetry • BabylonJS instrumentation</p>
          </div>
          <div className="text-right text-[10px] text-slate-400">
            <p>Interactive 3D snapshot</p>
            <p>Drag to orbit • Scroll to zoom</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-slate-800/40 p-4 text-[11px] text-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total voter turnout</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100" style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>{formatInt(resolvedMetrics.totalTurnout)}</p>
          {resolvedMetrics.registeredVoters && (
            <p className="text-[10px] text-slate-500">Registered voters: {formatInt(resolvedMetrics.registeredVoters)}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turnout percentage</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100" style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>{formatPercent(resolvedMetrics.turnoutPercentRegistered)}</p>
          <p className="text-[10px] text-slate-500">Share of registered voters</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turnout by county</p>
          <p className="mt-1 text-xl font-semibold text-slate-100" style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>
            {resolvedMetrics.countiesReporting.toLocaleString()} / {resolvedMetrics.countiesTotal.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500">{formatPercent(countyPercent * 100, 1)} counties reporting</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turnout by hour</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-200">{turnoutByHourLabels}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vs previous baseline</p>
          <p className={`mt-1 text-2xl font-semibold ${baselineDelta !== null && baselineDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}`} style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>
            {baselineDelta !== null ? `${baselineDelta >= 0 ? '+' : ''}${baselineDelta.toFixed(1)} pts` : '—'}
          </p>
          <p className="text-[10px] text-slate-500">Compared to prior cycle</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">First-time voters</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100" style={{ fontFamily: 'var(--sandbox-numeric-font)' }}>{formatInt(resolvedMetrics.firstTimeTurnout)}</p>
          <p className="text-[10px] text-slate-500">{formatPercent(firstTimePercent)}</p>
        </div>
      </div>
    </div>
  )
}
