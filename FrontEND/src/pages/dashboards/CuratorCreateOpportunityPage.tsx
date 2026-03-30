import { ArrowLeft, CalendarDays } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createAdminOpportunity,
  fetchAdminCompanies,
  fetchAdminOpportunityById,
  fetchAdminUsers,
  updateAdminOpportunity,
  type AdminCompany,
  type AdminOpportunityUpsertRequest,
  type AdminUser,
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
    kind: 4,
    format: 2,
    status: 1,
    cityId: '',
    locationId: '',
    priceType: 1,
    priceAmount: '',
    priceCurrencyCode: 'RUB',
    participantsCanWrite: true,
    publishAt: toLocalDateTimeInputValue(new Date()),
    eventDate: '',
  }
}

export function CuratorCreateOpportunityPage() {
  const [searchParams] = useSearchParams()
  const opportunityIdParam = Number(searchParams.get('opportunityId'))
  const editingOpportunityId = Number.isInteger(opportunityIdParam) && opportunityIdParam > 0 ? opportunityIdParam : null
  const isEditMode = editingOpportunityId !== null

  const [form, setForm] = useState(getInitialForm)
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [loadingOpportunity, setLoadingOpportunity] = useState(isEditMode)
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

  useEffect(() => {
    let active = true

    if (!isEditMode || !editingOpportunityId) {
      setLoadingOpportunity(false)
      setForm(getInitialForm())
      return () => {
        active = false
      }
    }

    setLoadingOpportunity(true)
    fetchAdminOpportunityById(editingOpportunityId)
      .then((opportunity) => {
        if (!active) return
        setForm({
          companyId: String(opportunity.companyId),
          createdByUserId: opportunity.createdByUserId > 0 ? String(opportunity.createdByUserId) : '',
          title: opportunity.title,
          shortDescription: opportunity.shortDescription,
          fullDescription: opportunity.fullDescription,
          kind: opportunity.kind,
          format: opportunity.format,
          status: opportunity.status,
          cityId: opportunity.cityId ? String(opportunity.cityId) : '',
          locationId: opportunity.locationId ? String(opportunity.locationId) : '',
          priceType: opportunity.priceType,
          priceAmount: opportunity.priceAmount != null ? String(opportunity.priceAmount) : '',
          priceCurrencyCode: opportunity.priceCurrencyCode ?? 'RUB',
          participantsCanWrite: opportunity.participantsCanWrite,
          publishAt: opportunity.publishAt ? toLocalDateTimeInputValue(new Date(opportunity.publishAt)) : toLocalDateTimeInputValue(new Date()),
          eventDate: opportunity.eventDate ? toLocalDateTimeInputValue(new Date(opportunity.eventDate)) : '',
        })
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить мероприятие для редактирования.')
      })
      .finally(() => {
        if (active) setLoadingOpportunity(false)
      })

    return () => {
      active = false
    }
  }, [editingOpportunityId, isEditMode])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setForm((state) => ({
      ...state,
      [name]:
        name === 'kind' || name === 'format' || name === 'status' || name === 'priceType'
          ? Number(value)
          : type === 'checkbox'
            ? checked
            : value,
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
      setError('Выберите автора мероприятия.')
      return
    }

    const payload: AdminOpportunityUpsertRequest = {
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
      priceType: form.priceType,
      priceAmount: form.priceType === 1 ? null : parseOptionalNumber(form.priceAmount),
      priceCurrencyCode: form.priceType === 1 ? null : form.priceCurrencyCode.trim() || null,
      participantsCanWrite: form.participantsCanWrite,
      publishAt: new Date(form.publishAt).toISOString(),
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : null,
    }

    setIsSaving(true)
    try {
      if (editingOpportunityId) {
        await updateAdminOpportunity(editingOpportunityId, payload)
        setSuccess('Мероприятие успешно обновлено.')
      } else {
        await createAdminOpportunity(payload)
        setSuccess('Мероприятие успешно создано.')
        setForm(getInitialForm())
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : editingOpportunityId
            ? 'Не удалось обновить мероприятие.'
            : 'Не удалось создать мероприятие.',
      )
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
            <h1>{isEditMode ? `Редактирование мероприятия #${editingOpportunityId}` : 'Создание мероприятия'}</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator/moderation">
              <ArrowLeft size={14} /> Назад в модерацию
            </Link>
          </div>

          <p className="status-line">
            {isEditMode
              ? 'Редактирование мероприятия из кабинета модерации.'
              : 'Отдельная страница создания мероприятия со всеми справочниками.'}
          </p>

          {loadingRefs ? <p>Загружаем справочники...</p> : null}
          {loadingOpportunity ? <p>Загружаем мероприятие...</p> : null}
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
              Вид мероприятия
              <select name="kind" value={form.kind} onChange={onInputChange}>
                <option value={1}>Хакатон</option>
                <option value={2}>День открытых дверей</option>
                <option value={3}>Лекция</option>
                <option value={4}>Другое</option>
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
              Дата события (необязательно)
              <input type="datetime-local" name="eventDate" value={form.eventDate} onChange={onInputChange} />
            </label>

            <label>
              Тип цены
              <select name="priceType" value={form.priceType} onChange={onInputChange}>
                <option value={1}>Бесплатно</option>
                <option value={2}>Платно</option>
                <option value={3}>Приз</option>
              </select>
            </label>
            <label>
              Сумма (для платного/призового)
              <input type="number" name="priceAmount" value={form.priceAmount} onChange={onInputChange} />
            </label>

            <label>
              Валюта
              <input name="priceCurrencyCode" value={form.priceCurrencyCode} onChange={onInputChange} />
            </label>
            <label className="employer-checkbox">
              <input type="checkbox" name="participantsCanWrite" checked={form.participantsCanWrite} onChange={onInputChange} />
              Участники могут писать в чат
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
              <button type="submit" className="btn btn--primary" disabled={isSaving || loadingRefs || loadingOpportunity}>
                <CalendarDays size={14} />{' '}
                {isSaving ? (isEditMode ? 'Сохраняем...' : 'Создаем...') : isEditMode ? 'Сохранить мероприятие' : 'Создать мероприятие'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}
