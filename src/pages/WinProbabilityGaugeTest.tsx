import React, { useState } from 'react'
import { WinProbabilityGauge } from '../components/sandbox/WinProbabilityGauge'
import type { AggregateResults } from '../components/sandbox/results-summary/types'

/**
 * Test page for WinProbabilityGauge component
 * 
 * This page allows manual testing of the gauge with different scenarios
 */
const WinProbabilityGaugeTest: React.FC = () => {
  // Test scenario state
  const [scenario, setScenario] = useState<'early-dem' | 'early-gop' | 'mid-dem' | 'mid-gop' | 'late-dem' | 'late-gop' | 'tight' | 'custom'>('early-dem')
  
  // Custom controls
  const [demVotes, setDemVotes] = useState(1200)
  const [gopVotes, setGopVotes] = useState(1000)
  const [reportingPercent, setReportingPercent] = useState(10)

  // Predefined test scenarios
  const scenarios: Record<string, AggregateResults> = {
    'early-dem': {
      totalDem: 1200,
      totalGop: 1000,
      totalOther: 0,
      totalVotes: 2200,
      demPercent: 54.55,
      gopPercent: 45.45,
      otherPercent: 0,
      votesRemaining: 97800,
      expectedTotalVotes: 100000,
      reportingPercent: 2.2,
      voteReportingPercent: 2.2,
      voteMarginAbsolute: -200, // DEM leading
      voteMarginPercent: -9.09,
      leader: 'DEM',
      winProbability: 54.55,
      countiesReporting: 5,
      totalCounties: 100,
      fullyReported: 0,
      inProgress: 5,
      notStarted: 95,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'early-gop': {
      totalDem: 1000,
      totalGop: 1200,
      totalOther: 0,
      totalVotes: 2200,
      demPercent: 45.45,
      gopPercent: 54.55,
      otherPercent: 0,
      votesRemaining: 97800,
      expectedTotalVotes: 100000,
      reportingPercent: 2.2,
      voteReportingPercent: 2.2,
      voteMarginAbsolute: 200, // GOP leading
      voteMarginPercent: 9.09,
      leader: 'GOP',
      winProbability: 54.55,
      countiesReporting: 5,
      totalCounties: 100,
      fullyReported: 0,
      inProgress: 5,
      notStarted: 95,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'mid-dem': {
      totalDem: 27500,
      totalGop: 22500,
      totalOther: 0,
      totalVotes: 50000,
      demPercent: 55,
      gopPercent: 45,
      otherPercent: 0,
      votesRemaining: 50000,
      expectedTotalVotes: 100000,
      reportingPercent: 50,
      voteReportingPercent: 50,
      voteMarginAbsolute: -5000,
      voteMarginPercent: -10,
      leader: 'DEM',
      winProbability: 55,
      countiesReporting: 50,
      totalCounties: 100,
      fullyReported: 25,
      inProgress: 25,
      notStarted: 50,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'mid-gop': {
      totalDem: 22500,
      totalGop: 27500,
      totalOther: 0,
      totalVotes: 50000,
      demPercent: 45,
      gopPercent: 55,
      otherPercent: 0,
      votesRemaining: 50000,
      expectedTotalVotes: 100000,
      reportingPercent: 50,
      voteReportingPercent: 50,
      voteMarginAbsolute: 5000,
      voteMarginPercent: 10,
      leader: 'GOP',
      winProbability: 55,
      countiesReporting: 50,
      totalCounties: 100,
      fullyReported: 25,
      inProgress: 25,
      notStarted: 50,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'late-dem': {
      totalDem: 49000,
      totalGop: 46000,
      totalOther: 0,
      totalVotes: 95000,
      demPercent: 51.58,
      gopPercent: 48.42,
      otherPercent: 0,
      votesRemaining: 5000,
      expectedTotalVotes: 100000,
      reportingPercent: 95,
      voteReportingPercent: 95,
      voteMarginAbsolute: -3000,
      voteMarginPercent: -3.16,
      leader: 'DEM',
      winProbability: 51.58,
      countiesReporting: 95,
      totalCounties: 100,
      fullyReported: 90,
      inProgress: 5,
      notStarted: 5,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'late-gop': {
      totalDem: 46000,
      totalGop: 49000,
      totalOther: 0,
      totalVotes: 95000,
      demPercent: 48.42,
      gopPercent: 51.58,
      otherPercent: 0,
      votesRemaining: 5000,
      expectedTotalVotes: 100000,
      reportingPercent: 95,
      voteReportingPercent: 95,
      voteMarginAbsolute: 3000,
      voteMarginPercent: 3.16,
      leader: 'GOP',
      winProbability: 51.58,
      countiesReporting: 95,
      totalCounties: 100,
      fullyReported: 90,
      inProgress: 5,
      notStarted: 5,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    },
    'tight': {
      totalDem: 47500,
      totalGop: 47500,
      totalOther: 0,
      totalVotes: 95000,
      demPercent: 50,
      gopPercent: 50,
      otherPercent: 0,
      votesRemaining: 5000,
      expectedTotalVotes: 100000,
      reportingPercent: 95,
      voteReportingPercent: 95,
      voteMarginAbsolute: 0,
      voteMarginPercent: 0,
      leader: 'TIE',
      winProbability: 50,
      countiesReporting: 95,
      totalCounties: 100,
      fullyReported: 90,
      inProgress: 5,
      notStarted: 5,
      reportingEtaSeconds: null,
      voteEtaSeconds: null
    }
  }

  // Build aggregate results from custom or scenario
  const buildAggregates = (): AggregateResults => {
    if (scenario === 'custom') {
      const total = demVotes + gopVotes
      const expectedTotal = Math.max(total, 100000)
      const votesRemaining = expectedTotal - total
      const margin = demVotes - gopVotes
      const demPct = (demVotes / total) * 100
      const gopPct = (gopVotes / total) * 100
      
      return {
        totalDem: demVotes,
        totalGop: gopVotes,
        totalOther: 0,
        totalVotes: total,
        demPercent: demPct,
        gopPercent: gopPct,
        otherPercent: 0,
        votesRemaining,
        expectedTotalVotes: expectedTotal,
        reportingPercent,
        voteReportingPercent: reportingPercent,
        voteMarginAbsolute: -margin, // Negative for DEM lead
        voteMarginPercent: (margin / total) * 100,
        leader: margin > 0 ? 'DEM' : margin < 0 ? 'GOP' : 'TIE',
        winProbability: Math.max(demPct, gopPct),
        countiesReporting: Math.floor(reportingPercent),
        totalCounties: 100,
        fullyReported: Math.floor(reportingPercent * 0.8),
        inProgress: Math.floor(reportingPercent * 0.2),
        notStarted: 100 - Math.floor(reportingPercent),
        voteEtaSeconds: null,
        reportingEtaSeconds: null
      }
    }
    
    return scenarios[scenario]
  }

  const aggregates = buildAggregates()

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">Win Probability Gauge Test</h1>
          <p className="mt-2 text-sm text-slate-400">
            Test the WinProbabilityGauge component with different vote scenarios
          </p>
        </header>

        {/* Scenario Selector */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Select Test Scenario</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.keys(scenarios).map((key) => (
              <button
                key={key}
                onClick={() => setScenario(key as any)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  scenario === key
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                {key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
            <button
              onClick={() => setScenario('custom')}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                scenario === 'custom'
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              Custom
            </button>
          </div>
        </section>

        {/* Custom Controls (if custom scenario selected) */}
        {scenario === 'custom' && (
          <section className="rounded-lg border border-purple-800/50 bg-purple-950/20 p-6">
            <h2 className="mb-4 text-lg font-semibold text-purple-200">Custom Scenario Controls</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Democratic Votes</label>
                <input
                  type="number"
                  value={demVotes}
                  onChange={(e) => setDemVotes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Republican Votes</label>
                <input
                  type="number"
                  value={gopVotes}
                  onChange={(e) => setGopVotes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Reporting %</label>
                <input
                  type="number"
                  value={reportingPercent}
                  onChange={(e) => setReportingPercent(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </section>
        )}

        {/* Current Data Display */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Current Aggregate Data</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-blue-950/30 p-4">
              <div className="text-xs text-blue-400">Democratic Votes</div>
              <div className="mt-1 text-2xl font-bold text-blue-300">{aggregates.totalDem.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-red-950/30 p-4">
              <div className="text-xs text-red-400">Republican Votes</div>
              <div className="mt-1 text-2xl font-bold text-red-300">{aggregates.totalGop.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-4">
              <div className="text-xs text-slate-400">Margin</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {aggregates.voteMarginAbsolute > 0 ? '+' : ''}{aggregates.voteMarginAbsolute.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                {aggregates.voteMarginPercent > 0 ? '+' : ''}{aggregates.voteMarginPercent.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-4">
              <div className="text-xs text-slate-400">Reporting</div>
              <div className="mt-1 text-2xl font-bold text-white">{aggregates.reportingPercent.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">
                {aggregates.votesRemaining.toLocaleString()} votes left
              </div>
            </div>
          </div>
        </section>

        {/* Gauge Display */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Win Probability Gauge</h2>
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <WinProbabilityGauge aggregates={aggregates} height={300} />
            </div>
          </div>
        </section>

        {/* Debug Info */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Debug Information</h2>
          <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">
            {JSON.stringify(aggregates, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  )
}

export default WinProbabilityGaugeTest
