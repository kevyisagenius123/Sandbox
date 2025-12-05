import React, { lazy, Suspense, useState, memo } from 'react'
import { HeroStrip } from './results-summary/HeroStrip'
import { MetricRail } from './results-summary/MetricRail'
import VoteShareChart3D from './results-summary/VoteShareChart3D'
import { StateLeaderboard } from './results-summary/StateLeaderboard'
import { WinProbabilityGauge } from './WinProbabilityGauge'
import CountyReportingTreemap from './results-summary/CountyReportingTreemap'
import OutstandingVotesChart from './results-summary/OutstandingVotesChart'
import HistoricalComparisonChart from './results-summary/HistoricalComparisonChart'
import { useResultsSummaryData } from './results-summary/useResultsSummaryData'
import type { ResultsSummaryProps } from './results-summary/types'
import { formatNumber, formatPercent, formatDuration } from './results-summary/formatters'

const Results3DPanel = lazy(() => import('./Results3DPanel'))

const ResultsSummaryComponent: React.FC<ResultsSummaryProps> = (props) => {
  const [viewMode, setViewMode] = useState<'analytics' | 'immersive'>('analytics')
  const data = useResultsSummaryData(props)
  
  // Destructure for convenience
  const {
    aggregates,
    metrics,
    leaderboard,
    voteShareSeries,
    outstandingVotesByState,
    countyTreemapNodes,
    mlWinProbability,
    narrativeInsights,
    historicalMatchData
  } = data

  const inferredEta = aggregates.voteEtaSeconds ?? aggregates.reportingEtaSeconds
  const reportingVelocityPerMinute = props.elapsedSeconds && props.elapsedSeconds > 0
    ? (aggregates.reportingPercent / Math.max(props.elapsedSeconds, 1)) * 60
    : 0

  return (
    <section className="rounded-xl border border-slate-800/50 bg-slate-950/60 p-5 text-slate-200">
      <div className="flex items-center justify-between gap-4">
        <HeroStrip
          aggregates={aggregates}
          elapsedSeconds={props.elapsedSeconds ?? 0}
          isPlaying={props.isPlaying ?? false}
        />
        <button
          type="button"
          onClick={() => setViewMode((mode) => (mode === 'analytics' ? 'immersive' : 'analytics'))}
          className="shrink-0 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
          aria-pressed={viewMode === 'immersive'}
        >
          {viewMode === 'analytics' ? '3D View' : 'Dashboard'}
        </button>
      </div>

      {viewMode === 'analytics' ? (
        <div className="mt-5 space-y-5">
          <MetricRail metrics={metrics} />

          {/* Python Analytics: Narrative Insights */}
          {narrativeInsights && (
            <article className="rounded-lg border border-emerald-800/30 bg-gradient-to-br from-emerald-950/20 to-slate-950/40 p-5">
              <header className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h2 className="text-base font-semibold text-emerald-100">{narrativeInsights.headline}</h2>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      AI-Generated Analysis
                    </span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${
                      narrativeInsights.sentiment === 'tight' 
                        ? 'text-amber-400' 
                        : narrativeInsights.sentiment === 'comfortable_dem'
                        ? 'text-blue-400'
                        : 'text-red-400'
                    }`}>
                      {narrativeInsights.sentiment === 'tight' && '⚡ Tight Race'}
                      {narrativeInsights.sentiment === 'comfortable_dem' && '🔵 DEM Comfortable'}
                      {narrativeInsights.sentiment === 'comfortable_gop' && '🔴 GOP Comfortable'}
                    </span>
                  </div>
                </div>
              </header>
              
              <div className="mt-4 space-y-3">
                <ul className="space-y-2">
                  {narrativeInsights.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                        {idx + 1}
                      </span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
                
                <p className="mt-3 border-t border-emerald-900/30 pt-3 text-xs leading-relaxed text-slate-400">
                  {narrativeInsights.detailedAnalysis}
                </p>
              </div>
            </article>
          )}

          {/* Python Analytics: ML Win Probability */}
          {mlWinProbability && (
            <article className="rounded-lg border border-violet-800/30 bg-gradient-to-br from-violet-950/20 to-slate-950/40 p-5">
              <header className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-violet-100">ML Win Probability</h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                      {mlWinProbability.method.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {mlWinProbability.featuresUsed.length} features
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    mlWinProbability.leader === 'DEM' ? 'text-blue-400' :
                    mlWinProbability.leader === 'GOP' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {mlWinProbability.probability.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    CI: {mlWinProbability.confidenceInterval[0].toFixed(1)}% - {mlWinProbability.confidenceInterval[1].toFixed(1)}%
                  </div>
                </div>
              </header>

              <div className="mt-4">
                <div className="relative h-3 overflow-hidden rounded-full bg-slate-900/60">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      mlWinProbability.leader === 'DEM' ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                      mlWinProbability.leader === 'GOP' ? 'bg-gradient-to-r from-red-600 to-red-400' :
                      'bg-gradient-to-r from-slate-600 to-slate-400'
                    }`}
                    style={{ width: `${mlWinProbability.probability}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>0%</span>
                  <span className="text-violet-400">
                    {mlWinProbability.leader} Win Probability
                  </span>
                  <span>100%</span>
                </div>
              </div>

              <p className="mt-3 border-t border-violet-900/30 pt-3 text-[10px] leading-relaxed text-slate-500">
                Enhanced prediction using machine learning ensemble (XGBoost + Logistic Regression). 
                Analyzes {mlWinProbability.featuresUsed.length} features including margin, reporting progress, 
                key county performance, and outstanding vote patterns.
              </p>
            </article>
          )}

          {/* Python Analytics: Historical Comparison */}
          <HistoricalComparisonChart 
            historicalData={historicalMatchData}
            currentMargin={aggregates.voteMarginPercent}
          />

          {/* Phase 1: Outstanding Votes & County Treemap */}
          <div className="grid gap-5 lg:grid-cols-2">
            {outstandingVotesByState.length > 0 && (
              <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                <header className="mb-3">
                  <h3 className="text-xs font-semibold text-slate-400">Outstanding Votes by State</h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Estimated lean based on current patterns
                  </p>
                </header>
                <OutstandingVotesChart
                  byState={outstandingVotesByState}
                  height={320}
                  topN={10}
                />
              </article>
            )}

            {countyTreemapNodes.length > 0 && (
              <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                <header className="mb-3">
                  <h3 className="text-xs font-semibold text-slate-400">County Reporting Status</h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Size = votes, color = reporting %, ⭐ = key county
                  </p>
                </header>
                <CountyReportingTreemap
                  counties={countyTreemapNodes}
                  height={320}
                />
              </article>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                <header className="mb-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Vote Share</span>
                  <span>{formatPercent(aggregates.voteReportingPercent)} reported</span>
                </header>
                <VoteShareChart3D series={voteShareSeries} />
              </article>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                  <h3 className="text-xs font-semibold text-slate-400">Reporting Status</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Complete</dt>
                      <dd className="text-lg font-semibold text-emerald-400">{formatNumber(aggregates.fullyReported)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">In Progress</dt>
                      <dd className="text-lg font-semibold text-amber-300">{formatNumber(aggregates.inProgress)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Not Started</dt>
                      <dd className="text-lg font-semibold text-slate-400">{formatNumber(aggregates.notStarted)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Total Counties</dt>
                      <dd className="text-lg font-semibold text-slate-200">
                        {formatNumber(aggregates.countiesReporting)} / {formatNumber(aggregates.totalCounties)}
                      </dd>
                    </div>
                  </dl>
                </article>

                <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                  <h3 className="text-xs font-semibold text-slate-400">Race Metrics</h3>
                  <dl className="mt-3 space-y-2.5 text-sm">
                    <div className="flex items-baseline justify-between">
                      <dt className="text-xs text-slate-500">Outstanding Votes</dt>
                      <dd className="font-semibold text-slate-200">{formatNumber(aggregates.votesRemaining)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-xs text-slate-500">Current Margin</dt>
                      <dd className="font-semibold text-slate-200">
                        {aggregates.voteMarginAbsolute >= 0 ? 'R+' : 'D+'}{Math.abs(aggregates.voteMarginAbsolute).toLocaleString('en-US')}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-xs text-slate-500">Est. Completion</dt>
                      <dd className="font-semibold text-slate-200">{formatDuration(inferredEta)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-xs text-slate-500">Reporting Velocity</dt>
                      <dd className="font-semibold text-slate-200">{formatPercent(reportingVelocityPerMinute, 1)}/min</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>

            <aside className="space-y-4">
              <StateLeaderboard rows={leaderboard} />
              <article className="rounded-lg border border-slate-800/50 bg-slate-950/40 p-4">
                <h3 className="mb-2 text-xs font-semibold text-slate-400">Win Probability</h3>
                <WinProbabilityGauge aggregates={aggregates} height={200} />
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Heuristic estimate based on current margin and outstanding ballots. Center = tie, left = DEM, right = GOP.
                </p>
              </article>
            </aside>
          </div>
        </div>
      ) : (
        <div className="mt-5 h-[520px] w-full overflow-hidden rounded-lg border border-slate-800/50 bg-slate-950/40">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D visualization…</div>}>
            <Results3DPanel
              countyStates={props.countyStates}
              countyResults={props.countyResults}
              width="100%"
              height="100%"
            />
          </Suspense>
        </div>
      )}
    </section>
  )
}

export const ResultsSummary = memo(ResultsSummaryComponent)

export default ResultsSummary
