import React from 'react'
import { Demographics3DPanel } from '../Demographics3DPanel'
import type { CountyResult, CountySimulationState } from '../../../types/sandbox'
import type { SimulationStatus } from '../studio/types'

interface DemographicsPanelProps {
  selectedCounty: CountyResult | null
  demographicData?: Map<string, any>
  countyStates: Map<string, CountySimulationState>
  status: SimulationStatus
}

export const DemographicsPanel: React.FC<DemographicsPanelProps> = ({ selectedCounty, demographicData, countyStates, status }) => {
  const selectedFipsRaw = selectedCounty?.fips || ''
  const normalizedFips = selectedFipsRaw ? selectedFipsRaw.padStart(5, '0') : undefined
  const demographicsForCounty = normalizedFips && demographicData ? demographicData.get(normalizedFips) ?? null : null
  const countyState = normalizedFips ? countyStates.get(normalizedFips) : undefined

  return (
    <Demographics3DPanel
      selectedCountyGeoid={normalizedFips}
      demographics={demographicsForCounty}
      countyState={countyState}
      isLoading={status === 'running' && !demographicsForCounty}
    />
  )
}
