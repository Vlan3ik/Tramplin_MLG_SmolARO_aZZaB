import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { fetchCompanies } from '../../api/companies'
import type { Company } from '../../types/company'

const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=780&q=80'
const fallbackCompanies: Company[] = [
  { id: 0, name: 'Компания', industry: 'Направление', verified: false, cityName: null, logoUrl: null, websiteUrl: null, publicEmail: null, activeOpportunitiesCount: 0 },
  { id: -1, name: 'Компания', industry: 'Направление', verified: false, cityName: null, logoUrl: null, websiteUrl: null, publicEmail: null, activeOpportunitiesCount: 0 },
  { id: -2, name: 'Компания', industry: 'Направление', verified: false, cityName: null, logoUrl: null, websiteUrl: null, publicEmail: null, activeOpportunitiesCount: 0 },
  { id: -3, name: 'Компания', industry: 'Направление', verified: false, cityName: null, logoUrl: null, websiteUrl: null, publicEmail: null, activeOpportunitiesCount: 0 },
]

export function SecondarySections() {
  const [companyCards, setCompanyCards] = useState<Company[]>([])
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const isMovedRef = useRef(false)
  const dragStartXRef = useRef(0)
  const scrollStartXRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCompanies() {
      try {
        const response = await fetchCompanies({ page: 1, pageSize: 12 }, controller.signal)
        setCompanyCards(response.items)
      } catch {
        if (!controller.signal.aborted) {
          setCompanyCards([])
        }
      }
    }

    void loadCompanies()
    return () => controller.abort()
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    isDraggingRef.current = true
    isMovedRef.current = false
    dragStartXRef.current = event.clientX
    scrollStartXRef.current = viewport.scrollLeft
    pointerIdRef.current = event.pointerId
    viewport.classList.add('is-dragging')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const viewport = viewportRef.current
    if (!viewport) return
    const delta = event.clientX - dragStartXRef.current
    if (Math.abs(delta) > 6) {
      isMovedRef.current = true
    }
    viewport.scrollLeft = scrollStartXRef.current - delta
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const viewport = viewportRef.current
    if (!viewport) return
    isDraggingRef.current = false
    viewport.classList.remove('is-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pointerIdRef.current = null
  }

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (isMovedRef.current) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const cards = companyCards.length ? companyCards : fallbackCompanies

  return (
    <section className="secondary-sections container" aria-label="IT-компании">
      <h2 className="secondary-sections__title">IT-компании</h2>

      <div className="secondary-sections__slider-shell">
        <div
          ref={viewportRef}
          className="secondary-sections__viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClickCapture={handleClickCapture}
          onDragStart={handleDragStart}
        >
          <div className="secondary-sections__cards">
            {cards.map((card) => (
              <article key={card.id} className="secondary-sections__card">
                <img
                  className="secondary-sections__image"
                  src={card.logoUrl || fallbackImage}
                  alt={card.name ?? 'Компания'}
                  loading="lazy"
                  draggable={false}
                />
                <h3>{card.name ?? 'Компания'}</h3>
                <p>{card.industry ?? 'Направление'}</p>
                <Link className="secondary-sections__link" to={card.id > 0 ? `/company/${card.id}` : '/companies'}>
                  Подробнее
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
