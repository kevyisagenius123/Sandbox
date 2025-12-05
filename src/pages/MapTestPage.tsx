import React from 'react'
import USStatesMap3D from '../components/landing/USStatesMap3D'

const MapTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-white mb-4">US States Map 3D Test</h1>
        <p className="text-slate-400 mb-6">
          Interactive 3D map with 2024 election data. Drag to rotate, scroll to zoom.
        </p>
      </div>
      
      <div className="w-full h-[calc(100vh-140px)]">
        <USStatesMap3D height={window.innerHeight - 140} />
      </div>
    </div>
  )
}

export default MapTestPage
