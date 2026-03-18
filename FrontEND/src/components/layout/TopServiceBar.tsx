import { Link } from 'react-router-dom'

const serviceLinks = [
  { label: 'Для соискателей', to: '/dashboard/seeker' },
  { label: 'Для работодателей', to: '/dashboard/employer' },
  { label: 'Кураторская панель', to: '/dashboard/curator' },
  { label: 'Помощь', to: '#' },
]

export function TopServiceBar() {
  return (
    <div className="service-bar">
      <div className="container service-bar__inner">
        <div className="service-bar__city">Город: Москва</div>
        <div className="service-bar__links">
          {serviceLinks.map((link) => (
            <Link key={link.label} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

