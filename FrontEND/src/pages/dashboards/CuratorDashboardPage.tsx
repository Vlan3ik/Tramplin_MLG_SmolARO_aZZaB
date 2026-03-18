import { DashboardLayout } from '../../components/dashboard/DashboardLayout'

const menu = ['Обзор', 'Верификация компаний', 'Модерация возможностей', 'Пользователи', 'Теги и категории', 'Кураторы', 'Настройки']

export function CuratorDashboardPage() {
  return (
    <DashboardLayout
      title="Кабинет куратора"
      subtitle="Административная панель для контроля качества платформы и модерации контента"
      navItems={menu}
    >
      <section id="section-0" className="dashboard-section card">
        <h2>Обзор</h2>
        <div className="stat-grid">
          <article>
            <strong>14</strong>
            <span>Новых заявок на верификацию</span>
          </article>
          <article>
            <strong>23</strong>
            <span>Элементов на модерации</span>
          </article>
          <article>
            <strong>97%</strong>
            <span>Проверено за SLA</span>
          </article>
          <article>
            <strong>3</strong>
            <span>Активных куратора</span>
          </article>
        </div>
      </section>

      <section id="section-1" className="dashboard-section card">
        <h2>Верификация компаний</h2>
        <div className="status-table">
          <div>
            <span>CloudLine</span>
            <span>
              <button className="btn btn--ghost" type="button">
                Подтвердить
              </button>
              <button className="btn btn--ghost" type="button">
                Запросить уточнение
              </button>
              <button className="btn btn--danger" type="button">
                Отклонить
              </button>
            </span>
          </div>
          <div>
            <span>Nova Systems</span>
            <span>
              <button className="btn btn--ghost" type="button">
                Подтвердить
              </button>
              <button className="btn btn--ghost" type="button">
                Запросить уточнение
              </button>
              <button className="btn btn--danger" type="button">
                Отклонить
              </button>
            </span>
          </div>
        </div>
      </section>

      <section id="section-2" className="dashboard-section card">
        <h2>Модерация возможностей</h2>
        <div className="moderation-grid">
          <article>
            <h3>Frontend Internship</h3>
            <p>Проверка описания и соответствия политике платформы.</p>
            <button className="btn btn--ghost" type="button">
              Быстрый просмотр
            </button>
          </article>
          <article>
            <h3>AI Career Meetup</h3>
            <p>Сверка даты, контактов и статуса организатора.</p>
            <button className="btn btn--ghost" type="button">
              Редактировать
            </button>
          </article>
        </div>
      </section>

      <section id="section-3" className="dashboard-section card">
        <h2>Пользователи</h2>
        <p>Управление статусами работодателей и соискателей, блокировки, восстановление доступа.</p>
      </section>

      <section id="section-4" className="dashboard-section card">
        <h2>Теги и категории</h2>
        <div className="pill-grid">
          {['Frontend', 'Backend', 'Data', 'DevOps', 'UX', 'Cybersecurity'].map((tag) => (
            <button key={tag} className="pill" type="button">
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section id="section-5" className="dashboard-section card">
        <h2>Кураторы</h2>
        <p>Распределение зон ответственности, рабочие очереди и контроль загрузки команды.</p>
      </section>

      <section id="section-6" className="dashboard-section card">
        <h2>Настройки</h2>
        <p>Системные параметры модерации, уведомления и политика платформы.</p>
      </section>
    </DashboardLayout>
  )
}

