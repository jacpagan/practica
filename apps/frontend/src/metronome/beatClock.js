import { beatPeriodSeconds, clampBpm } from './constants.js'

export function createBeatClock() {
  let epoch = null
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

  return {
    configure,
    start,
    stop,
    processTicks,
    getPeriod: () => period,
    isRunning: () => running,
    getBeatsPerBar: () => beatsPerBar,
    getBpm: () => bpm,
  }
}
