import { Filter, List, Map, Search, SlidersHorizontal } from 'lucide-react'
import { quickTags } from '../../data/mockData'

type SearchHeroProps = {
  viewMode: 'map' | 'list'
  onModeChange: (mode: 'map' | 'list') => void
}

export function SearchHero({ viewMode, onModeChange }: SearchHeroProps) {
  return (
    <section className="search-hero container">
      <div className="search-hero__head">
        <h1>Быстрый поиск карьерных возможностей</h1>
        <p>Вакансии, стажировки, менторские программы и карьерные события в IT в едином рабочем пространстве.</p>
      </div>

      <div className="search-row">
        <label className="input-wrap input-wrap--wide">
          <Search size={18} />
          <input placeholder="Должность, навык, компания или мероприятие" />
        </label>
        <label className="input-wrap">
          <Map size={18} />
          <input placeholder="Город" defaultValue="Москва" />
        </label>
        <button className="btn btn--ghost btn--icon" type="button">
          <SlidersHorizontal size={16} />
          Фильтры
        </button>
        <button className="btn btn--primary" type="button">
          <Search size={16} />
          Найти
        </button>
        <div className="view-switch" role="tablist" aria-label="Режим отображения">
          <button
            type="button"
            className={viewMode === 'map' ? 'is-active' : ''}
            onClick={() => onModeChange('map')}
          >
            <Map size={16} />
            Карта
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'is-active' : ''}
            onClick={() => onModeChange('list')}
          >
            <List size={16} />
            Список
          </button>
        </div>
      </div>

      <div className="chip-row">
        {quickTags.map((tag, index) => (
          <button
            key={tag}
            type="button"
            className={`chip ${index < 3 ? 'chip--active' : ''}`}
          >
            {tag}
          </button>
        ))}
        <button type="button" className="chip chip--ghost">
          <Filter size={14} />
          Все направления
        </button>
      </div>
    </section>
  )
}

