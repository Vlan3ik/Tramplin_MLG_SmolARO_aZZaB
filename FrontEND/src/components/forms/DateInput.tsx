import { CalendarDays } from 'lucide-react'
import { type InputHTMLAttributes, useRef } from 'react'

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: 'date' | 'datetime-local'
}

export function DateInput({ type = 'date', className = '', ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input || input.disabled) {
      return
    }

    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
  }

  const wrapperClassName = `date-input${className ? ` ${className}` : ''}`

  return (
    <span className={wrapperClassName}>
      <input ref={inputRef} type={type} {...props} />
      <button type="button" className="date-input__trigger" onClick={openPicker} aria-label="Open date picker" tabIndex={-1}>
        <CalendarDays size={16} />
      </button>
    </span>
  )
}
