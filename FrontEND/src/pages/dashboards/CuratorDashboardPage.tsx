import { Building2, CheckCircle2, FileWarning, ShieldCheck, Users } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createAdminCompany,
  createAdminOpportunity,
  createAdminUser,
  createAdminVacancy,
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
  updateAdminOpportunity,
  updateAdminUser,
  updateAdminVacancy,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminOpportunityUpsertRequest,
  type AdminUser,
  type AdminUserUpsertRequest,
  type AdminVacancy,
  type AdminVacancyUpsertRequest,
} from '../../api/admin'
import { fetchCities, fetchLocations } from '../../api/catalog'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import type { City, Location } from '../../types/catalog'

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

function toIsoDateTimeFromLocalInput(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString()
}

function toLocalDateTimeInputValue(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toNumberOrNull(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized.replace(',', '.'))
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function parseNamesFromUsername(username: string) {
  const chunks = username.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: chunks[0] ?? 'User',
    lastName: chunks[1] ?? 'Name',
  }
}

function locationLabel(location: Location) {
  const parts = [location.streetName, location.houseNumber].filter(Boolean)
  const addr = parts.length ? parts.join(', ') : 'Адрес не указан'
  return `${location.cityName}: ${addr}`
}

export function CuratorDashboardPage() {
  const [tab, setTab] = useState<AdminTabId>('overview')
  const [cities, setCities] = useState<City[]>([])
  const [vacancyLocations, setVacancyLocations] = useState<Location[]>([])
  const [opportunityLocations, setOpportunityLocations] = useState<Location[]>([])

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
  const [savingVacancy, setSavingVacancy] = useState(false)
  const [savingOpportunity, setSavingOpportunity] = useState(false)
  const [processingCompanyId, setProcessingCompanyId] = useState<number | null>(null)

  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null)
  const [editingVacancyId, setEditingVacancyId] = useState<number | null>(null)
  const [editingOpportunityId, setEditingOpportunityId] = useState<number | null>(null)

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

  const [vacancyForm, setVacancyForm] = useState({
    companyId: '',
    createdByUserId: '',
    title: '',
    shortDescription: '',
    fullDescription: '',
    kind: 2,
    format: 2,
    status: 2,
    cityId: '',
    locationId: '',
    salaryFrom: '',
    salaryTo: '',
    currencyCode: 'RUB',
    salaryTaxMode: 3,
    publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
    applicationDeadline: '',
  })

  const [opportunityForm, setOpportunityForm] = useState({
    companyId: '',
    createdByUserId: '',
    title: '',
    shortDescription: '',
    fullDescription: '',
    kind: 4,
    format: 2,
    status: 2,
    cityId: '',
    locationId: '',
    priceType: 1,
    priceAmount: '',
    priceCurrencyCode: 'RUB',
    participantsCanWrite: true,
    publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
    eventDate: '',
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
        if (!active) {
          return
        }

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
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const cityId = Number(vacancyForm.cityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setVacancyLocations([])
      return
    }

    let active = true
    void fetchLocations(cityId)
      .then((items) => {
        if (active) {
          setVacancyLocations(items)
        }
      })
      .catch(() => {
        if (active) {
          setVacancyLocations([])
        }
      })
    return () => {
      active = false
    }
  }, [vacancyForm.cityId])

  useEffect(() => {
    const cityId = Number(opportunityForm.cityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setOpportunityLocations([])
      return
    }

    let active = true
    void fetchLocations(cityId)
      .then((items) => {
        if (active) {
          setOpportunityLocations(items)
        }
      })
      .catch(() => {
        if (active) {
          setOpportunityLocations([])
        }
      })
    return () => {
      active = false
    }
  }, [opportunityForm.cityId])

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

  function resetVacancyForm() {
    setVacancyForm({
      companyId: '',
      createdByUserId: '',
      title: '',
      shortDescription: '',
      fullDescription: '',
      kind: 2,
      format: 2,
      status: 2,
      cityId: '',
      locationId: '',
      salaryFrom: '',
      salaryTo: '',
      currencyCode: 'RUB',
      salaryTaxMode: 3,
      publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
      applicationDeadline: '',
    })
    setEditingVacancyId(null)
  }

  function resetOpportunityForm() {
    setOpportunityForm({
      companyId: '',
      createdByUserId: '',
      title: '',
      shortDescription: '',
      fullDescription: '',
      kind: 4,
      format: 2,
      status: 2,
      cityId: '',
      locationId: '',
      priceType: 1,
      priceAmount: '',
      priceCurrencyCode: 'RUB',
      participantsCanWrite: true,
      publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
      eventDate: '',
    })
    setEditingOpportunityId(null)
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

  function onVacancyInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setVacancyForm((state) => ({
      ...state,
      [name]:
        name === 'kind' || name === 'format' || name === 'status' || name === 'salaryTaxMode'
          ? Number(value)
          : value,
      ...(name === 'cityId' ? { locationId: '' } : {}),
    }))
  }

  function onOpportunityInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked
    setOpportunityForm((state) => ({
      ...state,
      [name]:
        name === 'kind' || name === 'format' || name === 'status' || name === 'priceType'
          ? Number(value)
          : type === 'checkbox'
            ? checked
            : value,
      ...(name === 'cityId' ? { locationId: '' } : {}),
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

  async function onSubmitVacancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const publishAt = toIsoDateTimeFromLocalInput(vacancyForm.publishAt)
    if (!publishAt) {
      setError('Укажите корректную дату публикации вакансии.')
      return
    }

    const salaryFrom = toNumberOrNull(vacancyForm.salaryFrom)
    const salaryTo = toNumberOrNull(vacancyForm.salaryTo)
    if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
      setError('Зарплата "до" должна быть больше или равна зарплате "от".')
      return
    }

    const deadline = vacancyForm.applicationDeadline.trim() ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline) : null
    if (vacancyForm.applicationDeadline.trim() && !deadline) {
      setError('Укажите корректный дедлайн откликов.')
      return
    }

    const payload: AdminVacancyUpsertRequest = {
      companyId: Number(vacancyForm.companyId),
      createdByUserId: Number(vacancyForm.createdByUserId),
      title: vacancyForm.title,
      shortDescription: vacancyForm.shortDescription,
      fullDescription: vacancyForm.fullDescription,
      kind: vacancyForm.kind,
      format: vacancyForm.format,
      status: vacancyForm.status,
      cityId: vacancyForm.cityId ? Number(vacancyForm.cityId) : null,
      locationId: vacancyForm.locationId ? Number(vacancyForm.locationId) : null,
      salaryFrom,
      salaryTo,
      currencyCode: vacancyForm.currencyCode.trim() ? vacancyForm.currencyCode.trim().toUpperCase() : null,
      salaryTaxMode: vacancyForm.salaryTaxMode,
      publishAt,
      applicationDeadline: deadline,
    }

    if (!payload.companyId || !payload.createdByUserId) {
      setError('Укажите ID компании и ID автора.')
      return
    }

    setSavingVacancy(true)
    try {
      if (editingVacancyId) {
        await updateAdminVacancy(editingVacancyId, payload)
        setSuccess('Вакансия обновлена.')
      } else {
        await createAdminVacancy(payload)
        setSuccess('Вакансия создана.')
      }
      resetVacancyForm()
      await loadVacancies()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить вакансию.')
    } finally {
      setSavingVacancy(false)
    }
  }

  async function onSubmitOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const publishAt = toIsoDateTimeFromLocalInput(opportunityForm.publishAt)
    if (!publishAt) {
      setError('Укажите корректную дату публикации мероприятия.')
      return
    }

    const eventDate = opportunityForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(opportunityForm.eventDate) : null
    if (opportunityForm.eventDate.trim() && !eventDate) {
      setError('Укажите корректную дату события.')
      return
    }

    const priceAmount = toNumberOrNull(opportunityForm.priceAmount)
    if ((opportunityForm.priceType === 2 || opportunityForm.priceType === 3) && priceAmount === null) {
      setError('Для платного или призового события укажите сумму.')
      return
    }

    const payload: AdminOpportunityUpsertRequest = {
      companyId: Number(opportunityForm.companyId),
      createdByUserId: Number(opportunityForm.createdByUserId),
      title: opportunityForm.title,
      shortDescription: opportunityForm.shortDescription,
      fullDescription: opportunityForm.fullDescription,
      kind: opportunityForm.kind,
      format: opportunityForm.format,
      status: opportunityForm.status,
      cityId: opportunityForm.cityId ? Number(opportunityForm.cityId) : null,
      locationId: opportunityForm.locationId ? Number(opportunityForm.locationId) : null,
      priceType: opportunityForm.priceType,
      priceAmount: opportunityForm.priceType === 1 ? null : priceAmount,
      priceCurrencyCode: opportunityForm.priceType === 1 ? null : (opportunityForm.priceCurrencyCode.trim() || null),
      participantsCanWrite: opportunityForm.participantsCanWrite,
      publishAt,
      eventDate,
    }

    if (!payload.companyId || !payload.createdByUserId) {
      setError('Укажите ID компании и ID автора.')
      return
    }

    setSavingOpportunity(true)
    try {
      if (editingOpportunityId) {
        await updateAdminOpportunity(editingOpportunityId, payload)
        setSuccess('Мероприятие обновлено.')
      } else {
        await createAdminOpportunity(payload)
        setSuccess('Мероприятие создано.')
      }
      resetOpportunityForm()
      await loadOpportunities()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить мероприятие.')
    } finally {
      setSavingOpportunity(false)
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

  function onEditVacancy(item: AdminVacancy) {
    setVacancyForm({
      companyId: String(item.companyId),
      createdByUserId: '',
      title: item.title,
      shortDescription: '',
      fullDescription: '',
      kind: item.kind,
      format: item.format,
      status: item.status,
      cityId: '',
      locationId: '',
      salaryFrom: '',
      salaryTo: '',
      currencyCode: 'RUB',
      salaryTaxMode: 3,
      publishAt: toLocalDateTimeInputValue(item.publishAt),
      applicationDeadline: '',
    })
    setEditingVacancyId(item.id)
    setTab('vacancies')
    clearMessages()
  }

  function onEditOpportunity(item: AdminOpportunity) {
    setOpportunityForm({
      companyId: String(item.companyId),
      createdByUserId: '',
      title: item.title,
      shortDescription: '',
      fullDescription: '',
      kind: item.kind,
      format: item.format,
      status: item.status,
      cityId: '',
      locationId: '',
      priceType: 1,
      priceAmount: '',
      priceCurrencyCode: 'RUB',
      participantsCanWrite: true,
      publishAt: toLocalDateTimeInputValue(item.publishAt),
      eventDate: '',
    })
    setEditingOpportunityId(item.id)
    setTab('opportunities')
    clearMessages()
  }

  async function onDeleteUser(item: AdminUser) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить пользователя ${item.email}?`)) {
      return
    }

    clearMessages()
    try {
      await deleteAdminUser(item.id)
      if (editingUserId === item.id) {
        resetUserForm()
      }
      setSuccess('Пользователь удален.')
      await loadUsers()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить пользователя.')
    }
  }

  async function onDeleteCompany(item: AdminCompany) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить компанию ${item.legalName}?`)) {
      return
    }

    clearMessages()
    try {
      await deleteAdminCompany(item.id)
      if (editingCompanyId === item.id) {
        resetCompanyForm()
      }
      setSuccess('Компания удалена.')
      await loadCompanies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить компанию.')
    }
  }

  async function onDeleteVacancy(item: AdminVacancy) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить вакансию ${item.title}?`)) {
      return
    }

    clearMessages()
    try {
      await deleteAdminVacancy(item.id)
      if (editingVacancyId === item.id) {
        resetVacancyForm()
      }
      setSuccess('Вакансия удалена.')
      await loadVacancies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить вакансию.')
    }
  }

  async function onDeleteOpportunity(item: AdminOpportunity) {
    if (typeof window !== 'undefined' && !window.confirm(`Удалить мероприятие ${item.title}?`)) {
      return
    }

    clearMessages()
    try {
      await deleteAdminOpportunity(item.id)
      if (editingOpportunityId === item.id) {
        resetOpportunityForm()
      }
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
            <p>Управление пользователями, компаниями и модерацией вакансий/мероприятий через реальные backend API.</p>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{usersTotal} пользователей</span>
              <span><Building2 size={14} />{companiesTotal} компаний</span>
              <span><FileWarning size={14} />{vacanciesTotal + opportunitiesTotal} карточек</span>
            </div>
          </div>
          <div className="seeker-profile-hero__actions">
            <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>Обновить пользователей</button>
            <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>Обновить компании</button>
          </div>
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
              <article>
                <strong>{overviewStats.users}</strong>
                <span>Всего пользователей</span>
              </article>
              <article>
                <strong>{overviewStats.companies}</strong>
                <span>Всего компаний</span>
              </article>
              <article>
                <strong>{overviewStats.pendingVerification}</strong>
                <span>Ждут верификации</span>
              </article>
              <article>
                <strong>{overviewStats.moderation}</strong>
                <span>Карточек в системе</span>
              </article>
            </div>
          </section>
        ) : null}

        {tab === 'users' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Пользователи</h2>
              <div className="admin-toolbar">
                <input
                  value={usersSearch}
                  onChange={(event) => setUsersSearch(event.target.value)}
                  placeholder="Поиск по email/username"
                />
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

            <div className="favorite-list">
              {users.map((item) => (
                <article key={item.id} className="favorite-card">
                  <div className="favorite-card__head">
                    <div>
                      <h3>{item.email}</h3>
                      <p>{item.username}</p>
                    </div>
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
                <input
                  value={companiesSearch}
                  onChange={(event) => setCompaniesSearch(event.target.value)}
                  placeholder="Поиск по названию/индустрии"
                />
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

            <div className="favorite-list">
              {companies.map((item) => (
                <article key={item.id} className="favorite-card">
                  <div className="favorite-card__head">
                    <div>
                      <h3>{item.brandName || item.legalName}</h3>
                      <p>{item.legalName}</p>
                    </div>
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
                <input
                  value={vacanciesSearch}
                  onChange={(event) => setVacanciesSearch(event.target.value)}
                  placeholder="Поиск по заголовку"
                />
                <button type="button" className="btn btn--ghost" onClick={() => void loadVacancies()}>Найти</button>
              </div>
            </div>

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitVacancy}>
              <h3>{editingVacancyId ? `Редактирование вакансии #${editingVacancyId}` : 'Создание вакансии'}</h3>
              <label>ID компании<input name="companyId" value={vacancyForm.companyId} onChange={onVacancyInputChange} required /></label>
              <label>ID автора<input name="createdByUserId" value={vacancyForm.createdByUserId} onChange={onVacancyInputChange} required /></label>
              <label className="full-width">Название<input name="title" value={vacancyForm.title} onChange={onVacancyInputChange} required /></label>
              <label className="full-width">Краткое описание<textarea rows={2} name="shortDescription" value={vacancyForm.shortDescription} onChange={onVacancyInputChange} required /></label>
              <label className="full-width">Полное описание<textarea rows={3} name="fullDescription" value={vacancyForm.fullDescription} onChange={onVacancyInputChange} required /></label>
              <label>
                Вид
                <select name="kind" value={vacancyForm.kind} onChange={onVacancyInputChange}>
                  <option value={1}>Стажировка</option>
                  <option value={2}>Работа</option>
                </select>
              </label>
              <label>
                Формат
                <select name="format" value={vacancyForm.format} onChange={onVacancyInputChange}>
                  <option value={1}>Офис</option>
                  <option value={2}>Гибрид</option>
                  <option value={3}>Удаленно</option>
                </select>
              </label>
              <label>
                Статус
                <select name="status" value={vacancyForm.status} onChange={onVacancyInputChange}>
                  <option value={1}>Черновик</option>
                  <option value={2}>На модерации</option>
                  <option value={3}>Активно</option>
                  <option value={4}>Завершено</option>
                  <option value={5}>Отменено</option>
                  <option value={6}>Отклонено</option>
                  <option value={7}>Архив</option>
                </select>
              </label>
              <label>
                Город
                <select name="cityId" value={vacancyForm.cityId} onChange={onVacancyInputChange}>
                  <option value="">Не выбран</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Локация
                <select name="locationId" value={vacancyForm.locationId} onChange={onVacancyInputChange} disabled={!vacancyForm.cityId}>
                  <option value="">Не выбрана</option>
                  {vacancyLocations.map((location) => (
                    <option key={location.id} value={location.id}>{locationLabel(location)}</option>
                  ))}
                </select>
              </label>
              <label>Зарплата от<input name="salaryFrom" value={vacancyForm.salaryFrom} onChange={onVacancyInputChange} /></label>
              <label>Зарплата до<input name="salaryTo" value={vacancyForm.salaryTo} onChange={onVacancyInputChange} /></label>
              <label>Валюта<input name="currencyCode" value={vacancyForm.currencyCode} onChange={onVacancyInputChange} /></label>
              <label>
                Налоги
                <select name="salaryTaxMode" value={vacancyForm.salaryTaxMode} onChange={onVacancyInputChange}>
                  <option value={1}>До вычета</option>
                  <option value={2}>После вычета</option>
                  <option value={3}>Не указано</option>
                </select>
              </label>
              <label>Дата публикации<input type="datetime-local" name="publishAt" value={vacancyForm.publishAt} onChange={onVacancyInputChange} required /></label>
              <label>Дедлайн откликов<input type="datetime-local" name="applicationDeadline" value={vacancyForm.applicationDeadline} onChange={onVacancyInputChange} /></label>
              <div className="favorite-card__actions full-width">
                <button type="submit" className="btn btn--primary" disabled={savingVacancy}>
                  {savingVacancy ? 'Сохраняем...' : editingVacancyId ? 'Обновить вакансию' : 'Создать вакансию'}
                </button>
                {editingVacancyId ? <button type="button" className="btn btn--ghost" onClick={resetVacancyForm}>Отменить редактирование</button> : null}
              </div>
            </form>

            <div className="favorite-list">
              {vacancies.map((item) => (
                <article key={item.id} className="favorite-card">
                  <div className="favorite-card__head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>Компания ID: {item.companyId}</p>
                    </div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{vacancyKindLabel[item.kind] ?? `Вид ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Формат ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditVacancy(item)}>Редактировать</button>
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
                <input
                  value={opportunitiesSearch}
                  onChange={(event) => setOpportunitiesSearch(event.target.value)}
                  placeholder="Поиск по заголовку"
                />
                <button type="button" className="btn btn--ghost" onClick={() => void loadOpportunities()}>Найти</button>
              </div>
            </div>

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitOpportunity}>
              <h3>{editingOpportunityId ? `Редактирование мероприятия #${editingOpportunityId}` : 'Создание мероприятия'}</h3>
              <label>ID компании<input name="companyId" value={opportunityForm.companyId} onChange={onOpportunityInputChange} required /></label>
              <label>ID автора<input name="createdByUserId" value={opportunityForm.createdByUserId} onChange={onOpportunityInputChange} required /></label>
              <label className="full-width">Название<input name="title" value={opportunityForm.title} onChange={onOpportunityInputChange} required /></label>
              <label className="full-width">Краткое описание<textarea rows={2} name="shortDescription" value={opportunityForm.shortDescription} onChange={onOpportunityInputChange} required /></label>
              <label className="full-width">Полное описание<textarea rows={3} name="fullDescription" value={opportunityForm.fullDescription} onChange={onOpportunityInputChange} required /></label>
              <label>
                Вид
                <select name="kind" value={opportunityForm.kind} onChange={onOpportunityInputChange}>
                  <option value={1}>Хакатон</option>
                  <option value={2}>День открытых дверей</option>
                  <option value={3}>Лекция</option>
                  <option value={4}>Другое</option>
                </select>
              </label>
              <label>
                Формат
                <select name="format" value={opportunityForm.format} onChange={onOpportunityInputChange}>
                  <option value={1}>Офис</option>
                  <option value={2}>Гибрид</option>
                  <option value={3}>Удаленно</option>
                </select>
              </label>
              <label>
                Статус
                <select name="status" value={opportunityForm.status} onChange={onOpportunityInputChange}>
                  <option value={1}>Черновик</option>
                  <option value={2}>На модерации</option>
                  <option value={3}>Активно</option>
                  <option value={4}>Завершено</option>
                  <option value={5}>Отменено</option>
                  <option value={6}>Отклонено</option>
                  <option value={7}>Архив</option>
                </select>
              </label>
              <label>
                Город
                <select name="cityId" value={opportunityForm.cityId} onChange={onOpportunityInputChange}>
                  <option value="">Не выбран</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Локация
                <select name="locationId" value={opportunityForm.locationId} onChange={onOpportunityInputChange} disabled={!opportunityForm.cityId}>
                  <option value="">Не выбрана</option>
                  {opportunityLocations.map((location) => (
                    <option key={location.id} value={location.id}>{locationLabel(location)}</option>
                  ))}
                </select>
              </label>
              <label>
                Тип цены
                <select name="priceType" value={opportunityForm.priceType} onChange={onOpportunityInputChange}>
                  <option value={1}>Бесплатно</option>
                  <option value={2}>Платно</option>
                  <option value={3}>Приз</option>
                </select>
              </label>
              <label>Сумма<input name="priceAmount" value={opportunityForm.priceAmount} onChange={onOpportunityInputChange} /></label>
              <label>Валюта<input name="priceCurrencyCode" value={opportunityForm.priceCurrencyCode} onChange={onOpportunityInputChange} /></label>
              <label className="employer-checkbox">
                <input type="checkbox" name="participantsCanWrite" checked={opportunityForm.participantsCanWrite} onChange={onOpportunityInputChange} />
                Участники могут писать в чат
              </label>
              <label>Дата публикации<input type="datetime-local" name="publishAt" value={opportunityForm.publishAt} onChange={onOpportunityInputChange} required /></label>
              <label>Дата события<input type="datetime-local" name="eventDate" value={opportunityForm.eventDate} onChange={onOpportunityInputChange} /></label>
              <div className="favorite-card__actions full-width">
                <button type="submit" className="btn btn--primary" disabled={savingOpportunity}>
                  {savingOpportunity ? 'Сохраняем...' : editingOpportunityId ? 'Обновить мероприятие' : 'Создать мероприятие'}
                </button>
                {editingOpportunityId ? <button type="button" className="btn btn--ghost" onClick={resetOpportunityForm}>Отменить редактирование</button> : null}
              </div>
            </form>

            <div className="favorite-list">
              {opportunities.map((item) => (
                <article key={item.id} className="favorite-card">
                  <div className="favorite-card__head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>Компания ID: {item.companyId}</p>
                    </div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Статус ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{opportunityKindLabel[item.kind] ?? `Вид ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Формат ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditOpportunity(item)}>Редактировать</button>
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
