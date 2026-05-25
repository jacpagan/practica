import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtTimer, sessionVideoSources, videoUrl } from '../utils'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './Toast'
import SkillField from './SkillField'
import useSessionDetailEditActions from '../hooks/useSessionDetailEditActions'
import useSessionDetailMediaActions from '../hooks/useSessionDetailMediaActions'
import VideoScrubBar from './VideoScrubBar'
import { readVideoFitMode, saveVideoFitMode } from '../recordPrefs'

const THREAD_SLIDE_TRANSITION_MS = 280
const CONTROLS_HIDE_MS = 2600
const GESTURE_TAP_MAX_PX = 14
const GESTURE_DRAG_START_PX = 10
const VIDEO_OBJECT_CLASS = {
  fill: 'object-cover',
  fit: 'object-contain',
}

function IconPlay({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11.04-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" />
    </svg>
  )
}

function IconPause({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function IconChevronUp({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  )
}

function IconFitFrame({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="5" y="7" width="14" height="10" rx="1.5" />
      <path strokeLinecap="round" d="M9 4h6M9 20h6M4 9v6M20 9v6" />
    </svg>
  )
}

function IconFillFrame({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path strokeLinecap="round" d="M8 12h8M12 8v8" />
    </svg>
  )
}

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
  const [videoFit, setVideoFit] = useState(() => readVideoFitMode())
  const [controlsVisible, setControlsVisible] = useState(true)
  const gestureRef = useRef(null)
  const pagerOffsetRef = useRef(0)
  const controlsHideTimerRef = useRef(null)
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
    pagerOffsetRef.current = offsetY
    setPagerDrag({ active: true, animating: false, offsetY })
  }

  const finishPlayerDrag = () => {
    swipeRef.current = null
    if (!hasThreadNavigation) return
    const offsetY = pagerOffsetRef.current
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
    beginGesture(touch.clientX, touch.clientY)
  }

  const handlePlayerTouchMove = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    updateGestureDrag(touch.clientX, touch.clientY)
  }

  const handlePlayerTouchEnd = () => finishGesture()

  const handlePlayerPointerDown = (event) => {
    if (event.pointerType === 'touch') return
    beginGesture(event.clientX, event.clientY)
  }

  const handlePlayerPointerMove = (event) => {
    if (event.pointerType === 'touch') return
    updateGestureDrag(event.clientX, event.clientY)
  }

  const handlePlayerPointerUp = (event) => {
    if (event.pointerType === 'touch') return
    finishGesture()
  }

  const stopPlayerGesture = (event) => {
    event.stopPropagation()
  }

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current)
      controlsHideTimerRef.current = null
    }
  }, [])

  const scheduleHideControls = useCallback(() => {
    if (controlsHideTimerRef.current) window.clearTimeout(controlsHideTimerRef.current)
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
      controlsHideTimerRef.current = null
    }, CONTROLS_HIDE_MS)
  }, [])

  const togglePlayback = useCallback((event) => {
    event?.stopPropagation?.()
    const video = videoRef.current
    if (!video) return
    revealControls()
    if (video.paused) video.play?.().catch?.(() => {})
    else video.pause?.()
  }, [revealControls])

  const videoObjectClass = VIDEO_OBJECT_CLASS[videoFit] || VIDEO_OBJECT_CLASS.fill
  const videoSurfaceClass = `absolute inset-0 h-full w-full bg-black ${videoObjectClass}`

  const toggleVideoFit = useCallback((event) => {
    event?.stopPropagation?.()
    revealControls()
    setVideoFit((current) => saveVideoFitMode(current === 'fill' ? 'fit' : 'fill'))
  }, [revealControls])

  const handleOpenDetails = (event) => {
    event.stopPropagation()
    revealControls()
    detailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const resetGesture = () => {
    gestureRef.current = null
  }

  const beginGesture = (clientX, clientY) => {
    gestureRef.current = { x: clientX, y: clientY, dragging: false, moved: false }
  }

  const updateGestureDrag = (clientX, clientY) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const deltaX = clientX - gesture.x
    const deltaY = clientY - gesture.y
    if (Math.abs(deltaX) > GESTURE_TAP_MAX_PX || Math.abs(deltaY) > GESTURE_TAP_MAX_PX) {
      gesture.moved = true
    }
    if (gesture.dragging) {
      updatePlayerDrag(clientX, clientY)
      return
    }
    if (!hasThreadNavigation || threadTransitionRef.current) return
    if (Math.abs(deltaY) < GESTURE_DRAG_START_PX) return
    if (Math.abs(deltaY) < Math.abs(deltaX) * 1.15) return
    gesture.dragging = true
    swipeRef.current = { x: gesture.x, y: gesture.y, player: true }
    setPagerDrag({ active: true, animating: false, offsetY: 0 })
    pagerOffsetRef.current = 0
    updatePlayerDrag(clientX, clientY)
  }

  const finishGesture = () => {
    const gesture = gestureRef.current
    resetGesture()
    if (!gesture) return
    if (gesture.dragging) {
      finishPlayerDrag()
      return
    }
    if (!gesture.moved) {
      togglePlayback()
    }
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
    if (controlsHideTimerRef.current) window.clearTimeout(controlsHideTimerRef.current)
    stopRailMouseTracking()
  }, [])

  useEffect(() => {
    setVideoPlaying(false)
    revealControls()
  }, [playableUrl, revealControls])

  useEffect(() => {
    if (videoPlaying) scheduleHideControls()
    else revealControls()
  }, [videoPlaying, revealControls, scheduleHideControls])

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
  const pagerTransitionClass = pagerDrag.animating ? 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform' : ''
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
          <video src={url} muted playsInline className={videoSurfaceClass} />
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
    <div className="min-h-screen bg-black">
      <div
        ref={playerRef}
        className="sticky top-0 z-30 h-[100dvh] w-full overflow-hidden bg-black touch-none"
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
        <button
          onClick={onBack}
          onPointerDown={stopPlayerGesture}
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-50 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-xs text-white/85 backdrop-blur"
        >
          ← {backLabel}
        </button>
        {playableUrl && !playbackFailed ? (
          <button
            type="button"
            onClick={toggleVideoFit}
            onPointerDown={stopPlayerGesture}
            aria-label={videoFit === 'fill' ? 'Switch to fit (show full frame)' : 'Switch to fill (full screen)'}
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            {videoFit === 'fill' ? <IconFitFrame className="h-5 w-5" /> : <IconFillFrame className="h-5 w-5" />}
          </button>
        ) : null}
        {playableUrl && !playbackFailed ? (
          <video
            key={playableUrl}
            ref={videoRef}
            src={playableUrl}
            playsInline
            preload="metadata"
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
            onError={handlePlaybackError}
            className={videoSurfaceClass}
          />
        ) : null}
        {playableUrl && !playbackFailed && !videoPlaying ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-full bg-black/45 p-4 shadow-lg backdrop-blur-sm">
              <IconPlay className="h-10 w-10 text-white" />
            </div>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 z-40 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {playableUrl && !playbackFailed ? (
            <VideoScrubBar
              videoRef={videoRef}
              durationSeconds={session?.duration_seconds}
              timingMetadata={session?.timing_metadata}
            />
          ) : null}
          <div className="pointer-events-none px-4 pb-1">
            <p className="truncate text-sm font-semibold leading-tight text-white drop-shadow">{session.title}</p>
            {hasThreadNavigation ? (
              <p className="mt-0.5 text-[11px] text-white/70">{threadPositionLabel}</p>
            ) : null}
          </div>
          <div className="pointer-events-none bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pt-2">
            <div className="pointer-events-auto flex items-center justify-end gap-2 pb-2">
              {playableUrl && !playbackFailed ? (
                <div
                  className={`flex items-center gap-2 transition-opacity duration-300 ${controlsVisible || !videoPlaying ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                >
                  <button
                    type="button"
                    onClick={togglePlayback}
                    onPointerDown={stopPlayerGesture}
                    aria-label={videoPlaying ? 'Pause video' : 'Play video'}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur transition-colors hover:bg-white/15"
                  >
                    {videoPlaying ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleOpenDetails}
                onPointerDown={stopPlayerGesture}
                aria-label="Open proof details"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur transition-colors hover:bg-white/15"
              >
                <IconChevronUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        {!playableUrl || playbackFailed ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/70">
            {session?.processing_status === 'ready'
              ? 'This video is marked ready, but playback failed. Try downloading the original below.'
              : 'Video is still preparing for playback.'}
          </div>
        ) : null}
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
                <video src={playableUrl} muted playsInline className={videoSurfaceClass} />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
              <div className="absolute bottom-8 left-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                {threadPositionLabel}
              </div>
            </div>
            <div className={`absolute inset-0 transform transition-transform duration-300 ease-out ${targetSlideClass}`}>
              {transitionTargetUrl ? (
                <video src={transitionTargetUrl} muted playsInline className={videoSurfaceClass} />
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
        ) : null}
      </div>

      <div ref={detailsRef} className="relative z-40 -mt-4 space-y-3 rounded-t-3xl bg-white p-4 pb-28 sm:mx-auto sm:max-w-lg sm:pb-32">
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
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
                {session.practice_series ? (
                  <button
                    type="button"
                    onClick={() => onOpenSeries?.(session.practice_series)}
                    className="mt-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {session.practice_series} →
                  </button>
                ) : null}
                {(session.recorded_at || session.duration_seconds) ? (
                  <p className="mt-2 text-xs text-gray-500">
                    {session.recorded_at ? new Date(session.recorded_at).toLocaleString(undefined, { hour12: undefined }) : null}
                    {session.recorded_at && session.duration_seconds ? ' · ' : null}
                    {session.duration_seconds ? fmtTimer(session.duration_seconds) : null}
                  </p>
                ) : null}
              </div>

              {justUploaded ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">Proof saved.</p>
                </div>
              ) : null}

              {session.description ? <p className="text-sm text-gray-600">{session.description}</p> : null}

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
                <summary className="cursor-pointer list-none text-sm text-gray-500 hover:text-gray-900 transition-colors">Manage proof</summary>
                <div className="flex flex-wrap gap-2 pt-4">
                  {onRecordAnother ? (
                    <button type="button" onClick={() => onRecordAnother()} className="text-sm font-medium text-white bg-gray-900 rounded-lg px-4 py-2.5 hover:bg-gray-800 transition-colors">
                      Record another
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button type="button" onClick={startEditing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Edit
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button type="button" onClick={deleteSession} disabled={deleting} className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-50 disabled:opacity-50 transition-colors">
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  ) : null}
                  <button type="button" onClick={refreshSession} disabled={refreshing} className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  {canEdit && session.video_file ? (
                    <a href={videoUrl(session.video_file)} download className="text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Download
                    </a>
                  ) : null}
                </div>
              </details>

            </>
          )}
        </div>
    </div>
  )
}

export default SessionDetail
