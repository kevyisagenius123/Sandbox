export { ScenarioIntelligencePanel as InsightsPanel, type InsightSnapshot } from './ScenarioIntelligencePanel'

/* Legacy InsightsPanel implementation retained for reference.
  The new ScenarioIntelligencePanel supersedes this code path.

import React, { useEffect, useMemo, useState } from 'react'
import type { CountyResult, CountySimulationState } from '../../types/sandbox'

export interface InsightSnapshot {
  timestamp: number
  demVotes: number
  gopVotes: number
  otherVotes: number
  totalVotes: number
  marginVotes: number
  marginPct: number
  reportingPercent: number
  voteReportingPercent: number
  votesRemaining: number
}

interface InsightsPanelProps {
  countyStates: Map<string, CountySimulationState>
  countyResults: CountyResult[]
  history: InsightSnapshot[]
  currentTimeSeconds: number
}

type TabId = 'campaign' | 'analyst'

type StateFlipCandidate = {
  label: string
  leaderCode: 'D' | 'R' | 'Tie'
  reportingPct: number
  remaining: number
  marginVotes: number
  marginPct: number
  riskScore: number
}

type CountyFlipCandidate = {
  key: string
  label: string
  leaderCode: 'D' | 'R' | 'Tie'
  reportingPct: number
  remaining: number
  marginVotes: number
  marginPct: number
  riskScore: number
}

const STORAGE_KEY = 'sandbox-insights-collapsed'
const LOOKBACK_SECONDS = 300
const MAX_DISPLAY_ITEMS = 3

const numberFormatter = new Intl.NumberFormat('en-US')
const percentFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const formatNumber = (value: number) => numberFormatter.format(Math.round(value))
const formatPercent = (value: number) => `${percentFormatter.format(value)}%`

const computeRiskScore = (remaining: number, marginVotes: number) => {
  if (remaining <= 0) return 0
  const absMargin = Math.abs(marginVotes)
  if (absMargin === 0) return 100
  const ratio = remaining / (remaining + absMargin)
  return Math.min(1, ratio) * 100
}

const buildCountyLookup = (countyResults: CountyResult[]) => {
  const map = new Map<string, CountyResult>()
  for (const county of countyResults) {
    const normalized = county.fips.padStart(5, '0')
    map.set(normalized, county)
    map.set(county.fips, county)
  }
  return map
}

const usePersistentCollapsedState = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === 'collapsed'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, isCollapsed ? 'collapsed' : 'expanded')
  }, [isCollapsed])

  return { isCollapsed, setIsCollapsed }
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  countyStates,
  countyResults,
  history,
  currentTimeSeconds
}) => {
  const { isCollapsed, setIsCollapsed } = usePersistentCollapsedState()
  const [activeTab, setActiveTab] = useState<TabId>('campaign')

  const countyLookup = useMemo(() => buildCountyLookup(countyResults), [countyResults])

  const currentSnapshot = history.length > 0 ? history[history.length - 1] : null

  const baselineSnapshot = useMemo(() => {
    if (!currentSnapshot || history.length < 2) return null
    const target = currentSnapshot.timestamp - LOOKBACK_SECONDS

    for (let i = history.length - 2; i >= 0; i--) {
      const candidate = history[i]
      if (candidate.timestamp <= target) {
        return candidate
      }
      if (i === 0) {
        return candidate
      }
    }
    return null
  }, [currentSnapshot, history])

  const reportingDelta = currentSnapshot && baselineSnapshot
    ? currentSnapshot.reportingPercent - baselineSnapshot.reportingPercent
    : 0
  const voteDelta = currentSnapshot && baselineSnapshot
    ? currentSnapshot.voteReportingPercent - baselineSnapshot.voteReportingPercent
    : 0
  const marginDeltaPts = currentSnapshot && baselineSnapshot
    ? currentSnapshot.marginPct - baselineSnapshot.marginPct
    : 0
  const marginDeltaVotes = currentSnapshot && baselineSnapshot
    ? currentSnapshot.marginVotes - baselineSnapshot.marginVotes
    : 0

  const stateUniverse: StateFlipCandidate[] = useMemo(() => {
    if (!countyResults.length) return []

    const stateMap = new Map<string, {
      label: string
      expected: number
      reported: number
      dem: number
      gop: number
    }>()

    for (const county of countyResults) {
      const label = (county.state || 'Unknown').toUpperCase()
      const normalized = county.fips.padStart(5, '0')
      const stateEntry = stateMap.get(label) ?? {
        label,
        expected: 0,
        reported: 0,
        dem: 0,
        gop: 0
      }

      stateEntry.expected += county.totalVotes ?? 0

      const simState = countyStates.get(normalized) ?? countyStates.get(county.fips)
      if (simState) {
        stateEntry.reported += simState.currentTotalVotes
        stateEntry.dem += simState.currentDemVotes
        stateEntry.gop += simState.currentGopVotes
      }

      stateMap.set(label, stateEntry)
    }

    const rollups: StateFlipCandidate[] = []

    for (const entry of stateMap.values()) {
  if (entry.expected <= 0) continue
      const reportingPct = entry.expected > 0 ? (entry.reported / entry.expected) * 100 : 0
  if (reportingPct <= 0) continue
      const remaining = Math.max(entry.expected - entry.reported, 0)
      const marginVotes = entry.gop - entry.dem
      const marginPct = entry.reported > 0 ? (marginVotes / entry.reported) * 100 : 0
      const leaderCode: 'D' | 'R' | 'Tie' = marginVotes > 0 ? 'R' : marginVotes < 0 ? 'D' : 'Tie'
      const riskScore = computeRiskScore(remaining, marginVotes)

      if (remaining <= 0) continue

      rollups.push({
        label: entry.label,
        leaderCode,
        reportingPct,
        remaining,
        marginVotes,
        marginPct,
        riskScore
      })
    }

    return rollups
  }, [countyResults, countyStates])

  const stateCandidates: StateFlipCandidate[] = useMemo(() => {
    if (!stateUniverse.length) return []
    return [...stateUniverse]
      .sort((a, b) => {
        if (Math.abs(b.riskScore - a.riskScore) > 1) {
          return b.riskScore - a.riskScore
        }
        return b.remaining - a.remaining
      })
      .slice(0, MAX_DISPLAY_ITEMS)
  }, [stateUniverse])

  const countyCandidates: CountyFlipCandidate[] = useMemo(() => {
    if (!countyStates.size) return []

    const candidates: CountyFlipCandidate[] = []

    countyStates.forEach((state) => {
      const meta = countyLookup.get(state.fips) ?? countyLookup.get(state.fips.padStart(5, '0'))
      if (!meta) return
      const expected = meta.totalVotes ?? 0
      if (expected <= 0) return

      const reportingPct = state.currentReportingPercent
      if (reportingPct <= 0) return

      const remaining = Math.max(expected - state.currentTotalVotes, 0)
      if (remaining <= 0) return

      const marginVotes = state.currentGopVotes - state.currentDemVotes
      const marginPct = state.currentTotalVotes > 0
        ? (marginVotes / state.currentTotalVotes) * 100
        : 0
      const leaderCode: 'D' | 'R' | 'Tie' = marginVotes > 0 ? 'R' : marginVotes < 0 ? 'D' : 'Tie'
      const riskScore = computeRiskScore(remaining, marginVotes)

      if (riskScore < 10) return

      candidates.push({
        key: state.fips,
        label: `${meta.county}, ${meta.state}`,
        leaderCode,
        reportingPct,
        remaining,
        marginVotes,
        marginPct,
        riskScore
      })
    })

    return candidates.length
      ? [...candidates]
          .sort((a, b) => {
            if (Math.abs(b.riskScore - a.riskScore) > 1) {
              return b.riskScore - a.riskScore
            }
            return b.remaining - a.remaining
          })
          .slice(0, MAX_DISPLAY_ITEMS)
      : []
  }, [countyStates, countyLookup])

  const slowStates = useMemo(() => {
    if (!stateUniverse.length) return []

    return [...stateUniverse]
      .filter((state) => state.reportingPct < 65)
      .sort((a, b) => a.reportingPct - b.reportingPct)
      .slice(0, MAX_DISPLAY_ITEMS)
  }, [stateUniverse])

  const hasHistory = Boolean(currentSnapshot)

  const renderCampaignTab = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Flip watch — states</h4>
        <ul className="mt-2 space-y-2">
          {stateCandidates.length > 0 ? stateCandidates.map((state) => (
            <li key={state.label} className="rounded-lg border border-gray-800/60 bg-gray-900/70 p-3 text-xs text-gray-300">
              <div className="flex items-baseline justify-between text-sm font-semibold text-gray-100">
                <span>{state.label}</span>
                <span>{formatPercent(Math.min(Math.max(state.reportingPct, 0), 100))}</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                Remaining {formatNumber(state.remaining)} vs margin {formatNumber(Math.abs(state.marginVotes))}
              </div>
              <div
                className={`mt-1 text-[11px] font-semibold ${
                  state.leaderCode === 'R'
                    ? 'text-red-300'
                    : state.leaderCode === 'D'
                      ? 'text-blue-300'
                      : 'text-gray-300'
                }`}
              >
                {state.leaderCode === 'Tie' ? 'Tied race' : `${state.leaderCode}+${Math.abs(state.marginPct).toFixed(1)} pts`}
              </div>
              <div className="mt-1 text-[11px] text-amber-300">Flip risk: {Math.round(state.riskScore)}%</div>
            </li>
          )) : (
            <li className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-3 text-xs text-gray-400">
              No high-risk states right now.
            </li>
          )}
        </ul>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Flip watch — counties</h4>
        <ul className="mt-2 space-y-2">
          {countyCandidates.length > 0 ? countyCandidates.map((county) => (
            <li key={county.key} className="rounded-lg border border-gray-800/60 bg-gray-900/70 p-3 text-xs text-gray-300">
              <div className="flex items-baseline justify-between text-sm font-semibold text-gray-100">
                <span className="truncate pr-2">{county.label}</span>
                <span>{formatPercent(Math.min(Math.max(county.reportingPct, 0), 100))}</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                Remaining {formatNumber(county.remaining)} vs margin {formatNumber(Math.abs(county.marginVotes))}
              </div>
              <div className={`mt-1 text-[11px] font-semibold ${county.leaderCode === 'R' ? 'text-red-300' : county.leaderCode === 'D' ? 'text-blue-300' : 'text-gray-300'}`}>
                {county.leaderCode === 'Tie' ? 'Tied race' : `${county.leaderCode}+${Math.abs(county.marginPct).toFixed(1)} pts`}
              </div>
              <div className="mt-1 text-[11px] text-amber-300">Flip risk: {Math.round(county.riskScore)}%</div>
            </li>
          )) : (
            <li className="rounded-lg border border-gray-800/60 bg-gray-900/60 p-3 text-xs text-gray-400">
              No high-risk counties identified.
            </li>
          )}
        </ul>
      </div>
    </div>
  )

  const renderAnalystTab = () => (
    <div className="space-y-4 text-xs text-gray-300">
      <div className="rounded-lg border border-gray-800/60 bg-gray-900/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Margin trend (last 5 min)</div>
        {hasHistory && baselineSnapshot ? (
          <div className="mt-1 text-sm font-semibold text-white">
            {`${marginDeltaPts >= 0 ? '+' : ''}${marginDeltaPts.toFixed(1)} pts`} ({marginDeltaVotes >= 0 ? '+' : ''}{formatNumber(marginDeltaVotes)} votes)
          </div>
        ) : (
          <div className="mt-1 text-gray-400">Not enough history yet.</div>
        )}
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Reporting velocity (last 5 min)</div>
        {hasHistory && baselineSnapshot ? (
          <div className="mt-1 space-y-1">
            <div>Counties: {reportingDelta >= 0 ? '+' : ''}{reportingDelta.toFixed(1)} pts</div>
            <div>Votes: {voteDelta >= 0 ? '+' : ''}{voteDelta.toFixed(1)} pts</div>
          </div>
        ) : (
          <div className="mt-1 text-gray-400">Waiting for timeline history.</div>
        )}
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Slow progress spotlight</div>
        <ul className="mt-2 space-y-2">
          {slowStates.length > 0 ? slowStates.map((state) => (
            <li key={state.label} className="flex items-baseline justify-between text-gray-300">
              <span className="font-semibold text-sm text-white">{state.label}</span>
              <span className="text-[11px] text-gray-400">{formatPercent(Math.min(Math.max(state.reportingPct, 0), 100))} reporting</span>
              <span className="text-[11px] text-amber-300">Remaining {formatNumber(state.remaining)}</span>
            </li>
          )) : (
            <li className="text-gray-400">No slowdowns detected right now.</li>
          )}
        </ul>
      </div>
    </div>
  )

  const handleTabChange = (tab: TabId) => setActiveTab(tab)

  return (
    <div className="mt-4 rounded-2xl border border-gray-800/70 bg-gray-900/70 p-4 text-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Insights</h3>
          <p className="text-[11px] text-gray-400">Scenario intelligence for analysts & campaigns</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-medium text-gray-400 transition hover:text-gray-200"
        >
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-4">
          <div className="inline-flex rounded-full border border-gray-800/60 bg-gray-950/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleTabChange('campaign')}
              className={`rounded-full px-3 py-1 font-semibold transition ${activeTab === 'campaign' ? 'bg-blue-500/60 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Campaign
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('analyst')}
              className={`rounded-full px-3 py-1 font-semibold transition ${activeTab === 'analyst' ? 'bg-emerald-500/60 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Analyst
            </button>
          </div>

          {activeTab === 'campaign' ? renderCampaignTab() : renderAnalystTab()}

          <div className="text-[11px] text-gray-500">
            Updated {formatNumber(currentTimeSeconds)}s into simulation • {history.length} snapshots stored
          </div>
        </div>
      )}
    </div>
  )
}

*/
