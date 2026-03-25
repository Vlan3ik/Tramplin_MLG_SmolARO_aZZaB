const VIEWED_MAP_ITEMS_KEY = 'tramplin.viewed-map-items'
const VIEWED_MAP_ITEMS_CHANGED_EVENT = 'tramplin:viewed-map-items-changed'

export type ViewedMapEntityType = 'vacancy' | 'opportunity'

function isBrowser() {
  return typeof window !== 'undefined'
}

function buildViewedMapItemKey(entityType: ViewedMapEntityType, id: number) {
  return `${entityType}:${id}`
}

function readViewedMapItems() {
  if (!isBrowser()) {
    return []
  }

  const rawValue = window.localStorage.getItem(VIEWED_MAP_ITEMS_KEY)

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.includes(':'))
  } catch {
    return []
  }
}

function writeViewedMapItems(values: string[]) {
  if (!isBrowser()) {
    return
  }

  const uniqueValues = Array.from(new Set(values))
  window.localStorage.setItem(VIEWED_MAP_ITEMS_KEY, JSON.stringify(uniqueValues))
  window.dispatchEvent(new Event(VIEWED_MAP_ITEMS_CHANGED_EVENT))
}

export function markMapItemViewed(entityType: ViewedMapEntityType, id: number) {
  const current = readViewedMapItems()
  const key = buildViewedMapItemKey(entityType, id)

  if (current.includes(key)) {
    return
  }

  writeViewedMapItems([...current, key])
}

export function isMapItemViewed(entityType: ViewedMapEntityType, id: number) {
  return readViewedMapItems().includes(buildViewedMapItemKey(entityType, id))
}

export function subscribeToViewedMapItems(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === VIEWED_MAP_ITEMS_KEY) {
      listener()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(VIEWED_MAP_ITEMS_CHANGED_EVENT, listener)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(VIEWED_MAP_ITEMS_CHANGED_EVENT, listener)
  }
}
