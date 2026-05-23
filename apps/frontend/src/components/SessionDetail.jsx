import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, sessionVideoSources, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import SkillField from './SkillField'
import useSessionDetailEditActions from '../hooks/useSessionDetailEditActions'
import useSessionDetailMediaActions from '../hooks/useSessionDetailMediaActions'

function SessionDetail({
  session: initialSession,
  sessions = [],
  token,
  onBack,
  onOpenProgress,
  onSessionUpdate,
  onSessionDelete,
  justUploaded = false,
  onRecordAnother,
  onOpenSession,
  onOpenSeries,
  skillOptions = [],
  returnRoute = null,
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const videoRef = useRef(null)
  const [session, setSession] = useState(initialSession)
  const swipeRef = useRef(null)
  const authHeaders = useMemo(() => (token ? { Authorization: `Token ${token}` } : {}), [token])
  const canEdit = Boolean(session?.can_edit)
  const returnRouteView = String(returnRoute?.view || '').trim()
  const returnsToSkill = returnRouteView === 'skill' && String(returnRoute?.seriesName || '').trim().length > 0
  const backLabel = returnsToSkill ? 'Back to skill' : 'Back to progress'
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
    setSession,
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
  const threadNavigation = useMemo(() => {
    const currentId = Number(session?.id)
    if (!currentId) return { items: [], index: -1, previous: null, next: null }

    const currentSeries = String(session?.practice_series || '').trim()
    const sourceItems = Array.isArray(sessions) ? sessions : []
    const byId = new Map()
    sourceItems.forEach((item) => {
      if (item?.id) byId.set(Number(item.id), item)
    })
    byId.set(currentId, session)

    const items = Array.from(byId.values())
      .filter((item) => {
        const itemSeries = String(item?.practice_series || '').trim()
        return currentSeries ? itemSeries === currentSeries : !itemSeries
      })
      .sort((left, right) => {
        const leftTime = new Date(left.recorded_at || left.created_at || 0).getTime() || 0
        const rightTime = new Date(right.recorded_at || right.created_at || 0).getTime() || 0
        return leftTime - rightTime
      })

    const index = items.findIndex((item) => Number(item?.id) === currentId)
    return {
      items,
      index,
      previous: index > 0 ? items[index - 1] : null,
      next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
    }
  }, [session, sessions])
  const hasThreadNavigation = threadNavigation.items.length > 1
  const threadLabel = session?.practice_series ? session.practice_series : 'Ungrouped'
  const threadPositionLabel = hasThreadNavigation && threadNavigation.index >= 0
    ? `Proof ${threadNavigation.index + 1} of ${threadNavigation.items.length}`
    : ''

  const openThreadSession = (targetSession) => {
    if (!targetSession?.id) return
    onOpenSession?.(targetSession, returnRoute || { view: 'progress', sessionId: null, seriesName: '' })
  }

  const beginSwipe = (clientX, clientY) => {
    if (!hasThreadNavigation) return
    swipeRef.current = { x: clientX, y: clientY }
  }

  const finishSwipe = (clientX, clientY) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || !hasThreadNavigation) return

    const deltaX = clientX - start.x
    const deltaY = clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const swipeThreshold = 50

    if (absY >= swipeThreshold && absY >= absX * 1.1) {
      if (deltaY < 0) openThreadSession(threadNavigation.next)
      else openThreadSession(threadNavigation.previous)
      return
    }

    if (absX < swipeThreshold || absX < absY * 1.25) return

    if (deltaX < 0) openThreadSession(threadNavigation.next)
    else openThreadSession(threadNavigation.previous)
  }

  const handleSwipeStart = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    beginSwipe(touch.clientX, touch.clientY)
  }

  const handleSwipeEnd = (event) => {
    const touch = event.changedTouches?.[0]
    if (!touch) return
    finishSwipe(touch.clientX, touch.clientY)
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'touch') return
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {}
    beginSwipe(event.clientX, event.clientY)
  }

  const handlePointerUp = (event) => {
    if (event.pointerType === 'touch') return
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {}
    finishSwipe(event.clientX, event.clientY)
  }

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

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
  }, [onSessionUpdate, refreshSession, session?.id, session?.processing_status, token])

  return (
    <div className="sm:px-6 sm:py-4 sm:pb-28 sm:max-w-3xl sm:mx-auto">
      <div className="hidden sm:block mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← {backLabel}</button>
      </div>

      <div className="relative sm:rounded-2xl sm:border sm:border-gray-200 bg-black sm:bg-white overflow-hidden">
        <button
          onClick={onBack}
          className="sm:hidden absolute top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-40 text-xs text-white/85 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur"
        >
          Back
        </button>
        <div
          className="relative h-[100dvh] sm:h-auto sm:aspect-video bg-black"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeRef.current = null }}
        >
          {playableUrl && !playbackFailed ? (
            <video key={playableUrl} ref={videoRef} src={playableUrl} controls playsInline onError={handlePlaybackError} className="w-full h-full bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
              {session?.processing_status === 'ready'
                ? 'This video is marked ready, but playback failed. Try downloading the original below.'
                : 'Video is still preparing for playback.'}
            </div>
          )}
          {hasThreadNavigation ? (
            <>
            <div
              className="sm:hidden absolute right-3 top-1/2 z-30 flex w-10 -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-white/40 bg-white/15 px-2 py-4 text-xs font-semibold text-white shadow-lg backdrop-blur touch-none"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { swipeRef.current = null }}
              aria-label="Swipe rail: up for next proof, down for previous proof"
            >
              <span aria-hidden="true">↑</span>
              <span className="h-14 w-1 rounded-full bg-white/70" aria-hidden="true" />
              <span className="[writing-mode:vertical-rl] text-[9px] uppercase tracking-widest text-white/80" aria-hidden="true">Swipe</span>
              <span aria-hidden="true">↓</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] sm:bottom-4 z-20 flex items-center justify-between px-3 sm:px-4">
              <button
                type="button"
                onClick={() => openThreadSession(threadNavigation.previous)}
                disabled={!threadNavigation.previous}
                className="pointer-events-auto rounded-full border border-white/25 bg-black/50 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Open previous proof in this thread"
              >
                ← Previous
              </button>
              <div className="rounded-full bg-black/50 px-3 py-2 text-center text-[11px] font-medium text-white/80 backdrop-blur">
                <span className="block max-w-[9rem] truncate">{threadLabel}</span>
                <span className="block text-white/60">{threadPositionLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => openThreadSession(threadNavigation.next)}
                disabled={!threadNavigation.next}
                className="pointer-events-auto rounded-full border border-white/25 bg-black/50 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Open next proof in this thread"
              >
                Next →
              </button>
            </div>
            </>
          ) : null}
        </div>

        <div className="p-4 sm:p-4 space-y-3 bg-white rounded-t-3xl sm:rounded-none -mt-8 sm:mt-0 relative z-30">
          {editing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border-b border-gray-200 focus:border-gray-400 focus:outline-none pb-1"
              />
              <SkillField
                value={editPracticeSeries}
                onChange={setEditPracticeSeries}
                options={skillOptions}
                placeholder="Choose a skill or create a new one"
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
                        View skill
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {justUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">Proof saved to your private archive.</p>
                  <p className="text-sm text-emerald-800 mt-1">
                    {returnsToSkill
                      ? `Stored under ${session.practice_series}. Open that skill timeline to find this proof again.`
                      : 'Stored in Progress. Open your archive to find this proof again.'}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  {returnsToSkill ? `View in ${session.practice_series}` : 'View in Progress'}
                </button>
                {returnsToSkill && session.practice_series ? (
                  <button
                    type="button"
                    onClick={() => onOpenSeries?.(session.practice_series)}
                    className="rounded-full border border-gray-200 bg-white text-gray-900 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Open skill timeline
                  </button>
                ) : null}
              </div>

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

              {hasThreadNavigation ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{threadLabel}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{threadPositionLabel}</p>
                      <p className="text-xs text-gray-500 mt-1">Scroll for details. Use the right swipe rail or buttons to change videos.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openThreadSession(threadNavigation.previous)}
                        disabled={!threadNavigation.previous}
                        className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => openThreadSession(threadNavigation.next)}
                        disabled={!threadNavigation.next}
                        className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

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

            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
