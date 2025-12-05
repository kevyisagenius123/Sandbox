import React, { useRef, useMemo, Suspense, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Torus, Box, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { useSandboxThemeOrDefault } from '../../design/SandboxThemeProvider'
import type { AggregateResults } from './results-summary/types'

interface VoteMarginGauge3DProps {
  aggregates: AggregateResults // Win probability calculation data
  isOpen?: boolean
  onToggle?: () => void
}

// Calculate win probability (same logic as 2D gauge)
const computeWinProbability = (aggregates: AggregateResults): { value: number; leader: 'DEM' | 'GOP' | 'TIE' } => {
  const { voteMarginAbsolute: marginVotes, votesRemaining, totalVotes } = aggregates

  const safeTotal = Math.max(totalVotes, 1)
  const marginShare = marginVotes / safeTotal
  const outstandingDenominator = totalVotes + votesRemaining
  const outstandingShare = outstandingDenominator > 0 ? votesRemaining / outstandingDenominator : 0

  const scaling = 1 - Math.min(0.95, outstandingShare)
  const probability = Math.abs(marginShare * 100 * scaling)

  const leader = marginVotes > 0 ? 'GOP' : marginVotes < 0 ? 'DEM' : 'TIE'
  const clampedProb = Number.isFinite(probability) ? Math.min(100, Math.max(0, probability)) : 0

  return { value: clampedProb, leader }
}


// 3D Semicircular Win Probability Gauge
function WinProbabilityGauge3D({ aggregates }: { aggregates: AggregateResults }) {
  const needleRef = useRef<THREE.Group>(null)
  const torusRef = useRef<THREE.Mesh>(null)
  const gaugeValueRef = useRef(0)

  // Compute win probability
  const winProb = useMemo(() => computeWinProbability(aggregates), [aggregates])
  
  // Map to gauge value: -100 (DEM) to +100 (GOP)
  const gaugeValue = useMemo(() => {
    if (!Number.isFinite(winProb.value)) return 0
    const marginSign = Math.sign(aggregates.voteMarginAbsolute)
    if (marginSign === 0) return 0
    return THREE.MathUtils.clamp(winProb.value * marginSign, -100, 100)
  }, [winProb, aggregates.voteMarginAbsolute])

  useEffect(() => {
    gaugeValueRef.current = gaugeValue
  }, [gaugeValue])

  // Animate needle rotation
  useFrame(() => {
    if (needleRef.current) {
      // Map -100 (left, DEM) to 0 (top) to +100 (right, GOP)
      const currentValue = gaugeValueRef.current
      const normalizedValue = THREE.MathUtils.clamp((currentValue + 100) / 200, 0, 1)
      const rawAngle = (1 - normalizedValue) * Math.PI * 1.1 - Math.PI * 0.05
      const targetAngle = rawAngle - Math.PI / 2 // align zero to top center

      needleRef.current.rotation.z = targetAngle
    }
  })

  // Color gradient segments (DEM blue → neutral gray → GOP red)
  const segments = useMemo(() => {
    const colors = [
      { angle: 0, color: new THREE.Color('#7f1d1d') },     // +100: Deep red (GOP)
      { angle: 0.1, color: new THREE.Color('#991b1b') },   // +80
      { angle: 0.2, color: new THREE.Color('#dc2626') },   // +60
      { angle: 0.3, color: new THREE.Color('#ef4444') },   // +40
      { angle: 0.4, color: new THREE.Color('#f87171') },   // +20
      { angle: 0.45, color: new THREE.Color('#fca5a5') },  // +10
      { angle: 0.5, color: new THREE.Color('#e5e7eb') },   // 0: Neutral
      { angle: 0.55, color: new THREE.Color('#93c5fd') },  // -10
      { angle: 0.6, color: new THREE.Color('#60a5fa') },   // -20
      { angle: 0.7, color: new THREE.Color('#3b82f6') },   // -40
      { angle: 0.8, color: new THREE.Color('#2563eb') },   // -60
      { angle: 0.9, color: new THREE.Color('#1d4ed8') },   // -80
      { angle: 1, color: new THREE.Color('#1e3a8a') }      // -100: Deep blue (DEM)
    ]
    return colors
  }, [])

  const leaderName = winProb.leader === 'GOP' ? 'Republican' : winProb.leader === 'DEM' ? 'Democratic' : 'Tie'

  return (
    <group rotation={[0, 0, 0]}>
      {/* Semicircular Torus (gauge arc) with gradient material */}
      <Torus 
        ref={torusRef}
        args={[2, 0.15, 16, 100, Math.PI * 1.1]} 
        rotation={[0, 0, -Math.PI * 0.05]}
      >
        <meshStandardMaterial
          color="#4b5563"
          metalness={0.7}
          roughness={0.3}
          emissive="#1f2937"
          emissiveIntensity={0.2}
        />
      </Torus>

      {/* Colored arc segments overlay */}
      {segments.map((seg, i) => {
        if (i === segments.length - 1) return null
        const nextSeg = segments[i + 1]
        const startAngle = seg.angle * Math.PI * 1.1
        const endAngle = nextSeg.angle * Math.PI * 1.1
        
        return (
          <Torus
            key={i}
            args={[2, 0.16, 16, Math.ceil(100 * (nextSeg.angle - seg.angle)), endAngle - startAngle]}
            rotation={[0, 0, -Math.PI * 0.05 + startAngle]}
          >
            <meshStandardMaterial
              color={seg.color}
              metalness={0.8}
              roughness={0.2}
              emissive={seg.color}
              emissiveIntensity={0.3}
            />
          </Torus>
        )
      })}

      {/* Tick marks */}
      {[-100, -50, 0, 50, 100].map(value => {
        const normalizedValue = (value + 100) / 200 // 0 to 1
        const angle = (1 - normalizedValue) * Math.PI * 1.1 - Math.PI * 0.05
        const radius = 2.3
        const x = radius * Math.cos(angle)
        const y = radius * Math.sin(angle)
        
        return (
          <group key={value}>
            <Box args={[0.08, 0.25, 0.05]} position={[x, y, 0]} rotation={[0, 0, angle - Math.PI / 2]}>
              <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} />
            </Box>
            <Text
              position={[x * 1.15, y * 1.15, 0]}
              fontSize={0.2}
              color="#f8fafc"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {Math.abs(value)}
            </Text>
          </group>
        )
      })}

      {/* Needle/Pointer */}
  <group ref={needleRef} position={[0, 0, 0.1]}>
        {/* Needle shaft */}
        <Box args={[0.08, 1.8, 0.08]} position={[0, 0.9, 0]}>
          <meshStandardMaterial 
            color="#f8fafc" 
            metalness={0.9} 
            roughness={0.1}
            emissive="#ffffff"
            emissiveIntensity={0.5}
          />
        </Box>
        {/* Needle center pivot */}
        <Sphere args={[0.15, 32, 32]}>
          <meshStandardMaterial 
            color="#f8fafc" 
            metalness={0.95} 
            roughness={0.05}
          />
        </Sphere>
      </group>

      {/* Center display - probability value */}
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.6}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {winProb.value.toFixed(1)}%
      </Text>

      <Text
        position={[0, -1.3, 0]}
        fontSize={0.25}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {leaderName} Win
      </Text>

      <Text
        position={[0, -1.6, 0]}
        fontSize={0.2}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
      >
        Probability
      </Text>

      {/* Base platform */}
      <Box args={[5, 0.2, 1.5]} position={[0, -2.2, -0.2]}>
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </Box>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, -5, 5]} intensity={0.3} color="#60a5fa" />
      <spotLight position={[0, 5, 3]} intensity={0.5} angle={0.6} penumbra={0.5} castShadow />
    </group>
  )
}

export const VoteMarginGauge3D: React.FC<VoteMarginGauge3DProps> = ({
  aggregates,
  isOpen = true,
  onToggle
}) => {
  const theme = useSandboxThemeOrDefault()

  return (
    <div
      className="border-t"
      style={{
        backgroundColor: '#0a0e1a',
        borderTopColor: '#1e293b',
        transition: 'height 0.3s ease',
        overflow: 'hidden',
        height: isOpen ? '450px' : '48px'
      }}
    >
      {/* Header */}
      {onToggle && (
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/50"
          onClick={onToggle}
        >
          <span className="text-sm font-semibold" style={{ color: theme.palette.text.primary }}>
            Win Probability Gauge (3D)
          </span>
          <button className="p-1 rounded hover:bg-slate-700">
            <span style={{ color: theme.palette.text.primary }}>
              {isOpen ? '▼' : '▲'}
            </span>
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      {isOpen && (
        <div style={{ width: '100%', height: onToggle ? 'calc(100% - 48px)' : '100%' }}>
          <Canvas camera={{ position: [0, 0, 7], fov: 50 }}>
            <Suspense fallback={null}>
              <WinProbabilityGauge3D aggregates={aggregates} />
              <OrbitControls 
                enablePan={false}
                minDistance={4}
                maxDistance={12}
                autoRotate
                autoRotateSpeed={0.5}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 4}
              />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  )
}
