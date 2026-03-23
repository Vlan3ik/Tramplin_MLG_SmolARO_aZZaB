import { useEffect, useMemo, useRef, useState, type WheelEvent } from 'react'
import { Link } from 'react-router-dom'
import { fetchHomeListOpportunities } from '../../../api/opportunities'
import type { Opportunity, OpportunityFilters } from '../../../types/opportunity'
import styles from './EventsCarouselSection.module.css'

const eventsQuery: {
  page: number
  pageSize: number
  search: string
  cityId: number | null
  filters: OpportunityFilters
} = {
  page: 1,
  pageSize: 12,
  search: '',
  cityId: null,
  filters: {
    types: ['event'],
    formats: [],
    verifiedOnly: false,
  },
}

export function EventsCarouselSection() {
  const [events, setEvents] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wheelLockUntilRef = useRef(0)

  useEffect(() => {
    const abortController = new AbortController()

    async function loadEvents() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchHomeListOpportunities(eventsQuery, abortController.signal)
        const nextItems = response.items.filter((item) => item.type === 'event').slice(0, 4)

        setEvents(nextItems)
        setActiveIndex(0)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить мероприятия.')
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadEvents()

    return () => {
      abortController.abort()
    }
  }, [])

  const visibleEvents = useMemo(() => events, [events])

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (visibleEvents.length <= 1) {
      return
    }

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

    const maxIndex = visibleEvents.length - 1
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

      {isLoading ? <div className={styles.sectionState}>Загружаем мероприятия...</div> : null}

      {!isLoading && errorMessage ? <div className={styles.sectionState}>{errorMessage}</div> : null}

      {!isLoading && !errorMessage && visibleEvents.length === 0 ? (
        <div className={styles.sectionState}>Пока нет новых мероприятий.</div>
      ) : null}

      {!isLoading && !errorMessage && visibleEvents.length > 0 ? (
        <div className={styles.eventsCarouselViewport} onWheel={handleWheel}>
          <div
            className={styles.eventsCarouselTrack}
            style={{
              transform: `translateY(calc(var(--events-center-offset) - var(--events-step) * ${activeIndex}))`,
            }}
          >
            {visibleEvents.map((event, index) => (
              <div
                className={`${styles.eventsCarouselSlide} ${index === activeIndex ? styles.eventsCarouselSlideActive : styles.eventsCarouselSlideSide}`}
                key={event.id}
              >
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function EventCard({ event }: { event: Opportunity }) {
  return (
    <article className={styles.cardContainer}>
      <div className={styles.cardDate}>
        <span className={styles.cardDay}>{event.date}</span>
        <div className={styles.cardDateMeta}>
          <span className={styles.cardMonth}>{event.company}</span>
          <span className={styles.cardTime}>{event.location}</span>
        </div>
      </div>

      <div className={styles.cardContent}>
        <span className={styles.cardTitle}>{event.title}</span>
        <span className={styles.cardDescription}>{event.description}</span>
      </div>

      <Link className={styles.cardButton} to={`/opportunity/${event.id}`}>
        Подробнее
      </Link>
    </article>
  )
}
