import { Link } from 'react-router-dom'
import './Footer.css'

type FooterColumn = {
  title: string
  links: Array<{ label: string; to: string }>
}

const columns: FooterColumn[] = [
  {
    title: 'РЎРѕРёСЃРєР°С‚РµР»СЏРј',
    links: [
      { label: 'РљРѕРјРїР°РЅРёРё', to: '/companies' },
      { label: 'Р’Р°РєР°РЅСЃРёРё', to: '/' },
      { label: 'Р РµР·СЋРјРµ', to: '/dashboard/seeker' },
      { label: 'РњРµСЂРѕРїСЂРёСЏС‚РёСЏ', to: '/events' },
      { label: 'РќРµС‚РІРѕСЂРєРёРЅРі', to: '/about' },
    ],
  },
  {
    title: 'Р Р°Р±РѕС‚РѕРґР°С‚РµР»СЏРј',
    links: [
      { label: 'Р Р°Р·РјРµС‰РµРЅРёРµ', to: '/vacancy-flow' },
      { label: 'Р’РµСЂРёС„РёРєР°С†РёСЏ', to: '/verification/employer' },
      { label: 'РЎРѕРёСЃРєР°С‚РµР»Рё', to: '/companies' },
      { label: 'РЈС‡РµР±РЅС‹Рµ Р·Р°РІРµРґРµРЅРёСЏ', to: '/about' },
    ],
  },
  {
    title: 'РЈС‡РµР±РЅС‹Рј Р·Р°РІРµРґРµРЅРёСЏРј',
    links: [
      { label: 'Р Р°Р±РѕС‚РѕРґР°С‚РµР»Рё', to: '/companies' },
      { label: 'РЎС‚Р°Р¶РёСЂРѕРІРєРё', to: '/' },
      { label: 'РњРµСЂРѕРїСЂРёСЏС‚РёСЏ', to: '/events' },
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
        <div className="platform-footer__top">
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
            <h4>РљРѕРЅСЃСѓР»СЊС‚Р°С†РёСЏ</h4>
            <a href="tel:+74812546578">8 (4812) 54-65-78</a>
            <a href="mailto:codeinsite@mail.ru">codeinsite@mail.ru</a>
          </div>
        </div>

        <div className="platform-footer__socials-wrap">
          <div className="platform-footer__socials">
            <SocialIcon src="/Group 35.svg" alt="VK" />
            <SocialIcon src="/logo-max-1.svg" alt="MAX" />
            <SocialIcon src="/Rutube_icon 1.svg" alt="Rutube" />
            <SocialIcon src="/Yandex_Zen_logo_icon 1.svg" alt="РЇРЅРґРµРєСЃ Р”Р·РµРЅ" />
          </div>
        </div>

        <div className="platform-footer__bottom">
          <div className="platform-footer__brand">
            <div className="platform-footer__brand-logo">
              <img src="/logo.svg" alt="РўСЂР°РјРїР»РёРЅ" />
            </div>
            <span className="platform-footer__brand-name">РўСЂР°РјРїР»РёРЅ В© 2026</span>
          </div>

          <div className="platform-footer__legal">
            <a href="#">РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ СЃРѕРіР»Р°С€РµРЅРёРµ</a>
            <a href="#">РџРѕР»РёС‚РёРєР° РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё</a>
          </div>
        </div>
      </div>

      <img className="platform-footer__decor" src="/hands-caps-and-more.svg" alt="" aria-hidden="true" />
    </footer>
  )
}
