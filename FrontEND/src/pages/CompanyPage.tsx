import { BriefcaseBusiness, Building2, Globe, ShieldCheck } from 'lucide-react'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { opportunities } from '../data/mockData'

const tabs = ['О компании', 'Возможности', 'Мероприятия', 'Контакты']

export function CompanyPage() {
  return (
    <section className="container company-page">
      <header className="company-hero card">
        <div className="company-hero__logo">CL</div>
        <div>
          <h1>CloudLine</h1>
          <p>Продуктовая компания, создающая сервисы для карьерного роста и цифрового найма.</p>
          <div className="company-hero__meta">
            <span className="status-chip status-chip--success">
              <ShieldCheck size={14} />
              Верифицированная компания
            </span>
            <button className="btn btn--primary" type="button">
              Подписаться
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-row card">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
            {tab}
          </button>
        ))}
      </nav>

      <div className="company-sections">
        <section className="card">
          <h2>О компании</h2>
          <p>
            CloudLine развивает B2C и B2B карьерные продукты, сотрудничает с университетами, стартапами и крупными
            технологическими командами.
          </p>
          <div className="two-col-grid company-info-grid">
            <div>
              <h3>Направления работы</h3>
              <ul>
                <li>EdTech и CareerTech</li>
                <li>Аналитика рынка труда</li>
                <li>B2B HR-инструменты</li>
              </ul>
            </div>
            <div>
              <h3>Технологический стек</h3>
              <ul>
                <li>React, Node.js, Go</li>
                <li>PostgreSQL, ClickHouse</li>
                <li>AWS, Kubernetes</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Активные возможности</h2>
          <div className="similar-list">
            {opportunities.slice(0, 3).map((item) => (
              <OpportunityCard key={item.id} opportunity={item} compact />
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Контакты</h2>
          <div className="company-contacts">
            <span>
              <Building2 size={15} />
              Москва, БЦ Технопарк
            </span>
            <span>
              <Globe size={15} />
              cloudline.tech
            </span>
            <span>
              <BriefcaseBusiness size={15} />
              career@cloudline.tech
            </span>
          </div>
        </section>
      </div>
    </section>
  )
}

