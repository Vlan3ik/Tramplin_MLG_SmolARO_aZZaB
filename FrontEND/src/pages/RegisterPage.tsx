import { Building2, BriefcaseBusiness, Eye, EyeOff, UserCircle2 } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { PlatformRole } from '../types/auth'
import { createAuthSession, getPostRegisterRoute } from '../utils/auth'

type RegisterFormState = {
  displayName: string
  email: string
  password: string
}

const initialFormState: RegisterFormState = {
  displayName: '',
  email: '',
  password: '',
}

const roleOptions = [
  {
    role: PlatformRole.Seeker,
    title: 'Соискатель',
    subtitle: 'Поиск возможностей, отклики, портфолио и карьерный трек.',
    accent: 'При регистрации будет отправлен role: 1.',
    hint: 'После регистрации откроется кабинет соискателя.',
    emailPlaceholder: 'name@mail.com',
    icon: UserCircle2,
  },
  {
    role: PlatformRole.Employer,
    title: 'Работодатель',
    subtitle: 'Размещение вакансий, стажировок и управление откликами.',
    accent: 'При регистрации будет отправлен role: 2.',
    hint: 'После регистрации откроется страница верификации работодателя.',
    emailPlaceholder: 'hr@company.com',
    icon: Building2,
  },
] as const

export function RegisterPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.Seeker)
  const [formState, setFormState] = useState(initialFormState)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const activeRole = useMemo(
    () => roleOptions.find((option) => option.role === selectedRole) ?? roleOptions[0],
    [selectedRole],
  )

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as keyof RegisterFormState
    const { value } = event.target

    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const displayName = formState.displayName.trim()
    const email = formState.email.trim()
    const password = formState.password

    if (!displayName || !email || !password) {
      setErrorMessage('Заполните отображаемое имя, email и пароль.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const response = await registerUser({
        email,
        password,
        displayName,
        role: selectedRole,
      })

      const session = createAuthSession(response, selectedRole)
      signIn(session)

      navigate(getPostRegisterRoute(selectedRole), { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось завершить регистрацию.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-screen container auth-screen--split">
      <div className="auth-form card">
        <div className="brand">
          <span className="brand__dot" />
          Трамплин
        </div>
        <h1>Регистрация</h1>
        <p>Создайте аккаунт и начните строить карьерный маршрут в IT.</p>

        <div className="role-cards" aria-label="Выбор роли пользователя">
          {roleOptions.map((option) => {
            const Icon = option.icon
            const isActive = option.role === selectedRole

            return (
              <button
                key={option.role}
                type="button"
                className={`role-card ${isActive ? 'role-card--active' : ''}`}
                onClick={() => setSelectedRole(option.role)}
                aria-pressed={isActive}
              >
                <Icon size={20} />
                <strong>{option.title}</strong>
                <span>{option.subtitle}</span>
              </button>
            )
          })}
        </div>

        <div key={selectedRole} className="role-preview">
          <div className="role-preview__icon">
            <BriefcaseBusiness size={18} />
          </div>
          <div className="role-preview__content">
            <strong>{activeRole.accent}</strong>
            <p>{activeRole.hint}</p>
          </div>
          <div className="role-preview__badge">role: {selectedRole}</div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder={activeRole.emailPlaceholder}
              autoComplete="email"
            />
          </label>
          <label>
            Отображаемое имя
            <input
              name="displayName"
              type="text"
              value={formState.displayName}
              onChange={handleChange}
              placeholder="Иван Петров"
              autoComplete="name"
            />
          </label>
          <label>
            Пароль
            <div className="password-field">
              <input
                name="password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={formState.password}
                onChange={handleChange}
                placeholder="Не менее 8 символов"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-field__toggle"
                onClick={() => setIsPasswordVisible((currentState) => !currentState)}
                aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {errorMessage ? <div className="auth-feedback auth-feedback--error">{errorMessage}</div> : null}

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Уже есть аккаунт? Войти</Link>
        </div>
      </div>

      <aside className="auth-side card">
        <h2>Почему Трамплин</h2>
        <ul>
          <li>Одна платформа для вакансий, стажировок, менторства и событий.</li>
          <li>Проверенные компании и прозрачные статусы откликов.</li>
          <li>Рекомендации на основе навыков, стека и карьерных целей.</li>
          <li>Инструменты для роста портфолио и профессиональных контактов.</li>
        </ul>
      </aside>
    </section>
  )
}
