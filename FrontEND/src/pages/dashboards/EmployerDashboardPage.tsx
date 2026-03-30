import { Building2, Clock3, Globe, Mail, MapPin, MessageSquare, Phone, ShieldCheck, UploadCloud } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCities, fetchLocations, fetchTags } from '../../api/catalog'
import { fetchEmployerChats } from '../../api/chats'
import {
  createEmployerCompanyLink,
  createEmployerCompany,
  createEmployerOpportunity,
  createEmployerVacancy,
  deleteEmployerCompanyLink,
  deleteEmployerOpportunity,
  deleteEmployerVacancy,
  fetchEmployerApplicationDetail,
  fetchEmployerApplications,
  fetchEmployerCompany,
  fetchEmployerVerificationDocuments,
  fetchEmployerVerificationIndustries,
  fetchEmployerVerificationProfile,
  fetchEmployerVerificationRequirements,
  fetchEmployerCompanyLinks,
  fetchEmployerCompanyOpportunities,
  fetchEmployerOpportunityDetail,
  fetchEmployerVacancyDetail,
  submitEmployerCompanyVerification,
  uploadEmployerVerificationDocument,
  updateEmployerCompanyLink,
  updateEmployerOpportunity,
  updateEmployerApplicationStatus,
  updateEmployerCompanyChatSettings,
  updateEmployerCompanyVerification,
  updateEmployerVacancy,
  deleteEmployerVerificationDocument,
  type EmployerApplication,
  type EmployerApplicationDetail,
  type EmployerCompany,
  type EmployerCompanyLink,
  type EmployerOpportunity,
  type EmployerVerificationDocument,
  type EmployerVerificationIndustry,
  type EmployerVerificationProfile,
  type EmployerVerificationRequirement,
} from '../../api/employer'
import { deleteCompanyGalleryMedia, uploadCompanyGalleryMedia, uploadCompanyLogo } from '../../api/media'
import { CompanyMediaGallery } from '../../components/company/CompanyMediaGallery'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { DateInput } from '../../components/forms/DateInput'
import { TagPicker } from '../../components/forms/TagPicker'
import type { City, Location, TagListItem } from '../../types/catalog'
import { formatSkillLevelDisplay } from '../../utils/skill-levels'

type EmployerTabId = 'overview' | 'company' | 'create' | 'opportunities' | 'applications' | 'verification' | 'settings'

const employerTabs: Array<{ id: EmployerTabId; label: string }> = [
  { id: 'overview', label: 'РћР±Р·РѕСЂ' },
  { id: 'company', label: 'РџСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё' },
  { id: 'opportunities', label: 'РњРѕРё РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё' },
  { id: 'applications', label: 'РћС‚РєР»РёРєРё' },
  { id: 'verification', label: 'Р’РµСЂРёС„РёРєР°С†РёСЏ' },
  { id: 'settings', label: 'РќР°СЃС‚СЂРѕР№РєРё С‡Р°С‚Р°' },
]

const companyStatusLabel: Record<string, string> = {
  draft: 'Р§РµСЂРЅРѕРІРёРє',
  pendingverification: 'РќР° РІРµСЂРёС„РёРєР°С†РёРё',
  verified: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅР°',
  rejected: 'РћС‚РєР»РѕРЅРµРЅР°',
  blocked: 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР°',
}

const companyStatusTone: Record<string, 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pendingverification: 'warning',
  rejected: 'danger',
  blocked: 'danger',
  draft: 'warning',
}

const applicationStatusLabel: Record<number, string> = {
  1: 'РќРѕРІС‹Р№',
  2: 'РќР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРё',
  3: 'РРЅС‚РµСЂРІСЊСЋ',
  4: 'РћС„С„РµСЂ',
  5: 'РќР°РЅСЏС‚',
  6: 'РћС‚РєР»РѕРЅРµРЅ',
  7: 'РћС‚РјРµРЅРµРЅ',
}

const applicationStatusTone: Record<number, 'warning' | 'success' | 'danger'> = {
  1: 'warning',
  2: 'warning',
  3: 'warning',
  4: 'success',
  5: 'success',
  6: 'danger',
  7: 'danger',
}
const applicationStatusTransitions: Record<number, number[]> = {
  1: [2, 6, 7],
  2: [3, 4, 6, 7],
  3: [4, 6, 7],
  4: [5, 6, 7],
  5: [],
  6: [],
  7: [],
}
const publishStatusGroupValues = {
  planned: [1, 2],
  active: [3],
  closed: [4, 5, 6, 7],
} as const
const applicationStatusGroupValues = {
  new: [1],
  progress: [2, 3, 4],
  closed: [5, 6, 7],
} as const

const employerOpportunityStatusLabel: Record<number, string> = {
  1: 'Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ',
  2: 'РќР° РјРѕРґРµСЂР°С†РёРё',
  3: 'РђРєС‚РёРІРЅРѕ',
  4: 'Р—Р°РєСЂС‹С‚Рѕ',
  5: 'РћС‚РјРµРЅРµРЅРѕ',
  6: 'РћС‚РєР»РѕРЅРµРЅРѕ',
  7: 'Р’ Р°СЂС…РёРІРµ',
}

const companyLinkKindOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Website' },
  { value: 2, label: 'Telegram' },
  { value: 3, label: 'VK' },
  { value: 4, label: 'Github' },
  { value: 5, label: 'LinkedIn' },
  { value: 6, label: 'HH' },
  { value: 7, label: 'Other' },
]

const companyLinkKindLabel = Object.fromEntries(companyLinkKindOptions.map((item) => [item.value, item.label])) as Record<number, string>

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('abort')
  }

  return false
}

function toTimeInputValue(value: string) {
  if (!value) {
    return ''
  }

  const normalized = value.trim()

  if (normalized.length >= 5 && normalized.includes(':')) {
    return normalized.slice(0, 5)
  }

  return ''
}

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
  return normalized ? normalized : null
}

function locationOptionLabel(location: Location) {
  const addressParts = [location.streetName, location.houseNumber].filter(Boolean)
  const address = addressParts.length ? addressParts.join(', ') : 'РђРґСЂРµСЃ РЅРµ СѓРєР°Р·Р°РЅ'
  return `${location.cityName}: ${address}`
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'РќРµРґР°РІРЅРѕ'
  }

  return date.toLocaleDateString('ru-RU')
}

function formatMoneyRange(min: number | null | undefined, max: number | null | undefined, currencyCode: string | null | undefined) {
  if (min == null && max == null) {
    return 'РџРѕ РґРѕРіРѕРІРѕСЂРµРЅРЅРѕСЃС‚Рё'
  }

  const currency = currencyCode ?? 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU')

  if (min != null && max != null) {
    return `${formatter.format(min)} - ${formatter.format(max)} ${currency}`
  }

  if (min != null) {
    return `РѕС‚ ${formatter.format(min)} ${currency}`
  }

  return `РґРѕ ${formatter.format(max ?? 0)} ${currency}`
}

function toLowerSafe(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

function opportunityTypeLabel(value: EmployerOpportunity['type']) {
  if (value === 'internship') return 'РЎС‚Р°Р¶РёСЂРѕРІРєР°'
  if (value === 'mentorship') return 'РњРµРЅС‚РѕСЂСЃС‚РІРѕ'
  if (value === 'event') return 'РњРµСЂРѕРїСЂРёСЏС‚РёРµ'
  return 'Р’Р°РєР°РЅСЃРёСЏ'
}

function genderLabel(value: number) {
  if (value === 1) return 'РњСѓР¶СЃРєРѕР№'
  if (value === 2) return 'Р–РµРЅСЃРєРёР№'
  return 'РќРµ СѓРєР°Р·Р°РЅ'
}

function formatDateOnly(value: string) {
  if (!value) {
    return 'РќРµ СѓРєР°Р·Р°РЅР°'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return value
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('ru-RU')
}

function formatSkillLevel(value: number) {
  return formatSkillLevelDisplay(value)
}

function formatYearsExperience(value: number) {
  if (!value) {
    return 'РћРїС‹С‚ РЅРµ СѓРєР°Р·Р°РЅ'
  }

  const suffix = value === 1 ? 'РіРѕРґ' : value >= 2 && value <= 4 ? 'РіРѕРґР°' : 'Р»РµС‚'
  return `${value} ${suffix}`
}

function formatLinkLabel(kind: string, label: string) {
  const normalizedLabel = label.trim()
  if (normalizedLabel) {
    return normalizedLabel
  }

  const normalizedKind = kind.trim()
  if (!normalizedKind) {
    return 'РЎСЃС‹Р»РєР°'
  }

  return normalizedKind.charAt(0).toUpperCase() + normalizedKind.slice(1)
}

function formatProjectPeriod(startDate: string, endDate: string) {
  const start = startDate ? formatDateOnly(startDate) : 'РЅРµ СѓРєР°Р·Р°РЅРѕ'
  const end = endDate ? formatDateOnly(endDate) : 'РїРѕ РЅР°СЃС‚РѕСЏС‰РµРµ РІСЂРµРјСЏ'
  return `${start} вЂ” ${end}`
}

export function EmployerDashboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<EmployerTabId>('overview')
  const [company, setCompany] = useState<EmployerCompany | null>(null)
  const [companyMissing, setCompanyMissing] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [tags, setTags] = useState<TagListItem[]>([])
  const [vacancyLocations, setVacancyLocations] = useState<Location[]>([])
  const [opportunityLocations, setOpportunityLocations] = useState<Location[]>([])
  const [opportunities, setOpportunities] = useState<EmployerOpportunity[]>([])
  const [applications, setApplications] = useState<EmployerApplication[]>([])
  const [companyLinks, setCompanyLinks] = useState<EmployerCompanyLink[]>([])
  const [applicationChats, setApplicationChats] = useState<Array<{ id: number; title: string; lastMessageText: string; lastMessageAt: string }>>([])

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingChatSettings, setSavingChatSettings] = useState(false)
  const [savingCompanyLink, setSavingCompanyLink] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingGalleryMedia, setUploadingGalleryMedia] = useState(false)
  const [deletingGalleryMediaId, setDeletingGalleryMediaId] = useState<number | null>(null)
  const [creatingVacancy, setCreatingVacancy] = useState(false)
  const [creatingOpportunity, setCreatingOpportunity] = useState(false)
  const [updatingApplicationId, setUpdatingApplicationId] = useState<number | null>(null)
  const [loadingApplicationDetailId, setLoadingApplicationDetailId] = useState<number | null>(null)
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<EmployerApplicationDetail | null>(null)
  const [editingVacancyId, setEditingVacancyId] = useState<number | null>(null)
  const [editingOpportunityId, setEditingOpportunityId] = useState<number | null>(null)
  const [loadingOpportunityEditorKey, setLoadingOpportunityEditorKey] = useState<string | null>(null)
  const [deletingOpportunityKey, setDeletingOpportunityKey] = useState<string | null>(null)
  const [deletingCompanyLinkId, setDeletingCompanyLinkId] = useState<number | null>(null)
  const [editingCompanyLinkId, setEditingCompanyLinkId] = useState<number | null>(null)
  const [opportunitySearch, setOpportunitySearch] = useState('')
  const [opportunitySourceFilter, setOpportunitySourceFilter] = useState<'all' | 'vacancy' | 'opportunity'>('all')
  const [opportunityStatusesFilter, setOpportunityStatusesFilter] = useState<number[]>([])
  const [applicationSearch, setApplicationSearch] = useState('')
  const [applicationStatusesFilter, setApplicationStatusesFilter] = useState<number[]>([])

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [createForm, setCreateForm] = useState({
    legalName: '',
    brandName: '',
    logoUrl: '',
  })
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null)

  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    kind: 2,
    format: 2,
    status: 1,
    cityId: '',
    locationId: '',
    salaryFrom: '',
    salaryTo: '',
    currencyCode: 'RUB',
    salaryTaxMode: 3,
    applicationDeadline: '',
    tagIds: [] as number[],
  })

  const [opportunityForm, setOpportunityForm] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    kind: 4,
    format: 2,
    status: 1,
    cityId: '',
    locationId: '',
    priceType: 1,
    priceAmount: '',
    priceCurrencyCode: 'RUB',
    participantsCanWrite: true,
    eventDate: '',
    tagIds: [] as number[],
  })

  const [profileForm, setProfileForm] = useState({
    legalName: '',
    brandName: '',
    legalType: 1,
    taxId: '',
    registrationNumber: '',
    industry: '',
    description: '',
    baseCityId: 1,
    websiteUrl: '',
    publicEmail: '',
    publicPhone: '',
  })

  const [chatSettingsForm, setChatSettingsForm] = useState({
    autoGreetingEnabled: false,
    autoGreetingText: '',
    outsideHoursEnabled: false,
    outsideHoursText: '',
    workingHoursTimezone: 'Europe/Moscow',
    workingHoursFrom: '',
    workingHoursTo: '',
  })

  const [companyLinkForm, setCompanyLinkForm] = useState({
    linkKind: 1,
    url: '',
    label: '',
  })
  const [verificationProfile, setVerificationProfile] = useState<EmployerVerificationProfile | null>(null)
  const [verificationIndustries, setVerificationIndustries] = useState<EmployerVerificationIndustry[]>([])
  const [verificationRequirements, setVerificationRequirements] = useState<EmployerVerificationRequirement[]>([])
  const [verificationDocuments, setVerificationDocuments] = useState<EmployerVerificationDocument[]>([])
  const [verificationSaving, setVerificationSaving] = useState(false)
  const [verificationUploadType, setVerificationUploadType] = useState(1)
  const [verificationUploadFile, setVerificationUploadFile] = useState<File | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [citiesResult, tagsResult, chatsResult, applicationsResult] = await Promise.allSettled([
        fetchCities(),
        fetchTags(),
        fetchEmployerChats(),
        fetchEmployerApplications(),
      ])

      if (citiesResult.status === 'fulfilled') {
        setCities(citiesResult.value)
      }

      if (tagsResult.status === 'fulfilled') {
        setTags(tagsResult.value)
      }

      if (chatsResult.status === 'fulfilled') {
        const chats = chatsResult.value.map((chat) => ({
          id: chat.id,
          title: chat.title?.trim() || `Р§Р°С‚ #${chat.id}`,
          lastMessageText: chat.lastMessage?.text?.trim() || 'РЎРѕРѕР±С‰РµРЅРёР№ РїРѕРєР° РЅРµС‚',
          lastMessageAt: chat.lastMessage?.createdAt ?? chat.createdAt,
        }))

        setApplicationChats(chats)
      }

      if (applicationsResult.status === 'fulfilled') {
        setApplications(applicationsResult.value)
      }

      const employerCompany = await fetchEmployerCompany()
      setCompany(employerCompany)
      setCompanyMissing(false)

      setProfileForm({
        legalName: employerCompany.legalName,
        brandName: employerCompany.brandName,
        legalType: employerCompany.legalType,
        taxId: employerCompany.taxId,
        registrationNumber: employerCompany.registrationNumber,
        industry: employerCompany.industry,
        description: employerCompany.description,
        baseCityId: employerCompany.baseCityId || 1,
        websiteUrl: employerCompany.websiteUrl,
        publicEmail: employerCompany.publicEmail,
        publicPhone: employerCompany.publicPhone,
      })

      setChatSettingsForm({
        autoGreetingEnabled: employerCompany.chatSettings.autoGreetingEnabled,
        autoGreetingText: employerCompany.chatSettings.autoGreetingText,
        outsideHoursEnabled: employerCompany.chatSettings.outsideHoursEnabled,
        outsideHoursText: employerCompany.chatSettings.outsideHoursText,
        workingHoursTimezone: employerCompany.chatSettings.workingHoursTimezone || 'Europe/Moscow',
        workingHoursFrom: toTimeInputValue(employerCompany.chatSettings.workingHoursFrom),
        workingHoursTo: toTimeInputValue(employerCompany.chatSettings.workingHoursTo),
      })

      const [verificationProfileResult, verificationIndustriesResult, verificationDocumentsResult] = await Promise.allSettled([
        fetchEmployerVerificationProfile(),
        fetchEmployerVerificationIndustries(),
        fetchEmployerVerificationDocuments(),
      ])

      if (verificationProfileResult.status === 'fulfilled') {
        setVerificationProfile(verificationProfileResult.value)
        const requirements = await fetchEmployerVerificationRequirements(verificationProfileResult.value.employerType)
        setVerificationRequirements(requirements)
      } else {
        setVerificationProfile(null)
        setVerificationRequirements([])
      }

      if (verificationIndustriesResult.status === 'fulfilled') {
        setVerificationIndustries(verificationIndustriesResult.value)
      } else {
        setVerificationIndustries([])
      }

      if (verificationDocumentsResult.status === 'fulfilled') {
        setVerificationDocuments(verificationDocumentsResult.value)
      } else {
        setVerificationDocuments([])
      }

      const [companyOpportunitiesResult, companyLinksResult] = await Promise.allSettled([
        fetchEmployerCompanyOpportunities(),
        fetchEmployerCompanyLinks(),
      ])

      if (companyOpportunitiesResult.status === 'fulfilled') {
        setOpportunities(companyOpportunitiesResult.value)
      }

      if (companyLinksResult.status === 'fulfilled') {
        setCompanyLinks(companyLinksResult.value)
      } else {
        setCompanyLinks([])
      }

      setEditingCompanyLinkId(null)
      setCompanyLinkForm({
        linkKind: 1,
        url: '',
        label: '',
      })
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return
      }

      const message = loadError instanceof Error ? loadError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєР°Р±РёРЅРµС‚ СЂР°Р±РѕС‚РѕРґР°С‚РµР»СЏ.'
      const normalized = message.toLowerCase()

      if (normalized.includes('not found') || normalized.includes('РЅРµ РЅР°Р№РґРµРЅ')) {
        setCompany(null)
        setCompanyMissing(true)
        setOpportunities([])
        setCompanyLinks([])
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

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
    const cityId = Number(opportunityForm.cityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setOpportunityLocations([])
      return
    }

    let active = true
    void fetchLocations(cityId)
      .then((items) => {
        if (active) {
          setOpportunityLocations(items)
        }
      })
      .catch(() => {
        if (active) {
          setOpportunityLocations([])
        }
      })

    return () => {
      active = false
    }
  }, [opportunityForm.cityId])

  const statusCode = toLowerSafe(company?.status)
  const companyStatusText = companyStatusLabel[statusCode] ?? 'РЎС‚Р°С‚СѓСЃ РЅРµ РѕРїСЂРµРґРµР»РµРЅ'
  const companyStatusToneClass = companyStatusTone[statusCode] ?? 'warning'
  const companyName = company?.brandName.trim() || company?.legalName.trim() || 'РљРѕРјРїР°РЅРёСЏ'

  const overview = useMemo(() => {
    const now = Date.now()
    const last24h = 24 * 60 * 60 * 1000

    const recentChats = applicationChats.filter((chat) => {
      const ts = Date.parse(chat.lastMessageAt)
      return !Number.isNaN(ts) && now - ts <= last24h
    }).length

    return {
      opportunitiesTotal: opportunities.length,
      responsesTotal: applications.length,
      responsesRecent: recentChats,
      status: companyStatusText,
    }
  }, [applicationChats, applications.length, companyStatusText, opportunities.length])

  const filteredOpportunities = useMemo(() => {
    const normalizedSearch = opportunitySearch.trim().toLowerCase()

    return opportunities.filter((item) => {
      if (opportunitySourceFilter !== 'all' && item.source !== opportunitySourceFilter) {
        return false
      }

      if (opportunityStatusesFilter.length > 0 && !opportunityStatusesFilter.includes(item.status)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [item.title, item.locationName, ...item.tags].join(' ').toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [opportunities, opportunitySearch, opportunitySourceFilter, opportunityStatusesFilter])

  const hasOpportunityFilters = opportunitySourceFilter !== 'all' || opportunityStatusesFilter.length > 0 || Boolean(opportunitySearch.trim())
  const filteredApplications = useMemo(() => {
    const normalizedSearch = applicationSearch.trim().toLowerCase()

    return applications.filter((application) => {
      if (applicationStatusesFilter.length > 0 && !applicationStatusesFilter.includes(application.status)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        application.vacancyTitle,
        application.candidateName,
        applicationStatusLabel[application.status] ?? `РЎС‚Р°С‚СѓСЃ ${application.status}`,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [applicationSearch, applicationStatusesFilter, applications])
  const hasApplicationFilters = applicationStatusesFilter.length > 0 || Boolean(applicationSearch.trim())
  const availableApplicationStatuses = useMemo(
    () => Array.from(new Set(applications.map((item) => item.status))).sort((a, b) => a - b),
    [applications],
  )

  const selectedCandidateResume = selectedApplicationDetail?.candidateResume ?? null

  function onTabSelect(nextTab: EmployerTabId) {
    if (nextTab === 'create') {
      navigate('/vacancy-flow/1?type=vacancy')
      return
    }

    setTab(nextTab)
  }

  function toggleOpportunityStatusGroup(values: number[]) {
    setOpportunityStatusesFilter((current) => {
      const hasAll = values.every((value) => current.includes(value))
      if (hasAll) {
        return current.filter((value) => !values.includes(value))
      }

      return Array.from(new Set([...current, ...values]))
    })
  }

  function resetOpportunityFilters() {
    setOpportunitySearch('')
    setOpportunitySourceFilter('all')
    setOpportunityStatusesFilter([])
  }

  function toggleApplicationStatusGroup(values: number[]) {
    setApplicationStatusesFilter((current) => {
      const hasAll = values.every((value) => current.includes(value))
      if (hasAll) {
        return current.filter((value) => !values.includes(value))
      }

      return Array.from(new Set([...current, ...values]))
    })
  }

  function resetApplicationFilters() {
    setApplicationSearch('')
    setApplicationStatusesFilter([])
  }

  function onCreateFormChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setCreateForm((state) => ({ ...state, [name]: value }))
  }

  function onCreateLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setCreateLogoFile(file)
  }

  function onProfileFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setProfileForm((state) => ({
      ...state,
      [name]: name === 'baseCityId' || name === 'legalType' ? Number(value) || 0 : value,
    }))
  }

  function onChatSettingsChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setChatSettingsForm((state) => ({
      ...state,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function onCompanyLinkFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setCompanyLinkForm((state) => ({
      ...state,
      [name]: name === 'linkKind' ? Number(value) || 7 : value,
    }))
  }

  function onVerificationProfileChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setVerificationProfile((state) => {
      if (!state) {
        return state
      }

      return {
        ...state,
        [name]: name === 'employerType' || name === 'mainIndustryId' ? Number(value) || 0 : value,
      }
    })
  }

  async function onSaveVerificationProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verificationProfile) {
      return
    }

    setError('')
    setSuccess('')
    setVerificationSaving(true)
    try {
      await updateEmployerCompanyVerification(verificationProfile)
      const requirements = await fetchEmployerVerificationRequirements(verificationProfile.employerType)
      setVerificationRequirements(requirements)
      setSuccess('Verification profile saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Cannot save verification profile.')
    } finally {
      setVerificationSaving(false)
    }
  }

  async function onUploadVerificationDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verificationUploadFile) {
      return
    }

    setError('')
    setSuccess('')
    setVerificationSaving(true)
    try {
      const uploaded = await uploadEmployerVerificationDocument(verificationUploadType, verificationUploadFile)
      setVerificationDocuments((state) => [uploaded, ...state])
      setVerificationUploadFile(null)
      setSuccess('Verification document uploaded.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Cannot upload verification document.')
    } finally {
      setVerificationSaving(false)
    }
  }

  async function onDeleteVerificationDocument(documentId: number) {
    setError('')
    setSuccess('')
    setVerificationSaving(true)
    try {
      await deleteEmployerVerificationDocument(documentId)
      setVerificationDocuments((state) => state.filter((item) => item.id !== documentId))
      setSuccess('Verification document deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Cannot delete verification document.')
    } finally {
      setVerificationSaving(false)
    }
  }

  function onEditCompanyLink(link: EmployerCompanyLink) {
    setEditingCompanyLinkId(link.id)
    setCompanyLinkForm({
      linkKind: link.linkKind,
      url: link.url,
      label: link.label,
    })
  }

  function onCancelCompanyLinkEdit() {
    setEditingCompanyLinkId(null)
    setCompanyLinkForm({
      linkKind: 1,
      url: '',
      label: '',
    })
  }

  function onVacancyFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setVacancyForm((state) => ({
      ...state,
      [name]: name === 'kind' || name === 'format' || name === 'status' || name === 'salaryTaxMode' ? Number(value) || 0 : value,
      ...(name === 'cityId' ? { locationId: '' } : {}),
    }))
  }

  function onOpportunityFormChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked

    setOpportunityForm((state) => ({
      ...state,
      [name]:
        name === 'kind' || name === 'format' || name === 'status' || name === 'priceType'
          ? Number(value) || 0
          : type === 'checkbox'
            ? checked
            : value,
      ...(name === 'cityId' ? { locationId: '' } : {}),
    }))
  }

  function onVacancyTagsChange(values: number[]) {
    setVacancyForm((state) => ({
      ...state,
      tagIds: values,
    }))
  }

  function onOpportunityTagsChange(values: number[]) {
    setOpportunityForm((state) => ({
      ...state,
      tagIds: values,
    }))
  }

  function mapTagNamesToIds(tagNames: string[] | null | undefined) {
    if (!tagNames?.length) {
      return []
    }

    const nameSet = new Set(tagNames.map((name) => name.trim().toLowerCase()))
    return tags.filter((tag) => nameSet.has(tag.name.trim().toLowerCase())).map((tag) => tag.id)
  }

  function resetVacancyForm() {
    setVacancyForm({
      title: '',
      shortDescription: '',
      fullDescription: '',
      kind: 2,
      format: 2,
      status: 1,
      cityId: '',
      locationId: '',
      salaryFrom: '',
      salaryTo: '',
      currencyCode: 'RUB',
      salaryTaxMode: 3,
      applicationDeadline: '',
      tagIds: [],
    })
  }

  function resetOpportunityForm() {
    setOpportunityForm({
      title: '',
      shortDescription: '',
      fullDescription: '',
      kind: 4,
      format: 2,
      status: 1,
      cityId: '',
      locationId: '',
      priceType: 1,
      priceAmount: '',
      priceCurrencyCode: 'RUB',
      participantsCanWrite: true,
      eventDate: '',
      tagIds: [],
    })
  }

  async function onCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setCreatingCompany(true)

    try {
      const createdCompany = await createEmployerCompany(createForm)
      if (createLogoFile) {
        const companyId = createdCompany.companyId ?? (await fetchEmployerCompany()).id
        await uploadCompanyLogo(companyId, createLogoFile)
        setCreateLogoFile(null)
      }
      setSuccess('РљРѕРјРїР°РЅРёСЏ СЃРѕР·РґР°РЅР°. Р”Р°РЅРЅС‹Рµ РєР°Р±РёРЅРµС‚Р° РѕР±РЅРѕРІР»РµРЅС‹.')
      await loadDashboard()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєРѕРјРїР°РЅРёСЋ.')
    } finally {
      setCreatingCompany(false)
    }
  }

  async function onCreateVacancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!vacancyForm.title.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ РІР°РєР°РЅСЃРёРё.')
      return
    }

    if (!vacancyForm.shortDescription.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РІР°РєР°РЅСЃРёРё.')
      return
    }

    if (!vacancyForm.fullDescription.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РїРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ РІР°РєР°РЅСЃРёРё.')
      return
    }

    const publishAt = new Date().toISOString()

    const applicationDeadline = vacancyForm.applicationDeadline.trim()
      ? toIsoDateTimeFromLocalInput(vacancyForm.applicationDeadline)
      : null
    if (vacancyForm.applicationDeadline.trim() && !applicationDeadline) {
      setError('РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РґРµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ.')
      return
    }

    if (applicationDeadline && Date.parse(applicationDeadline) < Date.now()) {
      setError('Р”РµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ СЂР°РЅСЊС€Рµ РґР°С‚С‹ РїСѓР±Р»РёРєР°С†РёРё.')
      return
    }

    const salaryFrom = toNumberOrNull(vacancyForm.salaryFrom)
    const salaryTo = toNumberOrNull(vacancyForm.salaryTo)
    if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
      setError('Р—Р°СЂРїР»Р°С‚Р° "РґРѕ" РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ РёР»Рё СЂР°РІРЅР° Р·Р°СЂРїР»Р°С‚Рµ "РѕС‚".')
      return
    }

    setError('')
    setSuccess('')
    setCreatingVacancy(true)

    try {
      const payload = {
        title: vacancyForm.title,
        shortDescription: vacancyForm.shortDescription,
        fullDescription: vacancyForm.fullDescription,
        kind: vacancyForm.kind,
        format: vacancyForm.format,
        status: vacancyForm.status,
        cityId: vacancyForm.cityId.trim() ? Number(vacancyForm.cityId) : null,
        locationId: vacancyForm.locationId.trim() ? Number(vacancyForm.locationId) : null,
        salaryFrom,
        salaryTo,
        currencyCode: normalizeCurrencyCode(vacancyForm.currencyCode),
        salaryTaxMode: vacancyForm.salaryTaxMode,
        publishAt,
        applicationDeadline,
        tagIds: vacancyForm.tagIds,
      }

      if (editingVacancyId) {
        await updateEmployerVacancy(editingVacancyId, payload)
        setSuccess('Р’Р°РєР°РЅСЃРёСЏ РѕР±РЅРѕРІР»РµРЅР°.')
      } else {
        await createEmployerVacancy(payload)
        setSuccess('Р’Р°РєР°РЅСЃРёСЏ СЃРѕР·РґР°РЅР°.')
      }

      resetVacancyForm()
      setEditingVacancyId(null)
      await loadDashboard()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : editingVacancyId ? 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РІР°РєР°РЅСЃРёСЋ.' : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РІР°РєР°РЅСЃРёСЋ.')
    } finally {
      setCreatingVacancy(false)
    }
  }

  async function onCreateOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!opportunityForm.title.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.')
      return
    }

    if (!opportunityForm.shortDescription.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.')
      return
    }

    if (!opportunityForm.fullDescription.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ РїРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.')
      return
    }

    const publishAt = new Date().toISOString()

    const eventDate = opportunityForm.eventDate.trim() ? toIsoDateTimeFromLocalInput(opportunityForm.eventDate) : null
    if (opportunityForm.eventDate.trim() && !eventDate) {
      setError('РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ РґР°С‚Сѓ СЃРѕР±С‹С‚РёСЏ.')
      return
    }

    const priceAmount = toNumberOrNull(opportunityForm.priceAmount)
    if ((opportunityForm.priceType === 2 || opportunityForm.priceType === 3) && priceAmount === null) {
      setError('Р”Р»СЏ РїР»Р°С‚РЅРѕР№ РёР»Рё РїСЂРёР·РѕРІРѕР№ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё СѓРєР°Р¶РёС‚Рµ СЃСѓРјРјСѓ.')
      return
    }

    setError('')
    setSuccess('')
    setCreatingOpportunity(true)

    try {
      const normalizedPriceAmount = opportunityForm.priceType === 1 ? null : priceAmount
      const normalizedPriceCurrency = opportunityForm.priceType === 1 ? null : normalizeCurrencyCode(opportunityForm.priceCurrencyCode)

      const payload = {
        title: opportunityForm.title,
        shortDescription: opportunityForm.shortDescription,
        fullDescription: opportunityForm.fullDescription,
        kind: opportunityForm.kind,
        format: opportunityForm.format,
        status: opportunityForm.status,
        cityId: opportunityForm.cityId.trim() ? Number(opportunityForm.cityId) : null,
        locationId: opportunityForm.locationId.trim() ? Number(opportunityForm.locationId) : null,
        priceType: opportunityForm.priceType,
        priceAmount: normalizedPriceAmount,
        priceCurrencyCode: normalizedPriceCurrency,
        participantsCanWrite: opportunityForm.participantsCanWrite,
        publishAt,
        eventDate,
        tagIds: opportunityForm.tagIds,
      }

      if (editingOpportunityId) {
        await updateEmployerOpportunity(editingOpportunityId, payload)
        setSuccess('Р’РѕР·РјРѕР¶РЅРѕСЃС‚СЊ РѕР±РЅРѕРІР»РµРЅР°.')
      } else {
        await createEmployerOpportunity(payload)
        setSuccess('Р’РѕР·РјРѕР¶РЅРѕСЃС‚СЊ СЃРѕР·РґР°РЅР°.')
      }

      resetOpportunityForm()
      setEditingOpportunityId(null)
      await loadDashboard()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : editingOpportunityId ? 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ.' : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ.')
    } finally {
      setCreatingOpportunity(false)
    }
  }

  async function onEditOpportunity(item: EmployerOpportunity) {
    setError('')
    setSuccess('')
    const key = `${item.source}-${item.id}`
    setLoadingOpportunityEditorKey(key)

    try {
      if (item.source === 'vacancy') {
        const detail = await fetchEmployerVacancyDetail(item.id)
        const cityId = detail.cityId
        let resolvedLocationId = ''

        if (cityId) {
          const locationItems = await fetchLocations(cityId)
          setVacancyLocations(locationItems)

          const matchedLocation = locationItems.find((location) => {
            const sameStreet = location.streetName.trim().toLowerCase() === detail.locationStreetName.trim().toLowerCase()
            const sameHouse = location.houseNumber.trim().toLowerCase() === detail.locationHouseNumber.trim().toLowerCase()
            return sameStreet && sameHouse
          })
          resolvedLocationId = matchedLocation ? String(matchedLocation.id) : ''
        }

        setVacancyForm({
          title: detail.title,
          shortDescription: detail.shortDescription,
          fullDescription: detail.fullDescription,
          kind: detail.kind,
          format: detail.format,
          status: detail.status,
          cityId: cityId ? String(cityId) : '',
          locationId: resolvedLocationId,
          salaryFrom: detail.salaryFrom != null ? String(detail.salaryFrom) : '',
          salaryTo: detail.salaryTo != null ? String(detail.salaryTo) : '',
          currencyCode: detail.currencyCode ?? 'RUB',
          salaryTaxMode: detail.salaryTaxMode,
          applicationDeadline: detail.applicationDeadline ? toLocalDateTimeInputValue(detail.applicationDeadline) : '',
          tagIds: mapTagNamesToIds(detail.tags),
        })

        setEditingVacancyId(item.id)
        setEditingOpportunityId(null)
      } else {
        const detail = await fetchEmployerOpportunityDetail(item.id)
        const cityId = detail.cityId
        let resolvedLocationId = ''

        if (cityId) {
          const locationItems = await fetchLocations(cityId)
          setOpportunityLocations(locationItems)

          const matchedLocation = locationItems.find((location) => {
            const sameStreet = location.streetName.trim().toLowerCase() === detail.locationStreetName.trim().toLowerCase()
            const sameHouse = location.houseNumber.trim().toLowerCase() === detail.locationHouseNumber.trim().toLowerCase()
            return sameStreet && sameHouse
          })
          resolvedLocationId = matchedLocation ? String(matchedLocation.id) : ''
        }

        setOpportunityForm({
          title: detail.title,
          shortDescription: detail.shortDescription,
          fullDescription: detail.fullDescription,
          kind: detail.kind,
          format: detail.format,
          status: detail.status,
          cityId: cityId ? String(cityId) : '',
          locationId: resolvedLocationId,
          priceType: detail.priceType,
          priceAmount: detail.priceAmount != null ? String(detail.priceAmount) : '',
          priceCurrencyCode: detail.priceCurrencyCode ?? 'RUB',
          participantsCanWrite: detail.participantsCanWrite,
          eventDate: detail.eventDate ? toLocalDateTimeInputValue(detail.eventDate) : '',
          tagIds: mapTagNamesToIds(detail.tags),
        })

        setEditingOpportunityId(item.id)
        setEditingVacancyId(null)
      }

      navigate(`/vacancy-flow/1?type=${item.source === 'vacancy' ? 'vacancy' : 'event'}`)
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ РґР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ.')
    } finally {
      setLoadingOpportunityEditorKey(null)
    }
  }

  function onCancelVacancyEdit() {
    setEditingVacancyId(null)
    resetVacancyForm()
  }

  function onCancelOpportunityEdit() {
    setEditingOpportunityId(null)
    resetOpportunityForm()
  }

  async function onDeleteOpportunity(item: EmployerOpportunity) {
    const entityLabel = item.source === 'vacancy' ? 'РІР°РєР°РЅСЃРёСЋ' : 'РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ'
    if (typeof window !== 'undefined' && !window.confirm(`РЈРґР°Р»РёС‚СЊ ${entityLabel} "${item.title}"?`)) {
      return
    }

    setError('')
    setSuccess('')
    const key = `${item.source}-${item.id}`
    setDeletingOpportunityKey(key)

    try {
      if (item.source === 'vacancy') {
        await deleteEmployerVacancy(item.id)
        if (editingVacancyId === item.id) {
          onCancelVacancyEdit()
        }
      } else {
        await deleteEmployerOpportunity(item.id)
        if (editingOpportunityId === item.id) {
          onCancelOpportunityEdit()
        }
      }

      setOpportunities((state) => state.filter((opportunity) => !(opportunity.id === item.id && opportunity.source === item.source)))
      setSuccess(item.source === 'vacancy' ? 'Р’Р°РєР°РЅСЃРёСЏ СѓРґР°Р»РµРЅР°.' : 'Р’РѕР·РјРѕР¶РЅРѕСЃС‚СЊ СѓРґР°Р»РµРЅР°.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїСѓР±Р»РёРєР°С†РёСЋ.')
    } finally {
      setDeletingOpportunityKey(null)
    }
  }

  async function onUpdateApplicationStatus(application: EmployerApplication, nextStatus: number) {
    if (nextStatus === application.status) {
      return
    }

    setError('')
    setSuccess('')
    setUpdatingApplicationId(application.id)

    try {
      await updateEmployerApplicationStatus(application.id, nextStatus)
      setApplications((state) =>
        state.map((item) => (item.id === application.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item)),
      )
      setSelectedApplicationDetail((state) =>
        state && state.id === application.id ? { ...state, status: nextStatus, updatedAt: new Date().toISOString() } : state,
      )
      setSuccess(`РЎС‚Р°С‚СѓСЃ РѕС‚РєР»РёРєР° #${application.id} РѕР±РЅРѕРІР»РµРЅ.`)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃС‚Р°С‚СѓСЃ РѕС‚РєР»РёРєР°.')
    } finally {
      setUpdatingApplicationId(null)
    }
  }

  async function onGoToCandidateProfile(applicationId: number) {
    setError('')
    setLoadingApplicationDetailId(applicationId)

    try {
      const detail = await fetchEmployerApplicationDetail(applicationId)
      const username = detail.candidateResume?.username?.trim()
      if (!username) {
        setError('РџРµСЂРµС…РѕРґ РІ РїСЂРѕС„РёР»СЊ РЅРµРґРѕСЃС‚СѓРїРµРЅ: РЅРµ РЅР°Р№РґРµРЅ username РєР°РЅРґРёРґР°С‚Р°.')
        return
      }

      navigate(`/dashboard/seeker/${encodeURIComponent(username)}`)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ РєР°РЅРґРёРґР°С‚Р°.')
    } finally {
      setLoadingApplicationDetailId(null)
    }
  }

  async function onOpenApplicationDetail(applicationId: number) {
    setError('')
    setLoadingApplicationDetailId(applicationId)

    try {
      const detail = await fetchEmployerApplicationDetail(applicationId)
      setSelectedApplicationDetail(detail)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ РєР°РЅРґРёРґР°С‚Р°.')
    } finally {
      setLoadingApplicationDetailId(null)
    }
  }

  async function onSaveCompanyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!company) {
      return
    }

    setError('')
    setSuccess('')
    setSavingProfile(true)

    try {
      await updateEmployerCompanyVerification(profileForm)
      setSuccess('РџСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё РѕР±РЅРѕРІР»РµРЅ.')
      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РїСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function onSaveChatSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!company) {
      return
    }

    setError('')
    setSuccess('')
    setSavingChatSettings(true)

    try {
      await updateEmployerCompanyChatSettings(chatSettingsForm)
      setSuccess('Р§Р°С‚-РЅР°СЃС‚СЂРѕР№РєРё РєРѕРјРїР°РЅРёРё РѕР±РЅРѕРІР»РµРЅС‹.')
      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ С‡Р°С‚-РЅР°СЃС‚СЂРѕР№РєРё.')
    } finally {
      setSavingChatSettings(false)
    }
  }

  async function onSaveCompanyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!company) {
      return
    }

    if (!companyLinkForm.url.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ URL СЃСЃС‹Р»РєРё РєРѕРјРїР°РЅРёРё.')
      return
    }

    setError('')
    setSuccess('')
    setSavingCompanyLink(true)

    try {
      if (editingCompanyLinkId) {
        await updateEmployerCompanyLink(editingCompanyLinkId, companyLinkForm)
        setSuccess('РЎСЃС‹Р»РєР° РєРѕРјРїР°РЅРёРё РѕР±РЅРѕРІР»РµРЅР°.')
      } else {
        await createEmployerCompanyLink(companyLinkForm)
        setSuccess('РЎСЃС‹Р»РєР° РєРѕРјРїР°РЅРёРё РґРѕР±Р°РІР»РµРЅР°.')
      }

      await loadDashboard()
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ СЃСЃС‹Р»РєСѓ РєРѕРјРїР°РЅРёРё.')
    } finally {
      setSavingCompanyLink(false)
    }
  }

  async function onDeleteCompanyLink(linkId: number) {
    if (!company) {
      return
    }

    if (typeof window !== 'undefined' && !window.confirm('РЈРґР°Р»РёС‚СЊ СЃСЃС‹Р»РєСѓ РєРѕРјРїР°РЅРёРё?')) {
      return
    }

    setError('')
    setSuccess('')
    setDeletingCompanyLinkId(linkId)

    try {
      await deleteEmployerCompanyLink(linkId)
      setSuccess('РЎСЃС‹Р»РєР° РєРѕРјРїР°РЅРёРё СѓРґР°Р»РµРЅР°.')
      await loadDashboard()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ СЃСЃС‹Р»РєСѓ РєРѕРјРїР°РЅРёРё.')
    } finally {
      setDeletingCompanyLinkId(null)
    }
  }

  async function onSubmitVerification() {
    if (!company) {
      return
    }

    setError('')
    setSuccess('')
    setSubmittingVerification(true)

    try {
      await submitEmployerCompanyVerification()
      setSuccess('РљРѕРјРїР°РЅРёСЏ РѕС‚РїСЂР°РІР»РµРЅР° РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ.')
      await loadDashboard()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРјРїР°РЅРёСЋ РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ.')
    } finally {
      setSubmittingVerification(false)
    }
  }

  async function onUploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file || !company) {
      return
    }

    setError('')
    setSuccess('')
    setUploadingLogo(true)

    try {
      const result = await uploadCompanyLogo(company.id, file)
      setSuccess(result.url ? 'Р›РѕРіРѕС‚РёРї Р·Р°РіСЂСѓР¶РµРЅ. РЎРѕС…СЂР°РЅРёС‚Рµ РїСЂРѕС„РёР»СЊ, С‡С‚РѕР±С‹ РѕР±РЅРѕРІРёС‚СЊ РґР°РЅРЅС‹Рµ.' : 'Р›РѕРіРѕС‚РёРї Р·Р°РіСЂСѓР¶РµРЅ.')
      await loadDashboard()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р»РѕРіРѕС‚РёРї.')
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  async function onUploadGalleryMedia(file: File) {
    if (!company) {
      return
    }

    setError('')
    setSuccess('')
    setUploadingGalleryMedia(true)

    try {
      await uploadCompanyGalleryMedia(company.id, file)
      setSuccess('РњРµРґРёР° РґРѕР±Р°РІР»РµРЅРѕ РІ РіР°Р»РµСЂРµСЋ РєРѕРјРїР°РЅРёРё.')
      await loadDashboard()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ РјРµРґРёР° РІ РіР°Р»РµСЂРµСЋ РєРѕРјРїР°РЅРёРё.')
    } finally {
      setUploadingGalleryMedia(false)
    }
  }

  async function onDeleteGalleryMedia(mediaId: number) {
    if (!company) {
      return
    }

    setError('')
    setSuccess('')
    setDeletingGalleryMediaId(mediaId)

    try {
      await deleteCompanyGalleryMedia(company.id, mediaId)
      setSuccess('Р­Р»РµРјРµРЅС‚ РіР°Р»РµСЂРµРё СѓРґР°Р»РµРЅ.')
      await loadDashboard()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ СЌР»РµРјРµРЅС‚ РіР°Р»РµСЂРµРё.')
    } finally {
      setDeletingGalleryMediaId(null)
    }
  }

  return (
    <div className="app-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <section className="container seeker-profile-page">
          <header className="card seeker-profile-hero employer-profile-hero">
            <div className="seeker-profile-hero__avatar employer-profile-hero__avatar">
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt={`Р›РѕРіРѕС‚РёРї ${companyName}`} />
              ) : (
                <span>
                  <Building2 size={28} />
                </span>
              )}
            </div>
            <div className="seeker-profile-hero__content">
              <h1>{companyName}</h1>
              <p></p>
              <div className="seeker-profile-hero__meta">
                <span className={`status-chip status-chip--${companyStatusToneClass}`}>{companyStatusText}</span>
                <span>
                  <Globe size={14} />
                  {company?.websiteUrl || 'РЎР°Р№С‚ РЅРµ СѓРєР°Р·Р°РЅ'}
                </span>
                <span>
                  <Mail size={14} />
                  {company?.publicEmail || 'Email РЅРµ СѓРєР°Р·Р°РЅ'}
                </span>
                <span>
                  <Phone size={14} />
                  {company?.publicPhone || 'РўРµР»РµС„РѕРЅ РЅРµ СѓРєР°Р·Р°РЅ'}
                </span>
              </div>
            </div>
            <div className="seeker-profile-hero__actions">
              <button type="button" className="btn btn--secondary" onClick={() => onTabSelect('create')} disabled={!company}>
                РЎРѕР·РґР°С‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setTab('verification')} disabled={!company}>
                <ShieldCheck size={16} />
                РџРµСЂРµР№С‚Рё Рє РІРµСЂРёС„РёРєР°С†РёРё
              </button>
            </div>
          </header>

          {loading ? (
            <section className="card seeker-profile-state">
              <p>Р—Р°РіСЂСѓР¶Р°РµРј РєР°Р±РёРЅРµС‚ СЂР°Р±РѕС‚РѕРґР°С‚РµР»СЏ...</p>
            </section>
          ) : null}

          {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
          {success ? <div className="auth-feedback seeker-profile-feedback">{success}</div> : null}

          {companyMissing ? (
            <section className="card seeker-profile-panel">
              <h2>РЎРѕР·РґР°РЅРёРµ РєРѕРјРїР°РЅРёРё</h2>
              <form className="form-grid form-grid--two" onSubmit={onCreateCompany}>
                <label>
                  Р®СЂРёРґРёС‡РµСЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ
                  <input name="legalName" type="text" value={createForm.legalName} onChange={onCreateFormChange} required />
                </label>
                <label>
                  Р‘СЂРµРЅРґ
                  <input name="brandName" type="text" value={createForm.brandName} onChange={onCreateFormChange} />
                </label>
                <label className="full-width">
                  Р›РѕРіРѕС‚РёРї (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
                  <input type="file" accept="image/*" onChange={onCreateLogoChange} disabled={creatingCompany} />
                  {createLogoFile ? <small>{createLogoFile.name}</small> : null}
                </label>
                <button type="submit" className="btn btn--primary full-width" disabled={creatingCompany}>
                  {creatingCompany ? 'РЎРѕР·РґР°РµРј РєРѕРјРїР°РЅРёСЋ...' : 'РЎРѕР·РґР°С‚СЊ РєРѕРјРїР°РЅРёСЋ'}
                </button>
              </form>
            </section>
          ) : (
            <>
              <nav className="card seeker-profile-tabs">
                {employerTabs.map((item) => (
                  <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => onTabSelect(item.id)}>
                    {item.label}
                  </button>
                ))}
              </nav>

              {tab === 'overview' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РћР±Р·РѕСЂ</h2>
        {loading ? <p>Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ...</p> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}
        <div className="stat-grid">
          <article>
            <strong>{overview.opportunitiesTotal}</strong>
            <span>РћРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹С… РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№</span>
          </article>
          <article>
            <strong>{overview.responsesTotal}</strong>
            <span>РћС‚РєР»РёРєРѕРІ</span>
          </article>
          <article>
            <strong>{overview.responsesRecent}</strong>
            <span>РђРєС‚РёРІРЅРѕСЃС‚СЊ РІ С‡Р°С‚Р°С… Р·Р° 24 С‡Р°СЃР°</span>
          </article>
          <article>
            <strong>{overview.status}</strong>
            <span>РЎС‚Р°С‚СѓСЃ РєРѕРјРїР°РЅРёРё</span>
          </article>
        </div>
              </section> : null}

              {tab === 'company' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РџСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё</h2>
        {companyMissing ? (
          <form className="form-grid form-grid--two" onSubmit={onCreateCompany}>
            <label>
              Р®СЂРёРґРёС‡РµСЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ
              <input name="legalName" type="text" value={createForm.legalName} onChange={onCreateFormChange} required />
            </label>
            <label>
              Р‘СЂРµРЅРґ
              <input name="brandName" type="text" value={createForm.brandName} onChange={onCreateFormChange} />
            </label>
            <label className="full-width">
              Р›РѕРіРѕС‚РёРї (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
              <input type="file" accept="image/*" onChange={onCreateLogoChange} disabled={creatingCompany} />
              {createLogoFile ? <small>{createLogoFile.name}</small> : null}
            </label>
            <button type="submit" className="btn btn--primary full-width" disabled={creatingCompany}>
              {creatingCompany ? 'РЎРѕР·РґР°РµРј РєРѕРјРїР°РЅРёСЋ...' : 'РЎРѕР·РґР°С‚СЊ РєРѕРјРїР°РЅРёСЋ'}
            </button>
          </form>
        ) : (
          <form className="form-grid form-grid--two" onSubmit={onSaveCompanyProfile}>
            <div className="employer-company-header full-width">
              <div className="employer-company-header__identity">
                <Building2 size={18} />
                <strong>{companyName}</strong>
                <span className={`status-chip status-chip--${companyStatusToneClass}`}>{companyStatusText}</span>
              </div>
              <label className={`profile-settings-modal__file-button ${uploadingLogo ? 'is-loading' : ''}`}>
                <UploadCloud size={16} />
                {uploadingLogo ? 'Р—Р°РіСЂСѓР·РєР°...' : 'Р—Р°РіСЂСѓР·РёС‚СЊ Р»РѕРіРѕС‚РёРї'}
                <input type="file" accept="image/*" onChange={onUploadLogo} disabled={uploadingLogo} />
              </label>
            </div>

            <label>
              Р®СЂРёРґРёС‡РµСЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ
              <input name="legalName" type="text" value={profileForm.legalName} onChange={onProfileFormChange} required />
            </label>
            <label>
              Р‘СЂРµРЅРґРѕРІРѕРµ РЅР°Р·РІР°РЅРёРµ
              <input name="brandName" type="text" value={profileForm.brandName} onChange={onProfileFormChange} />
            </label>
            <label>
              РўРёРї РєРѕРјРїР°РЅРёРё
              <select name="legalType" value={profileForm.legalType} onChange={onProfileFormChange}>
                <option value={1}>Р®СЂРёРґРёС‡РµСЃРєРѕРµ Р»РёС†Рѕ</option>
                <option value={2}>РРџ</option>
              </select>
            </label>
            <label>
              Р‘Р°Р·РѕРІС‹Р№ РіРѕСЂРѕРґ
              <select name="baseCityId" value={profileForm.baseCityId} onChange={onProfileFormChange}>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              РРќРќ
              <input name="taxId" type="text" value={profileForm.taxId} onChange={onProfileFormChange} />
            </label>
            <label>
              Р РµРіРёСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РЅРѕРјРµСЂ
              <input name="registrationNumber" type="text" value={profileForm.registrationNumber} onChange={onProfileFormChange} />
            </label>
            <label>
              РћС‚СЂР°СЃР»СЊ
              <input name="industry" type="text" value={profileForm.industry} onChange={onProfileFormChange} />
            </label>
            <label>
              РЎР°Р№С‚
              <input name="websiteUrl" type="url" value={profileForm.websiteUrl} onChange={onProfileFormChange} />
            </label>
            <label>
              РџСѓР±Р»РёС‡РЅС‹Р№ email
              <input name="publicEmail" type="email" value={profileForm.publicEmail} onChange={onProfileFormChange} />
            </label>
            <label>
              РџСѓР±Р»РёС‡РЅС‹Р№ С‚РµР»РµС„РѕРЅ
              <input name="publicPhone" type="text" value={profileForm.publicPhone} onChange={onProfileFormChange} />
            </label>
            <label className="full-width">
              РћРїРёСЃР°РЅРёРµ
              <textarea name="description" rows={4} value={profileForm.description} onChange={onProfileFormChange} />
            </label>
            <button type="submit" className="btn btn--primary full-width" disabled={savingProfile}>
              {savingProfile ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё'}
            </button>
          </form>
        )}
        {!companyMissing && company ? (
          <CompanyMediaGallery
            className="employer-company-media"
            items={company.media}
            title="Р“Р°Р»РµСЂРµСЏ РєРѕРјРїР°РЅРёРё"
            emptyText="Р”РѕР±Р°РІСЊС‚Рµ С„РѕС‚Рѕ РёР»Рё РІРёРґРµРѕ РѕС„РёСЃР° Рё РєРѕРјР°РЅРґС‹."
            canManage
            uploadButtonLabel="Р”РѕР±Р°РІРёС‚СЊ РјРµРґРёР°"
            isUploading={uploadingGalleryMedia}
            deletingMediaId={deletingGalleryMediaId}
            onUpload={onUploadGalleryMedia}
            onDelete={onDeleteGalleryMedia}
          />
        ) : null}
              </section> : null}

              {tab === 'create' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РЎРѕР·РґР°С‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ</h2>
        <div className="employer-flow-entry">
          <p>Р”Р»СЏ СЃРѕР·РґР°РЅРёСЏ РІР°РєР°РЅСЃРёР№ Рё РјРµСЂРѕРїСЂРёСЏС‚РёР№ РёСЃРїРѕР»СЊР·СѓР№С‚Рµ РЅРѕРІС‹Р№ РјР°СЃС‚РµСЂ РїСѓР±Р»РёРєР°С†РёРё.</p>
          <div className="favorite-card__actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/vacancy-flow/1?type=vacancy')}>
              РџРµСЂРµР№С‚Рё Рє СЃРѕР·РґР°РЅРёСЋ РІР°РєР°РЅСЃРёРё
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/vacancy-flow/1?type=event')}>
              РџРµСЂРµР№С‚Рё Рє СЃРѕР·РґР°РЅРёСЋ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ
            </button>
          </div>
        </div>
        <div className="form-grid form-grid--two">
          <form className="form-grid" onSubmit={onCreateVacancy}>
            <h3>РќРѕРІР°СЏ РІР°РєР°РЅСЃРёСЏ</h3>
            {editingVacancyId ? <p>Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РІР°РєР°РЅСЃРёРё #{editingVacancyId}</p> : null}
            <label>
              РќР°Р·РІР°РЅРёРµ
              <input
                name="title"
                type="text"
                value={vacancyForm.title}
                onChange={onVacancyFormChange}
                required
              />
            </label>
            <label>
              РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ
              <textarea name="shortDescription" rows={2} value={vacancyForm.shortDescription} onChange={onVacancyFormChange} required />
            </label>
            <label>
              РџРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ
              <textarea name="fullDescription" rows={4} value={vacancyForm.fullDescription} onChange={onVacancyFormChange} required />
            </label>
            <label>
              Р’РёРґ
              <select name="kind" value={vacancyForm.kind} onChange={onVacancyFormChange}>
                <option value={1}>РЎС‚Р°Р¶РёСЂРѕРІРєР°</option>
                <option value={2}>Р Р°Р±РѕС‚Р°</option>
              </select>
            </label>
            <label>
              Р¤РѕСЂРјР°С‚
              <select name="format" value={vacancyForm.format} onChange={onVacancyFormChange}>
                <option value={1}>РћС„РёСЃ</option>
                <option value={2}>Р“РёР±СЂРёРґ</option>
                <option value={3}>РЈРґР°Р»РµРЅРЅРѕ</option>
              </select>
            </label>
            <label>
              РЎС‚Р°С‚СѓСЃ
              <select name="status" value={vacancyForm.status} onChange={onVacancyFormChange}>
                <option value={1}>Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅР°</option>
                <option value={3}>РќРµ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅР°</option>
              </select>
            </label>
            <label>
              Р“РѕСЂРѕРґ
              <select name="cityId" value={vacancyForm.cityId} onChange={onVacancyFormChange}>
                <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Р›РѕРєР°С†РёСЏ
              <select name="locationId" value={vacancyForm.locationId} onChange={onVacancyFormChange} disabled={!vacancyForm.cityId}>
                <option value="">РќРµ РІС‹Р±СЂР°РЅР°</option>
                {vacancyLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationOptionLabel(location)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Р—Р°СЂРїР»Р°С‚Р° РѕС‚
              <input name="salaryFrom" type="number" min={0} step="0.01" value={vacancyForm.salaryFrom} onChange={onVacancyFormChange} />
            </label>
            <label>
              Р—Р°СЂРїР»Р°С‚Р° РґРѕ
              <input name="salaryTo" type="number" min={0} step="0.01" value={vacancyForm.salaryTo} onChange={onVacancyFormChange} />
            </label>
            <label>
              Р’Р°Р»СЋС‚Р°
              <input name="currencyCode" type="text" value={vacancyForm.currencyCode} onChange={onVacancyFormChange} maxLength={3} />
            </label>
            <label>
              РќР°Р»РѕРіРѕРІС‹Р№ СЂРµР¶РёРј Р·Р°СЂРїР»Р°С‚С‹
              <select name="salaryTaxMode" value={vacancyForm.salaryTaxMode} onChange={onVacancyFormChange}>
                <option value={1}>Р”Рѕ РІС‹С‡РµС‚Р° РЅР°Р»РѕРіРѕРІ</option>
                <option value={2}>РџРѕСЃР»Рµ РІС‹С‡РµС‚Р° РЅР°Р»РѕРіРѕРІ</option>
                <option value={3}>РќРµ СѓРєР°Р·Р°РЅРѕ</option>
              </select>
            </label>
            <label>
              Р”РµРґР»Р°Р№РЅ РѕС‚РєР»РёРєРѕРІ
              <DateInput name="applicationDeadline" type="datetime-local" value={vacancyForm.applicationDeadline} onChange={onVacancyFormChange} />
            </label>
            <label>
              РўРµРіРё
              <TagPicker
                options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
                selectedIds={vacancyForm.tagIds}
                onChange={onVacancyTagsChange}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyMessage="No tags found"
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={!company || creatingVacancy}>
              {creatingVacancy ? (editingVacancyId ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РЎРѕР·РґР°РµРј...') : editingVacancyId ? 'РЎРѕС…СЂР°РЅРёС‚СЊ РІР°РєР°РЅСЃРёСЋ' : 'РЎРѕР·РґР°С‚СЊ РІР°РєР°РЅСЃРёСЋ'}
            </button>
            {editingVacancyId ? (
              <button type="button" className="btn btn--ghost" onClick={onCancelVacancyEdit} disabled={creatingVacancy}>
                РћС‚РјРµРЅРёС‚СЊ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ
              </button>
            ) : null}
          </form>

          <form className="form-grid" onSubmit={onCreateOpportunity}>
            <h3>РќРѕРІР°СЏ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ</h3>
            {editingOpportunityId ? <p>Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё #{editingOpportunityId}</p> : null}
            <label>
              РќР°Р·РІР°РЅРёРµ
              <input
                name="title"
                type="text"
                value={opportunityForm.title}
                onChange={onOpportunityFormChange}
                required
              />
            </label>
            <label>
              РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ
              <textarea name="shortDescription" rows={2} value={opportunityForm.shortDescription} onChange={onOpportunityFormChange} required />
            </label>
            <label>
              РџРѕР»РЅРѕРµ РѕРїРёСЃР°РЅРёРµ
              <textarea name="fullDescription" rows={4} value={opportunityForm.fullDescription} onChange={onOpportunityFormChange} required />
            </label>
            <label>
              Р’РёРґ
              <select name="kind" value={opportunityForm.kind} onChange={onOpportunityFormChange}>
                <option value={1}>РҐР°РєР°С‚РѕРЅ</option>
                <option value={2}>Р”РµРЅСЊ РѕС‚РєСЂС‹С‚С‹С… РґРІРµСЂРµР№</option>
                <option value={3}>Р›РµРєС†РёСЏ</option>
                <option value={4}>Р”СЂСѓРіРѕРµ</option>
              </select>
            </label>
            <label>
              Р¤РѕСЂРјР°С‚
              <select name="format" value={opportunityForm.format} onChange={onOpportunityFormChange}>
                <option value={1}>РћС„РёСЃ</option>
                <option value={2}>Р“РёР±СЂРёРґ</option>
                <option value={3}>РЈРґР°Р»РµРЅРЅРѕ</option>
              </select>
            </label>
            <label>
              РЎС‚Р°С‚СѓСЃ
              <select name="status" value={opportunityForm.status} onChange={onOpportunityFormChange}>
                <option value={1}>Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅР°</option>
                <option value={2}>РќР° РјРѕРґРµСЂР°С†РёРё</option>
                <option value={3}>РђРєС‚РёРІРЅР°</option>
                <option value={4}>Р—Р°РєСЂС‹С‚Р°</option>
                <option value={5}>РћС‚РјРµРЅРµРЅР°</option>
                <option value={6}>РћС‚РєР»РѕРЅРµРЅР°</option>
                <option value={7}>Р’ Р°СЂС…РёРІРµ</option>
              </select>
            </label>
            <label>
              Р“РѕСЂРѕРґ
              <select name="cityId" value={opportunityForm.cityId} onChange={onOpportunityFormChange}>
                <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Р›РѕРєР°С†РёСЏ
              <select name="locationId" value={opportunityForm.locationId} onChange={onOpportunityFormChange} disabled={!opportunityForm.cityId}>
                <option value="">РќРµ РІС‹Р±СЂР°РЅР°</option>
                {opportunityLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationOptionLabel(location)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              РўРёРї С†РµРЅС‹
              <select name="priceType" value={opportunityForm.priceType} onChange={onOpportunityFormChange}>
                <option value={1}>Р‘РµСЃРїР»Р°С‚РЅРѕ</option>
                <option value={2}>РџР»Р°С‚РЅРѕ</option>
                <option value={3}>РџСЂРёР·</option>
              </select>
            </label>
            <label>
              РЎСѓРјРјР°
              <input name="priceAmount" type="number" min={0} step="0.01" value={opportunityForm.priceAmount} onChange={onOpportunityFormChange} />
            </label>
            <label>
              Р’Р°Р»СЋС‚Р°
              <input name="priceCurrencyCode" type="text" value={opportunityForm.priceCurrencyCode} onChange={onOpportunityFormChange} maxLength={3} />
            </label>
            <label className="employer-checkbox">
              <input
                type="checkbox"
                name="participantsCanWrite"
                checked={opportunityForm.participantsCanWrite}
                onChange={onOpportunityFormChange}
              />
              РЈС‡Р°СЃС‚РЅРёРєРё РјРѕРіСѓС‚ РїРёСЃР°С‚СЊ РІ С‡Р°С‚
            </label>
            <label>
              Р”Р°С‚Р° СЃРѕР±С‹С‚РёСЏ
              <DateInput name="eventDate" type="datetime-local" value={opportunityForm.eventDate} onChange={onOpportunityFormChange} />
            </label>
            <label>
              РўРµРіРё
              <TagPicker
                options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
                selectedIds={opportunityForm.tagIds}
                onChange={onOpportunityTagsChange}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyMessage="No tags found"
              />
            </label>
            <button type="submit" className="btn btn--secondary" disabled={!company || creatingOpportunity}>
              {creatingOpportunity ? (editingOpportunityId ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РЎРѕР·РґР°РµРј...') : editingOpportunityId ? 'РЎРѕС…СЂР°РЅРёС‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ' : 'РЎРѕР·РґР°С‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ'}
            </button>
            {editingOpportunityId ? (
              <button type="button" className="btn btn--ghost" onClick={onCancelOpportunityEdit} disabled={creatingOpportunity}>
                РћС‚РјРµРЅРёС‚СЊ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ
              </button>
            ) : null}
          </form>
        </div>
              </section> : null}

              {tab === 'opportunities' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РњРѕРё РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё</h2>
        <div className="employer-opportunity-filters">
          <label>
            РџРѕРёСЃРє
            <input
              type="text"
              value={opportunitySearch}
              onChange={(event) => setOpportunitySearch(event.target.value)}
              placeholder="РќР°Р·РІР°РЅРёРµ, Р»РѕРєР°С†РёСЏ РёР»Рё С‚РµРі"
            />
          </label>
          <div className="employer-opportunity-filters__row">
            <button type="button" className={`btn btn--ghost ${opportunitySourceFilter === 'all' ? 'is-active' : ''}`} onClick={() => setOpportunitySourceFilter('all')}>
              Р’СЃРµ
            </button>
            <button
              type="button"
              className={`btn btn--ghost ${opportunitySourceFilter === 'vacancy' ? 'is-active' : ''}`}
              onClick={() => setOpportunitySourceFilter('vacancy')}
            >
              Р’Р°РєР°РЅСЃРёРё
            </button>
            <button
              type="button"
              className={`btn btn--ghost ${opportunitySourceFilter === 'opportunity' ? 'is-active' : ''}`}
              onClick={() => setOpportunitySourceFilter('opportunity')}
            >
              РњРµСЂРѕРїСЂРёСЏС‚РёСЏ
            </button>
          </div>
          <div className="employer-opportunity-filters__row">
            <button
              type="button"
              className={`btn btn--ghost ${publishStatusGroupValues.planned.every((status) => opportunityStatusesFilter.includes(status)) ? 'is-active' : ''}`}
              onClick={() => toggleOpportunityStatusGroup([...publishStatusGroupValues.planned])}
            >
              Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹Рµ
            </button>
            <button
              type="button"
              className={`btn btn--ghost ${publishStatusGroupValues.active.every((status) => opportunityStatusesFilter.includes(status)) ? 'is-active' : ''}`}
              onClick={() => toggleOpportunityStatusGroup([...publishStatusGroupValues.active])}
            >
              РђРєС‚РёРІРЅС‹Рµ
            </button>
            <button
              type="button"
              className={`btn btn--ghost ${publishStatusGroupValues.closed.every((status) => opportunityStatusesFilter.includes(status)) ? 'is-active' : ''}`}
              onClick={() => toggleOpportunityStatusGroup([...publishStatusGroupValues.closed])}
            >
              Р—Р°РєСЂС‹С‚С‹Рµ
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetOpportunityFilters} disabled={!hasOpportunityFilters}>
              РЎР±СЂРѕСЃ
            </button>
          </div>
        </div>
        {!filteredOpportunities.length ? (
          <p>{hasOpportunityFilters ? 'РџРѕ С‚РµРєСѓС‰РёРј С„РёР»СЊС‚СЂР°Рј РЅРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ.' : 'РЈ РєРѕРјРїР°РЅРёРё РїРѕРєР° РЅРµС‚ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹С… РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№.'}</p>
        ) : (
          <div className="favorite-list">
            {filteredOpportunities.map((item) => (
              <article key={`${item.source}-${item.id}`} className="favorite-card">
                <div className="favorite-card__head">
                  <div>
                    <h3>{item.title}</h3>
                    <span className="favorite-card__salary">{item.compensationLabel}</span>
                  </div>
                  <span className="status-chip">{employerOpportunityStatusLabel[item.status] ?? `Status ${item.status}`}</span>
                </div>
                <div className="favorite-card__meta">
                  <span>{opportunityTypeLabel(item.type)}</span>
                  <span>
                    <MapPin size={14} />
                    {item.locationName}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    РџСѓР±Р»РёРєР°С†РёСЏ: {formatDate(item.publishAt)}
                  </span>
                </div>
                {item.tags.length ? <p>{item.tags.slice(0, 6).join(', ')}</p> : null}
                <div className="favorite-card__actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => void onEditOpportunity(item)}
                    disabled={loadingOpportunityEditorKey === `${item.source}-${item.id}` || deletingOpportunityKey === `${item.source}-${item.id}`}
                  >
                    {loadingOpportunityEditorKey === `${item.source}-${item.id}` ? 'Р—Р°РіСЂСѓР·РєР°...' : 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void onDeleteOpportunity(item)}
                    disabled={deletingOpportunityKey === `${item.source}-${item.id}` || loadingOpportunityEditorKey === `${item.source}-${item.id}`}
                  >
                    {deletingOpportunityKey === `${item.source}-${item.id}` ? 'РЈРґР°Р»СЏРµРј...' : 'РЈРґР°Р»РёС‚СЊ'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section> : null}

              {tab === 'applications' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РћС‚РєР»РёРєРё</h2>
        {applications.length ? (
          <div className="employer-applications-toolbar">
            <label>
              РџРѕРёСЃРє
              <input
                type="text"
                value={applicationSearch}
                onChange={(event) => setApplicationSearch(event.target.value)}
                placeholder="Р’Р°РєР°РЅСЃРёСЏ, РєР°РЅРґРёРґР°С‚ РёР»Рё СЃС‚Р°С‚СѓСЃ"
              />
            </label>
            <div className="employer-applications-toolbar__chips">
              <button
                type="button"
                className={`btn btn--ghost ${applicationStatusGroupValues.new.every((status) => applicationStatusesFilter.includes(status)) ? 'is-active' : ''}`}
                onClick={() => toggleApplicationStatusGroup([...applicationStatusGroupValues.new])}
              >
                РќРѕРІС‹Рµ
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${applicationStatusGroupValues.progress.every((status) => applicationStatusesFilter.includes(status)) ? 'is-active' : ''}`}
                onClick={() => toggleApplicationStatusGroup([...applicationStatusGroupValues.progress])}
              >
                Р’ СЂР°Р±РѕС‚Рµ
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${applicationStatusGroupValues.closed.every((status) => applicationStatusesFilter.includes(status)) ? 'is-active' : ''}`}
                onClick={() => toggleApplicationStatusGroup([...applicationStatusGroupValues.closed])}
              >
                Р—Р°РєСЂС‹С‚С‹Рµ
              </button>
              {availableApplicationStatuses.map((status) => (
                <button
                  key={`application-status-${status}`}
                  type="button"
                  className={`btn btn--ghost ${applicationStatusesFilter.includes(status) ? 'is-active' : ''}`}
                  onClick={() => toggleApplicationStatusGroup([status])}
                >
                  {applicationStatusLabel[status] ?? `РЎС‚Р°С‚СѓСЃ ${status}`}
                </button>
              ))}
              <button type="button" className="btn btn--ghost" onClick={resetApplicationFilters} disabled={!hasApplicationFilters}>
                РЎР±СЂРѕСЃ
              </button>
            </div>
          </div>
        ) : null}
        {!applications.length ? (
          <p>РћС‚РєР»РёРєРѕРІ РїРѕРєР° РЅРµС‚.</p>
        ) : !filteredApplications.length ? (
          <p>РџРѕ С‚РµРєСѓС‰РёРј С„РёР»СЊС‚СЂР°Рј РѕС‚РєР»РёРєРё РЅРµ РЅР°Р№РґРµРЅС‹.</p>
        ) : (
          <div className="employer-applications-list">
            {filteredApplications.map((application) => (
              <article key={application.id} className="employer-application-card">
                <div className="employer-application-card__head">
                  <h3>{application.vacancyTitle}</h3>
                  <span className={`status-chip status-chip--${applicationStatusTone[application.status] ?? 'warning'}`}>
                    {applicationStatusLabel[application.status] ?? `РЎС‚Р°С‚СѓСЃ ${application.status}`}
                  </span>
                </div>
                <div className="employer-application-card__meta">
                  <MessageSquare size={14} />
                  <button
                    type="button"
                    className="employer-application-card__candidate-link"
                    onClick={() => void onGoToCandidateProfile(application.id)}
                    disabled={loadingApplicationDetailId === application.id}
                  >
                    {application.candidateName}
                  </button>
                  <span>РћС‚РєР»РёРє: {formatDate(application.createdAt)}</span>
                  <span>РћР±РЅРѕРІР»РµРЅРѕ: {formatDate(application.updatedAt)}</span>
                </div>
                <div className="employer-application-actions">
                  <div className="employer-application-actions__steps">
                    {applicationStatusTransitions[application.status]?.length ? (
                      applicationStatusTransitions[application.status].map((status) => (
                        <button
                          key={`application-${application.id}-status-${status}`}
                          type="button"
                          className="btn btn--secondary"
                          disabled={updatingApplicationId === application.id}
                          onClick={() => void onUpdateApplicationStatus(application, status)}
                        >
                          {updatingApplicationId === application.id ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : applicationStatusLabel[status]}
                        </button>
                      ))
                    ) : (
                      <span className="employer-application-actions__hint">РЎС‚Р°С‚СѓСЃ С„РёРЅР°Р»СЊРЅС‹Р№</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => void onOpenApplicationDetail(application.id)}
                    disabled={loadingApplicationDetailId === application.id}
                  >
                    {loadingApplicationDetailId === application.id ? 'Р—Р°РіСЂСѓР¶Р°РµРј...' : 'РџСЂРѕС„РёР»СЊ РєР°РЅРґРёРґР°С‚Р°'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {selectedApplicationDetail ? (
          <div className="employer-candidate-profile-modal" role="dialog" aria-modal="true" aria-label="РџСЂРѕС„РёР»СЊ РєР°РЅРґРёРґР°С‚Р°">
            <button
              type="button"
              className="employer-candidate-profile-modal__backdrop"
              aria-label="Р—Р°РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ РєР°РЅРґРёРґР°С‚Р°"
              onClick={() => setSelectedApplicationDetail(null)}
            />
            <article className="card employer-candidate-profile employer-candidate-profile-modal__dialog">
            <div className="employer-candidate-profile__head">
              <div>
                <h3>{selectedApplicationDetail.candidateName}</h3>
                <p className="employer-candidate-profile__subtitle">РћС‚РєР»РёРє РЅР°: {selectedApplicationDetail.vacancyTitle}</p>
              </div>
              <span className={`status-chip status-chip--${applicationStatusTone[selectedApplicationDetail.status] ?? 'warning'}`}>
                {applicationStatusLabel[selectedApplicationDetail.status] ?? `РЎС‚Р°С‚СѓСЃ ${selectedApplicationDetail.status}`}
              </span>
            </div>

            {selectedCandidateResume ? (
              <div className="employer-candidate-profile__grid employer-candidate-profile__grid--resume">
                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <div className="employer-candidate-profile__summary">
                    <div className="employer-candidate-profile__avatar">
                      {selectedCandidateResume.avatarUrl ? (
                        <img src={selectedCandidateResume.avatarUrl} alt={selectedApplicationDetail.candidateName} />
                      ) : (
                        <span>{selectedApplicationDetail.candidateName.charAt(0)}</span>
                      )}
                    </div>
                    <div className="employer-candidate-profile__summary-copy">
                      <strong>{selectedApplicationDetail.candidateName}</strong>
                      <p>@{selectedCandidateResume.username}</p>
                      <p>{selectedCandidateResume.headline || 'Р—Р°РіРѕР»РѕРІРѕРє СЂРµР·СЋРјРµ РЅРµ СѓРєР°Р·Р°РЅ'}</p>
                      <div className="employer-candidate-profile__chips">
                        <span className={`status-chip status-chip--${selectedCandidateResume.openToWork ? 'success' : 'warning'}`}>
                          {selectedCandidateResume.openToWork ? 'РћС‚РєСЂС‹С‚ Рє СЂР°Р±РѕС‚Рµ' : 'РќРµ РёС‰РµС‚ СЂР°Р±РѕС‚Сѓ'}
                        </span>
                        <span className="status-chip">ID: {selectedCandidateResume.userId}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="employer-candidate-profile__section">
                  <strong>Р›РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ</strong>
                  <div className="employer-candidate-profile__facts">
                    <p>
                      <span>Р¤РРћ</span>
                      <strong>
                        {selectedCandidateResume.lastName} {selectedCandidateResume.firstName} {selectedCandidateResume.middleName || ''}
                      </strong>
                    </p>
                    <p>
                      <span>Р”Р°С‚Р° СЂРѕР¶РґРµРЅРёСЏ</span>
                      <strong>{formatDateOnly(selectedCandidateResume.birthDate)}</strong>
                    </p>
                    <p>
                      <span>РџРѕР»</span>
                      <strong>{genderLabel(selectedCandidateResume.gender)}</strong>
                    </p>
                    <p>
                      <span>РўРµР»РµС„РѕРЅ</span>
                      <strong>{selectedCandidateResume.phone || 'РќРµ СѓРєР°Р·Р°РЅ'}</strong>
                    </p>
                    <p>
                      <span>Рћ СЃРµР±Рµ</span>
                      <strong>{selectedCandidateResume.about || 'РќРµ Р·Р°РїРѕР»РЅРµРЅРѕ'}</strong>
                    </p>
                  </div>
                </div>

                <div className="employer-candidate-profile__section">
                  <strong>Р РµР·СЋРјРµ</strong>
                  <div className="employer-candidate-profile__facts">
                    <p>
                      <span>Р–РµР»Р°РµРјР°СЏ РґРѕР»Р¶РЅРѕСЃС‚СЊ</span>
                      <strong>{selectedCandidateResume.desiredPosition || 'РќРµ СѓРєР°Р·Р°РЅР°'}</strong>
                    </p>
                    <p>
                      <span>РЎСѓРјРјР°СЂРЅС‹Р№ Р·Р°РіРѕР»РѕРІРѕРє</span>
                      <strong>{selectedCandidateResume.headline || 'РќРµ СѓРєР°Р·Р°РЅ'}</strong>
                    </p>
                    <p>
                      <span>РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ</span>
                      <strong>{selectedCandidateResume.summary || 'РќРµ Р·Р°РїРѕР»РЅРµРЅРѕ'}</strong>
                    </p>
                    <p>
                      <span>РћР¶РёРґР°РЅРёСЏ РїРѕ РґРѕС…РѕРґСѓ</span>
                      <strong>{formatMoneyRange(selectedCandidateResume.salaryFrom, selectedCandidateResume.salaryTo, selectedCandidateResume.currencyCode)}</strong>
                    </p>
                    <p>
                      <span>Р”Р°С‚Р° РѕС‚РєР»РёРєР°</span>
                      <strong>{formatDate(selectedApplicationDetail.createdAt)}</strong>
                    </p>
                    <p>
                      <span>РћР±РЅРѕРІР»РµРЅРѕ</span>
                      <strong>{formatDate(selectedApplicationDetail.updatedAt)}</strong>
                    </p>
                  </div>
                </div>

                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <strong>РќР°РІС‹РєРё</strong>
                  {selectedCandidateResume.skills.length ? (
                    <div className="employer-candidate-profile__list">
                      {selectedCandidateResume.skills.map((skill) => (
                        <article key={skill.tagId} className="employer-candidate-profile__list-item">
                          <div className="employer-candidate-profile__list-item-head">
                            <strong>{skill.tagName}</strong>
                            <span>{formatSkillLevel(skill.level)}</span>
                          </div>
                          <p>{formatYearsExperience(skill.yearsExperience)}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>РќР°РІС‹РєРё РЅРµ СѓРєР°Р·Р°РЅС‹.</p>
                  )}
                </div>

                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <strong>РћРїС‹С‚ СЂР°Р±РѕС‚С‹</strong>
                  {selectedCandidateResume.experiences.length ? (
                    <div className="employer-candidate-profile__list">
                      {selectedCandidateResume.experiences.map((experience) => (
                        <article key={experience.id} className="employer-candidate-profile__list-item">
                          <div className="employer-candidate-profile__list-item-head">
                            <strong>{experience.position}</strong>
                            <span>{experience.companyName}</span>
                          </div>
                          <p>
                            {formatDateOnly(experience.startDate)} - {experience.isCurrent ? 'РїРѕ РЅР°СЃС‚РѕСЏС‰РµРµ РІСЂРµРјСЏ' : formatDateOnly(experience.endDate)}
                          </p>
                          <p>{experience.description || 'РћРїРёСЃР°РЅРёРµ РЅРµ Р·Р°РїРѕР»РЅРµРЅРѕ'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>РћРїС‹С‚ СЂР°Р±РѕС‚С‹ РЅРµ СѓРєР°Р·Р°РЅ.</p>
                  )}
                </div>

                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <strong>РџСЂРѕРµРєС‚С‹</strong>
                  {selectedCandidateResume.projects.length ? (
                    <div className="employer-candidate-profile__list">
                      {selectedCandidateResume.projects.map((project) => (
                        <article key={project.id} className="employer-candidate-profile__list-item">
                          <div className="employer-candidate-profile__list-item-head">
                            <strong>{project.title}</strong>
                            <span>{formatProjectPeriod(project.startDate, project.endDate)}</span>
                          </div>
                          <p>{project.role || 'Р РѕР»СЊ РЅРµ СѓРєР°Р·Р°РЅР°'}</p>
                          <p>{project.description || 'РћРїРёСЃР°РЅРёРµ РЅРµ Р·Р°РїРѕР»РЅРµРЅРѕ'}</p>
                          <div className="employer-candidate-profile__links">
                            {project.repoUrl ? (
                              <a href={project.repoUrl} target="_blank" rel="noreferrer">
                                Р РµРїРѕР·РёС‚РѕСЂРёР№
                              </a>
                            ) : null}
                            {project.demoUrl ? (
                              <a href={project.demoUrl} target="_blank" rel="noreferrer">
                                Р”РµРјРѕ
                              </a>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>РџСЂРѕРµРєС‚С‹ РЅРµ СѓРєР°Р·Р°РЅС‹.</p>
                  )}
                </div>

                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <strong>РћР±СЂР°Р·РѕРІР°РЅРёРµ</strong>
                  {selectedCandidateResume.education.length ? (
                    <div className="employer-candidate-profile__list">
                      {selectedCandidateResume.education.map((item) => (
                        <article key={item.id} className="employer-candidate-profile__list-item">
                          <div className="employer-candidate-profile__list-item-head">
                            <strong>{item.university}</strong>
                            <span>{item.graduationYear || 'Р“РѕРґ РІС‹РїСѓСЃРєР° РЅРµ СѓРєР°Р·Р°РЅ'}</span>
                          </div>
                          <p>{item.faculty || 'Р¤Р°РєСѓР»СЊС‚РµС‚ РЅРµ СѓРєР°Р·Р°РЅ'}</p>
                          <p>{item.specialty || 'РЎРїРµС†РёР°Р»СЊРЅРѕСЃС‚СЊ РЅРµ СѓРєР°Р·Р°РЅР°'}</p>
                          <p>РљСѓСЂСЃ: {item.course || 'РќРµ СѓРєР°Р·Р°РЅ'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>РћР±СЂР°Р·РѕРІР°РЅРёРµ РЅРµ СѓРєР°Р·Р°РЅРѕ.</p>
                  )}
                </div>

                <div className="employer-candidate-profile__section employer-candidate-profile__section--wide">
                  <strong>РЎСЃС‹Р»РєРё</strong>
                  {selectedCandidateResume.links.length ? (
                    <div className="employer-candidate-profile__links-list">
                      {selectedCandidateResume.links.map((link) => (
                        <a
                          key={link.id}
                          className="employer-candidate-profile__link"
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{formatLinkLabel(link.kind, link.label)}</span>
                          <small>{link.url}</small>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p>РЎСЃС‹Р»РєРё РЅРµ СѓРєР°Р·Р°РЅС‹.</p>
                  )}
                </div>
              </div>
            ) : (
              <p>РЈ РєР°РЅРґРёРґР°С‚Р° РїРѕРєР° РЅРµС‚ Р·Р°РїРѕР»РЅРµРЅРЅРѕРіРѕ СЂРµР·СЋРјРµ.</p>
            )}

            <div className="employer-candidate-profile__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setSelectedApplicationDetail(null)}>
                Р—Р°РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ
              </button>
            </div>
            </article>
          </div>
        ) : null}
      </section> : null}

              {tab === 'overview' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РђРЅР°Р»РёС‚РёРєР°</h2>
        <div className="employer-analytics">
          <article>
            <strong>{applicationChats.length}</strong>
            <span>Р’СЃРµРіРѕ С‡Р°С‚РѕРІ</span>
          </article>
          <article>
            <strong>{applications.length}</strong>
            <span>Р’СЃРµРіРѕ РѕС‚РєР»РёРєРѕРІ</span>
          </article>
          <article>
            <strong>{applications.filter((item) => item.status === 1 || item.status === 2).length}</strong>
            <span>Р’ СЂР°Р±РѕС‚Рµ</span>
          </article>
        </div>
              </section> : null}

              {tab === 'verification' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>Р’РµСЂРёС„РёРєР°С†РёСЏ</h2>
        <div className="employer-verification">
          <div className="employer-verification__status">
            <span className={`status-chip status-chip--${companyStatusToneClass}`}>
              <ShieldCheck size={14} />
              {companyStatusText}
            </span>
            <p>Р—Р°РїРѕР»РЅРёС‚Рµ РїСЂРѕС„РёР»СЊ, Р·Р°РіСЂСѓР·РёС‚Рµ РґРѕРєСѓРјРµРЅС‚С‹ Рё РѕС‚РїСЂР°РІСЊС‚Рµ РЅР° РїСЂРѕРІРµСЂРєСѓ.</p>
          </div>

          {verificationProfile ? (
            <form className="form-grid" onSubmit={onSaveVerificationProfile}>
              <label>
                Employer type
                <select name="employerType" value={verificationProfile.employerType} onChange={onVerificationProfileChange}>
                  <option value={1}>LegalEntity</option>
                  <option value={2}>IndividualEntrepreneur</option>
                  <option value={3}>SelfEmployed</option>
                  <option value={4}>RecruitmentAgency</option>
                  <option value={5}>PrivateRecruiter</option>
                  <option value={6}>PrivatePerson</option>
                </select>
              </label>
              <label>
                OGRN/OGRNIP
                <input name="ogrnOrOgrnip" type="text" value={verificationProfile.ogrnOrOgrnip} onChange={onVerificationProfileChange} />
              </label>
              <label>
                INN
                <input name="inn" type="text" value={verificationProfile.inn} onChange={onVerificationProfileChange} />
              </label>
              <label>
                KPP
                <input name="kpp" type="text" value={verificationProfile.kpp} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Legal address
                <input name="legalAddress" type="text" value={verificationProfile.legalAddress} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Actual address
                <input name="actualAddress" type="text" value={verificationProfile.actualAddress} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Representative name
                <input name="representativeFullName" type="text" value={verificationProfile.representativeFullName} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Representative position
                <input name="representativePosition" type="text" value={verificationProfile.representativePosition} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Industry
                <select name="mainIndustryId" value={verificationProfile.mainIndustryId} onChange={onVerificationProfileChange}>
                  {verificationIndustries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Work email
                <input name="workEmail" type="email" value={verificationProfile.workEmail} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Work phone
                <input name="workPhone" type="text" value={verificationProfile.workPhone} onChange={onVerificationProfileChange} />
              </label>
              <label>
                Public links
                <input name="siteOrPublicLinks" type="text" value={verificationProfile.siteOrPublicLinks} onChange={onVerificationProfileChange} />
              </label>
              <button type="submit" className="btn btn--secondary" disabled={verificationSaving}>
                {verificationSaving ? 'Saving...' : 'Save verification profile'}
              </button>
            </form>
          ) : (
            <p>Verification profile unavailable.</p>
          )}

          <div className="admin-form-card">
            <h3>Required documents</h3>
            {verificationRequirements.length ? (
              <p>{verificationRequirements.filter((item) => item.isRequired).map((item) => `#${item.documentType}`).join(', ')}</p>
            ) : (
              <p>No requirements loaded.</p>
            )}

            <form className="form-grid" onSubmit={onUploadVerificationDocument}>
              <label>
                Document type
                <input
                  type="number"
                  min={1}
                  value={verificationUploadType}
                  onChange={(event) => setVerificationUploadType(Number(event.target.value) || 1)}
                />
              </label>
              <label>
                File
                <input type="file" onChange={(event) => setVerificationUploadFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" className="btn btn--secondary" disabled={verificationSaving || !verificationUploadFile}>
                {verificationSaving ? 'Uploading...' : 'Upload document'}
              </button>
            </form>

            <div className="admin-list-grid">
              {verificationDocuments.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div>
                      <h3>{item.fileName || `Document #${item.id}`}</h3>
                      <p>Type #{item.documentType} | status #{item.status}</p>
                    </div>
                  </div>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--danger" disabled={verificationSaving} onClick={() => void onDeleteVerificationDocument(item.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn--primary" onClick={() => void onSubmitVerification()} disabled={submittingVerification || !company}>
            {submittingVerification ? 'РћС‚РїСЂР°РІР»СЏРµРј...' : 'РћС‚РїСЂР°РІРёС‚СЊ РЅР° РІРµСЂРёС„РёРєР°С†РёСЋ'}
          </button>
        </div>
              </section> : null}

              {tab === 'settings' ? <section className="dashboard-section card seeker-profile-panel">
        <h2>РќР°СЃС‚СЂРѕР№РєРё</h2>
        <div className="employer-verification">
          <form className="form-grid employer-chat-settings" onSubmit={onSaveChatSettings}>
            <div className="employer-chat-settings__head">
              <h3>Р§Р°С‚-РЅР°СЃС‚СЂРѕР№РєРё</h3>
              <p>РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёРµ РѕС‚РІРµС‚С‹ Рё СЂР°Р±РѕС‡РёР№ РіСЂР°С„РёРє РєРѕРјРїР°РЅРёРё.</p>
            </div>

            <label className="employer-chat-settings__switch">
              <input
                type="checkbox"
                name="autoGreetingEnabled"
                checked={chatSettingsForm.autoGreetingEnabled}
                onChange={onChatSettingsChange}
              />
              <span>
                <strong>Р’РєР»СЋС‡РёС‚СЊ Р°РІС‚Рѕ-РїСЂРёРІРµС‚СЃС‚РІРёРµ</strong>
                <small>РљР°РЅРґРёРґР°С‚ СЃСЂР°Р·Сѓ РїРѕР»СѓС‡Р°РµС‚ РїСЂРёРІРµС‚СЃС‚РІРµРЅРЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ.</small>
              </span>
            </label>
            <label>
              РўРµРєСЃС‚ Р°РІС‚Рѕ-РїСЂРёРІРµС‚СЃС‚РІРёСЏ
              <textarea name="autoGreetingText" rows={3} value={chatSettingsForm.autoGreetingText} onChange={onChatSettingsChange} />
            </label>

            <label className="employer-chat-settings__switch">
              <input
                type="checkbox"
                name="outsideHoursEnabled"
                checked={chatSettingsForm.outsideHoursEnabled}
                onChange={onChatSettingsChange}
              />
              <span>
                <strong>РћС‚РІРµС‡Р°С‚СЊ РІРЅРµ СЂР°Р±РѕС‡РµРіРѕ РІСЂРµРјРµРЅРё</strong>
                <small>Р•СЃР»Рё РѕС„РёСЃ Р·Р°РєСЂС‹С‚, РєР°РЅРґРёРґР°С‚Сѓ СѓР№РґРµС‚ СЃР»СѓР¶РµР±РЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ.</small>
              </span>
            </label>
            <label>
              РЎРѕРѕР±С‰РµРЅРёРµ РІРЅРµ СЂР°Р±РѕС‡РµРіРѕ РІСЂРµРјРµРЅРё
              <textarea name="outsideHoursText" rows={3} value={chatSettingsForm.outsideHoursText} onChange={onChatSettingsChange} />
            </label>

            <div className="employer-chat-settings__hours">
              <label>
                РўР°Р№РјР·РѕРЅР°
                <input name="workingHoursTimezone" type="text" value={chatSettingsForm.workingHoursTimezone} onChange={onChatSettingsChange} />
              </label>
              <label>
                РќР°С‡Р°Р»Рѕ СЂР°Р±РѕС‡РµРіРѕ РґРЅСЏ
                <input name="workingHoursFrom" type="time" value={chatSettingsForm.workingHoursFrom} onChange={onChatSettingsChange} />
              </label>
              <label>
                РљРѕРЅРµС† СЂР°Р±РѕС‡РµРіРѕ РґРЅСЏ
                <input name="workingHoursTo" type="time" value={chatSettingsForm.workingHoursTo} onChange={onChatSettingsChange} />
              </label>
            </div>

            <button type="submit" className="btn btn--secondary employer-chat-settings__submit" disabled={savingChatSettings || !company}>
              {savingChatSettings ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РЎРѕС…СЂР°РЅРёС‚СЊ С‡Р°С‚-РЅР°СЃС‚СЂРѕР№РєРё'}
            </button>
          </form>

          <section className="admin-form-card">
            <h3>РџСѓР±Р»РёС‡РЅС‹Рµ СЃСЃС‹Р»РєРё РєРѕРјРїР°РЅРёРё</h3>
            <form className="form-grid" onSubmit={onSaveCompanyLink}>
              <label>
                РўРёРї СЃСЃС‹Р»РєРё
                <select name="linkKind" value={companyLinkForm.linkKind} onChange={onCompanyLinkFormChange}>
                  {companyLinkKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                URL
                <input name="url" type="url" value={companyLinkForm.url} onChange={onCompanyLinkFormChange} placeholder="https://example.com" required />
              </label>
              <label>
                РџРѕРґРїРёСЃСЊ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
                <input name="label" type="text" value={companyLinkForm.label} onChange={onCompanyLinkFormChange} />
              </label>
              <div className="favorite-card__actions">
                <button type="submit" className="btn btn--primary" disabled={!company || savingCompanyLink}>
                  {savingCompanyLink ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : editingCompanyLinkId ? 'РћР±РЅРѕРІРёС‚СЊ СЃСЃС‹Р»РєСѓ' : 'Р”РѕР±Р°РІРёС‚СЊ СЃСЃС‹Р»РєСѓ'}
                </button>
                {editingCompanyLinkId ? (
                  <button type="button" className="btn btn--ghost" onClick={onCancelCompanyLinkEdit} disabled={savingCompanyLink}>
                    РћС‚РјРµРЅР° РёР·РјРµРЅРµРЅРёР№
                  </button>
                ) : null}
              </div>
            </form>

            <div className="admin-list-grid">
              {companyLinks.length ? (
                companyLinks.map((link) => (
                  <article key={link.id} className="admin-form-card admin-list-card">
                    <div>
                      <strong>{formatLinkLabel(companyLinkKindLabel[link.linkKind] ?? 'Link', link.label)}</strong>
                      <p>{link.url || 'URL РЅРµ СѓРєР°Р·Р°РЅ'}</p>
                    </div>
                    <div className="favorite-card__actions">
                      {link.url ? (
                        <a className="btn btn--ghost" href={link.url} target="_blank" rel="noreferrer">
                          РћС‚РєСЂС‹С‚СЊ
                        </a>
                      ) : null}
                      <button type="button" className="btn btn--secondary" onClick={() => onEditCompanyLink(link)} disabled={savingCompanyLink || deletingCompanyLinkId === link.id}>
                        Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void onDeleteCompanyLink(link.id)}
                        disabled={deletingCompanyLinkId === link.id || savingCompanyLink}
                      >
                        {deletingCompanyLinkId === link.id ? 'РЈРґР°Р»СЏРµРј...' : 'РЈРґР°Р»РёС‚СЊ'}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>РЎСЃС‹Р»РєРё РєРѕРјРїР°РЅРёРё РїРѕРєР° РЅРµ РґРѕР±Р°РІР»РµРЅС‹.</p>
              )}
            </div>
          </section>
        </div>
              </section> : null}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}

