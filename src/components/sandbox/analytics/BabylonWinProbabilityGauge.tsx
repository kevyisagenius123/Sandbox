import React, { useEffect, useRef, useMemo } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  TransformNode,
  DynamicTexture,
  Scalar,
  GlowLayer
} from '@babylonjs/core'
import type { AggregateResults } from '../results-summary/types'

interface BabylonWinProbabilityGaugeProps {
  aggregates: AggregateResults
}

export const BabylonWinProbabilityGauge: React.FC<BabylonWinProbabilityGaugeProps> = ({ aggregates }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // const theme = useSandboxThemeOrDefault() // Unused for now

  // Compute win probability
  const winProb = useMemo(() => {
    const { voteMarginAbsolute, votesRemaining, totalVotes, leader } = aggregates
    const safeTotal = Math.max(totalVotes, 1)
    const marginShare = voteMarginAbsolute / safeTotal
    const outstandingDenominator = totalVotes + votesRemaining
    const outstandingShare = outstandingDenominator > 0 ? votesRemaining / outstandingDenominator : 0
    const scaling = 1 - Math.min(0.95, outstandingShare)
    const probability = Math.abs(marginShare * 100 * scaling)
    const clampedProb = Number.isFinite(probability) ? Math.min(100, Math.max(0, probability)) : 0
    return { value: clampedProb, leader }
  }, [aggregates])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true, antialias: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Add Glow Layer
    const gl = new GlowLayer("glow", scene)
    gl.intensity = 0.4

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 9, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 20
    camera.attachControl(canvasRef.current, true)

    // Lighting
    const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene)
    light.intensity = 1.0

    const root = new TransformNode('root', scene)

    // 1. The Track (Segmented "Blocky" Style)
    // Range: 200 deg (Left) to -20 deg (Right)
    const startAngleRad = (200 * Math.PI) / 180
    const endAngleRad = (-20 * Math.PI) / 180
    const totalAngle = startAngleRad - endAngleRad
    
    const radius = 3.5
    const segmentCount = 24
    const segmentAngle = totalAngle / segmentCount
    const gap = 0.03 // Gap between segments

    // Helper for colors
    const getSegmentColor = (i: number) => {
        const t = i / (segmentCount - 1)
        // 0..0.45 -> Blue
        // 0.45..0.55 -> White
        // 0.55..1 -> Red
        if (t < 0.45) {
            // Deep Blue to Light Blue
            return Color3.Lerp(Color3.FromHexString("#1e3a8a"), Color3.FromHexString("#60a5fa"), t / 0.45)
        } else if (t > 0.55) {
            // Light Red to Deep Red
            return Color3.Lerp(Color3.FromHexString("#f87171"), Color3.FromHexString("#7f1d1d"), (t - 0.55) / 0.45)
        } else {
            return Color3.White()
        }
    }

    for(let i = 0; i < segmentCount; i++) {
        // Calculate segment arc
        const segStart = startAngleRad - (i * segmentAngle)
        const segEnd = startAngleRad - ((i + 1) * segmentAngle) + gap
        
        const path = []
        const steps = 4
        for(let j = 0; j <= steps; j++) {
            const a = segStart + (j/steps) * (segEnd - segStart)
            path.push(new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
        }
        
        const seg = MeshBuilder.CreateTube(`seg_${i}`, {
            path,
            radius: 0.35, // Thick blocks
            tessellation: 16,
            cap: 2
        }, scene)
        seg.parent = root
        
        const mat = new StandardMaterial(`segMat_${i}`, scene)
        mat.diffuseColor = getSegmentColor(i)
        mat.emissiveColor = mat.diffuseColor.scale(0.5)
        seg.material = mat
    }

    // 2. Ticks (Outer Ring)
    const tickRadius = radius + 0.6
    // Ticks at every segment boundary
    for(let i = 0; i <= segmentCount; i++) {
        const angle = startAngleRad - (i * segmentAngle)
        const isMajor = (i % 4 === 0) // Major tick every 4 segments
        
        const h = isMajor ? 0.5 : 0.25
        const w = isMajor ? 0.06 : 0.03
        
        const tick = MeshBuilder.CreateBox(`tick_${i}`, { width: w, height: h, depth: 0.02 }, scene)
        tick.position.x = Math.cos(angle) * tickRadius
        tick.position.y = Math.sin(angle) * tickRadius
        tick.rotation.z = angle - Math.PI/2
        tick.parent = root
        
        const tMat = new StandardMaterial(`tMat_${i}`, scene)
        tMat.emissiveColor = Color3.White()
        tick.material = tMat
    }
    
    // "100" Labels at ends
    const createLabel = (text: string, angle: number, dist: number) => {
        const plane = MeshBuilder.CreatePlane(`label_${text}`, { width: 1.5, height: 0.8 }, scene)
        plane.position.x = Math.cos(angle) * dist
        plane.position.y = Math.sin(angle) * dist
        plane.parent = root
        
        const dt = new DynamicTexture(`dt_${text}`, { width: 128, height: 64 }, scene, true)
        dt.hasAlpha = true
        const ctx = dt.getContext() as CanvasRenderingContext2D
        ctx.font = 'bold 40px "Inter", sans-serif'
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 64, 32)
        dt.update()
        
        const mat = new StandardMaterial(`mat_${text}`, scene)
        mat.diffuseTexture = dt
        mat.opacityTexture = dt
        mat.emissiveColor = Color3.White()
        mat.disableLighting = true
        plane.material = mat
    }
    
    createLabel("100", startAngleRad, radius + 1.2)
    createLabel("100", endAngleRad, radius + 1.2)

    // 3. The Needle (Diamond Shape)
    const needlePivot = new TransformNode('needlePivot', scene)
    needlePivot.parent = root
    
    // Create a diamond using a cylinder with 4 sides and 0 top diameter
    const needle = MeshBuilder.CreateCylinder('needle', {
        diameterTop: 0,
        diameterBottom: 0.5,
        height: radius - 0.2,
        tessellation: 4
    }, scene)
    
    // Flatten it to look like a 2D diamond pointer
    needle.scaling.z = 0.1 
    needle.rotation.y = Math.PI / 4 // Align corners
    needle.position.y = (radius - 0.2) / 2
    needle.parent = needlePivot
    
    const needleMat = new StandardMaterial('needleMat', scene)
    needleMat.diffuseColor = Color3.White()
    needleMat.emissiveColor = Color3.White()
    needle.material = needleMat
    
    // Center Cap (Hidden or small)
    // The image doesn't show a big cap, just the needle base.
    
    // 4. Text Readout
    const readoutPlane = MeshBuilder.CreatePlane('readout', { width: 5, height: 2.5 }, scene)
    readoutPlane.position = new Vector3(0, -1.0, 0)
    readoutPlane.parent = root
    
    const readoutDt = new DynamicTexture('readoutDt', { width: 512, height: 256 }, scene, true)
    readoutDt.hasAlpha = true
    
    const readoutMat = new StandardMaterial('readoutMat', scene)
    readoutMat.diffuseTexture = readoutDt
    readoutMat.opacityTexture = readoutDt
    readoutMat.emissiveColor = Color3.White()
    readoutMat.disableLighting = true
    readoutPlane.material = readoutMat

    // Animation Loop
    scene.registerBeforeRender(() => {
        // Logic
        const marginSign = winProb.leader === 'GOP' ? 1 : winProb.leader === 'DEM' ? -1 : 0
        const val = winProb.value * marginSign // -100 to 100
        
        // Map val to Angle
        // -100 -> startAngleRad
        // 100 -> endAngleRad
        const t = (val - (-100)) / 200
        const targetAngle = startAngleRad + t * (endAngleRad - startAngleRad)
        
        // Needle Rotation
        const targetRotation = targetAngle - Math.PI/2
        
        // Smooth lerp
        needlePivot.rotation.z = Scalar.Lerp(needlePivot.rotation.z, targetRotation, 0.08)

        // Update Text
        const ctx = readoutDt.getContext() as CanvasRenderingContext2D
        ctx.clearRect(0, 0, 512, 256)
        
        // Value
        ctx.font = 'bold 100px "Inter", "Segoe UI", sans-serif'
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        const displayVal = Number.isNaN(winProb.value) ? "NaN" : `${winProb.value.toFixed(1)}%`
        ctx.fillText(displayVal, 256, 110)
        
        // Label
        ctx.font = '500 36px "Inter", "Segoe UI", sans-serif'
        ctx.fillStyle = '#94a3b8'
        const labelText = winProb.leader === 'TIE' ? 'Tie Win Probability' : `${winProb.leader} WIN PROBABILITY`
        ctx.fillText(labelText, 256, 170)
        
        readoutDt.update()
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [aggregates, winProb])

  return <canvas ref={canvasRef} className="w-full h-full outline-none" />
}
