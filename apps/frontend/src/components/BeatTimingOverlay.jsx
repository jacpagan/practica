import React, { useEffect, useRef, useState } from 'react'
import { getHitLabel } from '../metronome/timingScore'

const softHitStyle = {
  ring: 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.12)]',
  fill: 'bg-white/20',
  text: 'text-white/90',
}

function MetronomeDial({ pulse, beatsPerBar, hitFlash, beatTick, large = false }) {
  const size = large ? 152 : 108
  const radius = size / 2 - 10
  const beatInBar = pulse.beatIndex % Math.max(1, beatsPerBar)
  const tickAge = beatTick ? performance.now() - beatTick.at : 9999
  const tickFlash = tickAge < 100
  const hitAge = hitFlash ? performance.now() - (hitFlash.at || 0) : 9999
  const hitActive = hitAge < 700
  const scale = 0.94 + pulse.phase * 0.08

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
        className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
          isHitBeat ? softHitStyle.fill : isCurrent ? 'bg-white/70' : isDownbeat ? 'bg-white/45' : 'bg-white/22'
        } ${isCurrent && tickFlash ? 'scale-125' : ''} ${isHitBeat ? 'scale-110' : ''}`}
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
          tickFlash ? 'border-white/50 bg-white/8' : 'border-white/20'
        } ${hitActive ? softHitStyle.ring : ''}`}
        style={{ transform: `scale(${scale})`, opacity: 0.7 }}
      />
      {segments}
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 border border-white/30" />
      {hitActive && hitFlash ? (
        <div className={`absolute left-1/2 top-[12%] -translate-x-1/2 text-center text-xs font-medium tracking-wide ${softHitStyle.text}`}>
          {getHitLabel()}
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
  showProximity = false,
  showLiveScore = true,
  compactTop = false,
  large = false,
}) {
  const [pulse, setPulse] = useState({ beatIndex: 0, phase: 0, msToNext: 0, isAccent: true })
  const rafRef = useRef(null)
  const [visibleCheer, setVisibleCheer] = useState('')

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
    const next = liveStats?.liveCheer || ''
    if (!next) {
      setVisibleCheer('')
      return undefined
    }
    if (liveStats?.streak >= 3 || liveStats?.landed === 1) {
      setVisibleCheer(next)
    }
    return undefined
  }, [liveStats?.liveCheer, liveStats?.streak, liveStats?.landed])

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <MetronomeDial
          pulse={pulse}
          beatsPerBar={beatsPerBar}
          hitFlash={hitFlash}
          beatTick={beatTick}
          large={large}
        />
        {showProximity ? (
          <p className="mt-3 text-[11px] text-white/50">Breathe with the beat</p>
        ) : null}
      </div>

      {showLiveScore && visibleCheer ? (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-center backdrop-blur-sm ${
            compactTop ? 'bottom-24' : 'bottom-10'
          }`}
        >
          <p className="text-xs text-white/80">{visibleCheer}</p>
        </div>
      ) : null}
    </div>
  )
}
