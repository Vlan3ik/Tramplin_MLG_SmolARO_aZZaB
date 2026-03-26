import { Building2, CheckCircle2, FileWarning, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminOpportunities,
  fetchAdminUsers,
  fetchAdminVacancies,
  rejectAdminCompany,
  updateAdminOpportunityStatus,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminUser,
  type AdminVacancy,
} from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { Link } from 'react-router-dom'

type AdminTabId = 'overview' | 'users' | 'companies' | 'vacancies' | 'opportunities'

const adminTabs: Array<{ id: AdminTabId; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'users', label: 'Пользователи' },
  { id: 'companies', label: 'Компании' },
  { id: 'vacancies', label: 'Вакансии' },
  { id: 'opportunities', label: 'Мероприятия' },
]

const accountStatusLabel: Record<number, string> = {
  1: 'Активен',
  2: 'Заблокирован',
  3: 'Удален',
}

const companyStatusLabel: Record<number, string> = {
  1: 'Черновик',
  2: 'На верификации',
  3: 'Подтверждена',
  4: 'Отклонена',
  5: 'Заблокирована',
}

const moderationStatusLabel: Record<number, string> = {
  1: 'Черновик',
  2: 'На модерации',
  3: 'Активно',
  4: 'Завершено',
  5: 'Отменено',
  6: 'Отклонено',
  7: 'Архив',
}

const workFormatLabel: Record<number, string> = {
  1: 'Офис',
  2: 'Гибрид',
  3: 'Удаленно',
}

const opportunityKindLabel: Record<number, string> = {
  1: 'Хакатон',
  2: 'День открытых дверей',
  3: 'Лекция',
  4: 'Другое',
}

const vacancyKindLabel: Record<number, string> = {
  1: 'Стажировка',
  2: 'Работа',
}

export function CuratorDashboardPage() {
  const [tab, setTab] = useState<AdminTabId>('overview')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([])
  const [opportunities, setOpportunities] = useState<AdminOpportunity[]>([])

  const [usersTotal, setUsersTotal] = useState(0)
  const [companiesTotal, setCompaniesTotal] = useState(0)
  const [vacanciesTotal, setVacanciesTotal] = useState(0)
  const [opportunitiesTotal, setOpportunitiesTotal] = useState(0)

  const [usersSearch, setUsersSearch] = useState('')
  const [companiesSearch, setCompaniesSearch] = useState('')
  const [vacanciesSearch, setVacanciesSearch] = useState('')
  const [opportunitiesSearch, setOpportunitiesSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [processingCompanyId, setProcessingCompanyId] = useState<number | null>(null)
  const [processingVacancyId, setProcessingVacancyId] = useState<number | null>(null)
  const [processingOpportunityId, setProcessingOpportunityId] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  async function loadUsers() {
    const response = await fetchAdminUsers({ page: 1, pageSize: 30, search: usersSearch })
    setUsers(response.items)
    setUsersTotal(response.totalCount)
  }

  async function loadCompanies() {
    const response = await fetchAdminCompanies({ page: 1, pageSize: 30, search: companiesSearch })
    setCompanies(response.items)
    setCompaniesTotal(response.totalCount)
  }

  async function loadVacancies() {
    const response = await fetchAdminVacancies({ page: 1, pageSize: 30, search: vacanciesSearch })
    setVacancies(response.items)
    setVacanciesTotal(response.totalCount)
  }

  async function loadOpportunities() {
    const response = await fetchAdminOpportunities({ page: 1, pageSize: 30, search: opportunitiesSearch })
    setOpportunities(response.items)
    setOpportunitiesTotal(response.totalCount)
  }

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.allSettled([loadUsers(), loadCompanies(), loadVacancies(), loadOpportunities()])
      .then((results) => {
        if (!active) return

        const failed = results.find((item) => item.status === 'rejected')
        if (failed?.status === 'rejected') {
          setError(failed.reason instanceof Error ? failed.reason.message : 'Не удалось загрузить кабинет администратора.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const overviewStats = useMemo(
    () => ({
      users: usersTotal,
      companies: companiesTotal,
      moderation: vacanciesTotal + opportunitiesTotal,
      pendingVerification: companies.filter((item) => item.status === 2).length,
    }),
    [companies, companiesTotal, opportunitiesTotal, usersTotal, vacanciesTotal],
  )

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function onDeleteUser(item: AdminUser) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить пользователя ${item.email}?`)) return
    clearMessages()
    try {
      await deleteAdminUser(item.id)
      setSuccess('Пользователь удален.')
      await loadUsers()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить пользователя.')
    }
  }

  async function onDeleteCompany(item: AdminCompany) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить компанию ${item.legalName}?`)) return
    clearMessages()
    try {
      await deleteAdminCompany(item.id)
      setSuccess('Компания удалена.')
      await loadCompanies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить компанию.')
    }
  }

  async function onDeleteVacancy(item: AdminVacancy) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить вакансию ${item.title}?`)) return
    clearMessages()
    try {
      await deleteAdminVacancy(item.id)
      setSuccess('Вакансия удалена.')
      await loadVacancies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить вакансию.')
    }
  }

  async function onChangeVacancyStatus(item: AdminVacancy, nextStatus: number) {
    if (item.status === nextStatus) return
    clearMessages()
    setProcessingVacancyId(item.id)
    const previousStatus = item.status
    setVacancies((state) => state.map((vacancy) => (vacancy.id === item.id ? { ...vacancy, status: nextStatus } : vacancy)))

    try {
      await updateAdminVacancyStatus(item.id, nextStatus)
      setSuccess('Статус вакансии обновлен.')
    } catch (updateError) {
      setVacancies((state) => state.map((vacancy) => (vacancy.id === item.id ? { ...vacancy, status: previousStatus } : vacancy)))
      setError(updateError instanceof Error ? updateError.message : 'Не удалось обновить статус вакансии.')
    } finally {
      setProcessingVacancyId(null)
    }
  }

  async function onDeleteOpportunity(item: AdminOpportunity) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить мероприятие ${item.title}?`)) return
    clearMessages()
    try {
      await deleteAdminOpportunity(item.id)
      setSuccess('Мероприятие удалено.')
      await loadOpportunities()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить мероприятие.')
    }
  }

  async function onChangeOpportunityStatus(item: AdminOpportunity, nextStatus: number) {
    if (item.status === nextStatus) return
    clearMessages()
    setProcessingOpportunityId(item.id)
    const previousStatus = item.status
    setOpportunities((state) => state.map((opportunity) => (opportunity.id === item.id ? { ...opportunity, status: nextStatus } : opportunity)))

    try {
      await updateAdminOpportunityStatus(item.id, nextStatus)
      setSuccess('Статус мероприятия обновлен.')
    } catch (updateError) {
      setOpportunities((state) => state.map((opportunity) => (opportunity.id === item.id ? { ...opportunity, status: previousStatus } : opportunity)))
      setError(updateError instanceof Error ? updateError.message : 'Не удалось обновить статус мероприятия.')
    } finally {
      setProcessingOpportunityId(null)
    }
  }

  async function onVerifyCompany(item: AdminCompany) {
    clearMessages()
    setProcessingCompanyId(item.id)
    try {
      await verifyAdminCompany(item.id)
      setSuccess('Компания подтверждена.')
      await loadCompanies()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Не удалось подтвердить компанию.')
    } finally {
      setProcessingCompanyId(null)
    }
  }

  async function onRejectCompany(item: AdminCompany) {
    clearMessages()
    setProcessingCompanyId(item.id)
    try {
      await rejectAdminCompany(item.id)
      setSuccess('Компания отклонена.')
      await loadCompanies()
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Не удалось отклонить компанию.')
    } finally {
      setProcessingCompanyId(null)
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-hero admin-profile-hero">
          <div className="seeker-profile-hero__avatar admin-profile-hero__avatar">
            <span>ADM</span>
          </div>
          <div className="seeker-profile-hero__content">
            <div className="seeker-profile-panel__head">
              <h1>Кабинет администратора</h1>
              <div className="admin-toolbar">
                <Link className="btn btn--primary" to="/dashboard/curator/users/create">Создать пользователя</Link>
                <Link className="btn btn--primary" to="/dashboard/curator/companies/create">Создать компанию</Link>
              </div>
            </div>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{usersTotal} пользователей</span>
              <span><Building2 size={14} />{companiesTotal} компаний</span>
              <span><FileWarning size={14} />{vacanciesTotal + opportunitiesTotal} карточек</span>
            </div>
          </div>
          {/* <div className="seeker-profile-hero__actions">
            <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>Обновить пользователей</button>
            <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>Обновить компании</button>
          </div> */}
        </section>

        {loading ? <section className="dashboard-section card seeker-profile-panel"><p>Загружаем данные кабинета...</p></section> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}

        <nav className="card seeker-profile-tabs">
          {adminTabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <h2>Обзор</h2>
            <div className="employer-analytics">
              <article><strong>{overviewStats.users}</strong><span>Всего пользователей</span></article>
              <article><strong>{overviewStats.companies}</strong><span>Всего компаний</span></article>
              <article><strong>{overviewStats.pendingVerification}</strong><span>Ждут верификации</span></article>
              <article><strong>{overviewStats.moderation}</strong><span>Карточек в системе</span></article>
            </div>
          </section>
        ) : null}

        {tab === 'users' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Пользователи</h2>
              <div className="admin-toolbar">
                <input value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="Поиск по email/username" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>Найти</button>
              </div>
            </div>


            <div className="admin-list-grid">
              {users.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.email}</h3><p>{item.username}</p></div>
                    <span className="status-chip">{accountStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <p>Роли: {item.roles.join(', ') || 'не назначены'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/curator/users/create?userId=${item.id}`} state={{ user: item }}>
                      Редактировать
                    </Link>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteUser(item)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'companies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Компании</h2>
              <div className="admin-toolbar">
                <input value={companiesSearch} onChange={(event) => setCompaniesSearch(event.target.value)} placeholder="Поиск по названию/индустрии" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>Найти</button>
              </div>
            </div>


            <div className="admin-list-grid">
              {companies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.brandName || item.legalName}</h3><p>{item.legalName}</p></div>
                    <span className="status-chip">{companyStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <p>Индустрия: {item.industry || 'не указана'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/curator/companies/create?companyId=${item.id}`} state={{ company: item }}>
                      Редактировать
                    </Link>
                    <button type="button" className="btn btn--ghost" disabled={processingCompanyId === item.id} onClick={() => void onVerifyCompany(item)}>
                      <CheckCircle2 size={14} /> Подтвердить
                    </button>
                    <button type="button" className="btn btn--ghost" disabled={processingCompanyId === item.id} onClick={() => void onRejectCompany(item)}>
                      <ShieldCheck size={14} /> Отклонить
                    </button>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteCompany(item)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'vacancies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Вакансии</h2>
              <div className="admin-toolbar">
                <input value={vacanciesSearch} onChange={(event) => setVacanciesSearch(event.target.value)} placeholder="Поиск по заголовку" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadVacancies()}>Найти</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {vacancies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>Компания ID: {item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{vacancyKindLabel[item.kind] ?? `Вид ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Формат ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <select
                      value={item.status}
                      onChange={(event) => void onChangeVacancyStatus(item, Number(event.target.value))}
                      disabled={processingVacancyId === item.id}
                    >
                      {Object.entries(moderationStatusLabel).map(([value, label]) => (
                        <option key={value} value={Number(value)}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteVacancy(item)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'opportunities' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Мероприятия</h2>
              <div className="admin-toolbar">
                <input value={opportunitiesSearch} onChange={(event) => setOpportunitiesSearch(event.target.value)} placeholder="Поиск по заголовку" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadOpportunities()}>Найти</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {opportunities.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>Компания ID: {item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{opportunityKindLabel[item.kind] ?? `Вид ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Формат ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <select
                      value={item.status}
                      onChange={(event) => void onChangeOpportunityStatus(item, Number(event.target.value))}
                      disabled={processingOpportunityId === item.id}
                    >
                      {Object.entries(moderationStatusLabel).map(([value, label]) => (
                        <option key={value} value={Number(value)}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteOpportunity(item)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}
