import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchCities, fetchLocations, fetchTags } from '../api/catalog'
import { createEmployerOpportunity, createEmployerVacancy } from '../api/employer'
import type { City, Location, TagListItem } from '../types/catalog'
import './VacancyFlowPage.css'

type Step = 1 | 2 | 3 | 4 | 5
type FlowType = 'vacancy' | 'event'

type VacancyForm = {
  title: string
  kind: number
  format: number
  cityId: string
  locationId: string
  tagIds: number[]
  shortDescription: string
  fullDescription: string
  salaryFrom: string
  salaryTo: string
  currencyCode: string
  salaryTaxMode: number
  publishAt: string
  applicationDeadline: string
}

type EventForm = {
  title: string
  kind: number
  format: number
  cityId: string
  locationId: string
  tagIds: number[]
  shortDescription: string
  fullDescription: string
  priceType: number
  priceAmount: string
  priceCurrencyCode: string
  participantsCanWrite: boolean
  publishAt: string
  eventDate: string
}

const steps = ['Р’С‹Р±РѕСЂ', 'РћСЃРЅРѕРІРЅС‹Рµ', 'РћРїРёСЃР°РЅРёРµ', 'РЎС‚РѕРёРјРѕСЃС‚СЊ Рё РѕРїС†РёРё', 'РџСѓР±Р»РёРєР°С†РёСЏ']
const validSteps = new Set(['1', '2', '3', '4', '5'])

function toLocalDateTimeInputValue(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

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

function parseSelectedNumberOptions(options: HTMLOptionsCollection) {
  return Array.from(options)
    .filter((option) => option.selected)
    .map((option) => Number(option.value))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function locationOptionLabel(location: Location) {
  const addressParts = [location.streetName, location.houseNumber].filter(Boolean)
  const address = addressParts.length ? addressParts.join(', ') : 'РђРґСЂРµСЃ РЅРµ СѓРєР°Р·Р°РЅ'
  return `${location.cityName}: ${address}`
}

type StepperProps = {
  activeStep: Step
}

function Stepper({ activeStep }: StepperProps) {
  return (
    <div className="vf-stepper" aria-label="РџСЂРѕРіСЂРµСЃСЃ СЃРѕР·РґР°РЅРёСЏ">
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
  const [vacancyLocations, setVacancyLocations] = useState<Location[]>([])
  const [eventLocations, setEventLocations] = useState<Location[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [eventChatEnabled, setEventChatEnabled] = useState(true)

  const [vacancyForm, setVacancyForm] = useState<VacancyForm>({
    title: '',
    kind: 2,
    format: 2,
    cityId: '',
    locationId: '',
    tagIds: [],
    shortDescription: '',
    fullDescription: '',
    salaryFrom: '',
    salaryTo: '',
    currencyCode: 'RUB',
    salaryTaxMode: 3,
    publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
    applicationDeadline: '',
  })

  const [eventForm, setEventForm] = useState<EventForm>({
    title: '',
    kind: 4,
    format: 2,
    cityId: '',
    locationId: '',
    tagIds: [],
    shortDescription: '',
    fullDescription: '',
    priceType: 1,
    priceAmount: '',
    priceCurrencyCode: 'RUB',
    participantsCanWrite: true,
    publishAt: toLocalDateTimeInputValue(new Date().toISOString()),
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
    const cityId = Number(vacancyForm.cityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setVacancyLocations([])
      return
    }

    let active = true
    void fetchLocations(cityId)
      .then((items) => {
        if (active) {
          setVacancyLocations(items)
        }
      })
      .catch(() => {
        if (active) {
          setVacancyLocations([])
        }
      })

    return () => {
      active = false
    }
  }, [vacancyForm.cityId])

  useEffect(() => {
    const cityId = Number(eventForm.cityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setEventLocations([])
      return
    }

    let active = true
    void fetchLocations(cityId)
      .then((items) => {
        if (active) {
          setEventLocations(items)
        }
      })
      .catch(() => {
        if (active) {
          setEventLocations([])
        }
      })

    return () => {
      active = false
    }
  }, [eventForm.cityId])

  useEffect(() => {
    setEventForm((state) => ({
      ...state,
      participantsCanWrite: eventChatEnabled,
    }))
  }, [eventChatEnabled])

  useEffect(() => {
    if (!success || currentStep !== 5 || !isVacancyFlow) {
      return
    }

    const timer = window.setTimeout(() => {
      navigate('/')
    }, 3000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [currentStep, isVacancyFlow, navigate, success])

  const locationOptions = useMemo(() => {
    return isVacancyFlow ? vacancyLocations : eventLocations
  }, [eventLocations, isVacancyFlow, vacancyLocations])

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
      ...(name === 'cityId' ? { locationId: '' } : {}),
    }))
  }

  function onEventFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setEventForm((state) => ({
      ...state,
      [name]: name === 'kind' || name === 'format' || name === 'priceType' ? Number(value) || 0 : type === 'checkbox' ? checked : value,
      ...(name === 'cityId' ? { locationId: '' } : {}),
    }))
  }

  function onVacancyTagsChange(event: ChangeEvent<HTMLSelectElement>) {
    setVacancyForm((state) => ({
      ...state,
      tagIds: parseSelectedNumberOptions(event.target.options),
    }))
  }

  function onEventTagsChange(event: ChangeEvent<HTMLSelectElement>) {
    setEventForm((state) => ({
      ...state,
      tagIds: parseSelectedNumberOptions(event.target.options),
    }))
  }

  function validateStep(stepNumber: Step) {
    if (stepNumber === 1) {
      return null
    }

    if (isVacancyFlow) {
      if (stepNumber >= 2) {
        if (!vacancyForm.title.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ РІР°РєР°РЅСЃРёРё.'
        }
      }

      if (stepNumber >= 3) {
        if (!vacancyForm.shortDescription.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РІР°РєР°РЅСЃРёРё.'
        }
        if (!vacancyForm.fullDescription.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РїРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ РІР°РєР°РЅСЃРёРё.'
        }
      }

      if (stepNumber >= 4) {
        const publishAt = toIsoDateTimeFromLocalInput(vacancyForm.publishAt)
        if (!publishAt) {
          return 'РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ РґР°С‚Сѓ РїСѓР±Р»РёРєР°С†РёРё РІР°РєР°РЅСЃРёРё.'
        }

        const applicationDeadline = vacancyForm.applicationDeadline.trim()
          ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline)
          : null

        if (vacancyForm.applicationDeadline.trim() && !applicationDeadline) {
          return 'РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РґРµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ.'
        }

        if (applicationDeadline && Date.parse(applicationDeadline) < Date.parse(publishAt)) {
          return 'Р”РµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ СЂР°РЅСЊС€Рµ РґР°С‚С‹ РїСѓР±Р»РёРєР°С†РёРё.'
        }

        const salaryFrom = toNumberOrNull(vacancyForm.salaryFrom)
        const salaryTo = toNumberOrNull(vacancyForm.salaryTo)
        if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
          return 'Р—Р°СЂРїР»Р°С‚Р° "РґРѕ" РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ РёР»Рё СЂР°РІРЅР° Р·Р°СЂРїР»Р°С‚Рµ "РѕС‚".'
        }
      }
    } else {
      if (stepNumber >= 2) {
        if (!eventForm.title.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.'
        }
      }

      if (stepNumber >= 3) {
        if (!eventForm.shortDescription.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.'
        }
        if (!eventForm.fullDescription.trim()) {
          return 'РЈРєР°Р¶РёС‚Рµ РїРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.'
        }
      }

      if (stepNumber >= 4) {
        const publishAt = toIsoDateTimeFromLocalInput(eventForm.publishAt)
        if (!publishAt) {
          return 'РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ РґР°С‚Сѓ РїСѓР±Р»РёРєР°С†РёРё РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.'
        }

        const eventDate = eventForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(eventForm.eventDate) : null
        if (eventForm.eventDate.trim() && !eventDate) {
          return 'РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ РґР°С‚Сѓ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.'
        }

        const priceAmount = toNumberOrNull(eventForm.priceAmount)
        if ((eventForm.priceType === 2 || eventForm.priceType === 3) && priceAmount === null) {
          return 'Р”Р»СЏ РїР»Р°С‚РЅРѕРіРѕ РёР»Рё РїСЂРёР·РѕРІРѕРіРѕ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ СѓРєР°Р¶РёС‚Рµ СЃСѓРјРјСѓ.'
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
      if (isVacancyFlow) {
        const payload = {
          title: vacancyForm.title,
          shortDescription: vacancyForm.shortDescription,
          fullDescription: vacancyForm.fullDescription,
          kind: vacancyForm.kind,
          format: vacancyForm.format,
          status: 2,
          cityId: vacancyForm.cityId.trim() ? Number(vacancyForm.cityId) : null,
          locationId: vacancyForm.locationId.trim() ? Number(vacancyForm.locationId) : null,
          salaryFrom: toNumberOrNull(vacancyForm.salaryFrom),
          salaryTo: toNumberOrNull(vacancyForm.salaryTo),
          currencyCode: normalizeCurrencyCode(vacancyForm.currencyCode),
          salaryTaxMode: vacancyForm.salaryTaxMode,
          publishAt: toIsoDateTimeFromLocalInput(vacancyForm.publishAt),
          applicationDeadline: vacancyForm.applicationDeadline.trim() ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline) : null,
          tagIds: vacancyForm.tagIds,
        }

        await createEmployerVacancy(payload)
        setSuccess('Р’Р°РєР°РЅСЃРёСЏ РѕС‚РїСЂР°РІР»РµРЅР° РЅР° РјРѕРґРµСЂР°С†РёСЋ.')
      } else {
        const priceAmount = toNumberOrNull(eventForm.priceAmount)
        const payload = {
          title: eventForm.title,
          shortDescription: eventForm.shortDescription,
          fullDescription: eventForm.fullDescription,
          kind: eventForm.kind,
          format: eventForm.format,
          status: 2,
          cityId: eventForm.cityId.trim() ? Number(eventForm.cityId) : null,
          locationId: eventForm.locationId.trim() ? Number(eventForm.locationId) : null,
          priceType: eventForm.priceType,
          priceAmount: eventForm.priceType === 1 ? null : priceAmount,
          priceCurrencyCode: eventForm.priceType === 1 ? null : normalizeCurrencyCode(eventForm.priceCurrencyCode),
          participantsCanWrite: eventForm.participantsCanWrite,
          publishAt: toIsoDateTimeFromLocalInput(eventForm.publishAt),
          eventDate: eventForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(eventForm.eventDate) : null,
          tagIds: eventForm.tagIds,
        }

        await createEmployerOpportunity(payload)
        setSuccess('РњРµСЂРѕРїСЂРёСЏС‚РёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ РЅР° РјРѕРґРµСЂР°С†РёСЋ.')
      }

      goStep(5)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСѓР±Р»РёРєРѕРІР°С‚СЊ Р·Р°РїРёСЃСЊ.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="vf-page">
      <main className="vf-content">
        <section className="vf-section">
          <Stepper activeStep={currentStep} />

          {loadingCatalogs ? <p className="vf-note">Р—Р°РіСЂСѓР¶Р°РµРј СЃРїСЂР°РІРѕС‡РЅРёРєРё РїР»Р°С‚С„РѕСЂРјС‹...</p> : null}
          {error ? <p className="vf-message vf-message--error">{error}</p> : null}
          {success ? <p className="vf-message vf-message--success">{success}</p> : null}

          <div key={`${currentStep}-${flowType}`} className="vf-stage">
            {currentStep === 1 ? (
              <>
                <h1 className="vf-title">Р’С‹Р±РµСЂРёС‚Рµ, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СЃРѕР·РґР°С‚СЊ</h1>
                <div className="vf-choice-grid">
                  <article className="vf-choice-card">
                    <img src="/С‡РµР» СЃРёРґРёС‚ РЅР° С†РІРµС‚РєРµ.svg" alt="РР»Р»СЋСЃС‚СЂР°С†РёСЏ СЃРѕР·РґР°РЅРёСЏ РІР°РєР°РЅСЃРёРё" />
                    <h2>РЇ С…РѕС‡Сѓ СЃРѕР·РґР°С‚СЊ РІР°РєР°РЅСЃРёСЋ/СЃС‚Р°Р¶РёСЂРѕРІРєСѓ</h2>
                    <p>Разместите предложение о работе или стажировке, чтобы найти кандидатов в свою команду.</p>
                    <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'vacancy')}>
                      РЎРѕР·РґР°С‚СЊ
                    </button>
                  </article>

                  <article className="vf-choice-card">
                    <img src="/С‡РµР» СЃС‚РѕРёС‚ СЂСЏРґРѕРј С†РІРµС‚РѕРє.svg" alt="РР»Р»СЋСЃС‚СЂР°С†РёСЏ СЃРѕР·РґР°РЅРёСЏ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ" />
                    <h2>РЇ С…РѕС‡Сѓ СЃРѕР·РґР°С‚СЊ РјРµСЂРѕРїСЂРёСЏС‚РёРµ</h2>
                    <p>РЎРѕР·РґР°Р№С‚Рµ СЃС‚СЂР°РЅРёС†Сѓ СЃРѕР±С‹С‚РёСЏ Рё РїСЂРёРіР»Р°С€Р°Р№С‚Рµ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РЅР° РІСЃС‚СЂРµС‡Рё, РІРµР±РёРЅР°СЂС‹ Рё РјР°СЃС‚РµСЂ-РєР»Р°СЃСЃС‹.</p>
                    <button type="button" className="vf-btn vf-btn--primary" onClick={() => goStep(2, 'event')}>
                      РЎРѕР·РґР°С‚СЊ
                    </button>
                  </article>
                </div>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <h2 className="vf-title">РћСЃРЅРѕРІРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ</h2>

                <div className="vf-form-grid">
                  <label className="vf-field vf-field--full">
                    <span>РќР°Р·РІР°РЅРёРµ</span>
                    <input
                      type="text"
                      name="title"
                      value={isVacancyFlow ? vacancyForm.title : eventForm.title}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'РќР°РїСЂРёРјРµСЂ, Frontend-СЂР°Р·СЂР°Р±РѕС‚С‡РёРє' : 'РќР°РїСЂРёРјРµСЂ, РҐР°РєР°С‚РѕРЅ РўСЂР°РјРїР»РёРЅ'}
                    />
                  </label>

                  <label className="vf-field">
                    <span>Р’РёРґ</span>
                    {isVacancyFlow ? (
                      <select name="kind" value={vacancyForm.kind} onChange={onVacancyFormChange}>
                        <option value={2}>Работа</option>
                        <option value={1}>РЎС‚Р°Р¶РёСЂРѕРІРєР°</option>
                      </select>
                    ) : (
                      <select name="kind" value={eventForm.kind} onChange={onEventFormChange}>
                        <option value={1}>РҐР°РєР°С‚РѕРЅ</option>
                        <option value={2}>Р”РµРЅСЊ РѕС‚РєСЂС‹С‚С‹С… РґРІРµСЂРµР№</option>
                        <option value={3}>Р›РµРєС†РёСЏ</option>
                        <option value={4}>Р”СЂСѓРіРѕРµ</option>
                      </select>
                    )}
                  </label>

                  <label className="vf-field">
                    <span>Р¤РѕСЂРјР°С‚</span>
                    {isVacancyFlow ? (
                      <select name="format" value={vacancyForm.format} onChange={onVacancyFormChange}>
                        <option value={1}>РћС„РёСЃ</option>
                        <option value={2}>Р“РёР±СЂРёРґ</option>
                        <option value={3}>РЈРґР°Р»РµРЅРЅРѕ</option>
                      </select>
                    ) : (
                      <select name="format" value={eventForm.format} onChange={onEventFormChange}>
                        <option value={1}>РћС„РёСЃ</option>
                        <option value={2}>Р“РёР±СЂРёРґ</option>
                        <option value={3}>РЈРґР°Р»РµРЅРЅРѕ</option>
                      </select>
                    )}
                  </label>

                  <label className="vf-field">
                    <span>Р“РѕСЂРѕРґ</span>
                    <select
                      name="cityId"
                      value={isVacancyFlow ? vacancyForm.cityId : eventForm.cityId}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                    >
                      <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="vf-field">
                    <span>Р›РѕРєР°С†РёСЏ</span>
                    <select
                      name="locationId"
                      value={isVacancyFlow ? vacancyForm.locationId : eventForm.locationId}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      disabled={!(isVacancyFlow ? vacancyForm.cityId : eventForm.cityId)}
                    >
                      <option value="">РќРµ РІС‹Р±СЂР°РЅР°</option>
                      {locationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {locationOptionLabel(location)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="vf-field vf-field--full">
                    <span>РўРµРіРё</span>
                    <select
                      multiple
                      value={(isVacancyFlow ? vacancyForm.tagIds : eventForm.tagIds).map(String)}
                      onChange={isVacancyFlow ? onVacancyTagsChange : onEventTagsChange}
                      className="vf-select-multiple"
                    >
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="vf-note vf-note--moderation">After submit, the card is sent to moderation automatically.</p>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    РќР°Р·Р°Рґ
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Р”Р°Р»СЊС€Рµ
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <h2 className="vf-title">РћРїРёСЃР°РЅРёРµ</h2>
                <div className="vf-editor-grid">
                  <label className="vf-editor">
                    <span>РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ</span>
                    <textarea
                      name="shortDescription"
                      rows={7}
                      value={isVacancyFlow ? vacancyForm.shortDescription : eventForm.shortDescription}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'РљСЂР°С‚РєРѕ РѕРїРёС€РёС‚Рµ РІР°РєР°РЅСЃРёСЋ' : 'РљСЂР°С‚РєРѕ РѕРїРёС€РёС‚Рµ РјРµСЂРѕРїСЂРёСЏС‚РёРµ'}
                    />
                  </label>
                  <label className="vf-editor">
                    <span>РџРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ</span>
                    <textarea
                      name="fullDescription"
                      rows={7}
                      value={isVacancyFlow ? vacancyForm.fullDescription : eventForm.fullDescription}
                      onChange={isVacancyFlow ? onVacancyFormChange : onEventFormChange}
                      placeholder={isVacancyFlow ? 'РџРѕРґСЂРѕР±РЅРѕ РѕРїРёС€РёС‚Рµ РІР°РєР°РЅСЃРёСЋ' : 'РџРѕРґСЂРѕР±РЅРѕ РѕРїРёС€РёС‚Рµ РїСЂРѕРіСЂР°РјРјСѓ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ'}
                    />
                  </label>
                </div>

                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep}>
                    РќР°Р·Р°Рґ
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Р”Р°Р»СЊС€Рµ
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <h2 className="vf-title">РЎС‚РѕРёРјРѕСЃС‚СЊ Рё РѕРїС†РёРё</h2>

                {isVacancyFlow ? (
                  <div className="vf-form-grid vf-form-grid--salary">
                    <label className="vf-field">
                      <span>Р—Р°СЂРїР»Р°С‚Р° РѕС‚</span>
                      <input type="number" name="salaryFrom" value={vacancyForm.salaryFrom} onChange={onVacancyFormChange} placeholder="РќР°РїСЂРёРјРµСЂ, 20000" />
                    </label>
                    <label className="vf-field">
                      <span>Р—Р°СЂРїР»Р°С‚Р° РґРѕ</span>
                      <input type="number" name="salaryTo" value={vacancyForm.salaryTo} onChange={onVacancyFormChange} placeholder="РќР°РїСЂРёРјРµСЂ, 50000" />
                    </label>
                    <label className="vf-field">
                      <span>Р’Р°Р»СЋС‚Р°</span>
                      <input type="text" name="currencyCode" value={vacancyForm.currencyCode} onChange={onVacancyFormChange} maxLength={3} />
                    </label>
                    <label className="vf-field">
                      <span>РќР°Р»РѕРіРѕРІС‹Р№ СЂРµР¶РёРј</span>
                      <select name="salaryTaxMode" value={vacancyForm.salaryTaxMode} onChange={onVacancyFormChange}>
                        <option value={1}>Р”Рѕ РІС‹С‡РµС‚Р° РЅР°Р»РѕРіРѕРІ</option>
                        <option value={2}>РџРѕСЃР»Рµ РІС‹С‡РµС‚Р° РЅР°Р»РѕРіРѕРІ</option>
                        <option value={3}>РќРµ СѓРєР°Р·Р°РЅРѕ</option>
                      </select>
                    </label>
                    <label className="vf-field">
                      <span>Р”Р°С‚Р° РїСѓР±Р»РёРєР°С†РёРё</span>
                      <input type="datetime-local" name="publishAt" value={vacancyForm.publishAt} onChange={onVacancyFormChange} />
                    </label>
                    <label className="vf-field">
                      <span>Р”РµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ</span>
                      <input type="datetime-local" name="applicationDeadline" value={vacancyForm.applicationDeadline} onChange={onVacancyFormChange} />
                    </label>
                  </div>
                ) : (
                  <div className="vf-form-grid vf-form-grid--event">
                    <label className="vf-field">
                      <span>РўРёРї С†РµРЅС‹</span>
                      <select name="priceType" value={eventForm.priceType} onChange={onEventFormChange}>
                        <option value={1}>Р‘РµСЃРїР»Р°С‚РЅРѕ</option>
                        <option value={2}>РџР»Р°С‚РЅРѕ</option>
                        <option value={3}>РџСЂРёР·</option>
                      </select>
                    </label>
                    <label className="vf-field">
                      <span>РЎСѓРјРјР°</span>
                      <input type="number" name="priceAmount" value={eventForm.priceAmount} onChange={onEventFormChange} placeholder="РќР°РїСЂРёРјРµСЂ, 2000" />
                    </label>
                    <label className="vf-field">
                      <span>Р’Р°Р»СЋС‚Р°</span>
                      <input type="text" name="priceCurrencyCode" value={eventForm.priceCurrencyCode} onChange={onEventFormChange} maxLength={3} />
                    </label>
                    <label className="vf-field">
                      <span>Р”Р°С‚Р° РїСѓР±Р»РёРєР°С†РёРё</span>
                      <input type="datetime-local" name="publishAt" value={eventForm.publishAt} onChange={onEventFormChange} />
                    </label>
                    <label className="vf-field">
                      <span>Р”Р°С‚Р° СЃРѕР±С‹С‚РёСЏ</span>
                      <input type="datetime-local" name="eventDate" value={eventForm.eventDate} onChange={onEventFormChange} />
                    </label>

                    <div className="vf-switch-row">
                      <span>РЈС‡Р°СЃС‚РЅРёРєРё РіСЂСѓРїРїС‹ РјРѕРіСѓС‚ РїРёСЃР°С‚СЊ РІ С‡Р°С‚</span>
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
                    РќР°Р·Р°Рґ
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={onContinue}>
                    Р”Р°Р»СЊС€Рµ
                  </button>
                </div>
              </>
            ) : null}

            {currentStep === 5 ? (
              <div className="vf-section--publish">
                <h2 className="vf-congrats">РџСЂРѕРІРµСЂРєР° РїРµСЂРµРґ РѕС‚РїСЂР°РІРєРѕР№</h2>
                <p className="vf-congrats__text">
                  {isVacancyFlow
                    ? 'РџСЂРѕРІРµСЂСЊС‚Рµ Р·Р°РїРѕР»РЅРµРЅРёРµ РІР°РєР°РЅСЃРёРё Рё РѕС‚РїСЂР°РІСЊС‚Рµ РµРµ РЅР° РјРѕРґРµСЂР°С†РёСЋ.'
                    : 'РџСЂРѕРІРµСЂСЊС‚Рµ Р·Р°РїРѕР»РЅРµРЅРёРµ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ Рё РѕС‚РїСЂР°РІСЊС‚Рµ РµРіРѕ РЅР° РјРѕРґРµСЂР°С†РёСЋ.'}
                </p>
                {isVacancyFlow && success ? <p className="vf-note">Р§РµСЂРµР· РЅРµСЃРєРѕР»СЊРєРѕ СЃРµРєСѓРЅРґ РІС‹ РІРµСЂРЅРµС‚РµСЃСЊ РЅР° РіР»Р°РІРЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ.</p> : null}
                <img className="vf-congrats__image" src="/РіРѕСЂРґС‹Р№ С‡РµР» СЃС‚РѕРёС‚.svg" alt="РР»Р»СЋСЃС‚СЂР°С†РёСЏ РїСѓР±Р»РёРєР°С†РёРё" />
                <div className="vf-actions">
                  <button type="button" className="vf-btn vf-btn--secondary" onClick={prevStep} disabled={isSubmitting}>
                    РќР°Р·Р°Рґ
                  </button>
                  <button type="button" className="vf-btn vf-btn--primary" onClick={() => void onPublish()} disabled={isSubmitting}>
                    {isSubmitting ? 'РћС‚РїСЂР°РІР»СЏРµРј...' : 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ'}
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

