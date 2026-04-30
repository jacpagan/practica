import React from 'react'
import { feedbackCategoryLabel, feedbackCategoryTone, fmtTimer, videoFileAccept, videoUrl } from '../utils'

export default function SessionDetailFeedbackThread({
  videoFeedback,
  jumpToTimestamp,
  startEditingFeedback,
  deleteFeedback,
  deletingFeedbackId,
  editingFeedbackId,
  editingFeedbackTimestampSeconds,
  setEditingFeedbackTimestampSeconds,
  editFeedbackInputRef,
  pickEditFeedbackFile,
  editingFeedbackPreviewUrl,
  editingFeedbackVideoFile,
  savingFeedbackId,
  editFeedbackUploadProgressPercent,
  cancelEditingFeedback,
  saveFeedbackEdit,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Feedback</p>
        <p className="text-xs text-gray-500 mt-1">Responses stay private to you and the people included in this review.</p>
      </div>

      {videoFeedback.length === 0 ? (
        <div className="rounded-xl bg-gray-50 px-3 py-3">
          <p className="text-sm text-gray-600">No responses yet.</p>
          <p className="text-xs text-gray-400 mt-1">Use a private review or a private link when you want a response.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videoFeedback.map((item) => (
            <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{item.display_name || item.username || 'Viewer'}</p>
                    {item.feedback_category ? (
                      <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(item.feedback_category)}`}>
                        {feedbackCategoryLabel(item.feedback_category)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
                </div>
                {typeof item.timestamp_seconds === 'number' ? (
                  <button type="button" onClick={() => jumpToTimestamp(item.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
                    @{fmtTimer(item.timestamp_seconds)}
                  </button>
                ) : null}
              </div>
              {!item.review_request_id && item.authored_by_current_user ? (
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => startEditingFeedback(item)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteFeedback(item.id)} disabled={deletingFeedbackId === item.id} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {deletingFeedbackId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : null}
              {item.feedback_video ? (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                </div>
              ) : null}
              {item.text ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.text}</p>
              ) : null}
              {!item.review_request_id && editingFeedbackId === item.id ? (
                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingFeedbackTimestampSeconds}
                    onChange={(event) => setEditingFeedbackTimestampSeconds(event.target.value)}
                    placeholder="Timestamp seconds"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  />
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Video</p>
                      <button type="button" onClick={() => editFeedbackInputRef.current?.click()} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
                        {item.feedback_video || editingFeedbackVideoFile ? 'Replace video' : 'Add video'}
                      </button>
                    </div>
                    <input ref={editFeedbackInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickEditFeedbackFile} />
                    {editingFeedbackPreviewUrl ? (
                      <div className="rounded-xl overflow-hidden bg-black">
                        <video src={editingFeedbackPreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
                      </div>
                    ) : item.feedback_video ? (
                      <div className="rounded-xl overflow-hidden bg-black">
                        <video src={videoUrl(item.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
                      </div>
                    ) : null}
                    {savingFeedbackId === item.id && editingFeedbackVideoFile ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                          <span>Uploading replacement video…</span>
                          <span>{editFeedbackUploadProgressPercent !== null ? `${editFeedbackUploadProgressPercent}%` : 'Working…'}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.max(5, editFeedbackUploadProgressPercent || 0)}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={cancelEditingFeedback} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={() => saveFeedbackEdit(item.id)} disabled={savingFeedbackId === item.id} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                      {savingFeedbackId === item.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}