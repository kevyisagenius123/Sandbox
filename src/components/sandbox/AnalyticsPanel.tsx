// Analytics Panel - Real-time charts and export options
import React, { useMemo } from 'react'
import type { CountyResult, ReportingConfig } from '../../types/sandbox'

interface AnalyticsPanelProps {
  countyResults: CountyResult[]
  countyStates: Map<string, {
    fips: string
    currentReportingPercent: number
    currentDemVotes: number
    currentGopVotes: number
    currentTotalVotes: number
    isFullyReported: boolean
  }>
  currentTimeSeconds: number
  isOpen: boolean
  reportingConfig?: ReportingConfig
  onToggle: () => void
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  countyResults,
  countyStates,
  currentTimeSeconds,
  isOpen,
  reportingConfig,
  onToggle
}) => {
  // Compute current national totals
  const nationalTotals = useMemo(() => {
    let demTotal = 0
    let gopTotal = 0
    let otherTotal = 0
    let reportedCounties = 0
    
    countyStates.forEach(state => {
      if (state.currentTotalVotes > 0) {
        demTotal += state.currentDemVotes
        gopTotal += state.currentGopVotes
        otherTotal += state.currentTotalVotes - state.currentDemVotes - state.currentGopVotes
        if (state.currentReportingPercent > 0) reportedCounties++
      }
    })
    
    const total = demTotal + gopTotal + otherTotal
    const demPct = total > 0 ? (demTotal / total) * 100 : 0
    const gopPct = total > 0 ? (gopTotal / total) * 100 : 0
    const otherPct = total > 0 ? (otherTotal / total) * 100 : 0
    const reportingPct = countyResults.length > 0 ? (reportedCounties / countyResults.length) * 100 : 0
    
    return {
      demVotes: demTotal,
      gopVotes: gopTotal,
      otherVotes: otherTotal,
      totalVotes: total,
      demPct,
      gopPct,
      otherPct,
      reportingPct,
      reportedCounties,
      totalCounties: countyResults.length
    }
  }, [countyStates, countyResults])

  // Export current state as CSV
  const exportCurrentStateCSV = () => {
    const headers = ['fips', 'state', 'county', 'dem_votes', 'gop_votes', 'other_votes', 'total_votes', 'reporting_pct', 'margin_pct']
    const rows: string[][] = [headers]
    
    countyResults.forEach(county => {
      const state = countyStates.get(county.fips.padStart(5, '0'))
      if (!state) return
      
      const otherVotes = state.currentTotalVotes - state.currentDemVotes - state.currentGopVotes
      const margin = state.currentTotalVotes > 0 
        ? ((state.currentGopVotes - state.currentDemVotes) / state.currentTotalVotes) * 100 
        : 0
      
      rows.push([
        county.fips,
        county.state || '',
        county.county || '',
        state.currentDemVotes.toString(),
        state.currentGopVotes.toString(),
        otherVotes.toString(),
        state.currentTotalVotes.toString(),
        state.currentReportingPercent.toFixed(2),
        margin.toFixed(2)
      ])
    })
    
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sandbox_results_${Math.floor(currentTimeSeconds)}s.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export full scenario as JSON
  const exportScenarioJSON = () => {
    const scenario = {
      metadata: {
        exportedAt: new Date().toISOString(),
        simulationTime: currentTimeSeconds,
        totalCounties: countyResults.length,
        hasCustomReportingConfig: Boolean(reportingConfig)
      },
      countyResults: countyResults.map(c => ({
        fips: c.fips,
        state: c.state,
        county: c.county,
        gopVotes: c.gopVotes,
        demVotes: c.demVotes,
        otherVotes: c.otherVotes || 0,
        totalVotes: c.totalVotes
      })),
      currentState: Array.from(countyStates.entries()).map(([fips, state]) => ({
        fips,
        currentReportingPercent: state.currentReportingPercent,
        currentDemVotes: state.currentDemVotes,
        currentGopVotes: state.currentGopVotes,
        currentTotalVotes: state.currentTotalVotes
      })),
      reporting: {
        config: reportingConfig ?? null
      }
    }
    
    const json = JSON.stringify(scenario, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sandbox_scenario_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors text-left text-sm font-semibold"
      >
        Analytics & Export
      </button>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 border-b border-gray-700 transition-colors text-left flex items-center justify-between"
      >
        <span className="text-sm font-semibold">Analytics & Export</span>
        <span className="text-xs uppercase tracking-wide text-gray-400">Collapse</span>
      </button>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* National Vote Share */}
        <div>
          <h4 className="text-xs font-semibold text-gray-300 mb-2">National Vote Share</h4>
          <div className="space-y-2">
            {/* Visual bar */}
            <div className="h-8 rounded-lg overflow-hidden flex">
              <div 
                className="bg-blue-500 flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${nationalTotals.demPct}%` }}
              >
                {nationalTotals.demPct > 15 && `${nationalTotals.demPct.toFixed(1)}%`}
              </div>
              <div 
                className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${nationalTotals.gopPct}%` }}
              >
                {nationalTotals.gopPct > 15 && `${nationalTotals.gopPct.toFixed(1)}%`}
              </div>
              <div 
                className="bg-gray-500 flex items-center justify-center text-white text-xs font-semibold"
                style={{ width: `${nationalTotals.otherPct}%` }}
              >
                {nationalTotals.otherPct > 10 && `${nationalTotals.otherPct.toFixed(1)}%`}
              </div>
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="font-semibold">DEM</span>
                </div>
                <div className="text-gray-400">{nationalTotals.demVotes.toLocaleString()} votes</div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="font-semibold">GOP</span>
                </div>
                <div className="text-gray-400">{nationalTotals.gopVotes.toLocaleString()} votes</div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="w-3 h-3 bg-gray-500 rounded"></div>
                  <span className="font-semibold">Other</span>
                </div>
                <div className="text-gray-400">{nationalTotals.otherVotes.toLocaleString()} votes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reporting Progress */}
        <div>
          <h4 className="text-xs font-semibold text-gray-300 mb-2">Reporting Progress</h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Counties Reporting</span>
              <span className="font-semibold">{nationalTotals.reportedCounties} / {nationalTotals.totalCounties}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${nationalTotals.reportingPct}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-400">
              {nationalTotals.reportingPct.toFixed(1)}% complete
            </div>
          </div>
        </div>

        {/* Margin Summary */}
        <div>
          <h4 className="text-xs font-semibold text-gray-300 mb-2">Current Margin</h4>
          <div className="bg-gray-900 rounded-lg p-3">
            {nationalTotals.totalVotes > 0 ? (
              <>
                <div className="text-2xl font-bold mb-1">
                  {nationalTotals.gopVotes > nationalTotals.demVotes ? (
                    <span className="text-red-400">R +{((nationalTotals.gopVotes - nationalTotals.demVotes) / nationalTotals.totalVotes * 100).toFixed(2)}%</span>
                  ) : nationalTotals.demVotes > nationalTotals.gopVotes ? (
                    <span className="text-blue-400">D +{((nationalTotals.demVotes - nationalTotals.gopVotes) / nationalTotals.totalVotes * 100).toFixed(2)}%</span>
                  ) : (
                    <span className="text-gray-400">Tied</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {Math.abs(nationalTotals.gopVotes - nationalTotals.demVotes).toLocaleString()} vote difference
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No votes reported yet</div>
            )}
          </div>
        </div>

        {/* Export Options */}
        <div>
          <h4 className="text-xs font-semibold text-gray-300 mb-2">Export Options</h4>
          <div className="space-y-2">
            <button
              onClick={exportCurrentStateCSV}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              disabled={countyResults.length === 0}
            >
              <span>Export Current State (CSV)</span>
            </button>
            <button
              onClick={exportScenarioJSON}
              className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              disabled={countyResults.length === 0}
            >
              <span>Export Scenario (JSON)</span>
            </button>
            <div className="text-xs text-gray-500 text-center pt-1">
              CSV: Current vote totals at {Math.floor(currentTimeSeconds / 60)}:{(currentTimeSeconds % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="pt-2 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-gray-300 mb-2">Statistics</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-900 rounded p-2">
              <div className="text-gray-400">Avg Turnout</div>
              <div className="font-semibold text-lg">
                {countyResults.length > 0 
                  ? (Array.from(countyStates.values()).reduce((sum, s) => sum + s.currentTotalVotes, 0) / countyResults.length).toFixed(0)
                  : '0'
                }
              </div>
            </div>
            <div className="bg-gray-900 rounded p-2">
              <div className="text-gray-400">Simulation Time</div>
              <div className="font-semibold text-lg">
                {Math.floor(currentTimeSeconds / 3600)}h {Math.floor((currentTimeSeconds % 3600) / 60)}m
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPanel
