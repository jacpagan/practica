import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRoute, routePath } from './routing.js'

test('routePath uses today as the canonical progress surface', () => {
  assert.equal(routePath({ view: 'progress', sessionId: null }), '/today')
  assert.equal(routePath({ view: 'today', sessionId: null, date: '2099-01-03' }), '/today?date=2099-01-03')
  assert.equal(routePath({ view: 'calendar', sessionId: null }), '/today')
  assert.equal(routePath({ view: 'unknown', sessionId: null }), '/today')
})

test('parseRoute separates progress aliases from the Today view', () => {
  assert.equal(parseRoute('/progress').view, 'archive')
  assert.equal(parseRoute('/archive').view, 'archive')
  assert.equal(parseRoute('/today').view, 'progress')
  assert.equal(routePath({ view: 'archive', sessionId: null }), '/progress')
})

test('parseRoute keeps internal metrics route', () => {
  const route = parseRoute('/internal/metrics')

  assert.equal(route.view, 'internalMetrics')
  assert.equal(routePath(route), '/internal/metrics')
})

test('parseRoute keeps the private journal route', () => {
  const route = parseRoute('/journal')

  assert.equal(route.view, 'journal')
  assert.equal(routePath(route), '/journal')
})

test('parseRoute keeps challenge recorder skill context', () => {
  const route = parseRoute('/record', '?skill=Shoulder%20press&challenge=review-token-123')

  assert.equal(route.view, 'record')
  assert.equal(route.seriesName, 'Shoulder press')
  assert.equal(route.challengeToken, 'review-token-123')
  assert.equal(routePath(route), '/record?skill=Shoulder+press&challenge=review-token-123')
})
