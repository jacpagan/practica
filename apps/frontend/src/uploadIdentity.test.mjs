import assert from 'node:assert/strict'
import test from 'node:test'

import { multipartFingerprint } from './uploadIdentity.js'

test('multipart resume identity remains stable when proof metadata changes', () => {
  const videoFile = {
    name: 'take.webm',
    size: 6291456,
    lastModified: 1781210000000,
  }

  assert.equal(
    multipartFingerprint({ videoFile, payload: { title: 'First title', practice_series: 'Drums' } }),
    multipartFingerprint({ videoFile, payload: { title: 'Updated title', practice_series: 'Groove' } }),
  )
})
