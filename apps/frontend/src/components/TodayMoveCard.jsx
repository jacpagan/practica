import React, { useMemo } from 'react'
import { getProgramMove, localDateStamp } from '../todayMove'
import { reportClientEvent } from '../utils'

const formatDuration = (seconds) => (seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`)

export default function TodayMoveCard({ completed = false, onTryMove }) {
  const move = useMemo(() => {
    const today = new Date()
    let startedOn = localDateStamp(today)
    try {
      const storageKey = 'practica.program.everyday_mobility.started_on.v1'
      startedOn = window.localStorage.getItem(storageKey) || startedOn
      if (!window.localStorage.getItem(storageKey)) window.localStorage.setItem(storageKey, startedOn)
    } catch {
      // Storage can be unavailable in private browsing; the exercise still works.
    }
    return getProgramMove(startedOn, today)
  }, [])

  const start = () => {
    reportClientEvent('today_move_started', {
      action: 'today_move_started',
      move_slug: move.slug,
      program: 'everyday_mobility',
    })
    onTryMove?.(move)
  }

  return (
    <section
      className="overflow-hidden rounded-[28px] bg-gray-950 text-white shadow-xl shadow-gray-200/70"
      aria-labelledby="today-move-title"
    >
      <div className="relative px-5 py-5 sm:px-7 sm:py-7">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Today’s move</p>
            <p className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/75">
              Day {move.dayNumber} of {move.programLength}
            </p>
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm text-white/55">{move.target} · {formatDuration(move.durationSeconds)}</p>
              <h2 id="today-move-title" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{move.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">{move.instruction}</p>
            </div>
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border border-white/15 bg-white/10 text-center backdrop-blur">
              <span className="text-lg font-semibold">{move.dose.split(' ')[0]}</span>
              <span className="max-w-16 text-[11px] leading-4 text-white/60">{move.dose.split(' ').slice(1).join(' ')}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {move.cues.map((cue, index) => (
              <div key={cue} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3">
                <p className="text-[10px] font-semibold text-emerald-300">0{index + 1}</p>
                <p className="mt-1 text-xs leading-4 text-white/75">{cue}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={start}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-4 text-base font-semibold text-gray-950 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {completed ? 'Try it once more' : 'Try today’s move'}
          </button>
          <p className="mt-3 text-center text-[11px] text-white/45">Your recording stays private. Stop if you feel pain.</p>
        </div>
      </div>
    </section>
  )
}
