import { postJson } from './client'

export type CreateApplicationRequest = {
  companyId: number
  candidateUserId: number
  vacancyId: number
  initiatorRole: 1 | 2 | 3
}

export function createApplication(payload: CreateApplicationRequest) {
  return postJson<unknown, CreateApplicationRequest>('/applications', payload).then((response) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tramplin:chat-refresh'))
    }

    return response
  })
}
