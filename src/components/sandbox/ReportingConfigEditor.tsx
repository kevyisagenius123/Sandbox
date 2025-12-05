import React, { useEffect, useMemo, useState } from 'react'
import { debugLog } from '../../utils/debugLogger'
import type {
  CountyResult,
  ReportingConfig,
  GroupRule,
  CountyReporting,
  ReportingWave
} from '../../types/sandbox'

const LOCAL_STORAGE_KEY = 'sandboxReportingConfigs'

type SavedReportingConfig = {
  id: string
  name: string
  pattern?: string | null
  updatedAt: string
  config: ReportingConfig
}

const cloneConfig = (config: ReportingConfig): ReportingConfig => JSON.parse(JSON.stringify(config))

const DEFAULT_WAVES: ReportingWave[] = [
  { atSeconds: 0, percent: 0 },
  { atSeconds: 300, percent: 35 },
  { atSeconds: 600, percent: 70 },
  { atSeconds: 900, percent: 90 },
  { atSeconds: 1200, percent: 100 }
]

const TEMPLATE_OPTIONS: Array<{
  key: string
  label: string
  description: string
}> = [
  { key: 'URBAN_FIRST', label: 'Urban surge', description: 'Cities move early, rural counties trail the close.' },
  { key: 'RURAL_FIRST', label: 'Rural kickoff', description: 'Rural precincts lead the night with metro closing later.' },
  { key: 'MIXED', label: 'Balanced mix', description: 'Each geography gets a staggered wave across the night.' },
  { key: 'ALPHABETICAL', label: 'Alphabetical', description: 'Counties report in alphabetical batches across the timeline.' },
  { key: 'REGIONAL', label: 'Regional relay', description: 'East to Midwest to Sun Belt regional waves.' },
  { key: 'RANDOM', label: 'Randomized', description: 'Enable jittered reporting for more organic pacing.' }
]

const GEOGRAPHY_OPTIONS = ['rural', 'suburban', 'urban']

const DEFAULT_RANDOMIZATION = {
  enabled: false,
  jitterSeconds: 300,
  seed: Date.now() % 100000
}

const ISOFormatter = (iso: string | undefined): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return tzAdjusted.toISOString().slice(0, 16)
}

const createBaseConfig = (current?: ReportingConfig): ReportingConfig => {
  if (current) return current
  const now = new Date()
  return {
    version: '1.0',
    description: 'Custom reporting configuration',
    baseTimestamp: now.toISOString(),
    counties: [],
    groupRules: [],
    randomization: { ...DEFAULT_RANDOMIZATION }
  }
}

const buildPatternTemplate = (
  pattern: string | undefined,
  base: ReportingConfig
): ReportingConfig => {
  const template: ReportingConfig = {
    ...base,
    description: `Template applied: ${pattern ?? 'Custom'}`,
    counties: [],
    groupRules: [],
    randomization: { ...DEFAULT_RANDOMIZATION }
  }

  switch (pattern) {
    case 'URBAN_FIRST':
      template.groupRules = [
        {
          name: 'urban_early',
          filter: { geography: 'urban' },
          pattern: {
            startSeconds: 0,
            endSeconds: 540,
            initialPercent: 15,
            finalPercent: 95
          }
        },
        {
          name: 'rural_late',
          filter: { geography: 'rural' },
          pattern: {
            startSeconds: 360,
            endSeconds: 1200,
            initialPercent: 5,
            finalPercent: 92
          }
        }
      ]
      break
    case 'RURAL_FIRST':
      template.groupRules = [
        {
          name: 'rural_early',
          filter: { geography: 'rural' },
          pattern: {
            startSeconds: 0,
            endSeconds: 540,
            initialPercent: 15,
            finalPercent: 96
          }
        },
        {
          name: 'urban_late',
          filter: { geography: 'urban' },
          pattern: {
            startSeconds: 480,
            endSeconds: 1200,
            initialPercent: 5,
            finalPercent: 98
          }
        }
      ]
      break
    case 'MIXED':
      template.groupRules = [
        {
          name: 'metro_first_wave',
          filter: { geography: 'urban' },
          pattern: {
            startSeconds: 0,
            endSeconds: 420,
            initialPercent: 12,
            finalPercent: 85
          }
        },
        {
          name: 'suburban_middle',
          filter: { geography: 'suburban' },
          pattern: {
            startSeconds: 240,
            endSeconds: 900,
            initialPercent: 18,
            finalPercent: 95
          }
        },
        {
          name: 'rural_close',
          filter: { geography: 'rural' },
          pattern: {
            startSeconds: 540,
            endSeconds: 1200,
            initialPercent: 10,
            finalPercent: 96
          }
        }
      ]
      break
    case 'ALPHABETICAL':
      template.groupRules = [
        {
          name: 'alphabetical_wave',
          filter: { order: 'alphabetical' },
          pattern: {
            startSeconds: 0,
            endSeconds: 1200,
            initialPercent: 5,
            finalPercent: 100
          }
        }
      ]
      break
    case 'REGIONAL':
      template.groupRules = [
        {
          name: 'east_coast',
          filter: { region: 'east' },
          pattern: {
            startSeconds: 0,
            endSeconds: 540,
            initialPercent: 20,
            finalPercent: 90
          }
        },
        {
          name: 'midwest',
          filter: { region: 'midwest' },
          pattern: {
            startSeconds: 180,
            endSeconds: 900,
            initialPercent: 10,
            finalPercent: 95
          }
        },
        {
          name: 'sunbelt',
          filter: { region: 'sunbelt' },
          pattern: {
            startSeconds: 480,
            endSeconds: 1200,
            initialPercent: 8,
            finalPercent: 98
          }
        }
      ]
      break
    case 'RANDOM':
      template.randomization = {
        enabled: true,
        jitterSeconds: 600,
        seed: Date.now() % 100000
      }
      break
    default:
      break
  }

  return template
}

type ReportingConfigEditorProps = {
  countyResults: CountyResult[]
  scenarioName: string
  value?: ReportingConfig
  onChange: (config: ReportingConfig) => void
}

export const ReportingConfigEditor: React.FC<ReportingConfigEditorProps> = ({
  countyResults,
  scenarioName,
  value,
  onChange
}) => {
  const [draft, setDraft] = useState<ReportingConfig | null>(value ?? null)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [savedConfigs, setSavedConfigs] = useState<SavedReportingConfig[]>([])
  const [saveLabel, setSaveLabel] = useState('')
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const percentInRange = (value: number | undefined) => typeof value === 'number' && value >= 0 && value <= 100

  const activeTemplateLabel = useMemo(() => {
    if (!activeTemplate) return 'selected template'
    const match = TEMPLATE_OPTIONS.find((template) => template.key === activeTemplate)
    const label = match?.label ?? activeTemplate
    return `${label} template`
  }, [activeTemplate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as SavedReportingConfig[]
      if (Array.isArray(parsed)) {
        setSavedConfigs(parsed)
      }
    } catch (error) {
      console.error('[ReportingConfigEditor] Failed to load saved timelines', error)
    }
  }, [])

  useEffect(() => {
    const trimmed = scenarioName?.trim?.() ?? ''
    if (!trimmed) return
    setSaveLabel((previous) => (previous ? previous : trimmed))
  }, [scenarioName])

  useEffect(() => {
    if (selectedSavedId) return
    const trimmed = scenarioName?.trim?.().toLowerCase()
    if (!trimmed) return
    const match = savedConfigs.find((entry) => entry.name.toLowerCase() === trimmed)
    if (match) {
      setSelectedSavedId(match.id)
    }
  }, [savedConfigs, scenarioName, selectedSavedId])

  useEffect(() => {
    if (value) {
      setDraft(value)
    } else {
      setDraft(null)
    }
  }, [value])

  const countyIndex = useMemo(() => {
    return countyResults.map((county) => ({
      fips: county.fips,
      label: `${county.county}, ${county.state}`
    }))
  }, [countyResults])

  const persistSavedConfigs = (configs: SavedReportingConfig[]) => {
    setSavedConfigs(configs)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs))
    } catch (error) {
      console.error('[ReportingConfigEditor] Failed to persist timelines', error)
    }
  }

  const generateConfigId = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
    } catch (error) {
      // Ignore and use fallback
    }
    return `cfg_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }

  const pushChange = (next: ReportingConfig) => {
    debugLog('[ReportingConfigEditor] pushChange called with config:', next)
    debugLog('[ReportingConfigEditor] Config has', next.groupRules?.length ?? 0, 'group rules')
    setDraft(next)
    onChange(next)
    debugLog('[ReportingConfigEditor] onChange callback invoked')
  }

  const ensureConfig = () => {
    const current = draft ?? createBaseConfig()
    setDraft(current)
    onChange(current)
  }

  const applyTemplate = (patternKey?: string | null) => {
    debugLog('[ReportingConfigEditor] applyTemplate called with:', patternKey)
    const targetPattern = patternKey ?? activeTemplate
    debugLog('[ReportingConfigEditor] Target pattern:', targetPattern)
    const current = draft ?? createBaseConfig()
    debugLog('[ReportingConfigEditor] Current config (before):', current)
    const updated = buildPatternTemplate(targetPattern ?? undefined, current)
    debugLog('[ReportingConfigEditor] Updated config (after):', updated)
    debugLog('[ReportingConfigEditor] Group rules count:', updated.groupRules?.length ?? 0)
    setActiveTemplate(targetPattern ?? null)
    pushChange(updated)
  }

  const handleApplyPattern = () => {
    if (!activeTemplate) return
    applyTemplate(activeTemplate)
  }

  const handleBaseTimestampChange = (valueTimestamp: string) => {
    const base = draft ?? createBaseConfig()
    const iso = valueTimestamp ? new Date(valueTimestamp).toISOString() : base.baseTimestamp
    pushChange({ ...base, baseTimestamp: iso })
  }

  const handleRandomizationToggle = (enabled: boolean) => {
    const base = draft ?? createBaseConfig()
    const config = {
      ...base,
      randomization: {
        enabled,
        jitterSeconds: base.randomization?.jitterSeconds ?? DEFAULT_RANDOMIZATION.jitterSeconds,
        seed: base.randomization?.seed ?? DEFAULT_RANDOMIZATION.seed
      }
    }
    pushChange(config)
  }

  const updateRandomizationField = (field: 'jitterSeconds' | 'seed', valueField: number) => {
    const base = draft ?? createBaseConfig()
    const config = {
      ...base,
      randomization: {
        enabled: base.randomization?.enabled ?? true,
        jitterSeconds: field === 'jitterSeconds' ? valueField : base.randomization?.jitterSeconds ?? DEFAULT_RANDOMIZATION.jitterSeconds,
        seed: field === 'seed' ? valueField : base.randomization?.seed ?? DEFAULT_RANDOMIZATION.seed
      }
    }
    pushChange(config)
  }

  const handleAddGroupRule = () => {
    const base = draft ?? createBaseConfig()
    const nextRule: GroupRule = {
      name: `group_${base.groupRules.length + 1}`,
      filter: { geography: 'urban' },
      pattern: {
        startSeconds: 0,
        endSeconds: 900,
        initialPercent: 15,
        finalPercent: 95
      }
    }
    pushChange({ ...base, groupRules: [...base.groupRules, nextRule] })
  }

  const handleUpdateGroup = (index: number, updater: (rule: GroupRule) => GroupRule) => {
    if (!draft) return
    const updatedRules = draft.groupRules.map((rule, idx) => (idx === index ? updater(rule) : rule))
    pushChange({ ...draft, groupRules: updatedRules })
  }

  const handleRemoveGroup = (index: number) => {
    if (!draft) return
    const updatedRules = draft.groupRules.filter((_, idx) => idx !== index)
    pushChange({ ...draft, groupRules: updatedRules })
  }

  const handleAddCountyOverride = (fips: string) => {
    if (!fips) return
    const base = draft ?? createBaseConfig()
    const normalized = fips.padStart(5, '0')
    if (base.counties.some((county) => county.fips.padStart(5, '0') === normalized)) {
      return
    }
    const override: CountyReporting = {
      fips: normalized,
      mode: 'schedule',
      reportingWaves: DEFAULT_WAVES.map((wave) => ({ ...wave }))
    }
    pushChange({ ...base, counties: [...base.counties, override] })
  }

  const handleUpdateCounty = (fips: string, updater: (county: CountyReporting) => CountyReporting) => {
    if (!draft) return
    const next = draft.counties.map((county) =>
      county.fips === fips ? updater(county) : county
    )
    pushChange({ ...draft, counties: next })
  }

  const handleRemoveCounty = (fips: string) => {
    if (!draft) return
    const next = draft.counties.filter((county) => county.fips !== fips)
    pushChange({ ...draft, counties: next })
  }

  const handleDuplicateCountyWave = (fips: string, index: number) => {
    handleUpdateCounty(fips, (current) => {
      const waves = current.reportingWaves ?? []
      const target = waves[index]
      if (!target) return current
      const duplicated = { ...target }
      const nextWaves = [...waves.slice(0, index + 1), duplicated, ...waves.slice(index + 1)]
      return { ...current, reportingWaves: nextWaves }
    })
  }

  const handleResetCountyWaves = (fips: string) => {
    handleUpdateCounty(fips, (current) => ({
      ...current,
      reportingWaves: DEFAULT_WAVES.map((wave) => ({ ...wave }))
    }))
  }

  const renderCountyTimelinePreview = (waves: ReportingWave[] | undefined) => {
    if (!waves || waves.length === 0) return null
    const sorted = [...waves].sort((a, b) => a.atSeconds - b.atSeconds)
    const maxSeconds = Math.max(sorted[sorted.length - 1]?.atSeconds ?? 0, 1)

    return (
      <div className="space-y-1">
        <div className="relative h-2 w-full rounded-full bg-gray-800">
          {sorted.map((wave, idx) => {
            const position = Math.min(100, (wave.atSeconds / maxSeconds) * 100)
            return (
              <div
                key={`${wave.atSeconds}-${idx}`}
                className="absolute top-[-2px] h-3 w-[2px] -translate-x-1/2 rounded bg-blue-300"
                style={{ left: `${position}%` }}
                title={`t=${wave.atSeconds}s · ${wave.percent}%`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>0s</span>
          <span>{`${maxSeconds}s`}</span>
        </div>
      </div>
    )
  }

  const handleSaveConfig = () => {
    const base = draft ?? createBaseConfig()
    const label = (saveLabel || scenarioName || '').trim()
    if (!label) {
      setSaveFeedback('Enter a name before saving this timeline.')
      return
    }

    const cloned = cloneConfig(base)
    const timestamp = new Date().toISOString()
    const existingIndex = savedConfigs.findIndex((entry) => entry.name.toLowerCase() === label.toLowerCase())
    const id = existingIndex >= 0 ? savedConfigs[existingIndex].id : generateConfigId()
    const entry: SavedReportingConfig = {
      id,
      name: label,
      pattern: activeTemplate ?? null,
      updatedAt: timestamp,
      config: cloned
    }

    const nextConfigs = existingIndex >= 0
      ? savedConfigs.map((item) => (item.id === id ? entry : item))
      : [...savedConfigs, entry]

    persistSavedConfigs(nextConfigs)
    setSelectedSavedId(id)
    setSaveFeedback(existingIndex >= 0 ? `Updated “${label}”.` : `Saved “${label}”.`)
    setTimeout(() => setSaveFeedback(null), 2500)
  }

  const handleLoadSavedConfig = () => {
    if (!selectedSavedId) return
    const entry = savedConfigs.find((item) => item.id === selectedSavedId)
    if (!entry) return
    pushChange(cloneConfig(entry.config))
    setActiveTemplate(entry.pattern ?? null)
    setIsCollapsed(false)
    setSaveFeedback(`Loaded “${entry.name}”.`)
    setTimeout(() => setSaveFeedback(null), 2000)
  }

  const handleDeleteSavedConfig = () => {
    if (!selectedSavedId) return
    const entry = savedConfigs.find((item) => item.id === selectedSavedId)
    if (!entry) return
    const next = savedConfigs.filter((item) => item.id !== selectedSavedId)
    persistSavedConfigs(next)
    setSelectedSavedId('')
    setSaveFeedback(`Removed “${entry.name}”.`)
    setTimeout(() => setSaveFeedback(null), 2000)
  }

  const formatUpdatedAt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return iso
    }
  }

  if (!draft) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
        <p className="text-sm text-gray-300">No custom reporting configuration yet.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={ensureConfig}
            className="rounded-lg border border-blue-500/40 bg-blue-600/30 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-600/40"
          >
            Start blank configuration
          </button>
        </div>
        <div className="mt-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Or start with a template</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {TEMPLATE_OPTIONS.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => {
                  debugLog('[ReportingConfigEditor] Preset button clicked:', template.key, template.label)
                  applyTemplate(template.key)
                }}
                className="rounded-xl border border-gray-700 bg-gray-900/70 px-3 py-3 text-left transition hover:border-blue-500/40 hover:text-blue-100"
              >
                <div className="text-sm font-semibold text-gray-200">{template.label}</div>
                <p className="mt-1 text-[11px] text-gray-400">{template.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 text-xs text-gray-200">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-left text-sm font-semibold text-white"
      >
        <span>Reporting timeline editor</span>
        <span className="text-xs text-gray-400">{isCollapsed ? 'Expand' : 'Collapse'}</span>
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Base timeline</h4>
            <div className="mt-2 space-y-2">
              <label className="block text-[11px] text-gray-400">Anchor timestamp</label>
              <input
                type="datetime-local"
                value={ISOFormatter(draft.baseTimestamp)}
                onChange={(event) => handleBaseTimestampChange(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyPattern}
                disabled={!activeTemplate}
                className="rounded-lg border border-blue-500/40 bg-blue-600/30 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-600/40 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
              >
                Apply {activeTemplateLabel}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Templates</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {TEMPLATE_OPTIONS.map((template) => {
                const isActive = activeTemplate === template.key
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => applyTemplate(template.key)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${isActive ? 'border-blue-500/60 bg-blue-600/20 text-blue-100' : 'border-gray-700 bg-gray-900/70 text-gray-200 hover:border-blue-500/40 hover:text-blue-100'}`}
                  >
                    <div className="text-sm font-semibold">{template.label}</div>
                    <p className="mt-1 text-[11px] text-gray-400">{template.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Saved timelines</h4>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={saveLabel}
                onChange={(event) => setSaveLabel(event.target.value)}
                placeholder="Name to save as…"
                className="w-full flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveConfig}
                className="rounded-lg border border-emerald-500/40 bg-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-600/40"
              >
                Save timeline
              </button>
            </div>
            {saveFeedback && <p className="text-[11px] text-emerald-300">{saveFeedback}</p>}
            {savedConfigs.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedSavedId}
                  onChange={(event) => setSelectedSavedId(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select saved timeline…</option>
                  {savedConfigs.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {formatUpdatedAt(entry.updatedAt)}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSavedConfig}
                    disabled={!selectedSavedId}
                    className="rounded-lg border border-blue-500/40 bg-blue-600/30 px-3 py-2 text-xs font-semibold text-blue-100 transition disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 hover:bg-blue-600/40"
                  >
                    Load selected
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSavedConfig}
                    disabled={!selectedSavedId}
                    className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-2 text-xs font-semibold text-red-200 transition disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 hover:bg-red-600/30"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear ALL saved timelines? This cannot be undone.')) {
                        persistSavedConfigs([])
                        setSelectedSavedId('')
                        setSaveFeedback('All saved timelines cleared.')
                        setTimeout(() => setSaveFeedback(null), 2000)
                      }
                    }}
                    disabled={savedConfigs.length === 0}
                    className="rounded-lg border border-orange-500/40 bg-orange-600/20 px-3 py-2 text-xs font-semibold text-orange-200 transition disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 hover:bg-orange-600/30"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">
                No saved timelines yet. Save a configuration to reuse it across scenarios.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Randomization</h4>
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={draft.randomization?.enabled ?? false}
                onChange={(event) => handleRandomizationToggle(event.target.checked)}
                className="h-4 w-4 rounded border border-gray-600 bg-gray-800"
              />
              Enable jitter to mimic precinct variability
            </label>
            {(draft.randomization?.enabled ?? false) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-gray-400">Jitter (seconds)</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.randomization?.jitterSeconds ?? DEFAULT_RANDOMIZATION.jitterSeconds}
                    onChange={(event) => updateRandomizationField('jitterSeconds', Number(event.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-gray-400">Random seed</label>
                  <input
                    type="number"
                    value={draft.randomization?.seed ?? DEFAULT_RANDOMIZATION.seed}
                    onChange={(event) => updateRandomizationField('seed', Number(event.target.value))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Group rules</h4>
              <button
                type="button"
                onClick={handleAddGroupRule}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1 text-[11px] font-semibold text-gray-100 hover:border-blue-500"
              >
                Add rule
              </button>
            </div>
            {draft.groupRules.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-gray-400">
                No group-based patterns yet. Add a rule to control reporting waves for geography or regions.
              </p>
            )}
            <div className="space-y-3">
              {draft.groupRules.map((rule, index) => {
                const nameValid = (rule.name ?? '').trim().length > 0
                const startValid = rule.pattern.startSeconds >= 0
                const endValid = rule.pattern.endSeconds >= rule.pattern.startSeconds
                const initialValid = percentInRange(rule.pattern.initialPercent)
                const finalValid = percentInRange(rule.pattern.finalPercent)
                const finalGteInitial = rule.pattern.finalPercent >= rule.pattern.initialPercent

                return (
                  <div key={rule.name ?? index} className="space-y-3 rounded-xl border border-gray-700 bg-gray-900/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(event) => handleUpdateGroup(index, (current) => ({ ...current, name: event.target.value }))}
                        className={`flex-1 rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${nameValid ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                        placeholder="Rule name"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(index)}
                        className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-600/30"
                      >
                        Remove
                      </button>
                    </div>
                    {!nameValid && <p className="text-[11px] text-red-400">Give this rule a descriptive name.</p>}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Filter type</label>
                        <select
                          value={rule.filter?.geography ? 'geography' : rule.filter?.region ? 'region' : rule.filter?.order ? 'order' : 'geography'}
                          onChange={(event) => {
                            const nextType = event.target.value
                            handleUpdateGroup(index, (current) => {
                              if (nextType === 'geography') return { ...current, filter: { geography: 'urban' } }
                              if (nextType === 'region') return { ...current, filter: { region: 'midwest' } }
                              if (nextType === 'order') return { ...current, filter: { order: 'alphabetical' } }
                              return current
                            })
                          }}
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="geography">Geography</option>
                          <option value="region">Region</option>
                          <option value="order">Custom order</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Filter value</label>
                        {'geography' in rule.filter ? (
                          <select
                            value={rule.filter.geography}
                            onChange={(event) => handleUpdateGroup(index, (current) => ({
                              ...current,
                              filter: { geography: event.target.value }
                            }))}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                          >
                            {GEOGRAPHY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : 'region' in rule.filter ? (
                          <select
                            value={rule.filter.region}
                            onChange={(event) => handleUpdateGroup(index, (current) => ({
                              ...current,
                              filter: { region: event.target.value }
                            }))}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="east">East</option>
                            <option value="midwest">Midwest</option>
                            <option value="sunbelt">Sun Belt</option>
                            <option value="west">West</option>
                          </select>
                        ) : (
                          <select
                            value={rule.filter.order}
                            onChange={(event) => handleUpdateGroup(index, (current) => ({
                              ...current,
                              filter: { order: event.target.value }
                            }))}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="alphabetical">Alphabetical</option>
                            <option value="reverse">Reverse alphabetical</option>
                            <option value="population">Population weighted</option>
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Starts at (s)</label>
                        <input
                          type="number"
                          min={0}
                          value={rule.pattern.startSeconds}
                          onChange={(event) => handleUpdateGroup(index, (current) => ({
                            ...current,
                            pattern: { ...current.pattern, startSeconds: Number(event.target.value) }
                          }))}
                          className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${startValid ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                        />
                        {!startValid && <p className="text-[11px] text-red-400">Start time must be zero or greater.</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Ends at (s)</label>
                        <input
                          type="number"
                          min={rule.pattern.startSeconds}
                          value={rule.pattern.endSeconds}
                          onChange={(event) => handleUpdateGroup(index, (current) => ({
                            ...current,
                            pattern: { ...current.pattern, endSeconds: Number(event.target.value) }
                          }))}
                          className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${endValid ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                        />
                        {!endValid && <p className="text-[11px] text-red-400">End time must be after start time.</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Initial %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.pattern.initialPercent}
                          onChange={(event) => handleUpdateGroup(index, (current) => ({
                            ...current,
                            pattern: { ...current.pattern, initialPercent: Number(event.target.value) }
                          }))}
                          className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${initialValid ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                        />
                        {!initialValid && <p className="text-[11px] text-red-400">Enter a percent between 0 and 100.</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Final %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.pattern.finalPercent}
                          onChange={(event) => handleUpdateGroup(index, (current) => ({
                            ...current,
                            pattern: { ...current.pattern, finalPercent: Number(event.target.value) }
                          }))}
                          className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${finalValid && finalGteInitial ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                        />
                        {!finalValid && <p className="text-[11px] text-red-400">Enter a percent between 0 and 100.</p>}
                        {finalValid && !finalGteInitial && (
                          <p className="text-[11px] text-red-400">Final percent must be at least the initial percent.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">County overrides</h4>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[200px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  defaultValue=""
                  onChange={(event) => {
                    handleAddCountyOverride(event.target.value)
                    event.currentTarget.value = ''
                  }}
                >
                  <option value="" disabled>
                    Add county override…
                  </option>
                  {countyIndex.map((county) => (
                    <option key={county.fips} value={county.fips}>
                      {county.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {draft.counties.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-700 bg-gray-900 px-3 py-2 text-gray-400">
                All counties currently follow group rules. Add overrides to hand-tune reporting waves or trigger behavior.
              </p>
            )}

            <div className="space-y-3">
              {draft.counties.map((county) => {
                const label = countyIndex.find((entry) => entry.fips === county.fips)?.label ?? county.fips

                return (
                  <div key={county.fips} className="space-y-3 rounded-xl border border-gray-700 bg-gray-900/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="font-semibold text-gray-100">{label}</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCounty(county.fips)}
                        className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-600/30"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-gray-400">Mode</label>
                        <select
                          value={county.mode ?? 'schedule'}
                          onChange={(event) =>
                            handleUpdateCounty(county.fips, (current) => ({
                              ...current,
                              mode: event.target.value as CountyReporting['mode']
                            }))
                          }
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="schedule">Schedule</option>
                          <option value="manual">Manual trigger</option>
                          <option value="batch">Batch group</option>
                        </select>
                      </div>
                      {county.mode === 'batch' && (
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-400">Batch group name</label>
                          <input
                            type="text"
                            value={county.batchGroup ?? ''}
                            onChange={(event) =>
                              handleUpdateCounty(county.fips, (current) => ({
                                ...current,
                                batchGroup: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., late_absentee"
                          />
                        </div>
                      )}
                      {county.mode === 'batch' && (
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-400">Trigger at (seconds)</label>
                          <input
                            type="number"
                            min={0}
                            value={county.batchTriggerTime ?? 0}
                            onChange={(event) =>
                              handleUpdateCounty(county.fips, (current) => ({
                                ...current,
                                batchTriggerTime: Number(event.target.value)
                              }))
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      )}
                      {county.mode === 'manual' && (
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-400">Manual trigger required</label>
                          <label className="flex items-center gap-2 text-sm text-gray-200">
                            <input
                              type="checkbox"
                              checked={county.manualTrigger ?? true}
                              onChange={(event) =>
                                handleUpdateCounty(county.fips, (current) => ({
                                  ...current,
                                  manualTrigger: event.target.checked
                                }))
                              }
                              className="h-4 w-4 rounded border border-gray-600 bg-gray-800"
                            />
                            Require manual trigger before reporting
                          </label>
                        </div>
                      )}
                    </div>

                    {county.mode !== 'manual' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Reporting waves</h5>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCounty(county.fips, (current) => ({
                                  ...current,
                                  reportingWaves: [...current.reportingWaves, { atSeconds: 0, percent: 0 }]
                                }))
                              }
                              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1 text-[11px] font-semibold text-gray-100 hover:border-blue-500"
                            >
                              Add wave
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetCountyWaves(county.fips)}
                              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1 text-[11px] font-semibold text-gray-100 hover:border-blue-500"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {county.reportingWaves.map((wave, idx) => {
                            const atValid = wave.atSeconds >= 0
                            const prevWave = idx > 0 ? county.reportingWaves[idx - 1] : undefined
                            const monotonic = !prevWave || wave.atSeconds >= prevWave.atSeconds
                            const percentValid = percentInRange(wave.percent)

                            return (
                              <div key={idx} className="grid grid-cols-3 gap-3 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
                                <div>
                                  <label className="mb-1 block text-[11px] text-gray-400">At (s)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={wave.atSeconds}
                                    onChange={(event) =>
                                      handleUpdateCounty(county.fips, (current) => ({
                                        ...current,
                                        reportingWaves: current.reportingWaves.map((existing, wIndex) =>
                                          wIndex === idx ? { ...existing, atSeconds: Number(event.target.value) } : existing
                                        )
                                      }))
                                    }
                                    className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${atValid && monotonic ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                                  />
                                  {!atValid && <p className="text-[11px] text-red-400">Time must be zero or greater.</p>}
                                  {atValid && !monotonic && (
                                    <p className="text-[11px] text-red-400">Keep wave times in ascending order.</p>
                                  )}
                                </div>
                                <div>
                                  <label className="mb-1 block text-[11px] text-gray-400">Percent</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={wave.percent}
                                    onChange={(event) =>
                                      handleUpdateCounty(county.fips, (current) => ({
                                        ...current,
                                        reportingWaves: current.reportingWaves.map((existing, wIndex) =>
                                          wIndex === idx ? { ...existing, percent: Number(event.target.value) } : existing
                                        )
                                      }))
                                    }
                                    className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:outline-none ${percentValid ? 'border-gray-700 focus:border-blue-500' : 'border-red-500/70 focus:border-red-500'}`}
                                  />
                                  {!percentValid && <p className="text-[11px] text-red-400">Enter a percent between 0 and 100.</p>}
                                </div>
                                <div className="flex items-end justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCounty(county.fips, (current) => ({
                                        ...current,
                                        reportingWaves: current.reportingWaves.filter((_, wIndex) => wIndex !== idx)
                                      }))
                                    }
                                    className="rounded border border-red-500/40 bg-red-600/20 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-600/30"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateCountyWave(county.fips, idx)}
                                    className="ml-2 rounded border border-blue-500/40 bg-blue-600/20 px-3 py-1 text-[11px] font-semibold text-blue-100 hover:bg-blue-600/30"
                                  >
                                    Duplicate
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          <div className="pt-1">
                            {renderCountyTimelinePreview(county.reportingWaves)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default ReportingConfigEditor