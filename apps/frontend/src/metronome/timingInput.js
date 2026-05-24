export const TIMING_INPUT_STORAGE_KEY = 'practica.metronome.timingInput.v1'
export const SPEAKER_PRACTICE_STORAGE_KEY = 'practica.metronome.speakerPractice.v1'

/** @typedef {'mic' | 'screen' | 'both'} TimingInputMode */

export const readTimingInputMode = () => {
  try {
    const raw = window.localStorage.getItem(TIMING_INPUT_STORAGE_KEY)
    if (raw === 'mic' || raw === 'screen' || raw === 'both') return raw
  } catch {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches) {
    return 'both'
  }
  return 'mic'
}

export const readSpeakerPractice = () => {
  try {
    const raw = window.localStorage.getItem(SPEAKER_PRACTICE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {}
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
}
