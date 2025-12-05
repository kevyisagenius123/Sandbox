/**
 * Demographic Synthesis Service
 * 
 * Client for Python analytics API that synthesizes demographic voting patterns
 * from aggregate vote totals using similar counties algorithm or state aggregation.
 */

// Demographics API is disabled: demographics are embedded in simulation frames by the backend.
// Keeping types for UI consumption, but blocking any accidental network usage.

export interface DemographicGroup {
  dem_votes: number;
  gop_votes: number;
  total_votes: number;
  dem_pct: number;
  gop_pct: number;
  population_pct: number;
}

export interface RaceBreakdown {
  white_nh: DemographicGroup;
  black_nh: DemographicGroup;
  asian_nh: DemographicGroup;
  hispanic: DemographicGroup;
}

export interface EducationBreakdown {
  hs_or_less: DemographicGroup;
  some_college: DemographicGroup;
  bachelors_plus: DemographicGroup;
}

export interface AgeBreakdown {
  under_30: DemographicGroup;
  '30_44': DemographicGroup;
  '45_64': DemographicGroup;
  '65_plus': DemographicGroup;
}

export interface SimilarCounty {
  fips: string;
  county_name: string;
  state_name: string;
  similarity: number;
}

export interface BaselineInfo {
  county_name: string;
  state_name: string;
  population: number;
}

export interface DemographicSynthesisResponse {
  fips: string;
  year: number;
  race_breakdown: RaceBreakdown;
  education_breakdown: EducationBreakdown;
  age_breakdown: AgeBreakdown;
  // Backend also provides array formats for easier iteration
  race_breakdown_list?: DemographicGroup[];
  education_breakdown_list?: DemographicGroup[];
  age_breakdown_list?: DemographicGroup[];
  validation_score: number;
  similar_counties: SimilarCounty[];
  baseline: BaselineInfo;
}

export interface DemographicSynthesisRequest {
  fips: string;
  dem_votes: number;
  gop_votes: number;
  total_votes: number;
  year: number;
}

/**
 * Synthesize demographic voting patterns for a county or state
 * 
 * @param request - Vote totals and FIPS code (2-digit for state, 5-digit for county)
 * @returns Demographic breakdown with race/education/age voting patterns
 */
export async function synthesizeDemographics(
  request: DemographicSynthesisRequest
): Promise<DemographicSynthesisResponse> {
  // prevent unused param lint warning
  void request;
  // Block network usage entirely: data should come from simulation frames.
  throw new Error('Demographics API disabled: use frame.demographics from the backend simulation.');
}

/**
 * Check if the analytics service is available
 */
export async function checkAnalyticsHealth(): Promise<boolean> {
  // Always report unavailable to prevent any callers from trying to use the Python service.
  return false;
}

/**
 * Helper to determine if a FIPS code is state-level (2 digits) or county-level (5 digits)
 */
export function isStateLevelFips(fips: string): boolean {
  return fips.length === 2;
}

/**
 * Format demographic percentage for display
 */
export function formatDemographicPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format vote count with thousands separator
 */
export function formatVoteCount(count: number): string {
  return count.toLocaleString();
}
