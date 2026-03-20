import { useCallback, useEffect, useMemo, useState } from 'react'

const APPLICATIONS_STORAGE_KEY = 'tramplin.seeker.applications'
const APPLICATIONS_CHANGE_EVENT = 'tramplin:applications-change'

export type SeekerApplication = {
  id: string
  opportunityId: number
  createdAt: string
  title: string
  company: string
  location: string
  date: string
  status: string
  tone: 'success' | 'warning' | 'danger'
  next: string
  note: string
}

type ApplicationSource = {
  id: number
  title: string
  company: string
  location: string
}

function formatAppliedDate(value: Date) {
  const day = value.toLocaleDateString('ru-RU', { day: 'numeric' })
  const month = value.toLocaleDateString('ru-RU', { month: 'long' })
  return `${day} ${month}`
}

function parseStoredApplications(raw: string | null) {
  if (!raw) {
    return [] as SeekerApplication[]
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return [] as SeekerApplication[]
    }

    return parsed.filter((item): item is SeekerApplication => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const candidate = item as Partial<SeekerApplication>

      return (
        typeof candidate.id === 'string' &&
        typeof candidate.opportunityId === 'number' &&
        typeof candidate.createdAt === 'string' &&
        typeof candidate.title === 'string' &&
        typeof candidate.company === 'string' &&
        typeof candidate.location === 'string'
      )
    })
  } catch {
    return [] as SeekerApplication[]
  }
}

function readApplications() {
  if (typeof window === 'undefined') {
    return [] as SeekerApplication[]
  }

  return parseStoredApplications(window.localStorage.getItem(APPLICATIONS_STORAGE_KEY))
}

function writeApplications(items: SeekerApplication[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(APPLICATIONS_CHANGE_EVENT))
}

export function useApplications() {
  const [applications, setApplications] = useState<SeekerApplication[]>(() => readApplications())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    const sync = () => setApplications(readApplications())

    const onStorage = (event: StorageEvent) => {
      if (event.key === APPLICATIONS_STORAGE_KEY) {
        sync()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(APPLICATIONS_CHANGE_EVENT, sync)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(APPLICATIONS_CHANGE_EVENT, sync)
    }
  }, [])

  const hasApplied = useCallback(
    (opportunityId: number) => applications.some((item) => item.opportunityId === opportunityId),
    [applications],
  )

  const addApplication = useCallback((source: ApplicationSource) => {
    let created = false

    setApplications((currentState) => {
      if (currentState.some((item) => item.opportunityId === source.id)) {
        return currentState
      }

      const now = new Date()
      const nextState: SeekerApplication[] = [
        {
          id: `${source.id}-${now.getTime()}`,
          opportunityId: source.id,
          createdAt: now.toISOString(),
          title: source.title,
          company: source.company,
          location: source.location,
          date: formatAppliedDate(now),
          status: 'На рассмотрении',
          tone: 'warning',
          next: 'Ожидайте ответ работодателя в чате',
          note: 'Отклик отправлен с платформы',
        },
        ...currentState,
      ]

      writeApplications(nextState)
      created = true
      return nextState
    })

    return created
  }, [])

  const sortedApplications = useMemo(() => applications, [applications])

  return {
    applications: sortedApplications,
    hasApplied,
    addApplication,
  }
}
