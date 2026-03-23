import { deleteJson, getJson, postJson } from './client'

export type SubscriptionUser = {
  userId: number
  username: string
  displayName: string
  avatarUrl: string | null
  subscribedAt: string
}

type SubscriptionUserApi = {
  userId: number
  username?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  subscribedAt?: string | null
}

function mapSubscriptionUser(item: SubscriptionUserApi): SubscriptionUser {
  return {
    userId: item.userId,
    username: item.username ?? '',
    displayName: item.displayName ?? item.username ?? `Пользователь #${item.userId}`,
    avatarUrl: item.avatarUrl ?? null,
    subscribedAt: item.subscribedAt ?? '',
  }
}

export function followUser(targetUserId: number) {
  return postJson<void, Record<string, never>>(`/subscriptions/${targetUserId}`, {})
}

export function unfollowUser(targetUserId: number) {
  return deleteJson<void>(`/subscriptions/${targetUserId}`)
}

export async function fetchMyFollowingSubscriptions(signal?: AbortSignal) {
  const response = await getJson<SubscriptionUserApi[]>('/subscriptions/me/following', { signal })
  return response.map(mapSubscriptionUser)
}

export async function fetchMyFollowerSubscriptions(signal?: AbortSignal) {
  const response = await getJson<SubscriptionUserApi[]>('/subscriptions/me/followers', { signal })
  return response.map(mapSubscriptionUser)
}
