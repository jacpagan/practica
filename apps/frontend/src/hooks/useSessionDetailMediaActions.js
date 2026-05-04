import { useEffect, useState } from 'react'

export default function useSessionDetailMediaActions({
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
}) {
  const [retryingProcessing, setRetryingProcessing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [playbackSourceIndex, setPlaybackSourceIndex] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)

  useEffect(() => {
    setPlaybackSourceIndex(0)
    setPlaybackFailed(false)
  }, [session?.id, session?.local_preview_url, session?.video_file, JSON.stringify(session?.assets || [])])

  const retryProcessing = async () => {
    if (!token || !session?.id) return
    setRetryingProcessing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/retry-processing/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('retry')
      const data = await res.json()
      const next = { ...data, local_preview_url: session?.local_preview_url || '' }
      setSession?.(next)
      onSessionUpdate?.(next)
      toast.success('Playback processing restarted')
    } catch {
      toast.error('Could not restart processing')
    } finally {
      setRetryingProcessing(false)
    }
  }

  const deleteSession = async () => {
    if (!token || !session?.id) return
    const accepted = await confirm({
      title: 'Delete video?',
      message: 'This removes the video and any derived playback assets.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('delete')
      toast.success('Video deleted')
      onSessionDelete?.(session.id)
    } catch {
      toast.error('Could not delete video')
    } finally {
      setDeleting(false)
    }
  }

  const jumpToTimestamp = (seconds) => {
    const video = videoRef.current
    if (!video || typeof seconds !== 'number') return
    try {
      video.currentTime = seconds
      video.play?.().catch?.(() => {})
    } catch {}
  }

  const handlePlaybackError = () => {
    if (playbackSourceIndex < playbackSources.length - 1) {
      setPlaybackSourceIndex((current) => current + 1)
      return
    }
    setPlaybackFailed(true)
  }

  return {
    deleting,
    handlePlaybackError,
    jumpToTimestamp,
    playbackFailed,
    playbackSourceIndex,
    deleteSession,
    retryProcessing,
    retryingProcessing,
  }
}
