import React, { forwardRef } from 'react'
import { feedbackCategoryLabel, feedbackCategoryTone, fmtTimer, videoFileAccept, videoUrl } from '../utils'

function ReviewRequestBadge({ requestItem }) {
  return (
    <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[requestItem.status] || 'bg-gray-100 text-gray-700'}`}>
      {requestStatusLabel(requestItem.status)}
    </span>
  )
}

function FeedbackCategoryPills({ counts }) {
  if (!counts || Object.keys(counts).length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {Object.entries(counts).map(([category, count]) => (
        <span key={category} className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(category)}`}>
          {feedbackCategoryLabel(category)} · {count}
        </span>
      ))}
    </div>
  )
}

function FeedbackItemCard({
  feedbackItem,
  jumpToTimestamp,
  onStartEditingFeedback,
  onDeleteFeedback,
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
  onCancelEditingFeedback,
  onSaveFeedbackEdit,
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{feedbackItem.author_display_name || 'Reviewer'}</p>
            {feedbackItem.feedback_category ? (
              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${feedbackCategoryTone(feedbackItem.feedback_category)}`}>
                {feedbackCategoryLabel(feedbackItem.feedback_category)}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-gray-400 mt-1">{new Date(feedbackItem.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
        </div>
        {typeof feedbackItem.timestamp_seconds === 'number' ? (
          <button type="button" onClick={() => jumpToTimestamp(feedbackItem.timestamp_seconds)} className="text-xs text-blue-700 hover:text-blue-900 transition-colors">
            @{fmtTimer(feedbackItem.timestamp_seconds)}
          </button>
        ) : null}
      </div>
      {feedbackItem.authored_by_current_user ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onStartEditingFeedback(feedbackItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
            Edit
          </button>
          <button type="button" onClick={() => onDeleteFeedback(feedbackItem.id)} disabled={deletingFeedbackId === feedbackItem.id} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
            {deletingFeedbackId === feedbackItem.id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ) : null}
      <div className="rounded-xl overflow-hidden bg-black">
        <video src={videoUrl(feedbackItem.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
      </div>
      {feedbackItem.text ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedbackItem.text}</p>
      ) : null}
      {editingFeedbackId === feedbackItem.id ? (
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
                {feedbackItem.feedback_video || editingFeedbackVideoFile ? 'Replace video' : 'Add video'}
              </button>
            </div>
            <input ref={editFeedbackInputRef} type="file" accept={videoFileAccept()} className="hidden" onChange={pickEditFeedbackFile} />
            {editingFeedbackPreviewUrl ? (
              <div className="rounded-xl overflow-hidden bg-black">
                <video src={editingFeedbackPreviewUrl} controls playsInline className="w-full aspect-video bg-black" />
              </div>
            ) : feedbackItem.feedback_video ? (
              <div className="rounded-xl overflow-hidden bg-black">
                <video src={videoUrl(feedbackItem.feedback_video)} controls playsInline className="w-full aspect-video bg-black" />
              </div>
            ) : null}
            {savingFeedbackId === feedbackItem.id && editingFeedbackVideoFile ? (
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
            <button type="button" onClick={onCancelEditingFeedback} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={() => onSaveFeedbackEdit(feedbackItem.id)} disabled={savingFeedbackId === feedbackItem.id} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {savingFeedbackId === feedbackItem.id ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RequestHistoryItem({
  requestItem,
  openReviewRequestThread,
  startFollowUp,
  patchReviewRequestStatus,
  copyReviewRequestLink,
  shareReviewRequestLink,
  jumpToTimestamp,
  deletingFeedbackId,
  onStartEditingFeedback,
  onDeleteFeedback,
  editingFeedbackId,
  editingFeedbackTimestampSeconds,
  setEditingFeedbackTimestampSeconds,
  editFeedbackInputRef,
  pickEditFeedbackFile,
  editingFeedbackPreviewUrl,
  editingFeedbackVideoFile,
  savingFeedbackId,
  editFeedbackUploadProgressPercent,
  onCancelEditingFeedback,
  onSaveFeedbackEdit,
}) {
  return (
    <div key={requestItem.id} className="rounded-xl bg-gray-50 px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{requestItem.reviewer?.display_name || requestItem.reviewer?.username || 'Reviewer'}</p>
            <ReviewRequestBadge requestItem={requestItem} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{requestItem.instrument}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Sent {new Date(requestItem.created_at).toLocaleString(undefined, { hour12: undefined })}</p>
          <p className="text-xs text-gray-400 mt-1">Replies: {requestItem.response_count || 0}</p>
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-800">{requestItem.goal}</p>
        {requestItem.exercise_or_song ? <p className="text-xs text-gray-500 mt-1">Focus {requestItem.exercise_or_song}</p> : null}
        {requestItem.status_reason ? <p className="text-xs text-gray-600 mt-2">Why {requestReasonLabel(requestItem.status_reason)}</p> : null}
        {requestItem.status_note ? <p className="text-xs text-gray-600 mt-1">Note: {requestItem.status_note}</p> : null}
        <FeedbackCategoryPills counts={requestItem.feedback_category_counts} />
      </div>
      {Array.isArray(requestItem.feedback_items) && requestItem.feedback_items.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Thread</p>
          {requestItem.feedback_items.map((feedbackItem) => (
            <FeedbackItemCard
              key={feedbackItem.id}
              feedbackItem={feedbackItem}
              jumpToTimestamp={jumpToTimestamp}
              onStartEditingFeedback={onStartEditingFeedback}
              onDeleteFeedback={onDeleteFeedback}
              deletingFeedbackId={deletingFeedbackId}
              editingFeedbackId={editingFeedbackId}
              editingFeedbackTimestampSeconds={editingFeedbackTimestampSeconds}
              setEditingFeedbackTimestampSeconds={setEditingFeedbackTimestampSeconds}
              editFeedbackInputRef={editFeedbackInputRef}
              pickEditFeedbackFile={pickEditFeedbackFile}
              editingFeedbackPreviewUrl={editingFeedbackPreviewUrl}
              editingFeedbackVideoFile={editingFeedbackVideoFile}
              savingFeedbackId={savingFeedbackId}
              editFeedbackUploadProgressPercent={editFeedbackUploadProgressPercent}
              onCancelEditingFeedback={onCancelEditingFeedback}
              onSaveFeedbackEdit={onSaveFeedbackEdit}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(requestItem.feedback_link?.url || requestItem.review_link?.url) ? (
          <>
            <button type="button" onClick={() => shareReviewRequestLink(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
              Share request link
            </button>
            <button type="button" onClick={() => copyReviewRequestLink(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
              Copy link
            </button>
          </>
        ) : null}
        {(requestItem.feedback_link?.token || requestItem.review_link?.token) ? (
          <button type="button" onClick={() => openReviewRequestThread(requestItem)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
            {requestItem.status === 'responded' ? 'Review feedback' : 'Open thread'}
          </button>
        ) : null}
        {['responded', 'viewed', 'needs_resubmission', 'declined_unrelated'].includes(requestItem.status) && requestItem.reviewer ? (
          <button
            type="button"
            onClick={() => startFollowUp(requestItem)}
            className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors"
          >
            Record next take
          </button>
        ) : null}
        {['viewed', 'responded', 'needs_resubmission', 'declined_unrelated'].includes(requestItem.status) ? (
          <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'resubmitted', 'Marked as retried')} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
            Mark continued
          </button>
        ) : null}
        {['requested', 'opened'].includes(requestItem.status) ? (
          <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'revoked', 'Feedback request turned off')} className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
            Turn off
          </button>
        ) : null}
        {['viewed', 'resubmitted', 'needs_resubmission', 'declined_unrelated', 'flagged'].includes(requestItem.status) ? (
          <button type="button" onClick={() => patchReviewRequestStatus(requestItem, 'closed', 'Feedback request closed')} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
            Close
          </button>
        ) : null}
      </div>
    </div>
  )
}

const SessionDetailReviewPanel = forwardRef(function SessionDetailReviewPanel(
  {
    canEdit,
    showRequestComposer,
    setShowRequestComposer,
    canCreateShareLink,
    selectedReviewerName,
    selectedReviewer,
    setSelectedReviewer,
    setReviewerQuery,
    recentReviewersLoading,
    designatedReviewers,
    recentReviewers,
    chooseReviewer,
    reviewerQuery,
    reviewerSearchLoading,
    reviewerResults,
  latestInviteUrl,
  copyInviteUrl,
  shareInviteUrl,
  submitFeedbackChoice,
    creatingRequest,
    sharing,
    reviewRequests,
    requestsLoading,
    showRequestHistory,
    setShowRequestHistory,
    currentLoopSummary,
    currentLoopRequest,
    currentLoopStatus,
    waitingOnReviewer,
    feedbackReadyToReview,
    readyForFollowUp,
    activeReviewLink,
    pendingShareIntentLabel,
    sessionProcessingStatus,
    sessionProcessingError,
    showInviteManager,
    toggleInviteManager,
    inviteManagerLoading,
    activeInviteCodes,
    copyInviteUrlAgain,
    turnOffInviteCode,
    openReviewRequestThread,
    patchReviewRequestStatus,
    startFollowUp,
  copyReviewRequestLink,
  shareReviewRequestLink,
  jumpToTimestamp,
    deletingFeedbackId,
    startEditingFeedback,
    deleteFeedback,
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
  },
  ref,
) {
  if (!canEdit) return null

  return (
    <div ref={ref} className="space-y-4">
      {showRequestComposer ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
          {!canCreateShareLink ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Playback ready required</p>
              <p className="text-sm text-amber-900 mt-1">Wait until this take is ready before sending a request.</p>
            </div>
          ) : null}

          {selectedReviewerName ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-800">They will see it in Practica</p>
              <p className="text-sm text-blue-900">This will ask {selectedReviewerName} for private feedback. On iPhone, tap Share after the invite link is created to text it in Messages.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Who is this for?</label>
            {selectedReviewer ? (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedReviewer.display_name || selectedReviewer.username}</p>
                  <p className="text-xs text-gray-500">@{selectedReviewer.username}</p>
                </div>
                <button type="button" onClick={() => { setSelectedReviewer(null); setReviewerQuery('') }} className="text-xs text-red-600 hover:text-red-700 transition-colors">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentReviewersLoading ? <p className="text-xs text-gray-500">Loading…</p> : null}
                {!recentReviewersLoading && designatedReviewers.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-800">No reviewers yet</p>
                    <p className="text-sm text-amber-900 mt-1">Keep going and Practica will copy an invite link for the person you want feedback from.</p>
                  </div>
                ) : null}
                {recentReviewers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentReviewers.map((reviewer) => (
                      <button
                        key={reviewer.id}
                        type="button"
                        onClick={() => chooseReviewer(reviewer)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {reviewer.display_name || reviewer.username}
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  type="text"
                  value={reviewerQuery}
                  onChange={(event) => setReviewerQuery(event.target.value)}
                  placeholder={designatedReviewers.length > 0 ? 'Search existing reviewers or type a new name' : 'Type the name of the person you want feedback from'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
                <p className="text-xs text-gray-500">Pick someone already on your list, or leave it as a new name and Practica will copy an invite link.</p>
                {reviewerSearchLoading ? <p className="text-xs text-gray-500">Searching…</p> : null}
                {reviewerResults.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    {reviewerResults.map((reviewer) => (
                      <button
                        key={reviewer.id}
                        type="button"
                        onClick={() => chooseReviewer(reviewer)}
                        className="w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100"
                      >
                        <p className="text-sm font-medium text-gray-900">{reviewer.display_name || reviewer.username}</p>
                        <p className="text-xs text-gray-500 mt-1">@{reviewer.username}</p>
                      </button>
                    ))}
                  </div>
                ) : reviewerQuery.trim().length >= 2 && !reviewerSearchLoading && designatedReviewers.length > 0 ? <p className="text-xs text-gray-500">No match yet. Keep going to copy an invite link for this person.</p> : null}
                {latestInviteUrl ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Invite link ready</p>
                    <input
                      type="text"
                      readOnly
                      value={latestInviteUrl}
                      className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg bg-white text-gray-700"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => shareInviteUrl(latestInviteUrl)} className="text-xs text-emerald-800 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors">
                        Share invite link
                      </button>
                      <button type="button" onClick={() => copyInviteUrlAgain(latestInviteUrl, { successMessage: 'Invite link copied again' })} className="text-xs text-emerald-800 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors">
                        Copy again
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          {/* Title of the practice thread is sufficient context; no extra request fields */}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowRequestComposer(false)} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
              Cancel
            </button>
            <button type="button" disabled={creatingRequest || sharing || !canCreateShareLink} onClick={submitFeedbackChoice} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {creatingRequest ? 'Sending…' : sharing ? 'Copying…' : selectedReviewer?.id ? 'Send request' : 'Copy invite link'}
            </button>
          </div>
        </div>
      ) : null}

      {requestsLoading ? (
        <div className="rounded-xl border border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Loading requests…</div>
      ) : reviewRequests.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">History</p>
            <button type="button" onClick={() => setShowRequestHistory((current) => !current)} className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white transition-colors">
              {showRequestHistory ? 'Hide history' : 'Show history'}
            </button>
          </div>
          {!showRequestHistory ? null : (
            <div className="space-y-3">
              {reviewRequests.map((requestItem) => (
                <RequestHistoryItem
                  key={requestItem.id}
                  requestItem={requestItem}
                  openReviewRequestThread={openReviewRequestThread}
                  startFollowUp={startFollowUp}
                  patchReviewRequestStatus={patchReviewRequestStatus}
                  copyReviewRequestLink={copyReviewRequestLink}
                  shareReviewRequestLink={shareReviewRequestLink}
                  jumpToTimestamp={jumpToTimestamp}
                  deletingFeedbackId={deletingFeedbackId}
                  onStartEditingFeedback={startEditingFeedback}
                  onDeleteFeedback={deleteFeedback}
                  editingFeedbackId={editingFeedbackId}
                  editingFeedbackTimestampSeconds={editingFeedbackTimestampSeconds}
                  setEditingFeedbackTimestampSeconds={setEditingFeedbackTimestampSeconds}
                  editFeedbackInputRef={editFeedbackInputRef}
                  pickEditFeedbackFile={pickEditFeedbackFile}
                  editingFeedbackPreviewUrl={editingFeedbackPreviewUrl}
                  editingFeedbackVideoFile={editingFeedbackVideoFile}
                  savingFeedbackId={savingFeedbackId}
                  editFeedbackUploadProgressPercent={editFeedbackUploadProgressPercent}
                  onCancelEditingFeedback={cancelEditingFeedback}
                  onSaveFeedbackEdit={saveFeedbackEdit}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
})

export default SessionDetailReviewPanel

const requestStatusTone = {
  requested: 'bg-amber-100 text-amber-800',
  opened: 'bg-blue-100 text-blue-800',
  responded: 'bg-emerald-100 text-emerald-800',
  viewed: 'bg-violet-100 text-violet-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  declined_unrelated: 'bg-rose-100 text-rose-800',
  flagged: 'bg-red-100 text-red-800',
  resubmitted: 'bg-fuchsia-100 text-fuchsia-800',
  closed: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
}

const requestStatusLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'Unknown'
  return normalized.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const requestReasonLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'needs_new_take') return 'Needs new take'
  if (normalized === 'unrelated_video') return 'Unrelated take'
  if (normalized === 'unsafe_content') return 'Unsafe content'
  if (normalized === 'spam') return 'Spam'
  if (normalized === 'other') return 'Other'
  return normalized.replace(/_/g, ' ')
}
