import React, { useEffect, useState } from 'react'

// Subtle, frame-wide vignette that lifts on every tick and breathes between
// beats. Driven by remounting (via React `key`) of an inner element each tick,
// so the actual animation is pure CSS — no JS per-frame work.
export default function BeatBackgroundPulse({ active, beatTick }) {
  const [pulseKey, setPulseKey] = useState(0)
  const [isAccent, setIsAccent] = useState(false)

  useEffect(() => {
    if (!active || !beatTick?.at) return undefined
    setIsAccent(Boolean(beatTick.isAccent))
    setPulseKey((current) => current + 1)
    return undefined
  }, [active, beatTick?.at, beatTick?.isAccent])

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
      <div
        key={pulseKey}
        className={isAccent ? 'beat-pulse-accent' : 'beat-pulse-offbeat'}
      />
      <style>{`
        @keyframes beat-pulse-offbeat-anim {
          0%   { box-shadow: inset 0 0 0 0 rgba(255,255,255,0); opacity: 0; }
          18%  { box-shadow: inset 0 0 80px 0 rgba(255,255,255,0.06); opacity: 1; }
          100% { box-shadow: inset 0 0 30px 0 rgba(255,255,255,0); opacity: 0; }
        }
        @keyframes beat-pulse-accent-anim {
          0%   { box-shadow: inset 0 0 0 0 rgba(252,211,77,0); opacity: 0; }
          22%  { box-shadow: inset 0 0 140px 0 rgba(252,211,77,0.14); opacity: 1; }
          100% { box-shadow: inset 0 0 60px 0 rgba(252,211,77,0); opacity: 0; }
        }
        .beat-pulse-offbeat {
          position: absolute;
          inset: 0;
          pointer-events: none;
          animation: beat-pulse-offbeat-anim 360ms ease-out forwards;
        }
        .beat-pulse-accent {
          position: absolute;
          inset: 0;
          pointer-events: none;
          animation: beat-pulse-accent-anim 520ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
