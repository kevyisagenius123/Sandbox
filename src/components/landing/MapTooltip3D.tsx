import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'

type StateOutcome = {
  marginPct: number
  winner: 'DEM' | 'GOP' | null
  turnoutRatio: number
  totalVotes: number
}

const STATE_NAMES: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
  '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
  '18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
  '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
  '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
  '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon',
  '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia',
  '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
}

const STATE_FLAG_URL: Record<string, string> = {
  '01': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Alabama.svg',
  '02': 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Flag_of_Alaska.svg',
  '04': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Flag_of_Arizona.svg',
  '05': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Flag_of_Arkansas.svg',
  '06': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Flag_of_California.svg',
  '08': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Flag_of_Colorado.svg',
  '09': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Flag_of_Connecticut.svg',
  '10': 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Flag_of_Delaware.svg',
  '11': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Flag_of_Washington%2C_D.C..svg',
  '12': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Florida.svg',
  '13': 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Flag_of_Georgia.svg',
  '15': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Flag_of_Hawaii.svg',
  '16': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_Idaho.svg',
  '17': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Flag_of_Illinois.svg',
  '18': 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Flag_of_Indiana.svg',
  '19': 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Flag_of_Iowa.svg',
  '20': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Flag_of_Kansas.svg',
  '21': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Flag_of_Kentucky.svg',
  '22': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Flag_of_Louisiana.svg',
  '23': 'https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Maine.svg',
  '24': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Flag_of_Maryland.svg',
  '25': 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Flag_of_Massachusetts.svg',
  '26': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Flag_of_Michigan.svg',
  '27': 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Minnesota.svg',
  '28': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Flag_of_Mississippi.svg',
  '29': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Flag_of_Missouri.svg',
  '30': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Flag_of_Montana.svg',
  '31': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Flag_of_Nebraska.svg',
  '32': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Flag_of_Nevada.svg',
  '33': 'https://upload.wikimedia.org/wikipedia/commons/2/28/Flag_of_New_Hampshire.svg',
  '34': 'https://upload.wikimedia.org/wikipedia/commons/9/92/Flag_of_New_Jersey.svg',
  '35': 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_New_Mexico.svg',
  '36': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_New_York.svg',
  '37': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Flag_of_North_Carolina.svg',
  '38': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Flag_of_North_Dakota.svg',
  '39': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Flag_of_Ohio.svg',
  '40': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Flag_of_Oklahoma.svg',
  '41': 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Oregon.svg',
  '42': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Pennsylvania.svg',
  '44': 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Rhode_Island.svg',
  '45': 'https://upload.wikimedia.org/wikipedia/commons/6/69/Flag_of_South_Carolina.svg',
  '46': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_South_Dakota.svg',
  '47': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Flag_of_Tennessee.svg',
  '48': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Texas.svg',
  '49': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Flag_of_Utah.svg',
  '50': 'https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Vermont.svg',
  '51': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Flag_of_Virginia.svg',
  '53': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Flag_of_Washington.svg',
  '54': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Flag_of_West_Virginia.svg',
  '55': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Flag_of_Wisconsin.svg',
  '56': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Flag_of_Wyoming.svg'
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const MapTooltip3D: React.FC<{
  stateFips: string
  position: [number, number, number]
  outcome?: StateOutcome
}> = ({ stateFips, position, outcome }) => {
  const rootRef = useRef<THREE.Group>(null)
  const panelRef = useRef<THREE.Group>(null)
  const targetScale = useRef(1)
  const currentScale = useRef(0)
  const targetPosition = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const smoothedPosition = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const panelOrientation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0.28, 0)), [])
  const flagUrl = STATE_FLAG_URL[stateFips]
  const flagTexture = useMemo(() => {
    if (!flagUrl) return null
    const loader = new THREE.TextureLoader()
    const texture = loader.load(flagUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [flagUrl])
  const reportingPercent = useMemo(() => clamp((outcome?.turnoutRatio ?? 0) * 100, 0, 110), [outcome])
  const reportingAccentColor = reportingPercent >= 99.9 ? '#34d399' : reportingPercent >= 50 ? '#38bdf8' : '#94a3b8'
  const hasVotes = (outcome?.totalVotes ?? 0) > 0
  const liveLabel = hasVotes ? 'Live vote totals' : 'Awaiting first report'
  const liveIndicatorColor = hasVotes ? '#34d399' : '#94a3b8'
  const marginNumeric = outcome?.marginPct ?? 0
  const marginPercentLabel = hasVotes ? `${Math.abs(marginNumeric).toFixed(1)}%` : '—'

  useEffect(() => {
    targetScale.current = 1
    currentScale.current = 0
  }, [stateFips])

  useEffect(() => {
    targetPosition.current.set(position[0], position[1], position[2])
  }, [position])

  useFrame((_, delta) => {
    const root = rootRef.current
    if (root) {
      const lerpFactor = 1 - Math.pow(0.02, delta)
      smoothedPosition.current.lerp(targetPosition.current, lerpFactor)
      root.position.copy(smoothedPosition.current)
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, delta * 6)
      root.scale.setScalar(currentScale.current)
    }

    const panel = panelRef.current
    if (panel) {
      panel.quaternion.slerp(panelOrientation, delta * 5)
    }
  })

  const stateName = STATE_NAMES[stateFips] ?? 'Unknown State'
  
  const {
    demPercent,
    gopPercent,
    marginLabel,
    marginColor,
    totalVotesLabel,
    demVotesLabel,
    gopVotesLabel
  } = useMemo(() => {
    if (!outcome) {
      return {
        demVotes: 0,
        gopVotes: 0,
        demPercent: 0,
        gopPercent: 0,
        marginLabel: 'No data',
        marginColor: '#94a3b8',
        totalVotesLabel: '—',
        demVotesLabel: '—',
        gopVotesLabel: '—'
      }
    }

    const { marginPct, winner, totalVotes } = outcome
    const dem = winner === 'DEM' 
      ? Math.round(totalVotes * (50 + marginPct / 2) / 100) 
      : Math.round(totalVotes * (50 - marginPct / 2) / 100)
    const gop = winner === 'GOP' 
      ? Math.round(totalVotes * (50 + marginPct / 2) / 100) 
      : Math.round(totalVotes * (50 - marginPct / 2) / 100)
    const demPct = totalVotes > 0 ? (dem / totalVotes) * 100 : 0
    const gopPct = totalVotes > 0 ? (gop / totalVotes) * 100 : 0
    
    const marginPrefix = marginPct >= 0 ? 'R' : 'D'
    const color = marginPct >= 0 ? '#fca5a5' : '#93c5fd'
    const label = `${marginPrefix} +${Math.abs(marginPct).toFixed(1)}`
    
    const formatVotes = (votes: number) => {
      if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1)}M`
      if (votes >= 1_000) return `${Math.round(votes / 1_000)}K`
      return votes.toLocaleString('en-US')
    }

    return {
      demVotes: dem,
      gopVotes: gop,
      demPercent: demPct,
      gopPercent: gopPct,
      marginLabel: label,
      marginColor: color,
      totalVotesLabel: formatVotes(totalVotes),
      demVotesLabel: formatVotes(dem),
      gopVotesLabel: formatVotes(gop)
    }
  }, [outcome])

  const cardWidth = 2.65
  const cardHeight = 2.2
  const padding = 0.14
  const contentZ = 0.05
  const headerY = cardHeight / 2 - padding - 0.15
  const statusY = headerY - 0.3
  const barY = statusY - 0.34
  const statsY = barY - 0.4
  const totalRowY = statsY - 0.32
  const reportingY = totalRowY - 0.32
  const marginY = -cardHeight / 2 + padding + 0.12
  const reportingTrackWidth = cardWidth - padding * 2
  const reportingFillWidth = Math.max(
    0.05,
    Math.min(reportingTrackWidth, reportingTrackWidth * (reportingPercent / 100))
  )
  const marginToneColor = hasVotes ? (marginNumeric >= 0 ? '#fecaca' : '#c7d2fe') : '#94a3b8'

  const demPercentText = `${demPercent.toFixed(1)}%`
  const gopPercentText = `${gopPercent.toFixed(1)}%`

  return (
    <group ref={rootRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[cardWidth * 0.85, cardHeight * 0.55]} />
        <meshStandardMaterial color="#020817" transparent opacity={0.35} />
      </mesh>

      <group ref={panelRef} position={[0, cardHeight / 2 + 0.05, 0]}>
        <RoundedBox args={[cardWidth, cardHeight, 0.06]} radius={0.08} smoothness={4}>
          <meshStandardMaterial
            color="#0b1424"
            metalness={0.3}
            roughness={0.38}
            emissive="#132238"
            emissiveIntensity={0.4}
          />
        </RoundedBox>
        <RoundedBox
          args={[cardWidth - padding * 0.5, cardHeight - padding * 0.5, 0.02]}
          radius={0.07}
          smoothness={4}
          position={[0, 0, 0.04]}
        >
          <meshStandardMaterial color="#121f33" metalness={0.25} roughness={0.45} />
        </RoundedBox>

        {/* Header */}
        <group position={[-cardWidth / 2 + padding + 0.35, headerY, contentZ]}>
          <RoundedBox args={[0.68, 0.42, 0.04]} radius={0.08} smoothness={4}>
            <meshStandardMaterial color="#060b13" metalness={0.35} roughness={0.4} />
          </RoundedBox>
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.58, 0.32]} />
            <meshStandardMaterial
              map={flagTexture ?? undefined}
              color={flagTexture ? '#ffffff' : '#1e293b'}
              emissive="#0f172a"
              emissiveIntensity={0.25}
              toneMapped={false}
            />
          </mesh>
        </group>
        <group position={[-cardWidth / 2 + padding + 0.95, headerY + 0.04, contentZ]}>
          <Text
            fontSize={0.15}
            color="#f8fafc"
            anchorX="left"
            anchorY="middle"
            letterSpacing={0.01}
          >
            {stateName}
          </Text>
          <Text
            position={[0, -0.16, 0]}
            fontSize={0.085}
            color="#a5b4fc"
            anchorX="left"
            anchorY="middle"
            letterSpacing={0.02}
          >
            {hasVotes ? 'Statewide live desk' : 'Awaiting first report'}
          </Text>
        </group>

        {/* Live indicator */}
        <group position={[-cardWidth / 2 + padding, statusY, contentZ]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.03, 18, 18]} />
            <meshStandardMaterial
              color={liveIndicatorColor}
              emissive={liveIndicatorColor}
              emissiveIntensity={hasVotes ? 1.6 : 0.4}
              toneMapped={false}
            />
          </mesh>
          <Text
            position={[0.09, 0, 0]}
            fontSize={0.09}
            color={liveIndicatorColor}
            anchorX="left"
            anchorY="middle"
            letterSpacing={0.03}
          >
            {liveLabel}
          </Text>
        </group>

        {/* Vote split bar */}
        <group position={[0, barY, contentZ]}>
          <RoundedBox args={[cardWidth - padding * 2, 0.2, 0.04]} radius={0.1} smoothness={4}>
            <meshStandardMaterial color="#1c2739" metalness={0.25} roughness={0.55} />
          </RoundedBox>
          {demPercent > 0 && (
            <RoundedBox
              args={[((cardWidth - padding * 2) * demPercent) / 100, 0.2, 0.05]}
              radius={0.1}
              smoothness={4}
              position={[
                -((cardWidth - padding * 2) / 2) + (((cardWidth - padding * 2) * demPercent) / 100) / 2,
                0,
                0.01
              ]}
            >
              <meshStandardMaterial
                color="#3b82f6"
                emissive="#1d4ed8"
                emissiveIntensity={0.45}
                metalness={0.65}
                roughness={0.28}
              />
            </RoundedBox>
          )}
          {gopPercent > 0 && (
            <RoundedBox
              args={[((cardWidth - padding * 2) * gopPercent) / 100, 0.2, 0.05]}
              radius={0.1}
              smoothness={4}
              position={[
                ((cardWidth - padding * 2) / 2) - (((cardWidth - padding * 2) * gopPercent) / 100) / 2,
                0,
                0.01
              ]}
            >
              <meshStandardMaterial
                color="#f87171"
                emissive="#b91c1c"
                emissiveIntensity={0.45}
                metalness={0.65}
                roughness={0.28}
              />
            </RoundedBox>
          )}
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.015, 0.26, 0.01]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.4} emissive="#94a3b8" emissiveIntensity={0.2} />
          </mesh>
        </group>

        {/* Stats */}
        <group position={[-cardWidth / 2 + padding, statsY, contentZ]}>
          <Text fontSize={0.085} color="#9ec5ff" anchorX="left" anchorY="middle" letterSpacing={0.02}>
            DEMOCRAT
          </Text>
          <Text position={[0, -0.18, 0]} fontSize={0.14} color="#f8fafc" anchorX="left" anchorY="middle">
            {demPercentText}
          </Text>
          <Text position={[0, -0.33, 0]} fontSize={0.085} color="#c8d7ff" anchorX="left" anchorY="middle">
            {demVotesLabel} votes
          </Text>
        </group>
        <group position={[cardWidth / 2 - padding, statsY, contentZ]}>
          <Text fontSize={0.085} color="#fecdd3" anchorX="right" anchorY="middle" letterSpacing={0.02}>
            REPUBLICAN
          </Text>
          <Text position={[0, -0.18, 0]} fontSize={0.14} color="#f8fafc" anchorX="right" anchorY="middle">
            {gopPercentText}
          </Text>
          <Text position={[0, -0.33, 0]} fontSize={0.085} color="#fecdd3" anchorX="right" anchorY="middle">
            {gopVotesLabel} votes
          </Text>
        </group>

        {/* Divider */}
        <mesh position={[0, statsY - 0.42, contentZ]}>
          <boxGeometry args={[cardWidth - padding * 2, 0.01, 0.01]} />
          <meshStandardMaterial color="#2c3c55" transparent opacity={0.7} />
        </mesh>

        {/* Totals */}
        <group position={[0, totalRowY, contentZ]}>
          <Text position={[-cardWidth / 2 + padding, 0, 0]} fontSize={0.085} color="#9ca3af" anchorX="left" anchorY="middle">
            Total votes
          </Text>
          <Text position={[cardWidth / 2 - padding, 0, 0]} fontSize={0.1} color="#e2e8f0" anchorX="right" anchorY="middle">
            {totalVotesLabel}
          </Text>
        </group>

        {/* Reporting */}
        <group position={[0, reportingY, contentZ]}>
          <Text position={[-cardWidth / 2 + padding, 0.1, 0]} fontSize={0.08} color="#94a3b8" anchorX="left" anchorY="middle">
            Reporting
          </Text>
          <Text position={[cardWidth / 2 - padding, 0.1, 0]} fontSize={0.09} color="#e2e8f0" anchorX="right" anchorY="middle">
            {reportingPercent.toFixed(1)}%
          </Text>
          <RoundedBox
            args={[reportingTrackWidth, 0.12, 0.03]}
            radius={0.06}
            smoothness={4}
            position={[0, -0.03, 0]}
          >
            <meshStandardMaterial color="#0f172a" roughness={0.65} metalness={0.15} />
          </RoundedBox>
          <RoundedBox
            args={[reportingFillWidth, 0.1, 0.04]}
            radius={0.05}
            smoothness={4}
            position={[(-reportingTrackWidth / 2) + reportingFillWidth / 2, -0.03, 0.02]}
          >
            <meshStandardMaterial color={reportingAccentColor} emissive={reportingAccentColor} emissiveIntensity={0.5} toneMapped={false} />
          </RoundedBox>
        </group>

        {/* Margin pill */}
        <group position={[0, marginY, contentZ + 0.01]}>
          <RoundedBox args={[1.35, 0.26, 0.05]} radius={0.13} smoothness={4}>
            <meshStandardMaterial color="#131f33" metalness={0.3} roughness={0.45} />
          </RoundedBox>
          <Text position={[-0.45, 0, 0.02]} fontSize={0.085} color="#94a3b8" anchorX="left" anchorY="middle">
            Margin
          </Text>
          <Text position={[-0.05, 0, 0.02]} fontSize={0.1} color={marginColor} anchorX="left" anchorY="middle" letterSpacing={0.02}>
            {marginLabel}
          </Text>
          <Text position={[0.5, 0, 0.02]} fontSize={0.085} color={marginToneColor} anchorX="right" anchorY="middle">
            • {marginPercentLabel}
          </Text>
        </group>

        <pointLight position={[0, 0.42, 0.2]} intensity={0.35} distance={2.3} color="#60a5fa" decay={2} />
      </group>
    </group>
  )
}

export default MapTooltip3D
