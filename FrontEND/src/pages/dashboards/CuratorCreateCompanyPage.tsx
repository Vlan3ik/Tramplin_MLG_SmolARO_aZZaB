import { ArrowLeft, Building2 } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  createAdminCompany,
  updateAdminCompany,
  type AdminCompany,
  type AdminCompanyUpsertRequest,
} from '../../api/admin'
import { fetchCities } from '../../api/catalog'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import type { City } from '../../types/catalog'

function getInitialForm() {
  return {
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
  }
}

function mapCompanyToForm(company: AdminCompany) {
  return {
    legalName: company.legalName,
    brandName: company.brandName,
    legalType: 1,
    taxId: '',
    registrationNumber: '',
    industry: company.industry,
    description: '',
    baseCityId: company.baseCityId > 0 ? String(company.baseCityId) : '',
    websiteUrl: '',
    publicEmail: '',
    publicPhone: '',
    status: company.status,
  }
}

export function CuratorCreateCompanyPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const routeState = location.state as { company?: AdminCompany } | null
  const companyIdParam = Number(searchParams.get('companyId'))
  const editingCompanyId = Number.isInteger(companyIdParam) && companyIdParam > 0 ? companyIdParam : null
  const isEditMode = editingCompanyId !== null

  const [form, setForm] = useState(getInitialForm)
  const [cities, setCities] = useState<City[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isFormReady, setIsFormReady] = useState(!isEditMode)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const stateCompany = useMemo(() => {
    if (!isEditMode) return null
    if (!routeState?.company) return null
    return routeState.company.id === editingCompanyId ? routeState.company : null
  }, [editingCompanyId, isEditMode, routeState])

  useEffect(() => {
    let active = true

    setLoadingRefs(true)
    fetchCities()
      .then((citiesResponse) => {
        if (!active) return
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
    if (!isEditMode) {
      setForm(getInitialForm())
      setIsFormReady(true)
      return
    }

    if (!stateCompany) {
      setError('Не удалось загрузить компанию для редактирования. Откройте форму из списка компаний.')
      setIsFormReady(false)
      return
    }

    setForm(mapCompanyToForm(stateCompany))
    setError('')
    setIsFormReady(true)
  }, [isEditMode, stateCompany])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((state) => ({
      ...state,
      [name]: name === 'legalType' || name === 'status' ? Number(value) : value,
    }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const cityId = Number(form.baseCityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setError('Выберите базовый город компании.')
      return
    }

    const payload: AdminCompanyUpsertRequest = {
      legalName: form.legalName,
      brandName: form.brandName,
      legalType: form.legalType,
      taxId: form.taxId,
      registrationNumber: form.registrationNumber,
      industry: form.industry,
      description: form.description,
      baseCityId: cityId,
      websiteUrl: form.websiteUrl,
      publicEmail: form.publicEmail,
      publicPhone: form.publicPhone,
      status: form.status,
    }

    setIsSaving(true)
    try {
      if (editingCompanyId) {
        await updateAdminCompany(editingCompanyId, payload)
        setSuccess('Компания успешно обновлена.')
      } else {
        await createAdminCompany(payload)
        setSuccess('Компания успешно создана.')
        setForm(getInitialForm())
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : isEditMode ? 'Не удалось обновить компанию.' : 'Не удалось создать компанию.')
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
            <h1>{isEditMode ? `Редактирование компании #${editingCompanyId}` : 'Создание компании'}</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator">
              <ArrowLeft size={14} /> Назад в кабинет
            </Link>
          </div>
          <p className="status-line">
            {isEditMode
              ? 'Отдельная страница редактирования компании.'
              : 'Отдельная страница создания, чтобы не перегружать кабинет куратора.'}
          </p>
          {isEditMode ? <p className="status-line">Для редактирования нужно заполнить обязательные юридические поля компании.</p> : null}

          {loadingRefs ? <p>Загружаем справочники...</p> : null}
          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback">{success}</div> : null}

          <form className="form-grid form-grid--two" onSubmit={onSubmit}>
            <label>
              Юридическое название
              <input name="legalName" value={form.legalName} onChange={onInputChange} required />
            </label>
            <label>
              Бренд
              <input name="brandName" value={form.brandName} onChange={onInputChange} />
            </label>
            <label>
              Тип
              <select name="legalType" value={form.legalType} onChange={onInputChange}>
                <option value={1}>Юридическое лицо</option>
                <option value={2}>ИП</option>
              </select>
            </label>
            <label>
              ИНН
              <input name="taxId" value={form.taxId} onChange={onInputChange} required />
            </label>
            <label>
              Регистрационный номер
              <input name="registrationNumber" value={form.registrationNumber} onChange={onInputChange} required />
            </label>
            <label>
              Индустрия
              <input name="industry" value={form.industry} onChange={onInputChange} required />
            </label>
            <label>
              Базовый город
              <select name="baseCityId" value={form.baseCityId} onChange={onInputChange} required>
                <option value="">Выберите город</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Статус
              <select name="status" value={form.status} onChange={onInputChange}>
                <option value={1}>Черновик</option>
                <option value={2}>На верификации</option>
                <option value={3}>Подтверждена</option>
                <option value={4}>Отклонена</option>
                <option value={5}>Заблокирована</option>
              </select>
            </label>
            <label>
              Сайт
              <input name="websiteUrl" value={form.websiteUrl} onChange={onInputChange} />
            </label>
            <label>
              Публичный email
              <input name="publicEmail" value={form.publicEmail} onChange={onInputChange} />
            </label>
            <label>
              Публичный телефон
              <input name="publicPhone" value={form.publicPhone} onChange={onInputChange} />
            </label>
            <label className="full-width">
              Описание
              <textarea rows={4} name="description" value={form.description} onChange={onInputChange} required />
            </label>

            <div className="favorite-card__actions full-width">
              <button type="submit" className="btn btn--primary" disabled={isSaving || !isFormReady || loadingRefs}>
                <Building2 size={14} /> {isSaving ? (isEditMode ? 'Обновляем...' : 'Создаем...') : isEditMode ? 'Обновить компанию' : 'Создать компанию'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

