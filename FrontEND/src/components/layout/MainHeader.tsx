import { LogOut } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const menuItems = [
  { label: 'Возможности', to: '/', isActive: (pathname: string) => pathname === '/' },
  { label: 'Компании', to: '/companies', isActive: (pathname: string) => pathname === '/companies' || pathname.startsWith('/companies/') },
  { label: 'Мероприятия', to: '/opportunity/1', isActive: (pathname: string) => pathname.startsWith('/opportunity/') },
  { label: 'О платформе', to: '/about', isActive: (pathname: string) => pathname === '/about' },
]

export function MainHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <header className="main-header">
      <div className="container main-header__inner">
        <Link to="/" className="brand">
          <span className="brand__dot" />
          Трамплин
        </Link>

        <nav className="main-nav" aria-label="Основная навигация">
          {menuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/'}
              className={item.isActive(location.pathname) ? 'is-active' : ''}
            >
              {item.label}
            </NavLink>
          ))}
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
