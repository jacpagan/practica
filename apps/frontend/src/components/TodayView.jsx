import React, { useMemo } from 'react'
import SessionListItem from './SessionListItem'
import { calculatePracticeProgress, fmtDate } from '../utils'

export default function TodayView({
  sessions = [],
  sessionsLoading = false,
  onRecordProof,
  onOpenSession,
  onOpenProgress,
}) {
  const progress = useMemo(() => calculatePracticeProgress(sessions), [sessions])

  if (sessionsLoading) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-28 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const hasProofs = progress.proofCount > 0
  const progressPercent = Math.min(99, Math.max(0, Math.round((progress.xp % 100))))

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Today</p>
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mt-1">
              {hasProofs ? 'One small proof. One more step.' : 'Start small. Prove it once.'}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Practica is a private game for tiny actions, proof, and progress. Keep today short enough to finish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{progress.level} {progress.level === 1 ? 'level' : 'levels'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{progress.streak} {progress.streak === 1 ? 'day streak' : 'day streaks'}</span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">{progress.proofCount} {progress.proofCount === 1 ? 'proof' : 'proofs'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">Current skill</p>
            <h3 className="text-xl font-semibold text-gray-900 mt-1 truncate">{progress.activeSkill}</h3>
            <p className="text-sm text-gray-600 mt-2">
              Do one tiny action for this skill today. Record it, save it, and keep the loop alive.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRecordProof}
                className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Record proof
              </button>
              <button
                type="button"
                onClick={onOpenProgress}
                className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                View progress
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">XP</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-3xl font-semibold text-gray-900 tracking-tight">{progress.xp}</span>
              <span className="text-sm text-gray-500 pb-1">points</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {progress.nextLevelRemaining === 0
                ? 'Level up ready.'
                : `${progress.nextLevelRemaining} more points to level ${progress.level + 1}.`}
            </p>
            <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(10, progressPercent)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Current streak</p>
            <p className="text-2xl font-semibold text-gray-900 mt-2">{progress.streak}</p>
            <p className="text-sm text-gray-600 mt-1">days in a row with proof.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Proof history</p>
            <p className="text-2xl font-semibold text-gray-900 mt-2">{progress.proofCount}</p>
            <p className="text-sm text-gray-600 mt-1">proofs in the archive.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Skill history</p>
            <p className="text-2xl font-semibold text-gray-900 mt-2">{progress.skillCount}</p>
            <p className="text-sm text-gray-600 mt-1">named skills or habits used.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Recent proof</p>
            <h3 className="text-lg font-semibold text-gray-900 mt-1">What you already did</h3>
            <p className="text-sm text-gray-500 mt-1">Review the last few proofs to keep the loop real.</p>
          </div>

          {progress.recentProofs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center bg-white">
              <p className="text-sm text-gray-700">No proof yet.</p>
              <p className="text-xs text-gray-500 mt-1">Record your first tiny action to start the game.</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onRecordProof}
                  className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Record proof
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {progress.recentProofs.map((session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  onOpen={() => onOpenSession?.(session, { view: 'detail', sessionId: session.id })}
                  showSeries
                  prefetch
                  minimal
                />
              ))}
            </div>
          )}
        </div>

        {progress.latestProofAt ? (
          <p className="text-xs text-gray-500">
            Latest proof: {fmtDate(progress.latestProofAt)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
