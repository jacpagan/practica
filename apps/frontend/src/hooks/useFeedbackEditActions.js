import { useEffect, useRef, useState } from 'react'

import { isLikelyVideoFile, uploadMultipartRequest } from '../utils'

const createClientUploadId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export default function useFeedbackEditActions({
  token,
  sessionId,
  authHeaders,
  confirm,
  toast,
  refreshSession,
}) {
  const editFeedbackInputRef = useRef(null)
  const editFeedbackUploadIdRef = useRef('')
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [editingFeedbackTimestampSeconds, setEditingFeedbackTimestampSeconds] = useState('')
  const [editingFeedbackVideoFile, setEditingFeedbackVideoFile] = useState(null)
  const [editingFeedbackPreviewUrl, setEditingFeedbackPreviewUrl] = useState('')
  const [savingFeedbackId, setSavingFeedbackId] = useState(null)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null)
  const [editFeedbackUploadProgressPercent, setEditFeedbackUploadProgressPercent] = useState(null)

  const replaceEditingFeedbackPreviewUrl = (nextUrl) => {
    setEditingFeedbackPreviewUrl((current) => {
      if (current && current.startsWith('blob:')) {
        try { window.URL.revokeObjectURL(current) } catch {}
      }
      return nextUrl || ''
    })
  }

  useEffect(() => () => {
    if (editingFeedbackPreviewUrl && editingFeedbackPreviewUrl.startsWith('blob:')) {
      try { window.URL.revokeObjectURL(editingFeedbackPreviewUrl) } catch {}
    }
  }, [editingFeedbackPreviewUrl])

  const startEditingFeedback = (item) => {
    setEditingFeedbackId(item.id)
    setEditingFeedbackTimestampSeconds(typeof item.timestamp_seconds === 'number' ? String(item.timestamp_seconds) : '')
    setEditingFeedbackVideoFile(null)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl('')
  }

  const cancelEditingFeedback = () => {
    setEditingFeedbackId(null)
    setEditingFeedbackTimestampSeconds('')
    setEditingFeedbackVideoFile(null)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl('')
  }

  const pickEditFeedbackFile = (event) => {
    const file = event.target.files?.[0]
    if (!file || !isLikelyVideoFile(file)) return
    setEditingFeedbackVideoFile(file)
    editFeedbackUploadIdRef.current = ''
    setEditFeedbackUploadProgressPercent(null)
    replaceEditingFeedbackPreviewUrl(URL.createObjectURL(file))
    if (event.target) event.target.value = ''
  }

  const saveFeedbackEdit = async (feedbackId) => {
    if (!token || !sessionId) return
    setSavingFeedbackId(feedbackId)
    try {
      const payload = new FormData()
      payload.append('timestamp_seconds', editingFeedbackTimestampSeconds)
      if (editingFeedbackVideoFile) {
        payload.append('feedback_video', editingFeedbackVideoFile)
        if (!editFeedbackUploadIdRef.current) editFeedbackUploadIdRef.current = createClientUploadId()
        payload.append('client_upload_id', editFeedbackUploadIdRef.current)
      }

      const res = await uploadMultipartRequest({
        url: `/api/sessions/${sessionId}/video-feedback/${feedbackId}/`,
        method: 'PATCH',
        formData: payload,
        token,
        onProgress: (percent) => setEditFeedbackUploadProgressPercent(percent ?? null),
      })
      if (!res.ok) throw new Error(res.data?.error || 'Could not update feedback video')
      await refreshSession({ silent: true })
      cancelEditingFeedback()
      toast.success('Feedback video updated')
    } catch (error) {
      toast.error(error.message || 'Could not update feedback video')
    } finally {
      setSavingFeedbackId(null)
      setEditFeedbackUploadProgressPercent(null)
    }
  }

  const deleteFeedback = async (feedbackId) => {
    if (!token || !sessionId) return
    const accepted = await confirm({
      title: 'Delete feedback video?',
      message: 'This removes your feedback video from the thread.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
    })
    if (!accepted) return
    setDeletingFeedbackId(feedbackId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/video-feedback/${feedbackId}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not delete feedback video')
      await refreshSession({ silent: true })
      if (editingFeedbackId === feedbackId) cancelEditingFeedback()
      toast.success('Feedback video deleted')
    } catch (error) {
      toast.error(error.message || 'Could not delete feedback video')
    } finally {
      setDeletingFeedbackId(null)
    }
  }

  return {
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
  }
}