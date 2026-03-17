import { filterGroups } from '../../data/mockData'

export function FilterSidebar() {
  return (
    <aside className="filter-sidebar card">
      <div className="filter-sidebar__head">
        <h3>Фильтры</h3>
        <button type="button">Сбросить</button>
      </div>

      {filterGroups.map((group) => (
        <section key={group.title} className="filter-group">
          <h4>{group.title}</h4>
          <div className="filter-group__options">
            {group.options.map((option) => (
              <label key={option}>
                <input type="checkbox" />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="filter-group">
        <h4>Дополнительно</h4>
        <div className="toggle-list">
          {[
            'Только верифицированные компании',
            'Только избранные компании',
            'Только онлайн',
            'Только без опыта',
          ].map((item) => (
            <label key={item} className="toggle-item">
              <span>{item}</span>
              <input type="checkbox" />
            </label>
          ))}
        </div>
      </section>
    </aside>
  )
}

