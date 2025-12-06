import { BabylonCountyMap } from '../components/sandbox/analytics/BabylonCountyMap'

export const CountyMapTestPage = () => {
  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col">
      <div className="h-16 bg-gray-800 shadow-sm flex items-center px-6 z-10 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">3D County Analytics Map</h1>
      </div>
      <div className="flex-1 relative">
        <BabylonCountyMap />
      </div>
    </div>
  )
}
