import { useRef, useState, type WheelEvent } from 'react'
import styles from './styles.module.css'

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
  const [activeIndex, setActiveIndex] = useState(cards.length > 1 ? 1 : 0)
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

    const maxIndex = cards.length - 1
    setActiveIndex((current) => {
      if (direction > 0) {
        return current >= maxIndex ? 0 : current + 1
      }

      return current <= 0 ? maxIndex : current - 1
    })

    wheelLockUntilRef.current = now + 320
  }

  return (
    <section className={styles.poSection}>
      <h2 className={styles.title}>Новые мероприятия</h2>

      <div className={styles.poCarouselViewport} onWheel={handleWheel}>
        <div
          className={styles.poCarouselTrack}
          style={{
            transform: `translateY(calc(var(--po-center-offset) - var(--po-step) * ${activeIndex}))`,
          }}
        >
          {cards.map((card, index) => (
            <div
              className={`${styles.poCarouselSlide} ${index === activeIndex ? styles.poCarouselSlideActive : styles.poCarouselSlideSide}`}
              key={card.id}
            >
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
