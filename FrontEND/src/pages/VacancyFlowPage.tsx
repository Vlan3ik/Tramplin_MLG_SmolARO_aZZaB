import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchCities, fetchTags } from '../api/catalog'
import { createEmployerOpportunity, createEmployerVacancy } from '../api/employer'
import { reverseGeocode, type ReverseGeocodeResult } from '../api/map'
import { MapPointPicker, type MapPoint } from '../components/forms/MapPointPicker'
import { DateInput } from '../components/forms/DateInput'
import { TagPicker } from '../components/forms/TagPicker'
import type { City, TagListItem } from '../types/catalog'
import './VacancyFlowPage.css'

type Step = 1 | 2 | 3 | 4 | 5
type FlowType = 'vacancy' | 'event'

type VacancyForm = {
  title: string
  kind: number
  format: number
  mapPoint: MapPoint | null
  addressText: string
  tagIds: number[]
  shortDescription: string
  fullDescription: string
  salaryFrom: string
  salaryTo: string
  currencyCode: string
  salaryTaxMode: number
  applicationDeadline: string
}

type EventForm = {
  title: string
  kind: number
  format: number
  mapPoint: MapPoint | null
  addressText: string
  tagIds: number[]
  shortDescription: string
  fullDescription: string
  priceType: number
  priceAmount: string
  priceCurrencyCode: string
  participantsCanWrite: boolean
  eventDate: string
}

const steps = ['Выбор', 'Основные', 'Описание', 'Стоимость и опции', 'Публикация']
const validSteps = new Set(['1', '2', '3', '4', '5'])

function toIsoDateTimeFromLocalInput(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString()
}

function toNumberOrNull(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized.replace(',', '.'))
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function normalizeCurrencyCode(value: string) {
  const normalized = value.trim().toUpperCase()
  return normalized || null
}

function formatAddress(geo: ReverseGeocodeResult) {
  const address = [geo.countryCode, geo.regionName, geo.cityName, geo.streetName, geo.houseNumber]
    .filter((part) => part && String(part).trim())
    .join(', ')

  return address || 'Адрес не определен'
}

type StepperProps = {
  activeStep: Step
}

function Stepper({ activeStep }: StepperProps) {
  return (
    <div className="vf-stepper" aria-label="Прогресс создания">
      {steps.map((label, index) => {
        const stepNumber = (index + 1) as Step
        const isActive = stepNumber === activeStep
        const isDone = stepNumber < activeStep
        const isLast = stepNumber === 5

        return (
          <div
            className={`vf-stepper__item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${isLast ? 'is-last' : ''}`}
            key={label}
          >
            <div className={`vf-stepper__dot ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
              {stepNumber}
            </div>
            <span className={`vf-stepper__label ${isActive ? 'is-active' : ''}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function VacancyFlowPage() {
  const { step } = useParams<{ step?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [cities, setCities] = useState<City[]>([])
  const [tags, setTags] = useState<TagListItem[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [eventChatEnabled, setEventChatEnabled] = useState(true)

  const [vacancyForm, setVacancyForm] = useState<VacancyForm>({
    title: '',
    kind: 2,
    format: 2,
    mapPoint: null,
    addressText: '',
    tagIds: [],
    shortDescription: '',
    fullDescription: '',
    salaryFrom: '',
    salaryTo: '',
    currencyCode: 'RUB',
    salaryTaxMode: 3,
    applicationDeadline: '',
  })

  const [eventForm, setEventForm] = useState<EventForm>({
    title: '',
    kind: 4,
    format: 2,
    mapPoint: null,
    addressText: '',
    tagIds: [],
    shortDescription: '',
    fullDescription: '',
    priceType: 1,
    priceAmount: '',
    priceCurrencyCode: 'RUB',
    participantsCanWrite: true,
    eventDate: '',
  })

  const flowType: FlowType = searchParams.get('type') === 'event' ? 'event' : 'vacancy'
  const isVacancyFlow = flowType === 'vacancy'
  const currentStep = (step && validSteps.has(step) ? Number(step) : 1) as Step

  useEffect(() => {
    let active = true
    setLoadingCatalogs(true)

    Promise.allSettled([fetchCities(), fetchTags()])
      .then((results) => {
        if (!active) {
          return
        }

        const [citiesResult, tagsResult] = results

        if (citiesResult.status === 'fulfilled') {
          setCities(citiesResult.value)
        }

        if (tagsResult.status === 'fulfilled') {
          setTags(tagsResult.value)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoadingCatalogs(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setEventForm((state) => ({
      ...state,
      participantsCanWrite: eventChatEnabled,
    }))
  }, [eventChatEnabled])

  useEffect(() => {
    if (!success || currentStep !== 5) {
      return
    }

    const timer = window.setTimeout(() => {
      navigate('/')
    }, 3000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [currentStep, navigate, success])

  const mapCenter = useMemo<[number, number]>(() => {
    if (isVacancyFlow && vacancyForm.mapPoint) {
      return [vacancyForm.mapPoint.longitude, vacancyForm.mapPoint.latitude]
    }

    if (!isVacancyFlow && eventForm.mapPoint) {
      return [eventForm.mapPoint.longitude, eventForm.mapPoint.latitude]
    }

    const baseCity = cities.find((city) => city.latitude != null && city.longitude != null)
    if (baseCity?.latitude != null && baseCity.longitude != null) {
      return [baseCity.longitude, baseCity.latitude]
    }

    return [37.6156, 55.7522]
  }, [cities, eventForm.mapPoint, isVacancyFlow, vacancyForm.mapPoint])

  if (!step || !validSteps.has(step)) {
    return <Navigate to="/vacancy-flow/1" replace />
  }

  function navigateSmooth(url: string) {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }

    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        navigate(url)
      })
      return
    }

    navigate(url)
  }

  function goStep(nextStep: Step, type: FlowType = flowType) {
    navigateSmooth(`/vacancy-flow/${nextStep}?type=${type}`)
  }

  function nextStep() {
    const next = Math.min(5, currentStep + 1) as Step
    goStep(next)
  }

  function prevStep() {
    const prev = Math.max(1, currentStep - 1) as Step
    goStep(prev)
  }

  function onVacancyFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setVacancyForm((state) => ({
      ...state,
      [name]: name === 'kind' || name === 'format' || name === 'salaryTaxMode' ? Number(value) || 0 : value,
    }))
  }

  function onEventFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setEventForm((state) => ({
      ...state,
      [name]: name === 'kind' || name === 'format' || name === 'priceType' ? Number(value) || 0 : type === 'checkbox' ? checked : value,
    }))
  }

  async function resolveAddress(point: MapPoint) {
    setIsResolvingAddress(true)
    try {
      const geo = await reverseGeocode(point.latitude, point.longitude)
      return formatAddress(geo)
    } catch {
      return `Координаты: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
    } finally {
      setIsResolvingAddress(false)
    }
  }

  function onVacancyMapPointChange(point: MapPoint) {
    setError('')
    setVacancyForm((state) => ({
      ...state,
      mapPoint: point,
      addressText: `Координаты: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
    }))

    void resolveAddress(point).then((addressText) => {
      setVacancyForm((state) => {
        if (!state.mapPoint) {
          return state
        }

        const samePoint =
          state.mapPoint.latitude === point.latitude && state.mapPoint.longitude === point.longitude

        return samePoint ? { ...state, addressText } : state
      })
    })
  }

  function onEventMapPointChange(point: MapPoint) {
    setError('')
    setEventForm((state) => ({
      ...state,
      mapPoint: point,
      addressText: `Координаты: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
    }))

    void resolveAddress(point).then((addressText) => {
      setEventForm((state) => {
        if (!state.mapPoint) {
          return state
        }

        const samePoint =
          state.mapPoint.latitude === point.latitude && state.mapPoint.longitude === point.longitude

        return samePoint ? { ...state, addressText } : state
      })
    })
  }

  function onVacancyTagsChange(values: number[]) {
    setVacancyForm((state) => ({
      ...state,
      tagIds: values,
    }))
  }

  function onEventTagsChange(values: number[]) {
    setEventForm((state) => ({
      ...state,
      tagIds: values,
    }))
  }

  function validateStep(stepNumber: Step) {
    if (stepNumber === 1) {
      return null
    }

    if (isVacancyFlow) {
      if (stepNumber >= 2) {
        if (!vacancyForm.title.trim()) {
          return 'Укажите название вакансии.'
        }
        if (!vacancyForm.mapPoint) {
          return 'Выберите локацию на карте.'
        }
      }

      if (stepNumber >= 3) {
        if (!vacancyForm.shortDescription.trim()) {
          return 'Укажите краткое описание вакансии.'
        }
        if (!vacancyForm.fullDescription.trim()) {
          return 'Укажите полное описание вакансии.'
        }
      }

      if (stepNumber >= 4) {
        const applicationDeadline = vacancyForm.applicationDeadline.trim()
          ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline)
          : null

        if (vacancyForm.applicationDeadline.trim() && !applicationDeadline) {
          return 'Укажите корректный дедлайн откликов.'
        }

        if (applicationDeadline && Date.parse(applicationDeadline) < Date.now()) {
          return 'Дедлайн откликов не может быть раньше даты публикации.'
        }

        const salaryFrom = toNumberOrNull(vacancyForm.salaryFrom)
        const salaryTo = toNumberOrNull(vacancyForm.salaryTo)
        if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
          return 'Зарплата "до" должна быть больше или равна зарплате "от".'
        }
      }
    } else {
      if (stepNumber >= 2) {
        if (!eventForm.title.trim()) {
          return 'Укажите название мероприятия.'
        }
        if (!eventForm.mapPoint) {
          return 'Выберите локацию на карте.'
        }
      }

      if (stepNumber >= 3) {
        if (!eventForm.shortDescription.trim()) {
          return 'Укажите краткое описание мероприятия.'
        }
        if (!eventForm.fullDescription.trim()) {
          return 'Укажите полное описание мероприятия.'
        }
      }

      if (stepNumber >= 4) {
        const eventDate = eventForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(eventForm.eventDate) : null
        if (eventForm.eventDate.trim() && !eventDate) {
          return 'Укажите корректную дату мероприятия.'
        }

        const priceAmount = toNumberOrNull(eventForm.priceAmount)
        if ((eventForm.priceType === 2 || eventForm.priceType === 3) && priceAmount === null) {
          return 'Для платного или призового мероприятия укажите сумму.'
        }
      }
    }

    return null
  }

  function onContinue() {
    setError('')
    setSuccess('')

    const message = validateStep(currentStep)
    if (message) {
      setError(message)
      return
    }

    nextStep()
  }

  async function onPublish() {
    setError('')
    setSuccess('')

    const message = validateStep(4)
    if (message) {
      setError(message)
      return
    }

    setIsSubmitting(true)

    try {
      const publishAt = new Date().toISOString()

      if (isVacancyFlow) {
        const payload = {
          title: vacancyForm.title,
          shortDescription: vacancyForm.shortDescription,
          fullDescription: vacancyForm.fullDescription,
          kind: vacancyForm.kind,
          format: vacancyForm.format,
          status: 2,
          mapPoint: vacancyForm.mapPoint,
          salaryFrom: toNumberOrNull(vacancyForm.salaryFrom),
          salaryTo: toNumberOrNull(vacancyForm.salaryTo),
          currencyCode: normalizeCurrencyCode(vacancyForm.currencyCode),
          salaryTaxMode: vacancyForm.salaryTaxMode,
          publishAt,
          applicationDeadline: vacancyForm.applicationDeadline.trim() ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline) : null,
          tagIds: vacancyForm.tagIds,
        }

        await createEmployerVacancy(payload)
        setSuccess('Вакансия отправлена на модерацию.')
      } else {
        const priceAmount = toNumberOrNull(eventForm.priceAmount)
        const payload = {
          title: eventForm.title,
          shortDescription: eventForm.shortDescription,
          fullDescription: eventForm.fullDescription,
          kind: eventForm.kind,
          format: eventForm.format,
          status: 2,
          mapPoint: eventForm.mapPoint,
          priceType: eventForm.priceType,
          priceAmount: eventForm.priceType === 1 ? null : priceAmount,
          priceCurrencyCode: eventForm.priceType === 1 ? null : normalizeCurrencyCode(eventForm.priceCurrencyCode),
          participantsCanWrite: eventForm.participantsCanWrite,
          publishAt,
          eventDate: eventForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(eventForm.eventDate) : null,
          tagIds: eventForm.tagIds,
        }

        await createEmployerOpportunity(payload)
        setSuccess('Мероприятие отправлено на модерацию.')
      }

      goStep(5)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Не удалось опубликовать запись.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="vf-page">
      <main className="vf-content">
        <section className="vf-section">
          <Stepper activeStep={currentStep} />

          {loadingCatalogs ? <p className="vf-note">Загружаем справочники платформы...</p> : null}
          {error ? <p className="vf-message vf-message--error">{error}</p> : null}
          {success ? <p className="vf-message vf-message--success">{success}</p> : null}

          <div key={`${currentStep}-${flowType}`} className="vf-stage">
            {currentStep === 1 ? (
              <>
                <h1 className="vf-title">Выберите, что хотите создать</h1>
                <div className="vf-choice-grid">
                  <article className="vf-choice-card">
                    <img src="/чел сидит на цветке.svg" alt="Иллюстрация создания вакансии" />
                    <h2>Я хочу создать вакансию/стажировку</h2>
                    <p>Разместите предложение о работе или стажировке, чтобы найти кандидатов в свою команду.</p>
                    <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'vacancy')}>
                      Создать
                    </button>
                  </article>

                  <article className="vf-choice-card">
                    <img src="/чел стоит рядом цветок.svg" alt="Иллюстрация создания мероприятия" />
                    <h2>Я хочу создать мероприятие</h2>
                    <p>Создайте страницу события и приглашайте участников на встречи, вебинары и мастер-классы.</p>
                    <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'event')}>
                      Создать
                    </button>
                  </article>
                </div>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <h2 className="vf-title">Основная информация</h2>

                <div className="vf-form-grid">
                  <label className="vf-field vf-field--full">
                    <span>Название</span>
                    <input
                      type="text"
                      name="title"
                      value={isVacancyFlow ? vacancyForm.title : eventForm.title}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'Например, Frontend-разработчик' : 'Например, Хакатон Трамплин'}
                    />
                  </label>

                  <label className="vf-field">
                    <span>Вид</span>
                    {isVacancyFlow ? (
                      <select name="kind" value={vacancyForm.kind} onChange={onVacancyFormChange}>
                        <option value={2}>Работа</option>
                        <option value={1}>Стажировка</option>
                      </select>
                    ) : (
                      <select name="kind" value={eventForm.kind} onChange={onEventFormChange}>
                        <option value={1}>Хакатон</option>
                        <option value={2}>День открытых дверей</option>
                        <option value={3}>Лекция</option>
                        <option value={4}>Другое</option>
                      </select>
                    )}
                  </label>

                  <label className="vf-field">
                    <span>Формат</span>
                    {isVacancyFlow ? (
                      <select name="format" value={vacancyForm.format} onChange={onVacancyFormChange}>
                        <option value={1}>Офис</option>
                        <option value={2}>Гибрид</option>
                        <option value={3}>Удаленно</option>
                      </select>
                    ) : (
                      <select name="format" value={eventForm.format} onChange={onEventFormChange}>
                        <option value={1}>Офис</option>
                        <option value={2}>Гибрид</option>
                        <option value={3}>Удаленно</option>
                      </select>
                    )}
                  </label>

                  <div className="vf-field vf-field--full">
                    <span>Локация на карте</span>
                    <MapPointPicker
                      className="vf-map-picker"
                      value={isVacancyFlow ? vacancyForm.mapPoint : eventForm.mapPoint}
                      onChange={isVacancyFlow ? onVacancyMapPointChange : onEventMapPointChange}
                      defaultCenter={mapCenter}
                      defaultZoom={11}
                    />
                    <p className="vf-map-hint">Кликните по карте, чтобы выбрать точку.</p>
                    <p className="vf-map-address">
                      {isResolvingAddress
                        ? 'Определяем адрес...'
                        : isVacancyFlow
                          ? vacancyForm.addressText || 'Адрес пока не выбран'
                          : eventForm.addressText || 'Адрес пока не выбран'}
                    </p>
                  </div>

                  <label className="vf-field vf-field--full">
                    <span>Теги</span>
                    <TagPicker
                      className="vf-tag-picker"
                      options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
                      selectedIds={isVacancyFlow ? vacancyForm.tagIds : eventForm.tagIds}
                      onChange={isVacancyFlow ? onVacancyTagsChange : onEventTagsChange}
                      placeholder="Выберите теги"
                      searchPlaceholder="Поиск по тегам..."
                      emptyMessage="Теги не найдены"
                    />
                  </label>
                </div>
                <p className="vf-note vf-note--moderation">After submit, the card is sent to moderation automatically.</p>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <h2 className="vf-title">Описание</h2>
                <div className="vf-editor-grid">
                  <label className="vf-editor">
                    <span>Краткое описание</span>
                    <textarea
                      name="shortDescription"
                      rows={7}
                      value={isVacancyFlow ? vacancyForm.shortDescription : eventForm.shortDescription}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'Кратко опишите вакансию' : 'Кратко опишите мероприятие'}
                    />
                  </label>
                  <label className="vf-editor">
                    <span>Полное описание</span>
                    <textarea
                      name="fullDescription"
                      rows={7}
                      value={isVacancyFlow ? vacancyForm.fullDescription : eventForm.fullDescription}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'Подробно опишите вакансию' : 'Подробно опишите программу мероприятия'}
                    />
                  </label>
                </div>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <h2 className="vf-title">Стоимость и опции</h2>

                {isVacancyFlow ? (
                  <div className="vf-form-grid vf-form-grid--salary">
                    <label className="vf-field">
                      <span>Зарплата от</span>
                      <input type="number" name="salaryFrom" value={vacancyForm.salaryFrom} onChange={onVacancyFormChange} placeholder="Например, 20000" />
                    </label>
                    <label className="vf-field">
                      <span>Зарплата до</span>
                      <input type="number" name="salaryTo" value={vacancyForm.salaryTo} onChange={onVacancyFormChange} placeholder="Например, 50000" />
                    </label>
                    <label className="vf-field">
                      <span>Валюта</span>
                      <input type="text" name="currencyCode" value={vacancyForm.currencyCode} onChange={onVacancyFormChange} maxLength={3} />
                    </label>
                    <label className="vf-field">
                      <span>Налоговый режим</span>
                      <select name="salaryTaxMode" value={vacancyForm.salaryTaxMode} onChange={onVacancyFormChange}>
                        <option value={1}>До вычета налогов</option>
                        <option value={2}>После вычета налогов</option>
                        <option value={3}>Не указано</option>
                      </select>
                    </label>
                    <label className="vf-field">
                      <span>Дедлайн откликов</span>
                      <DateInput type="datetime-local" name="applicationDeadline" value={vacancyForm.applicationDeadline} onChange={onVacancyFormChange} />
                    </label>
                  </div>
                ) : (
                  <div className="vf-form-grid vf-form-grid--event">
                    <label className="vf-field">
                      <span>Тип цены</span>
                      <select name="priceType" value={eventForm.priceType} onChange={onEventFormChange}>
                        <option value={1}>Бесплатно</option>
                        <option value={2}>Платно</option>
                        <option value={3}>Приз</option>
                      </select>
                    </label>
                    <label className="vf-field">
                      <span>Сумма</span>
                      <input type="number" name="priceAmount" value={eventForm.priceAmount} onChange={onEventFormChange} placeholder="Например, 2000" />
                    </label>
                    <label className="vf-field">
                      <span>Валюта</span>
                      <input type="text" name="priceCurrencyCode" value={eventForm.priceCurrencyCode} onChange={onEventFormChange} maxLength={3} />
                    </label>
                    <label className="vf-field">
                      <span>Дата события</span>
                      <DateInput type="datetime-local" name="eventDate" value={eventForm.eventDate} onChange={onEventFormChange} />
                    </label>

                    <div className="vf-switch-row">
                      <span>Участники группы могут писать в чат</span>
                      <button
                        type="button"
                        className={`vf-switch ${eventChatEnabled ? 'is-on' : ''}`}
                        onClick={() => setEventChatEnabled((prev) => !prev)}
                        aria-pressed={eventChatEnabled}
                      >
                        <span className="vf-switch__thumb" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Дальше
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 5 ? (
              <div className="vf-section--publish">
                <h2 className="vf-congrats">Проверка перед отправкой</h2>
                <p className="vf-congrats__text">
                  {isVacancyFlow
                    ? 'Проверьте заполнение вакансии и отправьте ее на модерацию.'
                    : 'Проверьте заполнение мероприятия и отправьте его на модерацию.'}
                </p>
                {success ? <p className="vf-note">Через несколько секунд вы вернетесь на главную страницу.</p> : null}
                <img className="vf-congrats__image" src="/гордый чел стоит.svg" alt="Иллюстрация публикации" />
                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep} disabled={isSubmitting}>
                    Назад
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={() => void onPublish()} disabled={isSubmitting}>
                    {isSubmitting ? 'Отправляем...' : 'Опубликовать'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  )
}

