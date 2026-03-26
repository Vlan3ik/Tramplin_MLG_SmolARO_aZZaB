import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteMyPortfolioProject,
  deleteMyPortfolioProjectPhoto,
  fetchPublicPortfolioProjectDetail,
  fetchPublicPortfolioProjects,
  updateMyPortfolioProject,
  updateMyPortfolioProjectPhoto,
  uploadMyPortfolioProjectPhoto,
} from '../../api/portfolio'
import { fetchSeekerResume } from '../../api/me'
import {
  fetchOpportunityCollaborationSuggestions,
  fetchProfileCollaborationSuggestions,
  fetchVacancyCollaborationSuggestions,
} from '../../api/search'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { DateInput } from '../../components/forms/DateInput'
import { API_ORIGIN } from '../../config/api'
import { useAuth } from '../../hooks/useAuth'
import type { PortfolioProjectMutationRequest } from '../../api/portfolio'
import type {
  PublicPortfolioProjectCard,
  PublicPortfolioProjectDetail,
  PublicPortfolioProjectPhoto,
} from '../../types/portfolio'

type Opt = { id: number; title: string; subtitle?: string }
type Participant = { id: string; userId: number; username: string; role: string }
type Collaboration = { id: string; type: 1 | 2 | 3 | 4; itemId: number | null; title: string }

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
const IMAGE_MAX_SIZE = 10 * 1024 * 1024

function fmtDate(value: string | null) {
  if (!value) return 'Не указано'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(d)
}

const toNullable = (v: string) => (v.trim() ? v.trim() : null)
const normalizeUrl = (v: string) =>
  !v.trim() ? '' : /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`

const resolveMediaUrl = (url: string | null | undefined) => {
  const value = (url ?? '').trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`
  return `${API_ORIGIN}/${value}`
}

const getAvatarFallback = (name: string) => (name.trim().charAt(0) || 'P').toUpperCase()

const validateImage = (f: File) =>
  !IMAGE_TYPES.has(f.type)
    ? 'Поддерживаются JPG, PNG, WEBP, GIF, SVG.'
    : f.size > IMAGE_MAX_SIZE
      ? 'Размер файла до 10 МБ.'
      : null

function mapParticipants(detail: PublicPortfolioProjectDetail): Participant[] {
  return (detail.participants ?? [])
    .filter((p) => p.userId !== detail.authorUserId)
    .map((p, i) => ({
      id: `p-${p.userId}-${i}`,
      userId: p.userId,
      username: p.username ?? `user-${p.userId}`,
      role: p.role ?? '',
    }))
}

function mapCollaborations(detail: PublicPortfolioProjectDetail): Collaboration[] {
  return (detail.collaborations ?? []).map((c) => ({
    id: `c-${c.id}`,
    type: c.type as 1 | 2 | 3 | 4,
    itemId: c.userId ?? c.vacancyId ?? c.opportunityId ?? null,
    title:
      c.type === 2
        ? (c.vacancyTitle ?? `Vacancy #${c.vacancyId ?? ''}`)
        : c.type === 3
          ? (c.opportunityTitle ?? `Opportunity #${c.opportunityId ?? ''}`)
          : c.type === 1
            ? (c.userFio || c.username || `User #${c.userId ?? ''}`)
            : (c.label ?? 'Коллаборация'),
  }))
}

export function SeekerPortfolioProjectPage() {
  const { username: routeUsername, projectId: routeProjectId } = useParams<{
    username?: string
    projectId?: string
  }>()

  const rawUsername = routeUsername?.trim() ?? ''
  const isOwnerProjectPathAlias = rawUsername.toLowerCase() === 'project'
  const username = isOwnerProjectPathAlias ? '' : rawUsername
  const projectId = Number(routeProjectId)

  const navigate = useNavigate()
  const { session } = useAuth()

  const normalizedSessionUsername = session?.user?.username?.trim().toLowerCase() ?? ''
  const normalizedRouteUsername = username.toLowerCase()
  const isOwnUsernameRoute =
    Boolean(normalizedRouteUsername) && normalizedRouteUsername === normalizedSessionUsername
  const isPublicRoute = Boolean(username) && !isOwnUsernameRoute

  const [project, setProject] = useState<PublicPortfolioProjectDetail | null>(null)
  const [projectCard, setProjectCard] = useState<PublicPortfolioProjectCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePhotoId, setActivePhotoId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingPhotos, setUpdatingPhotos] = useState(false)

  const [title, setTitle] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [editPhotos, setEditPhotos] = useState<PublicPortfolioProjectPhoto[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [collaborations, setCollaborations] = useState<Collaboration[]>([])

  const [pQuery, setPQuery] = useState('')
  const [pRole, setPRole] = useState('')
  const [pOpts, setPOpts] = useState<Opt[]>([])
  const [selP, setSelP] = useState<{ userId: number; username: string } | null>(null)
  const [vQuery, setVQuery] = useState('')
  const [vOpts, setVOpts] = useState<Opt[]>([])
  const [oQuery, setOQuery] = useState('')
  const [oOpts, setOOpts] = useState<Opt[]>([])

  const isOwner = Boolean(project && session?.user?.id && project.authorUserId === session.user.id)
  const backHref = username ? `/dashboard/seeker/${encodeURIComponent(username)}` : '/dashboard/seeker'

  useEffect(() => {
    if (!Number.isFinite(projectId) || projectId <= 0) {
      setError('Проект не найден.')
      setLoading(false)
      return
    }

    const c = new AbortController()

    ;(async () => {
      try {
        setLoading(true)
        setError('')

        const detail = await fetchPublicPortfolioProjectDetail(projectId, {
          signal: c.signal,
          withAuth: !isPublicRoute,
        })
        if (c.signal.aborted) return

        setProject(detail)
        setTitle(detail.title ?? '')
        setRole(detail.authorRole ?? '')
        setDescription(detail.description ?? '')
        setStartDate(detail.startDate ?? '')
        setEndDate(detail.endDate ?? '')
        setRepoUrl(detail.repoUrl ?? '')
        setDemoUrl(detail.demoUrl ?? '')
        setEditPhotos([...(detail.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder))
        setParticipants(mapParticipants(detail))
        setCollaborations(mapCollaborations(detail))

        const main = detail.photos.find((p) => p.isMain) ?? detail.photos[0] ?? null
        setActivePhotoId(main?.id ?? null)

        if (!isPublicRoute && session?.accessToken) {
          try {
            const r = await fetchSeekerResume(c.signal)
            const p = r.projects.find((x) => x.id === detail.projectId)
            setIsPrivate(Boolean(p?.isPrivate))
          } catch {
            setIsPrivate(false)
          }
        }

        const u = username || detail.authorUsername || session?.user?.username?.trim() || ''
        if (u) {
          const ps = await fetchPublicPortfolioProjects(u, c.signal)
          if (!c.signal.aborted) {
            setProjectCard(ps.find((x) => x.projectId === projectId) ?? null)
          }
        }
      } catch (e) {
        if (!c.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить проект.')
        }
      } finally {
        if (!c.signal.aborted) setLoading(false)
      }
    })()

    return () => c.abort()
  }, [isPublicRoute, projectId, session?.accessToken, session?.user?.username, username])

  useEffect(() => {
    if (!isModalOpen || !pQuery.trim()) return
    const c = new AbortController()
    const t = setTimeout(async () => {
      const r = await fetchProfileCollaborationSuggestions(pQuery.trim().replace(/^@+/, ''), c.signal)
      if (c.signal.aborted) return
      setPOpts(
        r.items
          .filter((i) => i.username && (!project || i.id !== project.authorUserId))
          .map((i) => ({
            id: i.id,
            title: `@${i.username}`,
            subtitle: i.title,
          })),
      )
    }, 220)

    return () => {
      c.abort()
      clearTimeout(t)
    }
  }, [isModalOpen, pQuery, project])

  useEffect(() => {
    if (!isModalOpen || !vQuery.trim()) return
    const c = new AbortController()
    const t = setTimeout(async () => {
      const r = await fetchVacancyCollaborationSuggestions(vQuery, c.signal)
      if (c.signal.aborted) return
      setVOpts(
        r.items.map((i) => ({
          id: i.id,
          title: i.title,
          subtitle: [i.companyName, i.locationName].filter(Boolean).join(' · '),
        })),
      )
    }, 220)

    return () => {
      c.abort()
      clearTimeout(t)
    }
  }, [isModalOpen, vQuery])

  useEffect(() => {
    if (!isModalOpen || !oQuery.trim()) return
    const c = new AbortController()
    const t = setTimeout(async () => {
      const r = await fetchOpportunityCollaborationSuggestions(oQuery, c.signal)
      if (c.signal.aborted) return
      setOOpts(
        r.items.map((i) => ({
          id: i.id,
          title: i.title,
          subtitle: [i.companyName, i.locationName].filter(Boolean).join(' · '),
        })),
      )
    }, 220)

    return () => {
      c.abort()
      clearTimeout(t)
    }
  }, [isModalOpen, oQuery])

  const photos = useMemo(
    () =>
      [...(project?.photos ?? [])].sort((a, b) =>
        a.isMain === b.isMain ? a.sortOrder - b.sortOrder : a.isMain ? -1 : 1,
      ),
    [project?.photos],
  )

  const active = useMemo(
    () => (!photos.length ? null : photos.find((p) => p.id === activePhotoId) ?? photos[0]),
    [activePhotoId, photos],
  )

  const titleView = projectCard?.title || project?.title || 'Проект'
  const authorView =
    projectCard?.authorFio || project?.authorFio || username || session?.user?.username || 'Автор проекта'
  const authorRoleView = project?.authorRole || projectCard?.primaryRole || 'Роль не указана'
  const authorAvatarUrl = resolveMediaUrl(project?.authorAvatarUrl || projectCard?.authorAvatarUrl)
  const authorFallback = getAvatarFallback(authorView)

  const participantItems = useMemo(
    () =>
      (project?.participants ?? [])
        .filter((item) => item.userId !== project?.authorUserId)
        .map((item) => ({
          id: `participant-${item.userId}-${item.username ?? ''}`,
          name: item.fio || item.username || `@${item.userId}`,
          role: item.role || 'Участник',
          avatarUrl: resolveMediaUrl(item.avatarUrl),
        })),
    [project],
  )

  const userCollaborationItems = useMemo(
    () =>
      (project?.collaborations ?? [])
        .filter((item) => item.type === 1 && item.userId && item.userId !== project?.authorUserId)
        .map((item) => ({
          id: `collab-user-${item.id}`,
          name: item.userFio || item.username || `@${item.userId}`,
          role: 'Коллаборация',
          avatarUrl: resolveMediaUrl(item.userAvatarUrl),
        })),
    [project],
  )

  const vacancyCollaborationItems = useMemo(
    () => (project?.collaborations ?? []).filter((item) => item.type === 2 && item.vacancyId),
    [project],
  )

  const opportunityCollaborationItems = useMemo(
    () => (project?.collaborations ?? []).filter((item) => item.type === 3 && item.opportunityId),
    [project],
  )

  function openModal() {
    if (!project) return
    setParticipants(mapParticipants(project))
    setCollaborations(mapCollaborations(project))
    setEditPhotos([...(project.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder))
    setPQuery('')
    setPRole('')
    setSelP(null)
    setVQuery('')
    setOQuery('')
    setPOpts([])
    setVOpts([])
    setOOpts([])
    setIsModalOpen(true)
  }

  function onAddParticipant() {
    if (!selP) return

    if (project && selP.userId === project.authorUserId) {
      setError('Владелец не добавляется в участники.')
      return
    }

    if (participants.some((p) => p.userId === selP.userId)) {
      setError('Пользователь уже добавлен.')
      return
    }

    setParticipants((s) => [
      ...s,
      { id: `p-${Date.now()}`, userId: selP.userId, username: selP.username, role: pRole.trim() },
    ])
    setPQuery('')
    setPRole('')
    setSelP(null)
  }

  function onAddCollab(type: 2 | 3, opt: Opt) {
    if (collaborations.some((c) => c.type === type && c.itemId === opt.id)) return
    setCollaborations((s) => [...s, { id: `c-${type}-${opt.id}`, type, itemId: opt.id, title: opt.title }])
    if (type === 2) setVQuery('')
    else setOQuery('')
  }

  async function onUploadPhotos(e: ChangeEvent<HTMLInputElement>) {
    if (!project) return

    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return

    setUpdatingPhotos(true)
    setError('')

    try {
      const next = [...editPhotos]
      for (const f of files) {
        const v = validateImage(f)
        if (v) {
          setError(v)
          continue
        }

        const r = await uploadMyPortfolioProjectPhoto(project.projectId, f, {
          isMain: !next.some((p) => p.isMain),
          sortOrder: next.length,
        })

        next.push({ id: r.photoId, url: r.url, sortOrder: r.sortOrder, isMain: r.isMain })
      }

      setEditPhotos(next.sort((a, b) => a.sortOrder - b.sortOrder))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото.')
    } finally {
      setUpdatingPhotos(false)
    }
  }

  async function onSetMainPhoto(photoId: number) {
    if (!project) return
    const p = editPhotos.find((x) => x.id === photoId)
    if (!p) return

    setUpdatingPhotos(true)
    try {
      await updateMyPortfolioProjectPhoto(project.projectId, photoId, {
        sortOrder: p.sortOrder,
        isMain: true,
      })
      setEditPhotos((s) => s.map((x) => ({ ...x, isMain: x.id === photoId })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления фото')
    } finally {
      setUpdatingPhotos(false)
    }
  }

  async function onDeletePhoto(photoId: number) {
    if (!project) return
    setUpdatingPhotos(true)

    try {
      await deleteMyPortfolioProjectPhoto(project.projectId, photoId)
      setEditPhotos((s) => {
        const n = s.filter((x) => x.id !== photoId)
        if (n.length && !n.some((x) => x.isMain)) n[0] = { ...n[0], isMain: true }
        return n
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления фото')
    } finally {
      setUpdatingPhotos(false)
    }
  }

  async function onSave() {
    if (!project || !isOwner) return

    if (!title.trim()) {
      setError('Укажите название проекта.')
      return
    }

    if (startDate && endDate && endDate < startDate) {
      setError('Дата окончания раньше даты начала.')
      return
    }

    const payload: PortfolioProjectMutationRequest = {
      title: title.trim(),
      role: toNullable(role),
      description: toNullable(description),
      startDate: toNullable(startDate),
      endDate: toNullable(endDate),
      repoUrl: toNullable(normalizeUrl(repoUrl)),
      demoUrl: toNullable(normalizeUrl(demoUrl)),
      isPrivate,
      participants: participants.map((p) => ({
        userId: p.userId,
        role: p.role.trim() || 'Contributor',
      })),
      collaborations: collaborations.map((c, i) => ({
        type: c.type,
        userId: c.type === 1 ? c.itemId : null,
        vacancyId: c.type === 2 ? c.itemId : null,
        opportunityId: c.type === 3 ? c.itemId : null,
        label: c.type === 4 ? c.title : null,
        sortOrder: i,
      })),
    }

    setSaving(true)
    setError('')

    try {
      await updateMyPortfolioProject(project.projectId, payload)
      const d = await fetchPublicPortfolioProjectDetail(project.projectId, { withAuth: true })
      setProject(d)
      setIsModalOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проект.')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteProject() {
    if (!project || !isOwner) return
    if (!window.confirm('Удалить проект?')) return

    setDeleting(true)
    try {
      await deleteMyPortfolioProject(project.projectId)
      navigate(backHref, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить проект.')
      setDeleting(false)
    }
  }

  return (
    <>
      <TopServiceBar />
      <MainHeader />

      <main className="seeker-profile-page seeker-project-page-shell">
        <section className="card seeker-project-page">
          <div className="seeker-project-page__header">
            <Link to={backHref}>← Назад в профиль</Link>
            <h1>{titleView}</h1>

            {isOwner ? (
              <div className="seeker-project-page__actions">
                <button type="button" className="btn btn--primary" onClick={openModal}>
                  Редактировать проект
                </button>
              </div>
            ) : null}
          </div>

          {loading ? <p>Загружаем проект...</p> : null}
          {!loading && error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}

          {!loading && !error && project ? (
            <div className="seeker-project-page__layout">
              <section className="seeker-project-gallery">
                <div className="seeker-project-gallery__main">
                  {active ? (
                    <img src={active.url} alt={titleView} />
                  ) : (
                    <div className="seeker-project-gallery__empty">Нет изображений</div>
                  )}
                </div>

                {photos.length > 1 ? (
                  <div className="seeker-project-gallery__thumbs">
                    {photos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={active?.id === p.id ? 'is-active' : ''}
                        onClick={() => setActivePhotoId(p.id)}
                        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setActivePhotoId(p.id)
                          }
                        }}
                      >
                        <img src={p.url} alt={titleView} />
                      </button>
                    ))}
                  </div>
                ) : null}

                <article className="seeker-project-description">
                  <h2>Описание проекта</h2>
                  <p>{project.description || projectCard?.shortDescription || 'Описание не добавлено.'}</p>
                </article>
              </section>

              <aside className="seeker-project-sidebar">
                <article className="seeker-project-sidebar__card">
                  <h3>Автор проекта</h3>
                  <div className="portfolio-card__author seeker-project-sidebar__author">
                    <div className="portfolio-card__avatar">
                      {authorAvatarUrl ? <img src={authorAvatarUrl} alt={authorView} /> : <span>{authorFallback}</span>}
                    </div>
                    <div>
                      <strong>{authorView}</strong>
                      <span>{authorRoleView}</span>
                    </div>
                  </div>
                </article>

                <article className="seeker-project-sidebar__card">
                  <h3>Информация</h3>
                  <dl>
                    <div>
                      <dt>Начало</dt>
                      <dd>{fmtDate(project.startDate)}</dd>
                    </div>
                    <div>
                      <dt>Завершение</dt>
                      <dd>{fmtDate(project.endDate)}</dd>
                    </div>
                  </dl>
                </article>

                <article className="seeker-project-sidebar__card">
                  <h3>Коллаборации</h3>

                  {participantItems.length || userCollaborationItems.length ? (
                    <div className="seeker-project-sidebar__people">
                      {participantItems.map((item) => (
                        <div key={item.id} className="portfolio-card__author seeker-project-sidebar__author">
                          <div className="portfolio-card__avatar">
                            {item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} /> : <span>{getAvatarFallback(item.name)}</span>}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.role}</span>
                          </div>
                        </div>
                      ))}

                      {userCollaborationItems.map((item) => (
                        <div key={item.id} className="portfolio-card__author seeker-project-sidebar__author">
                          <div className="portfolio-card__avatar">
                            {item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} /> : <span>{getAvatarFallback(item.name)}</span>}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Пользователи не добавлены.</p>
                  )}

                  {vacancyCollaborationItems.length ? (
                    <ul className="seeker-project-sidebar__marks">
                      {vacancyCollaborationItems.map((item) => (
                        <li key={`vacancy-${item.id}`}>
                          <strong>Вакансия:</strong> {item.vacancyTitle || `#${item.vacancyId}`}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {opportunityCollaborationItems.length ? (
                    <ul className="seeker-project-sidebar__marks">
                      {opportunityCollaborationItems.map((item) => (
                        <li key={`opportunity-${item.id}`}>
                          <strong>Мероприятие:</strong> {item.opportunityTitle || `#${item.opportunityId}`}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </aside>
            </div>
          ) : null}
        </section>
      </main>

      {isModalOpen ? (
        <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="project-edit-modal-title">
          <button
            type="button"
            className="profile-settings-modal__backdrop"
            aria-label="Закрыть"
            onClick={() => setIsModalOpen(false)}
          />

          <section className="card profile-settings-modal__dialog seeker-project-edit-modal">
            <div className="profile-settings-modal__head">
              <h2 id="project-edit-modal-title">Редактирование проекта</h2>
            </div>

            <div className="seeker-project-edit__grid">
              <label>Название<input value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Роль<input value={role} onChange={(e) => setRole(e.target.value)} /></label>
              <label>Дата начала<DateInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>Дата завершения<DateInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              <label>Repo URL<input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} /></label><label>Demo URL<input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} /></label>
              <label className="full-width">Описание<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
              <label className="seeker-project-edit__private full-width"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />Скрыть проект из публичного профиля</label>
            </div>

            <div className="seeker-project-edit__block">
              <h3>Фото проекта</h3>

              <label className="profile-settings-modal__file-button">
                Загрузить фото
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
                  multiple
                  onChange={(e: ChangeEvent<HTMLInputElement>) => void onUploadPhotos(e)}
                />
              </label>

              <div className="seeker-project-photo-grid">
                {editPhotos.map((p) => (
                  <article key={p.id} className="seeker-project-photo-card">
                    <img src={p.url} alt={`Фото ${p.id}`} />
                    <div className="seeker-project-photo-card__actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => void onSetMainPhoto(p.id)}
                        disabled={updatingPhotos || p.isMain}
                      >
                        {p.isMain ? 'Главное' : 'Сделать главным'}
                      </button>

                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void onDeletePhoto(p.id)}
                        disabled={updatingPhotos}
                      >
                        Удалить
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="seeker-project-edit__block">
              <h3>Участники</h3>

              <div className="seeker-project-edit__row">
                <div className="seeker-suggest-field">
                  <input
                    value={pQuery}
                    onChange={(e) => {
                      setPQuery(e.target.value)
                      setSelP(null)
                    }}
                    placeholder="@username"
                  />

                  {pQuery.trim() ? (
                    <div className="seeker-suggest-dropdown">
                      {pOpts.length ? (
                        pOpts.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="seeker-suggest-dropdown__item"
                            onClick={() => {
                              setSelP({ userId: o.id, username: o.title.replace(/^@/, '') })
                              setPQuery(o.title)
                            }}
                          >
                            <span>{o.title}</span>
                            {o.subtitle ? <small>{o.subtitle}</small> : null}
                          </button>
                        ))
                      ) : (
                        <p className="seeker-suggest-dropdown__empty">Пользователи не найдены</p>
                      )}
                    </div>
                  ) : null}
                </div>

                <input value={pRole} onChange={(e) => setPRole(e.target.value)} placeholder="Роль участника" />
                <button type="button" className="btn btn--ghost" onClick={onAddParticipant}>
                  Добавить
                </button>
              </div>

              <div className="seeker-project-edit__chips">
                {participants.map((p) => (
                  <span key={p.id}>
                    @{p.username} {p.role ? `(${p.role})` : ''}
                    <button type="button" onClick={() => setParticipants((s) => s.filter((x) => x.id !== p.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="seeker-project-edit__block">
              <h3>Коллаборации</h3>

              <div className="seeker-project-edit__row seeker-project-edit__row--single">
                <div className="seeker-suggest-field">
                  <input value={vQuery} onChange={(e) => setVQuery(e.target.value)} placeholder="Поиск вакансии" />
                  {vQuery.trim() ? (
                    <div className="seeker-suggest-dropdown">
                      {vOpts.length ? (
                        vOpts.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="seeker-suggest-dropdown__item"
                            onClick={() => onAddCollab(2, o)}
                          >
                            <span>{o.title}</span>
                            {o.subtitle ? <small>{o.subtitle}</small> : null}
                          </button>
                        ))
                      ) : (
                        <p className="seeker-suggest-dropdown__empty">Вакансии не найдены</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="seeker-project-edit__row seeker-project-edit__row--single">
                <div className="seeker-suggest-field">
                  <input value={oQuery} onChange={(e) => setOQuery(e.target.value)} placeholder="Поиск мероприятия" />
                  {oQuery.trim() ? (
                    <div className="seeker-suggest-dropdown">
                      {oOpts.length ? (
                        oOpts.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="seeker-suggest-dropdown__item"
                            onClick={() => onAddCollab(3, o)}
                          >
                            <span>{o.title}</span>
                            {o.subtitle ? <small>{o.subtitle}</small> : null}
                          </button>
                        ))
                      ) : (
                        <p className="seeker-suggest-dropdown__empty">Мероприятия не найдены</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="seeker-project-edit__chips">
                {collaborations.map((c) => (
                  <span key={c.id}>
                    {c.title}
                    <button type="button" onClick={() => setCollaborations((s) => s.filter((x) => x.id !== c.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="profile-settings-modal__actions">
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void onDeleteProject()}
                disabled={saving || deleting || updatingPhotos}
              >
                {deleting ? 'Удаляем...' : 'Удалить проект'}
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={saving || deleting || updatingPhotos}
              >
                Отмена
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void onSave()}
                disabled={saving || deleting || updatingPhotos}
              >
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Footer />
    </>
  )
}
