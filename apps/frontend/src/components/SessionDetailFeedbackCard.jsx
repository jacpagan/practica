import React from 'react'

function InviteRow({ invite, onCopyInviteUrl, onShareInviteUrl, onTurnOffInviteCode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-900 truncate">{invite.label || 'Invite'}</p>
        <p className="text-xs text-gray-500 mt-1">
          {String(invite.status || 'pending').replace('_', ' ')} • created {new Date(invite.created_at).toLocaleString(undefined, { hour12: undefined })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onShareInviteUrl(invite.invite_url)} className="text-xs text-gray-700 hover:text-gray-900 transition-colors">
          Share invite link
        </button>
        <button type="button" onClick={() => onCopyInviteUrl(invite.invite_url, { successMessage: 'Invite link copied again' })} className="text-xs text-gray-700 hover:text-gray-900 transition-colors">
          Copy invite link
        </button>
        <button type="button" onClick={() => onTurnOffInviteCode(invite.id)} className="text-xs text-red-600 hover:text-red-700 transition-colors">
          Turn off
        </button>
      </div>
    </div>
  )
}

export default function SessionDetailFeedbackCard({
  canCreateShareLink,
  currentLoopRequest,
  currentLoopStatus,
  currentLoopSummary,
  feedbackReadyToReview,
  pendingShareIntentLabel,
  activeReviewLink,
  canEdit,
  sessionProcessingError,
  sessionProcessingStatus,
  onOpenRequestComposer,
  onOpenReviewRequestThread,
  onPatchReviewRequestStatus,
  onRevokeShareLink,
  onStartFollowUp,
  readyForFollowUp,
  revokingShare,
  showInviteManager,
  onToggleInviteManager,
  inviteManagerLoading,
  activeInviteCodes,
  latestInviteUrl,
  onCopyInviteUrl,
  onShareInviteUrl,
  onTurnOffInviteCode,
  sharing,
  waitingOnReviewer,
}) {
  if (!canEdit) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Optional feedback</p>
        <p className="text-xs text-gray-500 mt-1">Use feedback when you want it. It stays attached to this take and never replaces the thread.</p>
      </div>
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
        {!canCreateShareLink ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Not shareable yet</p>
            <p className="text-sm text-amber-900 mt-1">
              {sessionProcessingStatus === 'failed'
                ? sessionProcessingError || 'Fix playback processing before sharing this private link.'
                : 'Wait until playback is ready before sharing this private link.'}
            </p>
            {pendingShareIntentLabel ? (
              <p className="text-xs text-amber-900 mt-2">Queued next step: {pendingShareIntentLabel}. Practica will reopen it once playback is ready.</p>
            ) : null}
          </div>
        ) : null}

        {activeReviewLink?.url ? (
          <p className="text-xs text-gray-500">Private access • expires {new Date(activeReviewLink.expires_at).toLocaleString(undefined, { hour12: undefined })}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!waitingOnReviewer && !feedbackReadyToReview && !readyForFollowUp && currentLoopStatus !== 'flagged' ? (
            <button type="button" onClick={onOpenRequestComposer} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
              Share for feedback
            </button>
          ) : null}
          {activeReviewLink?.url ? (
            <button type="button" onClick={onRevokeShareLink} disabled={revokingShare} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white disabled:opacity-50 transition-colors">
              {revokingShare ? 'Turning off…' : 'Turn off'}
            </button>
          ) : null}
        </div>

        {!canCreateShareLink ? null : (
          <div className="pt-1">
            <button type="button" onClick={onToggleInviteManager} className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
              {showInviteManager ? 'Hide invites' : 'Manage invites'}
            </button>
          </div>
        )}

        {showInviteManager ? (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-3">
            {inviteManagerLoading ? <p className="text-xs text-gray-500">Loading invites…</p> : null}
            {!inviteManagerLoading && activeInviteCodes.length === 0 ? <p className="text-xs text-gray-600">No reviewer invites yet.</p> : null}
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
                  <button type="button" onClick={() => onShareInviteUrl(latestInviteUrl)} className="text-xs text-emerald-800 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors">
                    Share invite link
                  </button>
                  <button type="button" onClick={() => onCopyInviteUrl(latestInviteUrl, { successMessage: 'Invite link copied again' })} className="text-xs text-emerald-800 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors">
                    Copy again
                  </button>
                </div>
              </div>
            ) : null}
            {activeInviteCodes.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onCopyInviteUrl={onCopyInviteUrl}
                onShareInviteUrl={onShareInviteUrl}
                onTurnOffInviteCode={onTurnOffInviteCode}
              />
            ))}
          </div>
        ) : null}
      </div>

      {currentLoopSummary ? (
        <div className={`rounded-lg border px-3 py-3 space-y-3 ${currentLoopSummary.tone}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-900">{currentLoopSummary.title}</p>
              <p className="text-sm text-gray-700 mt-1">{currentLoopSummary.message}</p>
            </div>
            {currentLoopRequest ? (
              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${requestStatusTone[currentLoopRequest.status] || 'bg-gray-100 text-gray-700'}`}>
                {requestStatusLabel(currentLoopRequest.status)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {waitingOnReviewer && currentLoopRequest ? (
              <>
                <button type="button" onClick={() => onOpenReviewRequestThread(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                  Open thread
                </button>
                <button
                  type="button"
                  onClick={() => onPatchReviewRequestStatus(currentLoopRequest, 'revoked', 'Feedback request turned off')}
                  className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 transition-colors"
                >
                  Turn off
                </button>
              </>
            ) : null}
            {feedbackReadyToReview && currentLoopRequest ? (
              <button type="button" onClick={() => onOpenReviewRequestThread(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                Review feedback
              </button>
            ) : null}
            {readyForFollowUp && currentLoopRequest ? (
              <>
                <button type="button" onClick={() => onStartFollowUp(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                  {currentLoopStatus === 'needs_resubmission' ? 'Record new take' : currentLoopStatus === 'declined_unrelated' ? 'Record matching take' : 'Record next take'}
                </button>
                <button type="button" onClick={() => onOpenReviewRequestThread(currentLoopRequest)} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-white transition-colors">
                  Open private thread
                </button>
              </>
            ) : null}
            {currentLoopStatus === 'flagged' && currentLoopRequest ? (
              <button type="button" onClick={() => onOpenReviewRequestThread(currentLoopRequest)} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                Open private thread
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

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
