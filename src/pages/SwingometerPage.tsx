import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SandboxMapBabylon } from '../components/map/SandboxMapBabylon'
import { SwingometerOverlay } from '../components/swingometer/SwingometerOverlay'
import type { CountyResult, CountySimulationState } from '../types/sandbox'
import type { DemographicAdjustments, ScenarioParams } from '../types/swingometer'
import { ALL_US_STATES } from '../constants/usStates'
import {
  fetchBaselineYears,
  fetchBaselines,
  fetchSnapshot,
  fetchScenarioParams,
  getDemographicAdjustments,
  setDemographicAdjustments,
  startSimulation,
  toggleDemographicTurnout,
  updateScenarioParams
} from '../services/swingometerService'

const DEFAULT_SELECTED_STATES: string[] = []
const STATE_ABBR_BY_FIPS = new Map(ALL_US_STATES.map(state => [state.fips, state.abbr]))

type DemiKey = keyof DemographicAdjustments

export const SwingometerPage: React.FC = () => {
  const [scenarioParams, setScenarioParams] = useState<ScenarioParams | null>(null)
  const [availableBaseYears, setAvailableBaseYears] = useState<number[]>([])
  const [useDemographicTurnout, setUseDemographicTurnout] = useState(false)
  const [demographicDraft, setDemographicDraft] = useState<DemographicAdjustments>({})
  const [demographicSaving, setDemographicSaving] = useState(false)
  const [frames, setFrames] = useState<CountySimulationState[]>([])
  const [baselineMeta, setBaselineMeta] = useState<Map<string, { county: string; state: string }>>(new Map())
  const [selectedStates, setSelectedStates] = useState<string[]>(DEFAULT_SELECTED_STATES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scenarioPatchRef = useRef<Partial<ScenarioParams> | null>(null)
  const scenarioDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [params, adjustments, baselineYears] = await Promise.all([
        fetchScenarioParams(),
        getDemographicAdjustments(),
        fetchBaselineYears(),
        startSimulation()
      ])
      setScenarioParams(params)
      setUseDemographicTurnout(Boolean(params.useDemographicTurnout))
      setDemographicDraft(adjustments)
      setAvailableBaseYears(Array.isArray(baselineYears.years) ? baselineYears.years : [])
      setLoading(false)
    } catch (err) {
      console.error('[SwingometerPage] Failed to bootstrap swingometer service', err)
      setError('Unable to reach the swingometer service. Ensure the backend is running on port 8084.')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
    return () => {
      if (scenarioDebounceRef.current) clearTimeout(scenarioDebounceRef.current)
      if (demDebounceRef.current) clearTimeout(demDebounceRef.current)
    }
  }, [bootstrap])

  useEffect(() => {
    if (!scenarioParams?.baseYear) return
    let cancelled = false
    const loadBaselines = async () => {
      try {
        const counties = await fetchBaselines()
        if (cancelled) return
        const lookup = new Map<string, { county: string; state: string }>()
        counties.forEach((county) => {
          const state = STATE_ABBR_BY_FIPS.get(county.stateFips) ?? county.stateFips
          const countyName = county.countyName?.trim() || 'County'
          lookup.set(county.fips.padStart(5, '0'), { county: countyName, state })
        })
        setBaselineMeta(lookup)
      } catch (err) {
        if (!cancelled) {
          console.error('[SwingometerPage] Failed to load baselines', err)
          setError('Unable to load baseline county metadata from the service')
        }
      }
    }
    loadBaselines()
    return () => {
      cancelled = true
    }
  }, [scenarioParams?.baseYear])

  useEffect(() => {
    if (!scenarioParams?.baseYear) return undefined

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const fetchFrameLoop = async () => {
      try {
        const frame = await fetchSnapshot()
        if (!cancelled && Array.isArray(frame.counties)) {
          const mapStates: CountySimulationState[] = frame.counties.map(county => ({
            fips: String(county.fips ?? '').padStart(5, '0'),
            currentDemVotes: county.dem,
            currentGopVotes: county.gop,
            currentOtherVotes: Math.max(0, county.total - county.dem - county.gop),
            currentTotalVotes: county.total,
            currentReportingPercent: county.reportingPct ?? 0,
            lastUpdateTime: county.ts ?? Date.now(),
            isFullyReported: (county.reportingPct ?? 0) >= 99.9
          }))
          setFrames(mapStates)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[SwingometerPage] Failed to fetch frame', err)
          setError('Lost connection to swingometer service frame feed')
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(fetchFrameLoop, 500)
        }
      }
    }

    fetchFrameLoop()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [scenarioParams?.baseYear])

  const queueScenarioUpdate = useCallback(async () => {
    if (!scenarioPatchRef.current) return
    try {
      const payload = scenarioPatchRef.current
      scenarioPatchRef.current = null
      await updateScenarioParams(payload)
      const latest = await fetchScenarioParams()
      setScenarioParams(latest)
      setUseDemographicTurnout(Boolean(latest.useDemographicTurnout))
    } catch (err) {
      console.error('[SwingometerPage] Failed to persist scenario params', err)
      setError('Unable to update scenario parameters on the backend')
    }
  }, [])

  const handleScenarioChange = useCallback((patch: Partial<ScenarioParams>) => {
    setScenarioParams(prev => (prev ? { ...prev, ...patch } : prev))
    scenarioPatchRef.current = { ...(scenarioPatchRef.current ?? {}), ...patch }
    if (scenarioDebounceRef.current) {
      clearTimeout(scenarioDebounceRef.current)
    }
    scenarioDebounceRef.current = setTimeout(queueScenarioUpdate, 100)
  }, [queueScenarioUpdate])

  const handleDemographicChange = useCallback((key: DemiKey, value: number) => {
    setDemographicDraft(prev => {
      const next = { ...prev, [key]: value }
      if (demDebounceRef.current) clearTimeout(demDebounceRef.current)
      demDebounceRef.current = setTimeout(async () => {
        setDemographicSaving(true)
        try {
          const updated = await setDemographicAdjustments(next)
          setDemographicDraft(updated)
        } catch (err) {
          console.error('[SwingometerPage] Failed to persist demographic adjustments', err)
          setError('Unable to update demographic turnout adjustments')
        } finally {
          setDemographicSaving(false)
        }
      }, 150)
      return next
    })
  }, [])

  const handleResetDemographics = useCallback(() => {
    if (demDebounceRef.current) {
      clearTimeout(demDebounceRef.current)
      demDebounceRef.current = null
    }
    const resetPayload: DemographicAdjustments = {}
    setDemographicDraft(resetPayload)
    setDemographicSaving(true)
    setDemographicAdjustments(resetPayload)
      .then(setDemographicDraft)
      .catch(err => {
        console.error('[SwingometerPage] Failed to reset demographics', err)
        setError('Unable to reset demographic adjustments on the backend')
      })
      .finally(() => setDemographicSaving(false))
  }, [])

  const handleDemographicToggle = useCallback((enabled: boolean) => {
    setUseDemographicTurnout(enabled)
    toggleDemographicTurnout(enabled).catch(err => {
      console.error('[SwingometerPage] Failed to toggle demographic turnout', err)
      setError('Unable to toggle demographic turnout engine on backend')
      setUseDemographicTurnout(prev => (prev === enabled ? !enabled : prev))
    })
  }, [])

  const handleStateSelect = (stateFips: string) => {
    setSelectedStates(prev => {
      const normalized = stateFips.padStart(2, '0')
      if (prev.includes(normalized)) {
        return prev.filter(item => item !== normalized)
      }
      return [...prev, normalized]
    })
  }

  const countyResults: (CountyResult & { name?: string })[] = useMemo(() => {
    if (!frames.length) return []
    return frames.map(frame => {
      const meta = baselineMeta.get(frame.fips)
      const otherVotes = Math.max(0, (frame.currentTotalVotes ?? 0) - (frame.currentDemVotes ?? 0) - (frame.currentGopVotes ?? 0))
      const countyName = meta?.county ?? 'County'
      return {
        fips: frame.fips,
        state: meta?.state ?? STATE_ABBR_BY_FIPS.get(frame.fips.slice(0, 2)) ?? frame.fips.slice(0, 2),
        county: countyName,
        gopVotes: frame.currentGopVotes ?? 0,
        demVotes: frame.currentDemVotes ?? 0,
        otherVotes,
        totalVotes: frame.currentTotalVotes ?? 0,
        reportingPercent: frame.currentReportingPercent ?? 0,
        name: countyName
      }
    })
  }, [frames, baselineMeta])

  const countyStates = useMemo(() => {
    const map = new Map<string, CountySimulationState>()
    frames.forEach(frame => {
      map.set(frame.fips, frame)
    })
    return map
  }, [frames])

  const editedCounties = useMemo(() => new Set<string>(), [])

  const handleCountyClick = () => {}

  const showMap = countyResults.length > 0

  return (
    <div className="relative min-h-screen bg-slate-950">
      {showMap ? (
        <SandboxMapBabylon
          countyResults={countyResults}
          countyStates={countyStates}
          editedCounties={editedCounties}
          onCountyClick={handleCountyClick}
          selectedStates={selectedStates}
          onStateSelect={handleStateSelect}
          opacity={0.94}
        />
      ) : (
        <div className="h-full w-full bg-slate-950" />
      )}

      <SwingometerOverlay
        scenarioParams={scenarioParams}
        availableBaseYears={availableBaseYears}
        onScenarioChange={handleScenarioChange}
        demographicAdjustments={demographicDraft}
        onDemographicChange={handleDemographicChange}
        onResetDemographics={handleResetDemographics}
        useDemographicTurnout={useDemographicTurnout}
        onToggleDemographicTurnout={handleDemographicToggle}
        demographicSaving={demographicSaving}
      />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950">
          <p className="text-sm text-slate-400">Connecting to swingometer service…</p>
        </div>
      )}
      {error && !loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/90 px-6 text-center">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}
    </div>
  )
}

export default SwingometerPage
