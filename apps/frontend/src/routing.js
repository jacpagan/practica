export const parseRoute = (pathname, search = '') => {
  const params = new URLSearchParams(search || '')
  const date = (params.get('date') || '').trim()
  if (pathname === '/') {
    return { view: 'evidence', sessionId: null, date }
  }
  if (pathname.startsWith('/requests') || pathname.startsWith('/review/')) return { view: 'evidence', sessionId: null, date }
  if (pathname === '/privacy') return { view: 'privacy', sessionId: null }
  if (pathname === '/archive') return { view: 'evidence', sessionId: null }
  if (pathname === '/evidence') return { view: 'evidence', sessionId: null, date }
  if (pathname === '/calendar') return { view: 'evidence', sessionId: null, date }
  if (pathname === '/library') return { view: 'evidence', sessionId: null, date }
  if (pathname === '/threads') return { view: 'evidence', sessionId: null, date }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/record' || pathname === '/recording') return { view: 'record', sessionId: null }
  const seriesMatch = pathname.match(/^\/series\/(.+)$/)
  if (seriesMatch) return { view: 'series', sessionId: null, seriesName: decodeURIComponent(seriesMatch[1]) }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'evidence', sessionId: null }
}

export const routePath = ({ view, sessionId, seriesName, date }) => {
  if (view === 'privacy') return '/privacy'
  if (view === 'archive' || view === 'evidence' || view === 'threads') return date ? `/?date=${encodeURIComponent(date)}` : '/'
  if (view === 'upload') return '/upload'
  if (view === 'record') return '/record'
  if (view === 'series' && seriesName) return `/series/${encodeURIComponent(seriesName)}`
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
      seriesName: explicit.seriesName || '',
      date: explicit.date || '',
    }
  }

  const practiceSeries = String(draft?.practiceSeries || '').trim()
  if (practiceSeries) {
    return { view: 'series', sessionId: null, seriesName: practiceSeries }
  }

  return { view: 'evidence', sessionId: null, date: routeDate || '' }
}
