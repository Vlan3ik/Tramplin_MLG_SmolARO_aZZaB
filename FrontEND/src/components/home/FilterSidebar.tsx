import type { OpportunityFilters, OpportunityType } from '../../types/opportunity'

type FilterSidebarProps = {
  filters: OpportunityFilters
  onTypesChange: (types: OpportunityType[]) => void
  onFormatsChange: (formats: string[]) => void
  onStatusesChange: (statuses: number[]) => void
  onVerifiedOnlyChange: (verifiedOnly: boolean) => void
  onReset: () => void
}

const typeOptions: Array<{ value: OpportunityType; label: string }> = [
  { value: 'vacancy', label: 'Вакансии' },
  { value: 'internship', label: 'Стажировки' },
  { value: 'mentorship', label: 'Менторство' },
  { value: 'event', label: 'Мероприятия' },
]

const formatOptions = [
  { value: 'remote', label: 'Удаленно' },
  { value: 'hybrid', label: 'Гибрид' },
  { value: 'onsite', label: 'Офис' },
]

const statusGroups = [
  { key: 'planned', label: 'Запланированные', values: [1, 2] },
  { key: 'active', label: 'Активные', values: [3] },
  { key: 'closed', label: 'Закрытые', values: [4, 5, 6, 7] },
]

function toggleItem<T>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]
}

export function FilterSidebar({
  filters,
  onTypesChange,
  onFormatsChange,
  onStatusesChange,
  onVerifiedOnlyChange,
  onReset,
}: FilterSidebarProps) {
  function toggleStatusGroup(values: number[]) {
    const hasAll = values.every((value) => filters.statuses.includes(value))
    if (hasAll) {
      onStatusesChange(filters.statuses.filter((value) => !values.includes(value)))
      return
    }

    onStatusesChange(Array.from(new Set([...filters.statuses, ...values])))
  }

  return (
    <aside className="filter-sidebar card">
      <div className="filter-sidebar__head">
        <h3>Фильтры</h3>
        <button type="button" onClick={onReset}>
          Сбросить
        </button>
      </div>

      <section className="filter-group">
        <h4>Тип возможностей</h4>
        <div className="filter-group__options">
          {typeOptions.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={filters.types.includes(option.value)}
                onChange={() => onTypesChange(toggleItem(filters.types, option.value))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <h4>Формат</h4>
        <div className="filter-group__options">
          {formatOptions.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={filters.formats.includes(option.value)}
                onChange={() => onFormatsChange(toggleItem(filters.formats, option.value))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="filter-group">
        <h4>Статус</h4>
        <div className="filter-group__options">
          {statusGroups.map((group) => {
            const checked = group.values.every((value) => filters.statuses.includes(value))
            return (
              <label key={group.key}>
                <input type="checkbox" checked={checked} onChange={() => toggleStatusGroup(group.values)} />
                <span>{group.label}</span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="filter-group">
        <h4>Дополнительно</h4>
        <div className="toggle-list">
          <label className="toggle-item">
            <span>Только проверенные компании</span>
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(event) => onVerifiedOnlyChange(event.target.checked)}
            />
          </label>
        </div>
      </section>
    </aside>
  )
}
