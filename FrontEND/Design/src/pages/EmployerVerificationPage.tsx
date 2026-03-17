const steps = ['Данные компании', 'Подтверждение представителя', 'Проверочные документы', 'Статус проверки']

export function EmployerVerificationPage() {
  return (
    <section className="container verification-page">
      <header className="card">
        <h1>Верификация работодателя</h1>
        <p>Пошаговый мастер подтверждения компании для публикации возможностей на платформе.</p>

        <div className="stepper">
          {steps.map((step, index) => (
            <div key={step} className={`step ${index === 0 ? 'is-active' : ''}`}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </header>

      <div className="verification-grid">
        <form className="card form-grid">
          <h2>Шаг 1. Данные компании</h2>
          <label>
            Название компании
            <input type="text" placeholder="ООО Технологии Будущего" />
          </label>
          <label>
            ИНН / Регистрационный номер
            <input type="text" placeholder="7700000000" />
          </label>
          <label>
            Сфера деятельности
            <input type="text" placeholder="Разработка программного обеспечения" />
          </label>
          <label>
            Сайт компании
            <input type="url" placeholder="https://example.com" />
          </label>
          <label>
            Контакт представителя
            <input type="text" placeholder="Имя, должность, email" />
          </label>
          <button type="submit" className="btn btn--primary">
            Продолжить
          </button>
        </form>

        <aside className="card verification-status">
          <h3>Статус проверки</h3>
          <div className="status-chip status-chip--warning">Ожидается заполнение данных</div>
          <ul>
            <li>Проверка реквизитов компании</li>
            <li>Подтверждение представителя</li>
            <li>Модерация профиля и брендинга</li>
            <li>Выдача статуса «Подтверждено»</li>
          </ul>
        </aside>
      </div>
    </section>
  )
}

