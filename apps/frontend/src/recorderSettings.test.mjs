import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RECORDER_AUDIO_BITS_PER_SECOND,
  RECORDER_VIDEO_BITS_PER_SECOND,
  recorderOptions,
} from './recorderSettings.js'

test('recorder settings keep one-minute captures near 20 MB', () => {
  const estimatedBytesPerMinute = (
    (RECORDER_VIDEO_BITS_PER_SECOND + RECORDER_AUDIO_BITS_PER_SECOND) * 60
  ) / 8

  assert.ok(estimatedBytesPerMinute < 20 * 1024 * 1024)
  assert.deepEqual(recorderOptions('video/webm'), {
    mimeType: 'video/webm',
    videoBitsPerSecond: 2500000,
    audioBitsPerSecond: 96000,
  })
})
