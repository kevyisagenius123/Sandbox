/**
 * Demographic Breakdown Panel
 * 
 * Displays race, education, and age demographic voting patterns
 * synthesized from aggregate vote totals using similar counties algorithm
 */

import { useState } from 'react'
import type { DemographicSynthesisResponse, DemographicGroup } from '../../../services/demographicService'
import { formatDemographicPct, formatVoteCount } from '../../../services/demographicService'

interface DemographicBreakdownPanelProps {
  data: DemographicSynthesisResponse
  title?: string
}

type TabType = 'race' | 'education' | 'age'

export default function DemographicBreakdownPanel({ data, title }: DemographicBreakdownPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('race')

  const renderDemographicGroup = (label: string, group: DemographicGroup) => {
    const demMargin = group.dem_pct - group.gop_pct
    const leaderParty = demMargin > 0 ? 'DEM' : 'GOP'
    const leaderColor = demMargin > 0 ? 'text-blue-600' : 'text-red-600'
    
    return (
      <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{label}</h4>
          <span className={`text-sm font-bold ${leaderColor}`}>
            {leaderParty} +{Math.abs(demMargin).toFixed(1)}%
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Population Share</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatDemographicPct(group.population_pct)}
            </span>
          </div>
          
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            <div 
              className="bg-blue-500" 
              style={{ width: `${group.dem_pct}%` }}
              title={`DEM: ${formatDemographicPct(group.dem_pct)}`}
            />
            <div 
              className="bg-red-500" 
              style={{ width: `${group.gop_pct}%` }}
              title={`GOP: ${formatDemographicPct(group.gop_pct)}`}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-blue-600 dark:text-blue-400 font-semibold">DEM</div>
              <div className="text-gray-900 dark:text-gray-100">{formatDemographicPct(group.dem_pct)}</div>
              <div className="text-xs text-gray-500">{formatVoteCount(group.dem_votes)} votes</div>
            </div>
            <div>
              <div className="text-red-600 dark:text-red-400 font-semibold">GOP</div>
              <div className="text-gray-900 dark:text-gray-100">{formatDemographicPct(group.gop_pct)}</div>
              <div className="text-xs text-gray-500">{formatVoteCount(group.gop_votes)} votes</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderRaceBreakdown = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderDemographicGroup('White (Non-Hispanic)', data.race_breakdown.white_nh)}
        {renderDemographicGroup('Black (Non-Hispanic)', data.race_breakdown.black_nh)}
        {renderDemographicGroup('Asian (Non-Hispanic)', data.race_breakdown.asian_nh)}
        {renderDemographicGroup('Hispanic', data.race_breakdown.hispanic)}
      </div>
    )
  }

  const renderEducationBreakdown = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderDemographicGroup('High School or Less', data.education_breakdown.hs_or_less)}
        {renderDemographicGroup('Some College', data.education_breakdown.some_college)}
        {renderDemographicGroup('Bachelor\'s Degree+', data.education_breakdown.bachelors_plus)}
      </div>
    )
  }

  const renderAgeBreakdown = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderDemographicGroup('Under 30', data.age_breakdown.under_30)}
        {renderDemographicGroup('30-44', data.age_breakdown['30_44'])}
        {renderDemographicGroup('45-64', data.age_breakdown['45_64'])}
        {renderDemographicGroup('65+', data.age_breakdown['65_plus'])}
      </div>
    )
  }

  const tabs: { type: TabType; label: string }[] = [
    { type: 'race', label: 'Race & Ethnicity' },
    { type: 'education', label: 'Education' },
    { type: 'age', label: 'Age Groups' }
  ]

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title || 'Demographic Breakdown'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {data.baseline.county_name}, {data.baseline.state_name} • 
              Population: {formatVoteCount(data.baseline.population)} • 
              Validation: {data.validation_score.toFixed(1)}%
            </p>
          </div>
          {data.similar_counties.length > 0 && (
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              Based on {data.similar_counties.length} similar counties
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.type
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'race' && renderRaceBreakdown()}
        {activeTab === 'education' && renderEducationBreakdown()}
        {activeTab === 'age' && renderAgeBreakdown()}
      </div>

      {/* Footer - Similar Counties */}
      {data.similar_counties.length > 0 && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              Similar Counties Used ({data.similar_counties.length})
            </summary>
            <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {data.similar_counties.slice(0, 10).map((county, idx) => (
                <div key={county.fips} className="flex justify-between">
                  <span>{idx + 1}. {county.county_name}, {county.state_name}</span>
                  <span className="font-mono">{(county.similarity * 100).toFixed(1)}% match</span>
                </div>
              ))}
              {data.similar_counties.length > 10 && (
                <div className="text-gray-500 dark:text-gray-500 italic">
                  ...and {data.similar_counties.length - 10} more
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
