const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'

type ApiErrorPayload = {
  code?: string
  detail?: string
  message?: string
  title?: string
}

type UploadMediaResponse = {
  url: string
}

function extractApiErrorMessage(payload: ApiErrorPayload | null, status: number) {
  if (payload?.message) {
    return payload.message
  }

  if (payload?.detail) {
    return payload.detail
  }

  if (payload?.title) {
    return payload.title
  }

  if (payload?.code) {
    return `Ошибка API: ${payload.code}`
  }

  return `Ошибка запроса (${status})`
}

export async function uploadMyAvatar(accessToken: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/media/me/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })

  const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
  const responseBody = isJsonResponse ? ((await response.json()) as UploadMediaResponse | ApiErrorPayload) : null

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
  }

  return responseBody as UploadMediaResponse
}
