import {
  ActionManager,
  Color3,
  ExecuteCodeAction,
  Mesh,
  MeshBuilder,
  Nullable,
  Observer,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core'
import type { PointerInfo } from '@babylonjs/core'
import { Matrix } from '@babylonjs/core/Maths/math.vector'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { SWING_KNOB_CONFIG } from '../../constants/swingometer'
import type { SwingKnobConfig } from '../../constants/swingometer'
import type { SwingKnobKey, SwingKnobs } from '../../types/swingometer'

interface SidebarCallbacks {
  onChange: (key: SwingKnobKey, value: number) => void
  onReset?: () => void
}

interface RowEntry {
  root: TransformNode
  labelPlane: Mesh
  track: Mesh
  trackMaterial: StandardMaterial
  handle: Mesh
  handleMaterial: StandardMaterial
  labelTexture: DynamicTexture
  labelMaterial: StandardMaterial
  trackWidth: number
  config: SwingKnobConfig
  currentValue: number
  valuePlane: Mesh
  valueMaterial: StandardMaterial
  valueTexture: DynamicTexture
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const snapToStep = (value: number, step: number) => {
  if (step <= 0) return value
  const snapped = Math.round(value / step) * step
  return Number(snapped.toFixed(4))
}

export class SwingometerSidebar3D {
  private scene: Scene
  private root: TransformNode
  private background: Mesh
  private backgroundMaterial: StandardMaterial
  private headerPlane: Mesh
  private headerTexture: DynamicTexture
  private headerMaterial: StandardMaterial
  private rows = new Map<SwingKnobKey, RowEntry>()
  private pointerObserver: Nullable<Observer<PointerInfo>> = null
  private activeKnob: SwingKnobKey | null = null
  private callbacks: SidebarCallbacks
  private resetPlane: Mesh
  private resetMaterial: StandardMaterial
  private resetTexture: DynamicTexture

  constructor(scene: Scene, initialKnobs: SwingKnobs, callbacks: SidebarCallbacks) {
    this.scene = scene
    this.callbacks = callbacks

    this.root = new TransformNode('swingometer-sidebar-root', scene)
    this.root.position = new Vector3(-15.2, 2.4, 0)
    this.root.rotation = new Vector3(0, Math.PI / 2, 0)

    this.background = MeshBuilder.CreateBox(
      'swingometer-sidebar-background',
      { width: 4.8, height: 10.4, depth: 0.32 },
      scene
    )
    this.background.parent = this.root
    this.background.position = new Vector3(0, 0, 0)
    this.background.isPickable = false

    this.backgroundMaterial = new StandardMaterial('swingometer-sidebar-background-material', scene)
    this.backgroundMaterial.diffuseColor = new Color3(0.06, 0.1, 0.18)
    this.backgroundMaterial.specularColor = new Color3(0.05, 0.07, 0.11)
    this.backgroundMaterial.emissiveColor = new Color3(0.03, 0.05, 0.08)
    this.backgroundMaterial.alpha = 0.94
    this.backgroundMaterial.backFaceCulling = false
    this.background.material = this.backgroundMaterial

    this.headerPlane = MeshBuilder.CreatePlane('swingometer-sidebar-header', { width: 4.25, height: 0.95 }, scene)
    this.headerPlane.parent = this.root
    this.headerPlane.position = new Vector3(0, 3.2, 0.2)
    this.headerPlane.isPickable = false

    this.headerTexture = new DynamicTexture('swingometer-sidebar-header-texture', { width: 1024, height: 256 }, scene, true)
    this.headerTexture.hasAlpha = true
    this.headerTexture.uScale = -1
    this.headerTexture.uOffset = 1
    this.headerTexture.vScale = -1
    this.headerTexture.vOffset = 1
    const headerCtx = this.headerTexture.getContext() as CanvasRenderingContext2D | null
    if (headerCtx) {
      headerCtx.clearRect(0, 0, 1024, 256)
      headerCtx.fillStyle = 'rgba(15, 23, 42, 0.25)'
      headerCtx.fillRect(0, 0, 1024, 256)
      headerCtx.font = '600 120px "Inter", "Segoe UI", sans-serif'
      headerCtx.fillStyle = '#e2e8f0'
      headerCtx.textAlign = 'left'
      headerCtx.fillText('Swing controls', 64, 150)
      headerCtx.font = '400 86px "Inter", "Segoe UI", sans-serif'
      headerCtx.fillStyle = '#94a3b8'
      headerCtx.fillText('Adjust national assumptions in real-time', 64, 210)
      this.headerTexture.update(false)
    }

    this.headerMaterial = new StandardMaterial('swingometer-sidebar-header-material', scene)
    this.headerMaterial.diffuseTexture = this.headerTexture
    this.headerMaterial.emissiveTexture = this.headerTexture
    this.headerMaterial.opacityTexture = this.headerTexture
    this.headerMaterial.backFaceCulling = false
    this.headerMaterial.specularColor = Color3.Black()
    this.headerMaterial.emissiveColor = new Color3(0.22, 0.27, 0.36)
    this.headerMaterial.alpha = 0.96
    this.headerPlane.material = this.headerMaterial

    const knobKeys = Object.keys(SWING_KNOB_CONFIG) as SwingKnobKey[]
    const startY = 2.35
    const spacing = 0.6
    knobKeys.forEach((key, index) => {
      const initialValue = initialKnobs[key]
      this.createRow(key, initialValue, startY - index * spacing)
    })

    this.resetPlane = MeshBuilder.CreatePlane('swingometer-sidebar-reset', { width: 1.6, height: 0.5 }, scene)
    this.resetPlane.parent = this.root
    this.resetPlane.position = new Vector3(0, -4.4, 0.2)

    this.resetTexture = new DynamicTexture('swingometer-sidebar-reset-texture', { width: 512, height: 160 }, scene, true)
    this.resetTexture.hasAlpha = true
    this.resetTexture.uScale = -1
    this.resetTexture.uOffset = 1
    this.resetTexture.vScale = -1
    this.resetTexture.vOffset = 1
    const resetCtx = this.resetTexture.getContext() as CanvasRenderingContext2D | null
    if (resetCtx) {
      resetCtx.clearRect(0, 0, 512, 160)
      resetCtx.fillStyle = '#1e293b'
      resetCtx.fillRect(0, 0, 512, 160)
      resetCtx.font = '600 90px "Inter", "Segoe UI", sans-serif'
      resetCtx.fillStyle = '#38bdf8'
      resetCtx.textAlign = 'center'
      resetCtx.fillText('Reset', 256, 108)
      this.resetTexture.update(false)
    }

    this.resetMaterial = new StandardMaterial('swingometer-sidebar-reset-material', scene)
    this.resetMaterial.diffuseTexture = this.resetTexture
    this.resetMaterial.emissiveTexture = this.resetTexture
    this.resetMaterial.opacityTexture = this.resetTexture
    this.resetMaterial.backFaceCulling = false
    this.resetMaterial.emissiveColor = new Color3(0.2, 0.35, 0.5)
    this.resetMaterial.specularColor = Color3.Black()
    this.resetPlane.material = this.resetMaterial
    this.resetPlane.actionManager = new ActionManager(scene)
    this.resetPlane.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        this.resetMaterial.emissiveColor = new Color3(0.4, 0.6, 0.85)
      })
    )
    this.resetPlane.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        this.resetMaterial.emissiveColor = new Color3(0.2, 0.35, 0.5)
      })
    )
    this.resetPlane.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        this.callbacks.onReset?.()
      })
    )

    this.pointerObserver = scene.onPointerObservable.add((pointerInfo) => this.handlePointer(pointerInfo))
  }

  updateKnobs(nextKnobs: SwingKnobs) {
    (Object.keys(SWING_KNOB_CONFIG) as SwingKnobKey[]).forEach((key) => {
      const entry = this.rows.get(key)
      if (!entry) return
      const incoming = nextKnobs[key]
      if (Math.abs(entry.currentValue - incoming) > 1e-4) {
        this.applyValueToRow(key, incoming, false)
      }
    })
  }

  dispose() {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver)
      this.pointerObserver = null
    }

    this.rows.forEach((entry) => {
      entry.labelTexture.dispose()
      entry.labelMaterial.dispose()
      entry.trackMaterial.dispose()
      entry.handleMaterial.dispose()
      entry.valueTexture.dispose()
      entry.valueMaterial.dispose()
      entry.root.dispose()
    })
    this.rows.clear()

    this.headerTexture.dispose()
    this.headerMaterial.dispose()
    this.headerPlane.dispose()
    this.resetTexture.dispose()
    this.resetMaterial.dispose()
    this.resetPlane.dispose()
    this.backgroundMaterial.dispose()
    this.background.dispose()
    this.root.dispose()
  }

  private createRow(key: SwingKnobKey, initialValue: number, yPosition: number) {
    const config = SWING_KNOB_CONFIG[key]
    const rowRoot = new TransformNode(`swingometer-sidebar-row-${key}`, this.scene)
    rowRoot.parent = this.root
    rowRoot.position = new Vector3(0, yPosition, 0.18)

    const labelPlane = MeshBuilder.CreatePlane(
      `swingometer-sidebar-label-${key}`,
      { width: 4.2, height: 0.6 },
      this.scene
    )
    labelPlane.parent = rowRoot
    labelPlane.position = new Vector3(0, 0.35, 0.02)
    labelPlane.isPickable = false

    const labelTexture = new DynamicTexture(`swingometer-sidebar-label-texture-${key}`, { width: 1024, height: 256 }, this.scene, true)
    labelTexture.hasAlpha = true
    labelTexture.uScale = -1
    labelTexture.uOffset = 1
    labelTexture.vScale = -1
    labelTexture.vOffset = 1

    const labelMaterial = new StandardMaterial(`swingometer-sidebar-label-material-${key}`, this.scene)
    labelMaterial.diffuseTexture = labelTexture
    labelMaterial.emissiveTexture = labelTexture
    labelMaterial.opacityTexture = labelTexture
    labelMaterial.specularColor = Color3.Black()
    labelMaterial.emissiveColor = new Color3(0.28, 0.34, 0.46)
    labelMaterial.backFaceCulling = false
    labelPlane.material = labelMaterial

    const trackWidth = 3.2
    const trackHeight = 0.12
    const track = MeshBuilder.CreatePlane(`swingometer-sidebar-track-${key}`, { width: trackWidth, height: trackHeight }, this.scene)
    track.parent = rowRoot
    track.position = new Vector3(0, -0.25, 0.02)

    const trackMaterial = new StandardMaterial(`swingometer-sidebar-track-material-${key}`, this.scene)
    trackMaterial.diffuseColor = new Color3(0.16, 0.23, 0.35)
    trackMaterial.specularColor = Color3.Black()
    trackMaterial.emissiveColor = new Color3(0.08, 0.12, 0.2)
    trackMaterial.alpha = 0.9
    track.material = trackMaterial

    const handle = MeshBuilder.CreateCylinder(`swingometer-sidebar-handle-${key}`, { diameter: 0.22, height: 0.08 }, this.scene)
    handle.parent = rowRoot
    handle.rotation.x = Math.PI / 2
    handle.position = new Vector3(0, -0.25, 0.1)

    const handleMaterial = new StandardMaterial(`swingometer-sidebar-handle-material-${key}`, this.scene)
    handleMaterial.diffuseColor = new Color3(0.32, 0.55, 0.88)
    handleMaterial.specularColor = new Color3(0.1, 0.15, 0.22)
    handleMaterial.emissiveColor = new Color3(0.2, 0.35, 0.58)
    handleMaterial.alpha = 0.95
    handle.material = handleMaterial

    const valuePlane = MeshBuilder.CreatePlane(`swingometer-sidebar-value-${key}`, { width: 0.9, height: 0.36 }, this.scene)
    valuePlane.parent = rowRoot
    valuePlane.position = new Vector3(trackWidth / 2 + 0.45, -0.25, 0.02)
    valuePlane.isPickable = false

    const valueTexture = new DynamicTexture(`swingometer-sidebar-value-texture-${key}`, { width: 256, height: 256 }, this.scene, true)
    valueTexture.hasAlpha = true
    valueTexture.uScale = -1
    valueTexture.uOffset = 1
    valueTexture.vScale = -1
    valueTexture.vOffset = 1
    const valueMaterial = new StandardMaterial(`swingometer-sidebar-value-material-${key}`, this.scene)
    valueMaterial.diffuseTexture = valueTexture
    valueMaterial.emissiveTexture = valueTexture
    valueMaterial.opacityTexture = valueTexture
    valueMaterial.backFaceCulling = false
    valueMaterial.specularColor = Color3.Black()
    valueMaterial.emissiveColor = new Color3(0.26, 0.38, 0.56)
    valuePlane.material = valueMaterial

    track.actionManager = new ActionManager(this.scene)
    handle.actionManager = new ActionManager(this.scene)

    const startDrag = () => {
      this.activeKnob = key
    }

    const endDrag = () => {
      if (this.activeKnob === key) {
        this.activeKnob = null
      }
    }

    const hoverOn = () => {
      handleMaterial.emissiveColor = new Color3(0.34, 0.6, 0.95)
      trackMaterial.emissiveColor = new Color3(0.18, 0.28, 0.44)
    }

    const hoverOff = () => {
      if (this.activeKnob === key) return
      handleMaterial.emissiveColor = new Color3(0.2, 0.35, 0.58)
      trackMaterial.emissiveColor = new Color3(0.08, 0.12, 0.2)
    }

    const applyPick = () => {
      if (!this.activeKnob) return
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === track)
      if (!pick?.hit || !pick.pickedPoint) return

      const inverse = Matrix.Invert(track.getWorldMatrix())
      const local = Vector3.TransformCoordinates(pick.pickedPoint, inverse)
      const ratio = clamp((local.x + trackWidth / 2) / trackWidth, 0, 1)
      const span = config.max - config.min
      const nextValue = config.min + ratio * span
      const snapped = snapToStep(nextValue, config.step)
      this.applyValueToRow(key, snapped, true)
    }

    track.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickDownTrigger, () => {
      startDrag()
      applyPick()
    }))
    track.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickUpTrigger, () => {
      endDrag()
      hoverOff()
    }))
    track.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, hoverOn))
    track.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, hoverOff))

    handle.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickDownTrigger, () => {
      startDrag()
      applyPick()
    }))
    handle.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickUpTrigger, () => {
      endDrag()
      hoverOff()
    }))
    handle.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, hoverOn))
    handle.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, hoverOff))

    const sanitizedInitial = clamp(initialValue, config.min, config.max)

    const entry: RowEntry = {
      root: rowRoot,
      labelPlane,
      track,
      trackMaterial,
      handle,
      handleMaterial,
      labelTexture,
      labelMaterial,
      trackWidth,
      config,
      currentValue: sanitizedInitial,
      valuePlane,
      valueMaterial,
      valueTexture
    }

    this.rows.set(key, entry)
    this.redrawLabel(entry)
    this.redrawValue(entry)
    this.positionHandle(entry)
  }

  private handlePointer(pointerInfo: PointerInfo) {
    if (pointerInfo.type === PointerEventTypes.POINTERUP) {
      if (this.activeKnob) {
        const entry = this.rows.get(this.activeKnob)
        if (entry) {
          entry.handleMaterial.emissiveColor.set(0.2, 0.35, 0.58)
          entry.trackMaterial.emissiveColor.set(0.08, 0.12, 0.2)
        }
      }
      this.activeKnob = null
      return
    }

    if (pointerInfo.type === PointerEventTypes.POINTERMOVE && this.activeKnob) {
      const entry = this.rows.get(this.activeKnob)
      if (!entry) {
        this.activeKnob = null
        return
      }
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === entry.track)
      if (!pick?.hit || !pick.pickedPoint) return
      const inverse = Matrix.Invert(entry.track.getWorldMatrix())
      const local = Vector3.TransformCoordinates(pick.pickedPoint, inverse)
      const ratio = clamp((local.x + entry.trackWidth / 2) / entry.trackWidth, 0, 1)
      const span = entry.config.max - entry.config.min
      const nextValue = entry.config.min + ratio * span
      const snapped = snapToStep(nextValue, entry.config.step)
      this.applyValueToRow(this.activeKnob, snapped, true)
    }
  }

  private applyValueToRow(key: SwingKnobKey, value: number, emit: boolean) {
    const entry = this.rows.get(key)
    if (!entry) return

    const bounded = clamp(value, entry.config.min, entry.config.max)
    const snapped = snapToStep(bounded, entry.config.step)
    if (Math.abs(entry.currentValue - snapped) < 1e-4) return
    entry.currentValue = snapped
    this.positionHandle(entry)
    this.redrawValue(entry)
    if (emit) {
      this.callbacks.onChange(key, snapped)
    }
  }

  private redrawLabel(entry: RowEntry) {
    const ctx = entry.labelTexture.getContext() as CanvasRenderingContext2D | null
    if (!ctx) return
    const { width, height } = entry.labelTexture.getSize()
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'
    ctx.fillRect(0, 0, width, height)
    ctx.font = '600 120px "Inter", "Segoe UI", sans-serif'
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'left'
    ctx.fillText(entry.config.label, 48, 140)
    if (entry.config.description) {
      ctx.font = '400 86px "Inter", "Segoe UI", sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(entry.config.description, 48, 210)
    }
    entry.labelTexture.update(false)
  }

  private redrawValue(entry: RowEntry) {
    const texture = entry.valueTexture
    const ctx = texture.getContext() as CanvasRenderingContext2D | null
    if (!ctx) return
    const { width, height } = texture.getSize()
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)
    ctx.font = '600 120px "Inter", "Segoe UI", sans-serif'
    ctx.fillStyle = '#38bdf8'
    ctx.textAlign = 'center'
    ctx.fillText(entry.config.format(entry.currentValue), width / 2, 148)
    texture.update(false)
  }

  private positionHandle(entry: RowEntry) {
    const ratio = (entry.currentValue - entry.config.min) / (entry.config.max - entry.config.min || 1)
    const clampedRatio = clamp(ratio, 0, 1)
    const x = clampedRatio * entry.trackWidth - entry.trackWidth / 2
    entry.handle.position.x = x
  }
}
