import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectWebGLSupport } from '../utils/webglSupport'
import { color, space, radius, typography, panelStyle } from '../design/tokens'

// Quick toast system for previewing async feedback
interface Toast {
  id: string
  title: string
  message?: string
  tone?: 'info' | 'success' | 'warning' | 'error'
}

const toneColor: Record<NonNullable<Toast['tone']>, string> = {
  info: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444'
}

type SimStatus = 'idle' | 'uploading' | 'ready' | 'running' | 'paused' | 'error'

const speedPresets = [0.5, 1, 5, 25]
const swingStates = ['PA', 'MI', 'WI', 'AZ', 'GA', 'NV', 'NC', 'OH']
const countyDiagnostics = ['Demographics coverage', 'Reporting config', 'Exit polls', 'Manual mode ready']

const badgeStyles: React.CSSProperties = {
  borderRadius: radius.sm,
  padding: '2px 8px',
  fontSize: typography.size.xs,
  fontWeight: 600,
  letterSpacing: 0.4
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: typography.size.sm,
  fontWeight: 600,
  color: color.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: 0.6
}

const labelStyle: React.CSSProperties = {
  fontSize: typography.size.sm,
  color: color.text.secondary
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: color.background.surfaceAlt,
  border: `1px solid ${color.border.subtle}`,
  borderRadius: radius.md,
  color: color.textPrimary,
  padding: `${space.sm} ${space.md}`,
  fontSize: typography.size.sm
}

const sliderStyle: React.CSSProperties = {
  width: '100%'
}

type ArtifactStatus = 'ready' | 'stale' | 'missing'

interface MiniCounty {
  fips: string
  state: string
  county: string
  reporting: number
  demMargin: number
}

interface ScenarioArtifact {
  name: string
  status: ArtifactStatus
}

const mapOverlayOptions = ['Reporting %', 'Vote share', 'Turnout pressure'] as const
const overlayDescriptions: Record<typeof mapOverlayOptions[number], string> = {
  'Reporting %': 'Counties colored by percent reporting and wired to manual edit flow.',
  'Vote share': 'Visualizes current DEM vs GOP margins in two-tone gradient.',
  'Turnout pressure': 'Highlights counties behind schedule relative to historical turnout.'
}
const scenarioArtifactTemplates = ['Generated frames', 'County CSV', 'Reporting config', 'Exit poll pack']
const artifactStatusColor: Record<ArtifactStatus, string> = {
  ready: '#10B981',
  stale: '#F59E0B',
  missing: '#EF4444'
}
const artifactStatusLabel: Record<ArtifactStatus, string> = {
  ready: 'Up to date',
  stale: 'Stale — refresh soon',
  missing: 'Not generated'
}
const keyboardShortcutsList = [
  { combo: 'Space', detail: 'Play / Pause simulation' },
  { combo: '1 / 2 / 5 / 0', detail: 'Speed presets' },
  { combo: 'A', detail: 'Toggle analytics panel' },
  { combo: '?', detail: 'Show keyboard reference' },
  { combo: 'Esc', detail: 'Dismiss overlays' }
]

const initialCounties: MiniCounty[] = [
  { fips: '42001', state: 'PA', county: 'Adams', reporting: 62, demMargin: -8.2 },
  { fips: '26081', state: 'MI', county: 'Kent', reporting: 71, demMargin: 1.4 },
  { fips: '55025', state: 'WI', county: 'Dane', reporting: 84, demMargin: 34.8 },
  { fips: '04013', state: 'AZ', county: 'Maricopa', reporting: 65, demMargin: 2.1 },
  { fips: '13089', state: 'GA', county: 'DeKalb', reporting: 91, demMargin: 63.2 },
  { fips: '32003', state: 'NV', county: 'Clark', reporting: 57, demMargin: 8.5 }
]

const timelineDurationSeconds = 900

const formatTimestamp = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function ToastShelf({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', top: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 200 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...panelStyle(),
            borderLeft: `4px solid ${toneColor[toast.tone || 'info']}`,
            minWidth: 260,
            maxWidth: 360,
            padding: space.md
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: typography.size.base }}>{toast.title}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: color.textSecondary,
                cursor: 'pointer',
                fontSize: typography.size.sm
              }}
              aria-label="Dismiss toast"
            >
              ×
            </button>
          </div>
          {toast.message && <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>{toast.message}</div>}
        </div>
      ))}
    </div>
  )
}

function Pill({ tone, children }: { tone: SimStatus; children: React.ReactNode }) {
  const toneMap: Record<SimStatus, string> = {
    idle: '#6B7280',
    uploading: '#3B82F6',
    ready: '#F59E0B',
    running: '#10B981',
    paused: '#F59E0B',
    error: '#EF4444'
  }
  return (
    <span style={{ ...badgeStyles, background: `${toneMap[tone]}22`, color: toneMap[tone], border: `1px solid ${toneMap[tone]}55` }}>
      {children}
    </span>
  )
}

function SkeletonBlock({ height = 16 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        width: '100%',
        borderRadius: radius.md,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02), rgba(255,255,255,0.06))',
        backgroundSize: '400px 100%',
        animation: 'skeleton 1.6s ease-in-out infinite'
      }}
    />
  )
}

const keyframes = `
@keyframes skeleton {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`

const primaryButtonStyle: React.CSSProperties = {
  background: color.accentNeutral,
  color: '#fff',
  border: 'none',
  borderRadius: radius.md,
  padding: `${space.sm} ${space.lg}`,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: color.elevationShadow
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: color.textSecondary,
  border: `1px solid ${color.border.default}`,
  borderRadius: radius.md,
  padding: `${space.sm} ${space.lg}`,
  fontWeight: 600,
  cursor: 'pointer'
}

class SimpleBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ ...panelStyle(), padding: space.md, borderColor: '#EF4444AA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: color.textPrimary }}>Caught runtime error</div>
              <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Preview fallback UI.</div>
            </div>
            <button style={primaryButtonStyle} onClick={() => this.setState({ hasError: false })}>Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}

function ErrorBoundaryPreview({ children }: { children: React.ReactNode }) {
  const [forceError, setForceError] = useState(false)
  if (forceError) {
    return (
      <div style={{ ...panelStyle(), padding: space.md, borderColor: '#EF4444AA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, color: color.textPrimary }}>Something went wrong</div>
            <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>This is the fallback UI for the test page.</div>
          </div>
          <button style={primaryButtonStyle} onClick={() => setForceError(false)}>Reset</button>
        </div>
      </div>
    )
  }
  return (
    <SimpleBoundary>
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button style={secondaryButtonStyle} onClick={() => setForceError(true)}>Simulate component error</button>
        </div>
        {children}
      </div>
    </SimpleBoundary>
  )
}

function KeyboardHelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...panelStyle(), padding: space.lg, width: 'min(520px, 90vw)', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: typography.size.xl }}>Keyboard reference</div>
            <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Matches production shortcuts so QA can validate muscle memory.</div>
          </div>
          <button style={secondaryButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {keyboardShortcutsList.map((entry) => (
            <div key={entry.combo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: radius.md, background: color.background.surfaceAlt, border: `1px solid ${color.border.subtle}` }}>
              <span style={{ fontFamily: typography.family.mono }}>{entry.combo}</span>
              <span style={{ color: color.text.secondary, fontSize: typography.size.sm }}>{entry.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SandboxUXTestPage() {
  const [status, setStatus] = useState<SimStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [timeline, setTimeline] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [demographicsMode, setDemographicsMode] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading')
  const [playbackReady, setPlaybackReady] = useState(false)
  const [scope, setScope] = useState<'ALL' | 'CUSTOM'>('ALL')
  const [selectedStates, setSelectedStates] = useState<string[]>(swingStates)
  const [manualMode, setManualMode] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [webglSupport] = useState(() => detectWebGLSupport())
  const isWebGLAvailable = webglSupport === 'supported'
  const [mapMode, setMapMode] = useState<'3D' | '2D'>(() => (isWebGLAvailable ? '3D' : '2D'))
  const [mapOverlay, setMapOverlay] = useState<typeof mapOverlayOptions[number]>('Reporting %')
  const [newsEvents, setNewsEvents] = useState<string[]>([
    'Called Pennsylvania for Candidate A',
    'Key race alert: Margin tightening in AZ'
  ])
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const [countyResults, setCountyResults] = useState<MiniCounty[]>(initialCounties)
  const [selectedCounty, setSelectedCounty] = useState<string>(initialCounties[0].fips)
  const [scenarioArtifacts, setScenarioArtifacts] = useState<ScenarioArtifact[]>(() =>
    scenarioArtifactTemplates.map((name, index) => ({
      name,
      status: index <= 1 ? 'ready' : index === 2 ? 'stale' : 'missing'
    }))
  )
  const [exitPollsLoaded, setExitPollsLoaded] = useState(false)
  const [networkLatency, setNetworkLatency] = useState(82)
  const progressTimer = useRef<number | null>(null)
  const timelineSeconds = useMemo(() => (timeline / 100) * timelineDurationSeconds, [timeline])
  const timelineRemaining = Math.max(0, timelineDurationSeconds - timelineSeconds)
  const timelineLabel = useMemo(() => formatTimestamp(timelineSeconds), [timelineSeconds])
  const timelineRemainingLabel = useMemo(() => formatTimestamp(timelineRemaining), [timelineRemaining])
  const reportingSnapshot = useMemo(() => {
    const total = countyResults.reduce((sum, county) => sum + county.reporting, 0)
    const avgReporting = Math.round(total / countyResults.length)
    const leader = countyResults.reduce((prev, county) => (Math.abs(county.demMargin) > Math.abs(prev.demMargin) ? county : prev), countyResults[0])
    return { avgReporting, leader }
  }, [countyResults])
  const selectedCountyData = useMemo(() => countyResults.find((county) => county.fips === selectedCounty) ?? countyResults[0], [countyResults, selectedCounty])
  const artifactCounts = useMemo(() => {
    return scenarioArtifacts.reduce(
      (acc, artifact) => {
        acc[artifact.status] += 1
        return acc
      },
      { ready: 0, stale: 0, missing: 0 } as Record<ArtifactStatus, number>
    )
  }, [scenarioArtifacts])

  // Simulate upload/generation
  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(Date.now())
    setToasts((prev) => [...prev, { id, ...t }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000)
  }, [])

  useEffect(() => {
    if (status === 'uploading') {
      setProgress(4)
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 18, 92))
      }, 400)
      const timer = setTimeout(() => {
        setStatus('running')
        setPlaybackReady(true)
        setProgress(100)
      }, 3200)
      return () => {
        clearInterval(interval)
        clearTimeout(timer)
      }
    }
  }, [status])

  useEffect(() => {
    if (!isWebGLAvailable && mapMode === '3D') {
      setMapMode('2D')
      addToast({ title: '3D disabled', message: 'WebGL unavailable; locked to 2D', tone: 'warning' })
    }
  }, [addToast, isWebGLAvailable, mapMode])

  useEffect(() => {
    if (status !== 'running') {
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
        progressTimer.current = null
      }
      return
    }

    progressTimer.current = window.setInterval(() => {
      setTimeline((prev) => {
        if (prev >= 100) {
          setStatus('ready')
          return 100
        }
        const next = Math.min(100, prev + 0.8)
        if (next === 100) {
          setStatus('ready')
        }
        return next
      })
      setProgress((prev) => Math.min(100, prev + 0.6))
    }, 600)

    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
        progressTimer.current = null
      }
    }
  }, [status])

  useEffect(() => {
    const latencyInterval = setInterval(() => {
      setNetworkLatency(60 + Math.round(Math.random() * 80))
    }, 3000)
    return () => clearInterval(latencyInterval)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable
      if (typing) return

      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()
        if (status === 'running') {
          setStatus('paused')
          addToast({ title: 'Paused', message: 'Playback paused', tone: 'warning' })
        } else if (status === 'paused' || status === 'ready' || status === 'idle') {
          setStatus('running')
          addToast({ title: 'Resumed', message: 'Playback resumed', tone: 'success' })
        }
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        setAnalyticsOpen((prev) => !prev)
      }

      if (event.key === '?') {
        event.preventDefault()
        setKeyboardHelpOpen(true)
      }

      if (event.key === 'Escape') {
        setKeyboardHelpOpen(false)
        setAnalyticsOpen(false)
      }

      if (event.key >= '1' && event.key <= '5') {
        event.preventDefault()
        const preset = speedPresets[Number(event.key) - 1]
        if (preset) {
          setSpeed(preset)
          addToast({ title: 'Speed changed', message: `${preset}x playback`, tone: 'info' })
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addToast, status])

  const handleStart = () => {
    setTimeline(0)
    setProgress(0)
    setPlaybackReady(false)
    setStatus('uploading')
    addToast({ title: 'Starting Simulation', message: 'Generating frames…', tone: 'info' })
  }

  const handlePauseToggle = () => {
    if (status === 'running') {
      setStatus('paused')
      addToast({ title: 'Paused', message: 'Playback paused', tone: 'warning' })
    } else if (status === 'paused' || status === 'ready') {
      setStatus('running')
      addToast({ title: 'Resumed', message: 'Playback resumed', tone: 'success' })
    }
  }

  const handleError = () => {
    setStatus('error')
    addToast({ title: 'Simulation Error', message: 'Network timeout while streaming frames', tone: 'error' })
  }

  const handleScrub = (value: number) => {
    setTimeline(value)
  }

  const toggleState = useCallback((state: string) => {
    setScope('CUSTOM')
    setSelectedStates((prev) => (prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]))
  }, [])

  const selectAllStates = useCallback(() => {
    setScope('ALL')
    setSelectedStates(swingStates)
  }, [])

  const clearStates = useCallback(() => {
    setScope('CUSTOM')
    setSelectedStates([])
  }, [])

  const handleMapModeChange = useCallback((mode: '3D' | '2D') => {
    if (mode === '3D' && !isWebGLAvailable) {
      addToast({ title: 'WebGL required', message: 'Use 2D fallback on this device', tone: 'warning' })
      return
    }
    setMapMode(mode)
  }, [addToast, isWebGLAvailable])

  const toggleManualMode = useCallback(() => {
    setManualMode((prev) => {
      const next = !prev
      addToast({
        title: next ? 'Manual mode enabled' : 'Manual mode disabled',
        message: next ? 'Click a county to add/edit results' : 'Returning to live stream',
        tone: next ? 'info' : 'success'
      })
      return next
    })
  }, [addToast])

  const addNewsEvent = useCallback(() => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    setNewsEvents((prev) => [`Live update at ${timestamp}`, ...prev].slice(0, 5))
    addToast({ title: 'Event added', message: 'Pinned to newsroom feed', tone: 'success' })
  }, [addToast])

  const handleOverlayChange = useCallback((overlay: typeof mapOverlayOptions[number]) => {
    setMapOverlay(overlay)
    addToast({ title: 'Overlay changed', message: overlayDescriptions[overlay], tone: 'info' })
  }, [addToast])

  const handleArtifactRefresh = useCallback((name: string) => {
    setScenarioArtifacts((prev) => prev.map((artifact) => (artifact.name === name ? { ...artifact, status: 'ready' } : artifact)))
    addToast({ title: `${name} ready`, message: 'Artifact synced for QA', tone: 'success' })
  }, [addToast])

  const handleAttachExitPolls = useCallback(() => {
    setExitPollsLoaded(true)
    addToast({ title: 'Exit polls attached', message: 'Demographics enriched', tone: 'success' })
  }, [addToast])

  const handleCountySelect = useCallback((fips: string) => {
    setSelectedCounty(fips)
    if (!manualMode) {
      setManualMode(true)
    }
  }, [manualMode])

  const handleManualSave = useCallback(() => {
    if (!selectedCountyData) return
    setCountyResults((prev) => prev.map((county) => (county.fips === selectedCountyData.fips ? { ...county, reporting: Math.min(100, county.reporting + 5) } : county)))
    addToast({ title: 'County updated', message: `${selectedCountyData.county} reporting bumped`, tone: 'success' })
  }, [addToast, selectedCountyData])

  const handleReset = useCallback(() => {
    setStatus('idle')
    setTimeline(0)
    setProgress(0)
    setPlaybackReady(false)
    setManualMode(false)
    setAnalyticsOpen(false)
    addToast({ title: 'Session reset', message: 'Ready for next simulation', tone: 'info' })
  }, [addToast])

  const demoBlocks = useMemo(() => {
    if (demographicsMode === 'loading') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <SkeletonBlock height={18} />
          <SkeletonBlock height={180} />
          <SkeletonBlock height={120} />
        </div>
      )
    }
    if (demographicsMode === 'empty') {
      return (
        <div style={{ textAlign: 'center', padding: space.lg, color: color.text.secondary }}>
          <div style={{ fontWeight: 700, fontSize: typography.size.lg }}>No demographics yet</div>
          <div style={{ fontSize: typography.size.sm, marginTop: 6 }}>Upload a CSV to synthesize demographics.</div>
        </div>
      )
    }
    if (demographicsMode === 'error') {
      return (
        <div style={{ ...panelStyle(), borderColor: '#EF4444AA', padding: space.md }}>
          <div style={{ fontWeight: 700, color: color.textPrimary }}>Demographics unavailable</div>
          <div style={{ color: color.text.secondary, fontSize: typography.size.sm, marginTop: 4 }}>Backend returned 500. Retry or switch to 2D fallback.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button style={primaryButtonStyle} onClick={() => setDemographicsMode('loading')}>Retry</button>
            <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('ready')}>Use fallback</button>
          </div>
        </div>
      )
    }
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: typography.size.base, color: color.textPrimary }}>Race breakdown (sample)</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {[['White', 58], ['Black', 22], ['Latino', 14], ['Asian', 6]].map(([label, value]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: color.background.surfaceAlt, borderRadius: radius.md, border: `1px solid ${color.border.subtle}` }}>
              <span style={{ color: color.textPrimary }}>{label as string}</span>
              <span style={{ fontFamily: typography.family.mono, color: color.text.secondary }}>{value as number}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }, [demographicsMode])

  return (
    <div style={{ minHeight: '100vh', background: color.background.primary, color: color.textPrimary, fontFamily: typography.family.sans }}>
      <style>{keyframes}</style>
      <ToastShelf toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 360px', gap: 16, padding: '16px 16px 96px 16px' }}>
        {/* Left: Setup */}
        <aside style={{ ...panelStyle(), padding: space.lg, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: typography.size.lg }}>Setup</div>
              <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Upload → Configure → Validate</div>
            </div>
            <Pill tone={status}>{status.toUpperCase()}</Pill>
          </div>

          <div>
            <div style={sectionTitleStyle}>Scenario</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input style={inputStyle} placeholder="Scenario name" defaultValue="UX Preview Run" onChange={(e) => setStatus(e.target.value ? 'ready' : 'idle')} />
              <div style={{ display: 'grid', gap: 6 }}>
                <button style={secondaryButtonStyle} onClick={() => addToast({ title: 'CSV Validated', message: '42 counties loaded', tone: 'success' })}>Validate CSV</button>
                <button style={secondaryButtonStyle} onClick={() => addToast({ title: 'Reporting Config', message: 'Missing group rules', tone: 'warning' })}>Load reporting config</button>
                <button style={secondaryButtonStyle} onClick={handleAttachExitPolls}>{exitPollsLoaded ? 'Exit polls attached' : 'Attach exit polls'}</button>
              </div>
            </div>
          </div>

          <div>
            <div style={sectionTitleStyle}>Scenario artifacts</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {scenarioArtifacts.map((artifact) => (
                <div key={artifact.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: radius.md, background: color.background.surfaceAlt, border: `1px solid ${color.border.subtle}` }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{artifact.name}</div>
                    <div style={{ color: artifactStatusColor[artifact.status], fontSize: typography.size.sm }}>{artifactStatusLabel[artifact.status]}</div>
                  </div>
                  {artifact.status !== 'ready' && (
                    <button style={secondaryButtonStyle} onClick={() => handleArtifactRefresh(artifact.name)}>Generate</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={sectionTitleStyle}>Scope & States</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {(['ALL', 'CUSTOM'] as const).map((option) => (
                <button
                  key={option}
                  style={{
                    ...secondaryButtonStyle,
                    background: scope === option ? color.background.surfaceAlt : 'transparent',
                    borderColor: scope === option ? color.accentNeutral : color.border.subtle,
                    color: scope === option ? color.textPrimary : color.text.secondary
                  }}
                  onClick={() => setScope(option)}
                >
                  {option === 'ALL' ? 'Nationwide' : 'Custom states'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {swingStates.map((state) => {
                const active = selectedStates.includes(state)
                return (
                  <button
                    key={state}
                    onClick={() => toggleState(state)}
                    style={{
                      ...badgeStyles,
                      cursor: 'pointer',
                      background: active ? `${color.accentNeutral}22` : color.background.surfaceAlt,
                      border: `1px solid ${active ? color.accentNeutral : color.border.subtle}`,
                      color: active ? color.accentNeutral : color.textSecondary
                    }}
                  >
                    {state}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button style={secondaryButtonStyle} onClick={selectAllStates}>Select all</button>
              <button style={secondaryButtonStyle} onClick={clearStates}>Clear</button>
              <button style={secondaryButtonStyle} onClick={() => addToast({ title: 'States locked', message: `${selectedStates.length} selected`, tone: 'info' })}>Lock selection</button>
            </div>
          </div>

          <div>
            <div style={sectionTitleStyle}>Map mode</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {(['3D', '2D'] as const).map((mode) => {
                const active = mapMode === mode
                return (
                  <button
                    key={mode}
                    style={{
                      ...secondaryButtonStyle,
                      background: active ? color.background.surfaceAlt : 'transparent',
                      borderColor: active ? color.accentNeutral : color.border.subtle,
                      color: active ? color.textPrimary : color.text.secondary
                    }}
                    onClick={() => handleMapModeChange(mode)}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 8, color: color.text.secondary, fontSize: typography.size.sm }}>
              {isWebGLAvailable ? 'WebGL ready — 3D canvas available' : 'WebGL not detected — using 2D fallback'}
            </div>
          </div>

          <div>
            <div style={sectionTitleStyle}>Data overlay</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {mapOverlayOptions.map((option) => (
                <button
                  key={option}
                  style={{
                    ...secondaryButtonStyle,
                    background: mapOverlay === option ? color.background.surfaceAlt : 'transparent',
                    borderColor: mapOverlay === option ? color.accentNeutral : color.border.subtle,
                    color: mapOverlay === option ? color.textPrimary : color.text.secondary
                  }}
                  onClick={() => handleOverlayChange(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, color: color.text.secondary, fontSize: typography.size.sm }}>{overlayDescriptions[mapOverlay]}</div>
          </div>

          <div>
            <div style={sectionTitleStyle}>Volatility</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <label style={labelStyle}>Early volatility</label>
              <input type="range" min={0} max={30} defaultValue={15} style={sliderStyle} />
              <label style={labelStyle}>Late volatility</label>
              <input type="range" min={0} max={10} defaultValue={2} style={sliderStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={sectionTitleStyle}>Manual + diagnostics</div>
            <button style={secondaryButtonStyle} onClick={toggleManualMode}>{manualMode ? 'Disable manual mode' : 'Enable manual edits'}</button>
            <div style={{ display: 'grid', gap: 6 }}>
              {countyDiagnostics.map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, color: color.text.secondary, fontSize: typography.size.sm }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10B981' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Map + main canvas */}
        <main style={{ display: 'grid', gap: 16, gridTemplateRows: '1fr auto' }}>
          <ErrorBoundaryPreview>
            <div style={{ ...panelStyle(), padding: space.lg, minHeight: 420, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: typography.size.lg }}>Canvas</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Pill tone={mapMode === '3D' ? 'running' : 'ready'}>{mapMode} mode</Pill>
                    {manualMode && <Pill tone="uploading">Manual edit</Pill>}
                    {analyticsOpen && <Pill tone="ready">Analytics open</Pill>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('loading')}>Show loading</button>
                  <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('error')}>Simulate error</button>
                  <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('ready')}>Show data</button>
                  <button style={secondaryButtonStyle} onClick={() => setAnalyticsOpen((prev) => !prev)}>{analyticsOpen ? 'Hide analytics' : 'Show analytics'}</button>
                </div>
              </div>

              {!isWebGLAvailable && (
                <div style={{ ...panelStyle(), padding: space.md, borderColor: '#F59E0B55', background: `${color.background.surfaceAlt}` }}>
                  <div style={{ fontWeight: 700 }}>3D fallback engaged</div>
                  <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Device lacks WebGL support. All views use 2D renderer.</div>
                </div>
              )}

              <div style={{ position: 'relative', border: `1px dashed ${color.border.subtle}`, borderRadius: radius.lg, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.text.secondary }}>
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                  <Pill tone={status === 'running' ? 'running' : 'ready'}>{status === 'running' ? 'Live stream' : 'Preview'}</Pill>
                  <Pill tone="ready">{mapMode === '3D' ? 'WebGL pipeline' : 'SVG tile'}</Pill>
                </div>
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: color.textPrimary }}>Map / 3D preview placeholder</div>
                  <div style={{ fontSize: typography.size.sm, color: color.text.secondary }}>Render tests here to verify scale, overlays, and county click hit boxes before merging layout changes.</div>
                </div>
                {manualMode && (
                  <div style={{ position: 'absolute', bottom: 12, right: 12, ...panelStyle(), padding: '8px 10px' }}>
                    <div style={{ fontWeight: 700 }}>Manual edits live</div>
                    <div style={{ color: color.text.secondary, fontSize: typography.size.xs }}>Click a county to add or edit.</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div style={{ ...panelStyle(), padding: space.md }}>
                  <div style={{ fontWeight: 700 }}>Call policy</div>
                  <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Auto-call enabled at 98% reporting with 2.5% margin.</div>
                  <button style={{ ...secondaryButtonStyle, marginTop: 8 }} onClick={() => addToast({ title: 'Call thresholds updated', message: 'Margin tightened to 2%', tone: 'success' })}>Tighten thresholds</button>
                </div>
                <div style={{ ...panelStyle(), padding: space.md }}>
                  <div style={{ fontWeight: 700 }}>Playback readiness</div>
                  <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Timeline cached, {playbackReady ? 'ready to scrub' : 'warming up'}.</div>
                  <button style={{ ...secondaryButtonStyle, marginTop: 8 }} onClick={() => setPlaybackReady(true)}>Mark ready</button>
                </div>
                <div style={{ ...panelStyle(), padding: space.md }}>
                  <div style={{ fontWeight: 700 }}>Analytics panel</div>
                  <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Race splits, error bands, newsroom feed.</div>
                  <button style={{ ...secondaryButtonStyle, marginTop: 8 }} onClick={() => setAnalyticsOpen(true)}>Open analytics</button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '280px 1fr', alignItems: 'stretch' }}>
                <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Counties in focus</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {countyResults.map((county) => (
                      <button
                        key={county.fips}
                        onClick={() => handleCountySelect(county.fips)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: radius.md,
                          border: `1px solid ${county.fips === selectedCounty ? color.accentNeutral : color.border.subtle}`,
                          background: county.fips === selectedCounty ? `${color.accentNeutral}11` : color.background.surfaceAlt,
                          color: color.textPrimary,
                          cursor: 'pointer'
                        }}
                      >
                        <span>{county.county}, {county.state}</span>
                        <span style={{ fontFamily: typography.family.mono, color: county.demMargin >= 0 ? color.accentPositive : color.accentNegative }}>{county.demMargin.toFixed(1)}%</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Manual county editor</div>
                      <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>{selectedCountyData?.county}, {selectedCountyData?.state}</div>
                    </div>
                    <Pill tone={manualMode ? 'running' : 'idle'}>{manualMode ? 'Manual on' : 'Manual off'}</Pill>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={labelStyle}>Reporting %</label>
                    <input type="range" min={0} max={100} value={selectedCountyData?.reporting ?? 0} onChange={(event) => {
                      const value = Number(event.target.value)
                      setCountyResults((prev) => prev.map((county) => (county.fips === selectedCountyData?.fips ? { ...county, reporting: value } : county)))
                    }} />
                    <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Currently {selectedCountyData?.reporting ?? 0}% reporting</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={labelStyle}>DEM margin</label>
                    <input type="range" min={-40} max={40} value={selectedCountyData?.demMargin ?? 0} onChange={(event) => {
                      const value = Number(event.target.value)
                      setCountyResults((prev) => prev.map((county) => (county.fips === selectedCountyData?.fips ? { ...county, demMargin: value } : county)))
                    }} />
                    <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>{(selectedCountyData?.demMargin ?? 0).toFixed(1)}% lead</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={primaryButtonStyle} onClick={handleManualSave}>Save county</button>
                    <button style={secondaryButtonStyle} onClick={toggleManualMode}>{manualMode ? 'Disable manual' : 'Enable manual'}</button>
                  </div>
                </div>
              </div>

              <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Analytics quick read</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: typography.size.sm, color: color.text.secondary }}>Avg reporting</div>
                    <div style={{ fontWeight: 800, fontSize: typography.size['2xl'] }}>{reportingSnapshot.avgReporting}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.size.sm, color: color.text.secondary }}>Latency</div>
                    <div style={{ fontWeight: 800, fontSize: typography.size['2xl'] }}>{networkLatency}ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.size.sm, color: color.text.secondary }}>Leading county</div>
                    <div style={{ fontWeight: 700 }}>{reportingSnapshot.leader.county}</div>
                    <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>{reportingSnapshot.leader.demMargin >= 0 ? 'DEM +' : 'GOP +'}{Math.abs(reportingSnapshot.leader.demMargin).toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Analytics matches backend feed. Use this card to validate error bars and newsroom toggles before bringing layout into main Sandbox.</div>
              </div>
            </div>
          </ErrorBoundaryPreview>

          {/* Timeline affordance */}
          <div style={{ ...panelStyle(), padding: space.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Timeline Scrubber</div>
              <span style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Interactive hint: drag to jump</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={timeline}
              onChange={(e) => handleScrub(Number(e.target.value))}
              style={sliderStyle}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: color.text.secondary, fontSize: typography.size.xs, marginTop: 4 }}>
              <span>{formatTimestamp(0)}</span>
              <span>{timelineLabel}</span>
              <span>{formatTimestamp(timelineDurationSeconds)}</span>
            </div>
            <div style={{ color: color.text.secondary, fontSize: typography.size.xs, textAlign: 'right' }}>Remaining {timelineRemainingLabel}</div>
          </div>
        </main>

        {/* Right: Analysis */}
        <aside style={{ ...panelStyle(), padding: space.lg, display: 'grid', gap: 12, alignSelf: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: typography.size.lg }}>Analysis</div>
              <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>Demographics & events</div>
            </div>
            <Pill tone={playbackReady ? 'running' : 'idle'}>{playbackReady ? 'PLAYBACK READY' : 'AWAITING'}</Pill>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('loading')}>Loading</button>
            <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('empty')}>Empty</button>
            <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('error')}>Error</button>
            <button style={secondaryButtonStyle} onClick={() => setDemographicsMode('ready')}>Ready</button>
          </div>

          <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: typography.size.base }}>Reporting snapshot</div>
            <div style={{ display: 'grid', gap: 4, color: color.text.secondary, fontSize: typography.size.sm }}>
              <div>States loaded: {selectedStates.length} ({scope === 'ALL' ? 'All target states' : 'Custom selection'})</div>
              <div>Map mode: {mapMode} ({isWebGLAvailable ? 'WebGL OK' : '2D fallback'})</div>
              <div>Manual mode: {manualMode ? 'Enabled for edits' : 'Off — streaming only'}</div>
              <div>Analytics: {analyticsOpen ? 'Inline panel open' : 'Hidden'}</div>
              <div>Overlay: {mapOverlay}</div>
              <div>Avg reporting: {reportingSnapshot.avgReporting}% · Network {networkLatency}ms</div>
              <div>Exit polls: {exitPollsLoaded ? 'Attached' : 'Pending attach'}</div>
              <div>Artifacts → Ready {artifactCounts.ready} / Stale {artifactCounts.stale} / Missing {artifactCounts.missing}</div>
            </div>
          </div>

          <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: typography.size.base }}>Demographics Panel</div>
            {demoBlocks}
          </div>

          <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Exit polls</div>
            <div style={{ color: color.text.secondary, fontSize: typography.size.sm }}>
              {exitPollsLoaded
                ? 'Exit poll pack synced. Demographic sliders tied to latest release.'
                : 'Attach exit poll pack to unlock demographic tuning and newsroom copy.'}
            </div>
            <button style={secondaryButtonStyle} onClick={handleAttachExitPolls}>{exitPollsLoaded ? 'Re-sync pack' : 'Attach pack'}</button>
          </div>

          <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Newsroom events</div>
              <button style={secondaryButtonStyle} onClick={addNewsEvent}>Add event</button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {newsEvents.map((headline, index) => (
                <div key={headline + index} style={{ padding: '10px 12px', borderRadius: radius.md, background: color.background.surfaceAlt, border: `1px solid ${color.border.subtle}` }}>
                  <div style={{ fontWeight: 600 }}>{headline}</div>
                  <div style={{ color: color.text.secondary, fontSize: typography.size.xs }}>00:07:2{index}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle(), padding: space.md, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Keyboard shortcuts</div>
            <div style={{ display: 'grid', gap: 6, color: color.text.secondary, fontSize: typography.size.sm }}>
              <div><strong>Space</strong> — Play/Pause</div>
              <div><strong>1/2/5/0</strong> — Speed presets</div>
              <div><strong>A</strong> — Toggle analytics</div>
              <div><strong>?</strong> — Show help</div>
            </div>
            <button style={secondaryButtonStyle} onClick={() => setKeyboardHelpOpen(true)}>Open overlay</button>
          </div>
        </aside>
      </div>

      {/* Bottom controls bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16, backdropFilter: 'blur(12px)', background: color.background.overlay, borderTop: `1px solid ${color.border.subtle}`, zIndex: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={primaryButtonStyle} onClick={handleStart} disabled={status === 'uploading'}>
              {status === 'uploading' ? 'Generating…' : 'Start Simulation'}
            </button>
            <button style={secondaryButtonStyle} onClick={handlePauseToggle}>{status === 'running' ? 'Pause' : 'Resume'}</button>
            <button style={secondaryButtonStyle} onClick={handleError}>Sim Error</button>
            <button style={secondaryButtonStyle} onClick={toggleManualMode}>{manualMode ? 'Manual on' : 'Manual off'}</button>
            <button style={secondaryButtonStyle} onClick={() => setAnalyticsOpen((prev) => !prev)}>{analyticsOpen ? 'Hide analytics' : 'Show analytics'}</button>
            <button style={secondaryButtonStyle} onClick={handleReset}>Reset</button>
            <button style={secondaryButtonStyle} onClick={() => setKeyboardHelpOpen(true)}>Keyboard</button>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ width: '100%', height: 10, background: color.background.surfaceAlt, borderRadius: 999, overflow: 'hidden', border: `1px solid ${color.border.subtle}` }}>
              <div style={{ height: '100%', width: `${progress}%`, background: color.accentPositive, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: color.text.secondary, fontSize: typography.size.xs }}>
              <span>Status: {status}</span>
              <span>Progress: {progress.toFixed(0)}% · States: {selectedStates.length} · Overlay: {mapOverlay}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {speedPresets.map((preset) => (
              <button
                key={preset}
                style={{
                  ...secondaryButtonStyle,
                  background: speed === preset ? color.background.surfaceAlt : 'transparent',
                  borderColor: speed === preset ? color.accentNeutral : color.border.subtle,
                  color: speed === preset ? color.textPrimary : color.text.secondary
                }}
                onClick={() => setSpeed(preset)}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>
      </div>
      <KeyboardHelpOverlay open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
    </div>
  )
}
