import React from 'react'
import { MetricTile } from './cards/MetricTile'
import type { SummaryData } from './types'

interface MetricRailProps {
  metrics: SummaryData['metrics']
}

export const MetricRail: React.FC<MetricRailProps> = ({ metrics }) => (
  <section className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {metrics.map((metric) => (
      <MetricTile key={metric.id} label={metric.label} value={metric.value} helper={metric.helper} trend={metric.trend} />
    ))}
  </section>
)

export default MetricRail
