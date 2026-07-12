import React, { useEffect, useMemo, useState } from 'react'
import BrandLogo from './BrandLogo'
import { fmtTimer, sessionPosterUrl, sessionVideoSources } from '../utils'

function SharedHeader() {
  return (
    <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <a href="/today" className="inline-flex items-center" aria-label="Practica home">
          <BrandLogo className="h-auto w-[180px] sm:h-9 sm:w-auto" />
        </a>
        <a href="/today" className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800">
          Open Practica
        </a>
      </div>
    </header>
  )
}

function formatProofDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function SharedCta({ session = null, mode = 'archive' }) {
  const skill = String(session?.practice_series || '').trim()
  const isChallenge = mode === 'challenge'
  const recordParams = new URLSearchParams()
  if (skill) recordParams.set('skill', skill)
  if (session?.share_token) recordParams.set('challenge', session.share_token)
  const recordQuery = recordParams.toString()
  const recordHref = recordQuery ? `/record?${recordQuery}` : '/record'
  return (
    <section className="border-t border-gray-100 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-950">
            {isChallenge ? 'Record your version' : 'Build your own proof archive'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isChallenge
              ? 'Keep your response private by default, then share it back if you choose.'
              : 'Record the work, keep the evidence, share only what you choose.'}
          </p>
        </div>
        <a href={isChallenge ? recordHref : '/today'} className="inline-flex items-center justify-center rounded-full bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800">
          {isChallenge ? 'Record your version' : 'Open Practica'}
        </a>
      </div>
    </section>
  )
}

function SharedVideo({ session }) {
  const sources = useMemo(() => sessionVideoSources(session), [session])
  const poster = sessionPosterUrl(session)
  if (!sources.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">
        Playback is not available for this proof.
      </div>
    )
  }
  return (
    <video
      className="aspect-video w-full rounded-2xl bg-black object-contain"
      controls
      playsInline
      preload="metadata"
      poster={poster || undefined}
    >
      {sources.map((src) => <source key={src} src={src} />)}
    </video>
  )
}

export function SharedProofPage({ shareToken = '' }) {
  const [state, setState] = useState({ loading: true, error: '', session: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setState({ loading: true, error: '', session: null })
      try {
        const res = await fetch(`/api/review/${encodeURIComponent(shareToken)}/`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'This shared proof is not available.')
        if (!cancelled) setState({ loading: false, error: '', session: data.session || null })
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || 'This shared proof is not available.', session: null })
      }
    }
    load()
    return () => { cancelled = true }
  }, [shareToken])

  const session = state.session
  return (
    <div className="min-h-screen bg-white">
      <SharedHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {state.loading ? (
          <p className="text-sm text-gray-500">Loading shared proof</p>
        ) : state.error ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-6">
            <p className="text-sm font-semibold text-gray-900">Shared proof unavailable</p>
            <p className="mt-1 text-sm text-gray-500">{state.error}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Shared proof</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">{session?.title || 'Practica proof'}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {[session?.practice_series, session?.duration_seconds ? fmtTimer(session.duration_seconds) : ''].filter(Boolean).join(' · ')}
              </p>
            </div>
            <SharedVideo session={session} />
            {session?.description ? <p className="text-sm leading-6 text-gray-600">{session.description}</p> : null}
            <SharedCta session={{ ...session, share_token: shareToken }} mode="challenge" />
          </div>
        )}
      </main>
    </div>
  )
}

export function SharedSkillPage({ shareToken = '' }) {
  const [state, setState] = useState({ loading: true, error: '', skill: null, sessions: [] })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setState({ loading: true, error: '', skill: null, sessions: [] })
      try {
        const res = await fetch(`/api/share/skill/${encodeURIComponent(shareToken)}/`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'This shared skill is not available.')
        if (!cancelled) setState({ loading: false, error: '', skill: data.skill || null, sessions: Array.isArray(data.sessions) ? data.sessions : [] })
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error?.message || 'This shared skill is not available.', skill: null, sessions: [] })
      }
    }
    load()
    return () => { cancelled = true }
  }, [shareToken])

  const sessions = state.sessions
  const latestSession = sessions[0] || null
  const olderSessions = sessions.slice(1)
  const proofCount = state.skill?.proof_count || sessions.length
  const proofDays = state.skill?.proof_days || 0
  const ownerName = state.skill?.owner_display_name || 'Someone'
  const skillName = state.skill?.name || 'this skill'

  return (
    <div className="min-h-screen bg-white">
      <SharedHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {state.loading ? (
          <p className="text-sm text-gray-500">Loading shared skill</p>
        ) : state.error ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-6">
            <p className="text-sm font-semibold text-gray-900">Shared skill unavailable</p>
            <p className="mt-1 text-sm text-gray-500">{state.error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Shared skill</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                  {ownerName} shared {proofCount} {proofCount === 1 ? 'proof' : 'proofs'} of {skillName}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                  {latestSession ? `Latest proof recorded ${formatProofDate(latestSession.recorded_at)}.` : 'This skill share is ready.'}
                  {proofDays ? ` ${proofDays} ${proofDays === 1 ? 'proof day' : 'proof days'} included.` : ''}
                </p>
              </div>
              {latestSession ? (
                <article className="rounded-2xl border border-gray-900 bg-gray-950 p-3 text-white shadow-sm sm:p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Watch newest proof first</p>
                      <h2 className="mt-1 text-lg font-semibold">{latestSession.title || 'Practica proof'}</h2>
                    </div>
                    <p className="text-xs text-white/55">{formatProofDate(latestSession.recorded_at)}</p>
                  </div>
                  <SharedVideo session={latestSession} />
                </article>
              ) : null}
            </section>
            {olderSessions.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-950">Earlier proofs</h2>
                <div className="space-y-4">
                  {olderSessions.map((session) => (
                    <article key={session.id} className="rounded-2xl border border-gray-200 p-3 sm:p-4">
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-gray-950">{session.title || 'Practica proof'}</h3>
                        <p className="mt-1 text-xs text-gray-500">{formatProofDate(session.recorded_at)}</p>
                      </div>
                      <SharedVideo session={session} />
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <SharedCta />
          </div>
        )}
      </main>
    </div>
  )
}
