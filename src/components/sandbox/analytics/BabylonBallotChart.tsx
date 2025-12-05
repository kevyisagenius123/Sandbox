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
  DynamicTexture
} from '@babylonjs/core'
import type { CountySimulationState } from '../../../types/sandbox'
import { useSandboxThemeOrDefault } from '../../../design/SandboxThemeProvider'

interface BabylonBallotChartProps {
  countyStates: Map<string, CountySimulationState>
  selectedCountyFips?: string | null
}

export const BabylonBallotChart: React.FC<BabylonBallotChartProps> = ({ countyStates, selectedCountyFips }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useSandboxThemeOrDefault()

  const selectedCounty = selectedCountyFips ? countyStates.get(selectedCountyFips) : null

  const distributions = useMemo(() => {
    let dist = [0, 0, 0, 0]
    if (selectedCounty && selectedCounty.currentTotalVotes > 0) {
        const total = selectedCounty.currentTotalVotes
        const isUrban = total > 100000
        const isSuburban = total > 50000 && total <= 100000
        
        dist = [
            Math.round(total * (isUrban ? 0.45 : isSuburban ? 0.35 : 0.25)),
            Math.round(total * (isUrban ? 0.20 : isSuburban ? 0.35 : 0.55)),
            Math.round(total * (isUrban ? 0.30 : isSuburban ? 0.20 : 0.15)),
            Math.round(total * 0.05)
        ]
    }
    return dist
  }, [selectedCounty])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 3, 12, Vector3.Zero(), scene)
    camera.attachControl(canvasRef.current, true)
    camera.lowerRadiusLimit = 8
    camera.upperRadiusLimit = 20

    // Lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 0.8

    // --- Chart Logic ---
    const root = new TransformNode('root', scene)

    // Data Generation (Mock logic from original component)
    const ballotTypes = ['Early', 'Election Day', 'Mail-In', 'Provisional']
    const colors = ['#4cabce', '#e5323e', '#003366', '#999999']
    
    const maxVal = Math.max(...distributions, 1)

    // Create Bars
    distributions.forEach((val, i) => {
        const height = (val / maxVal) * 5 // Scale to max height 5
        if (height <= 0) return

        const bar = MeshBuilder.CreateBox(`bar_${i}`, { width: 1, depth: 1, height: height }, scene)
        bar.position.x = (i - 1.5) * 2 // Spacing
        bar.position.y = height / 2
        bar.parent = root

        const mat = new StandardMaterial(`mat_${i}`, scene)
        mat.diffuseColor = Color3.FromHexString(colors[i])
        bar.material = mat

        // Label (Bottom)
        const labelPlane = MeshBuilder.CreatePlane(`label_${i}`, { width: 2, height: 1 }, scene)
        labelPlane.position = new Vector3((i - 1.5) * 2, -0.6, 0)
        labelPlane.parent = root
        
        const dt = new DynamicTexture(`dt_${i}`, { width: 256, height: 128 }, scene, true)
        dt.hasAlpha = true
        const ctx = dt.getContext() as CanvasRenderingContext2D
        ctx.font = 'bold 40px Arial'
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        ctx.fillText(ballotTypes[i], 128, 64)
        dt.update()
        
        const labelMat = new StandardMaterial(`labelMat_${i}`, scene)
        labelMat.diffuseTexture = dt
        labelMat.opacityTexture = dt
        labelMat.emissiveColor = Color3.White()
        labelMat.disableLighting = true
        labelPlane.material = labelMat

        // Value (Top)
        const valPlane = MeshBuilder.CreatePlane(`val_${i}`, { width: 2, height: 1 }, scene)
        valPlane.position = new Vector3((i - 1.5) * 2, height + 0.6, 0)
        valPlane.parent = root
        
        const valDt = new DynamicTexture(`valDt_${i}`, { width: 256, height: 128 }, scene, true)
        valDt.hasAlpha = true
        const vCtx = valDt.getContext() as CanvasRenderingContext2D
        vCtx.font = 'bold 40px Arial'
        vCtx.fillStyle = 'white'
        vCtx.textAlign = 'center'
        vCtx.fillText(val.toLocaleString(), 128, 64)
        valDt.update()
        
        const valMat = new StandardMaterial(`valMat_${i}`, scene)
        valMat.diffuseTexture = valDt
        valMat.opacityTexture = valDt
        valMat.emissiveColor = Color3.White()
        valMat.disableLighting = true
        valPlane.material = valMat
    })

    // Base Grid
    const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 4 }, scene)
    ground.position.y = 0
    const groundMat = new StandardMaterial('groundMat', scene)
    groundMat.diffuseColor = new Color3(0.1, 0.1, 0.1)
    groundMat.alpha = 0.5
    ground.material = groundMat
    ground.parent = root

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [selectedCounty, distributions]) // Re-run if data changes

  return <canvas ref={canvasRef} className="w-full h-full outline-none" />
}
