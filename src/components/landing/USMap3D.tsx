import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

interface StateFeature {
  type: string
  properties: {
    NAME: string
    STATE: string
  }
  geometry: {
    type: string
    coordinates: number[][][][]
  }
}

interface StateBlockProps {
  coordinates: number[][][][]
  name: string
  stateId: string
}

function StateBlock({ coordinates, stateId }: StateBlockProps) {
  const meshRef = useRef<THREE.Group>(null)
  const hoverHeight = useRef(0.1)
  const baseHeight = 0.1
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      const wave = Math.sin(time * 0.5 + parseInt(stateId) * 0.2) * 0.05
      const targetHeight = baseHeight + wave
      hoverHeight.current = THREE.MathUtils.lerp(hoverHeight.current, targetHeight, 0.05)
      meshRef.current.position.z = hoverHeight.current
    }
  })

  // Convert GeoJSON coordinates to THREE.js shapes
  const shapes = useMemo(() => {
    const shapeList: THREE.Shape[] = []
    
    coordinates.forEach((polygon) => {
      polygon.forEach((ring, ringIndex) => {
        if (ring.length < 3) return
        
        const shape = new THREE.Shape()
        ring.forEach((coord, i) => {
          const [lon, lat] = coord
          // Project lon/lat to 2D (simple mercator-like)
          const x = (lon + 180) * (6 / 360) - 3
          const y = (lat - 25) * (4 / 50) - 2
          
          if (i === 0) {
            shape.moveTo(x, y)
          } else {
            shape.lineTo(x, y)
          }
        })
        
        if (ringIndex === 0) {
          shapeList.push(shape)
        }
      })
    })
    
    return shapeList
  }, [coordinates])

  return (
    <group ref={meshRef}>
      {shapes.map((shape, i) => (
        <mesh key={i} castShadow receiveShadow>
          <extrudeGeometry
            args={[
              shape,
              {
                depth: 0.15,
                bevelEnabled: true,
                bevelThickness: 0.02,
                bevelSize: 0.01,
                bevelSegments: 2
              }
            ]}
          />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#2563eb"
            emissiveIntensity={0.2}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

function ParticleField() {
  const particlesRef = useRef<THREE.Points>(null)
  
  const particles = useMemo(() => {
    const positions = new Float32Array(150 * 3)
    for (let i = 0; i < 150; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3
    }
    return positions
  }, [])

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.03
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#60a5fa"
        transparent
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  )
}

function MapScene() {
  const groupRef = useRef<THREE.Group>(null)
  const [statesData, setStatesData] = useState<StateFeature[]>([])

  useEffect(() => {
    fetch('/gz_2010_us_040_00_500k.json')
      .then(res => res.json())
      .then(data => {
        setStatesData(data.features.slice(0, 51)) // First 51 states
      })
      .catch(err => console.error('Failed to load GeoJSON:', err))
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.15) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -0.5]}>
      {statesData.map((state) => (
        <StateBlock
          key={state.properties.STATE}
          coordinates={state.geometry.coordinates}
          name={state.properties.NAME}
          stateId={state.properties.STATE}
        />
      ))}
      <ParticleField />
      
      {/* Base platform */}
      <mesh position={[0, 0, -0.3]} receiveShadow>
        <boxGeometry args={[7, 5, 0.08]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 4]} intensity={0.6} color="#3b82f6" />
      <pointLight position={[-3, -3, 3]} intensity={0.4} color="#60a5fa" />
      <spotLight
        position={[0, 6, 3]}
        angle={0.6}
        penumbra={0.5}
        intensity={0.5}
        castShadow
      />
    </group>
  )
}

export const USMap3D: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 500
}) => {
  return (
    <div className={className} style={{ height: `${height}px`, width: '100%' }}>
      <Canvas shadows gl={{ alpha: true, antialias: true }}>
        <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={60} />
        <MapScene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>
    </div>
  )
}

export default USMap3D
