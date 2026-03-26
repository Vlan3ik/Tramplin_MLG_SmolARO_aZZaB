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
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reference data.')
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
      setError('Select a company.')
      return
    }

    if (!Number.isInteger(createdByUserId) || createdByUserId <= 0) {
      setError('Select an author user.')
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
      setSuccess('Vacancy created successfully.')
      setForm(getInitialForm())
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create vacancy.')
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
            <h1>Create Vacancy</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator">
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          </div>
          <p className="status-line">Separate workspace for vacancy creation with all required references.</p>

          {loadingRefs ? <p>Loading references...</p> : null}
          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback">{success}</div> : null}

          <form className="form-grid form-grid--two" onSubmit={onSubmit}>
            <label>
              Company
              <select name="companyId" value={form.companyId} onChange={onInputChange} required>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.brandName || company.legalName} (#{company.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Author user
              <select name="createdByUserId" value={form.createdByUserId} onChange={onInputChange} required>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} (#{user.id})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Title
              <input name="title" value={form.title} onChange={onInputChange} required />
            </label>
            <label>
              Publish at
              <input type="datetime-local" name="publishAt" value={form.publishAt} onChange={onInputChange} required />
            </label>

            <label>
              Kind
              <select name="kind" value={form.kind} onChange={onInputChange}>
                <option value={1}>Internship</option>
                <option value={2}>Job</option>
              </select>
            </label>
            <label>
              Format
              <select name="format" value={form.format} onChange={onInputChange}>
                <option value={1}>Office</option>
                <option value={2}>Hybrid</option>
                <option value={3}>Remote</option>
              </select>
            </label>

            <label>
              Status
              <select name="status" value={form.status} onChange={onInputChange}>
                <option value={1}>Draft</option>
                <option value={2}>On moderation</option>
                <option value={3}>Active</option>
                <option value={4}>Finished</option>
                <option value={5}>Canceled</option>
                <option value={6}>Rejected</option>
                <option value={7}>Archive</option>
              </select>
            </label>
            <label>
              City (optional)
              <select name="cityId" value={form.cityId} onChange={onInputChange}>
                <option value="">No city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Location ID (optional)
              <input name="locationId" value={form.locationId} onChange={onInputChange} />
            </label>
            <label>
              Application deadline (optional)
              <input type="datetime-local" name="applicationDeadline" value={form.applicationDeadline} onChange={onInputChange} />
            </label>

            <label>
              Salary from (optional)
              <input type="number" name="salaryFrom" value={form.salaryFrom} onChange={onInputChange} />
            </label>
            <label>
              Salary to (optional)
              <input type="number" name="salaryTo" value={form.salaryTo} onChange={onInputChange} />
            </label>

            <label>
              Currency
              <input name="currencyCode" value={form.currencyCode} onChange={onInputChange} />
            </label>
            <label>
              Tax mode
              <select name="salaryTaxMode" value={form.salaryTaxMode} onChange={onInputChange}>
                <option value={1}>Gross</option>
                <option value={2}>Net</option>
                <option value={3}>Undefined</option>
              </select>
            </label>

            <label className="full-width">
              Short description
              <textarea rows={3} name="shortDescription" value={form.shortDescription} onChange={onInputChange} required />
            </label>
            <label className="full-width">
              Full description
              <textarea rows={5} name="fullDescription" value={form.fullDescription} onChange={onInputChange} required />
            </label>

            <div className="favorite-card__actions full-width">
              <button type="submit" className="btn btn--primary" disabled={isSaving || loadingRefs}>
                <BriefcaseBusiness size={14} /> {isSaving ? 'Creating...' : 'Create vacancy'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}
