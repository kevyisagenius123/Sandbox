// Scenario Uploader Component
// Handles file uploads for county results CSV, exit polls JSON, and reporting config JSON

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import type { CountyResult, ExitPoll, ReportingConfig, ValidationResult } from '../../types/sandbox'
import { parseCountyResultsCSV, downloadSampleCSV } from '../../utils/csvParser'

interface ScenarioUploaderProps {
  onCountyDataLoaded: (data: CountyResult[], rawCsv: string) => void
  onExitPollsLoaded: (data: ExitPoll) => void
  onReportingConfigLoaded: (data: ReportingConfig) => void
}

export const ScenarioUploader: React.FC<ScenarioUploaderProps> = ({
  onCountyDataLoaded,
  onExitPollsLoaded,
  onReportingConfigLoaded
}) => {
  const [countyStatus, setCountyStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [exitPollStatus, setExitPollStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [reportingStatus, setReportingStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  
  const [countyValidation, setCountyValidation] = useState<ValidationResult | null>(null)
  const [countyCount, setCountyCount] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTemplateDownload = (templateName: string) => {
    downloadSampleCSV(templateName)
    setShowTemplateDropdown(false)
  }

  // County Results CSV Upload
  const onCountyDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    const file = acceptedFiles[0]
    setCountyStatus('uploading')
    setErrorMessage('')
    
    try {
      // Read raw CSV text for backend
      const rawCsv = await file.text()
      
      // Parse for validation and display
      const result = await parseCountyResultsCSV(file)
      setCountyValidation(result.validation)
      
      if (result.validation.isValid) {
        setCountyStatus('success')
        setCountyCount(result.data.length)
        onCountyDataLoaded(result.data, rawCsv) // Pass both parsed data and raw CSV
      } else {
        setCountyStatus('error')
        setErrorMessage(result.validation.errors[0]?.message || 'Validation failed')
      }
    } catch (err) {
      setCountyStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }, [onCountyDataLoaded])

  const countyDropzone = useDropzone({
    onDrop: onCountyDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  })

  // Exit Polls JSON Upload
  const onExitPollDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    const file = acceptedFiles[0]
    setExitPollStatus('uploading')
    setErrorMessage('')
    
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ExitPoll
      
      // Basic validation
      if (!data.year || !data.demographics) {
        throw new Error('Invalid exit poll format: missing year or demographics')
      }
      
      setExitPollStatus('success')
      onExitPollsLoaded(data)
    } catch (err) {
      setExitPollStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse exit polls')
    }
  }, [onExitPollsLoaded])

  const exitPollDropzone = useDropzone({
    onDrop: onExitPollDrop,
    accept: {
      'application/json': ['.json']
    },
    maxFiles: 1
  })

  // Reporting Config JSON Upload
  const onReportingDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    const file = acceptedFiles[0]
    setReportingStatus('uploading')
    setErrorMessage('')
    
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ReportingConfig
      
      // Basic validation
      if (!data.version || !data.baseTimestamp) {
        throw new Error('Invalid reporting config: missing version or baseTimestamp')
      }
      
      setReportingStatus('success')
      onReportingConfigLoaded(data)
    } catch (err) {
      setReportingStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse reporting config')
    }
  }, [onReportingConfigLoaded])

  const reportingDropzone = useDropzone({
    onDrop: onReportingDrop,
    accept: {
      'application/json': ['.json']
    },
    maxFiles: 1
  })

  return (
    <div className="space-y-6 p-6 bg-gray-900 rounded-lg">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          Upload Data
        </h2>
      </div>

      {/* County Results CSV */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          County Results CSV <span className="text-red-400">*Required</span>
        </label>
        <div
          {...countyDropzone.getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${countyDropzone.isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${countyStatus === 'success' ? 'border-green-500 bg-green-500/10' : ''}
            ${countyStatus === 'error' ? 'border-red-500 bg-red-500/10' : ''}
            hover:border-blue-400
          `}
        >
          <input {...countyDropzone.getInputProps()} />
          <div className="space-y-2">
            {countyStatus === 'idle' && (
              <p className="text-gray-400">Drag & drop CSV file here, or click to select</p>
            )}
            {countyStatus === 'uploading' && (
              <p className="text-blue-400">Uploading and validating...</p>
            )}
            {countyStatus === 'success' && (
              <div>
                <p className="text-green-400 font-semibold">{countyCount.toLocaleString()} counties loaded</p>
                {countyValidation?.warnings.length! > 0 && (
                  <p className="text-yellow-400 text-sm">{countyValidation?.warnings.length} warnings</p>
                )}
              </div>
            )}
            {countyStatus === 'error' && (
              <p className="text-red-400">{errorMessage}</p>
            )}
          </div>
        </div>
        
        {/* Validation Details */}
        {countyValidation && countyValidation.errors.length > 0 && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded text-sm">
            <p className="text-red-400 font-semibold mb-2">Validation Errors:</p>
            <ul className="space-y-1 text-red-300 text-xs">
              {countyValidation.errors.slice(0, 5).map((error, i) => (
                <li key={i}>
                  {error.row && `Row ${error.row}: `}
                  {error.column && `[${error.column}] `}
                  {error.message}
                </li>
              ))}
              {countyValidation.errors.length > 5 && (
                <li className="text-red-400">
                  ...and {countyValidation.errors.length - 5} more errors
                </li>
              )}
            </ul>
          </div>
        )}
        
        <div className="mt-2 relative" ref={dropdownRef}>
          <button
            onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Download Template
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showTemplateDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-[220px]">
              <button
                onClick={() => handleTemplateDownload('sandbox_counties.csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg"
              >
                Basic Template
              </button>
              <button
                onClick={() => handleTemplateDownload('ga_rplus8_5.csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <img 
                  src="http://upload.wikimedia.org/wikipedia/commons/0/0f/Flag_of_Georgia.svg" 
                  alt="GA" 
                  className="w-5 h-3 object-cover"
                />
                Georgia R+8.5
              </button>
              <button
                onClick={() => handleTemplateDownload('maine_gop_plus1p5.csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              >
                <img 
                  src="http://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Maine.svg" 
                  alt="ME" 
                  className="w-5 h-3 object-cover"
                />
                Maine GOP+1.5
              </button>
              <button
                onClick={() => handleTemplateDownload('florida_2000_simulation.csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
              >
                <img 
                  src="http://upload.wikimedia.org/wikipedia/commons/f/f7/Flag_of_Florida.svg" 
                  alt="FL" 
                  className="w-5 h-3 object-cover"
                />
                Florida 2000 Recount
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exit Polls JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Exit Polls JSON <span className="text-gray-500">(Optional)</span>
        </label>
        <div
          {...exitPollDropzone.getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
            ${exitPollDropzone.isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${exitPollStatus === 'success' ? 'border-green-500 bg-green-500/10' : ''}
            ${exitPollStatus === 'error' ? 'border-red-500 bg-red-500/10' : ''}
            hover:border-blue-400
          `}
        >
          <input {...exitPollDropzone.getInputProps()} />
          <div className="space-y-2">
            {exitPollStatus === 'idle' && (
              <p className="text-gray-400 text-sm">Upload exit poll demographics (optional)</p>
            )}
            {exitPollStatus === 'success' && (
              <p className="text-green-400 text-sm">Exit polls loaded</p>
            )}
            {exitPollStatus === 'error' && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Reporting Order JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Reporting Order JSON <span className="text-gray-500">(Optional)</span>
        </label>
        <div
          {...reportingDropzone.getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
            ${reportingDropzone.isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${reportingStatus === 'success' ? 'border-green-500 bg-green-500/10' : ''}
            ${reportingStatus === 'error' ? 'border-red-500 bg-red-500/10' : ''}
            hover:border-blue-400
          `}
        >
          <input {...reportingDropzone.getInputProps()} />
          <div className="space-y-2">
            {reportingStatus === 'idle' && (
              <p className="text-gray-400 text-sm">Upload reporting timeline config</p>
            )}
            {reportingStatus === 'success' && (
              <p className="text-green-400 text-sm">Reporting config loaded</p>
            )}
            {reportingStatus === 'error' && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}
          </div>
        </div>
        {reportingStatus === 'idle' && (
          <p className="mt-2 text-xs text-gray-500">
            If not provided, auto-generate uniform reporting timeline
          </p>
        )}
      </div>
    </div>
  )
}
