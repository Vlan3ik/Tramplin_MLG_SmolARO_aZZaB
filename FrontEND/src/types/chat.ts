export type ChatType = 1 | 2

export type ChatMessage = {
  id: number
  chatId: number
  senderUserId: number
  text: string
  isSystem: boolean
  createdAt: string
}

export type ChatListItem = {
  id: number
  type: ChatType
  title: string | null
  participantIds: number[]
  createdAt: string
  lastMessage: ChatMessage | null
}
