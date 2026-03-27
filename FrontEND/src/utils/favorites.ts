const FAVORITES_STORAGE_KEY = 'tramplin.favorite-opportunities'
const FAVORITES_CHANGED_EVENT = 'tramplin:favorites-changed'

export type GuestFavoriteEntityType = 'vacancy' | 'opportunity'

export type GuestFavoriteSnapshot = {
  vacancyIds: number[]
  opportunityIds: number[]
}

const EMPTY_SNAPSHOT: GuestFavoriteSnapshot = {
  vacancyIds: [],
  opportunityIds: [],
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function sanitizeIds(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function normalizeSnapshot(value: unknown): GuestFavoriteSnapshot {
  if (Array.isArray(value)) {
    return {
      vacancyIds: [],
      opportunityIds: sanitizeIds(value),
    }
  }

  if (!value || typeof value !== 'object') {
    return EMPTY_SNAPSHOT
  }

  const rawValue = value as {
    vacancyIds?: unknown
    opportunityIds?: unknown
  }

  return {
    vacancyIds: sanitizeIds(rawValue.vacancyIds),
    opportunityIds: sanitizeIds(rawValue.opportunityIds),
  }
}

function readSnapshot(): GuestFavoriteSnapshot {
  if (!isBrowser()) {
    return EMPTY_SNAPSHOT
  }

  const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
  if (!rawValue) {
    return EMPTY_SNAPSHOT
  }

  try {
    return normalizeSnapshot(JSON.parse(rawValue) as unknown)
  } catch {
    return EMPTY_SNAPSHOT
  }
}

function writeSnapshot(snapshot: GuestFavoriteSnapshot) {
  if (!isBrowser()) {
    return
  }

  const normalizedSnapshot: GuestFavoriteSnapshot = {
    vacancyIds: Array.from(new Set(snapshot.vacancyIds)),
    opportunityIds: Array.from(new Set(snapshot.opportunityIds)),
  }

  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedSnapshot))
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
}

export function getFavoriteEntityType(item: { entityType?: 'vacancy' | 'opportunity'; type?: string }): GuestFavoriteEntityType {
  if (item.entityType === 'vacancy' || item.entityType === 'opportunity') {
    return item.entityType
  }

  return item.type === 'vacancy' || item.type === 'internship' ? 'vacancy' : 'opportunity'
}

export function getGuestFavoriteSnapshot() {
  return readSnapshot()
}

export function hasGuestFavorites() {
  const snapshot = readSnapshot()
  return snapshot.vacancyIds.length > 0 || snapshot.opportunityIds.length > 0
}

export function clearGuestFavoriteSnapshot() {
  writeSnapshot(EMPTY_SNAPSHOT)
}

export function isFavoriteEntity(entityType: GuestFavoriteEntityType, id: number) {
  const snapshot = readSnapshot()
  return (entityType === 'vacancy' ? snapshot.vacancyIds : snapshot.opportunityIds).includes(id)
}

export function toggleFavoriteEntity(entityType: GuestFavoriteEntityType, id: number) {
  const snapshot = readSnapshot()
  const currentIds = entityType === 'vacancy' ? snapshot.vacancyIds : snapshot.opportunityIds

  if (currentIds.includes(id)) {
    writeSnapshot({
      ...snapshot,
      [entityType === 'vacancy' ? 'vacancyIds' : 'opportunityIds']: currentIds.filter((value) => value !== id),
    })
    return false
  }

  writeSnapshot({
    ...snapshot,
    [entityType === 'vacancy' ? 'vacancyIds' : 'opportunityIds']: [...currentIds, id],
  })
  return true
}

export function isFavoriteOpportunity(id: number) {
  return isFavoriteEntity('opportunity', id)
}

export function toggleFavoriteOpportunity(id: number) {
  return toggleFavoriteEntity('opportunity', id)
}

export function getFavoriteOpportunityIds() {
  return readSnapshot().opportunityIds
}

export function subscribeToFavoriteOpportunities(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_STORAGE_KEY) {
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
