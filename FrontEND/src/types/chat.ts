export type ChatType = 1 | 2 | 3

export type ChatMessage = {
  id: number
  chatId: number
  senderUserId: number
  senderDisplayName: string | null
  senderAvatarUrl: string | null
  text: string
  isSystem: boolean
  createdAt: string
}

export type ChatListItem = {
  id: number
  type: ChatType
  title: string | null
  participantIds: number[]
  participantsCount: number
  createdAt: string
  lastMessage: ChatMessage | null
}
