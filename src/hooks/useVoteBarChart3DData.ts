import { useEffect, useState, useRef } from 'react'
import type { CountyResult, CountySimulationState } from '../types/sandbox'
import { debugLog } from '../utils/debugLogger'

interface VoteBarChart3DData {
  type: 'FeatureCollection'
  features: VotePolygonFeature[]
  maxElevation: number
  viewCenter: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
  }
  statistics: {
    totalCounties: number
    countiesWithVotes: number
    countiesMissingGeometry: number
    totalVotes: number
    totalDemVotes: number
    totalGopVotes: number
  }
}

interface VotePolygonFeature {
  type: 'Feature'
  geometry: any
  properties: {
    countyName: string
    countyFips: string
    demVotes: number
    gopVotes: number
    totalVotes: number
    reportingPercent: number
    fillColor: [number, number, number, number]
    elevation: number
    centroid: [number, number]
  }
}

/**
 * Hook to fetch pre-processed 3D vote bar chart data from backend
 * Offloads heavy GeoJSON processing from frontend
 */
export function useVoteBarChart3DData(
  countyResults: CountyResult[],
  countyStates: Map<string, CountySimulationState>
) {
  const [data, setData] = useState<VoteBarChart3DData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Skip if no data
    if (countyResults.length === 0 || countyStates.size === 0) {
      setData(null)
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Build request payload from current county states
        const counties = countyResults
          .map(county => {
            const state = countyStates.get(county.fips)
            if (!state) return null

            return {
              fips: county.fips,
              countyName: county.county,
              demVotes: state.currentDemVotes,
              gopVotes: state.currentGopVotes,
              totalVotes: state.currentTotalVotes,
              reportingPercent: state.currentReportingPercent
            }
          })
          .filter(Boolean)

        // Call backend API
        const response = await fetch('/api/visualization/vote-bar-chart-3d', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ counties }),
          signal: abortController.signal
        })

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`)
        }

        const result = await response.json()
        
        if (!abortController.signal.aborted) {
            setData(result)
            debugLog('[useVoteBarChart3DData] Loaded:', {
            features: result.features.length,
            maxElevation: result.maxElevation,
            statistics: result.statistics
          })
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
            debugLog('[useVoteBarChart3DData] Request aborted')
          return
        }
        console.error('[useVoteBarChart3DData] Failed to fetch:', err)
        setError(err.message || 'Failed to load chart data')
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      abortController.abort()
    }
  }, [countyResults, countyStates])

  return { data, isLoading, error }
}
