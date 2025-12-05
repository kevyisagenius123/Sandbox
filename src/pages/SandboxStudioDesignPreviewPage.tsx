import React, { useCallback, useId, useState } from 'react'
import { SandboxThemeProvider } from '../design/SandboxThemeProvider'

type LineDatum = {
  label: string
  value: number
}

type UploadItem = {
  name: string
  status: 'complete' | 'uploading' | 'idle'
  size: string
}

type PartyShare = {
  label: string
  value: number
  highlight?: boolean
}

type EditQueueItem = {
  county: string
  change: string
  status: 'queued' | 'applied'
}

type NewsEvent = {
  time: string
  title: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

type KeyboardShortcut = {
  combo: string
  description: string
}

type PanelSize = {
  width: number
  height: number
}

type PanelDefinition = {
  title: string
  subtitle?: string
  render: () => React.ReactNode
  defaultSize: PanelSize
  expandedSize?: PanelSize
  minSize?: PanelSize
}

type PanelId =
  | 'uploads'
  | 'exitPolls'
  | 'reporting'
  | 'analytics'
  | 'voteShare'
  | 'timeline'
  | 'editQueue'
  | 'news'
  | 'shortcuts'

type PanelInstance = PanelSize & {
  id: PanelId
  x: number
  y: number
  zIndex: number
}

const TURNOUT_SERIES: LineDatum[] = [
  { label: '0%', value: 0 },
  { label: '10%', value: 8 },
  { label: '20%', value: 18 },
  { label: '30%', value: 26 },
  { label: '40%', value: 35 },
  { label: '50%', value: 43 },
  { label: '60%', value: 52 },
  { label: '70%', value: 60 },
  { label: '80%', value: 66 },
  { label: '90%', value: 71 },
  { label: '100%', value: 74 }
]

const REPORTING_PACE_SERIES: LineDatum[] = [
  { label: '19:00', value: 6 },
  { label: '19:30', value: 14 },
  { label: '20:00', value: 31 },
  { label: '20:30', value: 45 },
  { label: '21:00', value: 58 },
  { label: '21:30', value: 71 },
  { label: '22:00', value: 82 },
  { label: '22:30', value: 90 },
  { label: '23:00', value: 96 },
  { label: '23:30', value: 100 }
]

const UPLOAD_ITEMS: UploadItem[] = [
  { name: 'tx_county_results_2024.csv', status: 'complete', size: '4.2 MB' },
  { name: 'tx_exit_polls.json', status: 'complete', size: '820 KB' },
  { name: 'reporting_windows.json', status: 'uploading', size: '120 KB' }
]

const PARTY_SHARE: PartyShare[] = [
  { label: 'Democratic', value: 52, highlight: true },
  { label: 'Republican', value: 46 },
  { label: 'Other', value: 2 }
]

const EDIT_QUEUE: EditQueueItem[] = [
  { county: 'Harris County', change: '+2.4% D swing; turnout +5%', status: 'applied' },
  { county: 'Tarrant County', change: 'Reweighted exit poll cohort mix', status: 'queued' },
  { county: 'El Paso County', change: 'Adjusted advance vote batch', status: 'applied' },
  { county: 'Collin County', change: 'Override GOP share to 56%', status: 'queued' }
]

const NEWS_EVENTS: NewsEvent[] = [
  { time: '20:12', title: 'Backend ingested 50% of expected precincts', sentiment: 'positive' },
  { time: '20:28', title: 'Data gap detected in Panhandle counties · auto-fill enabled', sentiment: 'neutral' },
  { time: '21:05', title: 'Analyst override published to newsroom channel', sentiment: 'positive' },
  { time: '21:42', title: 'Upload lag: satellite feed retry triggered', sentiment: 'negative' }
]

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { combo: 'Space', description: 'Pause or resume playback' },
  { combo: 'Shift + C', description: 'Open county edit modal' },
  { combo: 'A', description: 'Toggle analytics dock' },
  { combo: '1–5', description: 'Change playback speed presets' }
]

const ANALYTICS_TOGGLES = ['Shift vs 2020', 'Turnout cohorts', 'Mail vs Election Day', 'Export CSV']

const SENTIMENT_COLORS: Record<NewsEvent['sentiment'], string> = {
  positive: '#2ED47A',
  neutral: '#8892B0',
  negative: '#FF6B6B'
}

const statusAccent = (status: UploadItem['status']) => {
  if (status === 'complete') return 'text-[#6DEFCF]'
  if (status === 'uploading') return 'text-[#FFCA7A]'
  return 'text-[#73809C]'
}

const statusDot = (status: UploadItem['status']) => {
  if (status === 'complete') return 'bg-[#3ED4A2] shadow-[0_0_10px_rgba(62,212,162,0.6)]'
  if (status === 'uploading') return 'bg-[#FFCA7A] shadow-[0_0_10px_rgba(255,202,122,0.55)] animate-pulse'
  return 'bg-[#3A4156]'
}

const LineChart: React.FC<{ data: LineDatum[]; variant?: 'line' | 'area' }> = ({ data, variant = 'line' }) => {
  const gradientId = useId()
  const areaId = `${gradientId}-area`
  const strokeId = `${gradientId}-stroke`

  const maxValue = Math.max(...data.map((point) => point.value), 1)
  const points = data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100
      const y = 40 - (point.value / maxValue) * 34 - 3
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
        {variant === 'area' && (
          <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4A9CFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#04060A" stopOpacity="0" />
          </linearGradient>
        )}
        <linearGradient id={strokeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#4A9CFF" />
          <stop offset="100%" stopColor="#65E7FF" />
        </linearGradient>
        <polyline fill={variant === 'area' ? `url(#${areaId})` : 'none'} stroke="none" points={points} />
        <polyline
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        {data.map((point, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * 100
          const y = 40 - (point.value / maxValue) * 34 - 3
          return <circle key={point.label} cx={x} cy={y} r={1.4} fill="#9AD8FF" />
        })}
      </svg>
      <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.3em] text-[#4D5A74]">
        {data.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  )
}

const UploadStatusList: React.FC = () => (
  <div className="space-y-3 text-xs text-[#8F9BBC]">
    {UPLOAD_ITEMS.map((item) => (
      <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-[#1C2332] bg-[#0C101A] px-3 py-2">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${statusDot(item.status)}`} />
          <div>
            <p className="text-[13px] text-[#D9E2FF]">{item.name}</p>
            <p className="text-[11px] text-[#5E6A89]">{item.size}</p>
          </div>
        </div>
        <span className={`text-[11px] uppercase tracking-[0.32em] ${statusAccent(item.status)}`}>
          {item.status === 'complete' && 'Ready'}
          {item.status === 'uploading' && 'Syncing'}
          {item.status === 'idle' && 'Pending'}
        </span>
      </div>
    ))}
  </div>
)

const SimulationControlPreview: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between rounded-xl border border-[#1E2536] bg-[#0C111A] px-3 py-2 text-[11px] text-[#6C7898]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#162030] text-xs text-[#9BD3FF]">▶</span>
        <div>
          <p className="text-sm font-semibold text-[#D4E4FF]">Simulation Running</p>
          <p>Timeline synced with backend engine</p>
        </div>
      </div>
      <span className="rounded-lg border border-[#263247] bg-[#131926] px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#78B6FF]">4×</span>
    </div>
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] text-[#5E6A89]">
        <span>Current frame · 21:08:16</span>
        <span>71% reported</span>
      </div>
      <div className="relative h-2 rounded-full bg-[#1A1F2C]">
        <div className="absolute inset-y-0 left-0 w-[71%] rounded-full bg-gradient-to-r from-[#4FB6FF] via-[#64D0FF] to-[#9DEEFF]" />
        <div className="absolute -top-2 left-[71%] h-6 w-6 -translate-x-1/2 rounded-full border border-[#64D0FF] bg-[#111624] shadow-[0_0_14px_rgba(100,208,255,0.7)]" />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.3em] text-[#464F69]">
        <span>Doors Open</span>
        <span>Polls Close</span>
      </div>
    </div>
  </div>
)

const AnalyticsToggleList: React.FC = () => (
  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6C7898]">
    {ANALYTICS_TOGGLES.map((item) => (
      <button
        key={item}
        type="button"
        className="rounded-xl border border-[#1F2738] bg-[#0D111B] px-3 py-2 text-left uppercase tracking-[0.25em] text-[#7BA8FF] transition hover:bg-[#111826]"
      >
        {item}
      </button>
    ))}
  </div>
)

const PartyBar: React.FC<{ data: PartyShare[] }> = ({ data }) => (
  <div className="space-y-3">
    {data.map((item) => (
      <div key={item.label} className="flex items-center gap-3 text-xs text-[#8C9ABF]">
        <span className="w-24 text-[11px] uppercase tracking-[0.24em] text-[#5D6A8A]">{item.label}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a1f2c]">
          <div
            className={`h-full rounded-full ${item.highlight ? 'bg-gradient-to-r from-[#55B5FF] via-[#76D0FF] to-[#9EEAFF]' : 'bg-[#39435A]'}`}
            style={{ width: `${item.value}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm text-[#C2D4FF]">{item.value}%</span>
      </div>
    ))}
  </div>
)

const EditQueueList: React.FC = () => (
  <ul className="space-y-3 text-xs text-[#8994B2]">
    {EDIT_QUEUE.map((item) => (
      <li key={item.county} className="rounded-xl border border-[#202738] bg-[#0D121C] px-4 py-3">
        <div className="flex items-center justify-between text-sm text-[#D8E2FF]">
          <span>{item.county}</span>
          <span className={`text-[10px] uppercase tracking-[0.28em] ${item.status === 'applied' ? 'text-[#6DEFCF]' : 'text-[#FFCA7A]'}`}>
            {item.status === 'applied' ? 'Applied' : 'Queued'}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[#6C7898]">{item.change}</p>
      </li>
    ))}
  </ul>
)

const NewsEventFeed: React.FC = () => (
  <ul className="space-y-2 text-xs text-[#8D98B6]">
    {NEWS_EVENTS.map((event) => (
      <li key={event.title} className="flex items-center gap-3 rounded-xl border border-[#1C2332] bg-[#0B0F18] px-3 py-2">
        <span className="text-[11px] text-[#606B89]">{event.time}</span>
        <span className="flex-1 text-[12px] text-[#D8E2FF]">{event.title}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[event.sentiment] }} />
      </li>
    ))}
  </ul>
)

const KeyboardShortcutList: React.FC = () => (
  <ul className="space-y-3 text-xs text-[#8F9BBC]">
    {KEYBOARD_SHORTCUTS.map((shortcut) => (
      <li key={shortcut.combo} className="flex items-center justify-between rounded-xl border border-[#1C2332] bg-[#0C101A] px-3 py-2">
        <span className="text-[11px] uppercase tracking-[0.32em] text-[#7BD8FF]">{shortcut.combo}</span>
        <span className="text-[12px] text-[#D9E2FF]">{shortcut.description}</span>
      </li>
    ))}
  </ul>
)

const panelDefinitions: Record<PanelId, PanelDefinition> = {
  uploads: {
    title: 'Scenario Assets',
    subtitle: 'Upload sandbox inputs to unlock playback',
    render: () => <UploadStatusList />,
    defaultSize: { width: 340, height: 260 },
    expandedSize: { width: 420, height: 340 },
    minSize: { width: 280, height: 220 }
  },
  exitPolls: {
    title: 'Exit Poll Cohorts',
    subtitle: 'Demographic context loaded from JSON',
    render: () => (
      <div className="flex h-full flex-col">
        <LineChart data={TURNOUT_SERIES} variant="area" />
        <p className="mt-3 text-[11px] text-[#647294]">Turnout modelling for youth cohort vs 2020 baseline.</p>
      </div>
    ),
    defaultSize: { width: 360, height: 260 },
    expandedSize: { width: 460, height: 320 },
    minSize: { width: 320, height: 220 }
  },
  reporting: {
    title: 'Reporting Windows',
    subtitle: 'Auto-derived from reporting config',
    render: () => (
      <div className="flex h-full flex-col">
        <LineChart data={REPORTING_PACE_SERIES} />
        <p className="mt-3 text-[11px] text-[#647294]">Playback highlights pace shifts over ±3% thresholds.</p>
      </div>
    ),
    defaultSize: { width: 360, height: 260 },
    expandedSize: { width: 460, height: 320 },
    minSize: { width: 320, height: 220 }
  },
  analytics: {
    title: 'Analytics Dock',
    subtitle: 'Quick toggles for newsroom asks',
    render: () => <AnalyticsToggleList />,
    defaultSize: { width: 320, height: 220 },
    expandedSize: { width: 420, height: 280 },
    minSize: { width: 280, height: 200 }
  },
  voteShare: {
    title: 'Live Vote Share',
    subtitle: 'Comparing incoming versus exit poll expectation',
    render: () => (
      <div className="flex h-full flex-col justify-between">
        <PartyBar data={PARTY_SHARE} />
        <p className="text-[11px] text-[#647294]">Democratic share is running +1.8 vs exit poll baseline.</p>
      </div>
    ),
    defaultSize: { width: 320, height: 220 },
    expandedSize: { width: 420, height: 280 },
    minSize: { width: 280, height: 200 }
  },
  timeline: {
    title: 'Timeline Playback',
    subtitle: 'Backend generated frames across the reporting window',
    render: () => <SimulationControlPreview />,
    defaultSize: { width: 520, height: 260 },
    expandedSize: { width: 640, height: 320 },
    minSize: { width: 420, height: 220 }
  },
  editQueue: {
    title: 'County Edit Queue',
    subtitle: 'Pending overrides pushed from the map',
    render: () => <EditQueueList />,
    defaultSize: { width: 360, height: 260 },
    expandedSize: { width: 460, height: 320 },
    minSize: { width: 320, height: 220 }
  },
  news: {
    title: 'Newsroom Queue',
    subtitle: 'Automated and analyst-authored events',
    render: () => <NewsEventFeed />,
    defaultSize: { width: 360, height: 240 },
    expandedSize: { width: 460, height: 300 },
    minSize: { width: 320, height: 200 }
  },
  shortcuts: {
    title: 'Keyboard Shortcuts',
    subtitle: 'Preview of help panel content',
    render: () => <KeyboardShortcutList />,
    defaultSize: { width: 320, height: 220 },
    expandedSize: { width: 400, height: 280 },
    minSize: { width: 280, height: 200 }
  }
}

const initialPanels: PanelInstance[] = [
  { id: 'uploads', x: 36, y: 60, width: panelDefinitions.uploads.defaultSize.width, height: panelDefinitions.uploads.defaultSize.height, zIndex: 1 },
  { id: 'exitPolls', x: 36, y: 350, width: panelDefinitions.exitPolls.defaultSize.width, height: panelDefinitions.exitPolls.defaultSize.height, zIndex: 2 },
  { id: 'reporting', x: 36, y: 640, width: panelDefinitions.reporting.defaultSize.width, height: panelDefinitions.reporting.defaultSize.height, zIndex: 3 },
  { id: 'analytics', x: 1450, y: 120, width: panelDefinitions.analytics.defaultSize.width, height: panelDefinitions.analytics.defaultSize.height, zIndex: 4 },
  { id: 'voteShare', x: 1450, y: 360, width: panelDefinitions.voteShare.defaultSize.width, height: panelDefinitions.voteShare.defaultSize.height, zIndex: 5 },
  { id: 'shortcuts', x: 1450, y: 600, width: panelDefinitions.shortcuts.defaultSize.width, height: panelDefinitions.shortcuts.defaultSize.height, zIndex: 6 },
  { id: 'timeline', x: 540, y: 620, width: panelDefinitions.timeline.defaultSize.width, height: panelDefinitions.timeline.defaultSize.height, zIndex: 7 },
  { id: 'editQueue', x: 900, y: 320, width: panelDefinitions.editQueue.defaultSize.width, height: panelDefinitions.editQueue.defaultSize.height, zIndex: 8 },
  { id: 'news', x: 900, y: 40, width: panelDefinitions.news.defaultSize.width, height: panelDefinitions.news.defaultSize.height, zIndex: 9 }
]

const clampPositionValue = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (!Number.isFinite(max) || max <= 0) return value
  return Math.min(value, max)
}

const clampPanelPosition = (x: number, y: number, width: number, height: number): { x: number; y: number } => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width + x
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height + y
  const maxX = viewportWidth - width - 24
  const maxY = viewportHeight - height - 24
  return {
    x: clampPositionValue(x, maxX),
    y: clampPositionValue(y, maxY)
  }
}

const clampPanelSize = (
  id: PanelId,
  x: number,
  y: number,
  width: number,
  height: number
): { width: number; height: number } => {
  const definition = panelDefinitions[id]
  const minWidth = definition.minSize?.width ?? definition.defaultSize.width
  const minHeight = definition.minSize?.height ?? definition.defaultSize.height
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width + x
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height + y
  const maxWidth = viewportWidth - x - 24
  const maxHeight = viewportHeight - y - 24
  return {
    width: Math.min(Math.max(width, minWidth), Math.max(maxWidth, minWidth)),
    height: Math.min(Math.max(height, minHeight), Math.max(maxHeight, minHeight))
  }
}

type FloatingPanelProps = {
  instance: PanelInstance
  definition: PanelDefinition
  isActive: boolean
  onMove: (id: PanelId, x: number, y: number) => void
  onResize: (id: PanelId, width: number, height: number) => void
  onToggleExpand: (id: PanelId) => void
  onFocus: (id: PanelId) => void
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  instance,
  definition,
  isActive,
  onMove,
  onResize,
  onToggleExpand,
  onFocus
}) => {
  const { id, x, y, width, height, zIndex } = instance

  const startPointerSession = useCallback((event: React.PointerEvent, cursor: string, handleMove: (moveEvent: PointerEvent) => void) => {
    event.preventDefault()
    event.stopPropagation()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = cursor

    const handlePointerUp = () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handlePointerUp)
  }, [])

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onFocus(id)
    const startX = event.clientX
    const startY = event.clientY
    const initialX = x
    const initialY = y

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      onMove(id, initialX + deltaX, initialY + deltaY)
    }

    startPointerSession(event, 'grabbing', onPointerMove)
  }, [id, onFocus, onMove, startPointerSession, x, y])

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onFocus(id)
    const startX = event.clientX
    const startY = event.clientY
    const initialWidth = width
    const initialHeight = height

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      onResize(id, initialWidth + deltaX, initialHeight + deltaY)
    }

    startPointerSession(event, 'se-resize', onPointerMove)
  }, [height, id, onFocus, onResize, startPointerSession, width])

  return (
    <section
      style={{ left: x, top: y, width, height, zIndex }}
      className={`absolute flex flex-col rounded-2xl border border-[#1A2130] bg-[#0B0F18E6] backdrop-blur-xl shadow-[0_28px_60px_rgba(2,6,16,0.55)] transition-all ${isActive ? 'ring-2 ring-[#6BD7FF]/60' : 'ring-1 ring-[#101522]'}`}
      onPointerDown={() => onFocus(id)}
    >
      <header
        className="flex cursor-grab items-center justify-between rounded-t-2xl border-b border-[#1F2636] bg-[#111623]/90 px-4 py-3 text-[11px] text-[#6A7797]"
        onPointerDown={handleDragStart}
        onDoubleClick={() => onToggleExpand(id)}
      >
        <div>
          <p className="text-sm font-semibold text-[#D8E2FF]">{definition.title}</p>
          {definition.subtitle && <p className="text-[11px] text-[#6A7797]">{definition.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {definition.expandedSize && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleExpand(id)
              }}
              className="rounded-lg border border-[#273146] bg-[#121929] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#7BD8FF] transition hover:bg-[#182234]"
            >
              Expand
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-4 text-sm text-[#C7D2F3]">
        {definition.render()}
      </div>
      <div
        className="absolute bottom-2 right-2 h-4 w-4 cursor-se-resize rounded-lg border border-transparent"
        onPointerDown={handleResizeStart}
      ></div>
    </section>
  )
}

const SandboxStudioDesignPreviewContent: React.FC = () => {
  const [panels, setPanels] = useState<PanelInstance[]>(() => initialPanels)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  const bringToFront = useCallback((id: PanelId) => {
    setPanels((previous) => {
      const highest = Math.max(...previous.map((panel) => panel.zIndex)) + 1
      return previous.map((panel) => (panel.id === id ? { ...panel, zIndex: highest } : panel))
    })
    setActivePanel(id)
  }, [])

  const movePanel = useCallback((id: PanelId, x: number, y: number) => {
    setPanels((previous) => previous.map((panel) => {
      if (panel.id !== id) return panel
      const clamped = clampPanelPosition(x, y, panel.width, panel.height)
      return { ...panel, ...clamped }
    }))
  }, [])

  const resizePanel = useCallback((id: PanelId, width: number, height: number) => {
    setPanels((previous) => previous.map((panel) => {
      if (panel.id !== id) return panel
      const clampedSize = clampPanelSize(id, panel.x, panel.y, width, height)
      return { ...panel, ...clampedSize }
    }))
  }, [])

  const toggleExpand = useCallback((id: PanelId) => {
    const definition = panelDefinitions[id]
    if (!definition.expandedSize) return

    setPanels((previous) => previous.map((panel) => {
      if (panel.id !== id) return panel
      const isExpanded = Math.abs(panel.width - definition.expandedSize!.width) < 12 && Math.abs(panel.height - definition.expandedSize!.height) < 12
      const targetSize = isExpanded ? definition.defaultSize : definition.expandedSize!
      const size = clampPanelSize(id, panel.x, panel.y, targetSize.width, targetSize.height)
      return { ...panel, ...size }
    }))
  }, [])

  return (
    <div className="relative min-h-screen bg-[#03050A] text-[#F4F7FF]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#264875,#05080F_70%)] opacity-80" />
        <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-99.9018,31.9686,4.5,0/1280x720?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndjJ6eWl2eWgifQ.-iG4RDLtYcVz_3Zp2Jp3PA')] bg-cover bg-center opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04070F]/60 via-transparent to-[#010204]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="mx-8 mt-6 flex items-center justify-between rounded-2xl border border-[#1B222F] bg-[#090C14] px-6 py-3 text-xs text-[#5A667F] shadow-[0_18px_45px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#232B3B] bg-[#101522] px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-[#7BD8FF]">Sandbox Studio · Design Lab</span>
            <span className="text-[11px] text-[#4F5972]">Drag, resize, and expand panels over the live map.</span>
          </div>
          <div className="flex items-center gap-4 text-[#465168]">
            <span>Keyboard shortcuts</span>
            <span>Iterate in Storybook</span>
            <span>View production</span>
          </div>
        </header>

        <main className="relative flex-1">
          {panels.map((panel) => (
            <FloatingPanel
              key={panel.id}
              instance={panel}
              definition={panelDefinitions[panel.id]}
              isActive={panel.id === activePanel}
              onMove={movePanel}
              onResize={resizePanel}
              onToggleExpand={toggleExpand}
              onFocus={bringToFront}
            />
          ))}
        </main>
      </div>
    </div>
  )
}

const SandboxStudioDesignPreviewPage: React.FC = () => (
  <SandboxThemeProvider>
    <SandboxStudioDesignPreviewContent />
  </SandboxThemeProvider>
)

export default SandboxStudioDesignPreviewPage
