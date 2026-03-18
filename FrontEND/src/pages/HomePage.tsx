import { useState } from 'react'
import { FilterSidebar } from '../components/home/FilterSidebar'
import { MapBoard } from '../components/home/MapBoard'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { SearchHero } from '../components/home/SearchHero'
import { SecondarySections } from '../components/home/SecondarySections'
import { opportunities } from '../data/mockData'

export function HomePage() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

  return (
    <>
      <SearchHero viewMode={viewMode} onModeChange={setViewMode} />

      <section className="home-workspace container">
        {viewMode === 'map' ? (
          <MapBoard />
        ) : (
          <div className="list-mode">
            <FilterSidebar />
            <div className="list-mode__results">
              <div className="result-toolbar card">
                <div>
                  <strong>248 найденных результатов</strong>
                  <span>Сортировка: сначала релевантные</span>
                </div>
                <button type="button" className="btn btn--ghost">
                  Сохранить поиск
                </button>
              </div>

              <div className="result-list">
                {opportunities.map((item) => (
                  <OpportunityCard key={item.id} opportunity={item} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <SecondarySections />
    </>
  )
}

