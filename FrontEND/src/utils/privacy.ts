export type ProfileVisibilityMode = 'public' | 'private'

const PROFILE_VISIBILITY_STORAGE_KEY = 'tramplin.profile.visibility.v1'
const PRIVATE_PROJECTS_STORAGE_KEY = 'tramplin.portfolio.private-projects.v1'

function normalizeUsername(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function readStorageObject<T extends Record<string, unknown>>(key: string): T {
  if (typeof window === 'undefined') {
    return {} as T
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return {} as T
  }

  try {
    const parsed = JSON.parse(raw) as T
    return parsed && typeof parsed === 'object' ? parsed : ({} as T)
  } catch {
    window.localStorage.removeItem(key)
    return {} as T
  }
}

function writeStorageObject(key: string, value: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getProfileVisibilityMode(username: string | null | undefined): ProfileVisibilityMode {
  const normalized = normalizeUsername(username)
  if (!normalized) {
    return 'public'
  }

  const map = readStorageObject<Record<string, ProfileVisibilityMode>>(PROFILE_VISIBILITY_STORAGE_KEY)
  return map[normalized] === 'private' ? 'private' : 'public'
}

export function isProfileVisibleInResumes(username: string | null | undefined) {
  return getProfileVisibilityMode(username) === 'public'
}

export function setProfileVisibilityMode(username: string | null | undefined, mode: ProfileVisibilityMode) {
  const normalized = normalizeUsername(username)
  if (!normalized) {
    return
  }

  const map = readStorageObject<Record<string, ProfileVisibilityMode>>(PROFILE_VISIBILITY_STORAGE_KEY)
  map[normalized] = mode
  writeStorageObject(PROFILE_VISIBILITY_STORAGE_KEY, map)
}

export function getPrivateProjectIds(username: string | null | undefined): number[] {
  const normalized = normalizeUsername(username)
  if (!normalized) {
    return []
  }

  const map = readStorageObject<Record<string, number[]>>(PRIVATE_PROJECTS_STORAGE_KEY)
  const list = map[normalized]

  if (!Array.isArray(list)) {
    return []
  }

  return list.filter((id) => Number.isInteger(id) && id > 0)
}

export function isPortfolioProjectPrivate(username: string | null | undefined, projectId: number) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return false
  }

  return getPrivateProjectIds(username).includes(projectId)
}

export function setPortfolioProjectPrivacy(username: string | null | undefined, projectId: number, isPrivate: boolean) {
  const normalized = normalizeUsername(username)
  if (!normalized || !Number.isInteger(projectId) || projectId <= 0) {
    return
  }

  const map = readStorageObject<Record<string, number[]>>(PRIVATE_PROJECTS_STORAGE_KEY)
  const current = Array.isArray(map[normalized]) ? map[normalized] : []
  const next = new Set(current.filter((id) => Number.isInteger(id) && id > 0))

  if (isPrivate) {
    next.add(projectId)
  } else {
    next.delete(projectId)
  }

  map[normalized] = Array.from(next)
  writeStorageObject(PRIVATE_PROJECTS_STORAGE_KEY, map)
}
