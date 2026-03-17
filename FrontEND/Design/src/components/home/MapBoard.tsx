import { Link } from 'react-router-dom'
import { opportunities } from '../../data/mockData'

const markers = [
  { id: 1, x: 32, y: 34, kind: 'single' as const },
  { id: 2, x: 52, y: 30, kind: 'cluster' as const, count: 4 },
  { id: 3, x: 62, y: 46, kind: 'single' as const },
  { id: 4, x: 42, y: 60, kind: 'favorite' as const },
  { id: 5, x: 72, y: 64, kind: 'cluster' as const, count: 7 },
]

export function MapBoard() {
  return (
    <section className="map-mode">
      <div className="map-results card">
        <h3>Найдено 248 возможностей</h3>
        <p>Наведите на маркер, чтобы открыть мини-карточку, или переключитесь в список для детального просмотра.</p>

        <div className="map-results__list">
          {opportunities.slice(0, 4).map((item) => (
            <article key={item.id} className="map-mini-card">
              <h4>{item.title}</h4>
              <div>{item.company}</div>
              <div>{item.compensation}</div>
              <div>{item.location}</div>
              <div className="tag-row">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <Link to={`/opportunity/${item.id}`} className="btn btn--ghost">
                Открыть
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="map-canvas card" role="img" aria-label="Карта возможностей">
        <div className="map-grid" />
        {markers.map((marker) => (
          <div
            key={marker.id}
            className={`map-marker map-marker--${marker.kind}`}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
          >
            {marker.kind === 'cluster' ? marker.count : ''}
            <div className="marker-popup">
              <strong>{opportunities[(marker.id - 1) % opportunities.length].title}</strong>
              <span>{opportunities[(marker.id - 1) % opportunities.length].company}</span>
              <span>{opportunities[(marker.id - 1) % opportunities.length].compensation}</span>
              <button type="button">Открыть карточку</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

