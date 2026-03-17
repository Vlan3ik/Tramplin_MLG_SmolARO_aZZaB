const directions = ['Frontend', 'Backend', 'Data', 'QA', 'DevOps', 'GameDev']
const companies = ['CloudLine', 'Urban Metrics', 'StackForge', 'NeuroWorks', 'GreenData', 'Aster Labs']
const collections = [
  'Стажировки для студентов 3-4 курса',
  'Карьерные события марта',
  'Вакансии с удалённым форматом',
  'Менторские программы по Product и UX',
]

export function SecondarySections() {
  return (
    <section className="secondary-sections container">
      <div className="card">
        <h3>Популярные направления</h3>
        <div className="pill-grid">
          {directions.map((direction) => (
            <button key={direction} type="button" className="pill">
              {direction}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Компании, активно нанимающие сейчас</h3>
        <div className="pill-grid">
          {companies.map((company, index) => (
            <button key={company} type="button" className={`pill ${index < 2 ? 'pill--favorite' : ''}`}>
              {company}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Подборки</h3>
        <ul className="collection-list">
          {collections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

