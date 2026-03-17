import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="container simple-page card">
      <h1>Страница не найдена</h1>
      <p>Перейдите на главную и продолжите работу с платформой.</p>
      <Link to="/" className="btn btn--primary">
        На главную
      </Link>
    </section>
  )
}

