import { type CSSProperties, type ChangeEvent, type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  updateAdminOpportunityStatus,
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
import type { City } from '../../types/catalog'

type AdminTabId = 'overview' | 'users' | 'companies' | 'vacancies' | 'opportunities'

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

function parseNamesFromUsername(username: string) {
  const chunks = username.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: chunks[0] ?? 'User',
    lastName: chunks[1] ?? 'Name',
  }
}

export function CuratorDashboardPage() {
  const MIN_SIDEBAR_WIDTH = 320
  const MAX_SIDEBAR_WIDTH = 760

  const [tab, setTab] = useState<AdminTabId>('overview')
  const [sidebarWidth, setSidebarWidth] = useState(500)
  const [expandedGroups, setExpandedGroups] = useState({
    management: true,
    moderation: true,
    verification: true,
  })
  const [cities, setCities] = useState<City[]>([])

  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([])
  const [opportunities, setOpportunities] = useState<AdminOpportunity[]>([])

  const [usersTotal, setUsersTotal] = useState(0)
  const [companiesTotal, setCompaniesTotal] = useState(0)
  const [vacanciesTotal, setVacanciesTotal] = useState(0)
  const [opportunitiesTotal, setOpportunitiesTotal] = useState(0)

  const [usersSearch] = useState('')
  const [companiesSearch] = useState('')
  const [vacanciesSearch] = useState('')
  const [opportunitiesSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [savingUser, setSavingUser] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [processingCompanyId, setProcessingCompanyId] = useState<number | null>(null)
  const [processingVacancyId, setProcessingVacancyId] = useState<number | null>(null)
  const [processingOpportunityId, setProcessingOpportunityId] = useState<number | null>(null)

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

  const isResizingSidebarRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(500)

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

  const pageTitleByTab: Record<AdminTabId, string> = {
    overview: 'Главная',
    users: 'Управление соискателями',
    companies: 'Управление работодателями',
    vacancies: 'Карточки возможностей',
    opportunities: 'Модерация карточек',
  }

  function toggleGroup(group: keyof typeof expandedGroups) {
    setExpandedGroups((state) => ({
      ...state,
      [group]: !state[group],
    }))
  }

  useEffect(() => {
    function onPointerMove(event: globalThis.PointerEvent) {
      if (!isResizingSidebarRef.current) return
      const delta = event.clientX - resizeStartXRef.current
      const nextWidth = resizeStartWidthRef.current + delta
      setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, nextWidth)))
    }

    function onPointerUp() {
      isResizingSidebarRef.current = false
      if (typeof document !== 'undefined') {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  function onResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    isResizingSidebarRef.current = true
    resizeStartXRef.current = event.clientX
    resizeStartWidthRef.current = sidebarWidth
    event.currentTarget.setPointerCapture(event.pointerId)
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
  }

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
    <main className="curator-dashboard" style={{ '--curator-sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <aside className="curator-dashboard__sidebar">
        <h1>Кабинет куратора</h1>
        <button type="button" className={`curator-dashboard__menu-item ${tab === 'overview' ? 'is-active' : ''}`} onClick={() => setTab('overview')}>
          Главная
        </button>

        <button
          type="button"
          className={`curator-dashboard__menu-group-toggle ${expandedGroups.management ? 'is-expanded' : ''}`}
          onClick={() => toggleGroup('management')}
        >
          <span>Управление</span>
          <span className="curator-dashboard__menu-group-arrow" aria-hidden="true">▸</span>
        </button>
        <div className={`curator-dashboard__menu-sublist-wrap ${expandedGroups.management ? 'is-expanded' : ''}`}>
          <div className="curator-dashboard__menu-sublist">
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'users' ? 'is-active' : ''}`} onClick={() => setTab('users')}>
              Соискатели
            </button>
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'companies' ? 'is-active' : ''}`} onClick={() => setTab('companies')}>
              Работодатели
            </button>
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'vacancies' ? 'is-active' : ''}`} onClick={() => setTab('vacancies')}>
              Карточки возможностей
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`curator-dashboard__menu-group-toggle ${expandedGroups.moderation ? 'is-expanded' : ''}`}
          onClick={() => toggleGroup('moderation')}
        >
          <span>Модерация</span>
          <span className="curator-dashboard__menu-group-arrow" aria-hidden="true">▸</span>
        </button>
        <div className={`curator-dashboard__menu-sublist-wrap ${expandedGroups.moderation ? 'is-expanded' : ''}`}>
          <div className="curator-dashboard__menu-sublist">
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'opportunities' ? 'is-active' : ''}`} onClick={() => setTab('opportunities')}>
              Карточки возможностей
            </button>
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'users' ? 'is-active' : ''}`} onClick={() => setTab('users')}>
              Соискатели
            </button>
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'companies' ? 'is-active' : ''}`} onClick={() => setTab('companies')}>
              Работодатели
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`curator-dashboard__menu-group-toggle ${expandedGroups.verification ? 'is-expanded' : ''}`}
          onClick={() => toggleGroup('verification')}
        >
          <span>Верификация</span>
          <span className="curator-dashboard__menu-group-arrow" aria-hidden="true">▸</span>
        </button>
        <div className={`curator-dashboard__menu-sublist-wrap ${expandedGroups.verification ? 'is-expanded' : ''}`}>
          <div className="curator-dashboard__menu-sublist">
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'companies' ? 'is-active' : ''}`} onClick={() => setTab('companies')}>
              Заявки на верификацию
            </button>
            <button type="button" className={`curator-dashboard__menu-item ${tab === 'companies' ? 'is-active' : ''}`} onClick={() => setTab('companies')}>
              Документы компаний
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="curator-dashboard__resize-handle"
        aria-label="Изменить ширину боковой панели"
        onPointerDown={onResizePointerDown}
      />

      <section className="curator-dashboard__content">
        <header className="curator-dashboard__header">
          <h2>{pageTitleByTab[tab]}</h2>
          {loading ? <p>Загрузка данных...</p> : null}
          {error ? <p className="curator-dashboard__status curator-dashboard__status--error">{error}</p> : null}
          {success ? <p className="curator-dashboard__status">{success}</p> : null}
        </header>

        {tab === 'overview' ? (
          <div className="curator-dashboard__overview-grid">
            <article><span>Пользователи</span><strong>{overviewStats.users}</strong></article>
            <article><span>Компании</span><strong>{overviewStats.companies}</strong></article>
            <article><span>Ждут верификации</span><strong>{overviewStats.pendingVerification}</strong></article>
            <article><span>Карточки</span><strong>{overviewStats.moderation}</strong></article>
          </div>
        ) : null}

        {tab === 'users' ? (
          <div className="curator-dashboard__cards-grid">
            {users.map((item) => (
              <article key={item.id} className="curator-dashboard__person-card">
                <h3>{item.username || 'Иванов Иван Иванович'}</h3>
                <a href={`mailto:${item.email}`}>{item.email}</a>
                <div className="curator-dashboard__card-status">
                  <span>Cтатус:</span>
                  <em className={item.status === 1 ? 'is-active' : 'is-inactive'}>{accountStatusLabel[item.status] ?? `Статус ${item.status}`}</em>
                </div>
                <button type="button" className="curator-dashboard__btn curator-dashboard__btn--edit" onClick={() => onEditUser(item)}>
                  Редактировать
                </button>
                <button type="button" className="curator-dashboard__btn curator-dashboard__btn--delete" onClick={() => void onDeleteUser(item)}>
                  Удалить
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {tab === 'companies' ? (
          <div className="curator-dashboard__cards-grid">
            {companies.map((item) => (
              <article key={item.id} className="curator-dashboard__person-card">
                <h3>{item.brandName || item.legalName}</h3>
                <a href="mailto:info@company.ru">info@company.ru</a>
                <div className="curator-dashboard__card-status">
                  <span>Cтатус:</span>
                  <em className={item.status === 3 ? 'is-active' : 'is-inactive'}>{companyStatusLabel[item.status] ?? `Статус ${item.status}`}</em>
                </div>
                <button type="button" className="curator-dashboard__btn curator-dashboard__btn--edit" onClick={() => onEditCompany(item)}>
                  Редактировать
                </button>
                <button
                  type="button"
                  className="curator-dashboard__btn curator-dashboard__btn--delete"
                  onClick={() => void onDeleteCompany(item)}
                  disabled={processingCompanyId === item.id}
                >
                  Удалить
                </button>
                {item.status === 2 ? (
                  <div className="curator-dashboard__verify-actions">
                    <button type="button" onClick={() => void onVerifyCompany(item)} disabled={processingCompanyId === item.id}>Подтвердить</button>
                    <button type="button" onClick={() => void onRejectCompany(item)} disabled={processingCompanyId === item.id}>Отклонить</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {tab === 'vacancies' ? (
          <div className="curator-dashboard__cards-grid">
            {vacancies.map((item) => (
              <article key={item.id} className="curator-dashboard__person-card">
                <h3>{item.title}</h3>
                <a href={`#vacancy-${item.id}`}>Компания #{item.companyId}</a>
                <div className="curator-dashboard__card-status">
                  <span>Cтатус:</span>
                  <em className={item.status === 3 ? 'is-active' : 'is-inactive'}>{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</em>
                </div>
                <select
                  value={item.status}
                  onChange={(event) => void onChangeVacancyStatus(item, Number(event.target.value))}
                  disabled={processingVacancyId === item.id}
                >
                  {Object.entries(moderationStatusLabel).map(([value, label]) => (
                    <option key={value} value={Number(value)}>{label}</option>
                  ))}
                </select>
                <button type="button" className="curator-dashboard__btn curator-dashboard__btn--delete" onClick={() => void onDeleteVacancy(item)}>
                  Удалить
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {tab === 'opportunities' ? (
          <div className="curator-dashboard__cards-grid">
            {opportunities.map((item) => (
              <article key={item.id} className="curator-dashboard__person-card">
                <h3>{item.title}</h3>
                <a href={`#opportunity-${item.id}`}>Компания #{item.companyId}</a>
                <div className="curator-dashboard__card-status">
                  <span>Cтатус:</span>
                  <em className={item.status === 3 ? 'is-active' : 'is-inactive'}>{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</em>
                </div>
                <select
                  value={item.status}
                  onChange={(event) => void onChangeOpportunityStatus(item, Number(event.target.value))}
                  disabled={processingOpportunityId === item.id}
                >
                  {Object.entries(moderationStatusLabel).map(([value, label]) => (
                    <option key={value} value={Number(value)}>{label}</option>
                  ))}
                </select>
                <button type="button" className="curator-dashboard__btn curator-dashboard__btn--delete" onClick={() => void onDeleteOpportunity(item)}>
                  Удалить
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {(tab === 'users' && editingUserId) || (tab === 'users' && !users.length) ? (
          <form className="curator-dashboard__edit-form" onSubmit={onSubmitUser}>
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
            <div className="curator-dashboard__edit-form-row">
              <label><input type="checkbox" name="seeker" checked={userForm.seeker} onChange={onUserInputChange} />Соискатель</label>
              <label><input type="checkbox" name="employer" checked={userForm.employer} onChange={onUserInputChange} />Работодатель</label>
              <label><input type="checkbox" name="curator" checked={userForm.curator} onChange={onUserInputChange} />Куратор</label>
            </div>
            <div className="curator-dashboard__edit-form-actions">
              <button type="submit" disabled={savingUser}>{savingUser ? 'Сохраняем...' : editingUserId ? 'Обновить' : 'Создать'}</button>
              {editingUserId ? <button type="button" onClick={resetUserForm}>Отменить</button> : null}
            </div>
          </form>
        ) : null}

        {tab === 'companies' && editingCompanyId ? (
          <form className="curator-dashboard__edit-form" onSubmit={onSubmitCompany}>
            <h3>Редактирование компании #{editingCompanyId}</h3>
            <label>Юридическое название<input name="legalName" value={companyForm.legalName} onChange={onCompanyInputChange} required /></label>
            <label>Бренд<input name="brandName" value={companyForm.brandName} onChange={onCompanyInputChange} /></label>
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
            <label>Публичный email<input name="publicEmail" value={companyForm.publicEmail} onChange={onCompanyInputChange} /></label>
            <label>Публичный телефон<input name="publicPhone" value={companyForm.publicPhone} onChange={onCompanyInputChange} /></label>
            <div className="curator-dashboard__edit-form-actions">
              <button type="submit" disabled={savingCompany}>{savingCompany ? 'Сохраняем...' : 'Обновить'}</button>
              <button type="button" onClick={resetCompanyForm}>Отменить</button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  )
}
