const ARCHIVE_CLEANUP_STATE_KEY = 'practica.archive.cleanup.v1'
const PROGRESS_SCROLL_RESTORE_KEY = 'practica.progress.scrollRestore.v1'

const getSessionStorage = () => {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export const readArchiveCleanupOpen = () => {
  try {
    const store = getSessionStorage()
    if (!store) return false
    const parsed = JSON.parse(store.getItem(ARCHIVE_CLEANUP_STATE_KEY) || '{}')
    return Boolean(parsed.open)
  } catch {
    return false
  }
}

export const saveArchiveCleanupOpen = (open) => {
  try {
    const store = getSessionStorage()
    if (!store) return
    store.setItem(ARCHIVE_CLEANUP_STATE_KEY, JSON.stringify({ open: Boolean(open) }))
  } catch {}
}

export const saveProgressScrollRestore = (route = null) => {
  if (route?.view !== 'progress') return
  const scrollY = Number(route.scrollY)
  if (!Number.isFinite(scrollY)) return
  try {
    const store = getSessionStorage()
    if (!store) return
    store.setItem(PROGRESS_SCROLL_RESTORE_KEY, JSON.stringify({
      scrollY,
      archiveOpen: Boolean(route.archiveOpen),
      createdAt: Date.now(),
    }))
  } catch {}
}

export const consumeProgressScrollRestore = () => {
  try {
    const store = getSessionStorage()
    if (!store) return null
    const parsed = JSON.parse(store.getItem(PROGRESS_SCROLL_RESTORE_KEY) || '{}')
    store.removeItem(PROGRESS_SCROLL_RESTORE_KEY)
    const scrollY = Number(parsed.scrollY)
    if (!Number.isFinite(scrollY)) return null
    const createdAt = Number(parsed.createdAt)
    if (Number.isFinite(createdAt) && Date.now() - createdAt > 30000) return null
    return {
      scrollY,
      archiveOpen: Boolean(parsed.archiveOpen),
    }
  } catch {
    return null
  }
}
