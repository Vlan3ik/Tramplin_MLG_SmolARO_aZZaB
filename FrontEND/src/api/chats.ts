import { getJson, postForm, postJson } from './client'
import type { ChatListItem, ChatMessage, ChatMessageAttachment, OpportunityCard, VacancyCard } from '../types/chat'

type ChatTypeApi = number

type ChatMessageApi = {
  id: number
  chatId: number
  senderUserId: number
  senderFio?: string | null
  senderDisplayName?: string | null
  senderUsername?: string | null
  senderAvatarUrl?: string | null
  text: string | null
  isSystem: boolean
  createdAt: string
  attachments?: ChatMessageAttachmentApi[] | null
}

type VacancyCardApi = {
  vacancyId: number
  title: string
  kind: number
  format: number
  status: number
  salaryTaxMode: number
  salaryFrom?: number | null
  salaryTo?: number | null
  currencyCode?: string | null
  isFavoriteByMe?: boolean | null
  friendFavoritesCount?: number | null
  friendApplicationsCount?: number | null
}

type ChatMessageAttachmentApi = {
  id: number
  type: number
  url?: string | null
  mimeType?: string | null
  fileName?: string | null
  sizeBytes?: number | null
  vacancy?: VacancyCardApi | null
  opportunity?: OpportunityCardApi | null
}

type OpportunityCardApi = {
  opportunityId: number
  title: string
  kind: number
  format: number
  status: number
  eventDate?: string | null
  priceType: number
  priceAmount?: number | null
  priceCurrencyCode?: string | null
  isFavoriteByMe?: boolean | null
  friendFavoritesCount?: number | null
  friendApplicationsCount?: number | null
}

type ChatListItemApi = {
  id: number
  type: ChatTypeApi
  title: string | null
  participantIds: number[] | null
  participantsCount?: number
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

type ShareVacancyToUserRequest = {
  targetUserId: number
  vacancyId: number
  text?: string | null
}

type ShareOpportunityToUserRequest = {
  targetUserId: number
  opportunityId: number
  text?: string | null
}

type ShareVacancyToUserResponse = {
  chatId: number
  message: ChatMessageApi
}

type ChatLinkedCardApi = {
  type?: string
  opportunity?: {
    opportunityId: number
    title: string
  } | null
  applicationEmployer?: {
    vacancy?: VacancyCardApi | null
  } | null
  applicationSeeker?: {
    vacancy?: VacancyCardApi | null
  } | null
}

type CreateDirectChatRequest = {
  userId: number
}

type CreateDirectChatResponse = {
  chatId: number
}

function mapMessage(item: ChatMessageApi): ChatMessage {
  return {
    id: item.id,
    chatId: item.chatId,
    senderUserId: item.senderUserId,
    senderDisplayName: item.senderFio ?? item.senderDisplayName ?? null,
    senderUsername: item.senderUsername ?? null,
    senderAvatarUrl: item.senderAvatarUrl ?? null,
    text: item.text ?? '',
    isSystem: item.isSystem,
    createdAt: item.createdAt,
    attachments: (item.attachments ?? []).map(mapAttachment),
  }
}

function mapVacancyCard(item: VacancyCardApi): VacancyCard {
  return {
    vacancyId: item.vacancyId,
    title: item.title,
    kind: item.kind,
    format: item.format,
    status: item.status,
    salaryTaxMode: item.salaryTaxMode,
    salaryFrom: item.salaryFrom ?? null,
    salaryTo: item.salaryTo ?? null,
    currencyCode: item.currencyCode ?? null,
    isFavoriteByMe: Boolean(item.isFavoriteByMe),
    friendFavoritesCount: item.friendFavoritesCount ?? 0,
    friendApplicationsCount: item.friendApplicationsCount ?? 0,
  }
}

function mapOpportunityCard(item: OpportunityCardApi): OpportunityCard {
  return {
    opportunityId: item.opportunityId,
    title: item.title,
    kind: item.kind,
    format: item.format,
    status: item.status,
    eventDate: item.eventDate ?? null,
    priceType: item.priceType,
    priceAmount: item.priceAmount ?? null,
    priceCurrencyCode: item.priceCurrencyCode ?? null,
    isFavoriteByMe: Boolean(item.isFavoriteByMe),
    friendFavoritesCount: item.friendFavoritesCount ?? 0,
    friendApplicationsCount: item.friendApplicationsCount ?? 0,
  }
}

function mapAttachment(item: ChatMessageAttachmentApi): ChatMessageAttachment {
  return {
    id: item.id,
    type: item.type === 2 ? 2 : item.type === 3 ? 3 : item.type === 4 ? 4 : item.type === 5 ? 5 : 1,
    url: item.url ?? null,
    mimeType: item.mimeType ?? null,
    fileName: item.fileName ?? null,
    sizeBytes: item.sizeBytes ?? null,
    vacancy: item.vacancy ? mapVacancyCard(item.vacancy) : null,
    opportunity: item.opportunity ? mapOpportunityCard(item.opportunity) : null,
  }
}

function mapChat(item: ChatListItemApi): ChatListItem {
  return {
    id: item.id,
    type: item.type === 2 ? 2 : item.type === 3 ? 3 : 1,
    title: item.title ?? null,
    participantIds: item.participantIds ?? [],
    participantsCount: item.participantsCount ?? item.participantIds?.length ?? 0,
    createdAt: item.createdAt,
    lastMessage: item.lastMessage ? mapMessage(item.lastMessage) : null,
  }
}

export async function fetchMyChats(signal?: AbortSignal) {
  const response = await getJson<ChatListItemApi[]>('/chats', { signal })
  return response.map(mapChat)
}

export async function fetchEmployerChats(signal?: AbortSignal) {
  const response = await getJson<ChatListItemApi[]>('/employer/chats', { signal })
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

type ChatDetailApi = {
  id: number
  type: ChatTypeApi
  title: string | null
  participantsCount: number
  createdAt: string
  linkedCard?: ChatLinkedCardApi | null
  history: ChatHistoryPageApi
}

export async function fetchChatDetail(chatId: number, beforeMessageId?: number, limit = 50, signal?: AbortSignal) {
  const params = new URLSearchParams()

  if (typeof beforeMessageId === 'number') {
    params.set('beforeMessageId', String(beforeMessageId))
  }

  params.set('limit', String(limit))

  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await getJson<ChatDetailApi>(`/chats/${chatId}/detail${query}`, { signal })

  return {
    id: response.id,
    type: response.type === 2 ? 2 : response.type === 3 ? 3 : 1,
    title: response.title ?? null,
    participantsCount: response.participantsCount,
    createdAt: response.createdAt,
    linkedCard: response.linkedCard ?? null,
    history: {
      chatId: response.history.chatId,
      messages: (response.history.messages ?? []).map(mapMessage),
      hasMore: response.history.hasMore,
      nextBeforeMessageId: response.history.nextBeforeMessageId,
    },
  }
}

export async function fetchEmployerChatDetail(chatId: number, beforeMessageId?: number, limit = 50, signal?: AbortSignal) {
  const params = new URLSearchParams()

  if (typeof beforeMessageId === 'number') {
    params.set('beforeMessageId', String(beforeMessageId))
  }

  params.set('limit', String(limit))

  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await getJson<ChatDetailApi>(`/employer/chats/${chatId}/detail${query}`, { signal })

  return {
    id: response.id,
    type: response.type === 2 ? 2 : response.type === 3 ? 3 : 1,
    title: response.title ?? null,
    participantsCount: response.participantsCount,
    createdAt: response.createdAt,
    linkedCard: response.linkedCard ?? null,
    history: {
      chatId: response.history.chatId,
      messages: (response.history.messages ?? []).map(mapMessage),
      hasMore: response.history.hasMore,
      nextBeforeMessageId: response.history.nextBeforeMessageId,
    },
  }
}

export async function createDirectChat(userId: number) {
  const payload: CreateDirectChatRequest = { userId }
  const response = await postJson<CreateDirectChatResponse, CreateDirectChatRequest>('/chats/direct', payload)
  return response.chatId
}

export async function sendChatMessage(chatId: number, text: string) {
  const payload: SendChatMessageRequest = {
    text,
  }

  const response = await postJson<ChatMessageApi, SendChatMessageRequest>(`/chats/${chatId}/messages`, payload)
  return mapMessage(response)
}

export async function sendChatMediaMessage(chatId: number, payload: FormData) {
  const response = await postForm<ChatMessageApi>(`/chats/${chatId}/messages/media`, payload)
  return mapMessage(response)
}

export async function shareVacancyToUser(targetUserId: number, vacancyId: number, text?: string) {
  const payload: ShareVacancyToUserRequest = {
    targetUserId,
    vacancyId,
    text: text?.trim() ? text.trim() : undefined,
  }

  const response = await postJson<ShareVacancyToUserResponse, ShareVacancyToUserRequest>('/chats/share/vacancy', payload)

  return {
    chatId: response.chatId,
    message: mapMessage(response.message),
  }
}

export async function shareOpportunityToUser(targetUserId: number, opportunityId: number, text?: string) {
  const payload: ShareOpportunityToUserRequest = {
    targetUserId,
    opportunityId,
    text: text?.trim() ? text.trim() : undefined,
  }

  const response = await postJson<ShareVacancyToUserResponse, ShareOpportunityToUserRequest>('/chats/share/opportunity', payload)

  return {
    chatId: response.chatId,
    message: mapMessage(response.message),
  }
}

export function markChatRead(chatId: number, messageId: number) {
  const payload: MarkChatReadRequest = {
    messageId,
  }

  return postJson<unknown, MarkChatReadRequest>(`/chats/${chatId}/read`, payload)
}
