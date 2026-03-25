export type ChatType = 1 | 2 | 3

export type ChatAttachmentType = 1 | 2 | 3 | 4 | 5

export type VacancyCard = {
  vacancyId: number
  title: string
  kind: number
  format: number
  status: number
  salaryTaxMode: number
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
}

export type OpportunityCard = {
  opportunityId: number
  title: string
  kind: number
  format: number
  status: number
  eventDate: string | null
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
}

export type ChatMessageAttachment = {
  id: number
  type: ChatAttachmentType
  url: string | null
  mimeType: string | null
  fileName: string | null
  sizeBytes: number | null
  vacancy: VacancyCard | null
  opportunity: OpportunityCard | null
}

export type ChatMessage = {
  id: number
  chatId: number
  senderUserId: number
  senderDisplayName: string | null
  senderUsername: string | null
  senderAvatarUrl: string | null
  text: string
  isSystem: boolean
  createdAt: string
  attachments: ChatMessageAttachment[]
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
