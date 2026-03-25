import { useEffect, useMemo, useRef, useState } from 'react'

type TagPickerOption = {
  id: number
  label: string
}

type TagPickerProps = {
  options: TagPickerOption[]
  selectedIds: number[]
  onChange: (next: number[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  multiple?: boolean
  className?: string
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export function TagPicker({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select tags',
  searchPlaceholder = 'Search...',
  emptyMessage = 'Nothing found',
  disabled = false,
  multiple = true,
  className = '',
}: TagPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedLabels = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)).map((option) => option.label),
    [options, selectedSet],
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) => normalizeSearch(option.label).includes(normalizedQuery))
  }, [options, query])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  function toggleOption(id: number) {
    if (multiple) {
      onChange(selectedSet.has(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id])
      return
    }

    onChange(selectedSet.has(id) ? [] : [id])
    setIsOpen(false)
  }

  const rootClassName = `tag-picker${disabled ? ' is-disabled' : ''}${isOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        type="button"
        className="tag-picker__trigger"
        onClick={() => !disabled && setIsOpen((value) => !value)}
        disabled={disabled}
      >
        <span className="tag-picker__value">
          {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
        </span>
        <span className="tag-picker__arrow" aria-hidden>
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="tag-picker__dropdown">
          <input
            className="tag-picker__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className="tag-picker__list">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = selectedSet.has(option.id)
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`tag-picker__option${isSelected ? ' is-selected' : ''}`}
                    onClick={() => toggleOption(option.id)}
                  >
                    <span>{option.label}</span>
                    {isSelected ? <span className="tag-picker__option-check">✓</span> : null}
                  </button>
                )
              })
            ) : (
              <p className="tag-picker__empty">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
