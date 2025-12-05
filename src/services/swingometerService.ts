import type {
  BaselineResponse,
  BaselineYearsResponse,
  CountyBaselineRecord,
  CountyFrameSnapshot,
  DemographicAdjustments,
  ExitPollResponse,
  ScenarioParams,
  TimelineResponse
} from '../types/swingometer'

const DEFAULT_RB_API = 'http://localhost:8084/api/rustbelt'
const RB_API_BASE = (import.meta.env.VITE_RB_API || DEFAULT_RB_API).replace(/\/$/, '')

type HttpMethod = 'GET' | 'POST'

async function requestJson<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const url = `${RB_API_BASE}${path}`
  const response = await fetch(url, init)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Swingometer API ${method} ${path} failed (${response.status}): ${text}`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
}

export async function fetchTimeline(years: number[], stateFilter?: string[]): Promise<TimelineResponse> {
  if (!years.length) {
    return {}
  }
  const yearParam = years.join(',')
  const stateParam = stateFilter?.length ? `&states=${stateFilter.join(',')}` : ''
  const raw = await requestJson<Record<string, CountyBaselineRecord[]>>(`/timeline?years=${yearParam}${stateParam}`)
  const result: TimelineResponse = {}
  for (const [key, value] of Object.entries(raw)) {
    const numericKey = Number(key)
    if (!Number.isNaN(numericKey)) {
      result[numericKey] = value
    }
  }
  return result
}

export async function fetchBaselines(states?: string[]): Promise<CountyBaselineRecord[]> {
  const param = states?.length ? `?states=${states.join(',')}` : ''
  const response = await requestJson<BaselineResponse>(`/baseline${param}`)
  return response.counties ?? []
}

export async function fetchExitPolls(year: number): Promise<ExitPollResponse> {
  return requestJson<ExitPollResponse>(`/exit-polls?year=${year}`)
}

export async function fetchScenarioParams(): Promise<ScenarioParams> {
  return requestJson<ScenarioParams>('/scenario/params')
}

export async function updateScenarioParams(params: Partial<ScenarioParams>): Promise<ScenarioParams> {
  return requestJson<ScenarioParams>('/scenario/params', 'POST', params)
}

export async function fetchBaselineYears(): Promise<BaselineYearsResponse> {
  return requestJson<BaselineYearsResponse>('/scenario/baseline-years')
}

export async function toggleDemographicTurnout(enabled: boolean): Promise<{ ok: boolean; useDemographicTurnout: boolean }> {
  return requestJson(`/scenario/demographic-turnout?enabled=${enabled}`, 'POST')
}

export async function getDemographicAdjustments(): Promise<DemographicAdjustments> {
  const data = await requestJson<{ adjustments: DemographicAdjustments }>('/scenario/demographic-adjustments')
  return data.adjustments ?? {}
}

export async function setDemographicAdjustments(payload: DemographicAdjustments): Promise<DemographicAdjustments> {
  const data = await requestJson<{ adjustments: DemographicAdjustments }>('/scenario/demographic-adjustments', 'POST', payload)
  return data.adjustments ?? payload
}

export async function fetchCurrentFrame(): Promise<{ sequence: number; counties: CountyFrameSnapshot[] }> {
  return requestJson('/frame/current')
}

export async function fetchSnapshot(): Promise<{ sequence: number; counties: CountyFrameSnapshot[] }> {
  return requestJson('/frame/snapshot')
}

export async function startSimulation(): Promise<{ running: boolean }> {
  return requestJson('/control/start', 'POST')
}

export async function fetchDemographicVotes(year: number): Promise<Array<{ fips: string; votesDem: number; votesGop: number; totalVotes: number }>> {
  return requestJson(`/scenario/demographic-votes?year=${year}`)
}
