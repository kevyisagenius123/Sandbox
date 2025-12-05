import React from 'react'
import { PennsylvaniaCallBanner } from '../components/broadcast/PennsylvaniaCallBanner'

const BroadcastCallPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <PennsylvaniaCallBanner />
    </div>
  )
}

export default BroadcastCallPage
