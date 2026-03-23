import { deleteJson, postJson } from './client'

export function followUser(targetUserId: number) {
  return postJson<void, Record<string, never>>(`/subscriptions/${targetUserId}`, {})
}

export function unfollowUser(targetUserId: number) {
  return deleteJson<void>(`/subscriptions/${targetUserId}`)
}
