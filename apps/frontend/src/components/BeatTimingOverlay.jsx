import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GOOD_MS, PERFECT_MS } from '../metronome/constants'

const CLAP_FADE_MS = 900
const POSITION_RANGE_MS = Math.round(GOOD_MS * 2.4)
const MAX_CLAPS = 8

function BeatPips({ beatsPerBar, currentBeat, tickFlash }) {
  const total = Math.max(1, Math.min(8, Number(beatsPerBar) || 4))
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const isDown = i === 0
        const isCurrent = i === currentBeat
        const flash = isCurrent && tickFlash
        const base = isDown ? 'h-2 w-2' : 'h-1.5 w-1.5'
        const color = flash
          ? 'bg-white scale-150'
          : isCurrent
            ? 'bg-white/85'
            : isDown
              ? 'bg-white/55'
              : 'bg-white/30'
        return (
          <span
            key={i}
            className={`rounded-full transition-all duration-150 ${base} ${color}`}
          />
        )
      })}
    </div>
  )
}

function ClapRail({ claps, tickFlash, bpm }) {
  const perfectPct = (PERFECT_MS / POSITION_RANGE_MS) * 100
  const goodPct = (GOOD_MS / POSITION_RANGE_MS) * 100
  const railClass = `relative h-12 w-full max-w-sm rounded-2xl border border-white/15 bg-black/45 backdrop-blur-md overflow-hidden transition-shadow duration-150 ${
    tickFlash ? 'shadow-[0_0_24px_rgba(255,255,255,0.18)] border-white/35' : ''
  }`

  return (
    <div className={railClass}>
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400/12"
        style={{ width: `${perfectPct}%` }}
      />
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white/[0.06]"
        style={{ width: `${goodPct}%` }}
      />
      <div className="absolute top-1.5 bottom-1.5 left-1/2 w-px -translate-x-1/2 bg-white/70" />
      <span
        className="absolute top-1.5 bottom-1.5 w-px bg-white/15"
        style={{ left: `${50 - perfectPct / 2}%` }}
      />
      <span
        className="absolute top-1.5 bottom-1.5 w-px bg-white/15"
        style={{ left: `${50 + perfectPct / 2}%` }}
      />
      <span
        className="absolute top-2 bottom-2 w-px bg-white/10"
        style={{ left: `${50 - goodPct / 2}%` }}
      />
      <span
        className="absolute top-2 bottom-2 w-px bg-white/10"
        style={{ left: `${50 + goodPct / 2}%` }}
      />

      <span className="absolute left-2 top-1.5 text-[9px] uppercase tracking-[0.18em] text-white/40">early</span>
      <span className="absolute right-2 top-1.5 text-[9px] uppercase tracking-[0.18em] text-white/40">late</span>
      {bpm ? (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[9px] uppercase tracking-[0.18em] text-white/45 tabular-nums">
          {bpm} BPM
        </span>
      ) : null}

      {claps.map((clap) => {
        const clampedDelta = Math.max(-POSITION_RANGE_MS, Math.min(POSITION_RANGE_MS, clap.deltaMs))
        const leftPct = 50 + (clampedDelta / POSITION_RANGE_MS) * 50
        const absDelta = Math.abs(clap.deltaMs)
        const isPerfect = absDelta <= PERFECT_MS
        const isGood = absDelta <= GOOD_MS
        const dotColor = isPerfect
          ? 'bg-emerald-300'
          : isGood
            ? 'bg-white'
            : 'bg-white/70'
        const ring = isPerfect ? 'shadow-[0_0_18px_rgba(110,231,183,0.65)]' : isGood ? 'shadow-[0_0_10px_rgba(255,255,255,0.45)]' : ''
        const size = isPerfect ? 16 : 13
        return (
          <span
            key={clap.id}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full clap-dot ${dotColor} ${ring}`}
            style={{
              left: `${leftPct}%`,
              width: size,
              height: size,
            }}
          />
        )
      })}

      <style>{`
        @keyframes clap-dot-pop {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(1.25); opacity: 1; }
          40%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
        }
        .clap-dot {
          animation: clap-dot-pop ${CLAP_FADE_MS}ms ease-out forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}

export default function BeatTimingOverlay({
  active,
  getPhase,
  hitFlash,
  beatTick,
  beatsPerBar = 4,
  showProximity = false,
  bpm,
}) {
  const [claps, setClaps] = useState([])
  const [currentBeat, setCurrentBeat] = useState(0)
  const [tickFlash, setTickFlash] = useState(false)
  const idRef = useRef(0)
  const lastHitRef = useRef(null)
  const pulseRafRef = useRef(null)
  const flashTimeoutRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    let mounted = true
    const tick = () => {
      try {
        const phase = getPhase?.()
        if (mounted && phase) {
          const nextBeat = phase.beatIndex % Math.max(1, beatsPerBar)
          setCurrentBeat((current) => (current === nextBeat ? current : nextBeat))
        }
      } catch {}
      pulseRafRef.current = window.setTimeout(tick, 80)
    }
    tick()
    return () => {
      mounted = false
      if (pulseRafRef.current) window.clearTimeout(pulseRafRef.current)
      pulseRafRef.current = null
    }
  }, [active, getPhase, beatsPerBar])

  useEffect(() => {
    if (!beatTick?.at) return undefined
    setTickFlash(true)
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = window.setTimeout(() => setTickFlash(false), 140)
    return () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    }
  }, [beatTick?.at])

  useEffect(() => {
    if (!hitFlash) return undefined
    const signature = `${hitFlash.beatIndex}:${hitFlash.at}`
    if (lastHitRef.current === signature) return undefined
    lastHitRef.current = signature

    idRef.current += 1
    const id = idRef.current
    const deltaMs = Number.isFinite(hitFlash.deltaMs) ? hitFlash.deltaMs : 0
    setClaps((current) => {
      const next = [...current, { id, deltaMs, at: performance.now() }]
      return next.length > MAX_CLAPS ? next.slice(-MAX_CLAPS) : next
    })

    const timeoutId = window.setTimeout(() => {
      setClaps((current) => current.filter((entry) => entry.id !== id))
    }, CLAP_FADE_MS + 100)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hitFlash])

  const helper = useMemo(() => {
    if (!showProximity) return null
    return 'Clap with the metronome — the dot shows where you landed'
  }, [showProximity])

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex flex-col items-center gap-2 px-3 pb-[max(5.5rem,env(safe-area-inset-bottom))]">
      <BeatPips
        beatsPerBar={beatsPerBar}
        currentBeat={currentBeat}
        tickFlash={tickFlash}
      />
      <ClapRail claps={claps} tickFlash={tickFlash} bpm={bpm} />
      {helper ? (
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 text-center">
          {helper}
        </p>
      ) : null}
    </div>
  )
}
