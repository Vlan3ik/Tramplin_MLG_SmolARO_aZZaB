import type { WheelEvent } from 'react'
import styles from './стили.module.css'

type BlueCardItem = {
  id: number
  day: string
  month: string
  time: string
  title: string
  description: string
}

const cards: BlueCardItem[] = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  day: '05',
  month: 'Апреля',
  time: '11:00 – 14:00',
  title: 'Проектирование отказоустойчивых систем: путь к микросервисам.',
  description: 'Мастер-класс по архитектурным паттернам и минимизации рисков при миграции данных.',
}))

export function Po() {
  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return
    }

    event.preventDefault()
    event.currentTarget.scrollBy({
      left: event.deltaY * 1.15,
      behavior: 'smooth',
    })
  }

  return (
    <section className={styles.poSection}>
      <h2 className={styles.title}>Новые мероприятия</h2>

      <div className={styles.poCarousel} onWheel={handleWheel}>
        {cards.map((card) => (
          <div className={styles.poCarouselSlide} key={card.id}>
            <КарточкаСиняя
              число={card.day}
              месяц={card.month}
              время={card.time}
              текстЧерный={card.title}
              текстСерый={card.description}
              порядковыйНомер={card.id}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function КарточкаСиняя({
  число,
  время,
  месяц,
  текстСерый,
  текстЧерный,
}: {
  число: string
  месяц: string
  время: string
  текстЧерный: string
  текстСерый: string
  порядковыйНомер: number
}) {
  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardDate}>
        <span className={styles.cardDay}>{число}</span>
        <div className={styles.cardDateMeta}>
          <span className={styles.cardMonth}>{месяц}</span>
          <span className={styles.cardTime}>{время}</span>
        </div>
      </div>
      <div className={styles.cardContent}>
        <span className={styles.cardTitle}>{текстЧерный}</span>
        <span className={styles.cardDescription}>{текстСерый}</span>
      </div>
      <button className={styles.cardButton}>Подробнее</button>
    </div>
  )
}
