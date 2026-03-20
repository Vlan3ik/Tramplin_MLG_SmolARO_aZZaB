import { Building2, Clock3, Globe, Mail, MapPin, MessageSquare, Phone, ShieldCheck, UploadCloud } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCities } from '../../api/catalog'
import {
  createEmployerCompany,
  fetchEmployerCompany,
  fetchEmployerCompanyOpportunities,
  submitEmployerCompanyVerification,
  updateEmployerCompanyChatSettings,
  updateEmployerCompanyVerification,
  type EmployerCompany,
} from '../../api/employer'
import { fetchMyChats } from '../../api/chats'
import { uploadCompanyLogo } from '../../api/media'
import { DashboardLayout } from '../../components/dashboard/DashboardLayout'
import type { City } from '../../types/catalog'

const menu = ['Обзор', 'Профиль компании', 'Создать возможность', 'Мои возможности', 'Отклики', 'Аналитика', 'Верификация']

const companyStatusLabel: Record<string, string> = {
  draft: 'Черновик',
  pendingverification: 'На верификации',
  verified: 'Подтверждена',
  rejected: 'Отклонена',
  blocked: 'Заблокирована',
}

const companyStatusTone: Record<string, 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pendingverification: 'warning',
  rejected: 'danger',
  blocked: 'danger',
  draft: 'warning',
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('abort')
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

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Недавно'
  }

  return date.toLocaleDateString('ru-RU')
}

function toLowerSafe(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

export function EmployerDashboardPage() {
  const [company, setCompany] = useState<EmployerCompany | null>(null)
  const [companyMissing, setCompanyMissing] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [opportunities, setOpportunities] = useState<
    Array<{
      id: number
      title: string
      format: string
      locationName: string
      salaryLabel: string
      publishAt: string
      tags: string[]
    }>
  >([])
  const [applicationChats, setApplicationChats] = useState<Array<{ id: number; title: string; lastMessageText: string; lastMessageAt: string }>>([])

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingChatSettings, setSavingChatSettings] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [createForm, setCreateForm] = useState({
    legalName: '',
    brandName: '',
    logoUrl: '',
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

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [citiesResult, chatsResult] = await Promise.allSettled([fetchCities(), fetchMyChats()])

      if (citiesResult.status === 'fulfilled') {
        setCities(citiesResult.value)
      }

      if (chatsResult.status === 'fulfilled') {
        const chats = chatsResult.value
          .filter((chat) => chat.type === 1)
          .map((chat) => ({
            id: chat.id,
            title: chat.title?.trim() || `Чат #${chat.id}`,
            lastMessageText: chat.lastMessage?.text?.trim() || 'Сообщений пока нет',
            lastMessageAt: chat.lastMessage?.createdAt ?? chat.createdAt,
          }))

        setApplicationChats(chats)
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

      const companyOpportunities = await fetchEmployerCompanyOpportunities(employerCompany.id)
      setOpportunities(companyOpportunities)
    } catch (loadError) {
      if (isAbortError(loadError)) {
        return
      }

      const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить кабинет работодателя.'
      const normalized = message.toLowerCase()

      if (normalized.includes('not found') || normalized.includes('не найден')) {
        setCompany(null)
        setCompanyMissing(true)
        setOpportunities([])
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

  const statusCode = toLowerSafe(company?.status)
  const companyStatusText = companyStatusLabel[statusCode] ?? 'Статус не определен'
  const companyStatusToneClass = companyStatusTone[statusCode] ?? 'warning'
  const companyName = company?.brandName.trim() || company?.legalName.trim() || 'Компания'

  const overview = useMemo(() => {
    const now = Date.now()
    const last24h = 24 * 60 * 60 * 1000

    const recentChats = applicationChats.filter((chat) => {
      const ts = Date.parse(chat.lastMessageAt)
      return !Number.isNaN(ts) && now - ts <= last24h
    }).length

    return {
      opportunitiesTotal: opportunities.length,
      responsesTotal: applicationChats.length,
      responsesRecent: recentChats,
      status: companyStatusText,
    }
  }, [applicationChats, companyStatusText, opportunities.length])

  function onCreateFormChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setCreateForm((state) => ({ ...state, [name]: value }))
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

  async function onCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setCreatingCompany(true)

    try {
      await createEmployerCompany(createForm)
      setSuccess('Компания создана. Данные кабинета обновлены.')
      await loadDashboard()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать компанию.')
    } finally {
      setCreatingCompany(false)
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
      setSuccess('Профиль компании обновлен.')
      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось обновить профиль компании.')
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
      setSuccess('Чат-настройки компании обновлены.')
      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось обновить чат-настройки.')
    } finally {
      setSavingChatSettings(false)
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
      setSuccess('Компания отправлена на верификацию.')
      await loadDashboard()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить компанию на верификацию.')
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
      setSuccess(result.url ? 'Логотип загружен. Сохраните профиль, чтобы обновить данные.' : 'Логотип загружен.')
      await loadDashboard()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить логотип.')
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  return (
    <DashboardLayout
      title="Личный кабинет работодателя"
      subtitle="Управление компанией, откликами и публикациями на платформе"
      navItems={menu}
    >
      <section id="section-0" className="dashboard-section card">
        <h2>Обзор</h2>
        {loading ? <p>Загружаем данные...</p> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}
        <div className="stat-grid">
          <article>
            <strong>{overview.opportunitiesTotal}</strong>
            <span>Опубликованных возможностей</span>
          </article>
          <article>
            <strong>{overview.responsesTotal}</strong>
            <span>Откликов (application-чаты)</span>
          </article>
          <article>
            <strong>{overview.responsesRecent}</strong>
            <span>Активность за 24 часа</span>
          </article>
          <article>
            <strong>{overview.status}</strong>
            <span>Статус компании</span>
          </article>
        </div>
      </section>

      <section id="section-1" className="dashboard-section card">
        <h2>Профиль компании</h2>
        {companyMissing ? (
          <form className="form-grid form-grid--two" onSubmit={onCreateCompany}>
            <label>
              Юридическое название
              <input name="legalName" type="text" value={createForm.legalName} onChange={onCreateFormChange} required />
            </label>
            <label>
              Бренд
              <input name="brandName" type="text" value={createForm.brandName} onChange={onCreateFormChange} />
            </label>
            <label className="full-width">
              URL логотипа (опционально)
              <input name="logoUrl" type="url" value={createForm.logoUrl} onChange={onCreateFormChange} />
            </label>
            <button type="submit" className="btn btn--primary full-width" disabled={creatingCompany}>
              {creatingCompany ? 'Создаем компанию...' : 'Создать компанию'}
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
                {uploadingLogo ? 'Загрузка...' : 'Загрузить логотип'}
                <input type="file" accept="image/*" onChange={onUploadLogo} disabled={uploadingLogo} />
              </label>
            </div>

            <label>
              Юридическое название
              <input name="legalName" type="text" value={profileForm.legalName} onChange={onProfileFormChange} required />
            </label>
            <label>
              Брендовое название
              <input name="brandName" type="text" value={profileForm.brandName} onChange={onProfileFormChange} />
            </label>
            <label>
              Тип компании
              <select name="legalType" value={profileForm.legalType} onChange={onProfileFormChange}>
                <option value={1}>Юридическое лицо</option>
                <option value={2}>ИП / Самозанятый</option>
              </select>
            </label>
            <label>
              Базовый город
              <select name="baseCityId" value={profileForm.baseCityId} onChange={onProfileFormChange}>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ИНН
              <input name="taxId" type="text" value={profileForm.taxId} onChange={onProfileFormChange} />
            </label>
            <label>
              Регистрационный номер
              <input name="registrationNumber" type="text" value={profileForm.registrationNumber} onChange={onProfileFormChange} />
            </label>
            <label>
              Отрасль
              <input name="industry" type="text" value={profileForm.industry} onChange={onProfileFormChange} />
            </label>
            <label>
              Сайт
              <input name="websiteUrl" type="url" value={profileForm.websiteUrl} onChange={onProfileFormChange} />
            </label>
            <label>
              Публичный email
              <input name="publicEmail" type="email" value={profileForm.publicEmail} onChange={onProfileFormChange} />
            </label>
            <label>
              Публичный телефон
              <input name="publicPhone" type="text" value={profileForm.publicPhone} onChange={onProfileFormChange} />
            </label>
            <label className="full-width">
              Описание
              <textarea name="description" rows={4} value={profileForm.description} onChange={onProfileFormChange} />
            </label>
            <button type="submit" className="btn btn--primary full-width" disabled={savingProfile}>
              {savingProfile ? 'Сохраняем...' : 'Сохранить профиль компании'}
            </button>
          </form>
        )}
      </section>

      <section id="section-2" className="dashboard-section card">
        <h2>Создать возможность</h2>
        <p>
          В текущем API работодателя отсутствует endpoint публикации вакансий из кабинета. Сейчас доступны управление компанией,
          верификация и чат-настройки. Публикации выводятся в разделе «Мои возможности», если они уже созданы в системе.
        </p>
      </section>

      <section id="section-3" className="dashboard-section card">
        <h2>Мои возможности</h2>
        {!opportunities.length ? (
          <p>У компании пока нет опубликованных возможностей.</p>
        ) : (
          <div className="favorite-list">
            {opportunities.map((item) => (
              <article key={item.id} className="favorite-card">
                <div className="favorite-card__head">
                  <div>
                    <h3>{item.title}</h3>
                    <span className="favorite-card__salary">{item.salaryLabel}</span>
                  </div>
                  <span className="status-chip">{item.format}</span>
                </div>
                <div className="favorite-card__meta">
                  <span>
                    <MapPin size={14} />
                    {item.locationName}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    Публикация: {formatDate(item.publishAt)}
                  </span>
                </div>
                {item.tags.length ? <p>{item.tags.slice(0, 6).join(', ')}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="section-4" className="dashboard-section card">
        <h2>Отклики</h2>
        {!applicationChats.length ? (
          <p>Откликов пока нет.</p>
        ) : (
          <div className="status-table">
            {applicationChats.map((chat) => (
              <div key={chat.id}>
                <span>
                  <MessageSquare size={14} />
                  {chat.title}: {chat.lastMessageText}
                </span>
                <span className="status-chip">Обновлено {formatDate(chat.lastMessageAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="section-5" className="dashboard-section card">
        <h2>Аналитика</h2>
        <div className="employer-analytics">
          <article>
            <strong>{applicationChats.length}</strong>
            <span>Всего диалогов по откликам</span>
          </article>
          <article>
            <strong>{opportunities.length}</strong>
            <span>Активных публикаций компании</span>
          </article>
          <article>
            <strong>{applicationChats.filter((chat) => chat.lastMessageText !== 'Сообщений пока нет').length}</strong>
            <span>Чатов с сообщениями</span>
          </article>
        </div>
      </section>

      <section id="section-6" className="dashboard-section card">
        <h2>Верификация</h2>
        <div className="employer-verification">
          <div className="employer-verification__status">
            <span className={`status-chip status-chip--${companyStatusToneClass}`}>
              <ShieldCheck size={14} />
              {companyStatusText}
            </span>
            <p>Для отправки на модерацию заполните все обязательные поля профиля компании и укажите публичные контакты.</p>
            <button type="button" className="btn btn--primary" onClick={() => void onSubmitVerification()} disabled={submittingVerification || !company}>
              {submittingVerification ? 'Отправляем...' : 'Отправить на верификацию'}
            </button>
          </div>

          <form className="form-grid" onSubmit={onSaveChatSettings}>
            <h3>Чат-настройки</h3>
            <label className="employer-checkbox">
              <input
                type="checkbox"
                name="autoGreetingEnabled"
                checked={chatSettingsForm.autoGreetingEnabled}
                onChange={onChatSettingsChange}
              />
              Включить авто-приветствие
            </label>
            <label>
              Текст авто-приветствия
              <textarea name="autoGreetingText" rows={2} value={chatSettingsForm.autoGreetingText} onChange={onChatSettingsChange} />
            </label>
            <label className="employer-checkbox">
              <input
                type="checkbox"
                name="outsideHoursEnabled"
                checked={chatSettingsForm.outsideHoursEnabled}
                onChange={onChatSettingsChange}
              />
              Отвечать вне рабочего времени
            </label>
            <label>
              Сообщение вне рабочего времени
              <textarea name="outsideHoursText" rows={2} value={chatSettingsForm.outsideHoursText} onChange={onChatSettingsChange} />
            </label>
            <div className="form-grid form-grid--two">
              <label>
                Таймзона
                <input name="workingHoursTimezone" type="text" value={chatSettingsForm.workingHoursTimezone} onChange={onChatSettingsChange} />
              </label>
              <label>
                Начало рабочего дня
                <input name="workingHoursFrom" type="time" value={chatSettingsForm.workingHoursFrom} onChange={onChatSettingsChange} />
              </label>
              <label>
                Конец рабочего дня
                <input name="workingHoursTo" type="time" value={chatSettingsForm.workingHoursTo} onChange={onChatSettingsChange} />
              </label>
            </div>
            <button type="submit" className="btn btn--secondary" disabled={savingChatSettings || !company}>
              {savingChatSettings ? 'Сохраняем...' : 'Сохранить чат-настройки'}
            </button>
          </form>
        </div>

        {company ? (
          <div className="employer-company-contacts">
            <span>
              <Globe size={14} />
              {company.websiteUrl || 'Сайт не указан'}
            </span>
            <span>
              <Mail size={14} />
              {company.publicEmail || 'Email не указан'}
            </span>
            <span>
              <Phone size={14} />
              {company.publicPhone || 'Телефон не указан'}
            </span>
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  )
}
