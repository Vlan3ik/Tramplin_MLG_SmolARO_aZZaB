import { useRef, useState, type WheelEvent } from 'react'
import styles from './EventsCarouselSection.module.css'

type EventCardItem = {
  id: number
  day: string
  month: string
  time: string
  title: string
  description: string
}

type EventCardProps = {
  day: string
  month: string
  time: string
  title: string
  description: string
}

const eventCards: EventCardItem[] = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  day: '05',
  month: 'Апреля',
  time: '11:00 – 14:00',
  title: 'Проектирование отказоустойчивых систем: путь к микросервисам.',
  description: 'Мастер-класс по архитектурным паттернам и минимизации рисков при миграции данных.',
}))

export function EventsCarouselSection() {
  const [activeIndex, setActiveIndex] = useState(eventCards.length > 1 ? 1 : 0)
  const wheelLockUntilRef = useRef(0)

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()

    const now = Date.now()
    if (now < wheelLockUntilRef.current) {
      return
    }

    const direction = event.deltaY > 0 ? 1 : event.deltaY < 0 ? -1 : 0
    if (!direction) {
      return
    }

    const maxIndex = eventCards.length - 1
    setActiveIndex((current) => {
      if (direction > 0) {
        return current >= maxIndex ? 0 : current + 1
      }

      return current <= 0 ? maxIndex : current - 1
    })

    wheelLockUntilRef.current = now + 320
  }

  return (
    <section className={styles.eventsSection}>
      <h2 className={styles.title}>Новые мероприятия</h2>

      <div className={styles.eventsCarouselViewport} onWheel={handleWheel}>
        <div
          className={styles.eventsCarouselTrack}
          style={{
            transform: `translateY(calc(var(--events-center-offset) - var(--events-step) * ${activeIndex}))`,
          }}
        >
          {eventCards.map((card, index) => (
            <div
              className={`${styles.eventsCarouselSlide} ${index === activeIndex ? styles.eventsCarouselSlideActive : styles.eventsCarouselSlideSide}`}
              key={card.id}
            >
              <EventCard day={card.day} month={card.month} time={card.time} title={card.title} description={card.description} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function EventCard({ day, month, time, title, description }: EventCardProps) {
  return (
    <div className={styles.cardContainer}>
      <div className={styles.cardDate}>
        <span className={styles.cardDay}>{day}</span>
        <div className={styles.cardDateMeta}>
          <span className={styles.cardMonth}>{month}</span>
          <span className={styles.cardTime}>{time}</span>
        </div>
      </div>
      <div className={styles.cardContent}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardDescription}>{description}</span>
      </div>
      <button className={styles.cardButton}>Подробнее</button>
    </div>
  )
}
