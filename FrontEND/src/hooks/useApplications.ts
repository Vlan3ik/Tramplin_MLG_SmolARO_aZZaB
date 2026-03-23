import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasStoredAuthSession } from '../api/client'
import { APPLICATIONS_CHANGE_EVENT, fetchMyApplications, type MyApplicationApi } from '../api/applications'

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
  statusCode: number
}

type ApplicationMeta = Pick<SeekerApplication, 'status' | 'tone' | 'next' | 'note'>

const APPLICATION_STATUS_META: Record<number, ApplicationMeta> = {
  1: {
    status: 'Новый',
    tone: 'warning',
    next: 'Ожидайте, пока работодатель начнет обработку отклика.',
    note: 'Отклик зарегистрирован и доступен работодателю.',
  },
  2: {
    status: 'На рассмотрении',
    tone: 'warning',
    next: 'Работодатель просматривает ваш отклик.',
    note: 'Отклик находится в очереди на проверку.',
  },
  3: {
    status: 'Интервью',
    tone: 'success',
    next: 'Проверьте чат и подготовьтесь к интервью.',
    note: 'Вас пригласили на следующий этап отбора.',
  },
  4: {
    status: 'Оффер',
    tone: 'success',
    next: 'Ответьте работодателю в чате.',
    note: 'Работодатель готов сделать предложение.',
  },
  5: {
    status: 'Нанят',
    tone: 'success',
    next: 'Отклик завершен.',
    note: 'Вы успешно приняты на позицию.',
  },
  6: {
    status: 'Отклонен',
    tone: 'danger',
    next: 'Посмотрите другие вакансии.',
    note: 'Работодатель отклонил отклик.',
  },
  7: {
    status: 'Отменен',
    tone: 'danger',
    next: 'Вы можете отправить новый отклик.',
    note: 'Отклик отменен.',
  },
}

function formatAppliedDate(value: Date) {
  const day = value.toLocaleDateString('ru-RU', { day: 'numeric' })
  const month = value.toLocaleDateString('ru-RU', { month: 'long' })
  return `${day} ${month}`
}

function mapApplicationMeta(status: number): ApplicationMeta {
  return APPLICATION_STATUS_META[status] ?? {
    status: `Статус #${status}`,
    tone: 'warning',
    next: 'Проверьте обновление в профиле позже.',
    note: 'Статус отклика обновлен на стороне сервера.',
  }
}

function mapApiApplication(item: MyApplicationApi): SeekerApplication {
  const meta = mapApplicationMeta(item.status)
  const createdAt = new Date(item.createdAt)

  return {
    id: String(item.id),
    opportunityId: item.vacancyId,
    createdAt: item.createdAt,
    title: item.vacancyTitle,
    company: item.companyName,
    location: item.locationName,
    date: Number.isNaN(createdAt.getTime()) ? '' : formatAppliedDate(createdAt),
    status: meta.status,
    tone: meta.tone,
    next: meta.next,
    note: meta.note,
    statusCode: item.status,
  }
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('(401)') || message.includes('unauthorized')
}

export function useApplications() {
  const [applications, setApplications] = useState<SeekerApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    try {
      if (signal?.aborted) {
        return
      }

      if (!hasStoredAuthSession()) {
        setApplications([])
        setError('')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError('')

      const rows = await fetchMyApplications(signal)

      if (signal?.aborted) {
        return
      }

      setApplications(rows.map(mapApiApplication))
    } catch (cause) {
      if (signal?.aborted) {
        return
      }

      if (isUnauthorizedError(cause)) {
        setApplications([])
        setError('')
        return
      }

      setApplications([])
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить отклики.')
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadApplications(controller.signal)

    if (typeof window === 'undefined') {
      return () => controller.abort()
    }

    const sync = () => {
      void loadApplications()
    }

    window.addEventListener(APPLICATIONS_CHANGE_EVENT, sync)
    window.addEventListener('focus', sync)
    const intervalId = window.setInterval(sync, 30_000)

    return () => {
      controller.abort()
      window.removeEventListener(APPLICATIONS_CHANGE_EVENT, sync)
      window.removeEventListener('focus', sync)
      window.clearInterval(intervalId)
    }
  }, [loadApplications])

  const hasApplied = useCallback(
    (opportunityId: number) => applications.some((item) => item.opportunityId === opportunityId),
    [applications],
  )

  const sortedApplications = useMemo(() => applications, [applications])

  return {
    applications: sortedApplications,
    hasApplied,
    isLoading,
    error,
  }
}
