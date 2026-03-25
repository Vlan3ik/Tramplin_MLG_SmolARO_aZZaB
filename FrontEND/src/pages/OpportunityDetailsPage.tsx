import { CalendarClock, CheckCircle2, Clock3, Link2, MapPin, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createApplication } from '../api/applications'
import { shareOpportunityToUser, shareVacancyToUser } from '../api/chats'
import { fetchMyContacts } from '../api/contacts'
import { fetchHomeOpportunities, fetchOpportunityDetailById, participateInOpportunity } from '../api/opportunities'
import { fetchMyFollowerSubscriptions, fetchMyFollowingSubscriptions } from '../api/subscriptions'
import { OpportunityLocationMap } from '../components/home/OpportunityLocationMap'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { useApplications } from '../hooks/useApplications'
import { useAuth } from '../hooks/useAuth'
import type { Opportunity, OpportunityDetail } from '../types/opportunity'
import { typeLabel } from '../types/opportunity'
import { isFavoriteOpportunity, subscribeToFavoriteOpportunities, toggleFavoriteOpportunity } from '../utils/favorites'

function formatAbsoluteDate(value: string | null) {
  if (!value) {
    return 'Не указано'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Не указано'
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildMapLink(opportunity: OpportunityDetail) {
  if (typeof opportunity.latitude === 'number' && typeof opportunity.longitude === 'number') {
    return `https://yandex.ru/maps/?ll=${opportunity.longitude}%2C${opportunity.latitude}&z=14&pt=${opportunity.longitude},${opportunity.latitude},pm2blm`
  }

  return `https://yandex.ru/maps/?text=${encodeURIComponent(opportunity.address || opportunity.location)}`
}

export function OpportunityDetailsPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const { hasApplied } = useApplications()

  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null)
  const [similarOpportunities, setSimilarOpportunities] = useState<Opportunity[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [eventParticipating, setEventParticipating] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareContacts, setShareContacts] = useState<Array<{ userId: number; username: string | null }>>([])
  const [selectedShareUserId, setSelectedShareUserId] = useState<number | null>(null)

  const opportunityId = Number(id)

  useEffect(() => {
    if (!Number.isFinite(opportunityId) || opportunityId <= 0) {
      setIsLoading(false)
      setErrorMessage('Некорректный идентификатор вакансии.')
      return
    }

    const controller = new AbortController()

    async function loadData() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const detail = await fetchOpportunityDetailById(opportunityId, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setOpportunity(detail)
        setEventParticipating(Boolean(detail.isParticipating))
        setIsFavorite(isFavoriteOpportunity(detail.id))

        const similarResponse = await fetchHomeOpportunities(
          {
            page: 1,
            pageSize: 4,
            search: detail.company,
            filters: { types: [], formats: [], tagIds: [], salaryFrom: null, salaryTo: null, statuses: [], verifiedOnly: false },
          },
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setSimilarOpportunities(similarResponse.items.filter((item) => item.id !== detail.id).slice(0, 3))
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить вакансию.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => controller.abort()
  }, [opportunityId])

  useEffect(() => {
    const unsubscribe = subscribeToFavoriteOpportunities(() => {
      if (opportunity) {
        setIsFavorite(isFavoriteOpportunity(opportunity.id))
      }
    })

    return unsubscribe
  }, [opportunity])

  const applied = useMemo(() => {
    if (!opportunity) {
      return false
    }

    if (opportunity.type !== 'vacancy' && opportunity.type !== 'internship') {
      return eventParticipating
    }

    return hasApplied(opportunity.id)
  }, [eventParticipating, opportunity, hasApplied])

  function handleToggleFavorite() {
    if (!opportunity) {
      return
    }

    const nextValue = toggleFavoriteOpportunity(opportunity.id)
    setIsFavorite(nextValue)
    setActionError(false)
    setActionMessage(nextValue ? 'Вакансия добавлена в избранное.' : 'Вакансия удалена из избранного.')
  }

  async function handleApply() {
    if (!opportunity) {
      return
    }

    if (!session?.accessToken || !session.user?.id) {
      setActionError(true)
      setActionMessage('Для отклика нужно войти как соискатель.')
      return
    }

    if (applied) {
      setActionError(false)
      setActionMessage('Вы уже откликались на эту вакансию.')
      return
    }

    if ((opportunity.type === 'vacancy' || opportunity.type === 'internship') && !opportunity.companyId) {
      setActionError(true)
      setActionMessage('У вакансии не указан идентификатор компании.')
      return
    }

    setIsApplying(true)

    try {
      if (opportunity.type !== 'vacancy' && opportunity.type !== 'internship') {
        await participateInOpportunity(opportunity.id)
        setEventParticipating(true)
        setActionError(false)
        setActionMessage('Вы успешно записались на мероприятие.')
        return
      }

      const companyId = opportunity.companyId

      if (companyId == null) {
        throw new Error('У вакансии не указан идентификатор компании.')
      }

      await createApplication({
        companyId,
        candidateUserId: session.user.id,
        vacancyId: opportunity.id,
        initiatorRole: 1,
      })

      setActionError(false)
      setActionMessage('Отклик отправлен.')
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Не удалось отправить отклик.')
    } finally {
      setIsApplying(false)
    }
  }

  async function handleShare() {
    if (!opportunity) {
      return
    }

    if (!session?.accessToken) {
      setActionError(true)
      setActionMessage('Чтобы поделиться, нужно авторизоваться.')
      return
    }

    setIsShareModalOpen(true)
    setIsSharing(true)

    try {
      const [contacts, following, followers] = await Promise.all([fetchMyContacts(), fetchMyFollowingSubscriptions(), fetchMyFollowerSubscriptions()])
      const allUsers = [
        ...contacts.map((item) => ({ userId: item.userId, username: item.username ?? null })),
        ...following.map((item) => ({ userId: item.userId, username: item.username ?? null })),
        ...followers.map((item) => ({ userId: item.userId, username: item.username ?? null })),
      ]
      const uniqueById = new Map<number, { userId: number; username: string | null }>()
      for (const user of allUsers) {
        if (!uniqueById.has(user.userId)) {
          uniqueById.set(user.userId, user)
        }
      }
      const mapped = Array.from(uniqueById.values()).sort((a, b) => (a.username ?? '').localeCompare(b.username ?? '', 'ru'))
      setShareContacts(mapped)
      setSelectedShareUserId((current) => current ?? mapped[0]?.userId ?? null)
      if (!mapped.length) {
        setActionError(true)
        setActionMessage('Нет доступных получателей: добавьте контакты или подпишитесь на пользователей.')
      }
    } catch {
      setActionError(true)
      setActionMessage('Не удалось загрузить контакты для отправки.')
    } finally {
      setIsSharing(false)
    }
  }

  async function submitShare() {
    if (!opportunity || !selectedShareUserId) {
      return
    }

    setIsSharing(true)
    try {
      const isEvent = opportunity.type !== 'vacancy' && opportunity.type !== 'internship'
      const result = isEvent
        ? await shareOpportunityToUser(selectedShareUserId, opportunity.id)
        : await shareVacancyToUser(selectedShareUserId, opportunity.id)
      window.dispatchEvent(new Event('tramplin:chat-refresh'))
      window.dispatchEvent(new CustomEvent('tramplin:chat-open', { detail: { chatId: result.chatId } }))
      setIsShareModalOpen(false)
      setActionError(false)
      setActionMessage(isEvent ? 'Мероприятие отправлено в чат.' : 'Вакансия отправлена в чат.')
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Не удалось отправить в чат.')
    } finally {
      setIsSharing(false)
    }
  }

  if (isLoading) {
    return (
      <section className="container opportunity-page">
        <div className="state-card">Загружаем вакансию...</div>
      </section>
    )
  }

  if (!opportunity || errorMessage) {
    return (
      <section className="container opportunity-page">
        <div className="state-card state-card--error">{errorMessage || 'Вакансия не найдена.'}</div>
      </section>
    )
  }

  return (
    <section className="container opportunity-page">
      <nav className="breadcrumbs">
        <Link to="/">Главная</Link>
        <span>/</span>
        <span>{typeLabel[opportunity.type]}</span>
        <span>/</span>
        <span>{opportunity.title}</span>
      </nav>

      {actionMessage ? <div className={`state-card ${actionError ? 'state-card--error' : ''}`}>{actionMessage}</div> : null}

      <div className="opportunity-page__top card">
        <div>
          <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
          <h1>{opportunity.title}</h1>
          <div className="opportunity-key-metrics">
            <span>{opportunity.company}</span>
            <span>{opportunity.compensation}</span>
            <span>{opportunity.workFormat}</span>
            <span>
              <MapPin size={14} />
              {opportunity.location}
            </span>
          </div>
        </div>

        <aside className="sticky-action card">
          <button className="btn btn--primary" type="button" disabled={isApplying || applied} onClick={() => void handleApply()}>
            {isApplying ? 'Отправляем...' : applied ? 'Отклик отправлен' : opportunity.type !== 'vacancy' && opportunity.type !== 'internship' ? 'Записаться' : 'Откликнуться'}
          </button>
          <button className={`btn ${isFavorite ? 'btn--primary' : 'btn--ghost'}`} type="button" onClick={handleToggleFavorite}>
            {isFavorite ? 'В избранном' : 'В избранное'}
          </button>
          <a className="btn btn--ghost" href={buildMapLink(opportunity)} target="_blank" rel="noreferrer">
            Открыть карту
          </a>
          <button className="btn btn--ghost" type="button" onClick={() => void handleShare()} disabled={isSharing}>
            {isSharing ? 'Загрузка...' : 'Поделиться'}
          </button>
          <div className="status-line status-line--success">
            <CheckCircle2 size={14} />
            {opportunity.verified ? 'Компания подтверждена' : 'Компания ожидает проверку'}
          </div>
          <div className="status-line">
            <Clock3 size={14} />
            Срок отклика: {formatAbsoluteDate(opportunity.applicationDeadline)}
          </div>
          <div className="status-line">
            <CalendarClock size={14} />
            Опубликовано: {formatAbsoluteDate(opportunity.publishAt)}
          </div>
          <div className="status-line">
            <Share2 size={14} />
            Все действия на странице активны
          </div>
        </aside>
      </div>

      <div className="opportunity-page__body">
        <section className="card">
          <h2>Описание</h2>
          <p>{opportunity.fullDescription || opportunity.shortDescription || opportunity.description}</p>
        </section>

        <section className="card two-col-grid">
          <div>
            <h2>Навыки и теги</h2>
            <div className="tag-row">
              {opportunity.tags.length ? (
                opportunity.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))
              ) : (
                <p>Теги не указаны.</p>
              )}
            </div>
          </div>
          <div>
            <h2>Формат и адрес</h2>
            <p>{opportunity.workFormat}</p>
            <p>{opportunity.address}</p>
          </div>
        </section>

        <section className="card two-col-grid">
          <div>
            <h2>Контакты</h2>
            <p>{opportunity.companyPublicEmail ? `Email: ${opportunity.companyPublicEmail}` : 'Email не указан'}</p>
            {opportunity.companyWebsiteUrl ? (
              <a href={opportunity.companyWebsiteUrl} target="_blank" rel="noreferrer">
                {opportunity.companyWebsiteUrl}
              </a>
            ) : (
              <p>Сайт компании не указан</p>
            )}
          </div>
          <div>
            <h2>Ссылки</h2>
            <div className="status-line">
              <Link2 size={14} />
              <Link to="/">К списку возможностей</Link>
            </div>
            {opportunity.companyWebsiteUrl ? (
              <div className="status-line">
                <Link2 size={14} />
                <a href={opportunity.companyWebsiteUrl} target="_blank" rel="noreferrer">
                  Профиль компании на сайте
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2>Карта места</h2>
          <OpportunityLocationMap latitude={opportunity.latitude ?? null} longitude={opportunity.longitude ?? null} title={opportunity.title} />
        </section>

        <section className="card">
          <h2>Похожие возможности</h2>
          {similarOpportunities.length ? (
            <div className="similar-list">
              {similarOpportunities.map((item) => (
                <OpportunityCard key={item.id} opportunity={item} compact />
              ))}
            </div>
          ) : (
            <p>Похожие вакансии пока не найдены.</p>
          )}
        </section>
      </div>

      {isShareModalOpen ? (
        <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="share-vacancy-title">
          <div className="profile-settings-modal__content card">
            <h2 id="share-vacancy-title">{opportunity.type === 'vacancy' || opportunity.type === 'internship' ? 'Поделиться вакансией' : 'Поделиться мероприятием'}</h2>
            <p>Выберите получателя из контактов и подписок.</p>
            <select value={selectedShareUserId == null ? '' : String(selectedShareUserId)} onChange={(event) => setSelectedShareUserId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Выберите пользователя</option>
              {shareContacts.map((contact) => (
                <option key={`share-user-${contact.userId}`} value={contact.userId}>
                  {contact.username ?? `Пользователь #${contact.userId}`}
                </option>
              ))}
            </select>
            {!shareContacts.length ? <p>Список получателей пуст.</p> : null}
            <div className="profile-settings-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setIsShareModalOpen(false)} disabled={isSharing}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void submitShare()} disabled={isSharing || !selectedShareUserId}>
                {isSharing ? 'Отправляем...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
