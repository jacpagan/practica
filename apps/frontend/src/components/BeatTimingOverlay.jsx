import React, { useEffect, useRef, useState } from 'react'
import { GOOD_MS, PERFECT_MS } from '../metronome/constants'

const CLAP_FADE_MS = 800
const POSITION_RANGE_MS = GOOD_MS * 2.5

function MetronomeDial({ pulse, beatsPerBar, beatTick, large = false }) {
  const size = large ? 152 : 108
  const radius = size / 2 - 10
  const beatInBar = pulse.beatIndex % Math.max(1, beatsPerBar)
  const tickAge = beatTick ? performance.now() - beatTick.at : 9999
  const tickFlash = tickAge < 100
  const scale = 0.94 + pulse.phase * 0.08

  const segments = Array.from({ length: Math.max(1, beatsPerBar) }, (_, index) => {
    const angle = (index / beatsPerBar) * Math.PI * 2 - Math.PI / 2
    const x = 50 + (Math.cos(angle) * radius * 100) / size
    const y = 50 + (Math.sin(angle) * radius * 100) / size
    const isDownbeat = index === 0
    const isCurrent = beatInBar === index

    return (
      <span
        key={index}
        className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
          isCurrent ? 'bg-white/85' : isDownbeat ? 'bg-white/45' : 'bg-white/22'
        } ${isCurrent && tickFlash ? 'scale-125' : ''}`}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: isDownbeat ? 9 : 7,
          height: isDownbeat ? 9 : 7,
        }}
      />
    )
  })

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 rounded-full border transition-all duration-300 ${
          tickFlash ? 'border-white/55 bg-white/8' : 'border-white/20'
        }`}
        style={{ transform: `scale(${scale})`, opacity: 0.75 }}
      />
      {segments}
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 border border-white/30" />
    </div>
  )
}

function ClapRail({ claps }) {
  if (!claps.length) {
    return (
      <div className="relative h-7 w-44 rounded-full bg-white/5">
        <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-white/35" />
        <div
          className="absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5"
          style={{ width: `${(PERFECT_MS / POSITION_RANGE_MS) * 100}%` }}
        />
      </div>
    )
  }

  return (
    <div className="relative h-7 w-44 rounded-full bg-white/8 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-white/50" />
      <div
        className="absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/8"
        style={{ width: `${(PERFECT_MS / POSITION_RANGE_MS) * 100}%` }}
      />
      {claps.map((clap) => {
        const clampedDelta = Math.max(-POSITION_RANGE_MS, Math.min(POSITION_RANGE_MS, clap.deltaMs))
        const leftPct = 50 + (clampedDelta / POSITION_RANGE_MS) * 50
        const age = performance.now() - clap.at
        const opacity = Math.max(0, 1 - age / CLAP_FADE_MS)
        const absDelta = Math.abs(clap.deltaMs)
        const dotColor = absDelta <= PERFECT_MS
          ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]'
          : absDelta <= GOOD_MS
            ? 'bg-white/85'
            : 'bg-white/55'
        const size = absDelta <= PERFECT_MS ? 14 : 11
        return (
          <span
            key={clap.id}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${dotColor}`}
            style={{
              left: `${leftPct}%`,
              opacity,
              width: size,
              height: size,
              transition: 'opacity 120ms linear',
            }}
          />
        )
      })}
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
  large = false,
}) {
  const [pulse, setPulse] = useState({ beatIndex: 0, phase: 0, msToNext: 0, isAccent: true })
  const [claps, setClaps] = useState([])
  const rafRef = useRef(null)
  const idRef = useRef(0)
  const lastHitRef = useRef(null)
  const pruneTimeoutRef = useRef(null)

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return undefined
    }

    const tick = () => {
      try {
        const next = getPhase?.()
        if (next) setPulse(next)
      } catch {}
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, getPhase])

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
      return next.length > 6 ? next.slice(-6) : next
    })

    const timeoutId = window.setTimeout(() => {
      setClaps((current) => current.filter((entry) => entry.id !== id))
    }, CLAP_FADE_MS + 80)
    pruneTimeoutRef.current = timeoutId
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hitFlash])

  useEffect(() => () => {
    if (pruneTimeoutRef.current) window.clearTimeout(pruneTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!claps.length) return undefined
    const id = window.setInterval(() => {
      setClaps((current) => current.filter((entry) => performance.now() - entry.at < CLAP_FADE_MS + 40))
    }, 100)
    return () => window.clearInterval(id)
  }, [claps.length])

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <MetronomeDial
          pulse={pulse}
          beatsPerBar={beatsPerBar}
          beatTick={beatTick}
          large={large}
        />
        <ClapRail claps={claps} />
        {showProximity ? (
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            Your clap vs the beat
          </p>
        ) : null}
      </div>
    </div>
  )
}
