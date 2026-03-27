import { Link } from 'react-router-dom'
import './Footer.css'

type FooterColumn = {
  title: string
  links: Array<{ label: string; to: string }>
}

const columns: FooterColumn[] = [
  {
    title: 'Соискателям',
    links: [
      { label: 'Компании', to: '/companies' },
      { label: 'Вакансии', to: '/' },
      { label: 'Резюме', to: '/dashboard/seeker' },
      { label: 'Мероприятия', to: '/events' },
      { label: 'Нетворкинг', to: '/about' },
    ],
  },
  {
    title: 'Работодателям',
    links: [
      { label: 'Размещение', to: '/vacancy-flow' },
      { label: 'Верификация', to: '/verification/employer' },
      { label: 'Соискатели', to: '/companies' },
      { label: 'Учебные заведения', to: '/about' },
    ],
  },
  {
    title: 'Учебным заведениям',
    links: [
      { label: 'Работодатели', to: '/companies' },
      { label: 'Стажировки', to: '/' },
      { label: 'Мероприятия', to: '/events' },
    ],
  },
]

function SocialIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <a href="#" className="platform-footer__social-item" aria-label={alt} title={alt}>
      <img src={src} alt={alt} />
    </a>
  )
}

export function Footer() {
  return (
    <footer className="platform-footer">
      <div className="platform-footer__inner">
        <div className="platform-footer__columns">
          {columns.map((column) => (
            <div className="platform-footer__column" key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="platform-footer__contacts">
          <h4>Консультация</h4>
          <a href="tel:+74812546578">8 (4812) 54-65-78</a>
          <a href="mailto:codeinsite@mail.ru">codeinsite@mail.ru</a>
        </div>

        <div className="platform-footer__socials">
          <SocialIcon src="/Group 35.svg" alt="VK" />
              <SocialIcon src="/logo-max-1.svg" alt="MAX" />
          <SocialIcon src="/Rutube_icon 1.svg" alt="Rutube" />
          <SocialIcon src="/Yandex_Zen_logo_icon 1.svg" alt="Яндекс Дзен" />
        </div>

        <div className="platform-footer__bottom">
          <div className="platform-footer__brand-logo">
            <img src="/logo.svg" alt="Трамплин" />
          </div>
          <span className="platform-footer__brand-name">Трамплин © 2026</span>
          <a href="#">Пользовательское соглашение</a>
          <a href="#">Политика конфиденциальности</a>
        </div>
      </div>

        <img className="platform-footer__decor" src="/hands-caps-and-more.svg" alt="" aria-hidden="true" />
    </footer>
  )
}
