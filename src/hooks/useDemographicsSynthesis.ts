import { useMemo } from 'react'
import { type DemographicSynthesisResponse } from '../services/demographicService'

// Deprecated: demographics are included in backend simulation frames.
// This hook is kept for compatibility but performs no network requests.
export const useDemographicsSynthesis = (
  _fips?: string,
  _demVotes?: number,
  _gopVotes?: number,
  _totalVotes?: number,
  _year: number = 2024
) => {
  const result = useMemo(() => ({
    demographics: null as DemographicSynthesisResponse | null,
    isLoading: false,
    error: null as string | null
  }), [])

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('useDemographicsSynthesis is disabled. Use frame.demographics from the backend simulation frames.')
  }

  return result
}
