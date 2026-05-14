export const parseRoute = (pathname, search = '') => {
  const params = new URLSearchParams(search || '')
  const date = (params.get('date') || '').trim()
  if (pathname === '/' || pathname === '/today') {
    return { view: 'today', sessionId: null, date }
  }
  if (pathname.startsWith('/requests') || pathname.startsWith('/review/')) return { view: 'today', sessionId: null, date }
  if (pathname === '/privacy') return { view: 'privacy', sessionId: null }
  if (pathname === '/progress' || pathname === '/archive' || pathname === '/evidence' || pathname === '/calendar' || pathname === '/library' || pathname === '/threads') {
    return { view: 'progress', sessionId: null, date }
  }
  if (pathname === '/upload') return { view: 'upload', sessionId: null }
  if (pathname === '/record' || pathname === '/recording') return { view: 'record', sessionId: null }
  const seriesMatch = pathname.match(/^\/(skill|series)\/(.+)$/)
  if (seriesMatch) return { view: 'skill', sessionId: null, seriesName: decodeURIComponent(seriesMatch[2]) }
  const sessionMatch = pathname.match(/^\/sessions\/(\d+)$/)
  if (sessionMatch) return { view: 'detail', sessionId: Number(sessionMatch[1]) }
  return { view: 'today', sessionId: null }
}

export const routePath = ({ view, sessionId, seriesName, date }) => {
  if (view === 'privacy') return '/privacy'
  if (view === 'today') return '/'
  if (view === 'progress' || view === 'archive' || view === 'evidence' || view === 'threads') return '/progress'
  if (view === 'upload') return '/upload'
  if (view === 'record') return '/record'
  if (view === 'skill' && seriesName) return `/skill/${encodeURIComponent(seriesName)}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  if (view === 'calendar') return '/progress'
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
    return { view: 'skill', sessionId: null, seriesName: practiceSeries }
  }

  return { view: 'today', sessionId: null, date: routeDate || '' }
}
