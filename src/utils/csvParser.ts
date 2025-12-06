// CSV Parser and Validator for State Sandbox Simulation
// Parses uploaded county results CSV and validates data integrity

import Papa from 'papaparse'
import type {
  CountyResult,
  CountyResultCSV,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types/sandbox'

// Reference: All US counties by FIPS code (simplified - in production, load from JSON)
// This is a subset for validation - full list would have 3,142+ counties
const VALID_FIPS_CODES = new Set([
  // Major counties for testing
  '12086', // Miami-Dade, FL
  '06037', // Los Angeles, CA
  '48201', // Harris, TX
  '17031', // Cook, IL
  '04013', // Maricopa, AZ
  '06073', // San Diego, CA
  '06059', // Orange, CA
  '36047', // Kings, NY
  '36061', // New York, NY
  '36081', // Queens, NY
  // Add more as needed...
])

const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
])

/**
 * Parse uploaded CSV file and validate county results
 */
export async function parseCountyResultsCSV(
  file: File
): Promise<{ data: CountyResult[]; validation: ValidationResult }> {
  return new Promise((resolve, reject) => {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const results: CountyResult[] = []

    Papa.parse<CountyResultCSV>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings initially for validation
      complete: (parseResult) => {
        // Check for required columns - support both gop_votes and rep_votes
        const headers = parseResult.meta.fields || []
        const requiredColumns = ['fips', 'state', 'county', 'dem_votes', 'total_votes']
        const gopColumnVariants = ['gop_votes', 'rep_votes', 'republican_votes', 'votes_gop', 'votes_rep']
        
        // Check base required columns
        for (const col of requiredColumns) {
          if (!headers.includes(col)) {
            errors.push({
              message: `Missing required column: ${col}`,
              severity: 'error'
            })
          }
        }
        
        // Check for at least one GOP/Republican vote column variant
        const hasGopColumn = gopColumnVariants.some(variant => headers.includes(variant))
        if (!hasGopColumn) {
          errors.push({
            message: `Missing required column: one of ${gopColumnVariants.join(', ')}`,
            severity: 'error'
          })
        }

        if (errors.length > 0) {
          resolve({
            data: [],
            validation: { isValid: false, errors, warnings }
          })
          return
        }

        // Validate each row
        parseResult.data.forEach((row, index) => {
          const rowNumber = index + 2 // +2 because index is 0-based and CSV has header row

          try {
            const validated = validateCountyRow(row, rowNumber, errors, warnings)
            if (validated) {
              results.push(validated)
            }
          } catch (err) {
            errors.push({
              row: rowNumber,
              message: `Failed to parse row: ${err instanceof Error ? err.message : 'Unknown error'}`,
              severity: 'error'
            })
          }
        })

        // Check for duplicate FIPS codes
        const fipsSeen = new Set<string>()
        results.forEach((county, index) => {
          if (fipsSeen.has(county.fips)) {
            warnings.push({
              row: index + 2,
              column: 'fips',
              message: `Duplicate FIPS code: ${county.fips}`,
              severity: 'warning'
            })
          }
          fipsSeen.add(county.fips)
        })

        resolve({
          data: results,
          validation: {
            isValid: errors.length === 0,
            errors,
            warnings
          }
        })
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      }
    })
  })
}

/**
 * Validate a single county row
 */
function validateCountyRow(
  row: CountyResultCSV,
  rowNumber: number,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): CountyResult | null {
  // Validate FIPS code
  const fips = row.fips?.toString().trim()
  if (!fips) {
    errors.push({
      row: rowNumber,
      column: 'fips',
      message: 'FIPS code is required',
      severity: 'error'
    })
    return null
  }

  if (fips.length !== 5) {
    errors.push({
      row: rowNumber,
      column: 'fips',
      message: `FIPS code must be 5 digits, got: ${fips}`,
      severity: 'error'
    })
    return null
  }

  // In MVP, we'll be lenient with FIPS validation since user might upload custom data
  // Just warn if FIPS is not in our reference set
  if (!VALID_FIPS_CODES.has(fips)) {
    warnings.push({
      row: rowNumber,
      column: 'fips',
      message: `FIPS code not in reference database: ${fips}`,
      severity: 'warning'
    })
  }

  // Validate state code
  const state = row.state?.toString().trim().toUpperCase()
  if (!state) {
    errors.push({
      row: rowNumber,
      column: 'state',
      message: 'State code is required',
      severity: 'error'
    })
    return null
  }

  if (!VALID_STATE_CODES.has(state)) {
    errors.push({
      row: rowNumber,
      column: 'state',
      message: `Invalid state code: ${state}`,
      severity: 'error'
    })
    return null
  }

  // Validate county name
  const county = row.county?.toString().trim()
  if (!county) {
    errors.push({
      row: rowNumber,
      column: 'county',
      message: 'County name is required',
      severity: 'error'
    })
    return null
  }

  // Parse and validate vote counts
  // Support multiple column name variants for GOP votes
  const gopVotesRaw = row.gop_votes || row.rep_votes || row.republican_votes || row.votes_gop || row.votes_rep
  const gopVotes = parseVoteCount(gopVotesRaw, 'gop_votes/rep_votes', rowNumber, errors)
  const demVotes = parseVoteCount(row.dem_votes, 'dem_votes', rowNumber, errors)
  const otherVotes = row.other_votes ? parseVoteCount(row.other_votes, 'other_votes', rowNumber, errors) : 0
  const totalVotes = parseVoteCount(row.total_votes, 'total_votes', rowNumber, errors)

  if (gopVotes === null || demVotes === null || totalVotes === null) {
    return null
  }

  // Validate vote totals sum correctly (allow 1% tolerance)
  const calculatedTotal = gopVotes + demVotes + (otherVotes || 0)
  const tolerance = totalVotes * 0.01
  if (Math.abs(calculatedTotal - totalVotes) > tolerance) {
    errors.push({
      row: rowNumber,
      column: 'total_votes',
      message: `Vote totals don't match: gop(${gopVotes}) + dem(${demVotes}) + other(${otherVotes}) = ${calculatedTotal}, expected ${totalVotes}`,
      severity: 'error'
    })
    return null
  }

  // Parse optional fields
  const reportingPercent = row.reporting_percent 
    ? parseFloat(row.reporting_percent.toString())
    : 0

  if (reportingPercent < 0 || reportingPercent > 100) {
    warnings.push({
      row: rowNumber,
      column: 'reporting_percent',
      message: `Reporting percent out of range: ${reportingPercent}%`,
      severity: 'warning'
    })
  }

  const population = row.population 
    ? parseInt(row.population.toString())
    : undefined

  const geography = row.geography?.toString().trim().toLowerCase() as 'rural' | 'suburban' | 'urban' | undefined
  if (geography && !['rural', 'suburban', 'urban'].includes(geography)) {
    warnings.push({
      row: rowNumber,
      column: 'geography',
      message: `Invalid geography type: ${geography}. Expected rural, suburban, or urban.`,
      severity: 'warning'
    })
  }

  return {
    fips,
    state,
    county,
    gopVotes,
    demVotes,
    otherVotes: otherVotes || 0,
    totalVotes,
    reportingPercent: Math.max(0, Math.min(100, reportingPercent)),
    population,
    geography: geography && ['rural', 'suburban', 'urban'].includes(geography) 
      ? geography 
      : undefined
  }
}

/**
 * Parse and validate a vote count
 */
function parseVoteCount(
  value: string | number | undefined,
  columnName: string,
  rowNumber: number,
  errors: ValidationError[]
): number | null {
  const str = value?.toString().trim()
  if (!str) {
    errors.push({
      row: rowNumber,
      column: columnName,
      message: `${columnName} is required`,
      severity: 'error'
    })
    return null
  }

  const parsed = parseInt(str)
  if (isNaN(parsed)) {
    errors.push({
      row: rowNumber,
      column: columnName,
      message: `${columnName} must be a number, got: ${str}`,
      severity: 'error'
    })
    return null
  }

  if (parsed < 0) {
    errors.push({
      row: rowNumber,
      column: columnName,
      message: `${columnName} cannot be negative: ${parsed}`,
      severity: 'error'
    })
    return null
  }

  return parsed
}

/**
 * Generate a sample CSV template for users to download
 */
export function generateSampleCSV(): string {
  const headers = ['fips', 'state', 'county', 'gop_votes', 'dem_votes', 'other_votes', 'total_votes', 'reporting_percent']
  const sampleRows = [
    ['12086', 'FL', 'Miami-Dade', '534983', '617864', '15234', '1168081', '0'],
    ['06037', 'CA', 'Los Angeles', '903333', '2516670', '98234', '3518237', '0'],
    ['48201', 'TX', 'Harris', '915710', '1002628', '45231', '1963569', '0']
  ]

  return [
    headers.join(','),
    ...sampleRows.map(row => row.join(','))
  ].join('\n')
}

/**
 * Download sample CSV template from backend API
 */
export async function downloadSampleCSV(templateName: string = 'sandbox_counties.csv'): Promise<void> {
  try {
    // Use backend URL from environment or default
    const backendUrl = (typeof window !== 'undefined' && (window as any).ENV?.VITE_BACKEND_URL) || 'https://sandbox-backend-977058061007.us-central1.run.app'
    const response = await fetch(`${backendUrl}/api/export/templates/${templateName}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`)
    }
    const csv = await response.text()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = templateName
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download template:', error)
    // Fallback to generated sample if fetch fails
    const csv = generateSampleCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'county_results_template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
}
