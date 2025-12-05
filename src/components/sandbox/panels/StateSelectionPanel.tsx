import React, { useMemo, useState } from 'react'
import { ALL_US_STATES } from '../../../constants/usStates'

const REGIONAL_PRESETS: Record<string, string[]> = {
  'Rust Belt': ['17', '18', '26', '27', '39', '42', '55'],
  'Blue Wall': ['26', '42', '55'],
  'Sun Belt': ['04', '12', '13', '32', '35', '37', '48'],
  'Swing States 2024': ['04', '13', '26', '32', '37', '42', '55'],
  'Northeast': ['09', '23', '25', '33', '34', '36', '44', '50'],
  'Southeast': ['01', '12', '13', '21', '28', '37', '45', '47', '51', '54'],
  'Midwest': ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'],
  'Mountain West': ['04', '08', '16', '30', '32', '35', '49', '56'],
  'Pacific': ['02', '06', '15', '41', '53'],
  'Deep South': ['01', '05', '22', '28', '45'],
  'Great Lakes': ['17', '18', '26', '27', '39', '55'],
  'Border States': ['10', '21', '24', '29', '40', '47', '48', '54']
}

interface StateSelectionPanelProps {
  scope: 'ALL' | 'CUSTOM'
  customStates: string[]
  selectedStates: string[]
  onScopeChange: (scope: 'ALL' | 'CUSTOM') => void
  onCustomStatesChange: (states: string[]) => void
  onSelectedStatesChange: (states: string[]) => void
}

export const StateSelectionPanel: React.FC<StateSelectionPanelProps> = ({
  scope,
  customStates,
  selectedStates,
  onScopeChange,
  onCustomStatesChange,
  onSelectedStatesChange
}) => {
  const [statePickerOpen, setStatePickerOpen] = useState(false)
  const selectedStatesLabel = useMemo(() => {
    if (scope === 'ALL') return 'All states'
    return `${customStates.length} custom states`
  }, [scope, customStates])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">Scope</p>
          <p className="text-[11px] text-slate-400">{selectedStatesLabel}</p>
        </div>
        <select
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as 'ALL' | 'CUSTOM')}
          className="text-[11px] rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
        >
          <option value="ALL">All States</option>
          <option value="CUSTOM">Custom Selection</option>
        </select>
      </div>

      {selectedStates.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-300 font-medium">
              Interactive Selection: {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => onSelectedStatesChange([])}
              className="rounded border border-rose-500 bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-rose-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {scope === 'CUSTOM' && (
        <>
          <button
            onClick={() => setStatePickerOpen((value) => !value)}
            className="w-full rounded border border-blue-500 bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-700"
          >
            {statePickerOpen ? 'Close' : 'Pick States'} ({customStates.length})
          </button>

          {statePickerOpen && (
            <div className="max-h-96 overflow-y-auto rounded-md border border-slate-600 bg-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-200">Select States</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCustomStatesChange(ALL_US_STATES.map((state) => state.fips))}
                    className="rounded border border-blue-500 bg-blue-600 px-2 py-0.5 text-[10px] text-white transition hover:bg-blue-700"
                  >
                    All
                  </button>
                  <button
                    onClick={() => onCustomStatesChange([])}
                    className="rounded border border-rose-500 bg-rose-600 px-2 py-0.5 text-[10px] text-white transition hover:bg-rose-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mb-3 border-b border-slate-700 pb-3">
                <div className="mb-1.5 text-[10px] font-semibold text-slate-400">Regional Presets</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(REGIONAL_PRESETS).map(([label, fipsList]) => (
                    <button
                      key={label}
                      onClick={() => onCustomStatesChange([...fipsList])}
                      className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-left text-[10px] text-slate-200 transition hover:bg-slate-600"
                    >
                      {label} <span className="text-slate-400">({fipsList.length})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {ALL_US_STATES.map((state) => (
                  <label key={state.fips} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[10px] text-slate-200 transition hover:bg-slate-700/50">
                    <input
                      type="checkbox"
                      checked={customStates.includes(state.fips)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onCustomStatesChange([...customStates, state.fips])
                        } else {
                          onCustomStatesChange(customStates.filter((code) => code !== state.fips))
                        }
                      }}
                      className="rounded border-slate-600"
                    />
                    <span>{state.abbr}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
