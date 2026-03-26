import { ArrowLeft, UserPlus } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { createAdminUser, type AdminUserUpsertRequest } from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'

function getInitialForm() {
  return {
    email: '',
    firstName: '',
    lastName: '',
    status: 1,
    seeker: false,
    employer: true,
    curator: false,
  }
}

export function CuratorCreateUserPage() {
  const [form, setForm] = useState(getInitialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked
    setForm((state) => ({
      ...state,
      [name]: type === 'checkbox' ? checked : name === 'status' ? Number(value) : value,
    }))
  }

  function getRoles() {
    const roles: number[] = []
    if (form.seeker) roles.push(1)
    if (form.employer) roles.push(2)
    if (form.curator) roles.push(3)
    return roles
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const roles = getRoles()
    if (!roles.length) {
      setError('Выберите хотя бы одну роль.')
      return
    }

    const payload: AdminUserUpsertRequest = {
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      status: form.status,
      roles,
    }

    setIsSaving(true)
    try {
      await createAdminUser(payload)
      setSuccess('Пользователь успешно создан.')
      setForm(getInitialForm())
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать пользователя.')
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
            <h1>Создание пользователя</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator">
              <ArrowLeft size={14} /> Назад в кабинет
            </Link>
          </div>
          <p className="status-line">Отдельная страница создания, чтобы не перегружать кабинет куратора.</p>

          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback">{success}</div> : null}

          <form className="form-grid form-grid--two" onSubmit={onSubmit}>
            <label>
              Email
              <input type="email" name="email" value={form.email} onChange={onInputChange} required />
            </label>
            <label>
              Имя
              <input type="text" name="firstName" value={form.firstName} onChange={onInputChange} required />
            </label>
            <label>
              Фамилия
              <input type="text" name="lastName" value={form.lastName} onChange={onInputChange} required />
            </label>
            <label>
              Статус
              <select name="status" value={form.status} onChange={onInputChange}>
                <option value={1}>Активен</option>
                <option value={2}>Заблокирован</option>
                <option value={3}>Удален</option>
              </select>
            </label>

            <div className="admin-checkbox-row full-width">
              <label className="employer-checkbox">
                <input type="checkbox" name="seeker" checked={form.seeker} onChange={onInputChange} /> Соискатель
              </label>
              <label className="employer-checkbox">
                <input type="checkbox" name="employer" checked={form.employer} onChange={onInputChange} /> Работодатель
              </label>
              <label className="employer-checkbox">
                <input type="checkbox" name="curator" checked={form.curator} onChange={onInputChange} /> Куратор
              </label>
            </div>

            <div className="favorite-card__actions full-width">
              <button type="submit" className="btn btn--primary" disabled={isSaving}>
                <UserPlus size={14} /> {isSaving ? 'Создаем...' : 'Создать пользователя'}
              </button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

