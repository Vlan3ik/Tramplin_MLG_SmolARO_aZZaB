const FAVORITE_OPPORTUNITIES_KEY = 'tramplin.favorite-opportunities'
const FAVORITES_CHANGED_EVENT = 'tramplin:favorites-changed'

function isBrowser() {
  return typeof window !== 'undefined'
}

function readFavorites() {
  if (!isBrowser()) {
    return []
  }

  const rawValue = window.localStorage.getItem(FAVORITE_OPPORTUNITIES_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((value) => (typeof value === 'number' ? value : Number(value)))
      .filter((value) => Number.isFinite(value) && value > 0)
  } catch {
    return []
  }
}

function writeFavorites(ids: number[]) {
  if (!isBrowser()) {
    return
  }

  const uniqueIds = Array.from(new Set(ids))
  window.localStorage.setItem(FAVORITE_OPPORTUNITIES_KEY, JSON.stringify(uniqueIds))
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
}

export function getFavoriteOpportunityIds() {
  return readFavorites()
}

export function isFavoriteOpportunity(id: number) {
  return readFavorites().includes(id)
}

export function toggleFavoriteOpportunity(id: number) {
  const current = readFavorites()

  if (current.includes(id)) {
    const next = current.filter((value) => value !== id)
    writeFavorites(next)
    return false
  }

  writeFavorites([...current, id])
  return true
}

export function subscribeToFavoriteOpportunities(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITE_OPPORTUNITIES_KEY) {
      listener()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(FAVORITES_CHANGED_EVENT, listener)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(FAVORITES_CHANGED_EVENT, listener)
  }
}
