import { Color3, Mesh, MeshBuilder, Nullable, Observer, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Scalar } from '@babylonjs/core/Maths/math.scalar'

export interface Tooltip3DData {
  id: string
  label: string
  subtitle?: string
  type: 'state' | 'county'
  stateFips: string
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  reportingPercent: number
  marginPct: number
  x?: number
  y?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const formatVotes = (value: number) => {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absValue >= 1_000) return `${Math.round(value / 1_000)}K`
  return value.toLocaleString('en-US')
}

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string
) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
  ctx.restore()
}

export class Tooltip3D {
  private scene: Scene
  private root: TransformNode
  private cardPivot: TransformNode
  private cardBody: Mesh
  private cardBodyMaterial: StandardMaterial
  private cardFace: Mesh
  private cardFaceMaterial: StandardMaterial
  private texture: DynamicTexture
  private stem: Mesh
  private stemMaterial: StandardMaterial
  private base: Mesh
  private baseMaterial: StandardMaterial
  private beforeRenderObserver: Nullable<Observer<Scene>> = null
  private targetPosition = new Vector3(0, 0, 0)
  private smoothedPosition = new Vector3(0, 0, 0)
  private currentAlpha = 0
  private targetAlpha = 0
  private currentData: Tooltip3DData | null = null

  constructor(scene: Scene) {
    this.scene = scene
    this.root = new TransformNode('swingometer-tooltip-root', scene)
    this.root.position = new Vector3(0, 0.8, 0)
    this.root.setEnabled(false)

    this.cardPivot = new TransformNode('swingometer-tooltip-card-pivot', scene)
    this.cardPivot.parent = this.root
    this.cardPivot.position = new Vector3(0, 1.2, 0)
    this.cardPivot.rotation.x = -0.35

    this.cardBody = MeshBuilder.CreateBox('swingometer-tooltip-card-body', { width: 3.6, height: 2.1, depth: 0.16 }, scene)
    this.cardBody.parent = this.cardPivot
    this.cardBody.isPickable = false

    this.cardBodyMaterial = new StandardMaterial('swingometer-tooltip-card-body-material', scene)
    this.cardBodyMaterial.diffuseColor = new Color3(0.07, 0.11, 0.19)
    this.cardBodyMaterial.specularColor = new Color3(0.08, 0.08, 0.1)
    this.cardBodyMaterial.emissiveColor = new Color3(0.05, 0.08, 0.14)
    this.cardBodyMaterial.roughness = 0.45
    this.cardBodyMaterial.alpha = 0
    this.cardBody.material = this.cardBodyMaterial

    this.cardFace = MeshBuilder.CreatePlane('swingometer-tooltip-card-face', { width: 3.46, height: 2.0, sideOrientation: Mesh.DOUBLESIDE }, scene)
    this.cardFace.parent = this.cardPivot
    this.cardFace.position = new Vector3(0, 0, 0.09)
    this.cardFace.isPickable = false

    this.texture = new DynamicTexture('swingometer-tooltip-texture', { width: 1024, height: 600 }, scene, true)
    this.texture.hasAlpha = true

    this.texture.uScale = -1
    this.texture.uOffset = 1
    this.texture.vScale = -1
    this.texture.vOffset = 1

    this.cardFaceMaterial = new StandardMaterial('swingometer-tooltip-material', scene)
    this.cardFaceMaterial.diffuseTexture = this.texture
    this.cardFaceMaterial.emissiveTexture = this.texture
    this.cardFaceMaterial.opacityTexture = this.texture
    this.cardFaceMaterial.backFaceCulling = false
    this.cardFaceMaterial.specularColor = new Color3(0.1, 0.1, 0.12)
    this.cardFaceMaterial.emissiveColor = new Color3(0.08, 0.12, 0.18)
    this.cardFaceMaterial.alpha = 0
    this.cardFace.material = this.cardFaceMaterial

    this.stem = MeshBuilder.CreateCylinder('swingometer-tooltip-stem', { diameter: 0.04, height: 0.8 }, scene)
    this.stem.parent = this.root
    this.stem.position = new Vector3(0, 0.4, 0)
    this.stem.isPickable = false

    this.stemMaterial = new StandardMaterial('swingometer-tooltip-stem-material', scene)
    this.stemMaterial.diffuseColor = new Color3(0.5, 0.64, 0.87)
    this.stemMaterial.emissiveColor = new Color3(0.3, 0.4, 0.58)
    this.stemMaterial.alpha = 0
    this.stem.material = this.stemMaterial

    this.base = MeshBuilder.CreateCylinder('swingometer-tooltip-base', { diameter: 0.36, height: 0.04 }, scene)
    this.base.parent = this.root
    this.base.position = new Vector3(0, 0.02, 0)
    this.base.rotation.x = Math.PI / 2
    this.base.isPickable = false

    this.baseMaterial = new StandardMaterial('swingometer-tooltip-base-material', scene)
    this.baseMaterial.diffuseColor = new Color3(0.12, 0.18, 0.28)
    this.baseMaterial.specularColor = Color3.Black()
    this.baseMaterial.emissiveColor = new Color3(0.05, 0.07, 0.12)
    this.baseMaterial.alpha = 0
    this.base.material = this.baseMaterial

    this.beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000
      const lerpStrength = 1 - Math.pow(0.04, dt)
      Vector3.LerpToRef(this.smoothedPosition, this.targetPosition, lerpStrength, this.smoothedPosition)
      this.root.position.copyFrom(this.smoothedPosition)

      const camera = this.scene.activeCamera
      if (camera) {
        const cardWorld = this.cardPivot.getAbsolutePosition()
        const dx = camera.position.x - cardWorld.x
        const dy = camera.position.y - cardWorld.y
        const dz = camera.position.z - cardWorld.z
        const planarDistance = Math.max(0.0001, Math.hypot(dx, dz))

        const targetYaw = Math.atan2(dx, dz)
        const yawLerp = 1 - Math.pow(0.04, dt)
        this.cardPivot.rotation.y = Scalar.Lerp(this.cardPivot.rotation.y, targetYaw, yawLerp)

        const pitchToCamera = Math.atan2(dy, planarDistance)
        const desiredPitch = Scalar.Clamp(pitchToCamera * 0.45 - 0.25, -1.05, -0.05)
        const pitchLerp = 1 - Math.pow(0.06, dt)
        this.cardPivot.rotation.x = Scalar.Lerp(this.cardPivot.rotation.x, desiredPitch, pitchLerp)
      }

      const alphaStep = Math.min(1, dt * 6)
      this.currentAlpha += (this.targetAlpha - this.currentAlpha) * alphaStep
      const visible = this.currentAlpha > 0.02
      this.root.setEnabled(visible)
      this.cardFaceMaterial.alpha = this.currentAlpha
      this.cardBodyMaterial.alpha = this.currentAlpha * 0.85
      this.stemMaterial.alpha = this.currentAlpha * 0.8
      this.baseMaterial.alpha = this.currentAlpha * 0.6
    })
  }

  update(data: Tooltip3DData | null, anchorPoint: Vector3) {
    if (!data) {
      this.currentData = null
      this.targetAlpha = 0
      return
    }

    this.currentData = data
    this.targetAlpha = 1
    this.targetPosition.copyFrom(anchorPoint)
    this.targetPosition.y += 1.3
    if (this.smoothedPosition.lengthSquared() === 0) {
      this.smoothedPosition.copyFrom(this.targetPosition)
    }
    this.draw()
  }

  dispose() {
    if (this.beforeRenderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver)
      this.beforeRenderObserver = null
    }
    this.texture.dispose()
    this.cardFaceMaterial.dispose()
    this.cardBodyMaterial.dispose()
    this.stemMaterial.dispose()
    this.baseMaterial.dispose()
    this.cardFace.dispose()
    this.cardBody.dispose()
    this.stem.dispose()
    this.base.dispose()
    this.cardPivot.dispose()
    this.root.dispose()
  }

  private draw() {
    if (!this.currentData) return
    const ctx = this.texture.getContext() as CanvasRenderingContext2D | null
    if (!ctx) return
    const context = ctx as CanvasRenderingContext2D
    const { width, height } = this.texture.getSize()
    context.clearRect(0, 0, width, height)

    context.save()
    context.fillStyle = 'rgba(2, 6, 23, 0.92)'
    context.fillRect(0, 0, width, height)

    drawRoundedRect(context, 24, 24, width - 48, height - 48, 32, 'rgba(8, 19, 34, 0.95)')
    context.shadowColor = 'rgba(15, 23, 42, 0.9)'
    context.shadowBlur = 24
    context.restore()

    const padding = 72
    const labelY = padding + 40
    const subtitleY = labelY + 56

    context.font = '700 84px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#f8fafc'
    context.textBaseline = 'alphabetic'
    context.fillText(this.currentData.label, padding, labelY)

    if (this.currentData.subtitle) {
      context.font = '500 48px "Inter", "Segoe UI", sans-serif'
      context.fillStyle = '#94a3b8'
      context.fillText(this.currentData.subtitle, padding, subtitleY)
    }

    const marginColor = this.currentData.marginPct >= 0 ? '#f87171' : '#60a5fa'
    const marginPrefix = this.currentData.marginPct >= 0 ? 'R +' : 'D +'
    const marginText = `${marginPrefix}${Math.abs(this.currentData.marginPct).toFixed(1)}%`
    const pillWidth = 320
    const pillHeight = 74
    const pillX = width - padding - pillWidth
    const pillY = padding

    drawRoundedRect(context, pillX, pillY, pillWidth, pillHeight, 32, marginColor)
    context.font = '700 46px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#0f172a'
    context.textAlign = 'center'
    context.fillText(marginText, pillX + pillWidth / 2, pillY + pillHeight / 2 + 16)
    context.textAlign = 'left'

    const totalVotes = Math.max(1, this.currentData.totalVotes)
    const demPct = clamp((this.currentData.demVotes / totalVotes) * 100, 0, 100)
    const gopPct = clamp((this.currentData.gopVotes / totalVotes) * 100, 0, 100)
    const otherPct = clamp(100 - demPct - gopPct, 0, 100)

    const barY = subtitleY + 70
    const barHeight = 42
    const barWidth = width - padding * 2
    drawRoundedRect(context, padding, barY, barWidth, barHeight, 18, '#1f2937')
    const demWidth = (barWidth * demPct) / 100
    if (demWidth > 2) {
      drawRoundedRect(context, padding, barY, demWidth, barHeight, 18, '#3b82f6')
    }
    const gopWidth = (barWidth * gopPct) / 100
    if (gopWidth > 2) {
      drawRoundedRect(context, padding + barWidth - gopWidth, barY, gopWidth, barHeight, 18, '#f87171')
    }
    if (otherPct > 1) {
      const otherWidth = (barWidth * otherPct) / 100
      drawRoundedRect(context, padding + (barWidth - otherWidth) / 2, barY + barHeight + 18, otherWidth, 12, 6, '#cbd5f5')
    }

    const statsY = barY + 120
    context.font = '600 48px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#bfdbfe'
    context.fillText('DEMOCRAT', padding, statsY)
    context.fillStyle = '#fecaca'
    context.fillText('REPUBLICAN', width - padding - 360, statsY)

    context.font = '700 90px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#e0f2fe'
    context.fillText(`${demPct.toFixed(1)}%`, padding, statsY + 90)
    context.fillStyle = '#fee2e2'
    context.fillText(`${gopPct.toFixed(1)}%`, width - padding - 390, statsY + 90)

    context.font = '500 48px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#bfdbfe'
    context.fillText(`${formatVotes(this.currentData.demVotes)} votes`, padding, statsY + 150)
    context.fillStyle = '#fecaca'
    context.fillText(`${formatVotes(this.currentData.gopVotes)} votes`, width - padding - 420, statsY + 150)

    context.font = '500 42px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#94a3b8'
    context.fillText('Reporting', padding, statsY + 230)
    context.textAlign = 'right'
    context.fillStyle = '#e2e8f0'
    context.fillText(`${clamp(this.currentData.reportingPercent, 0, 100).toFixed(1)}%`, width - padding, statsY + 230)
    context.textAlign = 'left'

    const reportingTrackY = statsY + 250
    const reportingTrackHeight = 34
    drawRoundedRect(context, padding, reportingTrackY, barWidth, reportingTrackHeight, 18, '#1e293b')
    const reportingFillWidth = (barWidth * clamp(this.currentData.reportingPercent, 0, 100)) / 100
    drawRoundedRect(context, padding, reportingTrackY, reportingFillWidth, reportingTrackHeight, 18, '#38bdf8')

    context.font = '600 52px "Inter", "Segoe UI", sans-serif'
    context.fillStyle = '#a5b4fc'
    context.fillText('Total votes', padding, reportingTrackY + 110)
    context.textAlign = 'right'
    context.fillStyle = '#f8fafc'
    context.fillText(formatVotes(this.currentData.totalVotes), width - padding, reportingTrackY + 110)
    context.textAlign = 'left'

    this.texture.update(false)
  }
}
