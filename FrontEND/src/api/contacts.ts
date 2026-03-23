import { deleteJson, getJson, postJson } from './client'
import type { ContactRequest, ContactUser } from '../types/contact'

type ContactUserApi = {
  userId: number
  username?: string | null
  avatarUrl?: string | null
}

type ContactRequestApi = {
  id: number
  sender: ContactUserApi
  receiver: ContactUserApi
  status: number
  createdAt: string
}

function mapContactUser(item: ContactUserApi): ContactUser {
  return {
    userId: item.userId,
    username: item.username ?? null,
    avatarUrl: item.avatarUrl ?? null,
  }
}

function mapContactRequest(item: ContactRequestApi): ContactRequest {
  return {
    id: item.id,
    sender: mapContactUser(item.sender),
    receiver: mapContactUser(item.receiver),
    status: item.status,
    createdAt: item.createdAt,
  }
}

export async function fetchMyContacts(signal?: AbortSignal) {
  const response = await getJson<ContactUserApi[]>('/contacts', { signal })
  return response.map(mapContactUser)
}

export async function fetchIncomingContactRequests(signal?: AbortSignal) {
  const response = await getJson<ContactRequestApi[]>('/contacts/requests/incoming', { signal })
  return response.map(mapContactRequest)
}

export async function fetchOutgoingContactRequests(signal?: AbortSignal) {
  const response = await getJson<ContactRequestApi[]>('/contacts/requests/outgoing', { signal })
  return response.map(mapContactRequest)
}

export function createContactRequest(targetUserId: number) {
  return postJson<void, Record<string, never>>(`/contacts/requests/${targetUserId}`, {})
}

export function deleteContact(contactUserId: number) {
  return deleteJson<void>(`/contacts/${contactUserId}`)
}
