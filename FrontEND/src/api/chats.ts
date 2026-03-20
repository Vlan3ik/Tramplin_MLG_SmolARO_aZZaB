import { getJson, postJson } from './client'
import type { ChatListItem, ChatMessage } from '../types/chat'

type ChatTypeApi = number

type ChatMessageApi = {
  id: number
  chatId: number
  senderUserId: number
  text: string | null
  isSystem: boolean
  createdAt: string
}

type ChatListItemApi = {
  id: number
  type: ChatTypeApi
  title: string | null
  participantIds: number[] | null
  createdAt: string
  lastMessage: ChatMessageApi | null
}

type ChatHistoryPageApi = {
  chatId: number
  messages: ChatMessageApi[] | null
  hasMore: boolean
  nextBeforeMessageId: number | null
}

type MarkChatReadRequest = {
  messageId: number
}

type SendChatMessageRequest = {
  text: string
}

function mapMessage(item: ChatMessageApi): ChatMessage {
  return {
    id: item.id,
    chatId: item.chatId,
    senderUserId: item.senderUserId,
    text: item.text ?? '',
    isSystem: item.isSystem,
    createdAt: item.createdAt,
  }
}

function mapChat(item: ChatListItemApi): ChatListItem {
  return {
    id: item.id,
    type: item.type === 2 ? 2 : 1,
    title: item.title ?? null,
    participantIds: item.participantIds ?? [],
    createdAt: item.createdAt,
    lastMessage: item.lastMessage ? mapMessage(item.lastMessage) : null,
  }
}

export async function fetchMyChats(signal?: AbortSignal) {
  const response = await getJson<ChatListItemApi[]>('/chats', { signal })
  return response.map(mapChat)
}

export async function fetchChatMessages(chatId: number, cursor?: number, signal?: AbortSignal) {
  const query = typeof cursor === 'number' ? `?cursor=${cursor}` : ''
  const response = await getJson<ChatMessageApi[]>(`/chats/${chatId}/messages${query}`, { signal })
  return response.map(mapMessage)
}

export async function fetchChatHistory(chatId: number, beforeMessageId?: number, limit = 50, signal?: AbortSignal) {
  const params = new URLSearchParams()

  if (typeof beforeMessageId === 'number') {
    params.set('beforeMessageId', String(beforeMessageId))
  }

  params.set('limit', String(limit))

  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await getJson<ChatHistoryPageApi>(`/chats/${chatId}/history${query}`, { signal })

  return {
    chatId: response.chatId,
    messages: (response.messages ?? []).map(mapMessage),
    hasMore: response.hasMore,
    nextBeforeMessageId: response.nextBeforeMessageId,
  }
}

export async function sendChatMessage(chatId: number, text: string) {
  const payload: SendChatMessageRequest = {
    text,
  }

  const response = await postJson<ChatMessageApi, SendChatMessageRequest>(`/chats/${chatId}/messages`, payload)
  return mapMessage(response)
}

export function markChatRead(chatId: number, messageId: number) {
  const payload: MarkChatReadRequest = {
    messageId,
  }

  return postJson<unknown, MarkChatReadRequest>(`/chats/${chatId}/read`, payload)
}
