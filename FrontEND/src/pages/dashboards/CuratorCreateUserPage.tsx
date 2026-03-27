import { ArrowLeft, Copy, KeyRound, Paperclip, Save, UserPlus } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createAdminUser,
  fetchAdminUserById,
  resetAdminUserPassword,
  updateAdminUser,
  uploadAdminUserAvatar,
  type AdminUser,
  type AdminUserUpsertRequest,
} from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { useAuth } from '../../hooks/useAuth'

type UserEditorForm = {
  email: string
  username: string
  fio: string
  status: number
  seeker: boolean
  employer: boolean
  adminAccess: boolean
  curatorAccess: boolean
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase()
}

function getInitialForm(): UserEditorForm {
  return {
    email: '',
    username: '',
    fio: '',
    status: 1,
    seeker: false,
    employer: true,
    adminAccess: false,
    curatorAccess: false,
  }
}

function mapUserToForm(user: AdminUser): UserEditorForm {
  const roles = user.roles.map(normalizeRole)
  return {
    email: user.email,
    username: user.username,
    fio: user.fio,
    status: user.status,
    seeker: roles.includes('seeker'),
    employer: roles.includes('employer'),
    adminAccess: roles.includes('admin'),
    curatorAccess: roles.includes('curator'),
  }
}

export function CuratorCreateUserPage() {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()

  const userIdParam = Number(searchParams.get('userId'))
  const editingUserId = Number.isInteger(userIdParam) && userIdParam > 0 ? userIdParam : null
  const isEditMode = editingUserId !== null

  const currentRoles = useMemo(() => (session?.user?.roles ?? []).map(normalizeRole), [session?.user?.roles])
  const isSuperCurator = useMemo(() => currentRoles.includes('curator'), [currentRoles])

  const [form, setForm] = useState<UserEditorForm>(getInitialForm)
  const [loadedUser, setLoadedUser] = useState<AdminUser | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPreparing, setIsPreparing] = useState(true)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function load() {
      setIsPreparing(true)
      setGeneratedPassword('')
      setAvatarFile(null)
      setError('')
      setSuccess('')

      if (!isEditMode || !editingUserId) {
        setLoadedUser(null)
        setForm(getInitialForm())
        setIsPreparing(false)
        return
      }

      try {
        const user = await fetchAdminUserById(editingUserId)
        if (isCancelled) {
          return
        }
        setLoadedUser(user)
        setForm(mapUserToForm(user))
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователя.')
        }
      } finally {
        if (!isCancelled) {
          setIsPreparing(false)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [editingUserId, isEditMode])

  useEffect(() => {
    if (isSuperCurator) {
      return
    }

    setForm((state) => ({
      ...state,
      adminAccess: false,
      curatorAccess: false,
    }))
  }, [isSuperCurator])

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

  function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setAvatarFile(file)
    event.target.value = ''
  }

  function buildRoles() {
    const roles: number[] = []
    if (form.seeker) roles.push(1)
    if (form.employer) roles.push(2)
    if (isSuperCurator && form.adminAccess) roles.push(4)
    if (isSuperCurator && form.curatorAccess) roles.push(3)
    return Array.from(new Set(roles))
  }

  async function saveAvatarIfSelected(userId: number) {
    if (!avatarFile) {
      return ''
    }

    setIsUploadingAvatar(true)
    try {
      const avatarUrl = await uploadAdminUserAvatar(userId, avatarFile)
      setAvatarFile(null)
      return avatarUrl
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function onResetPassword() {
    if (!editingUserId) {
      return
    }

    clearMessages()
    setIsResettingPassword(true)
    try {
      const response = await resetAdminUserPassword(editingUserId)
      setGeneratedPassword(response.tempPassword)
      setSuccess('Временный пароль сгенерирован.')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Не удалось сбросить пароль.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  async function onCopyPassword() {
    if (!generatedPassword) {
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setError('Буфер обмена недоступен.')
      return
    }

    try {
      await navigator.clipboard.writeText(generatedPassword)
      setSuccess('Пароль скопирован.')
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

    if (!form.fio.trim()) {
      setError('Укажите ФИО.')
      return
    }

    const roles = buildRoles()
    if (!roles.length) {
      setError('Выберите хотя бы одну роль.')
      return
    }

    const payload: AdminUserUpsertRequest = {
      email: form.email,
      username: form.username,
      fio: form.fio,
      status: form.status,
      roles,
    }

    setIsSaving(true)
    try {
      const saved = editingUserId
        ? await updateAdminUser(editingUserId, payload)
        : await createAdminUser(payload)

      const avatarUrl = await saveAvatarIfSelected(saved.id)
      if (editingUserId) {
        const refreshed = await fetchAdminUserById(editingUserId)
        setLoadedUser(refreshed)
        setForm(mapUserToForm(refreshed))
      } else {
        setLoadedUser(saved)
        setForm(getInitialForm())
      }

      const message = editingUserId
        ? 'Пользователь обновлен.'
        : 'Пользователь создан.'
      setSuccess(avatarUrl ? `${message} Аватар загружен.` : message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : editingUserId ? 'Не удалось обновить пользователя.' : 'Не удалось создать пользователя.')
    } finally {
      setIsSaving(false)
    }
  }

  const previewTitle = form.fio.trim() || form.username.trim() || 'Новый пользователь'

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

          {isPreparing ? <p>Загрузка...</p> : null}
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

                <label className="full-width">
                  ФИО
                  <input type="text" name="fio" value={form.fio} onChange={onInputChange} required />
                </label>

                <div className="curator-user-editor__field">
                  <span>Аватар (файл)</span>
                  <label className="curator-user-editor__file-button">
                    <Paperclip size={14} />
                    Выберите файл
                    <input type="file" accept="image/*" onChange={onAvatarFileChange} />
                  </label>
                  {avatarFile ? <small>{avatarFile.name}</small> : null}
                  {isEditMode ? (
                    <small>Для существующего пользователя файл загрузится через отдельный endpoint.</small>
                  ) : null}
                </div>

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
                        <input type="checkbox" name="adminAccess" checked={form.adminAccess} onChange={onInputChange} /> Куратор (Admin)
                      </label>
                      <label className="employer-checkbox">
                        <input type="checkbox" name="curatorAccess" checked={form.curatorAccess} onChange={onInputChange} /> Super Curator
                      </label>
                    </div>
                  ) : null}
                </div>

                {isEditMode ? (
                  <div className="full-width curator-user-editor__password-block">
                    <button type="button" className="btn btn--ghost" onClick={() => void onResetPassword()} disabled={isResettingPassword}>
                      <KeyRound size={14} /> {isResettingPassword ? 'Сбрасываем...' : 'Сбросить пароль'}
                    </button>
                    {generatedPassword ? (
                      <div className="curator-user-editor__password-actions">
                        <input type="text" readOnly value={generatedPassword} />
                        <button type="button" className="btn btn--secondary" onClick={() => void onCopyPassword()}>
                          <Copy size={14} /> Копировать
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="favorite-card__actions full-width">
                  <button type="submit" className="btn btn--primary" disabled={isSaving || isUploadingAvatar}>
                    {isEditMode ? <Save size={14} /> : <UserPlus size={14} />}
                    {' '}
                    {isSaving ? 'Сохраняем...' : isEditMode ? 'Сохранить пользователя' : 'Создать пользователя'}
                  </button>
                </div>
              </form>

              <aside className="curator-user-editor__preview card">
                <h3>Карточка пользователя</h3>
                <div className="curator-user-editor__preview-head">
                  <div className="curator-user-editor__avatar">
                    {loadedUser?.avatarUrl ? <img src={loadedUser.avatarUrl} alt={previewTitle} /> : <span>{previewTitle.charAt(0).toUpperCase() || 'U'}</span>}
                  </div>
                  <div>
                    <strong>{previewTitle}</strong>
                    <p>@{form.username || 'username'}</p>
                  </div>
                </div>
                <div className="status-table">
                  <div><span>Email</span><strong>{form.email || '-'}</strong></div>
                  <div><span>Статус</span><strong>{form.status === 1 ? 'Активен' : form.status === 2 ? 'Заблокирован' : 'Удален'}</strong></div>
                  <div><span>Роли</span><strong>{[form.seeker ? 'seeker' : '', form.employer ? 'employer' : '', isSuperCurator && form.adminAccess ? 'admin' : '', isSuperCurator && form.curatorAccess ? 'curator' : ''].filter(Boolean).join(', ') || 'не выбраны'}</strong></div>
                </div>
              </aside>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  )
}
