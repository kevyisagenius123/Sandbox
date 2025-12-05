import { useMemo } from 'react'
import { ColumnLayer } from '@deck.gl/layers'
import type { CountySimulationState } from '../../../types/sandbox'
import type { Feature, Point } from 'geojson'

export type VoteBarChartLayerProps = {
  countyStates: Map<string, CountySimulationState>
  geojsonFeatures: Feature<Point>[] // County centroids with FIPS in properties
  visible: boolean
  heightScale?: number // Scale factor for bar heights
  radiusScale?: number // Scale factor for bar widths
}

export function useVoteBarChartLayer({
  countyStates,
  geojsonFeatures,
  visible,
  heightScale = 0.1,
  radiusScale = 5000
}: VoteBarChartLayerProps) {
  const layer = useMemo(() => {
    if (!visible || !geojsonFeatures.length) {
      return null
    }

    // Build data for each county bar
    const barData = geojsonFeatures
      .map((feature) => {
        const fips = feature.properties?.FIPS || feature.properties?.fips
        if (!fips) return null

        const state = countyStates.get(fips)
        if (!state || !state.currentTotalVotes) return null

        const coordinates = feature.geometry.coordinates
        const demVotes = state.currentDemVotes || 0
        const gopVotes = state.currentGopVotes || 0
        const totalVotes = state.currentTotalVotes || 0
        
        // Calculate margin for color (-1 to +1, DEM negative, GOP positive)
        const margin = totalVotes > 0 ? (gopVotes - demVotes) / totalVotes : 0

        return {
          position: [coordinates[0], coordinates[1]] as [number, number],
          fips,
          demVotes,
          gopVotes,
          totalVotes,
          margin,
          reportingPercent: state.currentReportingPercent || 0
        }
      })
      .filter((item) => item !== null)

    return new ColumnLayer({
      id: 'vote-bar-chart-layer',
      data: barData,
      diskResolution: 12,
      radius: radiusScale,
      extruded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      
      getPosition: (d: any) => d.position,
      getElevation: (d: any) => d.totalVotes * heightScale,
      getFillColor: (d: any) => {
        // Color based on margin: Blue for DEM, Red for GOP
        const intensity = Math.abs(d.margin)
        
        if (d.margin < -0.01) {
          // Democratic (blue gradient)
          const blue = Math.floor(200 + intensity * 55) // 200-255
          return [30, 100, blue, 220]
        } else if (d.margin > 0.01) {
          // Republican (red gradient)
          const red = Math.floor(200 + intensity * 55) // 200-255
          return [red, 60, 60, 220]
        } else {
          // Tie/very close (purple)
          return [150, 100, 180, 220]
        }
      },
      
      updateTriggers: {
        getElevation: [countyStates, heightScale],
        getFillColor: [countyStates]
      },
      
      transitions: {
        getElevation: {
          duration: 500,
          easing: (t: number) => t // Linear
        }
      }
    })
  }, [countyStates, geojsonFeatures, visible, heightScale, radiusScale])

  return layer
}

export function getVoteBarTooltip(object: any): string {
  if (!object) return ''

  const { demVotes, gopVotes, totalVotes, reportingPercent, fips } = object
  const demPercent = totalVotes > 0 ? ((demVotes / totalVotes) * 100).toFixed(1) : '0.0'
  const gopPercent = totalVotes > 0 ? ((gopVotes / totalVotes) * 100).toFixed(1) : '0.0'

  return `
    <div style="font-family: sans-serif; font-size: 12px;">
      <div style="font-weight: bold; margin-bottom: 4px;">County ${fips}</div>
      <div style="color: #60a5fa;">🔵 DEM: ${demVotes.toLocaleString()} (${demPercent}%)</div>
      <div style="color: #f87171;">🔴 GOP: ${gopVotes.toLocaleString()} (${gopPercent}%)</div>
      <div style="margin-top: 4px; color: #94a3b8;">
        ${totalVotes.toLocaleString()} total votes • ${reportingPercent.toFixed(1)}% reporting
      </div>
    </div>
  `
}
