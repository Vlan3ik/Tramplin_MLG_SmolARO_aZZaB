const principles = [
  'Единая витрина вакансий, стажировок, мероприятий и менторских программ.',
  'Проверенные работодатели и прозрачные статусы откликов без лишней рутины.',
  'Городской фокус: платформа подбирает ближайший город и позволяет быстро переключаться между локациями.',
]

const audienceCards = [
  {
    title: 'Соискателям',
    description: 'Поиск возможностей, удобный отклик и понятный карьерный маршрут в одном интерфейсе.',
  },
  {
    title: 'Работодателям',
    description: 'Публикация возможностей, верификация компании и доступ к релевантным кандидатам.',
  },
  {
    title: 'Кураторам',
    description: 'Модерация контента, поддержка пользователей и развитие локального сообщества платформы.',
  },
]

export function AboutPlatformPage() {
  return (
    <section className="container about-platform">
      <div className="card about-platform__hero">
        <span className="about-platform__eyebrow">О платформе</span>
        <h1>Трамплин объединяет карьерные возможности, компании и профессиональные события</h1>
        <p>
          Мы собираем в одном месте всё, что помогает расти в IT и смежных направлениях: вакансии, стажировки,
          менторство, мероприятия и подтверждённые профили компаний.
        </p>
      </div>

      <div className="about-platform__grid">
        <div className="card about-platform__section">
          <h2>Что делает платформа</h2>
          <ul>
            {principles.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="card about-platform__section">
          <h2>Как это работает</h2>
          <p>
            Пользователь выбирает роль, получает персональный кабинет и видит только те сценарии, которые нужны ему
            сейчас. Город можно определить автоматически по геопозиции или выбрать вручную.
          </p>
        </div>
      </div>

      <div className="about-platform__cards">
        {audienceCards.map((card) => (
          <article key={card.title} className="card about-platform__card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
