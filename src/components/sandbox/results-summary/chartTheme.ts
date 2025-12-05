/**
 * Centralized ECharts theme configuration for Results Summary charts
 * Provides consistent styling across all analytical visualizations
 */

export const chartTheme = {
  // Party color palette (matching existing components)
  partyColors: {
    republican: '#dc2626', // red-600
    democratic: '#3b82f6', // blue-500
    other: '#94a3b8', // slate-400
  },

  // Gradient variants for area charts and backgrounds
  gradients: {
    republicanArea: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: 'rgba(220, 38, 38, 0.3)' },
        { offset: 1, color: 'rgba(220, 38, 38, 0.05)' },
      ],
    },
    democraticArea: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
        { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
      ],
    },
    neutralArea: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: 'rgba(148, 163, 184, 0.3)' },
        { offset: 1, color: 'rgba(148, 163, 184, 0.05)' },
      ],
    },
  },

  // Axis styling (consistent with existing designs)
  axisStyle: {
    axisLine: {
      lineStyle: { color: '#e2e8f0', width: 1 },
    },
    axisTick: {
      lineStyle: { color: '#e2e8f0' },
    },
    axisLabel: {
      color: '#64748b',
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    splitLine: {
      lineStyle: { color: '#f1f5f9', type: 'dashed' as const },
    },
  },

  // Grid configuration
  gridStyle: {
    left: '5%',
    right: '5%',
    top: '15%',
    bottom: '10%',
    containLabel: true,
  },

  // Legend styling
  legendStyle: {
    textStyle: {
      color: '#64748b',
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    icon: 'circle' as const,
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
  },

  // Tooltip styling
  tooltipStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    textStyle: {
      color: '#1e293b',
      fontSize: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    padding: [8, 12],
    extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);',
  },

  // Animation configuration
  animationConfig: {
    animation: true,
    animationDuration: 750,
    animationEasing: 'cubicOut' as const,
  },

  // Color palettes for various use cases
  colorPalettes: {
    // Diverging palette for margins (blue-gray-red)
    margin: [
      '#1e40af', // blue-800 (strong Dem)
      '#3b82f6', // blue-500 (Dem)
      '#93c5fd', // blue-300 (lean Dem)
      '#e2e8f0', // slate-200 (neutral)
      '#fca5a5', // red-300 (lean GOP)
      '#ef4444', // red-500 (GOP)
      '#991b1b', // red-800 (strong GOP)
    ],

    // Sequential palette for intensity metrics (reporting %, turnout, etc.)
    sequential: [
      '#f8fafc', // slate-50
      '#e2e8f0', // slate-200
      '#cbd5e1', // slate-300
      '#94a3b8', // slate-400
      '#64748b', // slate-500
      '#475569', // slate-600
      '#334155', // slate-700
    ],

    // Categorical palette for multiple series
    categorical: [
      '#3b82f6', // blue-500 (Democratic)
      '#dc2626', // red-600 (Republican)
      '#94a3b8', // slate-400 (Other)
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#f59e0b', // amber-500
      '#10b981', // emerald-500
    ],

    // Heat intensity (for heatmaps)
    heat: [
      '#f0f9ff', // blue-50
      '#bfdbfe', // blue-200
      '#60a5fa', // blue-400
      '#2563eb', // blue-600
      '#1e3a8a', // blue-900
    ],
  },

  // Reporting status colors
  reportingColors: {
    complete: '#10b981', // emerald-500
    inProgress: '#f59e0b', // amber-500
    notStarted: '#94a3b8', // slate-400
  },

  // Competitiveness/uncertainty colors
  competitivenessColors: {
    safe: '#6b7280', // gray-500 (not competitive)
    lean: '#f59e0b', // amber-500 (somewhat competitive)
    tossup: '#dc2626', // red-600 (highly competitive)
  },
}

/**
 * Helper function to get margin color based on value
 * @param margin - Margin percentage (-100 to 100, negative = Dem lead, positive = GOP lead)
 * @returns Color string
 */
export function getMarginColor(margin: number): string {
  const palette = chartTheme.colorPalettes.margin
  if (margin <= -10) return palette[0] // Strong Dem
  if (margin <= -3) return palette[1] // Dem
  if (margin < 0) return palette[2] // Lean Dem
  if (margin === 0) return palette[3] // Tie
  if (margin < 3) return palette[4] // Lean GOP
  if (margin < 10) return palette[5] // GOP
  return palette[6] // Strong GOP
}

/**
 * Helper function to get reporting status color
 * @param reportingPercent - Reporting percentage (0-100)
 * @returns Color string
 */
export function getReportingColor(reportingPercent: number): string {
  if (reportingPercent >= 100) return chartTheme.reportingColors.complete
  if (reportingPercent > 0) return chartTheme.reportingColors.inProgress
  return chartTheme.reportingColors.notStarted
}

/**
 * Helper function to create gradient color stops for area charts
 * @param party - 'republican' | 'democratic' | 'other'
 * @returns ECharts gradient configuration
 */
export function getPartyGradient(party: 'republican' | 'democratic' | 'other') {
  switch (party) {
    case 'republican':
      return chartTheme.gradients.republicanArea
    case 'democratic':
      return chartTheme.gradients.democraticArea
    default:
      return chartTheme.gradients.neutralArea
  }
}
