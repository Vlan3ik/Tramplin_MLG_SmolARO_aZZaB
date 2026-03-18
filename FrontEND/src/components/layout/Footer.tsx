const footerColumns = [
  {
    title: 'Платформа',
    links: ['О проекте', 'Партнёрам', 'Карьера', 'Пресса'],
  },
  {
    title: 'Соискателям',
    links: ['Вакансии', 'Стажировки', 'Менторы', 'События'],
  },
  {
    title: 'Работодателям',
    links: ['Размещение', 'Верификация', 'Аналитика', 'Брендинг'],
  },
  {
    title: 'Поддержка',
    links: ['FAQ', 'Политика', 'Контакты', 'Сообщить о проблеме'],
  },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link}>{link}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer__bottom">
        <span>Трамплин © 2026</span>
        <span>Надёжная карьерная платформа для IT и смежных направлений</span>
      </div>
    </footer>
  )
}

