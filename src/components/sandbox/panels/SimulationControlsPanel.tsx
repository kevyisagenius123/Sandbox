import React from 'react'
import { SimulationControls } from '../SimulationControls'

interface SimulationControlsPanelProps {
  isPlaying: boolean
  speed: number
  currentTimeSeconds: number
  timelinePercent: number
  reportingPercent: number
  totalDurationSeconds: number
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (value: number) => void
  onJumpTo: (seconds: number) => void
}

export const SimulationControlsPanel: React.FC<SimulationControlsPanelProps> = (props) => {
  return <SimulationControls {...props} />
}
