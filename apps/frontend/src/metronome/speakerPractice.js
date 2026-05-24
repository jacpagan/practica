export const SPEAKER_PRACTICE_STORAGE_KEY = 'practica.metronome.speakerPractice.v1'

export const readSpeakerPractice = () => {
  try {
    const raw = window.localStorage.getItem(SPEAKER_PRACTICE_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {}
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
}
