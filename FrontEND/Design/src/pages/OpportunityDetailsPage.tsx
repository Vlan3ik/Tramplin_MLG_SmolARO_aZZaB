import { CalendarClock, CheckCircle2, Clock3, Link2, MapPin, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { opportunities, typeLabel } from '../data/mockData'

export function OpportunityDetailsPage() {
  const { id } = useParams()
  const opportunity = opportunities.find((item) => item.id === Number(id)) ?? opportunities[0]

  return (
    <section className="container opportunity-page">
      <nav className="breadcrumbs">
        <Link to="/">Главная</Link>
        <span>/</span>
        <span>{typeLabel[opportunity.type]}</span>
        <span>/</span>
        <span>{opportunity.title}</span>
      </nav>

      <div className="opportunity-page__top card">
        <div>
          <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
          <h1>{opportunity.title}</h1>
          <div className="opportunity-key-metrics">
            <span>{opportunity.company}</span>
            <span>{opportunity.compensation}</span>
            <span>{opportunity.workFormat}</span>
            <span>
              <MapPin size={14} />
              {opportunity.location}
            </span>
          </div>
        </div>

        <aside className="sticky-action card">
          <button className="btn btn--primary" type="button">
            {opportunity.type === 'event' ? 'Записаться' : 'Откликнуться'}
          </button>
          <button className="btn btn--ghost" type="button">
            В избранное
          </button>
          <div className="status-line status-line--success">
            <CheckCircle2 size={14} />
            Компания подтверждена
          </div>
          <div className="status-line">
            <Clock3 size={14} />
            Срок действия: до 30 апреля 2026
          </div>
          <div className="status-line">
            <Share2 size={14} />
            Поделиться
          </div>
        </aside>
      </div>

      <div className="opportunity-page__body">
        <section className="card">
          <h2>Описание</h2>
          <p>
            Платформа «Трамплин» ищет специалистов, которые хотят развивать карьерные сервисы и влиять на качество
            профессиональных возможностей для студентов, выпускников и молодых специалистов.
          </p>
        </section>

        <section className="card">
          <h2>Задачи / Программа участия</h2>
          <ul>
            <li>Проектирование пользовательских сценариев и интерфейсов.</li>
            <li>Участие в продуктовых спринтах и исследовательских сессиях.</li>
            <li>Подготовка демо-версий и защита решений перед командой.</li>
          </ul>
        </section>

        <section className="card two-col-grid">
          <div>
            <h2>Требования</h2>
            <ul>
              <li>Знание базового стека по выбранному направлению.</li>
              <li>Навыки командной работы и коммуникации.</li>
              <li>Готовность к регулярной обратной связи.</li>
            </ul>
          </div>
          <div>
            <h2>Условия</h2>
            <ul>
              <li>Гибкий формат участия (онлайн/гибрид).</li>
              <li>Менторское сопровождение и карьерные консультации.</li>
              <li>Возможность перехода в долгосрочное сотрудничество.</li>
            </ul>
          </div>
        </section>

        <section className="card">
          <h2>Навыки и теги</h2>
          <div className="tag-row">
            {opportunity.tags.concat(['Soft Skills', 'Portfolio']).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="card two-col-grid">
          <div>
            <h2>Формат и адрес</h2>
            <p>{opportunity.workFormat}</p>
            <p>БЦ Технопарк, ул. Льва Толстого, 16, Москва</p>
            <div className="status-line">
              <CalendarClock size={14} />
              Дата публикации: 17 марта 2026
            </div>
          </div>
          <div>
            <h2>Контакты</h2>
            <p>Email: hiring@tramplin.tech</p>
            <p>Telegram: @tramplin_hr</p>
            <div className="status-line">
              <Link2 size={14} />
              Профиль компании на платформе
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Медиаконтент</h2>
          <div className="media-grid">
            <div className="media-block">Видео о команде</div>
            <div className="media-block">Слайды программы</div>
            <div className="media-block">Фото офиса / события</div>
          </div>
        </section>

        <section className="card">
          <h2>О компании / организаторе</h2>
          <p>
            CloudLine развивает продукты для карьерного роста и работает с крупными университетами, сообществами и
            технологическими компаниями.
          </p>
        </section>

        <section className="card">
          <h2>Карта места</h2>
          <div className="location-map" />
        </section>

        <section className="card">
          <h2>Похожие возможности</h2>
          <div className="similar-list">
            {opportunities.slice(1, 4).map((item) => (
              <OpportunityCard key={item.id} opportunity={item} compact />
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

