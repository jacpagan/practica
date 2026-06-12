import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RECORDER_AUDIO_BITS_PER_SECOND,
  RECORDER_VIDEO_BITS_PER_SECOND,
  recorderOptions,
} from './recorderSettings.js'

test('recorder settings keep one-minute captures near 3.5 MB', () => {
  const estimatedBytesPerMinute = (
    (RECORDER_VIDEO_BITS_PER_SECOND + RECORDER_AUDIO_BITS_PER_SECOND) * 60
  ) / 8

  assert.ok(estimatedBytesPerMinute < 3.5 * 1024 * 1024)
  assert.deepEqual(recorderOptions('video/webm'), {
    mimeType: 'video/webm',
    videoBitsPerSecond: 400000,
    audioBitsPerSecond: 64000,
  })
})
