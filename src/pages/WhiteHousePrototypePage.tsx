import { useState } from 'react'
import { BabylonWhiteHouse } from '../components/sandbox/analytics/BabylonWhiteHouse'

export const WhiteHousePrototypePage = () => {
  const [leader, setLeader] = useState<'DEM' | 'GOP' | 'TIE'>('TIE')

  return (
    <div className="w-full h-screen bg-slate-900 flex flex-col">
      <div className="h-16 bg-slate-800 shadow-sm flex items-center justify-between px-6 z-10 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">White House Visualization Prototype</h1>
        
        <div className="flex gap-4">
            <button 
                onClick={() => setLeader('DEM')}
                className={`px-4 py-2 rounded font-bold transition-colors ${leader === 'DEM' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
                DEM LEADS
            </button>
            <button 
                onClick={() => setLeader('TIE')}
                className={`px-4 py-2 rounded font-bold transition-colors ${leader === 'TIE' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
                TOO CLOSE
            </button>
            <button 
                onClick={() => setLeader('GOP')}
                className={`px-4 py-2 rounded font-bold transition-colors ${leader === 'GOP' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
                GOP LEADS
            </button>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <BabylonWhiteHouse leader={leader} />
        
        <div className="absolute bottom-8 left-8 max-w-md bg-slate-900/80 p-6 rounded-lg backdrop-blur border border-slate-700 text-slate-200">
            <h3 className="font-bold text-lg mb-2">Visualizing the Outcome</h3>
            <p className="text-sm">
                This 3D model represents the White House. The exterior lighting dynamically reacts to the live election results.
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-slate-400">
                <li><span className="text-blue-400">Blue Lighting</span>: Democratic Lead</li>
                <li><span className="text-red-400">Red Lighting</span>: Republican Lead</li>
                <li><span className="text-yellow-400">Warm White</span>: Tie / Too Close to Call</li>
            </ul>
        </div>
      </div>
    </div>
  )
}
