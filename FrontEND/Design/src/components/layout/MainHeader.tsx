import { Link, NavLink } from 'react-router-dom'

const menuItems = [
  { label: 'Возможности', to: '/' },
  { label: 'Компании', to: '/company/cloudline' },
  { label: 'Мероприятия', to: '/opportunity/1' },
  { label: 'О платформе', to: '#about' },
]

export function MainHeader() {
  return (
    <header className="main-header">
      <div className="container main-header__inner">
        <Link to="/" className="brand">
          <span className="brand__dot" />
          Трамплин
        </Link>

        <nav className="main-nav" aria-label="Основная навигация">
          {menuItems.map((item) => (
            <NavLink key={item.label} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="main-header__actions">
          <Link to="/login" className="btn btn--ghost">
            Войти
          </Link>
          <Link to="/register" className="btn btn--primary">
            Регистрация
          </Link>
        </div>
      </div>
    </header>
  )
}

