import React from 'react'
import TodayMoveCard from './TodayMoveCard'

export default function FirstProofOnboarding({
  user = null,
  onStartFirstProof,
}) {
  return (
    <div className="px-4 py-6 pb-28 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Move with me</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            One tiny movement. One private recording. See yourself improve.
          </p>
        </div>

        <TodayMoveCard onTryMove={(move) => onStartFirstProof?.(move)} />

        {user?.username ? (
          <p className="text-xs text-gray-400">Signed in as {user.display_name || user.username}</p>
        ) : null}
      </div>
    </div>
  )
}
