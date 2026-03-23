export type ContactUser = {
  userId: number
  username: string | null
  avatarUrl: string | null
}

export type ContactRequest = {
  id: number
  sender: ContactUser
  receiver: ContactUser
  status: number
  createdAt: string
}
