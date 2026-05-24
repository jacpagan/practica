import React, { useEffect, useRef, useState } from 'react'

function HitBurst({ hitFlash }) {
  if (!hitFlash) return null
  const { tier, deltaMs } = hitFlash
  const isPerfect = tier === 'perfect'
  const isGood = tier === 'good'
  const label = isPerfect
    ? 'On beat'
    : isGood
      ? `${deltaMs > 0 ? '+' : ''}${deltaMs} ms`
      : ''

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
      <div
        className={`absolute w-28 h-28 rounded-full border-2 animate-hit-burst ${
          isPerfect ? 'border-emerald-300/90 bg-emerald-400/25' : 'border-amber-300/90 bg-amber-400/20'
        }`}
      />
      {label ? (
        <p className={`relative text-sm font-semibold drop-shadow ${isPerfect ? 'text-emerald-200' : 'text-amber-100'}`}>
          {label}
        </p>
      ) : null}
    </div>
  )
}

export default function BeatTimingOverlay({ active, getPhase, hitFlash, showProximity = true }) {
  const [pulse, setPulse] = useState({ phase: 0, msToNext: 0, isAccent: true })
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

  const scale = 0.88 + pulse.phase * 0.2
  const ringOpacity = 0.35 + (1 - pulse.phase) * 0.45

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`rounded-full border-2 transition-none ${
            pulse.isAccent ? 'border-white/70' : 'border-white/35'
          }`}
          style={{
            width: '4.5rem',
            height: '4.5rem',
            transform: `scale(${scale})`,
            opacity: ringOpacity,
          }}
        />
      </div>
      {showProximity ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
          {Math.round(pulse.msToNext)} ms to beat
        </div>
      ) : null}
      <HitBurst hitFlash={hitFlash} />
      <style>{`
        @keyframes hit-burst-keyframes {
          0% { transform: scale(0.35); opacity: 0.95; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        .animate-hit-burst {
          animation: hit-burst-keyframes 420ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
