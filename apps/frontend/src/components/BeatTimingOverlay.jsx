import React, { useEffect, useRef, useState } from 'react'
import { puckOffsetPx } from '../metronome/timingScore'

function tierStyles(tier) {
  if (tier === 'perfect') {
    return {
      ring: 'border-emerald-400/90 shadow-[0_0_24px_rgba(52,211,153,0.45)]',
      fill: 'bg-emerald-400/35',
      text: 'text-emerald-200',
      label: 'On beat',
    }
  }
  if (tier === 'good') {
    return {
      ring: 'border-amber-400/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]',
      fill: 'bg-amber-400/25',
      text: 'text-amber-100',
      label: null,
    }
  }
  return {
    ring: 'border-red-400/80 shadow-[0_0_18px_rgba(248,113,113,0.35)]',
    fill: 'bg-red-500/20',
    text: 'text-red-200',
    label: 'Off beat',
  }
}

function MetronomeDial({ pulse, beatsPerBar, hitFlash, beatTick, large = false }) {
  const size = large ? 168 : 120
  const radius = size / 2 - 10
  const beatInBar = pulse.beatIndex % Math.max(1, beatsPerBar)
  const tickAge = beatTick ? performance.now() - beatTick.at : 9999
  const tickFlash = tickAge < 120
  const hitAge = hitFlash ? performance.now() - (hitFlash.at || 0) : 9999
  const hitActive = hitAge < 500
  const hitStyle = hitActive && hitFlash ? tierStyles(hitFlash.tier) : null
  const puckX = hitActive && hitFlash ? puckOffsetPx(hitFlash.deltaMs) : 0
  const scale = 0.92 + pulse.phase * 0.14

  const segments = Array.from({ length: Math.max(1, beatsPerBar) }, (_, index) => {
    const angle = (index / beatsPerBar) * Math.PI * 2 - Math.PI / 2
    const x = 50 + (Math.cos(angle) * radius * 100) / size
    const y = 50 + (Math.sin(angle) * radius * 100) / size
    const isDownbeat = index === 0
    const isCurrent = beatInBar === index
    const isHitBeat = hitActive && hitFlash && hitFlash.beatInBar === index

    return (
      <span
        key={index}
        className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ${
          isHitBeat && hitStyle ? hitStyle.fill : isCurrent ? 'bg-white/90' : isDownbeat ? 'bg-white/55' : 'bg-white/30'
        } ${isCurrent && tickFlash ? 'scale-150 bg-white' : ''}`}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: isDownbeat ? 10 : 8,
          height: isDownbeat ? 10 : 8,
        }}
      />
    )
  })

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 rounded-full border-2 transition-none ${
          tickFlash ? 'border-white/80 bg-white/15' : pulse.isAccent ? 'border-white/50' : 'border-white/25'
        } ${hitActive && hitStyle ? hitStyle.ring : ''}`}
        style={{ transform: `scale(${scale})`, opacity: tickFlash ? 0.95 : 0.75 }}
      />
      <div className="absolute inset-2 rounded-full border border-white/10" />
      {segments}
      <div
        className={`absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-white/25 transition-transform duration-150 ${
          hitActive && hitStyle ? hitStyle.fill : ''
        }`}
        style={{ transform: `translate(calc(-50% + ${puckX}px), -50%)` }}
      />
      {hitActive && hitFlash ? (
        <div className={`absolute left-1/2 top-[18%] -translate-x-1/2 text-center text-xs font-semibold drop-shadow ${hitStyle.text}`}>
          {hitStyle.label || `${hitFlash.deltaMs > 0 ? '+' : ''}${hitFlash.deltaMs} ms`}
        </div>
      ) : null}
    </div>
  )
}

export default function BeatTimingOverlay({
  active,
  getPhase,
  hitFlash,
  beatTick,
  beatsPerBar = 4,
  liveStats,
  showProximity = true,
  showLiveScore = true,
  compactTop = false,
  large = false,
}) {
  const [pulse, setPulse] = useState({ beatIndex: 0, phase: 0, msToNext: 0, isAccent: true })
  const rafRef = useRef(null)

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

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <MetronomeDial
          pulse={pulse}
          beatsPerBar={beatsPerBar}
          hitFlash={hitFlash}
          beatTick={beatTick}
          large={large}
        />
        {showProximity ? (
          <p className={`text-[11px] text-white/75 tabular-nums ${compactTop ? '' : ''}`}>
            {Math.round(pulse.msToNext)} ms to next beat
          </p>
        ) : null}
      </div>

      {showLiveScore && liveStats?.total > 0 ? (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-center backdrop-blur ${
            compactTop ? 'bottom-24' : 'bottom-8'
          }`}
        >
          <p className="text-lg font-semibold text-white tabular-nums">{liveStats.score ?? '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">timing score</p>
          <p className="mt-1 text-[11px] text-white/70">
            {liveStats.perfect} on · {liveStats.good} close
            {liveStats.streak > 1 ? ` · streak ${liveStats.streak}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}
