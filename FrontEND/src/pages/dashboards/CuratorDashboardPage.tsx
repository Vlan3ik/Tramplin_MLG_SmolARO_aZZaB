import { Building2, CheckCircle2, FileWarning, ShieldCheck, Users } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
/* eslint-disable no-irregular-whitespace */
import {
  createAdminCompany,
  createAdminUser,
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminOpportunities,
  fetchAdminUsers,
  fetchAdminVacancies,
  rejectAdminCompany,
  updateAdminCompany,
  updateAdminUser,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminUser,
  type AdminUserUpsertRequest,
  type AdminVacancy,
} from '../../api/admin'
import { fetchCities } from '../../api/catalog'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import type { City } from '../../types/catalog'

type AdminTabId = 'overview' | 'users' | 'companies' | 'vacancies' | 'opportunities'

const adminTabs: Array<{ id: AdminTabId; label: string }> = [
  { id: 'overview', label: 'РћР±Р·РѕСЂ' },
  { id: 'users', label: 'РџРѕР»СЊР·РѕРІР°С‚РµР»Рё' },
  { id: 'companies', label: 'РљРѕРјРїР°РЅРёРё' },
  { id: 'vacancies', label: 'Р’Р°РєР°РЅСЃРёРё' },
  { id: 'opportunities', label: 'РњРµСЂРѕРїСЂРёСЏС‚РёСЏ' },
]

const accountStatusLabel: Record<number, string> = {
  1: 'РђРєС‚РёРІРµРЅ',
  2: 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ',
  3: 'РЈРґР°Р»РµРЅ',
}

const companyStatusLabel: Record<number, string> = {
  1: 'Р§РµСЂРЅРѕРІРёРє',
  2: 'РќР° РІРµСЂРёС„РёРєР°С†РёРё',
  3: 'РџРѕРґС‚РІРµСЂР¶РґРµРЅР°',
  4: 'РћС‚РєР»РѕРЅРµРЅР°',
  5: 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР°',
}

const moderationStatusLabel: Record<number, string> = {
  1: 'Р§РµСЂРЅРѕРІРёРє',
  2: 'РќР° РјРѕРґРµСЂР°С†РёРё',
  3: 'РђРєС‚РёРІРЅРѕ',
  4: 'Р—Р°РІРµСЂС€РµРЅРѕ',
  5: 'РћС‚РјРµРЅРµРЅРѕ',
  6: 'РћС‚РєР»РѕРЅРµРЅРѕ',
  7: 'РђСЂС…РёРІ',
}

const workFormatLabel: Record<number, string> = {
  1: 'РћС„РёСЃ',
  2: 'Р“РёР±СЂРёРґ',
  3: 'РЈРґР°Р»РµРЅРЅРѕ',
}

const opportunityKindLabel: Record<number, string> = {
  1: 'РҐР°РєР°С‚РѕРЅ',
  2: 'Р”РµРЅСЊ РѕС‚РєСЂС‹С‚С‹С… РґРІРµСЂРµР№',
  3: 'Р›РµРєС†РёСЏ',
  4: 'Р”СЂСѓРіРѕРµ',
}

const vacancyKindLabel: Record<number, string> = {
  1: 'РЎС‚Р°Р¶РёСЂРѕРІРєР°',
  2: 'Р Р°Р±РѕС‚Р°',
}

function parseNamesFromUsername(username: string) {
  const chunks = username.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: chunks[0] ?? 'User',
    lastName: chunks[1] ?? 'Name',
  }
}

export function CuratorDashboardPage() {
  const [tab, setTab] = useState<AdminTabId>('overview')
  const [cities, setCities] = useState<City[]>([])

  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([])
  const [opportunities, setOpportunities] = useState<AdminOpportunity[]>([])

  const [usersTotal, setUsersTotal] = useState(0)
  const [companiesTotal, setCompaniesTotal] = useState(0)
  const [vacanciesTotal, setVacanciesTotal] = useState(0)
  const [opportunitiesTotal, setOpportunitiesTotal] = useState(0)

  const [usersSearch, setUsersSearch] = useState('')
  const [companiesSearch, setCompaniesSearch] = useState('')
  const [vacanciesSearch, setVacanciesSearch] = useState('')
  const [opportunitiesSearch, setOpportunitiesSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [savingUser, setSavingUser] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [processingCompanyId, setProcessingCompanyId] = useState<number | null>(null)
  const [processingVacancyId, setProcessingVacancyId] = useState<number | null>(null)

  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userForm, setUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    status: 1,
    seeker: false,
    employer: true,
    curator: false,
  })

  const [companyForm, setCompanyForm] = useState({
    legalName: '',
    brandName: '',
    legalType: 1,
    taxId: '',
    registrationNumber: '',
    industry: '',
    description: '',
    baseCityId: '',
    websiteUrl: '',
    publicEmail: '',
    publicPhone: '',
    status: 2,
  })

  async function loadUsers() {
    const response = await fetchAdminUsers({ page: 1, pageSize: 30, search: usersSearch })
    setUsers(response.items)
    setUsersTotal(response.totalCount)
  }

  async function loadCompanies() {
    const response = await fetchAdminCompanies({ page: 1, pageSize: 30, search: companiesSearch })
    setCompanies(response.items)
    setCompaniesTotal(response.totalCount)
  }

  async function loadVacancies() {
    const response = await fetchAdminVacancies({ page: 1, pageSize: 30, search: vacanciesSearch })
    setVacancies(response.items)
    setVacanciesTotal(response.totalCount)
  }

  async function loadOpportunities() {
    const response = await fetchAdminOpportunities({ page: 1, pageSize: 30, search: opportunitiesSearch })
    setOpportunities(response.items)
    setOpportunitiesTotal(response.totalCount)
  }

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.allSettled([fetchCities(), loadUsers(), loadCompanies(), loadVacancies(), loadOpportunities()])
      .then((results) => {
        if (!active) return

        const [citiesResult] = results
        if (citiesResult.status === 'fulfilled') {
          setCities(citiesResult.value)
        }

        const failed = results.find((item) => item.status === 'rejected')
        if (failed?.status === 'rejected') {
          setError(failed.reason instanceof Error ? failed.reason.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєР°Р±РёРЅРµС‚ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const overviewStats = useMemo(
    () => ({
      users: usersTotal,
      companies: companiesTotal,
      moderation: vacanciesTotal + opportunitiesTotal,
      pendingVerification: companies.filter((item) => item.status === 2).length,
    }),
    [companies, companiesTotal, opportunitiesTotal, usersTotal, vacanciesTotal],
  )

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function resetUserForm() {
    setUserForm({
      email: '',
      firstName: '',
      lastName: '',
      status: 1,
      seeker: false,
      employer: true,
      curator: false,
    })
    setEditingUserId(null)
  }

  function resetCompanyForm() {
    setCompanyForm({
      legalName: '',
      brandName: '',
      legalType: 1,
      taxId: '',
      registrationNumber: '',
      industry: '',
      description: '',
      baseCityId: '',
      websiteUrl: '',
      publicEmail: '',
      publicPhone: '',
      status: 2,
    })
    setEditingCompanyId(null)
  }

  function onUserInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const checked = (event.target as HTMLInputElement).checked
    setUserForm((state) => ({
      ...state,
      [name]: type === 'checkbox' ? checked : name === 'status' ? Number(value) : value,
    }))
  }

  function onCompanyInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setCompanyForm((state) => ({
      ...state,
      [name]: name === 'legalType' || name === 'status' ? Number(value) : value,
    }))
  }

  function getUserRolesFromForm() {
    const roles: number[] = []
    if (userForm.seeker) roles.push(1)
    if (userForm.employer) roles.push(2)
    if (userForm.curator) roles.push(3)
    return roles
  }

  async function onSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const roles = getUserRolesFromForm()
    if (!roles.length) {
      setError('Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ СЂРѕР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.')
      return
    }

    const payload: AdminUserUpsertRequest = {
      email: userForm.email,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      status: userForm.status,
      roles,
    }

    setSavingUser(true)
    try {
      if (editingUserId) {
        await updateAdminUser(editingUserId, payload)
        setSuccess('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕР±РЅРѕРІР»РµРЅ.')
      } else {
        await createAdminUser(payload)
        setSuccess('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃРѕР·РґР°РЅ.')
      }
      resetUserForm()
      await loadUsers()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.')
    } finally {
      setSavingUser(false)
    }
  }

  async function onSubmitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const cityId = Number(companyForm.baseCityId)
    if (!Number.isInteger(cityId) || cityId <= 0) {
      setError('Р’С‹Р±РµСЂРёС‚Рµ Р±Р°Р·РѕРІС‹Р№ РіРѕСЂРѕРґ РєРѕРјРїР°РЅРёРё.')
      return
    }

    const payload = {
      legalName: companyForm.legalName,
      brandName: companyForm.brandName,
      legalType: companyForm.legalType,
      taxId: companyForm.taxId,
      registrationNumber: companyForm.registrationNumber,
      industry: companyForm.industry,
      description: companyForm.description,
      baseCityId: cityId,
      websiteUrl: companyForm.websiteUrl,
      publicEmail: companyForm.publicEmail,
      publicPhone: companyForm.publicPhone,
      status: companyForm.status,
    }

    setSavingCompany(true)
    try {
      if (editingCompanyId) {
        await updateAdminCompany(editingCompanyId, payload)
        setSuccess('РљРѕРјРїР°РЅРёСЏ РѕР±РЅРѕРІР»РµРЅР°.')
      } else {
        await createAdminCompany(payload)
        setSuccess('РљРѕРјРїР°РЅРёСЏ СЃРѕР·РґР°РЅР°.')
      }
      resetCompanyForm()
      await loadCompanies()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РєРѕРјРїР°РЅРёСЋ.')
    } finally {
      setSavingCompany(false)
    }
  }

  function onEditUser(item: AdminUser) {
    const names = parseNamesFromUsername(item.username)
    setUserForm({
      email: item.email,
      firstName: names.firstName,
      lastName: names.lastName,
      status: item.status,
      seeker: item.roles.includes('seeker'),
      employer: item.roles.includes('employer'),
      curator: item.roles.includes('curator'),
    })
    setEditingUserId(item.id)
    setTab('users')
    clearMessages()
  }

  function onEditCompany(item: AdminCompany) {
    setCompanyForm({
      legalName: item.legalName,
      brandName: item.brandName,
      legalType: 1,
      taxId: '',
      registrationNumber: '',
      industry: item.industry,
      description: '',
      baseCityId: item.baseCityId > 0 ? String(item.baseCityId) : '',
      websiteUrl: '',
      publicEmail: '',
      publicPhone: '',
      status: item.status,
    })
    setEditingCompanyId(item.id)
    setTab('companies')
    clearMessages()
  }

  async function onDeleteUser(item: AdminUser) {
    if (typeof window !== 'undefined' && !window.confirm(`РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ${item.email}?`)) return
    clearMessages()
    try {
      await deleteAdminUser(item.id)
      if (editingUserId === item.id) resetUserForm()
      setSuccess('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»РµРЅ.')
      await loadUsers()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.')
    }
  }

  async function onDeleteCompany(item: AdminCompany) {
    if (typeof window !== 'undefined' && !window.confirm(`РЈРґР°Р»РёС‚СЊ РєРѕРјРїР°РЅРёСЋ ${item.legalName}?`)) return
    clearMessages()
    try {
      await deleteAdminCompany(item.id)
      if (editingCompanyId === item.id) resetCompanyForm()
      setSuccess('РљРѕРјРїР°РЅРёСЏ СѓРґР°Р»РµРЅР°.')
      await loadCompanies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РєРѕРјРїР°РЅРёСЋ.')
    }
  }

  async function onDeleteVacancy(item: AdminVacancy) {
    if (typeof window !== 'undefined' && !window.confirm(`РЈРґР°Р»РёС‚СЊ РІР°РєР°РЅСЃРёСЋ ${item.title}?`)) return
    clearMessages()
    try {
      await deleteAdminVacancy(item.id)
      setSuccess('Р’Р°РєР°РЅСЃРёСЏ СѓРґР°Р»РµРЅР°.')
      await loadVacancies()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РІР°РєР°РЅСЃРёСЋ.')
    }
  }

  async function onChangeVacancyStatus(item: AdminVacancy, nextStatus: number) {
    if (item.status === nextStatus) return

    clearMessages()
    setProcessingVacancyId(item.id)
    const previousStatus = item.status
    setVacancies((state) => state.map((vacancy) => (vacancy.id === item.id ? { ...vacancy, status: nextStatus } : vacancy)))

    try {
      await updateAdminVacancyStatus(item.id, nextStatus)
      setSuccess('Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р Р†Р В°Р С”Р В°Р Р…РЎРѓР С‘Р С‘ Р С•Р В±Р Р…Р С•Р Р†Р В»Р ВµР Р….')
    } catch (updateError) {
      setVacancies((state) => state.map((vacancy) => (vacancy.id === item.id ? { ...vacancy, status: previousStatus } : vacancy)))
      setError(updateError instanceof Error ? updateError.message : 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р Р†Р В°Р С”Р В°Р Р…РЎРѓР С‘Р С‘.')
    } finally {
      setProcessingVacancyId(null)
    }
  }

  async function onDeleteOpportunity(item: AdminOpportunity) {
    if (typeof window !== 'undefined' && !window.confirm(`РЈРґР°Р»РёС‚СЊ РјРµСЂРѕРїСЂРёСЏС‚РёРµ ${item.title}?`)) return
    clearMessages()
    try {
      await deleteAdminOpportunity(item.id)
      setSuccess('РњРµСЂРѕРїСЂРёСЏС‚РёРµ СѓРґР°Р»РµРЅРѕ.')
      await loadOpportunities()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РјРµСЂРѕРїСЂРёСЏС‚РёРµ.')
    }
  }

  async function onVerifyCompany(item: AdminCompany) {
    clearMessages()
    setProcessingCompanyId(item.id)
    try {
      await verifyAdminCompany(item.id)
      setSuccess('РљРѕРјРїР°РЅРёСЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°.')
      await loadCompanies()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РєРѕРјРїР°РЅРёСЋ.')
    } finally {
      setProcessingCompanyId(null)
    }
  }

  async function onRejectCompany(item: AdminCompany) {
    clearMessages()
    setProcessingCompanyId(item.id)
    try {
      await rejectAdminCompany(item.id)
      setSuccess('РљРѕРјРїР°РЅРёСЏ РѕС‚РєР»РѕРЅРµРЅР°.')
      await loadCompanies()
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєР»РѕРЅРёС‚СЊ РєРѕРјРїР°РЅРёСЋ.')
    } finally {
      setProcessingCompanyId(null)
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-hero admin-profile-hero">
          <div className="seeker-profile-hero__avatar admin-profile-hero__avatar">
            <span>ADM</span>
          </div>
          <div className="seeker-profile-hero__content">
            <h1>РљР°Р±РёРЅРµС‚ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°</h1>
            <p>РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё, РєРѕРјРїР°РЅРёСЏРјРё Рё РјРѕРґРµСЂР°С†РёРµР№ РІР°РєР°РЅСЃРёР№/РјРµСЂРѕРїСЂРёСЏС‚РёР№.</p>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{usersTotal} РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</span>
              <span><Building2 size={14} />{companiesTotal} РєРѕРјРїР°РЅРёР№</span>
              <span><FileWarning size={14} />{vacanciesTotal + opportunitiesTotal} РєР°СЂС‚РѕС‡РµРє</span>
            </div>
          </div>
          <div className="seeker-profile-hero__actions">
            <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>РћР±РЅРѕРІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</button>
            <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>РћР±РЅРѕРІРёС‚СЊ РєРѕРјРїР°РЅРёРё</button>
          </div>
        </section>

        {loading ? <section className="dashboard-section card seeker-profile-panel"><p>Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ РєР°Р±РёРЅРµС‚Р°...</p></section> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}

        <nav className="card seeker-profile-tabs">
          {adminTabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <h2>РћР±Р·РѕСЂ</h2>
            <div className="employer-analytics">
              <article><strong>{overviewStats.users}</strong><span>Р’СЃРµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</span></article>
              <article><strong>{overviewStats.companies}</strong><span>Р’СЃРµРіРѕ РєРѕРјРїР°РЅРёР№</span></article>
              <article><strong>{overviewStats.pendingVerification}</strong><span>Р–РґСѓС‚ РІРµСЂРёС„РёРєР°С†РёРё</span></article>
              <article><strong>{overviewStats.moderation}</strong><span>РљР°СЂС‚РѕС‡РµРє РІ СЃРёСЃС‚РµРјРµ</span></article>
            </div>
          </section>
        ) : null}

        {tab === 'users' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>РџРѕР»СЊР·РѕРІР°С‚РµР»Рё</h2>
              <div className="admin-toolbar">
                <input value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="РџРѕРёСЃРє РїРѕ email/username" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>РќР°Р№С‚Рё</button>
              </div>
            </div>

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitUser}>
              <h3>{editingUserId ? `Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ #${editingUserId}` : 'РЎРѕР·РґР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ'}</h3>
              <label>Email<input type="email" name="email" value={userForm.email} onChange={onUserInputChange} required /></label>
              <label>РРјСЏ<input type="text" name="firstName" value={userForm.firstName} onChange={onUserInputChange} required /></label>
              <label>Р¤Р°РјРёР»РёСЏ<input type="text" name="lastName" value={userForm.lastName} onChange={onUserInputChange} required /></label>
              <label>
                РЎС‚Р°С‚СѓСЃ
                <select name="status" value={userForm.status} onChange={onUserInputChange}>
                  <option value={1}>РђРєС‚РёРІРµРЅ</option>
                  <option value={2}>Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ</option>
                  <option value={3}>РЈРґР°Р»РµРЅ</option>
                </select>
              </label>
              <div className="admin-checkbox-row">
                <label className="employer-checkbox"><input type="checkbox" name="seeker" checked={userForm.seeker} onChange={onUserInputChange} />РЎРѕРёСЃРєР°С‚РµР»СЊ</label>
                <label className="employer-checkbox"><input type="checkbox" name="employer" checked={userForm.employer} onChange={onUserInputChange} />Р Р°Р±РѕС‚РѕРґР°С‚РµР»СЊ</label>
                <label className="employer-checkbox"><input type="checkbox" name="curator" checked={userForm.curator} onChange={onUserInputChange} />РљСѓСЂР°С‚РѕСЂ</label>
              </div>
              <div className="favorite-card__actions">
                <button type="submit" className="btn btn--primary" disabled={savingUser}>
                  {savingUser ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : editingUserId ? 'РћР±РЅРѕРІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ' : 'РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ'}
                </button>
                {editingUserId ? <button type="button" className="btn btn--ghost" onClick={resetUserForm}>РћС‚РјРµРЅРёС‚СЊ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ</button> : null}
              </div>
            </form>

            <div className="admin-list-grid">
              {users.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.email}</h3><p>{item.username}</p></div>
                    <span className="status-chip">{accountStatusLabel[item.status] ?? `РЎС‚Р°С‚СѓСЃ ${item.status}`}</span>
                  </div>
                  <p>Р РѕР»Рё: {item.roles.join(', ') || 'РЅРµ РЅР°Р·РЅР°С‡РµРЅС‹'}</p>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditUser(item)}>Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</button>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteUser(item)}>РЈРґР°Р»РёС‚СЊ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'companies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>РљРѕРјРїР°РЅРёРё</h2>
              <div className="admin-toolbar">
                <input value={companiesSearch} onChange={(event) => setCompaniesSearch(event.target.value)} placeholder="РџРѕРёСЃРє РїРѕ РЅР°Р·РІР°РЅРёСЋ/РёРЅРґСѓСЃС‚СЂРёРё" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>РќР°Р№С‚Рё</button>
              </div>
            </div>

            <form className="form-grid form-grid--two admin-form-card" onSubmit={onSubmitCompany}>
              <h3>{editingCompanyId ? `Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РєРѕРјРїР°РЅРёРё #${editingCompanyId}` : 'РЎРѕР·РґР°РЅРёРµ РєРѕРјРїР°РЅРёРё'}</h3>
              <label>Р®СЂРёРґРёС‡РµСЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ<input name="legalName" value={companyForm.legalName} onChange={onCompanyInputChange} required /></label>
              <label>Р‘СЂРµРЅРґ<input name="brandName" value={companyForm.brandName} onChange={onCompanyInputChange} /></label>
              <label>
                РўРёРї
                <select name="legalType" value={companyForm.legalType} onChange={onCompanyInputChange}>
                  <option value={1}>Р®СЂРёРґРёС‡РµСЃРєРѕРµ Р»РёС†Рѕ</option>
                  <option value={2}>РРџ</option>
                </select>
              </label>
              <label>РРќРќ<input name="taxId" value={companyForm.taxId} onChange={onCompanyInputChange} required /></label>
              <label>Р РµРіРёСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РЅРѕРјРµСЂ<input name="registrationNumber" value={companyForm.registrationNumber} onChange={onCompanyInputChange} required /></label>
              <label>РРЅРґСѓСЃС‚СЂРёСЏ<input name="industry" value={companyForm.industry} onChange={onCompanyInputChange} required /></label>
              <label>
                Р‘Р°Р·РѕРІС‹Р№ РіРѕСЂРѕРґ
                <select name="baseCityId" value={companyForm.baseCityId} onChange={onCompanyInputChange} required>
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ РіРѕСЂРѕРґ</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label>
                РЎС‚Р°С‚СѓСЃ
                <select name="status" value={companyForm.status} onChange={onCompanyInputChange}>
                  <option value={1}>Р§РµСЂРЅРѕРІРёРє</option>
                  <option value={2}>РќР° РІРµСЂРёС„РёРєР°С†РёРё</option>
                  <option value={3}>РџРѕРґС‚РІРµСЂР¶РґРµРЅР°</option>
                  <option value={4}>РћС‚РєР»РѕРЅРµРЅР°</option>
                  <option value={5}>Р—Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР°</option>
                </select>
              </label>
              <label>РЎР°Р№С‚<input name="websiteUrl" value={companyForm.websiteUrl} onChange={onCompanyInputChange} /></label>
              <label>РџСѓР±Р»РёС‡РЅС‹Р№ email<input name="publicEmail" value={companyForm.publicEmail} onChange={onCompanyInputChange} /></label>
              <label>РџСѓР±Р»РёС‡РЅС‹Р№ С‚РµР»РµС„РѕРЅ<input name="publicPhone" value={companyForm.publicPhone} onChange={onCompanyInputChange} /></label>
              <label className="full-width">РћРїРёСЃР°РЅРёРµ<textarea rows={3} name="description" value={companyForm.description} onChange={onCompanyInputChange} required /></label>
              <div className="favorite-card__actions full-width">
                <button type="submit" className="btn btn--primary" disabled={savingCompany}>
                  {savingCompany ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : editingCompanyId ? 'РћР±РЅРѕРІРёС‚СЊ РєРѕРјРїР°РЅРёСЋ' : 'РЎРѕР·РґР°С‚СЊ РєРѕРјРїР°РЅРёСЋ'}
                </button>
                {editingCompanyId ? <button type="button" className="btn btn--ghost" onClick={resetCompanyForm}>РћС‚РјРµРЅРёС‚СЊ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ</button> : null}
              </div>
            </form>

            <div className="admin-list-grid">
              {companies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.brandName || item.legalName}</h3><p>{item.legalName}</p></div>
                    <span className="status-chip">{companyStatusLabel[item.status] ?? `РЎС‚Р°С‚СѓСЃ ${item.status}`}</span>
                  </div>
                  <p>РРЅРґСѓСЃС‚СЂРёСЏ: {item.industry || 'РЅРµ СѓРєР°Р·Р°РЅР°'}</p>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onEditCompany(item)}>Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</button>
                    <button type="button" className="btn btn--ghost" disabled={processingCompanyId === item.id} onClick={() => void onVerifyCompany(item)}>
                      <CheckCircle2 size={14} /> РџРѕРґС‚РІРµСЂРґРёС‚СЊ
                    </button>
                    <button type="button" className="btn btn--ghost" disabled={processingCompanyId === item.id} onClick={() => void onRejectCompany(item)}>
                      <ShieldCheck size={14} /> РћС‚РєР»РѕРЅРёС‚СЊ
                    </button>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteCompany(item)}>РЈРґР°Р»РёС‚СЊ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'vacancies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Р’Р°РєР°РЅСЃРёРё</h2>
              <div className="admin-toolbar">
                <input value={vacanciesSearch} onChange={(event) => setVacanciesSearch(event.target.value)} placeholder="РџРѕРёСЃРє РїРѕ Р·Р°РіРѕР»РѕРІРєСѓ" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadVacancies()}>РќР°Р№С‚Рё</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {vacancies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>РљРѕРјРїР°РЅРёСЏ ID: {item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `РЎС‚Р°С‚СѓСЃ ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{vacancyKindLabel[item.kind] ?? `Р’РёРґ ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Р¤РѕСЂРјР°С‚ ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <select
                      value={item.status}
                      onChange={(event) => void onChangeVacancyStatus(item, Number(event.target.value))}
                      disabled={processingVacancyId === item.id}
                    >
                      {Object.entries(moderationStatusLabel).map(([value, label]) => (
                        <option key={value} value={Number(value)}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteVacancy(item)}>РЈРґР°Р»РёС‚СЊ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'opportunities' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>РњРµСЂРѕРїСЂРёСЏС‚РёСЏ</h2>
              <div className="admin-toolbar">
                <input value={opportunitiesSearch} onChange={(event) => setOpportunitiesSearch(event.target.value)} placeholder="РџРѕРёСЃРє РїРѕ Р·Р°РіРѕР»РѕРІРєСѓ" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadOpportunities()}>РќР°Р№С‚Рё</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {opportunities.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>РљРѕРјРїР°РЅРёСЏ ID: {item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `РЎС‚Р°С‚СѓСЃ ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__meta">
                    <span>{opportunityKindLabel[item.kind] ?? `Р’РёРґ ${item.kind}`}</span>
                    <span>{workFormatLabel[item.format] ?? `Р¤РѕСЂРјР°С‚ ${item.format}`}</span>
                    <span>{new Date(item.publishAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <button type="button" className="btn btn--danger" onClick={() => void onDeleteOpportunity(item)}>РЈРґР°Р»РёС‚СЊ</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}
