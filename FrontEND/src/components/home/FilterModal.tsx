import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { fetchTechnologyTags } from '../../api/catalog'
import type { TagListItem } from '../../types/catalog'
import type { OpportunityFilters } from '../../types/opportunity'

type FilterModalProps = {
  isOpen: boolean
  filters: OpportunityFilters
  onApply: (filters: OpportunityFilters) => void
  onClose: () => void
  onReset: () => void
}

const formatOptions = [
  { value: 'remote', label: 'Удаленно' },
  { value: 'hybrid', label: 'Гибрид' },
  { value: 'onsite', label: 'Офис' },
]

const typeOptions = [
  { value: 'vacancy', label: 'Вакансии' },
  { value: 'internship', label: 'Стажировки' },
  { value: 'event', label: 'Мероприятия' },
  { value: 'mentorship', label: 'Менторство' },
] as const

const statusOptions = [
  { value: 1, label: 'Запланировано' },
  { value: 2, label: 'На модерации' },
  { value: 3, label: 'Активно' },
  { value: 4, label: 'Закрыто' },
  { value: 5, label: 'Отменено' },
  { value: 6, label: 'Отклонено' },
  { value: 7, label: 'В архиве' },
]

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function FilterModal({ isOpen, filters, onApply, onClose, onReset }: FilterModalProps) {
  const [draft, setDraft] = useState<OpportunityFilters>(filters)
  const [technologyTags, setTechnologyTags] = useState<TagListItem[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDraft(filters)
  }, [filters, isOpen])

  useEffect(() => {
    if (!isOpen || technologyTags.length > 0 || isTagsLoading) {
      return
    }

    const controller = new AbortController()
    setIsTagsLoading(true)
    setTagsError('')

    void fetchTechnologyTags(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setTechnologyTags(items)
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setTagsError(error instanceof Error ? error.message : 'Не удалось загрузить навыки.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTagsLoading(false)
        }
      })

    return () => controller.abort()
  }, [isOpen, isTagsLoading, technologyTags.length])

  const hasActiveFilters = useMemo(
    () =>
      draft.types.length > 0 ||
      draft.formats.length > 0 ||
      draft.statuses.length > 0 ||
      draft.tagIds.length > 0 ||
      draft.salaryFrom != null ||
      draft.salaryTo != null ||
      draft.verifiedOnly,
    [draft],
  )

  if (!isOpen) {
    return null
  }

  return (
    <div className="filters-modal" role="dialog" aria-modal="true" aria-label="Фильтры поиска">
      <button type="button" className="filters-modal__backdrop" aria-label="Закрыть фильтры" onClick={onClose} />
      <div className="filters-modal__dialog card">
        <div className="filters-modal__head">
          <h3>Фильтры</h3>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="filters-modal__body">
          <section className="filter-group">
            <h4>Тип возможности</h4>
            <div className="filter-group__options">
              {typeOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={draft.types.includes(option.value)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        types: toggleArrayValue(current.types, option.value),
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="filter-group">
            <h4>Навыки</h4>
            {isTagsLoading ? <p>Загружаем навыки...</p> : null}
            {!isTagsLoading && tagsError ? <p className="filters-modal__error">{tagsError}</p> : null}
            {!isTagsLoading && !tagsError ? (
              <div className="filter-group__options filter-group__options--scroll">
                {technologyTags.map((tag) => (
                  <label key={tag.id}>
                    <input
                      type="checkbox"
                      checked={draft.tagIds.includes(tag.id)}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          tagIds: toggleArrayValue(current.tagIds, tag.id),
                        }))
                      }
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="filter-group">
            <h4>Уровень зарплаты (вакансии)</h4>
            <div className="filters-modal__salary-grid">
              <label className="input-wrap">
                <span>От</span>
                <input
                  type="number"
                  min={0}
                  value={draft.salaryFrom ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim()
                    setDraft((current) => ({
                      ...current,
                      salaryFrom: nextValue ? Number(nextValue) : null,
                    }))
                  }}
                  placeholder="Например, 100000"
                />
              </label>
              <label className="input-wrap">
                <span>До</span>
                <input
                  type="number"
                  min={0}
                  value={draft.salaryTo ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim()
                    setDraft((current) => ({
                      ...current,
                      salaryTo: nextValue ? Number(nextValue) : null,
                    }))
                  }}
                  placeholder="Например, 300000"
                />
              </label>
            </div>
          </section>

          <section className="filter-group">
            <h4>Формат работы</h4>
            <div className="filter-group__options">
              {formatOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={draft.formats.includes(option.value)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        formats: toggleArrayValue(current.formats, option.value),
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="filter-group">
            <h4>Статусы</h4>
            <div className="filter-group__options">
              {statusOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={draft.statuses.includes(option.value)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        statuses: toggleArrayValue(current.statuses, option.value),
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={draft.verifiedOnly}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    verifiedOnly: event.target.checked,
                  }))
                }
              />
              <span>Только верифицированные компании</span>
            </label>
          </section>
        </div>

        <div className="filters-modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              onReset()
              onClose()
            }}
            disabled={!hasActiveFilters}
          >
            Сбросить
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Применить
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
