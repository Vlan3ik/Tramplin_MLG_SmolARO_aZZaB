import { useState, type ReactNode } from 'react'
import styles from './CommunityTabsSection.module.css'

type CommunityTab = {
  title: string
  icon: string
  content: ReactNode
}

const communityTabs: CommunityTab[] = [
  {
    title: 'Стажировки от работодателей',
    icon: '',
    content: <InternshipsTabContent />,
  },
  {
    title: 'Практики для студентов',
    icon: '',
    content: <PracticesTabContent />,
  },
  {
    title: 'Топовые IT-компании',
    icon: '',
    content: <TopCompaniesTabContent />,
  },
  {
    title: 'Сообщество вузов',
    icon: '',
    content: <UniversityCommunityTabContent />,
  },
]

export function CommunityTabsSection() {
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Стань частью IT-сообщества</h2>
      <div className={styles.tabList}>
        {communityTabs.map((tab, index) => (
          <div
            key={index}
            style={{
              color: activeTabIndex === index ? '#0171E1' : '#9A9CA5',
              fontWeight: 600,
              border: activeTabIndex === index ? '1px solid #0171E1' : '1px solid transparent',
              borderRadius: '4px',
              padding: '5px',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTabIndex(index)}
          >
            {tab.icon} <span>{tab.title}</span>
          </div>
        ))}
      </div>
      {communityTabs[activeTabIndex]?.content}
    </section>
  )
}

function InternshipsTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Экосистема «Трамплин»</h3>
      <p>Стажировки с поддержкой наставников. Общайтесь с работодателями, собирайте портфолио и выходите на первые офферы.</p>
      <ul>
        <li>Поддержка наставников из индустрии</li>
        <li>Реальные задачи от компаний</li>
        <li>Шанс получить оффер после стажировки</li>
      </ul>
    </div>
  )
}

function PracticesTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Экосистема «Трамплин»</h3>
      <p>Практика для студентов с первого курса: обучение, менторство и погружение в рабочие процессы.</p>
      <ul>
        <li>Проектная работа в командах</li>
        <li>Встречи с работодателями и экспертами</li>
        <li>Развитие навыков для старта карьеры</li>
      </ul>
    </div>
  )
}

function TopCompaniesTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Экосистема «Трамплин»</h3>
      <p>Взаимодействуйте с ведущими IT-компаниями: узнавайте требования, выполняйте задания и находите карьерные треки.</p>
      <ul>
        <li>Профили и витрины компаний</li>
        <li>Отборочные активности и ивенты</li>
        <li>Быстрый выход на собеседования</li>
      </ul>
    </div>
  )
}

function UniversityCommunityTabContent() {
  return (
    <div>
      <h3 className={styles.contentTitle}>Экосистема «Трамплин»</h3>
      <p>Сообщество вузов объединяет студентов, преподавателей и партнеров для совместных проектов и карьерного роста.</p>
      <ul>
        <li>Объединение учебных команд</li>
        <li>Совместные инициативы с компаниями</li>
        <li>Развитие карьерных и soft skills</li>
      </ul>
    </div>
  )
}
