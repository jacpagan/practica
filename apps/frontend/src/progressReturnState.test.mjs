import assert from 'node:assert/strict'
import test from 'node:test'

import {
  consumeProgressScrollRestore,
  readArchiveCleanupOpen,
  saveArchiveCleanupOpen,
  saveProgressScrollRestore,
} from './progressReturnState.js'

const createStorage = () => {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test('archive cleanup open state is persisted as a boolean', () => {
  global.window = { sessionStorage: createStorage() }

  assert.equal(readArchiveCleanupOpen(), false)
  saveArchiveCleanupOpen(true)
  assert.equal(readArchiveCleanupOpen(), true)
  saveArchiveCleanupOpen(false)
  assert.equal(readArchiveCleanupOpen(), false)

  delete global.window
})

test('progress scroll restore is consumed once for progress routes', () => {
  global.window = { sessionStorage: createStorage() }

  saveProgressScrollRestore({ view: 'skill', scrollY: 500, archiveOpen: true })
  assert.equal(consumeProgressScrollRestore(), null)

  saveProgressScrollRestore({ view: 'progress', scrollY: 500, archiveOpen: true })
  assert.deepEqual(consumeProgressScrollRestore(), { scrollY: 500, archiveOpen: true })
  assert.equal(consumeProgressScrollRestore(), null)

  delete global.window
})
