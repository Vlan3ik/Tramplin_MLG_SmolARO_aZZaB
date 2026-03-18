import { Building2, UserCircle2 } from 'lucide-react'

export function RegisterPage() {
  return (
    <section className="auth-screen container auth-screen--split">
      <div className="auth-form card">
        <div className="brand">
          <span className="brand__dot" />
          Трамплин
        </div>
        <h1>Регистрация</h1>
        <p>Создайте аккаунт и начните строить карьерный маршрут в IT.</p>

        <div className="role-cards">
          <button type="button" className="role-card role-card--active">
            <UserCircle2 size={20} />
            <strong>Соискатель</strong>
            <span>Поиск возможностей, отклики, портфолио и карьерный трек.</span>
          </button>
          <button type="button" className="role-card">
            <Building2 size={20} />
            <strong>Работодатель</strong>
            <span>Размещение вакансий, стажировок и управление откликами.</span>
          </button>
        </div>

        <form className="form-grid">
          <label>
            Email
            <input type="email" placeholder="name@company.com" />
          </label>
          <label>
            Отображаемое имя
            <input type="text" placeholder="Иван Петров" />
          </label>
          <label>
            Пароль
            <input type="password" placeholder="Не менее 8 символов" />
          </label>
          <button type="submit" className="btn btn--primary">
            Создать аккаунт
          </button>
        </form>
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

