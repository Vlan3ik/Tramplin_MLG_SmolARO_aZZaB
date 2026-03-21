import { LogOut } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logoUrl from '../../assets/logo.svg'
import { useAuth } from '../../hooks/useAuth'

const menuItems: Array<{ label: string; to?: string }> = [
  { label: 'Вакансии', to: '/' },
  { label: 'Мероприятия' },
  { label: 'Компании', to: '/companies' },
  { label: 'Резюме' },
]

export function MainHeader() {
  const navigate = useNavigate()
  const { isAuthenticated, signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="main-header">
      <div className="container main-header__inner">
        <Link to="/" className="brand" aria-label="На главную">
          <img src={logoUrl} alt="Трамплин" className="brand__logo" />
        </Link>

        <nav className="main-nav" aria-label="Основная навигация">
          {menuItems.map((item) =>
            item.to ? (
              <NavLink key={item.label} to={item.to} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ) : (
              <span key={item.label} className="main-nav__placeholder" aria-disabled="true">
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="main-header__actions">
          {isAuthenticated ? (
            <button type="button" className="btn btn--ghost" onClick={handleLogout}>
              <LogOut size={16} />
              Выйти
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost">
                Войти
              </Link>
              <Link to="/register" className="btn btn--primary">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
