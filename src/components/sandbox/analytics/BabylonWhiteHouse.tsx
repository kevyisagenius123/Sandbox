import React, { useEffect, useRef } from 'react'
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
  SpotLight,
  Texture,
  Mesh,
  GlowLayer
} from '@babylonjs/core'

interface BabylonWhiteHouseProps {
  leader?: 'DEM' | 'GOP' | 'TIE'
}

export const BabylonWhiteHouse: React.FC<BabylonWhiteHouseProps> = ({ leader = 'TIE' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const lightsRef = useRef<SpotLight[]>([])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new Color4(0.05, 0.05, 0.1, 1) // Night sky

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 30, new Vector3(0, 5, 0), scene)
    camera.attachControl(canvasRef.current, true)
    camera.lowerRadiusLimit = 15
    camera.upperRadiusLimit = 50

    // Ambient Light (Moonlight)
    const moonLight = new HemisphericLight('moon', new Vector3(0, 1, 0), scene)
    moonLight.intensity = 0.3
    moonLight.diffuse = new Color3(0.2, 0.2, 0.4)

    // Glow Layer for lights
    const gl = new GlowLayer("glow", scene)
    gl.intensity = 1.5

    // --- Materials ---
    const whiteMat = new StandardMaterial('whiteMat', scene)
    whiteMat.diffuseColor = new Color3(0.9, 0.9, 0.9)
    whiteMat.specularColor = new Color3(0.1, 0.1, 0.1)

    const roofMat = new StandardMaterial('roofMat', scene)
    roofMat.diffuseColor = new Color3(0.2, 0.2, 0.2)

    const windowMat = new StandardMaterial('windowMat', scene)
    windowMat.diffuseColor = new Color3(0.1, 0.1, 0.1)
    windowMat.emissiveColor = new Color3(0.8, 0.7, 0.4) // Warm light from inside

    const grassMat = new StandardMaterial('grassMat', scene)
    grassMat.diffuseColor = new Color3(0.1, 0.3, 0.1)

    // --- Geometry Construction ---
    
    // 1. The Lawn
    const ground = MeshBuilder.CreateGround('lawn', { width: 60, height: 60 }, scene)
    ground.material = grassMat

    // 2. Main Building Body
    const mainBody = MeshBuilder.CreateBox('mainBody', { width: 24, height: 8, depth: 10 }, scene)
    mainBody.position.y = 4
    mainBody.material = whiteMat

    // 3. The Portico (Center)
    const porticoBase = MeshBuilder.CreateBox('porticoBase', { width: 10, height: 0.5, depth: 6 }, scene)
    porticoBase.position.y = 0.25
    porticoBase.position.z = 6 // Stick out front
    porticoBase.material = whiteMat

    // Columns
    const columnPositions = [-4, -2, 0, 2, 4]
    columnPositions.forEach((x) => {
        const col = MeshBuilder.CreateCylinder(`col_${x}`, { height: 8, diameter: 0.8 }, scene)
        col.position.x = x
        col.position.y = 4
        col.position.z = 8
        col.material = whiteMat
    })

    // Portico Roof (Triangle)
    const porticoRoof = MeshBuilder.CreateCylinder('porticoRoof', { height: 10, diameter: 3, tessellation: 3 }, scene)
    porticoRoof.rotation.z = Math.PI / 2
    porticoRoof.position.y = 9
    porticoRoof.position.z = 8
    // Scale to flatten it into a pediment
    porticoRoof.scaling.y = 1 // Width
    porticoRoof.scaling.x = 1 // Height
    porticoRoof.scaling.z = 2 // Depth stretch
    porticoRoof.material = whiteMat

    // 4. Main Roof (Hipped/Sloped)
    // Simple approximation: A smaller box on top or a prism. Let's use a tapered cylinder (prism-like) or just a scaled cylinder
    const mainRoof = MeshBuilder.CreateCylinder('mainRoof', { height: 26, diameter: 10, tessellation: 3 }, scene)
    mainRoof.rotation.z = Math.PI / 2
    mainRoof.position.y = 10
    mainRoof.scaling.x = 0.8
    mainRoof.scaling.z = 1.5
    mainRoof.material = roofMat

    // 5. Windows (Simple planes)
    const createWindows = (zPos: number) => {
        for(let x = -10; x <= 10; x+=4) {
            // Lower floor
            const w1 = MeshBuilder.CreatePlane(`win_l_${x}`, { width: 1.5, height: 2.5 }, scene)
            w1.position.x = x
            w1.position.y = 2.5
            w1.position.z = zPos
            if (zPos < 0) w1.rotation.y = Math.PI // Back windows
            w1.material = windowMat

            // Upper floor
            const w2 = MeshBuilder.CreatePlane(`win_u_${x}`, { width: 1.5, height: 2.5 }, scene)
            w2.position.x = x
            w2.position.y = 6
            w2.position.z = zPos
            if (zPos < 0) w2.rotation.y = Math.PI
            w2.material = windowMat
        }
    }
    createWindows(5.1) // Front (behind columns)
    createWindows(-5.1) // Back

    // --- Dynamic Lighting (The "Result" Indicators) ---
    // Spotlights shining on the White House columns
    const createSpotlight = (x: number) => {
        const spot = new SpotLight(`spot_${x}`, 
            new Vector3(x, 0.5, 15), // Position on lawn
            new Vector3(0, 0.5, -1), // Direction towards house
            Math.PI / 3, 
            10, 
            scene
        )
        spot.intensity = 20
        return spot
    }

    lightsRef.current = [
        createSpotlight(-8),
        createSpotlight(0),
        createSpotlight(8)
    ]

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [])

  // Update Lights based on Leader
  useEffect(() => {
    if (lightsRef.current.length === 0) return

    let color = new Color3(1, 0.9, 0.5) // Default Warm White (Tie/Neutral)
    
    if (leader === 'DEM') {
        color = new Color3(0.1, 0.3, 1) // Blue
    } else if (leader === 'GOP') {
        color = new Color3(1, 0.1, 0.1) // Red
    }

    lightsRef.current.forEach(light => {
        light.diffuse = color
    })

  }, [leader])

  return <canvas ref={canvasRef} className="w-full h-full outline-none" />
}
