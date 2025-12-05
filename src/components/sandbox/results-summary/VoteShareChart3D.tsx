import React, { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { Text, OrbitControls, Float, Html } from '@react-three/drei'
import * as THREE from 'three'

interface VoteShareChartProps {
  series: { name: string; value: number }[]
}

interface PieSegmentProps {
  startAngle: number
  endAngle: number
  color: string
  radius: number
  height: number
  label: string
  percentage: number
  value: number
  onHover: (hovered: boolean) => void
  isHovered: boolean
}

const PieSegment: React.FC<PieSegmentProps> = ({
  startAngle,
  endAngle,
  color,
  radius,
  height,
  label,
  percentage,
  value,
  onHover,
  isHovered
}) => {
  const meshRef = useRef<THREE.Mesh>(null)

  // Animate segment on hover
  useFrame(() => {
    if (meshRef.current) {
      const targetY = isHovered ? 0.2 : 0
      meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1
    }
  })

  // Create flat pie segment geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const segments = 32
    const angleStep = (endAngle - startAngle) / segments

    shape.moveTo(0, 0)
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + angleStep * i
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      shape.lineTo(x, y)
    }
    shape.lineTo(0, 0)

    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2
    }

    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [startAngle, endAngle, radius, height])

  const midAngle = (startAngle + endAngle) / 2
  const labelRadius = radius * 0.65
  const labelX = Math.cos(midAngle) * labelRadius
  const labelZ = Math.sin(midAngle) * labelRadius

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(true)
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = () => {
    onHover(false)
    document.body.style.cursor = 'auto'
  }

  return (
    <group>
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.08}>
        <mesh 
          ref={meshRef} 
          geometry={geometry} 
          rotation={[-Math.PI / 2, 0, 0]} 
          castShadow 
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            color={color}
            metalness={0.3}
            roughness={0.4}
            emissive={color}
            emissiveIntensity={isHovered ? 0.5 : 0.25}
          />
        </mesh>
      </Float>

      {/* Tooltip */}
      {isHovered && (
        <Html position={[labelX, height + 1.2, labelZ]} center>
          <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-600 pointer-events-none">
            <div className="font-semibold text-sm mb-1">{label}</div>
            <div className="text-xs text-slate-300">{value.toLocaleString()} votes</div>
            <div className="text-xs text-slate-400">{percentage.toFixed(2)}%</div>
          </div>
        </Html>
      )}

      {/* Label */}
      <group position={[labelX, height + 0.15, labelZ]}>
        <Text
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {label}
        </Text>
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.2}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {percentage.toFixed(1)}%
        </Text>
        <Text
          position={[0, -0.55, 0]}
          fontSize={0.15}
          color="#cbd5e1"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {value.toLocaleString()}
        </Text>
      </group>
    </group>
  )
}

const VoteShareChart3D: React.FC<VoteShareChartProps> = ({ series }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const segments = useMemo(() => {
    const total = series.reduce((sum, item) => sum + item.value, 0)
    if (total === 0) return []

    let currentAngle = -Math.PI / 2 // Start at top (12 o'clock position)
    return series.map((item, index) => {
      const percentage = (item.value / total) * 100
      const angleSize = (item.value / total) * Math.PI * 2
      const startAngle = currentAngle
      const endAngle = currentAngle + angleSize
      currentAngle = endAngle

      const color =
        item.name === 'Republican'
          ? '#dc2626'
          : item.name === 'Democratic'
          ? '#3b82f6'
          : '#94a3b8'

      return {
        startAngle,
        endAngle,
        color,
        radius: 2,
        height: 0.6,
        label: item.name,
        percentage,
        value: item.value,
        index
      }
    })
  }, [series])

  return (
    <div className="h-64 w-full bg-slate-900 rounded-lg">
      <Canvas
        shadows
        camera={{ position: [0, 5, 6], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <spotLight
          position={[5, 8, 3]}
          angle={0.6}
          intensity={1.2}
          penumbra={0.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <spotLight position={[-4, 6, -2]} color="#60a5fa" intensity={0.4} angle={0.7} />
        <directionalLight position={[0, 4, 4]} intensity={0.3} color="#facc15" />

        {/* Base platform */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[2.5, 64]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Pie segments */}
        {segments.map((segment) => (
          <PieSegment 
            key={`${segment.label}-${segment.index}`} 
            {...segment}
            onHover={(hovered) => setHoveredIndex(hovered ? segment.index : null)}
            isHovered={hoveredIndex === segment.index}
          />
        ))}

        {/* Title */}
        <Text
          position={[0, 3, 0]}
          fontSize={0.35}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          Vote Share
        </Text>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate={true}
          autoRotateSpeed={1}
          minDistance={4}
          maxDistance={10}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}

export default VoteShareChart3D
