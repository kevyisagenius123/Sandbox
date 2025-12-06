import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authenticatedFetch, getAuthToken } from '../utils/auth'
import { debugLog, debugWarn } from '../utils/debugLogger'
import type { SimulationStatus } from '../components/sandbox/studio/types'
import type { CountySimulationState, NewsroomEvent, ReportingConfig } from '../types/sandbox'

// Backend URL configuration - points to your Spring Boot backend
const BACKEND_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_BACKEND_URL || 'https://sandbox-backend-977058061007.us-central1.run.app')
  : 'http://localhost:8081'
const WS_URL = `${BACKEND_URL}/ws`

type DemographicBreakdown = Record<string, unknown>

type ReportingStats = {
  countiesReporting: number
  countiesTotal: number
  resolvedTotalFrames: number
  dynamicFrameTimeline: boolean
}

interface PlaybackController {
  isReady: boolean
  totalDurationSeconds: number
  seekToSeconds: (seconds: number) => void
  seekToPercent: (percent: number) => void
}

interface UseBackendSimulationOptions {
  csvData: string
  scenarioName?: string
  reportingConfig?: ReportingConfig
}

interface StartSimulationResponse {
  jobId?: string
  sessionId: string
  websocketUrl?: string
  message?: string
}

const INITIAL_REPORTING_STATS: ReportingStats = {
  countiesReporting: 0,
  countiesTotal: 0,
  resolvedTotalFrames: 0,
  dynamicFrameTimeline: false
}

const slugify = (value: string) => (
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
)

export const useBackendSimulation = ({ csvData, scenarioName, reportingConfig }: UseBackendSimulationOptions) => {
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const stompClientRef = useRef<Client | null>(null)
  const scenarioIdRef = useRef<string | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const countyStatesRef = useRef<Map<string, CountySimulationState>>(new Map())
  const demographicsRef = useRef<Map<string, DemographicBreakdown>>(new Map())
  // Track the vote totals at which each county was last enriched
  // This prevents older enrichment (with fewer votes) from overwriting newer enrichment
  const enrichmentVoteTotalsRef = useRef<Map<string, number>>(new Map())

  const [status, setStatus] = useState<SimulationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0)
  const [progress, setProgress] = useState(0)
  const [countyStates, setCountyStates] = useState<Map<string, CountySimulationState>>(new Map())
  const [demographicData, setDemographicData] = useState<Map<string, DemographicBreakdown>>(new Map())
  const [nationalMargin, setNationalMargin] = useState(0)
  const [newsroomEvents, setNewsroomEvents] = useState<NewsroomEvent[]>([])
  const [reportingStats, setReportingStats] = useState<ReportingStats>({ ...INITIAL_REPORTING_STATS })
  const [playbackMeta, setPlaybackMeta] = useState({ isReady: false, totalDurationSeconds: 0 })

  const ensureAuthenticated = useCallback(() => {
    const token = getAuthToken()
    if (!token) {
      throw new Error('You must be logged in to run backend simulations.')
    }
    return token
  }, [])

  const resetState = useCallback(() => {
    countyStatesRef.current = new Map()
    demographicsRef.current = new Map()
    enrichmentVoteTotalsRef.current = new Map()
    setCountyStates(new Map())
    setDemographicData(new Map())
    setNewsroomEvents([])
    setProgress(0)
    setCurrentTimeSeconds(0)
    setNationalMargin(0)
    setReportingStats({ ...INITIAL_REPORTING_STATS })
    setPlaybackMeta({ isReady: false, totalDurationSeconds: 0 })
  }, [])

  useEffect(() => {
    if (!csvData) {
      scenarioIdRef.current = null
      resetState()
      setStatus('idle')
      return
    }

    setError(null)
    setStatus((prev) => (prev === 'running' || prev === 'uploading' ? prev : 'ready'))
  }, [csvData, resetState])

  const handleFramePayload = useCallback((payload: any) => {
    if (!payload) {
      debugWarn('[useBackendSimulation] handleFramePayload called with null/undefined payload')
      return
    }

    setCurrentTimeSeconds(payload.simulationTimeSeconds ?? 0)
    setProgress(payload.progressPercent ?? 0)

    setReportingStats((prev) => ({
      countiesReporting: payload.countiesReporting ?? prev.countiesReporting,
      countiesTotal: payload.countiesTotal ?? prev.countiesTotal,
      resolvedTotalFrames: prev.resolvedTotalFrames,
      dynamicFrameTimeline: prev.dynamicFrameTimeline
    }))

    if (typeof payload.demVotes === 'number' && typeof payload.repVotes === 'number') {
      const dem = payload.demVotes
      const rep = payload.repVotes
      const total = dem + rep
      const margin = total > 0 ? ((rep - dem) / total) * 100 : 0
      setNationalMargin(Number.isFinite(margin) ? margin : 0)
    }

    const updates = Array.isArray(payload.counties) ? payload.counties : []
    if (!updates.length) {
      debugWarn('[useBackendSimulation] Frame payload missing county updates')
      return
    }

    const nextStates = new Map(countyStatesRef.current)
    const nextDemographics = new Map(demographicsRef.current)
    updates.forEach((county: any) => {
      const fips: string = (county.fips ?? '').toString().padStart(5, '0')
      if (!fips) return

      const demVotes = Number.isFinite(county.demVotes) ? Number(county.demVotes) : (nextStates.get(fips)?.currentDemVotes ?? 0)
      const gopVotes = Number.isFinite(county.gopVotes) ? Number(county.gopVotes) : (nextStates.get(fips)?.currentGopVotes ?? 0)
      const totalVotes = Number.isFinite(county.totalVotes) ? Number(county.totalVotes) : demVotes + gopVotes + (nextStates.get(fips)?.currentOtherVotes ?? 0)
      const otherVotes = Math.max(0, totalVotes - demVotes - gopVotes)
      const reportingPercent = Number.isFinite(county.reportingPercent) ? Number(county.reportingPercent) : (nextStates.get(fips)?.currentReportingPercent ?? 0)

      nextStates.set(fips, {
        fips,
        currentDemVotes: demVotes,
        currentGopVotes: gopVotes,
        currentOtherVotes: otherVotes,
        currentTotalVotes: totalVotes,
        currentReportingPercent: reportingPercent,
        lastUpdateTime: Date.now(),
        isFullyReported: reportingPercent >= 99.9
      })

      if (county.demographics) {
        nextDemographics.set(fips, county.demographics as DemographicBreakdown)
      }
    })

    countyStatesRef.current = nextStates
    demographicsRef.current = nextDemographics
    setCountyStates(new Map(nextStates))
    setDemographicData(new Map(nextDemographics))
  }, [])

  const handleMetadata = useCallback((payload: any) => {
    if (!payload) return
    const totalDurationSeconds = payload.totalDurationSeconds ?? payload.effectiveDurationSeconds ?? 0
    const resolvedTotalFrames = payload.resolvedTotalFrames ?? payload.totalFrames ?? 0
    setPlaybackMeta({
      totalDurationSeconds,
      isReady: totalDurationSeconds > 0 || resolvedTotalFrames > 0
    })
    setReportingStats((prev) => ({
      countiesReporting: payload.countiesReporting ?? prev.countiesReporting,
      countiesTotal: payload.countiesTotal ?? prev.countiesTotal,
      resolvedTotalFrames,
      dynamicFrameTimeline: Boolean(payload.dynamicFrameTimeline ?? prev.dynamicFrameTimeline)
    }))
  }, [])

  const handleCompleted = useCallback((payload: any) => {
    setStatus('completed')
    setIsPlaying(false)
    setProgress(100)
    if (payload) {
      setReportingStats((prev) => ({
        countiesReporting: payload.countiesReporting ?? prev.countiesReporting,
        countiesTotal: payload.countiesTotal ?? prev.countiesTotal,
        resolvedTotalFrames: payload.totalFrames ?? prev.resolvedTotalFrames,
        dynamicFrameTimeline: prev.dynamicFrameTimeline
      }))
      if (typeof payload.durationSeconds === 'number') {
        setPlaybackMeta({ isReady: true, totalDurationSeconds: payload.durationSeconds })
      }
    }
  }, [])

  const handleNewsroom = useCallback((payload: any) => {
    if (!payload) return
    const event: NewsroomEvent = {
      id: payload.id ?? crypto.randomUUID(),
      type: payload.type ?? 'INFO',
      headline: payload.headline ?? payload.title ?? 'Update',
      detail: payload.detail ?? payload.description,
      state: payload.state,
      stateFips: payload.stateFips,
      margin: payload.margin ?? payload.marginPercent,
      reportingPercent: payload.reportingPercent,
      simulationTimeSeconds: payload.simulationTimeSeconds ?? currentTimeSeconds,
      severity: payload.severity ?? 'info',
      timestamp: payload.timestamp ?? new Date().toISOString()
    }

    setNewsroomEvents((prev) => [event, ...prev].slice(0, 60))
  }, [currentTimeSeconds])

  const handleError = useCallback((payload: any) => {
    const message = payload?.message ?? 'Simulation error'
    setError(message)
    setStatus('error')
    setIsPlaying(false)
  }, [])

  const handleEnrichment = useCallback((payload: any) => {
    if (!payload || !payload.fips) {
      debugWarn('[useBackendSimulation] Enrichment payload missing fips')
      return
    }
    
    const fips = payload.fips.toString().padStart(5, '0')
    const newVoteTotals = payload.enrichedAtTotalVotes ?? 0
    const existingVoteTotals = enrichmentVoteTotalsRef.current.get(fips) ?? 0
    
    // Only accept enrichment if it has equal or higher vote totals than what we already have
    // This prevents race conditions where older enrichment overwrites newer data
    if (newVoteTotals < existingVoteTotals) {
      debugLog(`[useBackendSimulation] Skipping stale enrichment for ${fips}: ${newVoteTotals} < ${existingVoteTotals} votes`)
      return
    }
    
    // Update demographics if present
    if (payload.demographics) {
      enrichmentVoteTotalsRef.current.set(fips, newVoteTotals)
      demographicsRef.current.set(fips, payload.demographics as DemographicBreakdown)
      setDemographicData(new Map(demographicsRef.current))
      debugLog(`[useBackendSimulation] Enrichment applied for ${fips} @ ${newVoteTotals} votes, ${payload.enrichedAtReportingPct?.toFixed(1)}% reporting`)
    }
  }, [])

  const handleEnvelope = useCallback((envelope: any) => {
    switch (envelope?.type) {
      case 'frame':
      case 'delta':
        handleFramePayload(envelope.payload)
        break
      case 'metadata':
        handleMetadata(envelope.payload)
        break
      case 'completed':
        handleCompleted(envelope.payload)
        break
      case 'newsroom':
        handleNewsroom(envelope.payload)
        break
      case 'enrichment':
        handleEnrichment(envelope.payload)
        break
      case 'error':
        handleError(envelope.payload)
        break
      default:
        debugWarn('[useBackendSimulation] Unknown envelope type', envelope?.type)
        break
    }
  }, [handleCompleted, handleEnrichment, handleError, handleFramePayload, handleMetadata, handleNewsroom])

  const connect = useCallback(() => {
    if (stompClientRef.current?.active) return

    debugLog('[WebSocket] Connecting to backend at:', WS_URL)
    const socket = new SockJS(WS_URL)
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (message: string) => debugLog('[stomp]', message)
    })

    client.onConnect = () => {
      setIsConnected(true)
      const topic = `/topic/simulation/${sessionIdRef.current}`
      debugLog(`[🔌 FRONTEND WS] Connected to WebSocket, subscribing to: ${topic}`)
      debugLog(`[📋 FRONTEND WS] Session ID for subscription: ${sessionIdRef.current}`)
      debugLog('[⏰ FRONTEND WS] Waiting for backend broadcast...')
      
      client.subscribe(topic, (message) => {
        try {
          const payload = JSON.parse(message.body)
          if (payload?.type === 'frame' || payload?.type === 'delta') {
            const countyCount = payload?.payload?.counties?.length || 0
            if (countyCount === 0) {
              debugWarn('[FRONTEND WS] Received frame with zero counties')
            }
          }
          handleEnvelope(payload)
        } catch (err) {
          console.error('Failed to parse WebSocket envelope', err)
        }
      })
    }

    client.onStompError = (frame) => {
      console.error('WebSocket error', frame.headers['message'])
      setIsConnected(false)
    }

    client.onWebSocketClose = () => {
      setIsConnected(false)
    }

    client.activate()
    stompClientRef.current = client
  }, [handleEnvelope])

  const disconnect = useCallback(() => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate()
      stompClientRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  const uploadBlob = useCallback(async (endpoint: string, blob: Blob, filename: string) => {
    const formData = new FormData()
    formData.append('file', new File([blob], filename))
    const url = `${BACKEND_URL}${endpoint}`
    debugLog('[Backend] Uploading to:', url)
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      throw new Error(`Failed to upload ${filename}`)
    }
    return response.json()
  }, [])

  const ensureScenario = useCallback(async () => {
    if (!csvData.trim()) {
      throw new Error('County CSV is required to start a simulation.')
    }

    setStatus('uploading')
    const slug = slugify(scenarioName || 'sandbox-scenario') || 'sandbox-scenario'
    const csvBlob = new Blob([csvData], { type: 'text/csv' })
    const csvUpload = await uploadBlob('/api/scenarios/upload-csv', csvBlob, `${slug}.csv`)
    const csvUrl: string = csvUpload.url

    let reportingConfigUrl: string | undefined
    if (reportingConfig) {
      const configBlob = new Blob([JSON.stringify(reportingConfig, null, 2)], { type: 'application/json' })
      const configUpload = await uploadBlob('/api/scenarios/upload-config', configBlob, `${slug}-reporting.json`)
      reportingConfigUrl = configUpload.url
    }

    const response = await authenticatedFetch(`${BACKEND_URL}/api/scenarios/create-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scenarioName || 'Sandbox Scenario',
        description: 'Generated via Sandbox Studio frontend.',
        isPublic: false,
        csvDataUrl: csvUrl,
        reportingConfigUrl: reportingConfigUrl ?? null,
        metadata: {
          source: 'sandbox-studio',
          createdAt: new Date().toISOString()
        },
        tags: ['sandbox', 'studio'],
        reportingPattern: 'URBAN_FIRST',
        speed: speed
      })
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Failed to create scenario')
    }

    const scenario = await response.json()
    scenarioIdRef.current = scenario.id
    return scenario.id as string
  }, [csvData, reportingConfig, scenarioName, speed, uploadBlob])

  const startJob = useCallback(async (scenarioId: string) => {
    debugLog('[🚀 FRONTEND] Starting simulation job with sessionId:', sessionIdRef.current)
    const response = await authenticatedFetch(`${BACKEND_URL}/api/simulate/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioId,
        sessionId: sessionIdRef.current,
        forceRefresh: true
      })
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Failed to start simulation job')
    }

    const result = await response.json() as StartSimulationResponse
    debugLog('[✅ FRONTEND] Job started, backend response:', {
      jobId: result.jobId,
      sessionId: result.sessionId,
      websocketUrl: result.websocketUrl,
      sessionIdMatches: result.sessionId === sessionIdRef.current
    })
    debugLog('[⏳ FRONTEND] Now awaiting WebSocket frames from backend...')
    return result
  }, [])

  const startSimulation = useCallback(async () => {
    try {
      ensureAuthenticated()
      setError(null)
      resetState()
      const scenarioId = await ensureScenario()
      const job = await startJob(scenarioId)
      jobIdRef.current = job.jobId ?? null
      setStatus('running')
      setIsPlaying(true)
    } catch (err) {
      console.error('Failed to start simulation', err)
      setStatus('error')
      setIsPlaying(false)
      setError(err instanceof Error ? err.message : 'Failed to start simulation')
    }
  }, [ensureScenario, resetState, startJob])

  const pauseSimulation = useCallback(async () => {
    if (!jobIdRef.current) return
    try {
      await authenticatedFetch(`${BACKEND_URL}/api/simulate/pause/${jobIdRef.current}`, { method: 'POST' })
    } catch (err) {
      console.error('Pause request failed', err)
    }
    setStatus('paused')
    setIsPlaying(false)
  }, [])

  const resumeSimulation = useCallback(async () => {
    if (!jobIdRef.current) return
    try {
      await authenticatedFetch(`${BACKEND_URL}/api/simulate/resume/${jobIdRef.current}`, { method: 'POST' })
    } catch (err) {
      console.error('Resume request failed', err)
    }
    setStatus('running')
    setIsPlaying(true)
  }, [])

  const stopSimulation = useCallback(async (hardReset = false) => {
    const jobId = jobIdRef.current
    if (jobId) {
      try {
        await authenticatedFetch(`${BACKEND_URL}/api/simulate/stop/${jobId}`, { method: 'POST' })
      } catch (err) {
        console.error('Stop request failed', err)
      }
    }
    jobIdRef.current = null
    setIsPlaying(false)
    setStatus(hardReset ? 'idle' : 'ready')
    if (hardReset) {
      scenarioIdRef.current = null
      resetState()
    }
  }, [resetState])

  const updateSpeed = useCallback(async (value: number) => {
    const clamped = Math.max(0.25, Math.min(40, value))
    setSpeedState(clamped)
    const jobId = jobIdRef.current
    if (!jobId) return
    try {
      await authenticatedFetch(`${BACKEND_URL}/api/simulate/speed/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: clamped })
      })
    } catch (err) {
      console.error('Speed update failed', err)
    }
  }, [])

  const seekToSeconds = useCallback((seconds: number) => {
    debugLog('[sandbox] seekToSeconds requested', seconds)
  }, [])

  const seekToPercent = useCallback((percent: number) => {
    if (playbackMeta.totalDurationSeconds <= 0) return
    const seconds = (percent / 100) * playbackMeta.totalDurationSeconds
    seekToSeconds(seconds)
  }, [playbackMeta.totalDurationSeconds, seekToSeconds])

  const playback: PlaybackController = useMemo(() => ({
    isReady: playbackMeta.isReady,
    totalDurationSeconds: playbackMeta.totalDurationSeconds,
    seekToSeconds,
    seekToPercent
  }), [playbackMeta.isReady, playbackMeta.totalDurationSeconds, seekToPercent, seekToSeconds])

  return {
    countyStates,
    currentTimeSeconds,
    demographicData,
    error,
    isConnected,
    isPlaying,
    nationalMargin,
    newsroomEvents,
    playback,
    reportingStats,
    pauseSimulation,
    progress,
    resumeSimulation,
    setSpeed: updateSpeed,
    speed,
    startSimulation,
    status,
    stopSimulation
  }
}
