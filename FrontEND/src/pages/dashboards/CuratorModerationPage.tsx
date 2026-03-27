import { Building2, FileBadge2, ShieldAlert, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  banAdminResumeAuthor,
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminResume,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminOpportunities,
  fetchAdminResumes,
  fetchAdminUsers,
  fetchAdminVacancies,
  rejectAdminCompany,
  updateAdminCompanyStatus,
  updateAdminOpportunityStatus,
  updateAdminResumeArchive,
  updateAdminUserStatus,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminResume,
  type AdminUser,
  type AdminVacancy,
} from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'

type ModerationTab = 'users' | 'resumes' | 'vacancies' | 'opportunities' | 'companies'

const tabs: Array<{ id: ModerationTab; label: string }> = [
  { id: 'users', label: 'Пользователи' },
  { id: 'resumes', label: 'Резюме' },
  { id: 'vacancies', label: 'Вакансии' },
  { id: 'opportunities', label: 'Мероприятия' },
  { id: 'companies', label: 'Компании' },
]

const userStatusLabel: Record<number, string> = {
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

export function CuratorModerationPage() {
  const [tab, setTab] = useState<ModerationTab>('users')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [usersSearch, setUsersSearch] = useState('')
  const [resumesSearch, setResumesSearch] = useState('')
  const [vacanciesSearch, setVacanciesSearch] = useState('')
  const [opportunitiesSearch, setOpportunitiesSearch] = useState('')
  const [companiesSearch, setCompaniesSearch] = useState('')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [resumes, setResumes] = useState<AdminResume[]>([])
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([])
  const [opportunities, setOpportunities] = useState<AdminOpportunity[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])

  async function loadUsers() {
    const response = await fetchAdminUsers({ page: 1, pageSize: 30, search: usersSearch })
    setUsers(response.items)
  }

  async function loadResumes() {
    const response = await fetchAdminResumes({ page: 1, pageSize: 30, search: resumesSearch })
    setResumes(response.items)
  }

  async function loadVacancies() {
    const response = await fetchAdminVacancies({ page: 1, pageSize: 30, search: vacanciesSearch })
    setVacancies(response.items)
  }

  async function loadOpportunities() {
    const response = await fetchAdminOpportunities({ page: 1, pageSize: 30, search: opportunitiesSearch })
    setOpportunities(response.items)
  }

  async function loadCompanies() {
    const response = await fetchAdminCompanies({ page: 1, pageSize: 30, search: companiesSearch })
    setCompanies(response.items)
  }

  useEffect(() => {
    let active = true

    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.allSettled([loadUsers(), loadResumes(), loadVacancies(), loadOpportunities(), loadCompanies()])
      .then((results) => {
        if (!active) return
        const failed = results.find((item) => item.status === 'rejected')
        if (failed?.status === 'rejected') {
          setError(failed.reason instanceof Error ? failed.reason.message : 'Не удалось загрузить данные модерации.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleAction(action: () => Promise<unknown>, successMessage: string, reload: () => Promise<void>) {
    clearMessages()
    try {
      await action()
      await reload()
      setSuccess(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Не удалось выполнить действие модерации.')
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-hero admin-profile-hero">
          <div className="seeker-profile-hero__avatar admin-profile-hero__avatar">
            <span>MOD</span>
          </div>
          <div className="seeker-profile-hero__content">
            <div className="seeker-profile-panel__head">
              <h1>Центр модерации</h1>
              <div className="admin-toolbar">
                <Link className="btn btn--ghost" to="/dashboard/curator">Назад в кабинет куратора</Link>
              </div>
            </div>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{users.length} пользователей</span>
              <span><FileBadge2 size={14} />{resumes.length} резюме</span>
              <span><ShieldAlert size={14} />{vacancies.length + opportunities.length} карточек</span>
              <span><Building2 size={14} />{companies.length} компаний</span>
            </div>
          </div>
        </section>

        {loading ? <section className="dashboard-section card seeker-profile-panel"><p>Загружаем данные модерации...</p></section> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}

        <nav className="card seeker-profile-tabs">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'users' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Пользователи</h2>
              <div className="admin-toolbar">
                <input value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="Поиск email/username/ФИО" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>Найти</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {users.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.fio || item.email}</h3><p>{item.email}</p></div>
                    <span className="status-chip">{userStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <p>@{item.username} | роли: {item.roles.join(', ') || '-'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}`}>Открыть карточку</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/users/create?userId=${item.id}`}>Редактировать</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminUserStatus(item.id, 2), 'Пользователь заблокирован.', loadUsers)}>Заблокировать</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminUserStatus(item.id, 1), 'Пользователь разблокирован.', loadUsers)}>Разблокировать</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminUser(item.id), 'Пользователь удален.', loadUsers)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'resumes' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Резюме</h2>
              <div className="admin-toolbar">
                <input value={resumesSearch} onChange={(event) => setResumesSearch(event.target.value)} placeholder="Поиск резюме/пользователя" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadResumes()}>Найти</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {resumes.map((item) => (
                <article key={item.userId} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.headline || item.desiredPosition || item.fio}</h3><p>{item.fio} (@{item.username})</p></div>
                    <span className="status-chip">{item.isArchived ? 'В архиве' : 'Опубликовано'}</span>
                  </div>
                  <p>Обновлено: {new Date(item.updatedAt).toLocaleString()}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}`}>Открыть карточку</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}?mode=resume`}>Редактировать</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminResumeArchive(item.userId, !item.isArchived), item.isArchived ? 'Резюме восстановлено.' : 'Резюме отправлено в архив.', loadResumes)}>
                      {item.isArchived ? 'Восстановить' : 'Архивировать'}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => banAdminResumeAuthor(item.userId), 'Автор резюме заблокирован.', loadResumes)}>Заблокировать автора</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminResume(item.userId), 'Резюме удалено.', loadResumes)}>Удалить</button>
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
                    <div><h3>{item.title}</h3><p>Компания #{item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/curator/vacancies/create?vacancyId=${item.id}`}>Открыть карточку</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/vacancies/create?vacancyId=${item.id}`}>Редактировать</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminVacancyStatus(item.id, 7), 'Вакансия отправлена в архив.', loadVacancies)}>Архивировать</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminVacancyStatus(item.id, 6), 'Вакансия заблокирована/отклонена.', loadVacancies)}>Заблокировать</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminVacancy(item.id), 'Вакансия удалена.', loadVacancies)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'opportunities' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Мероприятия / Возможности</h2>
              <div className="admin-toolbar">
                <input value={opportunitiesSearch} onChange={(event) => setOpportunitiesSearch(event.target.value)} placeholder="Поиск по заголовку" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadOpportunities()}>Найти</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {opportunities.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>Компания #{item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/opportunity/${item.id}`}>Открыть карточку</Link>
                    <button type="button" className="btn btn--secondary" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, item.status === 2 ? 3 : 2), 'Статус модерации мероприятия обновлен.', loadOpportunities)}>Редактировать</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, 7), 'Мероприятие отправлено в архив.', loadOpportunities)}>Архивировать</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, 6), 'Мероприятие заблокировано/отклонено.', loadOpportunities)}>Заблокировать</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminOpportunity(item.id), 'Мероприятие удалено.', loadOpportunities)}>Удалить</button>
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
                <input value={companiesSearch} onChange={(event) => setCompaniesSearch(event.target.value)} placeholder="Поиск по названию/бренду/индустрии" />
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
                  <p>{item.industry || '-'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/company/${item.id}`}>Открыть карточку</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/companies/create?companyId=${item.id}`} state={{ company: item }}>Редактировать</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => verifyAdminCompany(item.id), 'Компания подтверждена.', loadCompanies)}>Подтвердить</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => rejectAdminCompany(item.id), 'Компания отклонена.', loadCompanies)}>Отклонить</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminCompanyStatus(item.id, 5), 'Компания заблокирована.', loadCompanies)}>Заблокировать</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminCompany(item.id), 'Компания удалена.', loadCompanies)}>Удалить</button>
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
