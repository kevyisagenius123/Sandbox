import React, { useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Billboard, Float, RoundedBox, Scroll, ScrollControls, Text, useCursor, useScroll } from '@react-three/drei'
import { isAuthenticated, logout } from '../utils/auth'

const heroHighlights = [
  {
    title: 'Deterministic simulation pipeline',
    description: 'Seeded runs and immutable manifests ensure any scenario can be reproduced for standards and practices review.'
  },
  {
    title: 'DeckGL visualization at scale',
    description: 'Frame orchestration and topic channels keep every on-air surface synchronized across map, timeline, and newsroom feeds.'
  },
  {
    title: 'Analyst-centered workflow',
    description: 'Templates, approvals, and narrative briefs align decision desks, editorial, and streaming teams in one control surface.'
  },
  {
    title: 'Transparent governance',
    description: 'Role-based controls, audit trails, and data retention policies are built in rather than bolted on.'
  }
]

const principles = [
  {
    title: 'Operational discipline',
    bullets: [
      'Rolling rehearsals with scripted fallbacks',
      'Blue/green release strategy with automated smoke tests',
      'Observability dashboards aligned to newsroom SLAs'
    ]
  },
  {
    title: 'Trusted data lifecycle',
    bullets: [
      'Schema validation for CSV and GeoJSON assets',
      'Versioned storage with differential diffs for reviews',
      'Granular RBAC compatible with enterprise SSO'
    ]
  },
  {
    title: 'Audience-ready storytelling',
    bullets: [
      'Responsively tuned deck.gl shaders for 4K and OTT',
      'Narrative overlays with newsroom editorial hooks',
      'API surface for companion apps and second-screen formats'
    ]
  }
]

const architecture = [
  {
    name: 'Data onboarding',
    summary:
      'Pipeline validates geography and historical datasets before packaging them into reusable scenario manifests suitable for audit.'
  },
  {
    name: 'Simulation services',
    summary:
      'Spring Boot services coordinate frame generation, resilience patterns, and cache warming to support real-time playback.'
  },
  {
    name: 'Experience layer',
    summary:
      'React and DeckGL clients deliver synchronized visuals, newsroom cues, and telemetry to every stakeholder surface.'
  }
]

const governancePoints = [
  'Access policies and retention schedules documented for newsroom compliance and legal teams.',
  'Incident playbooks include tabletop rehearsal outputs and accountable owners across engineering and editorial.',
  'Security roadmap tracks SOC 2 alignment, regional data residency considerations, and newsroom-specific requirements.'
]

const callouts = [
  'Product roadmap reviews available under mutual NDA.',
  'Integration kits cover CMS, control room, and broadcast graphics pipelines.',
  'Reference deployments demonstrate end-to-end rehearsal workflows for national and regional election cycles.'
]

const sectionPositions = {
  hero: 0,
  highlights: -4.2,
  workflow: -8.4,
  architecture: -12.4,
  governance: -16.2,
  callout: -20
}

type PanelProps = {
  position: [number, number, number]
  width?: number
  height?: number
  tone?: 'default' | 'highlight'
  children: React.ReactNode
}

const PanelShell: React.FC<PanelProps> = ({ position, width = 7, height = 3.6, tone = 'default', children }) => {
  const colors = tone === 'highlight'
    ? { base: '#10203f', emissive: '#1d3b6d' }
    : { base: '#070f1f', emissive: '#0e1b33' }

  return (
    <group position={position}>
      <RoundedBox args={[width, height, 0.45]} radius={0.45} smoothness={10}>
        <meshStandardMaterial
          color={colors.base}
          roughness={0.45}
          metalness={0.4}
          emissive={colors.emissive}
          emissiveIntensity={0.55}
        />
      </RoundedBox>
      <group position={[0, 0, 0.26]}>{children}</group>
    </group>
  )
}

type TextBlockProps = {
  text: string
  position: [number, number, number]
  fontSize?: number
  maxWidth?: number
  color?: string
  anchorX?: 'left' | 'right' | 'center'
  anchorY?: 'top' | 'bottom' | 'middle'
  lineHeight?: number
  letterSpacing?: number
}

const TextBlock: React.FC<TextBlockProps> = ({
  text,
  position,
  fontSize = 0.24,
  maxWidth = 4,
  color = '#e2e8f0',
  anchorX = 'center',
  anchorY = 'middle',
  lineHeight = 1.35,
  letterSpacing = 0
}) => (
  <Text
    position={position}
    color={color}
    fontSize={fontSize}
    maxWidth={maxWidth}
    anchorX={anchorX}
    anchorY={anchorY}
    lineHeight={lineHeight}
    letterSpacing={letterSpacing}
  >
    {text}
  </Text>
)

const CTAButton: React.FC<{
  label: string
  position: [number, number, number]
  color?: string
  onSelect: () => void
}> = ({ label, position, color = '#2563eb', onSelect }) => {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  const width = Math.max(1.6, label.length * 0.09 + 0.8)

  return (
    <group position={position}>
      <RoundedBox
        args={[width, 0.55, 0.25]}
        radius={0.22}
        smoothness={8}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onSelect}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.4}
          roughness={0.3}
          emissive={hovered ? '#3b82f6' : color}
          emissiveIntensity={hovered ? 0.7 : 0.35}
        />
      </RoundedBox>
      <Text
        position={[0, 0, 0.16]}
        fontSize={0.18}
        anchorX="center"
        anchorY="middle"
        color="#f8fafc"
        letterSpacing={0.03}
      >
        {label.toUpperCase()}
      </Text>
    </group>
  )
}

const BulletList: React.FC<{
  items: string[]
  origin: [number, number, number]
  spacing?: number
  maxWidth?: number
}> = ({ items, origin, spacing = 0.42, maxWidth = 2.6 }) => (
  <group>
    {items.map((item, index) => (
      <group key={item} position={[origin[0], origin[1] - index * spacing, origin[2]]}>
        <RoundedBox args={[0.08, 0.08, 0.04]} radius={0.04} position={[-0.15, 0.02, 0]}>
          <meshStandardMaterial color="#64748b" />
        </RoundedBox>
        <TextBlock
          text={item}
          position={[0.15, 0, 0]}
          fontSize={0.16}
          color="#cbd5f5"
          anchorX="left"
          maxWidth={maxWidth}
          lineHeight={1.25}
        />
      </group>
    ))}
  </group>
)

const HeroPanel: React.FC<{ studioHref: string; onPlatform: () => void }> = ({ studioHref, onPlatform }) => (
  <PanelShell position={[0, sectionPositions.hero, 0]} width={7.5} height={4} tone="highlight">
    <TextBlock
      text="ELECTION OPERATIONS PLATFORM"
      position={[0, 1.4, 0]}
      fontSize={0.2}
      color="#60a5fa"
      anchorX="center"
      letterSpacing={0.2}
    />
    <TextBlock
      text="Model, rehearse, and broadcast election night narratives with the control your newsroom expects."
      position={[0, 0.5, 0]}
      fontSize={0.4}
      maxWidth={6.4}
      color="#f8fafc"
    />
    <TextBlock
      text="The sandbox brings analysts, editorial leaders, operations, and digital teams into one shared environment with reproducible simulations, governed data, and ready-for-air visuals."
      position={[0, -0.6, 0]}
      fontSize={0.22}
      maxWidth={5.8}
      color="#cbd5f5"
    />
    <CTAButton label="Launch Simulation Studio" position={[-1.6, -1.5, 0]} onSelect={() => (window.location.href = studioHref)} />
    <CTAButton label="Review Platform" position={[1.6, -1.5, 0]} color="#0f172a" onSelect={onPlatform} />
  </PanelShell>
)

const HighlightsPanel: React.FC = () => (
  <PanelShell position={[0, sectionPositions.highlights, 0]} width={7} height={3.2}>
    {heroHighlights.map((item, idx) => {
      const column = idx % 2 === 0 ? -2 : 2
      const row = idx < 2 ? 0.8 : -0.6
      return (
        <Float key={item.title} speed={1 + idx * 0.1} rotationIntensity={0.2} floatIntensity={0.35} position={[column, row, 0]}>
          <RoundedBox args={[2.8, 1.2, 0.2]} radius={0.2} smoothness={6}>
            <meshStandardMaterial color="#0b1221" metalness={0.4} roughness={0.3} emissive="#0f1f3a" emissiveIntensity={0.45} />
          </RoundedBox>
          <TextBlock text={item.title} position={[0, 0.3, 0.15]} fontSize={0.2} maxWidth={2.2} />
          <TextBlock text={item.description} position={[0, -0.2, 0.15]} fontSize={0.15} maxWidth={2.4} color="#cbd5f5" />
        </Float>
      )
    })}
  </PanelShell>
)

const WorkflowPanel: React.FC = () => (
  <PanelShell position={[0, sectionPositions.workflow, 0]} width={7.5} height={4}>
    <TextBlock text="Purpose-built for decision desks" position={[-2.6, 1.4, 0]} fontSize={0.18} anchorX="left" color="#60a5fa" />
    <TextBlock text="Operational rigor meets analyst-first tooling" position={[-2.6, 0.8, 0]} fontSize={0.32} anchorX="left" maxWidth={3.4} />
    <TextBlock
      text="Analysts, producers, and anchors work from a single source of truth. Scenario templates, approval workflows, and narrative briefs keep every stakeholder aligned from rehearsal through election night."
      position={[-2.6, 0.1, 0]}
      anchorX="left"
      fontSize={0.18}
      maxWidth={3.4}
      color="#cbd5f5"
    />
    <BulletList
      items={[
        'Onboard geography and historical priors with automated validation.',
        'Compose simulations with reproducible seeds and documented assumptions.',
        'Publish scenarios to production control with contextual briefs and guardrails.'
      ]}
      origin={[-2.4, -0.8, 0]}
      maxWidth={3.1}
    />
    <group position={[1.8, 0.4, 0]}>
      {principles.map((principle, idx) => (
        <RoundedBox key={principle.title} args={[2.4, idx === principles.length - 1 ? 1.6 : 1.3, 0.18]} radius={0.2} position={[(idx % 2) * 2.6 - 1.3, idx > 1 ? -1.3 : 0.6, 0]}>
          <meshStandardMaterial color="#0b1224" metalness={0.35} roughness={0.35} emissive="#0e1a31" emissiveIntensity={0.4} />
          <TextBlock text={principle.title} position={[0, 0.3, 0.12]} fontSize={0.18} maxWidth={1.9} />
          <BulletList items={principle.bullets} origin={[-0.9, -0.1, 0.12]} spacing={0.32} maxWidth={1.8} />
        </RoundedBox>
      ))}
    </group>
  </PanelShell>
)

const ArchitecturePanel: React.FC = () => (
  <PanelShell position={[0, sectionPositions.architecture, 0]} width={7.2} height={3.6}>
    <TextBlock text="Platform architecture" position={[-2.8, 1.3, 0]} fontSize={0.2} anchorX="left" color="#60a5fa" />
    <TextBlock text="Resilient pipeline from ingestion to on-air experience" position={[-2.8, 0.7, 0]} fontSize={0.3} anchorX="left" maxWidth={4.5} />
    <group position={[0, -0.4, 0]}>
      {architecture.map((stage, idx) => (
        <RoundedBox key={stage.name} args={[2.2, 2, 0.2]} radius={0.2} position={[idx * 2.4 - 2.4, 0, 0]}>
          <meshStandardMaterial color="#081225" roughness={0.4} metalness={0.38} emissive="#0c1b32" emissiveIntensity={0.45} />
          <TextBlock text={stage.name} position={[0, 0.6, 0.12]} fontSize={0.2} maxWidth={1.8} />
          <TextBlock text={stage.summary} position={[0, -0.1, 0.12]} fontSize={0.16} maxWidth={1.8} color="#cbd5f5" />
          <TextBlock text={stage.note} position={[0, -0.8, 0.12]} fontSize={0.12} maxWidth={1.8} color="#94a3b8" />
        </RoundedBox>
      ))}
    </group>
  </PanelShell>
)

const GovernancePanel: React.FC = () => (
  <PanelShell position={[0, sectionPositions.governance, 0]} width={7.2} height={3.8}>
    <TextBlock text="Risk & governance" position={[0, 1.4, 0]} fontSize={0.2} color="#60a5fa" />
    <TextBlock
      text="Governance modeled on newsroom, legal, and operations standards"
      position={[0, 0.8, 0]}
      fontSize={0.3}
      maxWidth={5.5}
    />
    <TextBlock
      text="The platform aligns with existing broadcast and digital compliance processes. Documentation, access policies, and audit support are available to partners and investors under NDA."
      position={[0, 0, 0]}
      fontSize={0.18}
      maxWidth={5.8}
      color="#cbd5f5"
    />
    <group position={[0, -1.2, 0]}>
      {governancePoints.map((point, idx) => (
        <RoundedBox key={point} args={[2.2, 0.8, 0.16]} radius={0.18} position={[idx * 2.4 - 2.4, 0, 0]}>
          <meshStandardMaterial color="#0a1426" emissive="#111f38" emissiveIntensity={0.4} />
          <TextBlock text={point} position={[0, 0, 0.12]} fontSize={0.15} maxWidth={1.9} color="#cbd5f5" />
        </RoundedBox>
      ))}
    </group>
  </PanelShell>
)

const CalloutPanel: React.FC<{ studioHref: string }> = ({ studioHref }) => (
  <PanelShell position={[0, sectionPositions.callout, 0]} width={7} height={3.4} tone="highlight">
    <TextBlock text="Partner with us for upcoming cycles" position={[0, 1, 0]} fontSize={0.34} maxWidth={5.5} />
    <TextBlock
      text="We collaborate with newsrooms, network operations, and investors to expand the platform responsibly. Materials include rehearsal run books, product roadmap milestones, and integration guides."
      position={[0, 0.25, 0]}
      fontSize={0.18}
      maxWidth={5.4}
      color="#cbd5f5"
    />
    <BulletList items={callouts} origin={[-2.4, -0.5, 0]} spacing={0.4} maxWidth={4.8} />
    <CTAButton label="Investor Materials" position={[-1.4, -1.4, 0]} color="#0f172a" onSelect={() => (window.location.href = 'mailto:invest@electionanalytics.com')} />
    <CTAButton label="Explore the Studio" position={[1.4, -1.4, 0]} onSelect={() => (window.location.href = studioHref)} />
  </PanelShell>
)

const BackgroundOrnaments: React.FC = () => (
  <group>
    <Float speed={1.2} floatIntensity={0.4} rotationIntensity={0.2} position={[-5, 0, -6]}>
      <mesh castShadow>
        <torusGeometry args={[2, 0.2, 32, 96]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.65} roughness={0.25} emissive="#1d4ed8" emissiveIntensity={0.4} />
      </mesh>
    </Float>
    <Float speed={0.9} floatIntensity={0.3} rotationIntensity={0.15} position={[5, -4, -8]}>
      <mesh castShadow>
        <dodecahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color="#be185d" metalness={0.6} roughness={0.3} emissive="#f472b6" emissiveIntensity={0.35} />
      </mesh>
    </Float>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -25, -4]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#010712" metalness={0.2} roughness={0.9} />
    </mesh>
  </group>
)

const NavigationBillboard: React.FC<{ studioHref: string; isAuthed: boolean }> = ({ studioHref, isAuthed }) => {
  const scroll = useScroll()
  const [hovered, setHovered] = useState<string | null>(null)
  useCursor(Boolean(hovered))

  const scrollTo = useCallback(
    (ratio: number) => {
      if (!scroll.el) return
      scroll.el.scrollTo({
        top: scroll.el.scrollHeight * ratio,
        behavior: 'smooth'
      })
    },
    [scroll]
  )

  const navItems = [
    { label: 'Product', ratio: 0.2 },
    { label: 'Platform', ratio: 0.46 },
    { label: 'Governance', ratio: 0.74 }
  ]

  return (
    <Billboard position={[0, 3.4, -5]} follow>
      <RoundedBox args={[5.6, 1.4, 0.2]} radius={0.3}>
        <meshStandardMaterial color="#020b1a" metalness={0.5} roughness={0.4} emissive="#0c1a2f" emissiveIntensity={0.45} />
      </RoundedBox>
      {navItems.map((item, idx) => (
        <Text
          key={item.label}
          position={[idx * 1.6 - 1.6, 0, 0.16]}
          fontSize={0.18}
          color={hovered === item.label ? '#f8fafc' : '#cbd5f5'}
          onPointerOver={() => setHovered(item.label)}
          onPointerOut={() => setHovered(null)}
          onClick={() => scrollTo(item.ratio)}
        >
          {item.label}
        </Text>
      ))}
      <CTAButton
        label={isAuthed ? 'Sign Out' : 'Sign In'}
        position={[2.2, 0, 0]}
        color="#0f172a"
        onSelect={() => {
          if (isAuthed) {
            logout()
            window.location.reload()
          } else {
            window.location.href = '/login'
          }
        }}
      />
      <CTAButton label="Open Studio" position={[3.7, 0, 0]} onSelect={() => (window.location.href = studioHref)} />
    </Billboard>
  )
}

const SceneContent: React.FC<{ studioHref: string }> = ({ studioHref }) => {
  const scroll = useScroll()
  const scrollToPlatform = useCallback(() => {
    if (!scroll.el) return
    scroll.el.scrollTo({ top: scroll.el.scrollHeight * 0.45, behavior: 'smooth' })
  }, [scroll])

  return (
    <>
      <BackgroundOrnaments />
      <HeroPanel studioHref={studioHref} onPlatform={scrollToPlatform} />
      <HighlightsPanel />
      <WorkflowPanel />
      <ArchitecturePanel />
      <GovernancePanel />
      <CalloutPanel studioHref={studioHref} />
    </>
  )
}

const SandboxLandingPageThree: React.FC = () => {
  const isAuthed = isAuthenticated()
  const studioHref = useMemo(() => (isAuthed ? '/studio' : '/login'), [isAuthed])

  return (
    <div className="h-screen w-screen bg-slate-950">
      <Canvas camera={{ position: [0, 2, 13], fov: 40 }} shadows dpr={[1, 2]}>
        <color attach="background" args={["#010414"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 10, 12]} intensity={1.1} color="#93c5fd" castShadow />
        <directionalLight position={[-8, -6, -6]} intensity={0.35} color="#f472b6" />

        <ScrollControls pages={6.8} damping={0.18}>
          <Scroll>
            <SceneContent studioHref={studioHref} />
          </Scroll>
          <NavigationBillboard studioHref={studioHref} isAuthed={isAuthed} />
        </ScrollControls>
      </Canvas>
    </div>
  )
}

export default SandboxLandingPageThree
