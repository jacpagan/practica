import React from 'react'
import SessionListItem from './SessionListItem'

export default function VideoLibrary({ sessions = [], loading, onRecord, onOpenSession, highlightSession }) {
  const videos = [...sessions].sort((a, b) => new Date(b.recorded_at || b.created_at) - new Date(a.recorded_at || a.created_at))
  return (
    <div className="space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-950">Your videos</h1>
          <p className="mt-2 text-sm text-gray-500">Record your practice. Watch it back. Keep it private.</p>
        </div>
        <button type="button" onClick={onRecord} className="rounded-full bg-gray-950 px-5 py-3 text-sm font-medium text-white">Record</button>
      </header>
      {loading ? <p role="status" className="text-sm text-gray-500">Loading videos</p> : videos.length ? (
        <div className="space-y-3">
          {videos.map((session) => <SessionListItem key={session.id} session={session} highlight={highlightSession?.id === session.id} onOpen={() => onOpenSession(session, { view: 'progress', sessionId: null })} />)}
        </div>
      ) : <div className="border-t border-gray-200 py-12"><h2 className="text-lg font-medium">Start with one video</h2><p className="mt-2 text-sm text-gray-500">Whatever you’re practicing, this is your space to record it.</p></div>}
    </div>
  )
}
