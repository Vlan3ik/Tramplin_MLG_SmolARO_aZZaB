import { getJson, postJson } from './client'

export const APPLICATIONS_CHANGE_EVENT = 'tramplin:applications-change'

export type CreateApplicationRequest = {
  companyId: number
  candidateUserId: number
  vacancyId: number
  initiatorRole: 1 | 2 | 3
}

export type MyApplicationApi = {
  id: number
  vacancyId: number
  vacancyTitle: string
  companyName: string
  locationName: string
  status: number
  createdAt: string
  updatedAt: string
}

export function fetchMyApplications(signal?: AbortSignal) {
  return getJson<MyApplicationApi[]>('/applications/me', { signal })
}

export function createApplication(payload: CreateApplicationRequest) {
  return postJson<unknown, CreateApplicationRequest>('/applications', payload).then((response) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tramplin:chat-refresh'))
      window.dispatchEvent(new Event(APPLICATIONS_CHANGE_EVENT))
    }

    return response
  })
}
