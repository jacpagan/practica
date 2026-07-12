import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRoute, routePath } from './routing.js'

test('routePath uses today as the canonical progress surface', () => {
  assert.equal(routePath({ view: 'progress', sessionId: null }), '/today')
  assert.equal(routePath({ view: 'today', sessionId: null, date: '2099-01-03' }), '/today?date=2099-01-03')
  assert.equal(routePath({ view: 'calendar', sessionId: null }), '/today')
  assert.equal(routePath({ view: 'unknown', sessionId: null }), '/today')
})

test('parseRoute keeps progress aliases on the Today view', () => {
  assert.equal(parseRoute('/progress').view, 'progress')
  assert.equal(parseRoute('/archive').view, 'progress')
  assert.equal(parseRoute('/today').view, 'progress')
})

test('parseRoute keeps challenge recorder skill context', () => {
  const route = parseRoute('/record', '?skill=Shoulder%20press')

  assert.equal(route.view, 'record')
  assert.equal(route.seriesName, 'Shoulder press')
})
