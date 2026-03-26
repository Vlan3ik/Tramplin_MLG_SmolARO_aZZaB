import { ArrowLeft, BriefcaseBusiness } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAdminVacancy,
  fetchAdminCompanies,
  fetchAdminUsers,
  type AdminCompany,
  type AdminUser,
  type AdminVacancyUpsertRequest,
} from '../../api/admin'
import { fetchCities } from '../../api/catalog'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import type { City } from '../../types/catalog'

function toLocalDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function getInitialForm() {
  return {
    companyId: '',
    createdByUserId: '',
    title: '',
    shortDescription: '',
    fullDescription: '',
    kind: 2,
    format: 2,
    status: 1,
    cityId: '',
    locationId: '',
    salaryFrom: '',
    salaryTo: '',
    currencyCode: 'RUB',
    salaryTaxMode: 3,
    publishAt: toLocalDateTimeInputValue(new Date()),
    applicationDeadline: '',
  }
}

export function CuratorCreateVacancyPage() {
  const [form, setForm] = useState(getInitialForm)
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    setLoadingRefs(true)
    Promise.all([fetchAdminCompanies({ page: 1, pageSize: 200 }), fetchAdminUsers({ page: 1, pageSize: 200 }), fetchCities()])
      .then(([companiesResponse, usersResponse, citiesResponse]) => {
        if (!active) return

        setCompanies(companiesResponse.items)
        setUsers(usersResponse.items)
        setCities(citiesResponse)
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить справочники.')
      })
      .finally(() => {
        if (active) setLoadingRefs(false)
      })

    return () => {
      active = false
    }
  }, [])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setForm((state) => ({
      ...state,
      [name]:
        name === 'kind' || name === 'format' || name === 'status' || name === 'salaryTaxMode' ? Number(value) : value,
    }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const companyId = Number(form.companyId)
    const createdByUserId = Number(form.createdByUserId)

    if (!Number.isInteger(companyId) || companyId <= 0) {
      setError('Выберите компанию.')
      return
    }

    if (!Number.isInteger(createdByUserId) || createdByUserId <= 0) {
      setError('Выберите автора вакансии.')
      return
    }

    const payload: AdminVacancyUpsertRequest = {
      companyId,
      createdByUserId,
      title: form.title,
      shortDescription: form.shortDescription,
      fullDescription: form.fullDescription,
      kind: form.kind,
      format: form.format,
      status: form.status,
      cityId: parseOptionalNumber(form.cityId),
      locationId: parseOptionalNumber(form.locationId),
      salaryFrom: parseOptionalNumber(form.salaryFrom),
      salaryTo: parseOptionalNumber(form.salaryTo),
      currencyCode: form.currencyCode.trim() || null,
      salaryTaxMode: form.salaryTaxMode,
      publishAt: new Date(form.publishAt).toISOString(),
      applicationDeadline: form.applicationDeadline ? new Date(form.applicationDeadline).toISOString() : null,
    }

    setIsSaving(true)
    try {
      await createAdminVacancy(payload)
      setSuccess('Вакансия успешно создана.')
      setForm(getInitialForm())
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать вакансию.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-panel admin-form-card">
          <div className="seeker-profile-panel__head">
            <h1>Создание вакансии</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator">
              <ArrowLeft size={14} /> Назад в кабинет
            </Link>
          </div>
          <p className="status-line">Отдельная страница создания вакансии со всеми справочниками.</p>

          {loadingRefs ? <p>Загружаем справочники...</p> : null}
          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback">{success}</div> : null}

          <form className="form-grid form-grid--two" onSubmit={onSubmit}>
            <label>
              Компания
              <select name="companyId" value={form.companyId} onChange={onInputChange} required>
                <option value="">Выберите компанию</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.brandName || company.legalName} (#{company.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Автор
              <select name="createdByUserId" value={form.createdByUserId} onChange={onInputChange} required>
                <option value="">Выберите пользователя</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} (#{user.id})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Название
              <input name="title" value={form.title} onChange={onInputChange} required />
            </label>
            <label>
              Дата публикации
              <input type="datetime-local" name="publishAt" value={form.publishAt} onChange={onInputChange} required />
            </label>

            <label>
              Тип
              <select name="kind" value={form.kind} onChange={onInputChange}>
                <option value={1}>Стажировка</option>
                <option value={2}>Работа</option>
              </select>
            </label>
            <label>
              Формат
              <select name="format" value={form.format} onChange={onInputChange}>
                <option value={1}>Офис</option>
                <option value={2}>Гибрид</option>
                <option value={3}>Удаленно</option>
              </select>
            </label>

            <label>
              Статус
              <select name="status" value={form.status} onChange={onInputChange}>
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
              Город (необязательно)
              <select name="cityId" value={form.cityId} onChange={onInputChange}>
                <option value="">Без города</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              ID локации (необязательно)
              <input name="locationId" value={form.locationId} onChange={onInputChange} />
            </label>
            <label>
              Срок отклика (необязательно)
              <input type="datetime-local" name="applicationDeadline" value={form.applicationDeadline} onChange={onInputChange} />
            </label>

            <label>
              Зарплата от (необязательно)
              <input type="number" name="salaryFrom" value={form.salaryFrom} onChange={onInputChange} />
            </label>
            <label>
              Зарплата до (необязательно)
              <input type="number" name="salaryTo" value={form.salaryTo} onChange={onInputChange} />
            </label>

            <label>
              Валюта
              <input name="currencyCode" value={form.currencyCode} onChange={onInputChange} />
            </label>
            <label>
              Налоговый режим
              <select name="salaryTaxMode" value={form.salaryTaxMode} onChange={onInputChange}>
                <option value={1}>До налогов</option>
                <option value={2}>После налогов</option>
                <option value={3}>Не указано</option>
              </select>
            </label>

            <label className="full-width">
              Краткое описание
              <textarea rows={3} name="shortDescription" value={form.shortDescription} onChange={onInputChange} required />
            </label>
            <label className="full-width">
              Полное описание
              <textarea rows={5} name="fullDescription" value={form.fullDescription} onChange={onInputChange} required />
            </label>

            <div className="favorite-card__actions full-width">
              <button type="submit" className="btn btn--primary" disabled={isSaving || loadingRefs}>
                <BriefcaseBusiness size={14} /> {isSaving ? 'Создаем...' : 'Создать вакансию'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

