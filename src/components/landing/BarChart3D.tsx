import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'

// Data metrics for the bar chart
const chartData = [
  { label: 'Simulation\nSpeed', value: 0.92, color: '#3b82f6' },
  { label: 'Data\nAccuracy', value: 0.98, color: '#2563eb' },
  { label: 'System\nUptime', value: 0.995, color: '#1d4ed8' },
  { label: 'User\nSatisfaction', value: 0.89, color: '#1e40af' },
  { label: 'Platform\nReliability', value: 0.96, color: '#1e3a8a' },
]

interface BarProps {
  position: [number, number, number]
  height: number
  color: string
  label: string
  index: number
}

function Bar({ position, height, color, label, index }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const targetHeight = useRef(height)
  const currentHeight = useRef(0)
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      
      // Animate bar growing
      if (currentHeight.current < targetHeight.current) {
        currentHeight.current = THREE.MathUtils.lerp(
          currentHeight.current,
          targetHeight.current,
          0.02
        )
        meshRef.current.scale.y = currentHeight.current
        meshRef.current.position.y = currentHeight.current / 2
      }
      
      // Subtle pulse
      const pulse = Math.sin(time * 2 + index * 0.5) * 0.02 + 1
      const material = meshRef.current.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.3 + Math.sin(time * 1.5 + index * 0.8) * 0.1
      meshRef.current.scale.x = pulse
      meshRef.current.scale.z = pulse
    }
  })

  return (
    <group position={position}>
      {/* Bar */}
      <mesh ref={meshRef} position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 1, 0.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, -0.3, 0]}
        fontSize={0.12}
        color="#e2e8f0"
        anchorX="center"
        anchorY="top"
        maxWidth={0.6}
        textAlign="center"
      >
        {label}
      </Text>
      
      {/* Value label on top */}
      <Text
        position={[0, height + 0.15, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        fontWeight="bold"
      >
        {Math.round(height * 100)}%
      </Text>
    </group>
  )
}

function ParticleField() {
  const particlesRef = useRef<THREE.Points>(null)
  
  const particles = React.useMemo(() => {
    const positions = new Float32Array(150 * 3)
    for (let i = 0; i < 150; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6
      positions[i * 3 + 1] = Math.random() * 4
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
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

function ChartScene() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.1
    }
  })

  const spacing = 0.6

  return (
    <group ref={groupRef}>
      {chartData.map((data, index) => (
        <Bar
          key={data.label}
          position={[(index - 2) * spacing, 0, 0]}
          height={data.value * 3}
          color={data.color}
          label={data.label}
          index={index}
        />
      ))}
      
      <ParticleField />
      
      {/* Grid base */}
      <mesh position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Grid lines */}
      <gridHelper args={[4, 10, '#1e293b', '#1e293b']} position={[0, 0.01, 0]} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 4, 3]} intensity={0.8} color="#3b82f6" />
      <pointLight position={[-3, 2, 2]} intensity={0.5} color="#60a5fa" />
      <spotLight
        position={[0, 5, 3]}
        angle={0.6}
        penumbra={0.5}
        intensity={0.6}
        castShadow
      />
    </group>
  )
}

export const BarChart3D: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 500
}) => {
  return (
    <div className={className} style={{ height: `${height}px`, width: '100%' }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 2, 4]} fov={50} />
        <ChartScene />
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

export default BarChart3D
