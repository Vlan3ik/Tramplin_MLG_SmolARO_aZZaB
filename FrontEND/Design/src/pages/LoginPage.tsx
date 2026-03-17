import { Link } from 'react-router-dom'

export function LoginPage() {
  return (
    <section className="auth-screen container">
      <div className="auth-form card auth-form--single">
        <div className="brand">
          <span className="brand__dot" />
          Трамплин
        </div>
        <h1>Авторизация</h1>
        <p>Войдите в аккаунт, чтобы продолжить работу с возможностями платформы.</p>

        <form className="form-grid">
          <label>
            Email
            <input type="email" placeholder="name@mail.com" />
          </label>
          <label>
            Пароль
            <input type="password" placeholder="Введите пароль" />
          </label>
          <button type="submit" className="btn btn--primary">
            Войти
          </button>
        </form>

        <div className="auth-links">
          <Link to="/register">Нет аккаунта? Зарегистрироваться</Link>
          <Link to="/dashboard/curator" className="curator-link">
            Вход куратора
          </Link>
        </div>
      </div>
    </section>
  )
}

