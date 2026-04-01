import React from 'react'
import VideoRecorder from './VideoRecorder'
import { MAX_RECORDER_DURATION_SECONDS } from '../utils'

export default function RecorderPage({ onRecorded, onCancel }) {
  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
      <main className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Record</h1>
          <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-900">Close</button>
        </div>
        <div className="rounded-[28px] overflow-hidden shadow-2xl border border-gray-200">
          <VideoRecorder
            onRecorded={(file, blobUrl) => onRecorded?.(file, blobUrl)}
            onCancel={onCancel}
            maxDuration={MAX_RECORDER_DURATION_SECONDS}
            autoUseOnStop={false}
            minAutoUseSeconds={0}
            autoOpenOnMount={true}
          />
        </div>
      </main>
    </div>
  )
}

