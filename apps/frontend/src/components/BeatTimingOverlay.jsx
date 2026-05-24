import React, { useEffect, useRef, useState } from 'react'
import { getHitLabel, puckOffsetPx } from '../metronome/timingScore'

function tierStyles(tier) {
  if (tier === 'perfect') {
    return {
      ring: 'border-emerald-400/90 shadow-[0_0_28px_rgba(52,211,153,0.5)]',
      fill: 'bg-emerald-400/40',
      text: 'text-emerald-100',
    }
  }
  if (tier === 'good') {
    return {
      ring: 'border-amber-300/85 shadow-[0_0_22px_rgba(252,211,77,0.4)]',
      fill: 'bg-amber-300/30',
      text: 'text-amber-50',
    }
  }
  return null
}

function MetronomeDial({ pulse, beatsPerBar, hitFlash, beatTick, large = false }) {
  const size = large ? 168 : 120
  const radius = size / 2 - 10
  const beatInBar = pulse.beatIndex % Math.max(1, beatsPerBar)
  const tickAge = beatTick ? performance.now() - beatTick.at : 9999
  const tickFlash = tickAge < 120
  const hitAge = hitFlash ? performance.now() - (hitFlash.at || 0) : 9999
  const hitActive = hitAge < 520
  const hitStyle = hitActive && hitFlash ? tierStyles(hitFlash.tier) : null
  const puckX = hitActive && hitFlash && hitStyle ? puckOffsetPx(hitFlash.deltaMs) : 0
  const scale = 0.92 + pulse.phase * 0.14
  const hitLabel = hitActive && hitFlash && hitStyle
    ? getHitLabel(hitFlash.tier, hitFlash.deltaMs)
    : ''

  const segments = Array.from({ length: Math.max(1, beatsPerBar) }, (_, index) => {
    const angle = (index / beatsPerBar) * Math.PI * 2 - Math.PI / 2
    const x = 50 + (Math.cos(angle) * radius * 100) / size
    const y = 50 + (Math.sin(angle) * radius * 100) / size
    const isDownbeat = index === 0
    const isCurrent = beatInBar === index
    const isHitBeat = hitActive && hitFlash && hitFlash.beatInBar === index && hitStyle

    return (
      <span
        key={index}
        className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ${
          isHitBeat ? hitStyle.fill : isCurrent ? 'bg-white/90' : isDownbeat ? 'bg-white/55' : 'bg-white/30'
        } ${isCurrent && tickFlash ? 'scale-150 bg-white' : ''} ${isHitBeat ? 'scale-125' : ''}`}
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
      {hitActive && hitStyle ? (
        <div
          className={`absolute inset-0 rounded-full animate-ping opacity-40 ${hitStyle.fill}`}
          style={{ animationDuration: '0.55s' }}
        />
      ) : null}
      <div
        className={`absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-white/25 transition-transform duration-150 ${
          hitActive && hitStyle ? hitStyle.fill : ''
        }`}
        style={{ transform: `translate(calc(-50% + ${puckX}px), -50%)` }}
      />
      {hitLabel ? (
        <div className={`absolute left-1/2 top-[14%] -translate-x-1/2 text-center text-sm font-semibold drop-shadow-md ${hitStyle.text}`}>
          {hitLabel}
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

  const cheer = liveStats?.liveCheer || (liveStats?.landed > 0 ? `${liveStats.landed} locked in` : '')

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
          <p className="text-[11px] text-white/75">
            Feel the next beat coming
          </p>
        ) : null}
      </div>

      {showLiveScore && cheer ? (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-emerald-950/70 px-4 py-2 text-center backdrop-blur ${
            compactTop ? 'bottom-24' : 'bottom-8'
          }`}
        >
          <p className="text-sm font-semibold text-emerald-50">{cheer}</p>
          {liveStats?.perfect > 0 ? (
            <p className="mt-0.5 text-[11px] text-emerald-200/80">
              {liveStats.perfect} locked in{liveStats.good > 0 ? ` · ${liveStats.good} close` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
