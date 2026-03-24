import { postForm } from './client'

type UploadMediaResponse = {
  url: string
}

export async function uploadMyAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return postForm<UploadMediaResponse>('/media/me/avatar', formData)
}

export async function uploadMyProfileBanner(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return postForm<UploadMediaResponse>('/media/me/profile-banner', formData)
}

export async function uploadCompanyLogo(companyId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return postForm<UploadMediaResponse>(`/media/companies/${companyId}/logo`, formData)
}
