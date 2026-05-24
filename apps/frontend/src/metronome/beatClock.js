import { beatPeriodSeconds, clampBpm } from './constants'

export function createBeatClock() {
  let epoch = null
  let recordEpoch = null
  let bpm = 80
  let beatsPerBar = 4
  let period = beatPeriodSeconds(80)
  let nextBeatIndex = 0
  let lastEmittedIndex = -1
  let running = false

  const configure = ({ bpm: nextBpm, beatsPerBar: nextBeatsPerBar }) => {
    if (nextBpm != null) bpm = clampBpm(nextBpm)
    if (nextBeatsPerBar != null) beatsPerBar = Math.max(1, Number(nextBeatsPerBar) || 4)
    period = beatPeriodSeconds(bpm)
  }

  const start = (atEpoch) => {
    epoch = Number(atEpoch)
    if (!Number.isFinite(epoch)) epoch = 0
    nextBeatIndex = 0
    lastEmittedIndex = -1
    running = true
  }

  const stop = () => {
    running = false
    epoch = null
    nextBeatIndex = 0
    lastEmittedIndex = -1
  }

  const setRecordAnchor = (at) => {
    recordEpoch = Number.isFinite(Number(at)) ? Number(at) : null
  }

  const clearRecordAnchor = () => {
    recordEpoch = null
  }

  const processTicks = (now, onTick) => {
    if (!running || epoch == null || typeof onTick !== 'function') return
    const t = Number(now)
    if (!Number.isFinite(t)) return
    let caughtUp = 0
    while (t >= epoch + nextBeatIndex * period - 0.0005) {
      const beatIndex = nextBeatIndex
      const scheduledTime = epoch + beatIndex * period
      if (beatIndex > lastEmittedIndex) {
        lastEmittedIndex = beatIndex
        onTick({
          beatIndex,
          scheduledTime,
          isAccent: beatIndex % beatsPerBar === 0,
        })
      }
      nextBeatIndex += 1
      caughtUp += 1
      if (caughtUp >= 8) break
    }
  }

  const getPhase = (now) => {
    // Visual phase always follows the running metronome grid. recordEpoch is
    // only for exported timing metadata (seconds since recording started).
    const anchor = epoch
    if (anchor == null) {
      return { beatIndex: 0, phase: 0, msToNext: period * 1000, isAccent: true }
    }
    const t = Math.max(0, Number(now) - anchor)
    const beatIndex = Math.floor(t / period)
    const within = t % period
    const phase = within / period
    const msToNext = (period - within) * 1000
    return {
      beatIndex,
      phase,
      msToNext,
      isAccent: beatIndex % beatsPerBar === 0,
    }
  }

  // Return the surrounding beats around `now`: a few in the past and several
  // upcoming. Each beat is stable across calls (keyed by absolute beatIndex
  // from the clock epoch), so the highway can position notes by their scheduled
  // audio time and animate them smoothly toward the hit zone.
  const getSurroundingBeats = (now, { past = 2, future = 6 } = {}) => {
    const anchor = epoch
    if (anchor == null || !Number.isFinite(Number(now))) return []
    const t = Math.max(0, Number(now) - anchor)
    const currentIndex = Math.floor(t / period)
    const startIndex = Math.max(0, currentIndex - Math.max(0, Number(past) || 0))
    const endIndex = currentIndex + Math.max(1, Number(future) || 1)
    const beats = []
    for (let i = startIndex; i <= endIndex; i += 1) {
      beats.push({
        beatIndex: i,
        scheduledTime: anchor + i * period,
        isAccent: i % beatsPerBar === 0,
      })
    }
    return beats
  }

  return {
    configure,
    start,
    stop,
    processTicks,
    getPhase,
    getSurroundingBeats,
    setRecordAnchor,
    clearRecordAnchor,
    getPeriod: () => period,
    getEpoch: () => epoch,
    getRecordEpoch: () => recordEpoch,
    isRunning: () => running,
    getBeatsPerBar: () => beatsPerBar,
    getBpm: () => bpm,
  }
}
