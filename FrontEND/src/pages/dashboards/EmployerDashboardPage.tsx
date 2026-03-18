import { DashboardLayout } from '../../components/dashboard/DashboardLayout'

const menu = ['Обзор', 'Профиль компании', 'Создать возможность', 'Мои возможности', 'Отклики', 'Аналитика', 'Верификация']

export function EmployerDashboardPage() {
  return (
    <DashboardLayout
      title="Личный кабинет работодателя"
      subtitle="Управление профилем компании, публикациями и откликами кандидатов"
      navItems={menu}
    >
      <section id="section-0" className="dashboard-section card">
        <h2>Обзор</h2>
        <div className="stat-grid">
          <article>
            <strong>8</strong>
            <span>Активных возможностей</span>
          </article>
          <article>
            <strong>34</strong>
            <span>Новых отклика</span>
          </article>
          <article>
            <strong>Подтверждено</strong>
            <span>Статус компании</span>
          </article>
          <article>
            <strong>12 840</strong>
            <span>Просмотров карточек</span>
          </article>
        </div>
      </section>

      <section id="section-1" className="dashboard-section card">
        <h2>Профиль компании</h2>
        <p>Название, описание, сфера, сайт, соцсети, медиа и бренд-блок редактируются в едином модуле.</p>
      </section>

      <section id="section-2" className="dashboard-section card">
        <h2>Создать возможность</h2>
        <form className="form-grid form-grid--two">
          <label>
            Название
            <input type="text" placeholder="Junior Frontend Engineer" />
          </label>
          <label>
            Тип
            <select>
              <option>Вакансия</option>
              <option>Стажировка</option>
              <option>Менторская программа</option>
              <option>Мероприятие</option>
            </select>
          </label>
          <label>
            Формат
            <input type="text" placeholder="Гибрид / Онлайн / Офис" />
          </label>
          <label>
            Место
            <input type="text" placeholder="Москва" />
          </label>
          <label>
            Дата / срок действия
            <input type="text" placeholder="до 30 апреля" />
          </label>
          <label>
            Теги и навыки
            <input type="text" placeholder="React, TypeScript, API" />
          </label>
          <label className="full-width">
            Описание
            <textarea placeholder="Подробное описание возможности" rows={4} />
          </label>
          <button type="submit" className="btn btn--primary full-width">
            Сохранить и опубликовать
          </button>
        </form>
      </section>

      <section id="section-3" className="dashboard-section card">
        <h2>Мои возможности</h2>
        <div className="tab-row">
          {['Активные', 'Закрытые', 'Запланированные', 'Черновики', 'На модерации'].map((tab, index) => (
            <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section id="section-4" className="dashboard-section card">
        <h2>Отклики</h2>
        <div className="status-table">
          <div>
            <span>Иван Петров - Frontend Engineer</span>
            <span className="status-chip status-chip--success">Приглашен</span>
          </div>
          <div>
            <span>Анна Соколова - Data Intern</span>
            <span className="status-chip status-chip--warning">На рассмотрении</span>
          </div>
          <div>
            <span>Дмитрий Орлов - QA Engineer</span>
            <span className="status-chip status-chip--danger">Отклонен</span>
          </div>
        </div>
      </section>

      <section id="section-5" className="dashboard-section card">
        <h2>Аналитика</h2>
        <p>Воронка откликов, конверсия в интервью и эффективность каналов привлечения кандидатов.</p>
      </section>

      <section id="section-6" className="dashboard-section card">
        <h2>Верификация</h2>
        <p>История проверок, загруженные документы и взаимодействие с кураторской командой платформы.</p>
      </section>
    </DashboardLayout>
  )
}

