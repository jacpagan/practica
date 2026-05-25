import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTimingHit, shouldRejectClickBleed, tierFromDeltaMs } from './timingHit.js'
import { matchOnsetToBeat } from './matchHit.js'
import { detectOnsetInBuffer, createOnsetDetectorState } from './onsetDetectorCore.js'

test('speaker mode keeps loud on-beat drum in click bleed window', () => {
  const reject = shouldRejectClickBleed(
    { onsetTime: 1.05, strength: 0.5 },
    { audioTime: 1.0, gain: 0.15 },
    true,
  )
  assert.equal(reject, false)
})

test('speaker mode rejects quiet metronome bleed', () => {
  const reject = shouldRejectClickBleed(
    { onsetTime: 1.02, strength: 0.08 },
    { audioTime: 1.0, gain: 0.15 },
    true,
  )
  assert.equal(reject, true)
})

test('on-beat hit with speaker visual lag scores perfect', () => {
  const epoch = 10
  const period = 0.5
  const outputLag = 0.08
  const detectLag = 0.022
  const beatTime = epoch
  const userHit = beatTime + outputLag
  const onsetTime = userHit + detectLag
  const ctx = { sampleRate: 48000, outputLatency: outputLag, baseLatency: 0.005 }

  const { match } = resolveTimingHit({
    hit: { onsetTime, strength: 0.45 },
    epoch,
    period,
    beatsPerBar: 4,
    speakerPractice: true,
    syncOffsetMs: 0,
    audioContext: ctx,
    analyserFftSize: 256,
    visualLagSeconds: outputLag,
  })

  assert.ok(Math.abs(match.deltaMs) <= 25, `expected perfect, got deltaMs=${match.deltaMs}`)
  assert.equal(match.tier, 'perfect')
})

test('late hit scores off', () => {
  const epoch = 0
  const period = 0.5
  const match = matchOnsetToBeat({
    onsetTime: 0.2,
    epoch,
    period,
    beatsPerBar: 4,
    latencyCompensationMs: 30,
  })
  assert.equal(match.beatIndex, 0)
  assert.ok(match.deltaMs > 55)
  assert.equal(tierFromDeltaMs(match.deltaMs), 'off')
})

test('impulse onset is backdated within buffer', () => {
  const state = createOnsetDetectorState()
  const sr = 48000
  const n = 256
  const buffer = new Float32Array(n)
  const impulseIdx = 200
  buffer[impulseIdx] = 0.85
  const audioEnd = 2.5
  const onset = detectOnsetInBuffer(buffer, audioEnd, state, sr)
  assert.ok(onset)
  const expected = audioEnd - (n - 1 - impulseIdx) / sr
  assert.ok(Math.abs(onset.onsetTime - expected) < 0.001)
})
