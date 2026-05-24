import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, sessionVideoSources, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import SkillField from './SkillField'
import useSessionDetailEditActions from '../hooks/useSessionDetailEditActions'
import useSessionDetailMediaActions from '../hooks/useSessionDetailMediaActions'

const THREAD_SLIDE_TRANSITION_MS = 280

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
  const playerRef = useRef(null)
  const detailsRef = useRef(null)
  const [session, setSession] = useState(initialSession)
  const swipeRef = useRef(null)
  const pagerFinishTimerRef = useRef(null)
  const railWheelRef = useRef(0)
  const transitionStartTimerRef = useRef(null)
  const transitionFinishTimerRef = useRef(null)
  const threadNavigationRef = useRef(null)
  const threadTransitionRef = useRef(null)
  const [threadTransition, setThreadTransition] = useState(null)
  const [pagerDrag, setPagerDrag] = useState({ active: false, animating: false, offsetY: 0 })
  const [videoPlaying, setVideoPlaying] = useState(false)
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
  threadNavigationRef.current = threadNavigation
  threadTransitionRef.current = threadTransition
  const hasThreadNavigation = threadNavigation.items.length > 1
  const threadLabel = session?.practice_series ? session.practice_series : 'Ungrouped'
  const threadPositionLabel = hasThreadNavigation && threadNavigation.index >= 0
    ? `Proof ${threadNavigation.index + 1} of ${threadNavigation.items.length}`
    : ''

  const openThreadSession = (targetSession) => {
    if (!targetSession?.id) return
    if (threadTransitionRef.current?.targetSession?.id === targetSession.id) return

    const targetId = Number(targetSession.id)
    const currentNavigation = threadNavigationRef.current || threadNavigation
    const targetIndex = currentNavigation.items.findIndex((item) => Number(item?.id) === targetId)
    const direction = targetIndex > currentNavigation.index ? 'next' : 'previous'
    const shouldReduceMotion = (() => {
      try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      } catch {
        return false
      }
    })()

    if (shouldReduceMotion) {
      onOpenSession?.(targetSession, returnRoute || { view: 'progress', sessionId: null, seriesName: '' })
      return
    }

    if (transitionStartTimerRef.current) window.clearTimeout(transitionStartTimerRef.current)
    if (transitionFinishTimerRef.current) window.clearTimeout(transitionFinishTimerRef.current)

    threadTransitionRef.current = { targetSession, direction, active: false }
    setThreadTransition(threadTransitionRef.current)
    transitionStartTimerRef.current = window.setTimeout(() => {
      setThreadTransition((current) => (
        current?.targetSession?.id === targetSession.id ? { ...current, active: true } : current
      ))
    }, 20)
    transitionFinishTimerRef.current = window.setTimeout(() => {
      threadTransitionRef.current = null
      setThreadTransition(null)
      onOpenSession?.(targetSession, returnRoute || { view: 'progress', sessionId: null, seriesName: '' })
    }, THREAD_SLIDE_TRANSITION_MS + 60)
  }

  const beginSwipe = (clientX, clientY) => {
    if (!hasThreadNavigation) return
    swipeRef.current = { x: clientX, y: clientY }
  }

  const resolveSwipeTarget = (clientX, clientY) => {
    const start = swipeRef.current
    if (!start || !hasThreadNavigation) return null

    const deltaX = clientX - start.x
    const deltaY = clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const swipeThreshold = 50
    const currentNavigation = threadNavigationRef.current || threadNavigation

    if (absY >= swipeThreshold && absY >= absX * 1.1) {
      return deltaY < 0 ? currentNavigation.next : currentNavigation.previous
    }

    if (absX < swipeThreshold || absX < absY * 1.25) return null

    return deltaX < 0 ? currentNavigation.next : currentNavigation.previous
  }

  const finishSwipe = (clientX, clientY) => {
    const targetSession = resolveSwipeTarget(clientX, clientY)
    swipeRef.current = null
    openThreadSession(targetSession)
  }

  const playerHeight = () => {
    const height = playerRef.current?.clientHeight || window.innerHeight || 1
    return Math.max(1, height)
  }

  const completePagerNavigation = (targetSession, direction) => {
    if (!targetSession?.id) return
    if (pagerFinishTimerRef.current) window.clearTimeout(pagerFinishTimerRef.current)
    const finalOffset = direction === 'next' ? -playerHeight() : playerHeight()
    setPagerDrag({ active: true, animating: true, offsetY: finalOffset })
    pagerFinishTimerRef.current = window.setTimeout(() => {
      setPagerDrag({ active: false, animating: false, offsetY: 0 })
      onOpenSession?.(targetSession, returnRoute || { view: 'progress', sessionId: null, seriesName: '' })
    }, THREAD_SLIDE_TRANSITION_MS)
  }

  const resetPagerDrag = () => {
    if (pagerFinishTimerRef.current) window.clearTimeout(pagerFinishTimerRef.current)
    setPagerDrag({ active: true, animating: true, offsetY: 0 })
    pagerFinishTimerRef.current = window.setTimeout(() => {
      setPagerDrag({ active: false, animating: false, offsetY: 0 })
    }, THREAD_SLIDE_TRANSITION_MS)
  }

  const beginPlayerDrag = (clientX, clientY) => {
    if (!hasThreadNavigation || threadTransitionRef.current) return
    swipeRef.current = { x: clientX, y: clientY, player: true }
    setPagerDrag({ active: true, animating: false, offsetY: 0 })
  }

  const updatePlayerDrag = (clientX, clientY) => {
    const start = swipeRef.current
    if (!start?.player || !hasThreadNavigation) return
    const deltaX = clientX - start.x
    const deltaY = clientY - start.y
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) return
    let offsetY = deltaY
    if ((offsetY < 0 && !threadNavigation.next) || (offsetY > 0 && !threadNavigation.previous)) {
      offsetY *= 0.22
    }
    const limit = playerHeight() * 0.92
    offsetY = Math.max(-limit, Math.min(limit, offsetY))
    setPagerDrag({ active: true, animating: false, offsetY })
  }

  const finishPlayerDrag = () => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start?.player || !hasThreadNavigation) return
    const offsetY = pagerDrag.offsetY
    const threshold = Math.min(140, playerHeight() * 0.22)
    if (offsetY <= -threshold && threadNavigation.next) {
      completePagerNavigation(threadNavigation.next, 'next')
      return
    }
    if (offsetY >= threshold && threadNavigation.previous) {
      completePagerNavigation(threadNavigation.previous, 'previous')
      return
    }
    resetPagerDrag()
  }

  const handlePlayerTouchStart = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    beginPlayerDrag(touch.clientX, touch.clientY)
  }

  const handlePlayerTouchMove = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    updatePlayerDrag(touch.clientX, touch.clientY)
  }

  const handlePlayerTouchEnd = () => finishPlayerDrag()

  const handlePlayerPointerDown = (event) => {
    if (event.pointerType === 'touch') return
    beginPlayerDrag(event.clientX, event.clientY)
  }

  const handlePlayerPointerMove = (event) => {
    if (event.pointerType === 'touch') return
    updatePlayerDrag(event.clientX, event.clientY)
  }

  const handlePlayerPointerUp = (event) => {
    if (event.pointerType === 'touch') return
    finishPlayerDrag()
  }

  const handleOpenDetails = (event) => {
    event.stopPropagation()
    detailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const togglePlayback = (event) => {
    event?.stopPropagation?.()
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play?.().catch?.(() => {})
    else video.pause?.()
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

  const handleRailTouchStart = (event) => {
    event.stopPropagation()
    handleSwipeStart(event)
  }

  const handleRailTouchEnd = (event) => {
    event.stopPropagation()
    handleSwipeEnd(event)
  }

  const handleRailPointerDown = (event) => {
    event.stopPropagation()
    handlePointerDown(event)
  }

  const handleRailPointerUp = (event) => {
    event.stopPropagation()
    handlePointerUp(event)
  }

  const handleRailPointerMove = (event) => {
    event.stopPropagation()
    const targetSession = resolveSwipeTarget(event.clientX, event.clientY)
    if (!targetSession) return
    swipeRef.current = null
    openThreadSession(targetSession)
  }

  function stopRailMouseTracking() {
    window.removeEventListener('mousemove', handleWindowRailMouseMove)
    window.removeEventListener('mouseup', handleWindowRailMouseUp)
  }

  function handleWindowRailMouseMove(event) {
    const targetSession = resolveSwipeTarget(event.clientX, event.clientY)
    if (!targetSession) return
    swipeRef.current = null
    stopRailMouseTracking()
    openThreadSession(targetSession)
  }

  function handleWindowRailMouseUp(event) {
    stopRailMouseTracking()
    finishSwipe(event.clientX, event.clientY)
  }

  const handleRailMouseDown = (event) => {
    event.stopPropagation()
    beginSwipe(event.clientX, event.clientY)
    window.addEventListener('mousemove', handleWindowRailMouseMove)
    window.addEventListener('mouseup', handleWindowRailMouseUp)
  }

  const handleRailMouseUp = (event) => {
    event.stopPropagation()
    stopRailMouseTracking()
    finishSwipe(event.clientX, event.clientY)
  }

  const handleRailMouseMove = (event) => {
    event.stopPropagation()
    const targetSession = resolveSwipeTarget(event.clientX, event.clientY)
    if (!targetSession) return
    swipeRef.current = null
    openThreadSession(targetSession)
  }

  const handleRailWheel = (event) => {
    if (!hasThreadNavigation) return
    const deltaY = Number(event.deltaY || 0)
    if (Math.abs(deltaY) < 25) return
    event.preventDefault()
    event.stopPropagation()
    const now = Date.now()
    if (now - railWheelRef.current < 500) return
    railWheelRef.current = now
    const currentNavigation = threadNavigationRef.current || threadNavigation
    if (deltaY > 0) openThreadSession(currentNavigation.next)
    else openThreadSession(currentNavigation.previous)
  }

  const handlePlayerWheel = (event) => {
    handleRailWheel(event)
  }

  useEffect(() => {
    const node = playerRef.current
    if (!node) return undefined
    const handleNativeWheel = (event) => handlePlayerWheel(event)
    node.addEventListener('wheel', handleNativeWheel, { capture: true, passive: false })
    return () => node.removeEventListener('wheel', handleNativeWheel, { capture: true })
  })

  useEffect(() => {
    setSession(initialSession)
  }, [initialSession])

  useEffect(() => () => {
    if (pagerFinishTimerRef.current) window.clearTimeout(pagerFinishTimerRef.current)
    if (transitionStartTimerRef.current) window.clearTimeout(transitionStartTimerRef.current)
    if (transitionFinishTimerRef.current) window.clearTimeout(transitionFinishTimerRef.current)
    stopRailMouseTracking()
  }, [])

  useEffect(() => {
    setVideoPlaying(false)
  }, [playableUrl])

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

  const transitionTargetSources = threadTransition
    ? sessionVideoSources(threadTransition.targetSession, threadTransition.targetSession?.local_preview_url || '')
    : []
  const transitionTargetUrl = transitionTargetSources[0] || null
  const currentSlideClass = threadTransition?.active
    ? (threadTransition.direction === 'next' ? '-translate-y-full' : 'translate-y-full')
    : 'translate-y-0'
  const targetSlideClass = threadTransition?.active
    ? 'translate-y-0'
    : (threadTransition?.direction === 'next' ? 'translate-y-full' : '-translate-y-full')
  const pagerActive = pagerDrag.active || pagerDrag.animating
  const pagerTransitionClass = pagerDrag.animating ? 'transition-transform duration-300 ease-out' : ''
  const previousPagerSources = threadNavigation.previous
    ? sessionVideoSources(threadNavigation.previous, threadNavigation.previous?.local_preview_url || '')
    : []
  const nextPagerSources = threadNavigation.next
    ? sessionVideoSources(threadNavigation.next, threadNavigation.next?.local_preview_url || '')
    : []
  const previousPagerUrl = previousPagerSources[0] || null
  const nextPagerUrl = nextPagerSources[0] || null
  const pagerCardStyle = (slot) => ({
    transform: `translateY(calc(${slot * 100}% + ${pagerDrag.offsetY}px))`,
  })
  const renderPagerCard = (item, url, label, slot) => {
    if (!item && slot !== 0) return null
    return (
      <div
        className={`absolute inset-0 ${pagerTransitionClass}`}
        style={pagerCardStyle(slot)}
      >
        {url ? (
          <video src={url} muted playsInline className="h-full w-full bg-black object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/70">
            Video is still preparing for playback.
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20 text-white">
          <p className="text-base font-semibold leading-tight drop-shadow">{item?.title || session?.title || 'Proof'}</p>
          <p className="mt-1 text-[11px] text-white/60">{label}</p>
        </div>
      </div>
    )
  }

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
          ref={playerRef}
          className="relative h-[100dvh] cursor-grab overflow-hidden bg-black touch-none active:cursor-grabbing sm:h-auto sm:aspect-video"
          onTouchStart={handlePlayerTouchStart}
          onTouchMove={handlePlayerTouchMove}
          onTouchEnd={handlePlayerTouchEnd}
          onTouchCancel={handlePlayerTouchEnd}
          onPointerDown={handlePlayerPointerDown}
          onPointerMove={handlePlayerPointerMove}
          onPointerUp={handlePlayerPointerUp}
          onPointerCancel={handlePlayerPointerUp}
          onWheelCapture={handlePlayerWheel}
        >
          {playableUrl && !playbackFailed ? (
            <video
              key={playableUrl}
              ref={videoRef}
              src={playableUrl}
              playsInline
              onClick={togglePlayback}
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onEnded={() => setVideoPlaying(false)}
              onError={handlePlaybackError}
              className="w-full h-full bg-black"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-6 text-center text-sm text-white/70">
              {session?.processing_status === 'ready'
                ? 'This video is marked ready, but playback failed. Try downloading the original below.'
                : 'Video is still preparing for playback.'}
            </div>
          )}
          {pagerActive ? (
            <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden bg-black">
              {renderPagerCard(threadNavigation.previous, previousPagerUrl, threadNavigation.index > 0 ? `Proof ${threadNavigation.index} of ${threadNavigation.items.length}` : '', -1)}
              {renderPagerCard(session, playableUrl, threadPositionLabel, 0)}
              {renderPagerCard(threadNavigation.next, nextPagerUrl, threadNavigation.index >= 0 ? `Proof ${threadNavigation.index + 2} of ${threadNavigation.items.length}` : '', 1)}
            </div>
          ) : null}
          {threadTransition ? (
            <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden bg-black">
              <div className={`absolute inset-0 transform transition-transform duration-300 ease-out ${currentSlideClass}`}>
                {playableUrl && !playbackFailed ? (
                  <video src={playableUrl} muted playsInline className="h-full w-full bg-black object-contain" />
                ) : (
                  <div className="h-full w-full bg-black" />
                )}
                <div className="absolute bottom-8 left-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                  {threadPositionLabel}
                </div>
              </div>
              <div className={`absolute inset-0 transform transition-transform duration-300 ease-out ${targetSlideClass}`}>
                {transitionTargetUrl ? (
                  <video src={transitionTargetUrl} muted playsInline className="h-full w-full bg-black object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/70">
                    Video is still preparing for playback.
                  </div>
                )}
                <div className="absolute bottom-8 left-4 max-w-[75%] rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                  <span className="block truncate">{threadTransition.targetSession?.title || 'Next proof'}</span>
                </div>
              </div>
            </div>
          ) : null}
          {hasThreadNavigation ? (
            <>
            <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.9rem,env(safe-area-inset-bottom))] z-20 flex items-end justify-between gap-3 px-4 text-white">
              <div className="max-w-[72%]">
                <p className="text-base font-semibold leading-tight drop-shadow">{session.title}</p>
                <p className="mt-1 text-[11px] text-white/60">{threadPositionLabel}</p>
              </div>
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-medium text-white/85 shadow-lg backdrop-blur transition-colors hover:bg-white/15"
                >
                  {videoPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenDetails}
                  className="rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-medium text-white/85 shadow-lg backdrop-blur transition-colors hover:bg-white/15"
                >
                  Details
                </button>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-between px-3 opacity-0 transition-opacity hover:opacity-100 sm:flex">
              <button
                type="button"
                onClick={() => openThreadSession(threadNavigation.previous)}
                disabled={!threadNavigation.previous}
                className="pointer-events-auto rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-medium text-white/85 backdrop-blur disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Open previous proof in this thread"
              >
                ↑ Previous
              </button>
              <button
                type="button"
                onClick={() => openThreadSession(threadNavigation.next)}
                disabled={!threadNavigation.next}
                className="pointer-events-auto rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-medium text-white/85 backdrop-blur disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Open next proof in this thread"
              >
                Next ↓
              </button>
            </div>
            </>
          ) : null}
        </div>

        <div ref={detailsRef} className="p-4 sm:p-4 space-y-3 bg-white rounded-t-3xl sm:rounded-none -mt-8 sm:mt-0 relative z-30">
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
                      <p className="text-xs text-gray-500 mt-1">Drag the video up or down to move through this thread.</p>
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
