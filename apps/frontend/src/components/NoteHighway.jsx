import React, { useEffect, useRef, useState } from 'react'
import { GOOD_MS, PERFECT_MS } from '../metronome/constants'

// Layout constants — kept here so the look-and-feel is in one place.
const HIT_ZONE_LEFT_PCT = 28        // hit zone sits 28% from the left of the strip
const LOOK_AHEAD_BEATS = 3          // how many beats are visible to the right of the hit zone
const PAST_FADE_BEATS = 1.2         // how far past the hit zone notes keep scrolling before fading
const NOTE_POOL_PAST = 2
const NOTE_POOL_FUTURE = 6
const IMPACT_FADE_MS = 700
const MAX_IMPACTS = 6
const POSITION_RANGE_MS = Math.round(GOOD_MS * 2.2)
const noteSizePx = (isAccent) => (isAccent ? 18 : 12)

const triggerHaptic = (deltaMs) => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  const abs = Math.abs(Number(deltaMs) || 0)
  const ms = abs <= PERFECT_MS ? 18 : abs <= GOOD_MS ? 12 : 8
  try { navigator.vibrate(ms) } catch {}
}

function CountInBadge({ countInRemaining, beatsPerBar }) {
  if (countInRemaining == null) return null
  const total = Math.max(1, Number(beatsPerBar) || 4)
  // 0 means recording is about to start — show "GO". Use beat number for the rest.
  const remaining = Math.max(0, Number(countInRemaining) || 0)
  const label = remaining === 0 ? 'GO' : String(remaining)
  return (
    <div
      key={`countin-${remaining}`}
      className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 select-none count-badge"
      style={{ left: `${HIT_ZONE_LEFT_PCT}%` }}
    >
      <span className="text-white font-semibold tracking-tight drop-shadow-[0_0_18px_rgba(255,255,255,0.6)]" style={{ fontSize: '46px', lineHeight: '1' }}>
        {label}
      </span>
    </div>
  )
}

function HitImpact({ deltaMs, at, id }) {
  const tier = Math.abs(deltaMs) <= PERFECT_MS
    ? 'perfect'
    : Math.abs(deltaMs) <= GOOD_MS
      ? 'good'
      : 'off'
  // On-beat hits land on the line; only clearly early/late hits shift sideways.
  const displayDeltaMs = tier === 'off' ? deltaMs : 0
  const offsetPct = Math.max(-12, Math.min(12, (Math.max(-POSITION_RANGE_MS, Math.min(POSITION_RANGE_MS, displayDeltaMs)) / POSITION_RANGE_MS) * 12))
  const ringClass = tier === 'perfect'
    ? 'border-emerald-300/90 shadow-[0_0_28px_rgba(110,231,183,0.7)]'
    : tier === 'good'
      ? 'border-white/85 shadow-[0_0_18px_rgba(255,255,255,0.45)]'
      : 'border-white/40'
  const sparkClass = tier === 'perfect'
    ? 'bg-emerald-300 shadow-[0_0_22px_rgba(110,231,183,0.7)]'
    : tier === 'good'
      ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]'
      : 'bg-white/60'
  return (
    <span
      key={id}
      className="pointer-events-none absolute top-1/2 -translate-y-1/2 hit-impact"
      style={{ left: `calc(${HIT_ZONE_LEFT_PCT}% + ${offsetPct}%)`, transform: 'translateY(-50%)' }}
    >
      <span className={`block w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 ${sparkClass} hit-spark`} />
      {tier !== 'off' ? (
        <span className={`block w-8 h-8 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 hit-ring ${ringClass}`} />
      ) : null}
    </span>
  )
}

export default function NoteHighway({
  active,
  beatClockRef,
  audioContextRef,
  hitFlash,
  beatTick,
  beatsPerBar = 4,
  bpm,
  countInRemaining,
  isRecording,
  hapticEnabled = true,
}) {
  const stripRef = useRef(null)
  const notesContainerRef = useRef(null)
  const hitZoneRef = useRef(null)
  const noteElsRef = useRef(new Map())  // beatIndex -> DOM node
  const rafRef = useRef(null)
  const lastHitRef = useRef(null)
  const idRef = useRef(0)
  const [impacts, setImpacts] = useState([])
  const [tickFlash, setTickFlash] = useState(false)
  const flashTimeoutRef = useRef(null)

  // Smooth scroll loop — pure DOM transform writes, no React state per frame.
  useEffect(() => {
    if (!active) return undefined
    let cancelled = false

    const render = () => {
      if (cancelled) return
      const ctx = audioContextRef?.current
      const clock = beatClockRef?.current
      const container = notesContainerRef.current
      if (!ctx || !clock || !container) {
        rafRef.current = requestAnimationFrame(render)
        return
      }
      const now = ctx.currentTime
      const beats = clock.getSurroundingBeats
        ? clock.getSurroundingBeats(now, { past: NOTE_POOL_PAST, future: NOTE_POOL_FUTURE })
        : []
      const period = clock.getPeriod ? clock.getPeriod() : 0.75
      if (!period) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      const rect = container.getBoundingClientRect()
      const width = rect.width || 320
      const hitX = (HIT_ZONE_LEFT_PCT / 100) * width
      // Distance per second: we want LOOK_AHEAD_BEATS to span from hit zone to the right edge.
      const lookAheadSeconds = LOOK_AHEAD_BEATS * period
      const pxPerSecond = lookAheadSeconds > 0 ? (width - hitX) / lookAheadSeconds : 0

      const seen = new Set()
      beats.forEach((beat) => {
        const dt = beat.scheduledTime - now
        // Cull beats that have passed the fade window or are too far in the future.
        if (dt < -period * PAST_FADE_BEATS) return
        if (dt > lookAheadSeconds * 1.05) return
        seen.add(beat.beatIndex)
        let node = noteElsRef.current.get(beat.beatIndex)
        if (!node) {
          node = document.createElement('div')
          node.setAttribute('data-beat-index', String(beat.beatIndex))
          node.className = beat.isAccent
            ? 'absolute top-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.7)]'
            : 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
          const size = noteSizePx(beat.isAccent)
          node.style.width = `${size}px`
          node.style.height = `${size}px`
          node.style.willChange = 'transform, opacity'
          node.style.left = '0px'
          node.style.top = '50%'
          container.appendChild(node)
          noteElsRef.current.set(beat.beatIndex, node)
        }
        // x relative to container left; center the note on the line when dt === 0.
        const size = noteSizePx(beat.isAccent)
        const x = hitX + dt * pxPerSecond
        const opacity = dt < 0
          ? Math.max(0, 1 + dt / (period * PAST_FADE_BEATS))
          : 1
        node.style.transform = `translate3d(${x - size / 2}px, -50%, 0)`
        node.style.opacity = String(opacity)
      })

      // Remove DOM nodes for beats no longer in the active window.
      noteElsRef.current.forEach((node, beatIndex) => {
        if (!seen.has(beatIndex)) {
          node.remove()
          noteElsRef.current.delete(beatIndex)
        }
      })

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      noteElsRef.current.forEach((node) => node.remove())
      noteElsRef.current.clear()
    }
  }, [active, audioContextRef, beatClockRef])

  // Beat tick flash — pulses the hit zone & strip border briefly on each tick.
  useEffect(() => {
    if (!beatTick?.at) return undefined
    setTickFlash(true)
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = window.setTimeout(() => setTickFlash(false), 130)
    return () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    }
  }, [beatTick?.at])

  // On every detected clap, push an Impact and (optionally) buzz the device.
  useEffect(() => {
    if (!hitFlash) return undefined
    const signature = `${hitFlash.beatIndex}:${hitFlash.at}`
    if (lastHitRef.current === signature) return undefined
    lastHitRef.current = signature

    idRef.current += 1
    const id = idRef.current
    const deltaMs = Number.isFinite(hitFlash.deltaMs) ? hitFlash.deltaMs : 0
    setImpacts((current) => {
      const next = [...current, { id, deltaMs, at: performance.now() }]
      return next.length > MAX_IMPACTS ? next.slice(-MAX_IMPACTS) : next
    })
    if (hapticEnabled && isRecording) triggerHaptic(deltaMs)

    const timeoutId = window.setTimeout(() => {
      setImpacts((current) => current.filter((entry) => entry.id !== id))
    }, IMPACT_FADE_MS + 80)
    return () => window.clearTimeout(timeoutId)
  }, [hitFlash, hapticEnabled, isRecording])

  if (!active) return null

  const stripClass = `relative h-24 w-full max-w-2xl rounded-2xl border bg-black/55 backdrop-blur-md overflow-hidden transition-all duration-150 ${
    tickFlash ? 'border-white/60 shadow-[0_0_30px_rgba(255,255,255,0.18)]' : 'border-white/12'
  }`

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex flex-col items-center gap-2 px-3 pb-[max(5.75rem,env(safe-area-inset-bottom))]">
      <div ref={stripRef} className={stripClass}>
        {/* Soft tolerance zones around the hit zone */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-400/8"
          style={{
            left: `${HIT_ZONE_LEFT_PCT}%`,
            width: `${(PERFECT_MS / POSITION_RANGE_MS) * 12}%`,
            transform: 'translateX(-50%)',
          }}
        />
        <div
          className="absolute top-0 bottom-0 bg-white/5"
          style={{
            left: `${HIT_ZONE_LEFT_PCT}%`,
            width: `${(GOOD_MS / POSITION_RANGE_MS) * 12}%`,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Hit zone vertical rail */}
        <div
          ref={hitZoneRef}
          className={`absolute top-3 bottom-3 w-px transition-colors duration-150 ${
            tickFlash ? 'bg-white shadow-[0_0_24px_rgba(255,255,255,0.85)]' : 'bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.35)]'
          }`}
          style={{ left: `${HIT_ZONE_LEFT_PCT}%` }}
        />

        {/* Faint grid line through the center for note travel */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/8" />

        {/* Notes are drawn imperatively into this container */}
        <div ref={notesContainerRef} className="absolute inset-0" />

        {/* Hit impacts (DOM-mounted but CSS-animated) */}
        {impacts.map((impact) => (
          <HitImpact key={impact.id} id={impact.id} deltaMs={impact.deltaMs} at={impact.at} />
        ))}

        {/* Count-in numbers float over the hit zone */}
        <CountInBadge countInRemaining={countInRemaining} beatsPerBar={beatsPerBar} />

        {/* Corner labels (subtle) */}
        <span className="absolute left-3 top-2 text-[9px] uppercase tracking-[0.18em] text-white/35">tap when on the line</span>
        {bpm ? (
          <span className="absolute right-3 bottom-2 text-[9px] uppercase tracking-[0.18em] text-white/45 tabular-nums">
            {bpm} BPM
          </span>
        ) : null}
      </div>

      <style>{`
        @keyframes hit-spark-pop {
          0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
          55%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
        }
        @keyframes hit-ring-expand {
          0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          20%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes count-badge-pop {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          70%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
        }
        .hit-spark { animation: hit-spark-pop ${IMPACT_FADE_MS}ms ease-out forwards; will-change: transform, opacity; }
        .hit-ring  { animation: hit-ring-expand ${IMPACT_FADE_MS}ms ease-out forwards; will-change: transform, opacity; }
        .count-badge { animation: count-badge-pop 520ms cubic-bezier(0.22, 1.1, 0.36, 1) forwards; will-change: transform, opacity; }
      `}</style>
    </div>
  )
}
