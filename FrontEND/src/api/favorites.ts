import { deleteJson, getJson, postJson } from './client'

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

export function addVacancyToFavorites(id: number) {
  return postJson<void, Record<string, never>>(`/favorites/vacancies/${id}`, {})
}

export function removeVacancyFromFavorites(id: number) {
  return deleteJson<void>(`/favorites/vacancies/${id}`)
}

export function addOpportunityToFavorites(id: number) {
  return postJson<void, Record<string, never>>(`/favorites/opportunities/${id}`, {})
}

export function removeOpportunityFromFavorites(id: number) {
  return deleteJson<void>(`/favorites/opportunities/${id}`)
}
