import React, { useMemo, useState } from 'react'
import { useToast } from './Toast'

function TeacherActivation({ token, onActivated }) {
  const toast = useToast()
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdGroup, setCreatedGroup] = useState(null)

  const inviteUrl = useMemo(() => {
    if (!createdGroup?.invite_link) return ''
    return `${window.location.origin}${createdGroup.invite_link}`
  }, [createdGroup])

  const createGroup = async (event) => {
    event.preventDefault()
    if (!groupName.trim()) {
      toast.error('Please name your practice group')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/spaces/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ name: groupName.trim() }),
      })
      if (!res.ok) throw new Error('create-group')
      const data = await res.json()
      setCreatedGroup(data)
      toast.success('Practice group created')
      onActivated?.(data)
    } catch {
      toast.error('Could not create practice group')
    } finally {
      setCreating(false)
    }
  }

  const copyInviteLink = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invite link copied')
    } catch {
      toast.error('Could not copy invite link')
    }
  }

  const shareInviteLink = async () => {
    if (!inviteUrl) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my Practica practice group',
          text: 'Send me your practice clips here so I can review them between lessons.',
          url: inviteUrl,
        })
        return
      }
      await copyInviteLink()
    } catch {
      // Ignore share cancellations.
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900 tracking-tight">Start coaching between lessons</h2>
          <p className="text-sm text-gray-500 mt-2">Create your first practice group, invite a student, and use Practica as your between-lessons review inbox.</p>
        </div>

        {!createdGroup ? (
          <form onSubmit={createGroup} className="rounded-3xl border border-gray-200 bg-white p-5 space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Practice group name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Examples: Drum Students, Brando Studio, Wednesday Lessons"
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-2xl bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create my first group'}
            </button>
          </form>
        ) : (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Step 1 complete</p>
              <h3 className="text-lg font-semibold text-emerald-900 mt-1">Invite your first student</h3>
              <p className="text-sm text-emerald-800 mt-2">Share this link. When your student joins and uploads a clip, it will appear in your Review queue.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">Invite link</p>
              <p className="text-sm text-gray-900 break-all mt-1">{inviteUrl}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={copyInviteLink} className="rounded-2xl bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-800 transition-colors">
                Copy invite link
              </button>
              <button type="button" onClick={shareInviteLink} className="rounded-2xl border border-gray-200 bg-white text-gray-900 py-3 text-sm font-medium hover:bg-gray-50 transition-colors">
                Share invite
              </button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">What happens next</p>
          <div className="mt-3 grid gap-2 text-sm text-gray-700">
            <p><span className="font-medium text-gray-900">1.</span> Your student records a practice clip.</p>
            <p><span className="font-medium text-gray-900">2.</span> You see it in your Review queue.</p>
            <p><span className="font-medium text-gray-900">3.</span> You leave timestamped feedback.</p>
            <p><span className="font-medium text-gray-900">4.</span> They record the next attempt.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherActivation
