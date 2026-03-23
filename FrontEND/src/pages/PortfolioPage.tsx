import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicPortfolioProjectDetail, fetchPublicPortfolioProjects } from '../api/portfolio'
import { fetchPublicProfileByUsername } from '../api/profiles'
import type { PublicPortfolioProjectCard, PublicPortfolioProjectDetail } from '../types/portfolio'
import type { PublicProfile } from '../types/public-profile'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
})()

function resolveMediaUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  return value.startsWith('/') ? `${API_ORIGIN}${value}` : `${API_ORIGIN}/${value}`
}

function formatSalary(from: number | null, to: number | null, currencyCode: string | null) {
  if (from == null && to == null) {
    return 'Зарплата не указана'
  }

  const currency = currencyCode || 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

  if (from != null && to != null) {
    return `${formatter.format(from)} - ${formatter.format(to)} ${currency}`
  }

  if (from != null) {
    return `от ${formatter.format(from)} ${currency}`
  }

  return `до ${formatter.format(to ?? 0)} ${currency}`
}

function buildDisplayName(profile: PublicProfile | null, username: string) {
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
  return fullName || profile?.username || username || 'Портфолио'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return date.toLocaleDateString('ru-RU')
}

export function PortfolioPage() {
  const { username = '' } = useParams<{ username?: string }>()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [projects, setProjects] = useState<PublicPortfolioProjectCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false)
  const [projectDetailsError, setProjectDetailsError] = useState('')
  const [activeProject, setActiveProject] = useState<PublicPortfolioProjectDetail | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const [profileResult, projectsResult] = await Promise.allSettled([
        fetchPublicProfileByUsername(username, controller.signal),
        fetchPublicPortfolioProjects(username, controller.signal),
      ])

      if (!active || controller.signal.aborted) {
        return
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value)
      } else {
        setProfile(null)
      }

      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value)
      } else {
        setProjects([])
        setError(projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Не удалось загрузить проекты.')
      }

      if (profileResult.status === 'rejected' && projectsResult.status === 'rejected') {
        setError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Не удалось загрузить портфолио.')
      }

      setLoading(false)
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [username])

  const displayName = useMemo(() => buildDisplayName(profile, username), [profile, username])
  const avatarUrl = useMemo(() => resolveMediaUrl(profile?.avatarUrl), [profile?.avatarUrl])
  const headline = profile?.resume?.headline || profile?.resume?.desiredPosition || 'Портфолио без заголовка'
  const summary = profile?.resume?.summary || profile?.about || 'Описание профиля не заполнено.'
  const salary = profile?.resume ? formatSalary(profile.resume.salaryFrom, profile.resume.salaryTo, profile.resume.currencyCode) : null
  const initials = useMemo(() => (displayName?.[0] || username?.[0] || 'P').toUpperCase(), [displayName, username])
  const isProfileHidden = useMemo(
    () => profile?.visibilityMode === 'hidden' || profile?.resume == null,
    [profile?.resume, profile?.visibilityMode],
  )
  const visibleProjects = projects

  function closeProjectModal() {
    setIsProjectModalOpen(false)
    setProjectDetailsError('')
    setActiveProject(null)
  }

  async function openProjectModal(projectId: number) {
    setIsProjectModalOpen(true)
    setProjectDetailsLoading(true)
    setProjectDetailsError('')
    setActiveProject(null)

    try {
      const project = await fetchPublicPortfolioProjectDetail(projectId)
      setActiveProject(project)
    } catch (detailsError) {
      setProjectDetailsError(detailsError instanceof Error ? detailsError.message : 'Не удалось загрузить детали проекта.')
    } finally {
      setProjectDetailsLoading(false)
    }
  }

  return (
    <section className="container portfolio-page">
      <div className="portfolio-page__breadcrumbs">
        <Link className="btn btn--ghost" to="/resumes">
          К списку резюме
        </Link>
        <span className="portfolio-page__handle">@{username || 'unknown'}</span>
      </div>

      <article className="card portfolio-page__hero">
        <div className="portfolio-page__avatar">
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initials}</span>}
        </div>
        <div className="portfolio-page__meta">
          <p className="portfolio-page__eyebrow">Публичное портфолио</p>
          <h1>{displayName}</h1>
          <p className="portfolio-page__headline">{headline}</p>
          <p className="portfolio-page__summary">{summary}</p>
          <div className="portfolio-page__stats">
            <span className="status-chip">Проектов: {visibleProjects.length}</span>
            {profile?.stats ? <span className="status-chip">Откликов: {profile.stats.applicationsTotal}</span> : null}
            {profile?.visibilityMode ? <span className="status-chip">Профиль: {profile.visibilityMode}</span> : null}
          </div>
        </div>
        <div className="portfolio-page__aside">
          {salary ? (
            <div className="portfolio-page__salary">
              <span>Ожидания</span>
              <strong>{salary}</strong>
            </div>
          ) : null}
          <div className="portfolio-page__links">
            {profile?.resume?.projects.length ? (
              <span className="status-chip">Проекты из резюме: {profile.resume.projects.length}</span>
            ) : null}
          </div>
        </div>
      </article>

      {loading ? <div className="state-card">Загружаем портфолио...</div> : null}
      {error ? <div className="state-card state-card--error">{error}</div> : null}
      {!loading && isProfileHidden ? <div className="state-card">Этот профиль скрыт владельцем и недоступен в публичном списке.</div> : null}

      {!loading && !isProfileHidden && !visibleProjects.length ? (
        <div className="state-card">Проекты пока не добавлены.</div>
      ) : null}

      {!isProfileHidden && visibleProjects.length ? (
        <div className="portfolio-page__grid">
          {visibleProjects.map((project) => (
            <article
              className="card portfolio-page__card"
              key={project.projectId}
              role="button"
              tabIndex={0}
              onClick={() => void openProjectModal(project.projectId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void openProjectModal(project.projectId)
                }
              }}
            >
              <div className="portfolio-page__card-media">
                {project.mainPhotoUrl ? <img src={resolveMediaUrl(project.mainPhotoUrl) ?? undefined} alt={project.title} /> : <span>{project.title.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="portfolio-page__card-body">
                <p className="portfolio-page__card-label">Проект</p>
                <h3>{project.title}</h3>
                <p className="portfolio-page__card-role">{project.primaryRole || 'Роль не указана'}</p>
                <p>{project.shortDescription || 'Описание не заполнено.'}</p>
                <p className="portfolio-page__card-author">{project.authorFio}</p>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {isProjectModalOpen ? (
        <div className="resumes-projects-modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-project-modal-title">
          <div className="resumes-projects-modal__backdrop" onClick={closeProjectModal} />
          <div className="card resumes-projects-modal__dialog">
            <div className="resumes-projects-modal__head">
              <div>
                <h2 id="portfolio-project-modal-title">{activeProject?.title || 'Проект портфолио'}</h2>
                <p>@{username}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={closeProjectModal}>
                Закрыть
              </button>
            </div>

            {projectDetailsLoading ? <p>Загружаем проект...</p> : null}
            {projectDetailsError ? <p className="state-card state-card--error">{projectDetailsError}</p> : null}

            {!projectDetailsLoading && !projectDetailsError && activeProject ? (
              <article className="resumes-projects-modal__detail">
                <p>{activeProject.description || 'Описание не заполнено.'}</p>
                <p>
                  {formatDate(activeProject.startDate)} - {activeProject.endDate ? formatDate(activeProject.endDate) : 'по настоящее время'}
                </p>
                <div className="resumes-projects-modal__links">
                  {activeProject.repoUrl ? (
                    <a href={activeProject.repoUrl} target="_blank" rel="noreferrer">
                      Репозиторий
                    </a>
                  ) : null}
                  {activeProject.demoUrl ? (
                    <a href={activeProject.demoUrl} target="_blank" rel="noreferrer">
                      Демо
                    </a>
                  ) : null}
                </div>
                <div className="resumes-projects-modal__photos">
                  {activeProject.photos.length ? (
                    activeProject.photos.map((photo) => (
                      <figure key={photo.id}>
                        <img src={resolveMediaUrl(photo.url) ?? undefined} alt={activeProject.title} />
                      </figure>
                    ))
                  ) : (
                    <p>Фото не добавлены.</p>
                  )}
                </div>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
