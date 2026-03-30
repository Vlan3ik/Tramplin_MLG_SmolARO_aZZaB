import { setFavoriteEntity } from '../utils/favorites'
import { deleteJson, getJson, hasStoredAuthSession, postJson } from './client'

type MyFavoritesApi = {
  vacancyIds?: number[] | null
  opportunityIds?: number[] | null
}

export type MyFavorites = {
  vacancyIds: number[]
  opportunityIds: number[]
}

type SyncFavoritesPayload = {
  vacancyIds: number[]
  opportunityIds: number[]
}

type FavoriteEntitySocialSnapshotApi = {
  entityType?: string | null
  id?: number | null
  isFavoriteByMe?: boolean | null
  friendFavoritesCount?: number | null
  friendApplicationsCount?: number | null
}

export type FavoriteEntitySocialSnapshot = {
  entityType: 'vacancy' | 'opportunity'
  id: number
  isFavoriteByMe: boolean
  friendFavoritesCount: number
  friendApplicationsCount: number
}

function normalizeEntityType(value: string | null | undefined, fallback: 'vacancy' | 'opportunity'): 'vacancy' | 'opportunity' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.includes('vacancy')) return 'vacancy'
  if (normalized.includes('opportunity')) return 'opportunity'
  return fallback
}

function mapSnapshot(
  response: FavoriteEntitySocialSnapshotApi | null | undefined,
  fallbackEntityType: 'vacancy' | 'opportunity',
  fallbackId: number,
  fallbackIsFavorite: boolean,
): FavoriteEntitySocialSnapshot {
  return {
    entityType: normalizeEntityType(response?.entityType, fallbackEntityType),
    id: typeof response?.id === 'number' && Number.isFinite(response.id) ? response.id : fallbackId,
    isFavoriteByMe: typeof response?.isFavoriteByMe === 'boolean' ? response.isFavoriteByMe : fallbackIsFavorite,
    friendFavoritesCount: typeof response?.friendFavoritesCount === 'number' ? response.friendFavoritesCount : 0,
    friendApplicationsCount: typeof response?.friendApplicationsCount === 'number' ? response.friendApplicationsCount : 0,
  }
}

function isUnauthorizedError(error: unknown) {
  return error instanceof Error && /\b401\b/.test(error.message)
}

function shouldUseGuestStorage() {
  return !hasStoredAuthSession()
}

export async function fetchMyFavorites(signal?: AbortSignal): Promise<MyFavorites> {
  const response = await getJson<MyFavoritesApi>('/favorites/me', { signal })
  return {
    vacancyIds: response.vacancyIds ?? [],
    opportunityIds: response.opportunityIds ?? [],
  }
}

export async function syncFavorites(payload: SyncFavoritesPayload): Promise<MyFavorites> {
  const response = await postJson<MyFavoritesApi, SyncFavoritesPayload>('/favorites/sync', payload)
  return {
    vacancyIds: response.vacancyIds ?? [],
    opportunityIds: response.opportunityIds ?? [],
  }
}

export function addVacancyToFavorites(id: number): Promise<FavoriteEntitySocialSnapshot> {
  if (shouldUseGuestStorage()) {
    setFavoriteEntity('vacancy', id, true)
    return Promise.resolve({
      entityType: 'vacancy',
      id,
      isFavoriteByMe: true,
      friendFavoritesCount: 0,
      friendApplicationsCount: 0,
    })
  }

  return postJson<FavoriteEntitySocialSnapshotApi, Record<string, never>>(`/favorites/vacancies/${id}`, {})
    .then((response) => mapSnapshot(response, 'vacancy', id, true))
    .catch((error) => {
    if (isUnauthorizedError(error)) {
      setFavoriteEntity('vacancy', id, true)
      return {
        entityType: 'vacancy' as const,
        id,
        isFavoriteByMe: true,
        friendFavoritesCount: 0,
        friendApplicationsCount: 0,
      }
    }

    throw error
  })
}

export function removeVacancyFromFavorites(id: number): Promise<FavoriteEntitySocialSnapshot> {
  if (shouldUseGuestStorage()) {
    setFavoriteEntity('vacancy', id, false)
    return Promise.resolve({
      entityType: 'vacancy',
      id,
      isFavoriteByMe: false,
      friendFavoritesCount: 0,
      friendApplicationsCount: 0,
    })
  }

  return deleteJson<FavoriteEntitySocialSnapshotApi>(`/favorites/vacancies/${id}`)
    .then((response) => mapSnapshot(response, 'vacancy', id, false))
    .catch((error) => {
    if (isUnauthorizedError(error)) {
      setFavoriteEntity('vacancy', id, false)
      return {
        entityType: 'vacancy' as const,
        id,
        isFavoriteByMe: false,
        friendFavoritesCount: 0,
        friendApplicationsCount: 0,
      }
    }

    throw error
  })
}

export function addOpportunityToFavorites(id: number): Promise<FavoriteEntitySocialSnapshot> {
  if (shouldUseGuestStorage()) {
    setFavoriteEntity('opportunity', id, true)
    return Promise.resolve({
      entityType: 'opportunity',
      id,
      isFavoriteByMe: true,
      friendFavoritesCount: 0,
      friendApplicationsCount: 0,
    })
  }

  return postJson<FavoriteEntitySocialSnapshotApi, Record<string, never>>(`/favorites/opportunities/${id}`, {})
    .then((response) => mapSnapshot(response, 'opportunity', id, true))
    .catch((error) => {
    if (isUnauthorizedError(error)) {
      setFavoriteEntity('opportunity', id, true)
      return {
        entityType: 'opportunity' as const,
        id,
        isFavoriteByMe: true,
        friendFavoritesCount: 0,
        friendApplicationsCount: 0,
      }
    }

    throw error
  })
}

export function removeOpportunityFromFavorites(id: number): Promise<FavoriteEntitySocialSnapshot> {
  if (shouldUseGuestStorage()) {
    setFavoriteEntity('opportunity', id, false)
    return Promise.resolve({
      entityType: 'opportunity',
      id,
      isFavoriteByMe: false,
      friendFavoritesCount: 0,
      friendApplicationsCount: 0,
    })
  }

  return deleteJson<FavoriteEntitySocialSnapshotApi>(`/favorites/opportunities/${id}`)
    .then((response) => mapSnapshot(response, 'opportunity', id, false))
    .catch((error) => {
    if (isUnauthorizedError(error)) {
      setFavoriteEntity('opportunity', id, false)
      return {
        entityType: 'opportunity' as const,
        id,
        isFavoriteByMe: false,
        friendFavoritesCount: 0,
        friendApplicationsCount: 0,
      }
    }

    throw error
  })
}
