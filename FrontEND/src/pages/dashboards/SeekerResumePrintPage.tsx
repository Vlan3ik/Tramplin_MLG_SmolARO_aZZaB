import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.svg'
import { fetchSeekerProfile, fetchSeekerResume } from '../../api/me'
import { API_ORIGIN } from '../../config/api'
import type { SeekerProfile } from '../../types/me'
import type { SeekerResume } from '../../types/resume'
import { formatSkillLevelDisplay } from '../../utils/skill-levels'
import './SeekerResumePrintPage.css'

function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return value.startsWith('/') ? `${API_ORIGIN}${value}` : `${API_ORIGIN}/${value}`
}

function formatDate(value: string) {
  if (!value) return 'не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'не указано'
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatSalary(resume: SeekerResume) {
  if (resume.salaryFrom == null && resume.salaryTo == null) {
    return 'не указана'
  }

  const formatter = new Intl.NumberFormat('ru-RU')
  const currency = resume.currencyCode || 'RUB'

  if (resume.salaryFrom != null && resume.salaryTo != null) {
    return `${formatter.format(resume.salaryFrom)} - ${formatter.format(resume.salaryTo)} ${currency}`
  }

  if (resume.salaryFrom != null) {
    return `от ${formatter.format(resume.salaryFrom)} ${currency}`
  }

  return `до ${formatter.format(resume.salaryTo ?? 0)} ${currency}`
}

export function SeekerResumePrintPage() {
  const [profile, setProfile] = useState<SeekerProfile | null>(null)
  const [resume, setResume] = useState<SeekerResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')

      const [profileResult, resumeResult] = await Promise.allSettled([
        fetchSeekerProfile(controller.signal),
        fetchSeekerResume(controller.signal),
      ])

      if (!active || controller.signal.aborted) {
        return
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value)
      } else {
        setError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Не удалось загрузить профиль.')
      }

      if (resumeResult.status === 'fulfilled') {
        setResume(resumeResult.value)
      } else {
        const message = resumeResult.reason instanceof Error ? resumeResult.reason.message : 'Не удалось загрузить резюме.'
        setError((current) => current || message)
      }

      setLoading(false)
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const avatarUrl = useMemo(() => resolveAvatarUrl(profile?.avatarUrl), [profile?.avatarUrl])
  const fullName = useMemo(
    () => [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Соискатель',
    [profile?.firstName, profile?.lastName],
  )
  const initials = useMemo(
    () => (profile?.firstName?.[0] || profile?.lastName?.[0] || 'P').toUpperCase(),
    [profile?.firstName, profile?.lastName],
  )

  return (
    <main className="resume-print-page">
      <div className="resume-print-page__toolbar no-print">
        <Link className="btn btn--ghost" to="/dashboard/seeker">
          Назад в кабинет
        </Link>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          Печать / PDF
        </button>
      </div>

      <section className="resume-print-page__sheet">
        <header className="resume-print-page__header">
          <div className="resume-print-page__brand">
            <img src={logo} alt="Tramplin" className="resume-print-page__logo" />
            <div>
              <p className="resume-print-page__eyebrow">Резюме соискателя</p>
              <h1>{fullName}</h1>
              <p>{profile?.username ? `@${profile.username}` : 'Публичный профиль'}</p>
            </div>
          </div>
          <div className="resume-print-page__header-actions no-print">
            <button type="button" className="btn btn--primary" onClick={() => window.print()}>
              Скачать через печать
            </button>
          </div>
        </header>

        {loading ? <p className="resume-print-page__state">Подготавливаем печатную версию...</p> : null}
        {error ? <p className="resume-print-page__state resume-print-page__state--error">{error}</p> : null}

        {!loading && resume ? (
          <>
            <section className="resume-print-page__hero">
              <div className="resume-print-page__avatar">
                {avatarUrl ? <img src={avatarUrl} alt={fullName} /> : <span>{initials}</span>}
              </div>
              <div className="resume-print-page__hero-content">
                <h2>{resume.headline || resume.desiredPosition || 'Резюме без заголовка'}</h2>
                <p className="resume-print-page__position">{resume.desiredPosition || 'Желаемая должность не указана'}</p>
                <p className="resume-print-page__summary">{resume.summary || 'Описание профиля не заполнено.'}</p>
              </div>
            </section>

            <section className="resume-print-page__grid">
              <article className="resume-print-card">
                <h3>Профиль</h3>
                <p><strong>Имя:</strong> {fullName}</p>
                <p><strong>Логин:</strong> {profile?.username || 'не указан'}</p>
                <p><strong>Телефон:</strong> {profile?.phone || 'не указан'}</p>
                <p><strong>О себе:</strong> {profile?.about || 'не заполнено'}</p>
              </article>

              <article className="resume-print-card">
                <h3>Условия</h3>
                <p><strong>Желаемая должность:</strong> {resume.desiredPosition || 'не указана'}</p>
                <p><strong>Ожидаемая зарплата:</strong> {formatSalary(resume)}</p>
                <p><strong>Валюта:</strong> {resume.currencyCode || 'RUB'}</p>
              </article>

              <article className="resume-print-card resume-print-card--wide">
                <h3>Навыки</h3>
                {resume.skills.length ? (
                  <ul className="resume-print-list">
                    {resume.skills.map((skill) => (
                      <li key={skill.tagId}>
                        <strong>{skill.tagName}</strong>
                        <span>{formatSkillLevelDisplay(skill.level)}, {skill.yearsExperience} лет опыта</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Навыки не добавлены.</p>
                )}
              </article>

              <article className="resume-print-card resume-print-card--wide">
                <h3>Опыт работы</h3>
                {resume.experiences.length ? (
                  <div className="resume-print-stack">
                    {resume.experiences.map((experience) => (
                      <div key={experience.id} className="resume-print-stack__item">
                        <div className="resume-print-stack__head">
                          <strong>{experience.position}</strong>
                          <span>{experience.companyName}</span>
                        </div>
                        {experience.description ? <p>{experience.description}</p> : null}
                        <p className="resume-print-page__muted">
                          {formatDate(experience.startDate)} - {experience.isCurrent ? 'по настоящее время' : experience.endDate ? formatDate(experience.endDate) : 'не указано'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Опыт работы не добавлен.</p>
                )}
              </article>

              <article className="resume-print-card resume-print-card--wide">
                <h3>Проекты</h3>
                {resume.projects.length ? (
                  <div className="resume-print-stack">
                    {resume.projects.map((project) => (
                      <div key={project.id} className="resume-print-stack__item">
                        <div className="resume-print-stack__head">
                          <strong>{project.title}</strong>
                          <span>{project.role || 'роль не указана'}</span>
                        </div>
                        <p>{project.description || 'Описание проекта не заполнено.'}</p>
                        <p className="resume-print-page__muted">
                          {formatDate(project.startDate)} - {project.endDate ? formatDate(project.endDate) : 'по настоящее время'}
                        </p>
                        <div className="resume-print-links">
                          {project.repoUrl ? <a href={project.repoUrl} target="_blank" rel="noreferrer">Repository</a> : null}
                          {project.demoUrl ? <a href={project.demoUrl} target="_blank" rel="noreferrer">Demo</a> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Проекты не добавлены.</p>
                )}
              </article>

              <article className="resume-print-card">
                <h3>Образование</h3>
                {resume.education.length ? (
                  <div className="resume-print-stack">
                    {resume.education.map((education) => (
                      <div key={education.id} className="resume-print-stack__item">
                        <strong>{education.university}</strong>
                        <p>{education.faculty || 'факультет не указан'}</p>
                        <p>{education.specialty || 'специальность не указана'}</p>
                        <p className="resume-print-page__muted">
                          Курс {education.course || '?'} , выпуск {education.graduationYear || '?'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Образование не добавлено.</p>
                )}
              </article>

              <article className="resume-print-card">
                <h3>Ссылки</h3>
                {resume.links.length ? (
                  <ul className="resume-print-list resume-print-list--links">
                    {resume.links.map((link) => (
                      <li key={link.id}>
                        <strong>{link.label || link.kind}</strong>
                        <a href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Ссылки не добавлены.</p>
                )}
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}
