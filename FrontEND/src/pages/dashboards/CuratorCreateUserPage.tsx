import { ArrowLeft, Copy, KeyRound, RefreshCcw, Save, UserPlus } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { createAdminUser, updateAdminUser, type AdminUser, type AdminUserUpsertRequest } from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { useAuth } from '../../hooks/useAuth'

type PasswordScenario = 'auto' | 'manual-generate' | 'unchanged' | 'reset-generate'

type UserEditorForm = {
  email: string
  username: string
  avatarUrl: string
  displayName: string
  firstName: string
  lastName: string
  status: number
  seeker: boolean
  employer: boolean
  curatorAccess: boolean
  adminAccess: boolean
  passwordScenario: PasswordScenario
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase()
}

function isSuperCuratorRole(roles: string[]) {
  return roles.some((role) => {
    const normalized = normalizeRole(role)
    return normalized.includes('super') || normalized.includes('admin') || normalized.includes('root')
  })
}

function generateReadablePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const pools = [upper, lower, digits, symbols]

  const chars: string[] = []
  pools.forEach((pool) => {
    chars.push(pool[Math.floor(Math.random() * pool.length)])
  })

  const all = `${upper}${lower}${digits}${symbols}`
  while (chars.length < 14) {
    chars.push(all[Math.floor(Math.random() * all.length)])
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1))
    ;[chars[index], chars[nextIndex]] = [chars[nextIndex], chars[index]]
  }

  return chars.join('')
}

function splitDisplayName(value: string) {
  const chunks = value.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: chunks[0] ?? '',
    lastName: chunks.slice(1).join(' '),
  }
}

function getInitialForm(): UserEditorForm {
  return {
    email: '',
    username: '',
    avatarUrl: '',
    displayName: '',
    firstName: '',
    lastName: '',
    status: 1,
    seeker: false,
    employer: true,
    curatorAccess: false,
    adminAccess: false,
    passwordScenario: 'auto',
  }
}

function mapUserToForm(user: AdminUser): UserEditorForm {
  const namesFromDisplay = splitDisplayName(user.displayName)
  const firstName = user.firstName || namesFromDisplay.firstName
  const lastName = user.lastName || namesFromDisplay.lastName

  return {
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl ?? '',
    displayName: user.displayName || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    status: user.status,
    seeker: user.roles.includes('seeker'),
    employer: user.roles.includes('employer'),
    curatorAccess: user.roles.includes('curator'),
    adminAccess: user.roles.includes('admin') || user.roles.includes('administrator'),
    passwordScenario: 'unchanged',
  }
}

export function CuratorCreateUserPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { session } = useAuth()
  const routeState = location.state as { user?: AdminUser } | null

  const userIdParam = Number(searchParams.get('userId'))
  const editingUserId = Number.isInteger(userIdParam) && userIdParam > 0 ? userIdParam : null
  const isEditMode = editingUserId !== null

  const currentRoles = useMemo(() => (session?.user?.roles ?? []).map(normalizeRole), [session?.user?.roles])
  const isSuperCurator = useMemo(() => isSuperCuratorRole(currentRoles), [currentRoles])

  const [form, setForm] = useState<UserEditorForm>(getInitialForm)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPreparing, setIsPreparing] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const stateUser = useMemo(() => {
    if (!isEditMode) return null
    if (!routeState?.user) return null
    return routeState.user.id === editingUserId ? routeState.user : null
  }, [editingUserId, isEditMode, routeState])

  useEffect(() => {
    setIsPreparing(true)
    setGeneratedPassword('')

    if (!isEditMode) {
      setForm(getInitialForm())
      setError('')
      setIsPreparing(false)
      return
    }

    if (!stateUser) {
      setError('Не удалось загрузить пользователя для редактирования. Откройте экран из списка пользователей.')
      setIsPreparing(false)
      return
    }

    setForm(mapUserToForm(stateUser))
    setError('')
    setIsPreparing(false)
  }, [isEditMode, stateUser])

  useEffect(() => {
    if (isSuperCurator) {
      return
    }

    setForm((state) => ({
      ...state,
      curatorAccess: false,
      adminAccess: false,
    }))
  }, [isSuperCurator])

  const previewTitle = form.displayName.trim() || `${form.firstName} ${form.lastName}`.trim() || form.username.trim() || 'Новый пользователь'

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

  function onGeneratePassword() {
    const nextPassword = generateReadablePassword()
    setGeneratedPassword(nextPassword)
    clearMessages()
  }

  function buildRoles() {
    const roles: number[] = []
    if (form.seeker) roles.push(1)
    if (form.employer) roles.push(2)
    if (isSuperCurator && (form.curatorAccess || form.adminAccess)) roles.push(3)
    return Array.from(new Set(roles))
  }

  async function onCopyPassword() {
    if (!generatedPassword) {
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setError('Буфер обмена недоступен в этом браузере.')
      return
    }

    try {
      await navigator.clipboard.writeText(generatedPassword)
      setSuccess('Сгенерированный пароль скопирован.')
    } catch {
      setError('Не удалось скопировать пароль.')
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    if (!form.email.trim()) {
      setError('Укажите email.')
      return
    }

    if (!form.username.trim()) {
      setError('Укажите username.')
      return
    }

    const roles = buildRoles()
    if (!roles.length) {
      setError('Выберите хотя бы одну роль пользователя.')
      return
    }

    const shouldUseGeneratedPassword = form.passwordScenario === 'manual-generate' || form.passwordScenario === 'reset-generate'
    const passwordForPayload = shouldUseGeneratedPassword ? generatedPassword || generateReadablePassword() : ''

    if (shouldUseGeneratedPassword && !generatedPassword) {
      setGeneratedPassword(passwordForPayload)
    }

    const payload: AdminUserUpsertRequest = {
      email: form.email,
      username: form.username,
      avatarUrl: form.avatarUrl,
      displayName: form.displayName,
      firstName: form.firstName,
      lastName: form.lastName,
      status: form.status,
      roles,
      password: shouldUseGeneratedPassword ? passwordForPayload : undefined,
      adminAccess: isSuperCurator ? form.adminAccess : undefined,
      curatorAccess: isSuperCurator ? form.curatorAccess : undefined,
    }

    setIsSaving(true)
    try {
      if (editingUserId) {
        const result = await updateAdminUser(editingUserId, payload)
        const serverPassword = result.generatedPassword
        if (serverPassword) {
          setGeneratedPassword(serverPassword)
        }

        setSuccess(shouldUseGeneratedPassword ? 'Пользователь обновлен. Новый пароль отображен ниже.' : 'Пользователь успешно обновлен.')
      } else {
        const result = await createAdminUser(payload)
        const serverPassword = result.generatedPassword
        if (serverPassword) {
          setGeneratedPassword(serverPassword)
        }

        setSuccess(serverPassword || shouldUseGeneratedPassword
          ? 'Пользователь создан. Пароль отображен ниже.'
          : 'Пользователь успешно создан.')

        setForm((state) => ({
          ...getInitialForm(),
          passwordScenario: state.passwordScenario,
        }))
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : isEditMode ? 'Не удалось обновить пользователя.' : 'Не удалось создать пользователя.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-panel admin-form-card curator-user-editor">
          <div className="seeker-profile-panel__head">
            <h1>{isEditMode ? `Редактирование пользователя #${editingUserId}` : 'Создание пользователя'}</h1>
            <Link className="btn btn--ghost" to="/dashboard/curator">
              <ArrowLeft size={14} /> Назад в кабинет
            </Link>
          </div>

          <p className="status-line">
            Полноценный экран управления пользователем: профиль, роли и сценарий пароля.
          </p>

          {isPreparing ? <p>Подготавливаем экран пользователя...</p> : null}
          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback">{success}</div> : null}

          {!isPreparing ? (
            <div className="curator-user-editor__layout">
              <form className="form-grid form-grid--two" onSubmit={onSubmit}>
                <label>
                  Email
                  <input type="email" name="email" value={form.email} onChange={onInputChange} required />
                </label>
                <label>
                  Username
                  <input type="text" name="username" value={form.username} onChange={onInputChange} required />
                </label>

                <label>
                  Display name / ФИО
                  <input type="text" name="displayName" value={form.displayName} onChange={onInputChange} placeholder="Иван Иванов" />
                </label>
                <label>
                  Avatar URL
                  <input type="url" name="avatarUrl" value={form.avatarUrl} onChange={onInputChange} placeholder="https://..." />
                </label>

                <label>
                  Имя
                  <input type="text" name="firstName" value={form.firstName} onChange={onInputChange} />
                </label>
                <label>
                  Фамилия
                  <input type="text" name="lastName" value={form.lastName} onChange={onInputChange} />
                </label>

                <label>
                  Статус
                  <select name="status" value={form.status} onChange={onInputChange}>
                    <option value={1}>Активен</option>
                    <option value={2}>Заблокирован</option>
                    <option value={3}>Удален</option>
                  </select>
                </label>

                <div className="full-width curator-user-editor__role-block">
                  <strong>Роли пользователя</strong>
                  <div className="admin-checkbox-row">
                    <label className="employer-checkbox">
                      <input type="checkbox" name="seeker" checked={form.seeker} onChange={onInputChange} /> Соискатель
                    </label>
                    <label className="employer-checkbox">
                      <input type="checkbox" name="employer" checked={form.employer} onChange={onInputChange} /> Работодатель
                    </label>
                  </div>

                  {isSuperCurator ? (
                    <div className="admin-checkbox-row">
                      <label className="employer-checkbox">
                        <input type="checkbox" name="curatorAccess" checked={form.curatorAccess} onChange={onInputChange} /> Куратор
                      </label>
                      <label className="employer-checkbox">
                        <input type="checkbox" name="adminAccess" checked={form.adminAccess} onChange={onInputChange} /> Admin
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="full-width curator-user-editor__password-block">
                  <strong>Сценарий пароля</strong>
                  <div className="admin-checkbox-row">
                    {!isEditMode ? (
                      <>
                        <label className="employer-checkbox">
                          <input type="radio" name="passwordScenario" value="auto" checked={form.passwordScenario === 'auto'} onChange={onInputChange} /> Автогенерация сервером
                        </label>
                        <label className="employer-checkbox">
                          <input type="radio" name="passwordScenario" value="manual-generate" checked={form.passwordScenario === 'manual-generate'} onChange={onInputChange} /> Сгенерировать вручную
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="employer-checkbox">
                          <input type="radio" name="passwordScenario" value="unchanged" checked={form.passwordScenario === 'unchanged'} onChange={onInputChange} /> Не менять пароль
                        </label>
                        <label className="employer-checkbox">
                          <input type="radio" name="passwordScenario" value="reset-generate" checked={form.passwordScenario === 'reset-generate'} onChange={onInputChange} /> Сбросить и сгенерировать новый
                        </label>
                      </>
                    )}
                  </div>

                  {form.passwordScenario === 'manual-generate' || form.passwordScenario === 'reset-generate' ? (
                    <div className="curator-user-editor__password-actions">
                      <button type="button" className="btn btn--ghost" onClick={onGeneratePassword}>
                        <RefreshCcw size={14} /> Сгенерировать пароль
                      </button>
                      <input type="text" readOnly value={generatedPassword} placeholder="Пароль появится здесь" />
                      <button type="button" className="btn btn--secondary" onClick={() => void onCopyPassword()} disabled={!generatedPassword}>
                        <Copy size={14} /> Копировать
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="favorite-card__actions full-width">
                  <button type="submit" className="btn btn--primary" disabled={isSaving}>
                    {isEditMode ? <Save size={14} /> : <UserPlus size={14} />} {isSaving ? (isEditMode ? 'Сохраняем...' : 'Создаем...') : isEditMode ? 'Сохранить пользователя' : 'Создать пользователя'}
                  </button>
                </div>
              </form>

              <aside className="curator-user-editor__preview card">
                <h3>Карточка пользователя</h3>
                <div className="curator-user-editor__preview-head">
                  <div className="curator-user-editor__avatar">
                    {form.avatarUrl.trim() ? <img src={form.avatarUrl} alt={previewTitle} /> : <span>{previewTitle.charAt(0).toUpperCase() || 'U'}</span>}
                  </div>
                  <div>
                    <strong>{previewTitle}</strong>
                    <p>@{form.username || 'username'}</p>
                  </div>
                </div>
                <div className="status-table">
                  <div><span>Email</span><strong>{form.email || '—'}</strong></div>
                  <div><span>Статус</span><strong>{form.status === 1 ? 'Активен' : form.status === 2 ? 'Заблокирован' : 'Удален'}</strong></div>
                  <div><span>Роли</span><strong>{[form.seeker ? 'seeker' : '', form.employer ? 'employer' : '', isSuperCurator && form.curatorAccess ? 'curator' : '', isSuperCurator && form.adminAccess ? 'admin' : ''].filter(Boolean).join(', ') || 'не выбраны'}</strong></div>
                </div>

                {generatedPassword ? (
                  <div className="curator-user-editor__generated card">
                    <p><KeyRound size={14} /> Новый пароль</p>
                    <code>{generatedPassword}</code>
                  </div>
                ) : null}
              </aside>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  )
}
