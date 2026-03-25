import { Eye, EyeOff } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getVkLoginUrl, loginUser, loginViaVk } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { createAuthSession, getSafeRedirectPath } from '../utils/auth'

type LoginFormState = {
  email: string
  password: string
}

type AuthRedirectState = {
  from?: string
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
}

const VK_STATE_STORAGE_KEY = 'tramplin.auth.vk.state'

function readRedirectPath(state: unknown) {
  if (!state || typeof state !== 'object') {
    return null
  }

  const redirectState = state as AuthRedirectState

  return typeof redirectState.from === 'string' ? redirectState.from : null
}

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [formState, setFormState] = useState(initialFormState)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVkSubmitting, setIsVkSubmitting] = useState(false)
  const [handledVkCode, setHandledVkCode] = useState<string | null>(null)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const redirectPath = readRedirectPath(location.state)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const vkCode = params.get('code')
    const vkState = params.get('state')

    if (!vkCode || handledVkCode === vkCode) {
      return
    }

    setHandledVkCode(vkCode)
    setErrorMessage('')

    const expectedState = window.localStorage.getItem(VK_STATE_STORAGE_KEY)
    window.localStorage.removeItem(VK_STATE_STORAGE_KEY)

    if (expectedState && vkState !== expectedState) {
      setErrorMessage('Некорректный state параметр VK.')
      navigate('/login', { replace: true, state: location.state })
      return
    }

    void (async () => {
      setIsVkSubmitting(true)

      try {
        const response = await loginViaVk(vkCode)
        const session = createAuthSession(response)
        signIn(session)
        navigate(getSafeRedirectPath(redirectPath, session.platformRole ?? null), { replace: true })
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось войти через VK.')
        navigate('/login', { replace: true, state: location.state })
      } finally {
        setIsVkSubmitting(false)
      }
    })()
  }, [handledVkCode, location.search, location.state, navigate, redirectPath, signIn])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as keyof LoginFormState
    const { value } = event.target

    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = formState.email.trim()
    const password = formState.password

    if (!email || !password) {
      setErrorMessage('Заполните email и пароль.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const response = await loginUser({
        email,
        password,
      })

      const session = createAuthSession(response)
      signIn(session)

      navigate(getSafeRedirectPath(redirectPath, session.platformRole ?? null), { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось выполнить вход.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVkLogin() {
    setErrorMessage('')
    setIsVkSubmitting(true)

    try {
      const state =
        typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`

      window.localStorage.setItem(VK_STATE_STORAGE_KEY, state)
      const response = await getVkLoginUrl(state)
      window.location.assign(response.url)
    } catch (error) {
      window.localStorage.removeItem(VK_STATE_STORAGE_KEY)
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось начать авторизацию через VK.')
      setIsVkSubmitting(false)
    }
  }

  return (
    <section className="auth-layout auth-layout--login">
      <img className="auth-layout__art auth-layout__art--left" src="/regauthphoto.svg" alt="" aria-hidden="true" />
      <img className="auth-layout__art auth-layout__art--right" src="/regauthphoto2.svg" alt="" aria-hidden="true" />

      <div className="auth-panel auth-panel--compact">
        <h1 className="auth-panel__title">Авторизация</h1>
        <p className="auth-panel__subtitle">Войдите в аккаунт, чтобы продолжить работу с возможностями платформы.</p>

        <form className="auth-form-grid" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder="name@mail.com"
              autoComplete="email"
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
                placeholder="Введите пароль"
                autoComplete="current-password"
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
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>

          <button type="button" className="auth-action auth-action--vk" disabled={isVkSubmitting} onClick={handleVkLogin}>
            {isVkSubmitting ? 'VK...' : 'Войти через VK'}
          </button>
        </form>

        <div className="auth-footer-links">
          <Link to="/register">Нет аккаунта? Зарегистрироваться</Link>
          <Link to="/dashboard/curator" className="auth-footer-links__muted">
            Вход куратора
          </Link>
        </div>
      </div>
    </section>
  )
}
