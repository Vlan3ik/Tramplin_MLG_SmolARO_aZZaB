import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'

type DateInputType = 'date' | 'datetime-local'

type DateInputProps = {
  type?: DateInputType
  name?: string
  id?: string
  value?: string
  min?: string
  max?: string
  disabled?: boolean
  required?: boolean
  className?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function parseDateValue(value: string, type: DateInputType) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (type === 'date') {
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
      return null
    }

    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const parsed = new Date(year, month, day, 0, 0, 0, 0)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const parsed = new Date(year, month, day, hour, minute, 0, 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(date: Date, time: string) {
  return `${formatDate(date)}T${time}`
}

function toTimeValue(date: Date | null) {
  if (!date) {
    return '09:00'
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function withTime(date: Date, time: string) {
  const [hoursRaw, minutesRaw] = time.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  const next = new Date(date)
  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return next
}

function normalizeDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) {
    return false
  }

  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDisplayValue(value: Date | null, type: DateInputType, timeValue: string) {
  if (!value) {
    return ''
  }

  const dateText = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(value)
  return type === 'date' ? dateText : `${dateText}, ${timeValue}`
}

export function DateInput({
  type = 'date',
  name,
  id,
  value = '',
  min,
  max,
  disabled = false,
  required = false,
  className = '',
  onChange,
}: DateInputProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const parsedValue = useMemo(() => parseDateValue(value, type), [type, value])
  const minDate = useMemo(() => (min ? parseDateValue(min, type) : null), [min, type])
  const maxDate = useMemo(() => (max ? parseDateValue(max, type) : null), [max, type])

  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(parsedValue ?? new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedValue)
  const [timeValue, setTimeValue] = useState(toTimeValue(parsedValue))

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [isOpen])

  function emitChange(nextValue: string) {
    onChange?.({
      target: { name: name ?? '', value: nextValue, type } as EventTarget & HTMLInputElement,
      currentTarget: { name: name ?? '', value: nextValue, type } as EventTarget & HTMLInputElement,
    } as ChangeEvent<HTMLInputElement>)
  }

  function closePicker() {
    setIsOpen(false)
  }

  function applyValue(date: Date | null, customTime = timeValue) {
    if (!date) {
      emitChange('')
      closePicker()
      return
    }

    const nextValue = type === 'date' ? formatDate(date) : formatDateTime(date, customTime)
    emitChange(nextValue)
    closePicker()
  }

  function isOutOfRange(day: Date) {
    const current = normalizeDay(day).getTime()
    const minValue = minDate ? normalizeDay(minDate).getTime() : null
    const maxValue = maxDate ? normalizeDay(maxDate).getTime() : null

    if (minValue !== null && current < minValue) {
      return true
    }

    if (maxValue !== null && current > maxValue) {
      return true
    }

    return false
  }

  function selectDay(day: Date) {
    if (isOutOfRange(day)) {
      return
    }

    const dayValue = normalizeDay(day)
    const next = type === 'datetime-local' ? withTime(dayValue, timeValue) : dayValue
    setSelectedDate(next)
    if (type === 'date') {
      applyValue(next)
    }
  }

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const startWeekDay = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const days: Array<Date | null> = []

  for (let index = 0; index < startWeekDay; index += 1) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 0, 0, 0, 0))
  }

  const displayDate = isOpen ? selectedDate : parsedValue
  const displayTime = isOpen ? timeValue : toTimeValue(parsedValue)
  const displayValue = formatDisplayValue(displayDate, type, displayTime)
  const wrapperClassName = `date-input${className ? ` ${className}` : ''}${disabled ? ' is-disabled' : ''}${isOpen ? ' is-open' : ''}`

  return (
    <span className={wrapperClassName} ref={rootRef}>
      <input type="hidden" name={name} value={value} required={required} disabled={disabled} />
      <button
        id={id}
        type="button"
        className="date-input__display"
        disabled={disabled}
        onClick={() =>
          setIsOpen((current) => {
            if (current) {
              return false
            }

            setSelectedDate(parsedValue)
            setTimeValue(toTimeValue(parsedValue))
            if (parsedValue) {
              setViewDate(parsedValue)
            }

            return true
          })
        }
      >
        <span className="date-input__display-text">{displayValue || 'Выберите дату'}</span>
        <CalendarDays size={16} />
      </button>

      {isOpen ? (
        <span className="date-input__dropdown" role="dialog" aria-modal="false">
          <span className="date-input__head">
            <button type="button" className="date-input__month-btn" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <strong>{`${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`}</strong>
            <button type="button" className="date-input__month-btn" onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </span>

          <span className="date-input__weekdays">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </span>

          <span className="date-input__grid">
            {days.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="date-input__day is-empty" />
              }

              const disabledDay = isOutOfRange(day)
              const isSelected = sameDay(selectedDate, day)
              const isToday = sameDay(day, new Date())
              return (
                <button
                  type="button"
                  key={formatDate(day)}
                  className={`date-input__day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => selectDay(day)}
                  disabled={disabledDay}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </span>

          {type === 'datetime-local' ? (
            <span className="date-input__time">
              <span>Время</span>
              <input
                type="time"
                value={timeValue}
                onChange={(event) => {
                  setTimeValue(event.target.value)
                  if (selectedDate) {
                    setSelectedDate(withTime(selectedDate, event.target.value))
                  }
                }}
              />
            </span>
          ) : null}

          <span className="date-input__actions">
            <button
              type="button"
              className="date-input__action-btn"
              onClick={() => {
                const now = new Date()
                applyValue(type === 'datetime-local' ? now : normalizeDay(now), type === 'datetime-local' ? toTimeValue(now) : timeValue)
              }}
            >
              Сегодня
            </button>
            <button type="button" className="date-input__action-btn" onClick={() => applyValue(null)}>
              Очистить
            </button>
            {type === 'datetime-local' ? (
              <button
                type="button"
                className="date-input__action-btn is-primary"
                onClick={() => applyValue(selectedDate)}
                disabled={!selectedDate}
              >
                Применить
              </button>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  )
}
