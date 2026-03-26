import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTags } from '../api/catalog'
import { fetchResumeDiscovery } from '../api/resumes'
import { fetchMyFollowerSubscriptions, followUser, unfollowUser } from '../api/subscriptions'
import { TagPicker } from '../components/forms/TagPicker'
import { useAuth } from '../hooks/useAuth'
import type { TagListItem } from '../types/catalog'
import type { ResumeDiscoveryItem } from '../types/resumes'
import { getSubscriptionActionLabel } from '../utils/subscription-labels'

type OpenToWorkFilter = 'all' | 'open' | 'closed'

const PAGE_SIZE = 12

function formatSalary(from: number | null, to: number | null, currencyCode: string | null) {
  if (from == null && to == null) {
    return 'Зарплата не указана'
  }

  const currency = currencyCode || 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  })

  const fromText = from == null ? '' : formatter.format(from)
  const toText = to == null ? '' : formatter.format(to)

  if (from != null && to != null) {
    return `${fromText} - ${toText} ${currency}`
  }

  if (from != null) {
    return `от ${fromText} ${currency}`
  }

  return `до ${toText} ${currency}`
}

function toNullableNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function ResumesPage() {
  const { isAuthenticated, session } = useAuth()

  const [searchDraft, setSearchDraft] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [openToWorkFilter, setOpenToWorkFilter] = useState<OpenToWorkFilter>('all')
  const [salaryFromInput, setSalaryFromInput] = useState('')
  const [salaryToInput, setSalaryToInput] = useState('')
  const [onlyFollowed, setOnlyFollowed] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tags, setTags] = useState<TagListItem[]>([])
  const [items, setItems] = useState<ResumeDiscoveryItem[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [syncingIds, setSyncingIds] = useState<Record<number, boolean>>({})
  const [followerUserIds, setFollowerUserIds] = useState<Set<number>>(new Set())

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount])

  useEffect(() => {
    const controller = new AbortController()

    async function loadTags() {
      try {
        const result = await fetchTags(controller.signal)
        setTags(result)
      } catch {
        // Tag list is optional for page render.
      }
    }

    void loadTags()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setFollowerUserIds(new Set())
      return
    }

    const controller = new AbortController()

    async function loadFollowers() {
      try {
        const followers = await fetchMyFollowerSubscriptions(controller.signal)
        if (!controller.signal.aborted) {
          setFollowerUserIds(new Set(followers.map((item) => item.userId)))
        }
      } catch {
        if (!controller.signal.aborted) {
          setFollowerUserIds(new Set())
        }
      }
    }

    void loadFollowers()
    return () => controller.abort()
  }, [isAuthenticated])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setErrorMessage('')

    void fetchResumeDiscovery(
      {
        page,
        pageSize: PAGE_SIZE,
        search: searchApplied,
        openToWork:
          openToWorkFilter === 'all'
            ? null
            : openToWorkFilter === 'open',
        salaryFrom: toNullableNumber(salaryFromInput),
        salaryTo: toNullableNumber(salaryToInput),
        tagIds: selectedTagIds,
        onlyFollowed,
      },
      controller.signal,
    )
      .then((response) => {
        setItems(response.items)
        setTotalCount(response.totalCount ?? response.total ?? 0)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить резюме.')
          setItems([])
          setTotalCount(0)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [openToWorkFilter, onlyFollowed, page, salaryFromInput, salaryToInput, searchApplied, selectedTagIds])

  function applySearch() {
    setPage(1)
    setSearchApplied(searchDraft.trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearchApplied('')
    setOpenToWorkFilter('all')
    setSalaryFromInput('')
    setSalaryToInput('')
    setOnlyFollowed(false)
    setSelectedTagIds([])
    setPage(1)
  }

  async function toggleFollow(item: ResumeDiscoveryItem) {
    if (session?.user?.id === item.userId) {
      setErrorMessage('Нельзя подписаться на самого себя.')
      return
    }

    if (!isAuthenticated) {
      setErrorMessage('Чтобы подписываться, нужно войти в аккаунт.')
      return
    }

    const wasFollowed = item.isFollowedByMe
    const delta = wasFollowed ? -1 : 1
    setSyncingIds((state) => ({ ...state, [item.userId]: true }))
    setItems((state) =>
      state.map((current) =>
        current.userId === item.userId
          ? {
              ...current,
              isFollowedByMe: !wasFollowed,
              followersCount: Math.max(0, current.followersCount + delta),
            }
          : current,
      ),
    )

    try {
      if (wasFollowed) {
        await unfollowUser(item.userId)
      } else {
        await followUser(item.userId)
      }
    } catch (error) {
      setItems((state) =>
        state.map((current) =>
          current.userId === item.userId
            ? {
                ...current,
                isFollowedByMe: wasFollowed,
                followersCount: Math.max(0, current.followersCount - delta),
              }
            : current,
        ),
      )
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось обновить подписку.')
    } finally {
      setSyncingIds((state) => {
        const next = { ...state }
        delete next[item.userId]
        return next
      })
    }
  }

  return (
    <section className="container resumes-page">
      <article className="card resumes-page__hero">
        <div className="resumes-page__hero-copy">
          <h1>Резюме сообщества</h1>
          <p>Поиск людей по интересам, навыкам и ожиданиям по зарплате.</p>
        </div>
        <div className="resumes-page__hero-actions">
          <button type="button" className="btn btn--primary" onClick={applySearch}>
            Найти
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      </article>

      <article className="card resumes-page__filters">
        <label className="resumes-page__search">
          Поиск
          <input
            value={searchDraft}
            placeholder="Имя, @username, должность"
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applySearch()
              }
            }}
          />
        </label>
        <label>
          Статус поиска работы
          <select
            value={openToWorkFilter}
            onChange={(event) => {
              setPage(1)
              setOpenToWorkFilter(event.target.value as OpenToWorkFilter)
            }}
          >
            <option value="all">Все</option>
            <option value="open">Открыт к работе</option>
            <option value="closed">Не ищет работу</option>
          </select>
        </label>
        <label>
          Зарплата от
          <input
            type="number"
            value={salaryFromInput}
            onChange={(event) => {
              setPage(1)
              setSalaryFromInput(event.target.value)
            }}
          />
        </label>
        <label>
          Зарплата до
          <input
            type="number"
            value={salaryToInput}
            onChange={(event) => {
              setPage(1)
              setSalaryToInput(event.target.value)
            }}
          />
        </label>
        <label className="resumes-page__only-followed">
          <input
            type="checkbox"
            checked={onlyFollowed}
            onChange={(event) => {
              setPage(1)
              setOnlyFollowed(event.target.checked)
            }}
          />
          Только мои подписки
        </label>
        <div className="resumes-page__tag-list">
          <TagPicker
            options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
            selectedIds={selectedTagIds}
            onChange={(next) => {
              setPage(1)
              setSelectedTagIds(next)
            }}
            placeholder="Выберите теги"
            searchPlaceholder="Поиск по тегам..."
            emptyMessage="Теги не найдены"
          />
        </div>
      </article>

      {errorMessage ? <div className="state-card state-card--error">{errorMessage}</div> : null}

      <div className="card resumes-page__summary">
        <div>
          <strong>Найдено резюме: {totalCount}</strong>
          <span>
            Страница {page} из {totalPages}
          </span>
        </div>
        <div className="resumes-page__pagination">
          <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Назад
          </button>
          <button type="button" className="btn btn--ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Вперед
          </button>
        </div>
      </div>

      {isLoading ? <div className="state-card">Загружаем резюме...</div> : null}

      {!isLoading && !items.length ? (
        <div className="state-card">По вашему запросу ничего не найдено. Измените фильтры.</div>
      ) : null}

      {!isLoading && items.length ? (
        <div className="resumes-page__grid">
          {items.map((item) => (
            <article className="card resume-user-card" key={item.userId}>
              <div className="resume-user-card__head">
                <div className="resume-user-card__avatar" aria-hidden="true">
                  {item.avatarUrl ? <img src={item.avatarUrl} alt={item.displayName} /> : <span>{item.displayName.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div>
                  <h3>{item.displayName}</h3>
                  <p>@{item.username}</p>
                </div>
              </div>

              <p className="resume-user-card__position">{item.desiredPosition || item.headline || 'Позиция не указана'}</p>
              <p>{formatSalary(item.salaryFrom, item.salaryTo, item.currencyCode)}</p>

              <div className="resume-user-card__meta">
                <span className={`status-chip status-chip--${item.openToWork ? 'success' : 'warning'}`}>
                  {item.openToWork ? 'Открыт к работе' : 'Не ищет работу'}
                </span>
                <span className="status-chip">Подписчики: {item.followersCount}</span>
              </div>

              <div className="tag-row">
                {item.skills.length ? item.skills.map((skill) => <span className="tag" key={`${item.userId}-${skill.tagId}`}>{skill.tagName}</span>) : <span className="tag">Навыки не добавлены</span>}
              </div>

              <Link className="btn btn--ghost" to={`/dashboard/seeker/${encodeURIComponent(item.username)}`}>
                Портфолио
              </Link>

              {session?.user?.id === item.userId ? (
                <button type="button" className="btn btn--ghost" disabled>
                  Это вы
                </button>
              ) : (
              <button
                type="button"
                className={`btn ${item.isFollowedByMe ? 'btn--ghost' : 'btn--primary'}`}
                disabled={Boolean(syncingIds[item.userId])}
                onClick={() => {
                  void toggleFollow(item)
                }}
              >
                {getSubscriptionActionLabel(item.isFollowedByMe, followerUserIds.has(item.userId))}
              </button>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
