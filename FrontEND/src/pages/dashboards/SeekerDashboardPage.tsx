import { DashboardLayout } from '../../components/dashboard/DashboardLayout'
import { OpportunityCard } from '../../components/home/OpportunityCard'
import { opportunities } from '../../data/mockData'

const menu = [
  'Обзор',
  'Профиль',
  'Резюме и портфолио',
  'Мои отклики',
  'Избранное',
  'Профессиональные контакты',
  'Приватность',
]

export function SeekerDashboardPage() {
  return (
    <DashboardLayout
      title="Личный кабинет соискателя"
      subtitle="Управление профилем, откликами, избранными возможностями и профессиональными контактами"
      navItems={menu}
    >
      <section id="section-0" className="dashboard-section card">
        <h2>Обзор</h2>
        <div className="stat-grid">
          <article>
            <strong>78%</strong>
            <span>Заполненность профиля</span>
          </article>
          <article>
            <strong>12</strong>
            <span>Новых рекомендаций</span>
          </article>
          <article>
            <strong>5</strong>
            <span>Активных откликов</span>
          </article>
          <article>
            <strong>2</strong>
            <span>Ближайших мероприятия</span>
          </article>
        </div>
      </section>

      <section id="section-1" className="dashboard-section card">
        <h2>Профиль</h2>
        <div className="two-col-grid">
          <div>
            <p>ФИО: Иван Петров</p>
            <p>ВУЗ: МГТУ им. Баумана</p>
            <p>Курс / выпуск: 4 курс, 2027</p>
            <p>Город: Москва</p>
          </div>
          <div>
            <p>Навыки: React, TypeScript, Node.js, PostgreSQL</p>
            <p>Проекты: 5 учебных и pet-проектов</p>
            <p>Опыт: 1 стажировка, 2 хакатона</p>
            <p>Репозитории: github.com/ivan-dev</p>
          </div>
        </div>
      </section>

      <section id="section-2" className="dashboard-section card">
        <h2>Резюме и портфолио</h2>
        <p>Карьерные интересы: Frontend, Product Discovery, UX-инженерия.</p>
        <p>Предпочитаемый формат работы: гибрид / удалённо.</p>
      </section>

      <section id="section-3" className="dashboard-section card">
        <h2>Мои отклики</h2>
        <div className="status-table">
          <div>
            <span>Frontend Engineer</span>
            <span className="status-chip status-chip--success">Принят</span>
          </div>
          <div>
            <span>Data Internship</span>
            <span className="status-chip status-chip--danger">Отклонен</span>
          </div>
          <div>
            <span>Product Mentorship</span>
            <span className="status-chip status-chip--warning">В резерве</span>
          </div>
        </div>
      </section>

      <section id="section-4" className="dashboard-section card">
        <h2>Избранное</h2>
        <div className="similar-list">
          {opportunities.slice(0, 3).map((item) => (
            <OpportunityCard key={item.id} opportunity={item} compact />
          ))}
        </div>
      </section>

      <section id="section-5" className="dashboard-section card">
        <h2>Профессиональные контакты</h2>
        <ul>
          <li>Анна Кузнецова - Senior Frontend Engineer - рекомендация подтверждена</li>
          <li>Олег Смирнов - Product Manager - менторский контакт</li>
          <li>Екатерина Ли - Recruiter - карьерная консультация</li>
        </ul>
      </section>

      <section id="section-6" className="dashboard-section card">
        <h2>Приватность</h2>
        <div className="toggle-list">
          <label className="toggle-item">
            <span>Показывать профиль работодателям</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="toggle-item">
            <span>Открыть резюме для подтверждённых компаний</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="toggle-item">
            <span>Скрыть историю откликов</span>
            <input type="checkbox" />
          </label>
        </div>
      </section>
    </DashboardLayout>
  )
}

