export const parseRoute = (pathname, search = '') => {
  const params = new URLSearchParams(search || '')
  const date = (params.get('date') || '').trim()
  const claim = (params.get('claim') || '').trim().toUpperCase()
  if (pathname === '/') {
    return { view: 'calendar', sessionId: null, date }
  }
  if (pathname === '/privacy') return { view: 'privacy', sessionId: null }
  if (pathname === '/archive') return { view: 'calendar', sessionId: null }
  if (pathname === '/calendar') return { view: 'calendar', sessionId: null, date }
  if (pathname === '/library') return { view: 'calendar', sessionId: null, date }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/record' || pathname === '/recording') return { view: 'record', sessionId: null }
  if (pathname === '/requests') return { view: 'requests', sessionId: null }
  const reviewMatch = pathname.match(/^\/r\/(.+)$/)
  if (reviewMatch) return { view: 'review', token: reviewMatch[1], claim, sessionId: null }
  const seriesMatch = pathname.match(/^\/series\/(.+)$/)
  if (seriesMatch) return { view: 'series', sessionId: null, seriesName: decodeURIComponent(seriesMatch[1]) }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'calendar', sessionId: null }
}

export const routePath = ({ view, sessionId, token, claim, seriesName, date }) => {
  if (view === 'privacy') return '/privacy'
  if (view === 'archive') return '/'
  if (view === 'upload') return '/upload'
  if (view === 'record') return '/record'
  if (view === 'requests') return '/requests'
  if (view === 'series' && seriesName) return `/series/${encodeURIComponent(seriesName)}`
  if (view === 'review' && token) return claim ? `/r/${token}?claim=${encodeURIComponent(claim)}` : `/r/${token}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  if (view === 'calendar') return date ? `/?date=${encodeURIComponent(date)}` : '/'
  return '/'
}

export const resolveUploadReturnRouteDraft = (draft = null, routeDate = '') => {
  const explicit = draft?.returnRoute
  if (explicit?.view) {
    return {
      view: explicit.view,
      sessionId: explicit.sessionId ?? null,
      token: explicit.token || '',
      claim: explicit.claim || '',
      seriesName: explicit.seriesName || '',
      date: explicit.date || '',
    }
  }

  const practiceSeries = String(draft?.practiceSeries || '').trim()
  if (practiceSeries) {
    return { view: 'series', sessionId: null, seriesName: practiceSeries }
  }

  return { view: 'calendar', sessionId: null, date: routeDate || '' }
}
