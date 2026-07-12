export const parseRoute = (pathname, search = '') => {
  const params = new URLSearchParams(search || '')
  const date = (params.get('date') || '').trim()
  if (pathname === '/' || pathname === '/today') {
    return { view: 'progress', sessionId: null, date }
  }
  if (pathname.startsWith('/requests') || pathname.startsWith('/review/')) {
    return { view: 'progress', sessionId: null, date }
  }
  const proofShareMatch = pathname.match(/^\/r\/([^/]+)$/)
  if (proofShareMatch) return { view: 'sharedProof', sessionId: null, shareToken: decodeURIComponent(proofShareMatch[1]) }
  const skillShareMatch = pathname.match(/^\/s\/([^/]+)$/)
  if (skillShareMatch) return { view: 'sharedSkill', sessionId: null, shareToken: decodeURIComponent(skillShareMatch[1]) }
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
  return { view: 'progress', sessionId: null, date }
}

export const routePath = ({ view, sessionId, seriesName, date, shareToken }) => {
  if (view === 'sharedProof' && shareToken) return `/r/${encodeURIComponent(shareToken)}`
  if (view === 'sharedSkill' && shareToken) return `/s/${encodeURIComponent(shareToken)}`
  if (view === 'privacy') return '/privacy'
  if (view === 'progress' || view === 'archive' || view === 'evidence' || view === 'threads' || view === 'today') {
    return date ? `/today?date=${encodeURIComponent(date)}` : '/today'
  }
  if (view === 'upload') return '/upload'
  if (view === 'record') return '/record'
  if (view === 'skill' && seriesName) return `/skill/${encodeURIComponent(seriesName)}`
  if (view === 'detail' && sessionId) return `/sessions/${sessionId}`
  if (view === 'calendar') return '/today'
  return '/today'
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

  return { view: 'progress', sessionId: null, date: routeDate || '' }
}
