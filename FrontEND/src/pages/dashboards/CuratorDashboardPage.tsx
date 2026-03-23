import { Building2, CheckCircle2, FileWarning, ShieldCheck, Users } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createAdminCompany,
  createAdminUser,
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminOpportunities,
  fetchAdminUsers,
  fetchAdminVacancies,
  rejectAdminCompany,
  updateAdminCompany,
  updateAdminUser,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminUser,
  type AdminUserUpsertRequest,
  type AdminVacancy,
} from '../../api/admin'
import { fetchCities } from '../../api/catalog'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import type { City } from '../../types/catalog'

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

function parseNamesFromUsername(username: string) {
  const chunks = username.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: chunks[0] ?? 'User',
    lastName: chunks[1] ?? 'Name',
  }
}

export function CuratorDashboardPage() {
  const [tab, setTab] = useState<AdminTabId>('overview')
  const [cities, setCities] = useState<City[]>([])

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
  const [savingUser, setSavingUser] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [processingCompanyId, setProcessingCompanyId] = useState<number | null>(null)
  const [processingVacancyId, setProcessingVacancyId] = useState<number | null>(null)

  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userForm, setUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    status: 1,
    seeker: false,
    employer: true,
    curator: false,
  })

  const [companyForm, setCompanyForm] = useState({
    legalName: '',
    brandName: '',
    legalType: 1,
    taxId: '',
    registrationNumber: '',
    industry: '',
    description: '',
    baseCityId: '',
    websiteUrl: '',
    publicEmail: '',
    publicPhone: '',
    status: 2,
  })

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

    Promise.allSettled([fetchCities(), loadUsers(), loadCompanies(), loadVacancies(), loadOpportunities()])
      .then((results) => {
        if (!active) return

        const [citiesResult] = results
        if (citiesResult.status === 'fulfilled') {
          setCities(citiesResult.value)
        }

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

  function resetUserForm() {
    setUserForm({
      email: '',
      firstName: '',
      lastName: '',
      status: 1,
      seeker: false,
      employer: true,
      curator: false,
    })
    setEditingUserId(null)
  }

  function resetCompanyForm() {
    setCompanyForm({
      legalName: '',
      brandName: '',
      legalType: 1,
      taxId: '',
      registrationNumber: '',
      industry: '',
      description: '',
      baseCityId: '',
      websiteUrl: '',
      publicEmail: '',
      publicPhone: '',
      status: 2,
    })
    setEditingCompanyId(null)
  }

  function onUserInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked
    setUserForm((state) => ({
      ...state,
      [name]: type === 'checkbox' ? checked : name === 'status' ? Number(value) : value,
    }))
  }

  function onCompanyInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setCompanyForm((state) => ({
      ...state,
      [name]: name === 'legalType' || name === 'status' ? Number(value) : value,
    }))
  }

  function getUserRolesFromForm() {
    const roles: number[] = []
    if (userForm.seeker) roles.push(1)
    if (userForm.employer) roles.push(2)
    if (userForm.curator) roles.push(3)
    return roles
  }

  async function onSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const roles = getUserRolesFromForm()
    if (!roles.length) {
      setError('Выберите хотя бы одну роль пользователя.')
      return
    }

    const payload: AdminUserUpsertRequest = {
      email: userForm.email,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      status: userForm.status,
      roles,
    }

    setSavingUser(true)
    try {
      if (editingUserId) {
        await updateAdminUser(editingUserId, payload)
        setSuccess('Пользователь обновлен.')
      } else {
        await createAdminUser(payload)
        setSuccess('Пользователь создан.')
      }
      resetUserForm()
      await loadUsers()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить пользователя.')
    } finally {
      setSavingUser(false)
    }
  }

  async function onSubmitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const cityId = Number(companyForm.baseCityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setError('Выберите базовый город компании.')
      return
    }

    const payload = {
      legalName: companyForm.legalName,
      brandName: companyForm.brandName,
      legalType: companyForm.legalType,
      taxId: companyForm.taxId,
      registrationNumber: companyForm.registrationNumber,
      industry: companyForm.industry,
      description: companyForm.description,
      baseCityId: cityId,
      websiteUrl: companyForm.websiteUrl,
      publicEmail: companyForm.publicEmail,
      publicPhone: companyForm.publicPhone,
      status: companyForm.status,
    }

    setSavingCompany(true)
    try {
      if (editingCompanyId) {
        await updateAdminCompany(editingCompanyId, payload)
        setSuccess('Компания обновлена.')
      } else {
        await createAdminCompany(payload)
        setSuccess('Компания создана.')
      }
      resetCompanyForm()
      await loadCompanies()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить компанию.')
    } finally {
      setSavingCompany(false)
    }
  }

  function onEditUser(item: AdminUser) {
    const names = parseNamesFromUsername(item.username)
    setUserForm({
      email: item.email,
      firstName: names.firstName,
      lastName: names.lastName,
      status: item.status,
      seeker: item.roles.includes('seeker'),
      employer: item.roles.includes('employer'),
      curator: item.roles.includes('curator'),
    })
    setEditingUserId(item.id)
    setTab('users')
    clearMessages()
  }

  function onEditCompany(item: AdminCompany) {
    setCompanyForm({
      legalName: item.legalName,
      brandName: item.brandName,
      legalType: 1,
      taxId: '',
      registrationNumber: '',
      industry: item.industry,
      description: '',
      baseCityId: item.baseCityId > 0 ? String(item.baseCityId) : '',
      websiteUrl: '',
      publicEmail: '',
      publicPhone: '',
      status: item.status,
    })
    setEditingCompanyId(item.id)
    setTab('companies')
    clearMessages()
  }

  async function onDeleteUser(item: AdminUser) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить пользователя ${item.email}?`)) return
    clearMessages()
    try {
      await deleteAdminUser(item.id)
      if (editingUserId === item.id) resetUserForm()
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
      if (editingCompanyId === item.id) resetCompanyForm()
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
            <h1>Кабинет администратора</h1>
            <p>Управление пользователями, компаниями и модерацией вакансий/мероприятий.</p>
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

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitUser}>
              <h3>{editingUserId ? `Редактирование пользователя #${editingUserId}` : 'Создание пользователя'}</h3>
              <label>Email<input type="email" name="email" value={userForm.email} onChange={onUserInputChange} required /></label>
              <label>Имя<input type="text" name="firstName" value={userForm.firstName} onChange={onUserInputChange} required /></label>
              <label>Фамилия<input type="text" name="lastName" value={userForm.lastName} onChange={onUserInputChange} required /></label>
              <label>
                Статус
                <select name="status" value={userForm.status} onChange={onUserInputChange}>
                  <option value={1}>Активен</option>
                  <option value={2}>Заблокирован</option>
                  <option value={3}>Удален</option>
                </select>
              </label>
              <div className="admin-checkbox-row">
                <label className="employer-checkbox"><input type="checkbox" name="seeker" checked={userForm.seeker} onChange={onUserInputChange} />Соискатель</label>
                <label className="employer-checkbox"><input type="checkbox" name="employer" checked={userForm.employer} onChange={onUserInputChange} />Работодатель</label>
                <label className="employer-checkbox"><input type="checkbox" name="curator" checked={userForm.curator} onChange={onUserInputChange} />Куратор</label>
              </div>
              <div className="favorite-card__actions">
                <button type="submit" className="btn btn--primary" disabled={savingUser}>
                  {savingUser ? 'Сохраняем...' : editingUserId ? 'Обновить пользователя' : 'Создать пользователя'}
                </button>
                {editingUserId ? <button type="button" className="btn btn--ghost" onClick={resetUserForm}>Отменить редактирование</button> : null}
              </div>
            </form>

            <div className="admin-list-grid">
              {users.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.email}</h3><p>{item.username}</p></div>
                    <span className="status-chip">{accountStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <p>Роли: {item.roles.join(', ') || 'не назначены'}</p>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditUser(item)}>Редактировать</button>
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

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitCompany}>
              <h3>{editingCompanyId ? `Редактирование компании #${editingCompanyId}` : 'Создание компании'}</h3>
              <label>Юридическое название<input name="legalName" value={companyForm.legalName} onChange={onCompanyInputChange} required /></label>
              <label>Бренд<input name="brandName" value={companyForm.brandName} onChange={onCompanyInputChange} /></label>
              <label>
                Тип
                <select name="legalType" value={companyForm.legalType} onChange={onCompanyInputChange}>
                  <option value={1}>Юридическое лицо</option>
                  <option value={2}>ИП</option>
                </select>
              </label>
              <label>ИНН<input name="taxId" value={companyForm.taxId} onChange={onCompanyInputChange} required /></label>
              <label>Регистрационный номер<input name="registrationNumber" value={companyForm.registrationNumber} onChange={onCompanyInputChange} required /></label>
              <label>Индустрия<input name="industry" value={companyForm.industry} onChange={onCompanyInputChange} required /></label>
              <label>
                Базовый город
                <select name="baseCityId" value={companyForm.baseCityId} onChange={onCompanyInputChange} required>
                  <option value="">Выберите город</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Статус
                <select name="status" value={companyForm.status} onChange={onCompanyInputChange}>
                  <option value={1}>Черновик</option>
                  <option value={2}>На верификации</option>
                  <option value={3}>Подтверждена</option>
                  <option value={4}>Отклонена</option>
                  <option value={5}>Заблокирована</option>
                </select>
              </label>
              <label>Сайт<input name="websiteUrl" value={companyForm.websiteUrl} onChange={onCompanyInputChange} /></label>
              <label>Публичный email<input name="publicEmail" value={companyForm.publicEmail} onChange={onCompanyInputChange} /></label>
              <label>Публичный телефон<input name="publicPhone" value={companyForm.publicPhone} onChange={onCompanyInputChange} /></label>
              <label className="full-width">Описание<textarea rows={3} name="description" value={companyForm.description} onChange={onCompanyInputChange} required /></label>
              <div className="favorite-card__actions full-width">
                <button type="submit" className="btn btn--primary" disabled={savingCompany}>
                  {savingCompany ? 'Сохраняем...' : editingCompanyId ? 'Обновить компанию' : 'Создать компанию'}
                </button>
                {editingCompanyId ? <button type="button" className="btn btn--ghost" onClick={resetCompanyForm}>Отменить редактирование</button> : null}
              </div>
            </form>

            <div className="admin-list-grid">
              {companies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.brandName || item.legalName}</h3><p>{item.legalName}</p></div>
                    <span className="status-chip">{companyStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <p>Индустрия: {item.industry || 'не указана'}</p>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditCompany(item)}>Редактировать</button>
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
