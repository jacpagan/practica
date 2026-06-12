export const RECORDER_VIDEO_BITS_PER_SECOND = 400000
export const RECORDER_AUDIO_BITS_PER_SECOND = 64000

export const recorderOptions = (mimeType = '') => ({
  ...(mimeType ? { mimeType } : {}),
  videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
  audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
})
