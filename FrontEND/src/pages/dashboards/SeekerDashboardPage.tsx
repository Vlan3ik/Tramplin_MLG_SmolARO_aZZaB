
import { CalendarClock, MapPin, Phone, Settings2, UploadCloud, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createApplication } from '../../api/applications'
import { fetchTags } from '../../api/catalog'
import { fetchSeekerProfile, fetchSeekerResume, updateSeekerProfile, updateSeekerResume } from '../../api/me'
import { uploadMyAvatar } from '../../api/media'
import { fetchOpportunityById, fetchOpportunityDetailById } from '../../api/opportunities'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { useApplications } from '../../hooks/useApplications'
import { useAuth } from '../../hooks/useAuth'
import type { TagListItem } from '../../types/catalog'
import type { SeekerProfile } from '../../types/me'
import type { Opportunity } from '../../types/opportunity'
import type { SeekerResume } from '../../types/resume'
import { getFavoriteOpportunityIds, subscribeToFavoriteOpportunities } from '../../utils/favorites'

type TabId = 'responses' | 'favorites' | 'resume'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'responses', label: 'Отклики' },
  { id: 'favorites', label: 'Избранное' },
  { id: 'resume', label: 'Резюме' },
]

const resumeSteps = ['Основная информация', 'Скиллы', 'Портфолио', 'Образование', 'Ссылки на соцсети']

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
})()

const initialResume = (userId = 0): SeekerResume => ({
  userId,
  headline: '',
  desiredPosition: '',
  summary: '',
  salaryFrom: null,
  salaryTo: null,
  currencyCode: 'RUB',
  skills: [],
  projects: [],
  education: [],
  links: [],
})

const initialProject = {
  title: '',
  role: '',
  description: '',
  startDate: '',
  endDate: '',
  repoUrl: '',
  demoUrl: '',
}

const initialEducation = {
  university: '',
  faculty: '',
  specialty: '',
  course: '',
  graduationYear: '',
}

const initialLink = {
  kind: 'github',
  url: '',
  label: '',
}

function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return value.startsWith('/') ? `${API_ORIGIN}${value}` : `${API_ORIGIN}/${value}`
}

function formatPhone(rawValue: string) {
  let digits = rawValue.replace(/\D/g, '')
  if (!digits) return ''
  if (digits[0] === '8') digits = `7${digits.slice(1)}`
  if (digits[0] !== '7') digits = `7${digits}`
  digits = digits.slice(0, 11)
  const code = digits.slice(1, 4)
  const p1 = digits.slice(4, 7)
  const p2 = digits.slice(7, 9)
  const p3 = digits.slice(9, 11)
  return `+7${code ? ` (${code}` : ''}${code.length === 3 ? ')' : ''}${p1 ? ` ${p1}` : ''}${p2 ? `-${p2}` : ''}${p3 ? `-${p3}` : ''}`
}

function toNullable(value: string) {
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('aborted') || message.includes('aborterror') || message.includes('signal is aborted')
  }

  return false
}

function storageKey(userId: number) {
  return `tramplin.resume.extended.${userId}`
}

function saveResumeLocal(resume: SeekerResume) {
  if (typeof window === 'undefined' || !resume.userId) return
  window.localStorage.setItem(storageKey(resume.userId), JSON.stringify(resume))
}

function loadResumeLocal(userId: number) {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SeekerResume
  } catch {
    window.localStorage.removeItem(storageKey(userId))
    return null
  }
}

export function SeekerDashboardPage() {
  const { session, signIn } = useAuth()
  const { applications, hasApplied, addApplication } = useApplications()
  const [tab, setTab] = useState<TabId>('responses')
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<SeekerProfile | null>(null)
  const [resume, setResume] = useState<SeekerResume>(initialResume())
  const [tags, setTags] = useState<TagListItem[]>([])
  const [favoriteOpportunities, setFavoriteOpportunities] = useState<Opportunity[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => getFavoriteOpportunityIds())
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})

  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', middleName: '', phone: '', avatarUrl: '' })
  const [projectForm, setProjectForm] = useState(initialProject)
  const [educationForm, setEducationForm] = useState(initialEducation)
  const [linkForm, setLinkForm] = useState(initialLink)
  const [skillTagId, setSkillTagId] = useState<number | null>(null)
  const [skillLevel, setSkillLevel] = useState('3')
  const [skillYears, setSkillYears] = useState('1')

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingResume, setLoadingResume] = useState(true)
  const [loadingFavorites, setLoadingFavorites] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingResume, setSavingResume] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [profileError, setProfileError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [favoritesError, setFavoritesError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!session?.accessToken) {
      setLoadingProfile(false)
      setLoadingResume(false)
      setProfileError('Не удалось получить токен авторизации.')
      return
    }

    const controller = new AbortController()

    async function loadData() {
      setProfileError('')
      setResumeError('')
      setLoadingProfile(true)
      setLoadingResume(true)

      const [profileResult, resumeResult, tagsResult] = await Promise.allSettled([
        fetchSeekerProfile(controller.signal),
        fetchSeekerResume(controller.signal),
        fetchTags(controller.signal),
      ])

      if (controller.signal.aborted) {
        return
      }

      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value
        setProfile(p)
        setProfileForm({
          firstName: p.firstName,
          lastName: p.lastName,
          middleName: p.middleName ?? '',
          phone: p.phone ? formatPhone(p.phone) : '',
          avatarUrl: p.avatarUrl ?? '',
        })

      } else if (!isAbortError(profileResult.reason)) {
        setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Ошибка загрузки профиля.')
      }

      if (resumeResult.status === 'fulfilled') {
        const apiResume = resumeResult.value
        const local = loadResumeLocal(apiResume.userId)
        setResume(
          local
            ? {
                ...apiResume,
                headline: apiResume.headline || local.headline,
                desiredPosition: apiResume.desiredPosition || local.desiredPosition,
                summary: apiResume.summary || local.summary,
                salaryFrom: apiResume.salaryFrom ?? local.salaryFrom,
                salaryTo: apiResume.salaryTo ?? local.salaryTo,
                currencyCode: apiResume.currencyCode || local.currencyCode,
                skills: apiResume.skills.length ? apiResume.skills : local.skills,
                projects: apiResume.projects.length ? apiResume.projects : local.projects,
                education: apiResume.education.length ? apiResume.education : local.education,
                links: apiResume.links.length ? apiResume.links : local.links,
              }
            : apiResume,
        )
      } else if (!isAbortError(resumeResult.reason)) {
        setResumeError(resumeResult.reason instanceof Error ? resumeResult.reason.message : 'Ошибка загрузки резюме.')
      }

      if (tagsResult.status === 'fulfilled') {
        setTags(tagsResult.value)
      }

      if (!controller.signal.aborted) {
        setLoadingProfile(false)
        setLoadingResume(false)
      }
    }

    void loadData()

    return () => controller.abort()
  }, [session?.accessToken, session?.user?.username])

  useEffect(() => {
    saveResumeLocal(resume)
  }, [resume])

  useEffect(() => {
    const unsubscribe = subscribeToFavoriteOpportunities(() => {
      setFavoriteIds(getFavoriteOpportunityIds())
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadFavorites() {
      setLoadingFavorites(true)
      setFavoritesError('')

      if (!favoriteIds.length) {
        setFavoriteOpportunities([])
        setLoadingFavorites(false)
        return
      }

      const results = await Promise.allSettled(favoriteIds.map((id) => fetchOpportunityById(id, controller.signal)))

      if (controller.signal.aborted) {
        return
      }

      const resolved = results
        .filter((result): result is PromiseFulfilledResult<Opportunity> => result.status === 'fulfilled')
        .map((result) => result.value)

      setFavoriteOpportunities(resolved)

      if (!resolved.length && favoriteIds.length) {
        setFavoritesError('Не удалось загрузить избранные вакансии.')
      }

      setLoadingFavorites(false)
    }

    void loadFavorites()

    return () => controller.abort()
  }, [favoriteIds])

  const avatarUrl = useMemo(() => resolveAvatarUrl(profile?.avatarUrl), [profile?.avatarUrl])
  const avatarFormUrl = useMemo(() => resolveAvatarUrl(profileForm.avatarUrl), [profileForm.avatarUrl])
  const displayName = useMemo(() => [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Профиль соискателя', [profile])
  const avatarFallback = useMemo(() => (profile?.firstName?.charAt(0) || profile?.lastName?.charAt(0) || 'P').toUpperCase(), [profile])

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile?.firstName),
      Boolean(profile?.lastName),
      Boolean(profile?.phone),
      Boolean(profile?.avatarUrl),
      Boolean(resume.headline),
      Boolean(resume.desiredPosition),
      Boolean(resume.summary),
      resume.skills.length > 0,
      resume.projects.length > 0,
      resume.education.length > 0,
      resume.links.length > 0,
    ]
    const done = checks.filter(Boolean).length
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) }
  }, [profile, resume])

  const responsesStats = useMemo(
    () => ({
      total: applications.length,
      success: applications.filter((item) => item.tone === 'success').length,
      warning: applications.filter((item) => item.tone === 'warning').length,
      danger: applications.filter((item) => item.tone === 'danger').length,
    }),
    [applications],
  )

  async function onApplyFromFavorites(opportunityId: number) {
    if (!session?.accessToken || !session.user?.id) {
      setProfileError('Для отклика нужно войти как соискатель.')
      return
    }

    if (hasApplied(opportunityId)) {
      setSuccess('Вы уже откликались на эту вакансию.')
      return
    }

    setApplyingIds((current) => ({
      ...current,
      [opportunityId]: true,
    }))

    try {
      const detail = await fetchOpportunityDetailById(opportunityId)

      if (!detail.companyId) {
        throw new Error('У вакансии не указан идентификатор компании.')
      }

      await createApplication({
        companyId: detail.companyId,
        candidateUserId: session.user.id,
        opportunityId: detail.id,
        initiatorRole: 1,
      })

      addApplication({
        id: detail.id,
        title: detail.title,
        company: detail.company,
        location: detail.location,
      })

      setSuccess('Отклик отправлен.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось отправить отклик.')
    } finally {
      setApplyingIds((current) => {
        const next = { ...current }
        delete next[opportunityId]
        return next
      })
    }
  }

  async function onProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (typeof session?.accessToken !== 'string' || !session.accessToken) return
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileError('Заполните имя и фамилию.')
      return
    }

    setSavingProfile(true)
    setProfileError('')

    try {
      const payload = {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        middleName: toNullable(profileForm.middleName),
        phone: toNullable(profileForm.phone),
        about: toNullable(profile?.about ?? ''),
        avatarUrl: toNullable(profileForm.avatarUrl),
      }
      const updated = await updateSeekerProfile(payload)
      setProfile(updated)
      setSuccess('Профиль сохранен.')
      setIsSettingsOpen(false)
      if (session.user) {
        const username = updated.username || session.user.username
        signIn({ ...session, user: { ...session.user, username, avatarUrl: updated.avatarUrl } })
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file || typeof session?.accessToken !== 'string' || !session.accessToken) return

    setUploadingAvatar(true)
    setProfileError('')

    try {
      const response = await uploadMyAvatar(file)
      setProfileForm((state) => ({ ...state, avatarUrl: response.url }))
      setProfile((current) => (current ? { ...current, avatarUrl: response.url } : current))
      setSuccess('Аватарка загружена.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось загрузить аватарку.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onResumeStepAction() {
    if (step === 0 && (!resume.headline.trim() || !resume.desiredPosition.trim() || !resume.summary.trim())) {
      setResumeError('Заполните базовую информацию резюме.')
      return
    }
    setResumeError('')
    if (step < resumeSteps.length - 1) {
      setStep((value) => value + 1)
      return
    }

    if (typeof session?.accessToken !== 'string' || !session.accessToken) return

    setSavingResume(true)

    try {
      const response = await updateSeekerResume(resume)
      setResume((state) => ({
        ...state,
        userId: response.userId,
        headline: response.headline ?? state.headline,
        desiredPosition: response.desiredPosition ?? state.desiredPosition,
        summary: response.summary ?? state.summary,
        salaryFrom: response.salaryFrom ?? state.salaryFrom,
        salaryTo: response.salaryTo ?? state.salaryTo,
        currencyCode: response.currencyCode ?? state.currencyCode,
      }))
      setSuccess('Резюме сохранено.')
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Не удалось сохранить резюме.')
    } finally {
      setSavingResume(false)
    }
  }

  return (
    <div className="app-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <section className="container seeker-profile-page">
          <header className="card seeker-profile-hero">
            <div className="seeker-profile-hero__avatar">{avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{avatarFallback}</span>}</div>
            <div className="seeker-profile-hero__content">
              <h1>{displayName}</h1>
              <p>Личный кабинет соискателя: профиль, отклики и резюме.</p>
              <div className="profile-completion">
                <div className="profile-completion__head">
                  <strong>Заполнение профиля: {completion.percent}%</strong>
                  <span>{completion.done}/{completion.total}</span>
                </div>
                <div className="profile-completion__track"><span style={{ width: `${completion.percent}%` }} /></div>
              </div>
              <div className="seeker-profile-hero__meta">
                <span><Phone size={14} />{profile?.phone ? formatPhone(profile.phone) : 'Телефон не указан'}</span>
              </div>
            </div>
            <div className="seeker-profile-hero__actions">
              <button type="button" className="btn btn--primary" onClick={() => setIsSettingsOpen(true)} disabled={!profile || loadingProfile}>
                <Settings2 size={16} />Редактировать профиль
              </button>
            </div>
          </header>

          {success ? <div className="auth-feedback seeker-profile-feedback">{success}</div> : null}
          {profileError ? <div className="auth-feedback auth-feedback--error">{profileError}</div> : null}

          {loadingProfile ? (
            <section className="card seeker-profile-state"><p>Загружаем профиль...</p></section>
          ) : (
            <>
              <nav className="card seeker-profile-tabs">
                {tabs.map((item) => (
                  <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
                ))}
              </nav>

              {tab === 'responses' ? (
                <section className="card seeker-profile-panel">
                  <h2>Мои отклики</h2>
                  <div className="application-stats">
                    <article><strong>{responsesStats.total}</strong><span>Всего откликов</span></article>
                    <article><strong>{responsesStats.success}</strong><span>Есть интервью</span></article>
                    <article><strong>{responsesStats.warning}</strong><span>На рассмотрении</span></article>
                    <article><strong>{responsesStats.danger}</strong><span>Нужны правки</span></article>
                  </div>
                  {!applications.length ? <p>Вы еще не отправляли отклики.</p> : null}
                  {applications.length ? (
                    <div className="application-list">
                      {applications.map((item) => (
                        <article key={item.id} className="application-card">
                          <div className="application-card__top">
                            <div><h3>{item.title}</h3><p>{item.company}</p></div>
                            <span className={`status-chip status-chip--${item.tone}`}>{item.status}</span>
                          </div>
                          <div className="application-card__meta">
                            <span><MapPin size={14} />{item.location}</span>
                            <span><CalendarClock size={14} />Отклик: {item.date}</span>
                          </div>
                          <p className="application-card__next">Следующий шаг: {item.next}</p>
                          <p>{item.note}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {tab === 'favorites' ? (
                <section className="card seeker-profile-panel">
                  <h2>Избранное</h2>
                  {loadingFavorites ? <p>Загружаем избранные вакансии...</p> : null}
                  {favoritesError ? <div className="auth-feedback auth-feedback--error">{favoritesError}</div> : null}
                  {!loadingFavorites && !favoriteOpportunities.length ? (
                    <p>В избранном пока пусто. Добавьте вакансии с главной страницы.</p>
                  ) : null}
                  {!loadingFavorites && favoriteOpportunities.length ? (
                    <div className="favorite-list">
                      {favoriteOpportunities.map((item) => (
                        <article key={item.id} className="favorite-card">
                          <div className="favorite-card__head">
                            <div>
                              <h3>{item.title}</h3>
                              <p>{item.company}</p>
                            </div>
                            <span className="favorite-card__salary">{item.compensation}</span>
                          </div>
                          <div className="favorite-card__meta">
                            <span>{item.location}</span>
                            <span>{item.workFormat}</span>
                          </div>
                          <p>{item.description}</p>
                          <div className="favorite-card__actions">
                            <Link className="btn btn--ghost" to={`/opportunity/${item.id}`}>
                              Подробнее
                            </Link>
                            <button type="button" className="btn btn--primary" disabled={Boolean(applyingIds[item.id]) || hasApplied(item.id)} onClick={() => void onApplyFromFavorites(item.id)}>
                              {applyingIds[item.id] ? 'Отправляем...' : hasApplied(item.id) ? 'Отклик отправлен' : 'Откликнуться'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {tab === 'resume' ? (
                <section className="card seeker-profile-panel seeker-profile-panel--resume">
                  <h2>Резюме</h2>
                  {loadingResume ? <p>Загружаем резюме...</p> : null}
                  {!loadingResume ? (
                    <>
                      <div className="resume-stepper">
                        {resumeSteps.map((label, index) => (
                          <button key={label} type="button" className={step === index ? 'is-active' : ''} onClick={() => setStep(index)}>
                            <span>{index + 1}</span>{label}
                          </button>
                        ))}
                      </div>

                      <div className="resume-step-form">
                        {step === 0 ? (
                          <div className="form-grid form-grid--two">
                            <label>Заголовок<input value={resume.headline} onChange={(e) => setResume((s) => ({ ...s, headline: e.target.value }))} /></label>
                            <label>Желаемая позиция<input value={resume.desiredPosition} onChange={(e) => setResume((s) => ({ ...s, desiredPosition: e.target.value }))} /></label>
                            <label>Зарплата от<input type="number" value={resume.salaryFrom ?? ''} onChange={(e) => setResume((s) => ({ ...s, salaryFrom: e.target.value ? Number(e.target.value) : null }))} /></label>
                            <label>Зарплата до<input type="number" value={resume.salaryTo ?? ''} onChange={(e) => setResume((s) => ({ ...s, salaryTo: e.target.value ? Number(e.target.value) : null }))} /></label>
                            <label>Валюта<input value={resume.currencyCode} onChange={(e) => setResume((s) => ({ ...s, currencyCode: e.target.value.toUpperCase() }))} /></label>
                            <label className="full-width">Описание<textarea rows={4} value={resume.summary} onChange={(e) => setResume((s) => ({ ...s, summary: e.target.value }))} /></label>
                          </div>
                        ) : null}

                        {step === 1 ? (
                          <div className="resume-step-body">
                            <div className="form-grid form-grid--two">
                              <label>Скилл<select value={skillTagId ?? ''} onChange={(e) => setSkillTagId(e.target.value ? Number(e.target.value) : null)}><option value="">Выберите скилл</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
                              <label>Уровень<input type="number" min={1} max={5} value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} /></label>
                              <label>Опыт (лет)<input type="number" min={0} max={50} value={skillYears} onChange={(e) => setSkillYears(e.target.value)} /></label>
                            </div>
                            <button type="button" className="btn btn--ghost" onClick={() => {
                              if (!skillTagId) return
                              const tag = tags.find((x) => x.id === skillTagId)
                              if (!tag || resume.skills.some((x) => x.tagId === skillTagId)) return
                              setResume((s) => ({ ...s, skills: [...s.skills, { tagId: tag.id, tagName: tag.name, level: Number(skillLevel) || 0, yearsExperience: Number(skillYears) || 0 }] }))
                              setSkillTagId(null)
                            }}>Добавить скилл</button>
                            <div className="resume-collection">{resume.skills.length ? resume.skills.map((skill) => <article key={skill.tagId} className="resume-collection-card"><div><strong>{skill.tagName}</strong><p>Уровень {skill.level}/5, опыт {skill.yearsExperience} лет</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, skills: s.skills.filter((x) => x.tagId !== skill.tagId) }))}>Удалить</button></article>) : <p>Скиллы пока не добавлены.</p>}</div>
                          </div>
                        ) : null}

                        {step === 2 ? (
                          <div className="resume-step-body">
                            <div className="form-grid form-grid--two">
                              <label>Название проекта<input value={projectForm.title} onChange={(e) => setProjectForm((s) => ({ ...s, title: e.target.value }))} /></label>
                              <label>Роль<input value={projectForm.role} onChange={(e) => setProjectForm((s) => ({ ...s, role: e.target.value }))} /></label>
                              <label>Дата начала<input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm((s) => ({ ...s, startDate: e.target.value }))} /></label>
                              <label>Дата окончания<input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm((s) => ({ ...s, endDate: e.target.value }))} /></label>
                              <label>Repo URL<input value={projectForm.repoUrl} onChange={(e) => setProjectForm((s) => ({ ...s, repoUrl: e.target.value }))} /></label>
                              <label>Demo URL<input value={projectForm.demoUrl} onChange={(e) => setProjectForm((s) => ({ ...s, demoUrl: e.target.value }))} /></label>
                              <label className="full-width">Описание<textarea rows={3} value={projectForm.description} onChange={(e) => setProjectForm((s) => ({ ...s, description: e.target.value }))} /></label>
                            </div>
                            <button type="button" className="btn btn--ghost" onClick={() => {
                              if (!projectForm.title.trim() || !projectForm.role.trim()) return
                              setResume((s) => ({ ...s, projects: [...s.projects, { id: Date.now(), ...projectForm, title: projectForm.title.trim(), role: projectForm.role.trim(), description: projectForm.description.trim(), repoUrl: normalizeUrl(projectForm.repoUrl), demoUrl: normalizeUrl(projectForm.demoUrl) }] }))
                              setProjectForm(initialProject)
                            }}>Добавить проект</button>
                            <div className="resume-collection">{resume.projects.length ? resume.projects.map((project) => <article key={project.id} className="resume-collection-card"><div><strong>{project.title}</strong><p>{project.role}</p><p>{project.description}</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, projects: s.projects.filter((x) => x.id !== project.id) }))}>Удалить</button></article>) : <p>Проекты пока не добавлены.</p>}</div>
                          </div>
                        ) : null}

                        {step === 3 ? (
                          <div className="resume-step-body">
                            <div className="form-grid form-grid--two">
                              <label>ВУЗ<input value={educationForm.university} onChange={(e) => setEducationForm((s) => ({ ...s, university: e.target.value }))} /></label>
                              <label>Факультет<input value={educationForm.faculty} onChange={(e) => setEducationForm((s) => ({ ...s, faculty: e.target.value }))} /></label>
                              <label>Специальность<input value={educationForm.specialty} onChange={(e) => setEducationForm((s) => ({ ...s, specialty: e.target.value }))} /></label>
                              <label>Курс<input type="number" min={1} max={7} value={educationForm.course} onChange={(e) => setEducationForm((s) => ({ ...s, course: e.target.value }))} /></label>
                              <label>Год выпуска<input type="number" min={2000} max={2100} value={educationForm.graduationYear} onChange={(e) => setEducationForm((s) => ({ ...s, graduationYear: e.target.value }))} /></label>
                            </div>
                            <button type="button" className="btn btn--ghost" onClick={() => {
                              if (!educationForm.university.trim() || !educationForm.specialty.trim()) return
                              setResume((s) => ({ ...s, education: [...s.education, { id: Date.now(), university: educationForm.university.trim(), faculty: educationForm.faculty.trim(), specialty: educationForm.specialty.trim(), course: Number(educationForm.course) || 0, graduationYear: Number(educationForm.graduationYear) || 0 }] }))
                              setEducationForm(initialEducation)
                            }}>Добавить образование</button>
                            <div className="resume-collection">{resume.education.length ? resume.education.map((edu) => <article key={edu.id} className="resume-collection-card"><div><strong>{edu.university}</strong><p>{edu.specialty}</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, education: s.education.filter((x) => x.id !== edu.id) }))}>Удалить</button></article>) : <p>Образование пока не добавлено.</p>}</div>
                          </div>
                        ) : null}

                        {step === 4 ? (
                          <div className="resume-step-body">
                            <div className="form-grid form-grid--two">
                              <label>Тип<select value={linkForm.kind} onChange={(e) => setLinkForm((s) => ({ ...s, kind: e.target.value }))}><option value="github">GitHub</option><option value="linkedin">LinkedIn</option><option value="telegram">Telegram</option><option value="portfolio">Portfolio</option><option value="other">Другое</option></select></label>
                              <label>URL<input value={linkForm.url} onChange={(e) => setLinkForm((s) => ({ ...s, url: e.target.value }))} /></label>
                              <label>Подпись<input value={linkForm.label} onChange={(e) => setLinkForm((s) => ({ ...s, label: e.target.value }))} /></label>
                            </div>
                            <button type="button" className="btn btn--ghost" onClick={() => {
                              if (!linkForm.url.trim()) return
                              setResume((s) => ({ ...s, links: [...s.links, { id: Date.now(), kind: linkForm.kind.trim(), label: linkForm.label.trim(), url: normalizeUrl(linkForm.url) }] }))
                              setLinkForm(initialLink)
                            }}>Добавить ссылку</button>
                            <div className="resume-collection">{resume.links.length ? resume.links.map((link) => <article key={link.id} className="resume-collection-card"><div><strong>{link.label || link.kind}</strong><p>{link.url}</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, links: s.links.filter((x) => x.id !== link.id) }))}>Удалить</button></article>) : <p>Ссылки пока не добавлены.</p>}</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="resume-step-actions">
                        <button type="button" className="btn btn--ghost" disabled={step === 0 || savingResume} onClick={() => setStep((v) => Math.max(0, v - 1))}>Назад</button>
                        <button type="button" className="btn btn--primary" disabled={savingResume} onClick={() => void onResumeStepAction()}>{step === resumeSteps.length - 1 ? (savingResume ? 'Сохраняем...' : 'Сохранить резюме') : 'Далее'}</button>
                      </div>

                      {resumeError ? <div className="auth-feedback auth-feedback--error">{resumeError}</div> : null}

                      <div className="resume-output-grid">
                        <article className="resume-output-block"><h3>Основная информация</h3><p><strong>{resume.headline || 'Заголовок не заполнен'}</strong></p><p>{resume.desiredPosition || 'Позиция не указана'}</p><p>{resume.summary || 'Описание отсутствует'}</p></article>
                        <article className="resume-output-block"><h3>Скиллы</h3>{resume.skills.length ? resume.skills.map((skill) => <p key={skill.tagId}>{skill.tagName}: {skill.level}/5, {skill.yearsExperience} лет</p>) : <p>Скиллы не заполнены.</p>}</article>
                        <article className="resume-output-block"><h3>Портфолио</h3>{resume.projects.length ? resume.projects.map((project) => <p key={project.id}><strong>{project.title}</strong>{` — ${project.role}`}</p>) : <p>Проекты не добавлены.</p>}</article>
                        <article className="resume-output-block"><h3>Образование</h3>{resume.education.length ? resume.education.map((edu) => <p key={edu.id}><strong>{edu.university}</strong>{` — ${edu.specialty}`}</p>) : <p>Образование не добавлено.</p>}</article>
                        <article className="resume-output-block"><h3>Ссылки на соцсети</h3>{resume.links.length ? resume.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label || link.kind}</a>) : <p>Ссылки не добавлены.</p>}</article>
                      </div>
                    </>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </section>
      </main>
      <Footer />

      {isSettingsOpen ? (
        <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title">
          <div className="profile-settings-modal__backdrop" onClick={() => !savingProfile && !uploadingAvatar && setIsSettingsOpen(false)} />
          <div className="card profile-settings-modal__dialog">
            <div className="profile-settings-modal__head">
              <h2 id="profile-settings-title">Редактирование профиля</h2>
              <button type="button" className="btn btn--icon" onClick={() => !savingProfile && !uploadingAvatar && setIsSettingsOpen(false)} aria-label="Закрыть"><X size={16} /></button>
            </div>
            <form className="profile-settings-modal__form form-grid" onSubmit={onProfileSave}>
              <div className="profile-settings-modal__avatar-upload">
                <div className="profile-settings-modal__avatar-preview">{avatarFormUrl ? <img src={avatarFormUrl} alt="Аватар профиля" /> : <span>{avatarFallback}</span>}</div>
                <div className="profile-settings-modal__avatar-controls">
                  <label className={`profile-settings-modal__file-button ${uploadingAvatar ? 'is-loading' : ''}`}>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={(event) => void onAvatarChange(event)} disabled={uploadingAvatar || savingProfile} />
                    <UploadCloud size={16} />
                    {uploadingAvatar ? 'Загружаем файл...' : 'Выберите файл'}
                  </label>
                  <p>JPG, PNG, WEBP, GIF или SVG. Размер до 10 МБ.</p>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label>Имя *<input value={profileForm.firstName} onChange={(e) => setProfileForm((s) => ({ ...s, firstName: e.target.value }))} /></label>
                <label>Фамилия *<input value={profileForm.lastName} onChange={(e) => setProfileForm((s) => ({ ...s, lastName: e.target.value }))} /></label>
                <label>Отчество<input value={profileForm.middleName} onChange={(e) => setProfileForm((s) => ({ ...s, middleName: e.target.value }))} /></label>
                <label>Телефон<input value={profileForm.phone} onChange={(e) => setProfileForm((s) => ({ ...s, phone: formatPhone(e.target.value) }))} placeholder="+7 (___) ___-__-__" maxLength={18} /></label>
              </div>
              <div className="profile-settings-modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setIsSettingsOpen(false)} disabled={savingProfile || uploadingAvatar}>Отмена</button>
                <button type="submit" className="btn btn--primary" disabled={savingProfile || uploadingAvatar}>{savingProfile ? 'Сохраняем...' : 'Сохранить'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
