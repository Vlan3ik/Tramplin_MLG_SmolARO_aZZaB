import { Building2, Eye, EyeOff, UserCircle2 } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { PlatformRole } from '../types/auth'
import { createAuthSession, getPostRegisterRoute } from '../utils/auth'

type RegisterFormState = {
  fullName: string
  email: string
  password: string
}

const initialFormState: RegisterFormState = {
  fullName: '',
  email: '',
  password: '',
}

const roleOptions = [
  {
    role: PlatformRole.Seeker,
    title: 'Соискатель',
    subtitle: 'Поиск возможностей, отклики, портфолио и карьерный трек.',
    emailPlaceholder: 'name@mail.com',
    icon: UserCircle2,
  },
  {
    role: PlatformRole.Employer,
    title: 'Работодатель',
    subtitle: 'Размещение вакансий, стажировок и управление откликами.',
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

  const activeRole = useMemo(() => roleOptions.find((option) => option.role === selectedRole) ?? roleOptions[0], [selectedRole])

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

    const fullName = formState.fullName.trim()
    const email = formState.email.trim()
    const password = formState.password

    if (!fullName || !email || !password) {
      setErrorMessage('Заполните отображаемое имя, email и пароль.')
      return
    }

    const [firstName, ...lastNameParts] = fullName.split(/\s+/)
    const lastName = lastNameParts.join(' ') || firstName

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const response = await registerUser({
        email,
        password,
        firstName,
        lastName,
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
    <section className="auth-layout auth-layout--register">
      <img className="auth-layout__art auth-layout__art--left" src="/regauthphoto.svg" alt="" aria-hidden="true" />
      <img className="auth-layout__art auth-layout__art--right" src="/regauthphoto2.svg" alt="" aria-hidden="true" />

      <div className="auth-panel">
        <h1 className="auth-panel__title">Регистрация</h1>
        <p className="auth-panel__subtitle">Создайте аккаунт и начните строить карьерный маршрут в IT</p>

        <div className="auth-role-grid" aria-label="Выбор роли пользователя">
          {roleOptions.map((option) => {
            const Icon = option.icon
            const isActive = option.role === selectedRole

            return (
              <button
                key={option.role}
                type="button"
                className={`auth-role-card ${isActive ? 'auth-role-card--active' : ''}`}
                onClick={() => setSelectedRole(option.role)}
                aria-pressed={isActive}
              >
                <div className="auth-role-card__head">
                  <Icon size={20} />
                  <strong>{option.title}</strong>
                </div>
                <span>{option.subtitle}</span>
              </button>
            )
          })}
        </div>

        <form className="auth-form-grid" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder={activeRole.emailPlaceholder}
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Отображаемое имя</span>
            <input
              name="fullName"
              type="text"
              value={formState.fullName}
              onChange={handleChange}
              placeholder="Иван Петров"
              autoComplete="name"
            />
          </label>

          <label className="auth-field">
            <span>Пароль</span>
            <div className="auth-password">
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
                className="auth-password__toggle"
                onClick={() => setIsPasswordVisible((currentState) => !currentState)}
                aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {errorMessage ? <div className="auth-feedback auth-feedback--error">{errorMessage}</div> : null}

          <button type="submit" className="auth-action auth-action--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </button>
        </form>

        <button type="button" className="auth-action auth-action--vk">
          Войти через VK
        </button>

        <div className="auth-footer-links">
          <Link to="/login">Уже есть аккаунт? Войти</Link>
        </div>
      </div>
    </section>
  )
}
