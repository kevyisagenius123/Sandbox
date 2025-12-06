import React, { useState } from 'react'
import { BabylonBallotChart } from '../components/sandbox/analytics/BabylonBallotChart'
import { BabylonWinProbabilityGauge } from '../components/sandbox/analytics/BabylonWinProbabilityGauge'
import { BabylonBallotDrop } from '../components/sandbox/analytics/BabylonBallotDrop'
import type { CountySimulationState } from '../types/sandbox'
import type { AggregateResults } from '../components/sandbox/results-summary/types'

export const AnalyticsTestPage: React.FC = () => {
  // Mock Data
  const [margin, setMargin] = useState(5000)
  const [totalVotes, setTotalVotes] = useState(100000)
  const [votesRemaining, setVotesRemaining] = useState(20000)

  const mockAggregates: AggregateResults = {
    totalDem: (totalVotes - margin) / 2,
    totalGop: (totalVotes + margin) / 2,
    totalOther: 0,
    totalVotes: totalVotes,
    demPercent: ((totalVotes - margin) / 2 / totalVotes) * 100,
    gopPercent: ((totalVotes + margin) / 2 / totalVotes) * 100,
    otherPercent: 0,
    reportingPercent: 80,
    voteReportingPercent: 80,
    expectedTotalVotes: totalVotes + votesRemaining,
    votesRemaining: votesRemaining,
    countiesReporting: 50,
    totalCounties: 67,
    fullyReported: 40,
    inProgress: 10,
    notStarted: 17,
    voteMarginPercent: (margin / totalVotes) * 100,
    voteMarginAbsolute: margin,
    leader: margin > 0 ? 'GOP' : margin < 0 ? 'DEM' : 'TIE',
    winProbability: 0, // Calculated by component
    reportingEtaSeconds: null,
    voteEtaSeconds: null
  }

  // @ts-ignore - mock object for testing
  const mockCountyState: CountySimulationState = {
    currentDemVotes: 45000,
    currentGopVotes: 55000,
    currentOtherVotes: 0,
    currentTotalVotes: 100000,
    currentReportingPercent: 100,
    isFullyReported: true
  }

  const mockCountyStates = new Map<string, CountySimulationState>()
  mockCountyStates.set('42003', mockCountyState) // Allegheny (mock)

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-2xl font-bold mb-8">Babylon Analytics Test Lab</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Win Probability Gauge Test */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-300">Win Probability Gauge (Babylon)</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 h-[400px]">
            <BabylonWinProbabilityGauge aggregates={mockAggregates} />
          </div>
          
          {/* Controls */}
          <div className="bg-slate-900 p-4 rounded-lg space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Vote Margin (Positive = GOP, Negative = DEM)</label>
              <input 
                type="range" 
                min="-50000" 
                max="50000" 
                value={margin} 
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm">{margin.toLocaleString()} votes</div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Votes Remaining</label>
              <input 
                type="range" 
                min="0" 
                max="100000" 
                value={votesRemaining} 
                onChange={(e) => setVotesRemaining(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm">{votesRemaining.toLocaleString()} votes</div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Total Votes (Scale)</label>
              <input 
                type="range" 
                min="10000" 
                max="200000" 
                step="10000"
                value={totalVotes} 
                onChange={(e) => setTotalVotes(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm">{totalVotes.toLocaleString()} votes</div>
            </div>
          </div>
        </div>

        {/* Ballot Chart Test */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-300">Ballot Type Chart (Babylon)</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 h-[400px]">
            <BabylonBallotChart 
              countyStates={mockCountyStates} 
              selectedCountyFips="42003" 
            />
          </div>
          <p className="text-sm text-slate-400">
            Visualizing mock county "42003" with 100k votes.
          </p>
        </div>

        {/* Ballot Drop Physics Test */}
        <div className="space-y-4 col-span-1 lg:col-span-2">
          <h2 className="text-xl font-semibold text-slate-300">Ballot Drop Physics (Babylon)</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 h-[500px]">
            <BabylonBallotDrop aggregates={mockAggregates} />
          </div>
          <p className="text-sm text-slate-400">
            Physics simulation of votes filling containers.
          </p>
        </div>

      </div>
    </div>
  )
}
