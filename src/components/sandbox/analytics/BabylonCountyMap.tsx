import React, { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  StandardMaterial,
  Color3,
  Color4,
  PolygonMeshBuilder,
  Vector2
} from '@babylonjs/core'
import earcut from 'earcut'

// Fix for BabylonJS polygon triangulation
(window as any).earcut = earcut

export const BabylonCountyMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1)

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 100, Vector3.Zero(), scene)
    camera.attachControl(canvasRef.current, true)
    camera.lowerRadiusLimit = 10
    camera.upperRadiusLimit = 500
    camera.wheelPrecision = 10

    // Light
    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    // Fetch Data
    fetch('/gz_2010_us_050_00_500k.json')
      .then(res => res.json())
      .then(data => {
        // Process GeoJSON
        data.features.forEach((feature: any) => {
            const geometry = feature.geometry
            const props = feature.properties
            
            // Handle Polygon and MultiPolygon
            const polygons = geometry.type === 'Polygon' 
                ? [geometry.coordinates] 
                : geometry.coordinates

            polygons.forEach((poly: any[]) => {
                // GeoJSON coordinates are [long, lat]
                // We map them to [x, z] in 3D space
                // Simple projection: x = long, z = lat
                
                // The first array in a polygon is the outer ring
                const outerRing = geometry.type === 'Polygon' ? poly[0] : poly[0]
                
                const shape = outerRing.map((coord: number[]) => {
                    return new Vector2(coord[0], coord[1])
                })

                const builder = new PolygonMeshBuilder(props.NAME + "_mesh", shape, scene, earcut)
                const mesh = builder.build(true, 0.5) // Depth 0.5
                
                mesh.position.y = 0
                
                // Random color for now based on name hash or similar
                const mat = new StandardMaterial(props.NAME + "_mat", scene)
                mat.diffuseColor = Color3.Random()
                mesh.material = mat
            })
        })
        setLoading(false)
      })
      .catch(err => console.error("Failed to load map data", err))

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

  return (
    <div className="relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full outline-none" />
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                Loading Map Data...
            </div>
        )}
    </div>
  )
}
