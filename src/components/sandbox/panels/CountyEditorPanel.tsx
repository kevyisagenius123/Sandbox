import React, { useEffect, useState } from 'react'
import type { CountyResult } from '../../../types/sandbox'
import type { SimulationStatus } from '../studio/types'

interface CountyEditorPanelProps {
  selectedCounty: CountyResult | null
  status: SimulationStatus
  onCountySave: (fips: string, updates: Partial<CountyResult>) => void
  onCountyEditClose: () => void
}

export const CountyEditorPanel: React.FC<CountyEditorPanelProps> = ({ selectedCounty, status, onCountySave, onCountyEditClose }) => {
  const [demVotes, setDemVotes] = useState(0)
  const [gopVotes, setGopVotes] = useState(0)
  const [otherVotes, setOtherVotes] = useState(0)

  useEffect(() => {
    if (!selectedCounty) return
    setDemVotes(selectedCounty.demVotes)
    setGopVotes(selectedCounty.gopVotes)
    setOtherVotes(selectedCounty.otherVotes)
  }, [selectedCounty])

  if (status === 'running') {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        Pause the simulation to edit county values. You can still click a county to inspect analytics and demographics.
      </div>
    )
  }

  if (!selectedCounty) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        Click a county on the map to edit its results
      </div>
    )
  }

  const handleSave = () => {
    onCountySave(selectedCounty.fips, {
      demVotes,
      gopVotes,
      otherVotes,
      totalVotes: demVotes + gopVotes + otherVotes
    })
    onCountyEditClose()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
        <p className="text-xs text-slate-400">FIPS Code</p>
        <p className="text-sm font-semibold text-slate-100">{selectedCounty.fips}</p>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Dem Votes</label>
        <input
          type="number"
          value={demVotes}
          onChange={(event) => setDemVotes(parseInt(event.target.value, 10) || 0)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">GOP Votes</label>
        <input
          type="number"
          value={gopVotes}
          onChange={(event) => setGopVotes(parseInt(event.target.value, 10) || 0)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/30"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Other Votes</label>
        <input
          type="number"
          value={otherVotes}
          onChange={(event) => setOtherVotes(parseInt(event.target.value, 10) || 0)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-lg border border-sky-500/50 bg-sky-500/20 px-3 py-2 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/30"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCountyEditClose}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
