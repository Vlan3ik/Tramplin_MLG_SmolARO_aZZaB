import type { SeekerProfile, UpdateSeekerProfileRequest } from '../types/me'
import type { SeekerResume } from '../types/resume'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'

type ApiErrorPayload = {
  code?: string
  detail?: string
  message?: string
  title?: string
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

async function requestWithAuth<TResponse>(path: string, accessToken: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
  const responseBody = isJsonResponse ? ((await response.json()) as TResponse | ApiErrorPayload) : null

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
  }

  return responseBody as TResponse
}

export function fetchSeekerProfile(accessToken: string, signal?: AbortSignal) {
  return requestWithAuth<SeekerProfile>('/me/profile', accessToken, {
    method: 'GET',
    signal,
  })
}

export function updateSeekerProfile(accessToken: string, payload: UpdateSeekerProfileRequest) {
  return requestWithAuth<SeekerProfile>('/me/profile', accessToken, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

type ResumeApiResponse = {
  userId: number
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  skills?: Array<{
    tagId: number
    tagName: string
    level: number
    yearsExperience: number
  }> | null
  projects?: Array<{
    id: number
    title: string
    role: string
    description: string
    startDate: string
    endDate: string
    repoUrl: string
    demoUrl: string
  }> | null
  education?: Array<{
    id: number
    university: string
    faculty: string
    specialty: string
    course: number
    graduationYear: number
  }> | null
  links?: Array<{
    id: number
    kind: string
    url: string
    label: string
  }> | null
}

export async function fetchSeekerResume(accessToken: string, signal?: AbortSignal): Promise<SeekerResume> {
  const response = await requestWithAuth<ResumeApiResponse>('/me/resume', accessToken, {
    method: 'GET',
    signal,
  })

  return {
    userId: response.userId,
    headline: response.headline ?? '',
    desiredPosition: response.desiredPosition ?? '',
    summary: response.summary ?? '',
    salaryFrom: response.salaryFrom ?? null,
    salaryTo: response.salaryTo ?? null,
    currencyCode: response.currencyCode ?? 'RUB',
    skills: Array.isArray(response.skills) ? response.skills : [],
    projects: Array.isArray(response.projects) ? response.projects : [],
    education: Array.isArray(response.education) ? response.education : [],
    links: Array.isArray(response.links) ? response.links : [],
  }
}

export function updateSeekerResume(accessToken: string, payload: SeekerResume) {
  return requestWithAuth<ResumeApiResponse>('/me/resume', accessToken, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
