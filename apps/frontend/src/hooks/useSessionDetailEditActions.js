import { useCallback, useState } from 'react'

export default function useSessionDetailEditActions({
  session,
  token,
  authHeaders,
  toast,
  onSessionUpdate,
  loadReviewRequests,
  setSession,
  setActiveReviewLink,
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editPracticeSeries, setEditPracticeSeries] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const startEditing = useCallback(() => {
    setEditTitle(session?.title || '')
    setEditPracticeSeries(session?.practice_series || '')
    setEditDescription(session?.description || '')
    setEditing(true)
  }, [session?.description, session?.practice_series, session?.title])

  const cancelEditing = useCallback(() => {
    setEditing(false)
  }, [])

  const saveEdits = useCallback(async () => {
    if (!editTitle.trim()) {
      toast.error('Title is required')
      return
    }
    if (!token || !session?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          title: editTitle.trim(),
          practice_series: editPracticeSeries.trim(),
          description: editDescription.trim(),
        }),
      })
      if (!res.ok) throw new Error('save')
      const data = await res.json()
      const next = { ...data, local_preview_url: session?.local_preview_url || '' }
      setSession(next)
      setActiveReviewLink?.(next.active_review_link || null)
      onSessionUpdate?.(next)
      setEditing(false)
      toast.success('Video updated')
    } catch {
      toast.error('Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [authHeaders, editDescription, editPracticeSeries, editTitle, onSessionUpdate, session?.id, session?.local_preview_url, setActiveReviewLink, setSession, toast, token])

  const refreshSession = useCallback(async ({ silent = false } = {}) => {
    if (!token || !session?.id) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/`, { headers: authHeaders })
      if (!res.ok) throw new Error('refresh')
      const data = await res.json()
      const next = { ...data, local_preview_url: session?.local_preview_url || '' }
      setSession(next)
      setActiveReviewLink?.(next.active_review_link || null)
      onSessionUpdate?.(next)
      await loadReviewRequests?.()
    } catch {
      if (!silent) toast.error('Could not refresh this video')
    } finally {
      setRefreshing(false)
    }
  }, [authHeaders, loadReviewRequests, onSessionUpdate, session?.id, session?.local_preview_url, setActiveReviewLink, setSession, toast, token])

  return {
    editDescription,
    editPracticeSeries,
    editTitle,
    editing,
    cancelEditing,
    setEditDescription,
    setEditPracticeSeries,
    setEditTitle,
    refreshSession,
    refreshing,
    saveEdits,
    saving,
    startEditing,
  }
}