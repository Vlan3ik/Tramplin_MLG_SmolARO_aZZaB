import { Bookmark, CalendarClock, CheckCircle2, ChevronLeft, Clock3, MapPin, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createApplication } from '../api/applications'
import { shareOpportunityToUser, shareVacancyToUser } from '../api/chats'
import { fetchMyContacts } from '../api/contacts'
import { addOpportunityToFavorites, addVacancyToFavorites, fetchMyFavorites, removeOpportunityFromFavorites, removeVacancyFromFavorites } from '../api/favorites'
import { fetchHomeOpportunities, fetchOpportunityDetailById, participateInOpportunity } from '../api/opportunities'
import { fetchMyFollowerSubscriptions, fetchMyFollowingSubscriptions } from '../api/subscriptions'
import { OpportunityLocationMap } from '../components/home/OpportunityLocationMap'
import { useApplications } from '../hooks/useApplications'
import { useAuth } from '../hooks/useAuth'
import type { Opportunity, OpportunityDetail } from '../types/opportunity'
import { typeLabel } from '../types/opportunity'
import { buildOpportunityDetailsPath, type OpportunityEntityType } from '../utils/opportunity-routing'
import { applyOpportunitySocialSnapshot, resolveOpportunitySocialEntityType, upsertOpportunitySocialState, upsertOpportunitySocialStates } from '../utils/opportunity-social-state'
import { getTagDisplayLabel } from '../utils/tag-labels'

type FavoriteIdsSnapshot = {
  vacancyIds: Set<number>
  opportunityIds: Set<number>
}

function toFavoriteIdsSnapshot(value: { vacancyIds: number[]; opportunityIds: number[] }): FavoriteIdsSnapshot {
  return {
    vacancyIds: new Set(value.vacancyIds),
    opportunityIds: new Set(value.opportunityIds),
  }
}

function resolveIsFavoriteFromSnapshot(opportunity: Opportunity, snapshot: FavoriteIdsSnapshot | null) {
  if (!snapshot) {
    return opportunity.isFavoriteByMe
  }

  const entityType = resolveOpportunitySocialEntityType(opportunity)
  return entityType === 'vacancy' ? snapshot.vacancyIds.has(opportunity.id) : snapshot.opportunityIds.has(opportunity.id)
}

function resolveDetailFavoriteFromSnapshot(opportunity: OpportunityDetail, snapshot: FavoriteIdsSnapshot | null) {
  if (!snapshot) {
    return opportunity.isFavoriteByMe
  }

  const entityType = resolveOpportunitySocialEntityType(opportunity)
  return entityType === 'vacancy' ? snapshot.vacancyIds.has(opportunity.id) : snapshot.opportunityIds.has(opportunity.id)
}

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

function normalizeTag(value: string) {
  return value.trim().toLowerCase()
}

function calculateSimilarityScore(base: OpportunityDetail, candidate: Opportunity, baseTagSet: Set<string>) {
  let score = 0

  if (candidate.type === base.type) {
    score += 35
  } else if (
    (base.type === 'vacancy' || base.type === 'internship')
    && (candidate.type === 'vacancy' || candidate.type === 'internship')
  ) {
    score += 20
  }

  const candidateTagSet = new Set(candidate.tags.map(normalizeTag))
  let sharedTags = 0
  for (const tag of candidateTagSet) {
    if (baseTagSet.has(tag)) {
      sharedTags += 1
    }
  }

  score += sharedTags * 18
  if (sharedTags === 0) {
    score -= 8
  }

  if (candidate.workFormat === base.workFormat) {
    score += 8
  }

  if (candidate.location === base.location) {
    score += 7
  }

  if (candidate.company === base.company) {
    score += 4
  }

  if (candidate.verified === base.verified) {
    score += 2
  }

  score += Math.min(candidate.tagMatchCount, 5)

  return score
}

function formatSimilarCompensation(value: string) {
  return value.replace(/руб\.?/gi, 'RUB')
}

export function OpportunityDetailsPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const navigate = useNavigate()
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
  const [favoriteIdsSnapshot, setFavoriteIdsSnapshot] = useState<FavoriteIdsSnapshot | null>(null)

  const opportunityId = Number(id)
  const preferredEntityType = useMemo(() => {
    const value = searchParams.get('entityType')
    return value === 'vacancy' || value === 'opportunity' ? (value as OpportunityEntityType) : null
  }, [searchParams])

  useEffect(() => {
    if (!session?.accessToken) {
      setFavoriteIdsSnapshot(null)
      return
    }

    const controller = new AbortController()
    void fetchMyFavorites(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setFavoriteIdsSnapshot(toFavoriteIdsSnapshot(response))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFavoriteIdsSnapshot(null)
        }
      })

    return () => controller.abort()
  }, [session?.accessToken, session?.user?.id])

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
        const detail = await fetchOpportunityDetailById(opportunityId, controller.signal, preferredEntityType)

        if (controller.signal.aborted) {
          return
        }

        const normalizedDetail = {
          ...detail,
          isFavoriteByMe: resolveDetailFavoriteFromSnapshot(detail, favoriteIdsSnapshot),
        }

        setOpportunity(normalizedDetail)
        setEventParticipating(Boolean(detail.isParticipating))
        setIsFavorite(Boolean(normalizedDetail.isFavoriteByMe))
        upsertOpportunitySocialState(normalizedDetail)

        const baseEntityType = resolveOpportunitySocialEntityType(detail)
        const baseTagSet = new Set(detail.tags.map(normalizeTag))

        const similarResponse = await fetchHomeOpportunities(
          {
            page: 1,
            pageSize: 48,
            search: '',
            filters: {
              types:
                detail.type === 'event'
                  ? ['event']
                  : detail.type === 'vacancy'
                    ? ['vacancy', 'internship']
                    : detail.type === 'internship'
                      ? ['internship', 'vacancy']
                      : [detail.type],
              formats: [],
              tagIds: [],
              salaryFrom: null,
              salaryTo: null,
              statuses: [],
              verifiedOnly: false,
            },
          },
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        const rankedSimilar = similarResponse.items
          .map((item) => ({ ...item, isFavoriteByMe: resolveIsFavoriteFromSnapshot(item, favoriteIdsSnapshot) }))
          .filter((item) => !(item.id === detail.id && resolveOpportunitySocialEntityType(item) === baseEntityType))
          .map((item) => ({
            item,
            score: calculateSimilarityScore(detail, item, baseTagSet),
          }))
          .sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score
            }

            if (b.item.tagMatchCount !== a.item.tagMatchCount) {
              return b.item.tagMatchCount - a.item.tagMatchCount
            }

            return b.item.id - a.item.id
          })

        const positiveRanked = rankedSimilar.filter((entry) => entry.score > 0)
        const normalizedSimilar = (positiveRanked.length ? positiveRanked : rankedSimilar)
          .slice(0, 3)
          .map((entry) => entry.item)

        setSimilarOpportunities(normalizedSimilar)
        upsertOpportunitySocialStates(normalizedSimilar)
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
  }, [favoriteIdsSnapshot, opportunityId, preferredEntityType])

  const applied = useMemo(() => {
    if (!opportunity) {
      return false
    }

    if (opportunity.type !== 'vacancy' && opportunity.type !== 'internship') {
      return eventParticipating
    }

    return hasApplied(opportunity.id)
  }, [eventParticipating, opportunity, hasApplied])

  async function handleToggleFavorite() {
    if (!opportunity) {
      return
    }

    const entityType = resolveOpportunitySocialEntityType(opportunity)
    const nextValue = !isFavorite

    try {
      const snapshot =
        entityType === 'vacancy'
          ? nextValue
            ? await addVacancyToFavorites(opportunity.id)
            : await removeVacancyFromFavorites(opportunity.id)
          : nextValue
            ? await addOpportunityToFavorites(opportunity.id)
            : await removeOpportunityFromFavorites(opportunity.id)

      applyOpportunitySocialSnapshot(snapshot)
      setIsFavorite(snapshot.isFavoriteByMe)
      setOpportunity((current) =>
        current && resolveOpportunitySocialEntityType(current) === snapshot.entityType && current.id === snapshot.id
          ? {
              ...current,
              isFavoriteByMe: snapshot.isFavoriteByMe,
              friendFavoritesCount: snapshot.friendFavoritesCount,
              friendsAppliedCount: snapshot.friendApplicationsCount,
            }
          : current,
      )
      setActionError(false)
      setActionMessage(snapshot.isFavoriteByMe ? 'Добавлено в избранное.' : 'Удалено из избранного.')
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Не удалось обновить избранное.')
    }
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
        <div className="state-card">Загружаем возможность...</div>
      </section>
    )
  }

  if (!opportunity || errorMessage) {
    return (
      <section className="container opportunity-page">
        <div className="state-card state-card--error">{errorMessage || 'Возможность не найдена.'}</div>
      </section>
    )
  }
  const descriptionText = opportunity.fullDescription || opportunity.shortDescription || opportunity.description

  return (
    <section className="container opportunity-page opportunity-event-card-page">
      <div className="opportunity-event-card-page__back">
        <button className="btn btn--ghost" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
          Назад
        </button>
      </div>

      {actionMessage ? <div className={`state-card ${actionError ? 'state-card--error' : ''}`}>{actionMessage}</div> : null}

      <div className="opportunity-page__top">
        <article className="card opportunity-event-card">
          <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
          <h1>{opportunity.title}</h1>
          <div className="opportunity-event-card__chips">
            <span className="tag opportunity-event-card__chip opportunity-event-card__chip--company">{opportunity.company}</span>
            <span className="tag opportunity-event-card__chip opportunity-event-card__chip--salary">{opportunity.compensation}</span>
            <span className="tag opportunity-event-card__chip opportunity-event-card__chip--format">{opportunity.workFormat}</span>
            <span className="tag opportunity-event-card__chip opportunity-event-card__chip--location">
              <MapPin size={14} />
              {opportunity.location}
            </span>
          </div>
          <p className="opportunity-event-card__description">{descriptionText}</p>

          <div className="opportunity-event-card__section">
            <h2>Навыки и теги</h2>
            <div className="tag-row">
              {opportunity.tags.length ? (
                opportunity.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {getTagDisplayLabel(tag)}
                  </span>
                ))
              ) : (
                <p>Теги не указаны.</p>
              )}
            </div>
          </div>

          <div className="opportunity-event-card__section">
            <h2>Контакты</h2>
            <p>{opportunity.companyPublicEmail ? `Email: ${opportunity.companyPublicEmail}` : 'Email не указан'}</p>
          </div>

          <div className="opportunity-event-card__section">
            <h2>Ссылки</h2>
            {opportunity.companyWebsiteUrl ? (
              <a href={opportunity.companyWebsiteUrl} target="_blank" rel="noreferrer">
                Профиль компании на сайте
              </a>
            ) : (
              <p>Ссылки не указаны.</p>
            )}
          </div>

          <div className="opportunity-event-card__section">
            <h2>Формат и адрес</h2>
            <p>{`${opportunity.workFormat}, ${opportunity.address || opportunity.location}`}</p>
          </div>
        </article>

        <aside className="card sticky-action opportunity-event-card__actions">
          <button className="btn btn--primary" type="button" disabled={isApplying || applied} onClick={() => void handleApply()}>
            {isApplying ? 'Отправляем...' : applied ? 'Отклик отправлен' : opportunity.type !== 'vacancy' && opportunity.type !== 'internship' ? 'Записаться' : 'Откликнуться'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => void handleToggleFavorite()}>
            {isFavorite ? 'В избранном' : 'В избранное'}
          </button>
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
        <section className="card opportunity-event-card-page__map">
          <h2>Карта места</h2>
          <OpportunityLocationMap latitude={opportunity.latitude ?? null} longitude={opportunity.longitude ?? null} title={opportunity.title} />
        </section>

        <section className="card opportunity-event-card-page__similar">
          <h2>Похожие возможности</h2>
          {similarOpportunities.length ? (
            <div className="similar-list">
              {similarOpportunities.map((item) => (
                <article key={item.id} className="opportunity-event-similar-card">
                  <div className="opportunity-event-similar-card__left">
                    <span className={`badge badge--${item.type}`}>{typeLabel[item.type]}</span>
                    <h3>
                      <Link to={buildOpportunityDetailsPath(item)}>{item.title}</Link>
                    </h3>
                    <p>{item.description || 'Описание добавляется в карточке вакансии.'}</p>
                    <div className="tag-row">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span key={`${item.id}-${tag}`} className="tag">
                          {getTagDisplayLabel(tag)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="opportunity-event-similar-card__right">
                    <strong>{formatSimilarCompensation(item.compensation)}</strong>
                    <Link className="btn btn--icon" aria-label="Открыть карточку" to={buildOpportunityDetailsPath(item)}>
                      <Bookmark size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Похожие вакансии пока не найдены.</p>
          )}
        </section>
      </div>
      <div className="opportunity-event-card-page__footer-spacer" aria-hidden="true" />

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






