import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, sessionVideoSources, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import PracticeThreadField from './PracticeThreadField'
import SessionDetailFeedbackCard from './SessionDetailFeedbackCard'
import useReviewRequestFlow from '../hooks/useReviewRequestFlow'
import SessionDetailReviewPanel from './SessionDetailReviewPanel'
import SessionDetailFeedbackThread from './SessionDetailFeedbackThread'
import useSessionDetailEditActions from '../hooks/useSessionDetailEditActions'
import useSessionDetailMediaActions from '../hooks/useSessionDetailMediaActions'
import useFeedbackEditActions from '../hooks/useFeedbackEditActions'

function SessionDetail({ session: initialSession, token, onBack, onOpenReviewRequest, initialReviewRequestDraft = null, onReviewRequestDraftCleared, onSessionUpdate, onSessionDelete, justUploaded = false, onRecordAnother, onOpenSeries, practiceThreadOptions = [] }) {
  const toast = useToast()
  const confirm = useConfirm()
  const videoRef = useRef(null)
  const loopDetailsRef = useRef(null)
  const [session, setSession] = useState(initialSession)
  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])
  const canEdit = Boolean(session?.can_edit)
  const canCreateShareLink = session?.processing_status === 'ready'
  const {
    activeReviewLink,
    activeInviteCodes,
    chooseReviewer,
    currentLoopRequest,
    currentLoopStatus,
    currentLoopSummary,
    creatingRequest,
    designatedReviewers,
    feedbackReadyToReview,
    copyInviteUrl,
    copyReviewRequestLink,
    inviteManagerLoading,
    justUploadedWithoutRequest,
    latestInviteUrl,
    loadReviewRequests,
    openRequestComposer,
    openReviewRequestThread,
    pendingShareIntentLabel,
    patchReviewRequestStatus,
    recentReviewers,
    recentReviewersLoading,
    readyForFollowUp,
    requestExerciseOrSong,
    requestGoal,
    requestInstrument,
    requestNotes,
    reviewRequests,
    requestsLoading,
    revokeShareLink,
    reviewerQuery,
    reviewerResults,
    reviewerSearchLoading,
    selectedReviewer,
    selectedReviewerName,
    setActiveReviewLink,
    setPendingShareIntent,
    setRequestExerciseOrSong,
    setRequestGoal,
    setRequestInstrument,
    setRequestNotes,
    setReviewerQuery,
    setSelectedReviewer,
    setShowInviteManager,
    setShowLoopDetails,
    setShowRequestComposer,
    setShowRequestHistory,
    setShowRequestDetails,
    sharing,
    showInviteManager,
    showLoopDetails,
    showRequestComposer,
    showRequestDetails,
    showRequestHistory,
    submitFeedbackChoice,
    toggleInviteManager,
    turnOffInviteCode,
    waitingOnReviewer,
    startFollowUp,
  } = useReviewRequestFlow({
    session,
    token,
    authHeaders,
    canEdit,
    canCreateShareLink,
    justUploaded,
    initialReviewRequestDraft,
    onReviewRequestDraftCleared,
    onOpenReviewRequest,
    onRecordAnother,
    toast,
    confirm,
    loopDetailsRef,
  })
  const playbackSources = useMemo(() => sessionVideoSources(session, session?.local_preview_url || ''), [session])
  const {
    cancelEditing,
    editDescription,
    editPracticeSeries,
    editTitle,
    editing,
    refreshSession,
    refreshing,
    saveEdits,
    saving,
    startEditing,
    setEditDescription,
    setEditPracticeSeries,
    setEditTitle,
  } = useSessionDetailEditActions({
    session,
    token,
    authHeaders,
    toast,
    onSessionUpdate,
    loadReviewRequests,
    setSession,
    setActiveReviewLink,
  })
  const {
    deleting,
    deleteSession,
    handlePlaybackError,
    jumpToTimestamp,
    playbackFailed,
    playbackSourceIndex,
    retryProcessing,
    retryingProcessing,
  } = useSessionDetailMediaActions({
    session,
    token,
    authHeaders,
    confirm,
    toast,
    onSessionUpdate,
    onSessionDelete,
    setSession,
    playbackSources,
    videoRef,
  })
  const playableUrl = playbackSources[playbackSourceIndex] || null
  const videoFeedback = Array.isArray(session?.video_feedback)
    ? session.video_feedback
    : []

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  const {
    editFeedbackInputRef,
    editingFeedbackId,
    editingFeedbackTimestampSeconds,
    editingFeedbackVideoFile,
    editingFeedbackPreviewUrl,
    savingFeedbackId,
    deletingFeedbackId,
    editFeedbackUploadProgressPercent,
    startEditingFeedback,
    cancelEditingFeedback,
    pickEditFeedbackFile,
    saveFeedbackEdit,
    deleteFeedback,
    setEditingFeedbackTimestampSeconds,
  } = useFeedbackEditActions({
    token,
    sessionId: session?.id,
    authHeaders,
    confirm,
    toast,
    refreshSession,
  })

  useEffect(() => {
    if (!token || !session?.id) return undefined
    if (session.processing_status !== 'processing') return undefined

    let cancelled = false
    let timeoutId = null

    const poll = async () => {
      if (cancelled) return
      await refreshSession({ silent: true })
      if (cancelled) return
      timeoutId = window.setTimeout(poll, 5000)
    }

    timeoutId = window.setTimeout(poll, 5000)
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [authHeaders, loadReviewRequests, onSessionUpdate, session?.id, session?.processing_status, token])

  return (
    <div className="px-4 sm:px-6 py-4 pb-28 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to library</button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="aspect-video bg-black">
          {playableUrl && !playbackFailed ? (
            <video key={playableUrl} ref={videoRef} src={playableUrl} controls playsInline onError={handlePlaybackError} className="w-full h-full bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
              {session?.processing_status === 'ready'
                ? 'This video is marked ready, but playback failed. Try downloading the original below.'
                : 'Video is still preparing for playback.'}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-4 space-y-3">
          {editing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              />
              <PracticeThreadField
                value={editPracticeSeries}
                onChange={setEditPracticeSeries}
                options={practiceThreadOptions}
                placeholder="Choose a thread or create a new one"
              />
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
                placeholder="Add a note"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={saveEdits} disabled={saving} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEditing} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
                  {session.practice_series ? (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{session.practice_series}</span>
                      <button type="button" onClick={() => onOpenSeries?.(session.practice_series)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                        View thread
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {justUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">This take is now in your private library.</p>
                </div>
              ) : null}

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              {(session.recorded_at || session.duration_seconds) ? (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer list-none hover:text-gray-900 transition-colors">Video details</summary>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {session.recorded_at ? <span className="rounded-full bg-gray-100 px-3 py-1">{new Date(session.recorded_at).toLocaleString(undefined, { hour12: undefined })}</span> : null}
                    {session.duration_seconds ? <span className="rounded-full bg-gray-100 px-3 py-1">{fmtTimer(session.duration_seconds)}</span> : null}
                  </div>
                </details>
              ) : null}

              {session.processing_status === 'failed' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">Playback needs another pass.</p>
                  <p className="text-sm text-amber-800 mt-1">{session.processing_error || 'This take is not ready for browser playback yet.'}</p>
                  {canEdit ? (
                    <button type="button" onClick={retryProcessing} disabled={retryingProcessing} className="mt-3 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg px-4 py-2.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {retryingProcessing ? 'Retrying…' : 'Retry playback'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {playbackFailed && session.processing_status === 'ready' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-900">Playback is not available on this device yet.</p>
                  <p className="text-sm text-amber-800 mt-1">Retry playback to generate a more compatible version for Mac and phone browsers.</p>
                  {canEdit ? (
                    <button type="button" onClick={retryProcessing} disabled={retryingProcessing} className="mt-3 text-sm font-medium text-amber-900 border border-amber-300 rounded-lg px-4 py-2.5 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                      {retryingProcessing ? 'Retrying…' : 'Retry playback'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <SessionDetailFeedbackCard
                canEdit={canEdit}
                canCreateShareLink={canCreateShareLink}
                currentLoopRequest={currentLoopRequest}
                currentLoopStatus={currentLoopStatus}
                currentLoopSummary={currentLoopSummary}
                feedbackReadyToReview={feedbackReadyToReview}
                pendingShareIntentLabel={pendingShareIntentLabel}
                activeReviewLink={activeReviewLink}
                onOpenRequestComposer={openRequestComposer}
                onOpenReviewRequestThread={openReviewRequestThread}
                onPatchReviewRequestStatus={patchReviewRequestStatus}
                onRevokeShareLink={revokeShareLink}
                onStartFollowUp={startFollowUp}
                readyForFollowUp={readyForFollowUp}
                revokingShare={sharing}
                showInviteManager={showInviteManager}
                onToggleInviteManager={toggleInviteManager}
                inviteManagerLoading={inviteManagerLoading}
                activeInviteCodes={activeInviteCodes}
                onCopyInviteUrl={copyInviteUrl}
                onTurnOffInviteCode={turnOffInviteCode}
                sessionProcessingError={session.processing_error}
                sessionProcessingStatus={session.processing_status}
                waitingOnReviewer={waitingOnReviewer}
              />

              <SessionDetailReviewPanel
                ref={loopDetailsRef}
                canEdit={canEdit}
                showRequestComposer={showRequestComposer}
                setShowRequestComposer={setShowRequestComposer}
                canCreateShareLink={canCreateShareLink}
                selectedReviewerName={selectedReviewerName}
                selectedReviewer={selectedReviewer}
                setSelectedReviewer={setSelectedReviewer}
                setReviewerQuery={setReviewerQuery}
                recentReviewersLoading={recentReviewersLoading}
                designatedReviewers={designatedReviewers}
                recentReviewers={recentReviewers}
                chooseReviewer={chooseReviewer}
                reviewerQuery={reviewerQuery}
                reviewerSearchLoading={reviewerSearchLoading}
                reviewerResults={reviewerResults}
                latestInviteUrl={latestInviteUrl}
                copyInviteUrlAgain={copyInviteUrl}
                submitFeedbackChoice={submitFeedbackChoice}
                creatingRequest={creatingRequest}
                sharing={sharing}
                reviewRequests={reviewRequests}
                requestsLoading={requestsLoading}
                showRequestHistory={showRequestHistory}
                setShowRequestHistory={setShowRequestHistory}
                currentLoopSummary={currentLoopSummary}
                currentLoopRequest={currentLoopRequest}
                currentLoopStatus={currentLoopStatus}
                waitingOnReviewer={waitingOnReviewer}
                feedbackReadyToReview={feedbackReadyToReview}
                readyForFollowUp={readyForFollowUp}
                activeReviewLink={activeReviewLink}
                pendingShareIntentLabel={pendingShareIntentLabel}
                sessionProcessingStatus={session.processing_status}
                sessionProcessingError={session.processing_error}
                showInviteManager={showInviteManager}
                toggleInviteManager={toggleInviteManager}
                inviteManagerLoading={inviteManagerLoading}
                activeInviteCodes={activeInviteCodes}
                turnOffInviteCode={turnOffInviteCode}
                openReviewRequestThread={openReviewRequestThread}
                patchReviewRequestStatus={patchReviewRequestStatus}
                startFollowUp={startFollowUp}
                copyReviewRequestLink={copyReviewRequestLink}
                jumpToTimestamp={jumpToTimestamp}
                deletingFeedbackId={deletingFeedbackId}
                startEditingFeedback={startEditingFeedback}
                deleteFeedback={deleteFeedback}
                editingFeedbackId={editingFeedbackId}
                editingFeedbackTimestampSeconds={editingFeedbackTimestampSeconds}
                setEditingFeedbackTimestampSeconds={setEditingFeedbackTimestampSeconds}
                editFeedbackInputRef={editFeedbackInputRef}
                pickEditFeedbackFile={pickEditFeedbackFile}
                editingFeedbackPreviewUrl={editingFeedbackPreviewUrl}
                editingFeedbackVideoFile={editingFeedbackVideoFile}
                savingFeedbackId={savingFeedbackId}
                editFeedbackUploadProgressPercent={editFeedbackUploadProgressPercent}
                cancelEditingFeedback={cancelEditingFeedback}
                saveFeedbackEdit={saveFeedbackEdit}
              />

              <details className="border-t border-gray-100 pt-4">
                <summary className="cursor-pointer list-none text-sm text-gray-500 hover:text-gray-900 transition-colors">More options</summary>
                <div className="flex flex-wrap gap-2 pt-4">
                  {canEdit ? (
                    <button type="button" onClick={startEditing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Edit video
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button type="button" onClick={deleteSession} disabled={deleting} className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                      {deleting ? 'Deleting…' : 'Delete video'}
                    </button>
                  ) : null}
                  <button type="button" onClick={refreshSession} disabled={refreshing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  {canEdit && session.video_file ? (
                    <a href={videoUrl(session.video_file)} download className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Download original
                    </a>
                  ) : null}
                </div>
              </details>

              <SessionDetailFeedbackThread
                videoFeedback={videoFeedback}
                jumpToTimestamp={jumpToTimestamp}
                startEditingFeedback={startEditingFeedback}
                deleteFeedback={deleteFeedback}
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
                cancelEditingFeedback={cancelEditingFeedback}
                saveFeedbackEdit={saveFeedbackEdit}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail