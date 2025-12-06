import { useState } from 'react'
import { BabylonInteractiveBallot } from '../components/sandbox/voting/BabylonInteractiveBallot'
import { BabylonRCVBallot } from '../components/sandbox/voting/BabylonRCVBallot'

export const VotingPrototypePage = () => {
  const [ballotType, setBallotType] = useState<'standard' | 'rcv'>('standard')

  return (
    <div className="w-full h-screen bg-gray-100 flex flex-col">
      <div className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-10">
        <h1 className="text-xl font-bold text-slate-800">Voting System Prototype</h1>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setBallotType('standard')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    ballotType === 'standard' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Standard Ballot
            </button>
            <button 
                onClick={() => setBallotType('rcv')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    ballotType === 'rcv' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Ranked Choice
            </button>
        </div>
      </div>
      <div className="flex-1 relative">
        {ballotType === 'standard' 
            ? <BabylonInteractiveBallot onSwitchBallotType={() => setBallotType('rcv')} /> 
            : <BabylonRCVBallot onSwitchBallotType={() => setBallotType('standard')} />
        }
      </div>
    </div>
  )
}
