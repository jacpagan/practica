export const fetchPaginatedWithToken = async (path, token) => {
  if (!token) return []
  let nextUrl = path
  let items = []

  while (nextUrl) {
    let res
    let attempt = 0
    while (true) {
      try {
        res = await fetch(nextUrl, { headers: { Authorization: `Token ${token}` } })
        if (res.ok || res.status < 500 || attempt >= 2) break
      } catch (error) {
        if (attempt >= 2) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)))
      attempt += 1
    }
    if (!res.ok) throw new Error('paginated-fetch')
    const data = await res.json()
    if (Array.isArray(data)) {
      items = items.concat(data)
      break
    }
    items = items.concat(Array.isArray(data?.results) ? data.results : [])
    const rawNext = String(data?.next || '').trim()
    if (!rawNext) break
    try {
      const parsed = new URL(rawNext, window.location.origin)
      nextUrl = `${parsed.pathname}${parsed.search}`
    } catch {
      nextUrl = rawNext
    }
  }

  return items
}
