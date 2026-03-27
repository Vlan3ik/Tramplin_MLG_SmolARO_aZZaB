import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { fetchTagGroups, fetchTags } from '../../api/catalog'
import type { TagGroup, TagListItem } from '../../types/catalog'
import type { OpportunityFilters } from '../../types/opportunity'
import { getTagDisplayLabel, getTagGroupDisplayLabel } from '../../utils/tag-labels'

type FilterModalProps = {
  isOpen: boolean
  filters: OpportunityFilters
  onApply: (filters: OpportunityFilters) => void
  onClose: () => void
  onReset: () => void
}

type TagSection = {
  key: string
  label: string
  tags: TagListItem[]
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

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function normalizeGroupToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9а-яё]/gi, '')
}

function isVacancyTypeGroup(groupCode: string, groupName: string) {
  const normalizedCode = normalizeGroupToken(groupCode)
  const normalizedName = normalizeGroupToken(groupName)

  return (
    normalizedCode.includes('vacancytype') ||
    normalizedCode.includes('vacancykind') ||
    normalizedName.includes('типвакансии')
  )
}

function buildTagSections(tags: TagListItem[], groups: TagGroup[]) {
  const groupsById = new Map<number, TagGroup>()
  const groupsByCode = new Map<string, TagGroup>()

  for (const group of groups) {
    groupsById.set(group.id, group)
    groupsByCode.set(group.code, group)
  }

  const grouped = new Map<string, TagSection>()

  for (const tag of tags) {
    const knownGroup = groupsById.get(tag.groupId) ?? groupsByCode.get(tag.groupCode)
    const groupCode = knownGroup?.code ?? tag.groupCode ?? ''
    const groupLabel = knownGroup?.name ?? tag.groupCode ?? 'Прочее'

    if (isVacancyTypeGroup(groupCode, groupLabel)) {
      continue
    }

    const sectionKey = knownGroup ? `group-${knownGroup.id}` : `group-code-${groupCode || 'other'}`
    const section = grouped.get(sectionKey)

    if (section) {
      section.tags.push(tag)
      continue
    }

    grouped.set(sectionKey, {
      key: sectionKey,
      label: groupLabel,
      tags: [tag],
    })
  }

  return Array.from(grouped.values())
    .map((section) => ({
      ...section,
      tags: [...section.tags].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

export function FilterModal({ isOpen, filters, onApply, onClose, onReset }: FilterModalProps) {
  const [draft, setDraft] = useState<OpportunityFilters>(filters)
  const [tagSections, setTagSections] = useState<TagSection[]>([])
  const [allTags, setAllTags] = useState<TagListItem[]>([])
  const [isTagsLoading, setIsTagsLoading] = useState(false)
  const [isTagsLoaded, setIsTagsLoaded] = useState(false)
  const [tagsError, setTagsError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(filters)
  }, [filters, isOpen])

  useEffect(() => {
    if (!isOpen || isTagsLoaded) {
      return
    }

    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTagsLoading(true)
    setTagsError('')

    void Promise.all([
      fetchTags(controller.signal),
      fetchTagGroups(controller.signal).catch(() => []),
    ])
      .then(([tags, groups]) => {
        if (!controller.signal.aborted) {
          setAllTags(tags)
          setTagSections(buildTagSections(tags, groups))
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
          setIsTagsLoaded(true)
        }
      })

    return () => controller.abort()
  }, [isOpen, isTagsLoaded])

  const hasActiveFilters = useMemo(
    () =>
      draft.types.length > 0 ||
      draft.formats.length > 0 ||
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
            {isTagsLoading ? <p>Загружаем навыки...</p> : null}
            {!isTagsLoading && tagsError ? <p className="filters-modal__error">{tagsError}</p> : null}
            {!isTagsLoading && !tagsError ? (
              tagSections.length ? (
                tagSections.map((section) => (
                  <div className="filter-group__section" key={section.key}>
                    <h5>{getTagGroupDisplayLabel(section.label)}</h5>
                    <div className="filter-group__options filter-group__options--scroll">
                      {section.tags.map((tag) => (
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
                          <span>{getTagDisplayLabel(tag.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : allTags.length ? (
                <div className="filter-group__options filter-group__options--scroll">
                  {allTags.map((tag) => (
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
                      <span>{getTagDisplayLabel(tag.name)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p>Теги не найдены.</p>
              )
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
            <h4>Дополнительно</h4>
            <div className="toggle-list">
              <label className="toggle-item">
                <span>Только верифицированные компании</span>
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
              </label>
            </div>
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
              onApply({ ...draft, statuses: [] })
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
