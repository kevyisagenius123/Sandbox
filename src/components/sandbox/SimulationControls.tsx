// Simulation Controls Component
// Play/pause/reset buttons, speed controls, and keyboard shortcuts

import React, { useEffect } from 'react'

interface SimulationControlsProps {
  isPlaying: boolean
  speed: number
  currentTimeSeconds: number
  timelinePercent: number
  reportingPercent: number
  totalDurationSeconds?: number
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
  onJumpTo: (seconds: number) => void
}

const SPEED_PRESETS = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100]

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isPlaying,
  speed,
  currentTimeSeconds,
  timelinePercent,
  reportingPercent,
  totalDurationSeconds = 7200,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onJumpTo
}) => {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ': // Spacebar - play/pause
          e.preventDefault()
          if (isPlaying) {
            onPause()
          } else {
            onPlay()
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          onReset()
          break
        case 'ArrowRight':
          e.preventDefault()
          onJumpTo(currentTimeSeconds + 60) // Skip forward 1 minute
          break
        case 'ArrowLeft':
          e.preventDefault()
          onJumpTo(currentTimeSeconds - 60) // Skip back 1 minute
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, currentTimeSeconds, onPlay, onPause, onReset, onJumpTo])

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4 p-6 bg-gray-900 rounded-lg">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          Simulation Controls
        </h2>
      </div>

      {/* Playback Controls */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Playback</label>
        <div className="flex items-center gap-3">
          {/* Reset */}
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
            title="Reset (R)"
          >
            Reset
          </button>

          {/* Play/Pause */}
          {isPlaying ? (
            <button
              onClick={onPause}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2 font-semibold"
              title="Pause (Space)"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2 font-semibold"
              title="Play (Space)"
            >
              Play
            </button>
          )}

          {/* Current Time Display */}
          <div className="ml-auto px-4 py-2 bg-gray-800 rounded-lg text-white font-mono">
            {formatTime(currentTimeSeconds)}
          </div>
        </div>
      </div>

      {/* Speed Control */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Speed: {speed.toFixed(1)}x
        </label>
        
        {/* Speed Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SPEED_PRESETS.map(preset => (
            <button
              key={preset}
              onClick={() => onSpeedChange(preset)}
              className={`
                px-3 py-1 rounded transition-colors text-sm
                ${speed === preset 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              `}
            >
              {preset}x
            </button>
          ))}
        </div>

        {/* Custom Speed Slider */}
        <input
          type="range"
          min="0.1"
          max="100"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((Math.log(speed) - Math.log(0.1)) / (Math.log(100) - Math.log(0.1))) * 100}%, #374151 ${((Math.log(speed) - Math.log(0.1)) / (Math.log(100) - Math.log(0.1))) * 100}%, #374151 100%)`
          }}
        />
      </div>

      {/* Progress Bar */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Timeline Position: {timelinePercent.toFixed(1)}%
        </label>
        <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-100"
            style={{ width: `${timelinePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Start</span>
          <span>{formatTime(currentTimeSeconds)} / {formatTime(totalDurationSeconds)}</span>
          <span>End</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Reporting Complete: {reportingPercent.toFixed(1)}%
        </p>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="pt-4 border-t border-gray-700">
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-300">Keyboard Shortcuts</summary>
          <ul className="mt-2 space-y-1 pl-4">
            <li><kbd className="px-2 py-1 bg-gray-800 rounded">Space</kbd> - Play/Pause</li>
            <li><kbd className="px-2 py-1 bg-gray-800 rounded">R</kbd> - Reset</li>
            <li><kbd className="px-2 py-1 bg-gray-800 rounded">Left Arrow</kbd> - Jump back 1 minute</li>
            <li><kbd className="px-2 py-1 bg-gray-800 rounded">Right Arrow</kbd> - Jump forward 1 minute</li>
          </ul>
        </details>
      </div>
    </div>
  )
}
