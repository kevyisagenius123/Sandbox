import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Float, OrbitControls, Grid } from '@react-three/drei'

export type BattlegroundBar = {
  state: string
  leading: 'DEM' | 'GOP'
  margin: number // percentage points
  reporting: number // percent reporting
}

interface VizrtShowcaseProps {
  battlegrounds: BattlegroundBar[]
}

const VoteBar: React.FC<{ bar: ReturnType<typeof buildBar> }> = ({ bar }) => {
  const { position, height, color, label, sublabel } = bar
  const [x, z] = position

  return (
    <group position={[x, height / 2 - 0.9, z]}>
      <Float speed={1.1} rotationIntensity={0.02} floatIntensity={0.25}>
        <mesh castShadow>
          <boxGeometry args={[0.7, height, 0.7]} />
          <meshStandardMaterial
            color={color}
            metalness={0.45}
            roughness={0.2}
            emissive={color}
            emissiveIntensity={0.25}
          />
        </mesh>

        {/* Cap */}
        <mesh position={[0, height / 2 + 0.04, 0]}>
          <boxGeometry args={[0.9, 0.1, 0.9]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.1} />
        </mesh>

        <Html position={[0, height / 2 + 0.35, 0]} center>
          <div className="text-[10px] tracking-[0.4em] uppercase text-slate-100 font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
            {label}
          </div>
        </Html>

        <Html position={[0, -height / 2 - 0.35, 0]} center>
          <div className="text-[10px] text-slate-300 font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {sublabel}
          </div>
        </Html>
      </Float>
    </group>
  )
}

const buildBar = (index: number, total: number, battleground: BattlegroundBar) => {
  const spread = 1.4
  const offset = (total - 1) / 2
  const x = (index - offset) * spread
  const marginBoost = Math.min(Math.abs(battleground.margin) * 0.35, 2.2)
  const reportingBoost = battleground.reporting * 0.01
  const height = 1.2 + marginBoost + reportingBoost
  const color = battleground.leading === 'DEM' ? '#2563eb' : '#dc2626'
  const sublabel = `${battleground.margin > 0 ? '+' : ''}${battleground.margin.toFixed(1)}% • ${battleground.reporting}% REP`

  return {
    position: [x, 0],
    height,
    color,
    label: battleground.state,
    sublabel
  }
}

export const VizrtShowcase: React.FC<VizrtShowcaseProps> = ({ battlegrounds }) => {
  const bars = useMemo(() => battlegrounds.map((bg, idx) => buildBar(idx, battlegrounds.length, bg)), [battlegrounds])

  return (
    <Canvas shadows camera={{ position: [0, 3.5, 6.5], fov: 42 }}>
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.65} />
      <spotLight
        position={[6, 10, 6]}
        angle={0.9}
        penumbra={0.6}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 4, 2]} intensity={0.4} color="#38bdf8" />

      <group position={[0, -1, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[18, 18]} />
          <meshStandardMaterial color="#050b18" metalness={0.1} roughness={0.9} />
        </mesh>
        <Grid
          args={[14, 14]}
          position={[0, 0.01, 0]}
          cellSize={0.75}
          cellColor="#0f172a"
          sectionColor="#1e293b"
          fadeDistance={30}
          fadeStrength={1}
          infiniteGrid
        />
      </group>

      {bars.map((bar) => (
        <VoteBar key={bar.label} bar={bar} />
      ))}

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  )
}
