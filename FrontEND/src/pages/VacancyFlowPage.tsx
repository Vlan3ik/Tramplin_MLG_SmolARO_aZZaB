import { ArrowLeft } from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchCities, fetchTags } from '../api/catalog'
import {
  createEmployerOpportunity,
  createEmployerVacancy,
  fetchEmployerLocationCities,
  fetchEmployerLocationHouses,
  fetchEmployerLocationStreets,
  type EmployerAddressCitySuggestion,
  type EmployerAddressHouseSuggestion,
  type EmployerAddressStreetSuggestion,
} from '../api/employer'
import { DateInput } from '../components/forms/DateInput'
import { MapPointPicker, type MapPoint } from '../components/forms/MapPointPicker'
import { TagPicker } from '../components/forms/TagPicker'
import { Footer } from '../components/layout/Footer'
import { MainHeader } from '../components/layout/MainHeader'
import { TopServiceBar } from '../components/layout/TopServiceBar'
import type { City, TagListItem } from '../types/catalog'
import './VacancyFlowPage.css'

type Step = 1 | 2 | 3 | 4 | 5
type FlowType = 'vacancy' | 'event'

type BaseForm = {
  title: string
  kind: number
  format: number
  cityId: number | null
  cityQuery: string
  streetName: string
  houseNumber: string
  mapPoint: MapPoint | null
  tagIds: number[]
  shortDescription: string
  fullDescription: string
  status: number
}

type VacancyForm = BaseForm & {
  salaryFrom: string
  salaryTo: string
  currencyCode: string
  salaryTaxMode: number
  applicationDeadline: string
}

type EventForm = BaseForm & {
  priceType: number
  priceAmount: string
  priceCurrencyCode: string
  participantsCanWrite: boolean
  eventDate: string
}

const steps = ['Р’С‹Р±РѕСЂ', 'РћСЃРЅРѕРІРЅС‹Рµ', 'РћРїРёСЃР°РЅРёРµ', 'РЎС‚РѕРёРјРѕСЃС‚СЊ Рё РѕРїС†РёРё', 'РџСѓР±Р»РёРєР°С†РёСЏ']
const validSteps = new Set(['1', '2', '3', '4', '5'])

const toNumberOrNull = (value: string) => {
  const n = Number(value.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const normalizeCurrencyCode = (value: string) => value.trim().toUpperCase() || null
const toIso = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
const trim = (value: string) => value.trim()
const buildAddressText = (cityName: string, streetName: string, houseNumber: string) => {
  const parts = [cityName, streetName, houseNumber].map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Address is not selected'
}
const citySuggestionLabel = (city: EmployerAddressCitySuggestion) => {
  const extra = [city.regionName, city.countryCode].filter(Boolean).join(', ')
  return extra ? `${city.cityName} (${extra})` : city.cityName
}

function Stepper({ activeStep }: { activeStep: Step }) {
  return (
    <div className="vf-stepper" aria-label="РџСЂРѕРіСЂРµСЃСЃ СЃРѕР·РґР°РЅРёСЏ">
      {steps.map((label, index) => {
        const stepNumber = (index + 1) as Step
        return (
          <div className={`vf-stepper__item ${stepNumber === activeStep ? 'is-active' : ''} ${stepNumber < activeStep ? 'is-done' : ''} ${stepNumber === 5 ? 'is-last' : ''}`} key={label}>
            <div className={`vf-stepper__dot ${stepNumber === activeStep ? 'is-active' : ''} ${stepNumber < activeStep ? 'is-done' : ''}`}>{stepNumber}</div>
            <span className={`vf-stepper__label ${stepNumber === activeStep ? 'is-active' : ''}`}>{label}</span>
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [eventChatEnabled, setEventChatEnabled] = useState(true)

  const [vacancyCitySuggestions, setVacancyCitySuggestions] = useState<EmployerAddressCitySuggestion[]>([])
  const [vacancyStreetSuggestions, setVacancyStreetSuggestions] = useState<EmployerAddressStreetSuggestion[]>([])
  const [vacancyHouseSuggestions, setVacancyHouseSuggestions] = useState<EmployerAddressHouseSuggestion[]>([])
  const [eventCitySuggestions, setEventCitySuggestions] = useState<EmployerAddressCitySuggestion[]>([])
  const [eventStreetSuggestions, setEventStreetSuggestions] = useState<EmployerAddressStreetSuggestion[]>([])
  const [eventHouseSuggestions, setEventHouseSuggestions] = useState<EmployerAddressHouseSuggestion[]>([])

  const [vacancyForm, setVacancyForm] = useState<VacancyForm>({ title: '', kind: 2, format: 2, cityId: null, cityQuery: '', streetName: '', houseNumber: '', mapPoint: null, tagIds: [], shortDescription: '', fullDescription: '', salaryFrom: '', salaryTo: '', currencyCode: 'RUB', salaryTaxMode: 3, applicationDeadline: '', status: 1 })
  const [eventForm, setEventForm] = useState<EventForm>({ title: '', kind: 4, format: 2, cityId: null, cityQuery: '', streetName: '', houseNumber: '', mapPoint: null, tagIds: [], shortDescription: '', fullDescription: '', priceType: 1, priceAmount: '', priceCurrencyCode: 'RUB', participantsCanWrite: true, eventDate: '', status: 1 })

  const flowType: FlowType = searchParams.get('type') === 'event' ? 'event' : 'vacancy'
  const isVacancyFlow = flowType === 'vacancy'
  const currentStep = (step && validSteps.has(step) ? Number(step) : 1) as Step

  useEffect(() => {
    let active = true
    setLoadingCatalogs(true)
    Promise.allSettled([fetchCities(), fetchTags()]).then((results) => {
      if (!active) return
      const [citiesResult, tagsResult] = results
      if (citiesResult.status === 'fulfilled') setCities(citiesResult.value)
      if (tagsResult.status === 'fulfilled') setTags(tagsResult.value)
    }).finally(() => active && setLoadingCatalogs(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    setEventForm((state) => ({ ...state, participantsCanWrite: eventChatEnabled }))
  }, [eventChatEnabled])

  useEffect(() => {
    if (!success || currentStep !== 5) return
    const timer = window.setTimeout(() => navigate('/'), 3000)
    return () => window.clearTimeout(timer)
  }, [currentStep, navigate, success])

  const selectedCity = useMemo(() => {
    const cityId = isVacancyFlow ? vacancyForm.cityId : eventForm.cityId
    return cityId ? cities.find((city) => city.id === cityId) ?? null : null
  }, [cities, eventForm.cityId, isVacancyFlow, vacancyForm.cityId])

  const activeAddress = isVacancyFlow ? vacancyForm : eventForm
  const mapCenter = useMemo<[number, number]>(() => {
    if (activeAddress.mapPoint) return [activeAddress.mapPoint.longitude, activeAddress.mapPoint.latitude]
    if (selectedCity?.latitude != null && selectedCity.longitude != null) return [selectedCity.longitude, selectedCity.latitude]
    const baseCity = cities.find((city) => city.latitude != null && city.longitude != null)
    return baseCity?.latitude != null && baseCity.longitude != null ? [baseCity.longitude, baseCity.latitude] : [37.6156, 55.7522]
  }, [activeAddress.mapPoint, cities, selectedCity])

  if (!step || !validSteps.has(step)) return <Navigate to="/vacancy-flow/1" replace />

  function navigateSmooth(url: string) {
    const doc = document as Document & { startViewTransition?: (callback: () => void) => void }
    if (doc.startViewTransition) {
      doc.startViewTransition(() => navigate(url))
      return
    }
    navigate(url)
  }

  const goStep = (nextStep: Step, type: FlowType = flowType) => navigateSmooth(`/vacancy-flow/${nextStep}?type=${type}`)
  const nextStep = () => goStep(Math.min(5, currentStep + 1) as Step)
  const prevStep = () => goStep(Math.max(1, currentStep - 1) as Step)

  function onVacancyFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    if (name === 'cityQuery') {
      setVacancyForm((state) => ({ ...state, cityQuery: value, cityId: null, streetName: '', houseNumber: '', mapPoint: null }))
      return
    }
    if (name === 'streetName') {
      setVacancyForm((state) => ({ ...state, streetName: value, houseNumber: '' }))
      return
    }
    setVacancyForm((state) => ({ ...state, [name]: name === 'kind' || name === 'format' || name === 'salaryTaxMode' || name === 'status' ? Number(value) || 0 : value }))
  }

  function onEventFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked
    if (name === 'cityQuery') {
      setEventForm((state) => ({ ...state, cityQuery: value, cityId: null, streetName: '', houseNumber: '', mapPoint: null }))
      return
    }
    if (name === 'streetName') {
      setEventForm((state) => ({ ...state, streetName: value, houseNumber: '' }))
      return
    }
    setEventForm((state) => ({ ...state, [name]: name === 'kind' || name === 'format' || name === 'priceType' || name === 'status' ? Number(value) || 0 : type === 'checkbox' ? checked : value }))
  }

  useEffect(() => {
    if (vacancyForm.cityId || !trim(vacancyForm.cityQuery)) {
      setVacancyCitySuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationCities(trim(vacancyForm.cityQuery), 10, controller.signal)
        .then(setVacancyCitySuggestions)
        .catch(() => setVacancyCitySuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [vacancyForm.cityId, vacancyForm.cityQuery])

  useEffect(() => {
    if (eventForm.cityId || !trim(eventForm.cityQuery)) {
      setEventCitySuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationCities(trim(eventForm.cityQuery), 10, controller.signal)
        .then(setEventCitySuggestions)
        .catch(() => setEventCitySuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [eventForm.cityId, eventForm.cityQuery])

  useEffect(() => {
    if (!vacancyForm.cityId || !trim(vacancyForm.streetName)) {
      setVacancyStreetSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationStreets(vacancyForm.cityId as number, trim(vacancyForm.streetName), 10, controller.signal)
        .then(setVacancyStreetSuggestions)
        .catch(() => setVacancyStreetSuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [vacancyForm.cityId, vacancyForm.streetName])

  useEffect(() => {
    if (!eventForm.cityId || !trim(eventForm.streetName)) {
      setEventStreetSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationStreets(eventForm.cityId as number, trim(eventForm.streetName), 10, controller.signal)
        .then(setEventStreetSuggestions)
        .catch(() => setEventStreetSuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [eventForm.cityId, eventForm.streetName])

  useEffect(() => {
    if (!vacancyForm.cityId || !trim(vacancyForm.streetName)) {
      setVacancyHouseSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationHouses(vacancyForm.cityId as number, trim(vacancyForm.streetName), trim(vacancyForm.houseNumber), 10, controller.signal)
        .then(setVacancyHouseSuggestions)
        .catch(() => setVacancyHouseSuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [vacancyForm.cityId, vacancyForm.houseNumber, vacancyForm.streetName])

  useEffect(() => {
    if (!eventForm.cityId || !trim(eventForm.streetName)) {
      setEventHouseSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchEmployerLocationHouses(eventForm.cityId as number, trim(eventForm.streetName), trim(eventForm.houseNumber), 10, controller.signal)
        .then(setEventHouseSuggestions)
        .catch(() => setEventHouseSuggestions([]))
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [eventForm.cityId, eventForm.houseNumber, eventForm.streetName])

  function pickCity(city: EmployerAddressCitySuggestion, target: FlowType) {
    const cityRef = cities.find((item) => item.id === city.cityId)
    const mapPoint = cityRef?.latitude != null && cityRef.longitude != null ? { latitude: cityRef.latitude, longitude: cityRef.longitude } : null
    if (target === 'vacancy') {
      setVacancyForm((state) => ({ ...state, cityId: city.cityId, cityQuery: city.cityName, streetName: '', houseNumber: '', mapPoint }))
      setVacancyCitySuggestions([])
    } else {
      setEventForm((state) => ({ ...state, cityId: city.cityId, cityQuery: city.cityName, streetName: '', houseNumber: '', mapPoint }))
      setEventCitySuggestions([])
    }
  }

  const onVacancyMapPointChange = (point: MapPoint) => setVacancyForm((state) => ({ ...state, mapPoint: point }))
  const onEventMapPointChange = (point: MapPoint) => setEventForm((state) => ({ ...state, mapPoint: point }))

  function validateStep(stepNumber: Step) {
    const form = isVacancyFlow ? vacancyForm : eventForm
    if (stepNumber >= 2 && !trim(form.title)) return isVacancyFlow ? 'Укажите название вакансии.' : 'Укажите название мероприятия.'
    if (stepNumber >= 2 && !form.cityId && !form.mapPoint) return 'Укажите город или точку на карте.'
    if (stepNumber >= 3 && !trim(form.shortDescription)) return 'Укажите краткое описание.'
    if (stepNumber >= 3 && !trim(form.fullDescription)) return 'Укажите полное описание.'

    if (isVacancyFlow && stepNumber >= 4) {
      const deadline = trim(vacancyForm.applicationDeadline) ? toIso(vacancyForm.applicationDeadline) : null
      if (trim(vacancyForm.applicationDeadline) && !deadline) return 'Укажите корректный дедлайн.'
      const from = toNumberOrNull(vacancyForm.salaryFrom)
      const to = toNumberOrNull(vacancyForm.salaryTo)
      if (from !== null && to !== null && to < from) return 'Зарплата до должна быть больше или равна зарплате от.'
    }

    if (!isVacancyFlow && stepNumber >= 4) {
      const eventDate = trim(eventForm.eventDate) ? toIso(eventForm.eventDate) : null
      if (trim(eventForm.eventDate) && !eventDate) return 'Укажите корректную дату мероприятия.'
      const amount = toNumberOrNull(eventForm.priceAmount)
      if ((eventForm.priceType === 2 || eventForm.priceType === 3) && amount === null) return 'Укажите сумму для платного/призового события.'
    }

    return null
  }

  const onContinue = () => {
    const message = validateStep(currentStep)
    setError(message ?? '')
    setSuccess('')
    if (!message) nextStep()
  }

  async function onPublish() {
    const message = validateStep(4)
    setError(message ?? '')
    setSuccess('')
    if (message) return

    setIsSubmitting(true)
    try {
      const publishAt = new Date().toISOString()
      if (isVacancyFlow) {
        const manual = vacancyForm.cityId != null
        await createEmployerVacancy({
          title: vacancyForm.title,
          shortDescription: vacancyForm.shortDescription,
          fullDescription: vacancyForm.fullDescription,
          kind: vacancyForm.kind,
          format: vacancyForm.format,
          status: vacancyForm.status,
          cityId: manual ? vacancyForm.cityId : null,
          locationId: null,
          streetName: manual ? trim(vacancyForm.streetName) || null : null,
          houseNumber: manual ? trim(vacancyForm.houseNumber) || null : null,
          mapPoint: manual ? null : vacancyForm.mapPoint,
          salaryFrom: toNumberOrNull(vacancyForm.salaryFrom),
          salaryTo: toNumberOrNull(vacancyForm.salaryTo),
          currencyCode: normalizeCurrencyCode(vacancyForm.currencyCode),
          salaryTaxMode: vacancyForm.salaryTaxMode,
          publishAt,
          applicationDeadline: trim(vacancyForm.applicationDeadline) ? toIso(vacancyForm.applicationDeadline) : null,
          tagIds: vacancyForm.tagIds,
        })
        setSuccess('Вакансия сохранена.')
      } else {
        const manual = eventForm.cityId != null
        const amount = toNumberOrNull(eventForm.priceAmount)
        await createEmployerOpportunity({
          title: eventForm.title,
          shortDescription: eventForm.shortDescription,
          fullDescription: eventForm.fullDescription,
          kind: eventForm.kind,
          format: eventForm.format,
          status: eventForm.status,
          cityId: manual ? eventForm.cityId : null,
          locationId: null,
          streetName: manual ? trim(eventForm.streetName) || null : null,
          houseNumber: manual ? trim(eventForm.houseNumber) || null : null,
          mapPoint: manual ? null : eventForm.mapPoint,
          priceType: eventForm.priceType,
          priceAmount: eventForm.priceType === 1 ? null : amount,
          priceCurrencyCode: eventForm.priceType === 1 ? null : normalizeCurrencyCode(eventForm.priceCurrencyCode),
          participantsCanWrite: eventForm.participantsCanWrite,
          publishAt,
          eventDate: trim(eventForm.eventDate) ? toIso(eventForm.eventDate) : null,
          tagIds: eventForm.tagIds,
        })
        setSuccess('Мероприятие сохранено.')
      }
      goStep(5)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Не удалось опубликовать запись.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const citySuggestions = isVacancyFlow ? vacancyCitySuggestions : eventCitySuggestions
  const streetSuggestions = isVacancyFlow ? vacancyStreetSuggestions : eventStreetSuggestions
  const houseSuggestions = isVacancyFlow ? vacancyHouseSuggestions : eventHouseSuggestions
  const addressText = buildAddressText(activeAddress.cityQuery, activeAddress.streetName, activeAddress.houseNumber)

  return (
    <div className="app-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <section className="container seeker-profile-page">
          <section className="vf-page vf-section">
            <div className="vf-top-actions">
              <button type="button" className="vf-back-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard/employer'))}>
                <ArrowLeft size={16} />
                Вернуться назад
              </button>
            </div>
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
                      <img src="/person-sits-on-flower.svg" alt="Vacancy" />
                      <h2>Я хочу создать вакансию/стажировку</h2>
                      <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'vacancy')}>Создать</button>
                    </article>
                    <article className="vf-choice-card">
                      <img src="/person-stands-near-flower.svg" alt="Event" />
                      <h2>Я хочу создать мероприятие</h2>
                      <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'event')}>Создать</button>
                    </article>
                  </div>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
                  <h2 className="vf-title">Основная информация</h2>
                  <div className="vf-form-grid">
                    <label className="vf-field vf-field--full"><span>Название</span><input type="text" name="title" value={isVacancyFlow ? vacancyForm.title : eventForm.title} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} /></label>
                    <label className="vf-field"><span>Вид</span>{isVacancyFlow ? <select name="kind" value={vacancyForm.kind} onChange={onVacancyFormChange}><option value={2}>Работа</option><option value={1}>Стажировка</option></select> : <select name="kind" value={eventForm.kind} onChange={onEventFormChange}><option value={1}>Хакатон</option><option value={2}>День открытых дверей</option><option value={3}>Лекция</option><option value={4}>Другое</option></select>}</label>
                    <label className="vf-field"><span>Формат</span>{isVacancyFlow ? <select name="format" value={vacancyForm.format} onChange={onVacancyFormChange}><option value={1}>Офис</option><option value={2}>Гибрид</option><option value={3}>Удаленно</option></select> : <select name="format" value={eventForm.format} onChange={onEventFormChange}><option value={1}>Офис</option><option value={2}>Гибрид</option><option value={3}>Удаленно</option></select>}</label>

                    <label className="vf-field vf-field--full"><span>Город</span><input type="text" name="cityQuery" value={activeAddress.cityQuery} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} placeholder="Начните вводить город" /></label>
                    {citySuggestions.length > 0 ? <div className="vf-suggestions vf-field--full">{citySuggestions.map((city) => <button key={city.cityId} type="button" className="vf-suggestion" onClick={() => pickCity(city, isVacancyFlow ? 'vacancy' : 'event')}>{citySuggestionLabel(city)}</button>)}</div> : null}

                    <label className="vf-field"><span>Улица</span><input type="text" name="streetName" value={activeAddress.streetName} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} disabled={!activeAddress.cityId} /></label>
                    <label className="vf-field"><span>Дом</span><input type="text" name="houseNumber" value={activeAddress.houseNumber} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} disabled={!activeAddress.cityId || !trim(activeAddress.streetName)} /></label>
                    {streetSuggestions.length > 0 ? <div className="vf-suggestions vf-field--full">{streetSuggestions.map((item) => <button key={item.streetName} type="button" className="vf-suggestion" onClick={() => isVacancyFlow ? setVacancyForm((s) => ({ ...s, streetName: item.streetName, houseNumber: '' })) : setEventForm((s) => ({ ...s, streetName: item.streetName, houseNumber: '' }))}>{item.streetName}</button>)}</div> : null}
                    {houseSuggestions.length > 0 ? <div className="vf-suggestions vf-field--full">{houseSuggestions.map((item) => <button key={item.houseNumber} type="button" className="vf-suggestion" onClick={() => isVacancyFlow ? setVacancyForm((s) => ({ ...s, houseNumber: item.houseNumber })) : setEventForm((s) => ({ ...s, houseNumber: item.houseNumber }))}>{item.houseNumber}</button>)}</div> : null}

                    <div className="vf-field vf-field--full">
                      <span>Карта (preview / optional)</span>
                      <MapPointPicker className="vf-map-picker" value={activeAddress.mapPoint} onChange={isVacancyFlow ? onVacancyMapPointChange : onEventMapPointChange} defaultCenter={mapCenter} defaultZoom={11} />
                      <p className="vf-map-hint">Ручной адрес работает без обязательного клика по карте.</p>
                      <p className="vf-map-address">{addressText}</p>
                    </div>

                    <label className="vf-field vf-field--full"><span>Теги</span><TagPicker className="vf-tag-picker" options={tags.map((tag) => ({ id: tag.id, label: tag.name }))} selectedIds={isVacancyFlow ? vacancyForm.tagIds : eventForm.tagIds} onChange={isVacancyFlow ? (v) => setVacancyForm((s) => ({ ...s, tagIds: v })) : (v) => setEventForm((s) => ({ ...s, tagIds: v }))} placeholder="Выберите теги" searchPlaceholder="Поиск по тегам..." emptyMessage="Теги не найдены" /></label>
                  </div>
                  <div className="vf-actions"><button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>Назад</button><button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>Дальше</button></div>
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
                  <h2 className="vf-title">Описание</h2>
                  <div className="vf-editor-grid">
                    <label className="vf-editor"><span>Краткое описание</span><textarea name="shortDescription" rows={7} value={activeAddress.shortDescription} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} /></label>
                    <label className="vf-editor"><span>Полное описание</span><textarea name="fullDescription" rows={7} value={activeAddress.fullDescription} onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange} /></label>
                  </div>
                  <div className="vf-actions"><button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>Назад</button><button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>Дальше</button></div>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <h2 className="vf-title">Стоимость и опции</h2>
                  {isVacancyFlow ? (
                    <div className="vf-form-grid vf-form-grid--salary">
                      <label className="vf-field"><span>Зарплата от</span><input type="number" name="salaryFrom" value={vacancyForm.salaryFrom} onChange={onVacancyFormChange} /></label>
                      <label className="vf-field"><span>Зарплата до</span><input type="number" name="salaryTo" value={vacancyForm.salaryTo} onChange={onVacancyFormChange} /></label>
                      <label className="vf-field"><span>Валюта</span><input type="text" name="currencyCode" value={vacancyForm.currencyCode} onChange={onVacancyFormChange} maxLength={3} /></label>
                      <label className="vf-field"><span>Налоговый режим</span><select name="salaryTaxMode" value={vacancyForm.salaryTaxMode} onChange={onVacancyFormChange}><option value={1}>До вычета налогов</option><option value={2}>После вычета налогов</option><option value={3}>Не указано</option></select></label>
                      <label className="vf-field"><span>Дедлайн откликов</span><DateInput type="datetime-local" name="applicationDeadline" value={vacancyForm.applicationDeadline} onChange={onVacancyFormChange} /></label>
                    </div>
                  ) : (
                    <div className="vf-form-grid vf-form-grid--event">
                      <label className="vf-field"><span>Тип цены</span><select name="priceType" value={eventForm.priceType} onChange={onEventFormChange}><option value={1}>Бесплатно</option><option value={2}>Платно</option><option value={3}>Приз</option></select></label>
                      <label className="vf-field"><span>Сумма</span><input type="number" name="priceAmount" value={eventForm.priceAmount} onChange={onEventFormChange} /></label>
                      <label className="vf-field"><span>Валюта</span><input type="text" name="priceCurrencyCode" value={eventForm.priceCurrencyCode} onChange={onEventFormChange} maxLength={3} /></label>
                      <label className="vf-field"><span>Дата события</span><DateInput type="datetime-local" name="eventDate" value={eventForm.eventDate} onChange={onEventFormChange} /></label>
                      <div className="vf-switch-row"><span>Участники могут писать в чат</span><button type="button" className={`vf-switch ${eventChatEnabled ? 'is-on' : ''}`} onClick={() => setEventChatEnabled((prev) => !prev)} aria-pressed={eventChatEnabled}><span className="vf-switch__thumb" /></button></div>
                    </div>
                  )}
                  <div className="vf-actions"><button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>Назад</button><button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>Дальше</button></div>
                </>
              ) : null}

              {currentStep === 5 ? (
                <section className="vf-section--publish">
                  <h2 className="vf-congrats">Готово!</h2>
                  <p className="vf-congrats__text">Локация будет сохранена по ручному адресу (город/улица/дом) без обязательного mapPoint.</p>
                  <img className="vf-congrats__image" src="/chat-side.svg" alt="Success" />
                  <div className="vf-actions"><button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep} disabled={isSubmitting}>Назад</button><button type="button" className="vf-btn vf-btn--primary" onClick={onPublish} disabled={isSubmitting}>{isSubmitting ? 'Публикуем...' : 'Опубликовать'}</button></div>
                </section>
              ) : null}
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  )
}
