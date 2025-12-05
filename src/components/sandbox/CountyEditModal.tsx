import React, { useState, useEffect } from 'react';
import type { CountyResult } from '../../types/sandbox';

interface CountyEditModalProps {
  county: CountyResult | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fips: string, updates: Partial<CountyResult>) => void;
}

export function CountyEditModal({ county, isOpen, onClose, onSave }: CountyEditModalProps) {
  const [countyName, setCountyName] = useState('');
  const [stateName, setStateName] = useState('');
  const [demVotes, setDemVotes] = useState(0);
  const [gopVotes, setGopVotes] = useState(0);
  const [otherVotes, setOtherVotes] = useState(0);
  const [reportingPercent, setReportingPercent] = useState(0);

  // Reset form when county changes
  useEffect(() => {
    if (county) {
      setCountyName(county.county);
      setStateName(county.state);
      setDemVotes(county.demVotes);
      setGopVotes(county.gopVotes);
      setOtherVotes(county.otherVotes);
      setReportingPercent(county.reportingPercent);
    }
  }, [county]);

  if (!isOpen || !county) return null;

  const totalVotes = demVotes + gopVotes + otherVotes;
  const demPercent = totalVotes > 0 ? ((demVotes / totalVotes) * 100).toFixed(1) : '0.0';
  const gopPercent = totalVotes > 0 ? ((gopVotes / totalVotes) * 100).toFixed(1) : '0.0';
  const otherPercent = totalVotes > 0 ? ((otherVotes / totalVotes) * 100).toFixed(1) : '0.0';
  const margin = totalVotes > 0 ? (((demVotes - gopVotes) / totalVotes) * 100).toFixed(1) : '0.0';

  const handleSave = () => {
    onSave(county.fips, {
      county: countyName,
      state: stateName,
      demVotes,
      gopVotes,
      otherVotes,
      totalVotes,
      reportingPercent,
    });
    onClose();
  };

  const handleCancel = () => {
    // Reset to original values
    if (county) {
      setCountyName(county.county);
      setStateName(county.state);
      setDemVotes(county.demVotes);
      setGopVotes(county.gopVotes);
      setOtherVotes(county.otherVotes);
      setReportingPercent(county.reportingPercent);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  // Quick adjustment buttons
  const adjustVotes = (party: 'dem' | 'gop' | 'other', delta: number) => {
    if (party === 'dem') {
      setDemVotes(Math.max(0, demVotes + delta));
    } else if (party === 'gop') {
      setGopVotes(Math.max(0, gopVotes + delta));
    } else {
      setOtherVotes(Math.max(0, otherVotes + delta));
    }
  };

  // Swing adjustments (percentage-based)
  const applySwing = (demSwing: number) => {
    // Shift votes between dem and gop based on swing percentage
    const shift = Math.round(totalVotes * (demSwing / 100));
    const newDemVotes = Math.max(0, demVotes + shift);
    const newGopVotes = Math.max(0, gopVotes - shift);
    setDemVotes(newDemVotes);
    setGopVotes(newGopVotes);
  };

  // Turnout scaling
  const scaleTurnout = (factor: number) => {
    setDemVotes(Math.round(demVotes * factor));
    setGopVotes(Math.round(gopVotes * factor));
    setOtherVotes(Math.round(otherVotes * factor));
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 rounded-t-lg border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {county.county ? 'Edit County Votes' : 'Add County Data'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {county.county ? `${county.county}, ${county.state} (FIPS: ${county.fips})` : `FIPS: ${county.fips}`}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* County Info Section - Only show if county name/state is blank (new county) */}
          {(!county.county || !county.state) && (
            <div className="space-y-4 pb-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">County Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    County Name
                  </label>
                  <input
                    type="text"
                    value={countyName}
                    onChange={(e) => setCountyName(e.target.value)}
                    placeholder="e.g., Miami-Dade"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    State (2-letter)
                  </label>
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value.toUpperCase())}
                    placeholder="e.g., FL"
                    maxLength={2}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Vote Totals Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Vote Totals</h3>
            
            {/* Democratic Votes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-blue-400">Democratic Votes</label>
                <span className="text-sm text-gray-400">{demPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustVotes('dem', -1000)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  -1K
                </button>
                <button
                  onClick={() => adjustVotes('dem', -100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  -100
                </button>
                <input
                  type="number"
                  value={demVotes}
                  onChange={(e) => setDemVotes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  min="0"
                />
                <button
                  onClick={() => adjustVotes('dem', 100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  +100
                </button>
                <button
                  onClick={() => adjustVotes('dem', 1000)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  +1K
                </button>
              </div>
            </div>

            {/* Republican Votes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-red-400">Republican Votes</label>
                <span className="text-sm text-gray-400">{gopPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustVotes('gop', -1000)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  -1K
                </button>
                <button
                  onClick={() => adjustVotes('gop', -100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  -100
                </button>
                <input
                  type="number"
                  value={gopVotes}
                  onChange={(e) => setGopVotes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-red-500 focus:outline-none"
                  min="0"
                />
                <button
                  onClick={() => adjustVotes('gop', 100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  +100
                </button>
                <button
                  onClick={() => adjustVotes('gop', 1000)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  +1K
                </button>
              </div>
            </div>

            {/* Other Votes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">Other Votes</label>
                <span className="text-sm text-gray-400">{otherPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustVotes('other', -100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  -100
                </button>
                <input
                  type="number"
                  value={otherVotes}
                  onChange={(e) => setOtherVotes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-gray-500 focus:outline-none"
                  min="0"
                />
                <button
                  onClick={() => adjustVotes('other', 100)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  +100
                </button>
              </div>
            </div>
          </div>

          {/* Quick Adjustments */}
          <div className="border-t border-gray-700 pt-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Quick Adjustments</h3>
            
            {/* Swing Buttons */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Apply Swing (% shift to DEM)</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => applySwing(-10)} className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600 transition-colors text-sm">
                  R+10%
                </button>
                <button onClick={() => applySwing(-5)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors text-sm">
                  R+5%
                </button>
                <button onClick={() => applySwing(-2)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-400 transition-colors text-sm">
                  R+2%
                </button>
                <button onClick={() => applySwing(2)} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-400 transition-colors text-sm">
                  D+2%
                </button>
                <button onClick={() => applySwing(5)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors text-sm">
                  D+5%
                </button>
                <button onClick={() => applySwing(10)} className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-600 transition-colors text-sm">
                  D+10%
                </button>
              </div>
            </div>

            {/* Turnout Scaling */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Scale Turnout</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => scaleTurnout(0.9)} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm">
                  -10%
                </button>
                <button onClick={() => scaleTurnout(0.95)} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm">
                  -5%
                </button>
                <button onClick={() => scaleTurnout(1.05)} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm">
                  +5%
                </button>
                <button onClick={() => scaleTurnout(1.1)} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm">
                  +10%
                </button>
                <button onClick={() => scaleTurnout(1.2)} className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm">
                  +20%
                </button>
              </div>
            </div>
          </div>

          {/* Reporting Percentage */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-white mb-2">Reporting Status</h3>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Reporting Percentage</label>
                <span className="text-sm text-gray-400">{reportingPercent.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={reportingPercent}
                onChange={(e) => setReportingPercent(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total Votes:</span>
                <span className="text-white font-mono ml-2">{totalVotes.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Margin:</span>
                <span className={`font-mono ml-2 ${parseFloat(margin) > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {parseFloat(margin) > 0 ? 'D+' : 'R+'}{Math.abs(parseFloat(margin)).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">DEM:</span>
                <span className="text-blue-400 font-mono ml-2">{demVotes.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">GOP:</span>
                <span className="text-red-400 font-mono ml-2">{gopVotes.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-yellow-200">
                Changes will apply to future reporting waves. This county will be marked as "manually edited."
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-4 rounded-b-lg border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
