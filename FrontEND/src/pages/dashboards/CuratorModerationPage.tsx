import { Archive, Ban, BadgeCheck, Building2, ExternalLink, Eye, FileBadge2, FileCheck2, FileX2, Pencil, ShieldAlert, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptAdminCompanyVerificationDocument,
  banAdminResumeAuthor,
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminResume,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminCompanyVerification,
  fetchAdminOpportunityById,
  fetchAdminOpportunities,
  fetchAdminResumeById,
  fetchAdminResumes,
  fetchAdminUserById,
  fetchAdminUsers,
  fetchAdminVacancies,
  fetchAdminVacancyById,
  rejectAdminCompany,
  rejectAdminCompanyVerificationDocument,
  updateAdminCompanyStatus,
  updateAdminOpportunityStatus,
  updateAdminResumeArchive,
  updateAdminUserStatus,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminCompanyVerificationDetail,
  type AdminOpportunity,
  type AdminOpportunityDetail,
  type AdminResume,
  type AdminResumeDetail,
  type AdminUser,
  type AdminVacancy,
  type AdminVacancyDetail,
} from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'

type Tab = 'users' | 'resumes' | 'vacancies' | 'opportunities' | 'companies'
type Mode = 'view' | 'confirm' | 'document-review'
type ActionId =
  | 'user-block' | 'user-unblock' | 'user-delete'
  | 'resume-archive' | 'resume-restore' | 'resume-ban' | 'resume-delete'
  | 'vacancy-archive' | 'vacancy-reject' | 'vacancy-delete'
  | 'opportunity-publish' | 'opportunity-return' | 'opportunity-archive' | 'opportunity-reject' | 'opportunity-delete'
  | 'company-approve' | 'company-reject' | 'company-block' | 'company-delete'

type ActionState = { id: ActionId; title: string; text: string; confirm: string; tone: 'success' | 'warning' | 'danger' }
type DocReview = { companyId: number; documentId: number; accept: boolean; fileName: string }
type DetailState = {
  user: AdminUser | null
  resume: AdminResumeDetail | null
  vacancy: AdminVacancyDetail | null
  opportunity: AdminOpportunityDetail | null
  company: AdminCompanyVerificationDetail | null
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'users', label: 'Пользователи' },
  { id: 'resumes', label: 'Резюме' },
  { id: 'vacancies', label: 'Вакансии' },
  { id: 'opportunities', label: 'События' },
  { id: 'companies', label: 'Компании' },
]

const userStatusLabel: Record<number, string> = { 1: 'Активен', 2: 'Заблокирован', 3: 'Удалён' }
const companyStatusLabel: Record<number, string> = { 1: 'Черновик', 2: 'На верификации', 3: 'Подтверждена', 4: 'Отклонена', 5: 'Заблокирована' }
const moderationStatusLabel: Record<number, string> = { 1: 'Черновик', 2: 'На модерации', 3: 'Активна', 4: 'Завершена', 5: 'Отменена', 6: 'Отклонена', 7: 'В архиве' }
const reviewStatusLabel: Record<number, string> = { 1: 'Черновик', 2: 'Ожидает проверки', 3: 'Одобрено', 4: 'Отклонено' }
const docStatusLabel: Record<number, string> = { 1: 'Загружен', 2: 'Принят', 3: 'Отклонён' }
const docTypeLabel: Record<number, string> = {
  1: 'Выписка ЕГРЮЛ',
  2: 'Выписка ЕГРИП',
  3: 'Карточка компании с реквизитами',
  4: 'Документ о полномочиях представителя',
  5: 'Фото офиса',
  6: 'Подтверждение доменной почты',
  7: 'Подтверждение ИНН (постановка на учет)',
  8: 'Фото рабочего места',
  9: 'Подтверждение статуса самозанятого (НПД)',
  10: 'Документ, удостоверяющий личность',
  11: 'Портфолио или сайт',
  12: 'Подтверждение HR-деятельности',
  13: 'Оферта или договор на услуги',
  14: 'Бренд-материалы',
  15: 'Подтверждение рекрутинговой деятельности',
  16: 'Подтверждение полномочий от заказчика',
  17: 'Подтверждение найма для личных нужд',
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Не указано'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU')
}

function formatMoney(from: number | null, to: number | null, currency: string | null) {
  if (from == null && to == null) return 'Не указано'
  const nf = new Intl.NumberFormat('ru-RU')
  const code = currency || 'RUB'
  if (from != null && to != null) return `${nf.format(from)} - ${nf.format(to)} ${code}`
  if (from != null) return `от ${nf.format(from)} ${code}`
  return `до ${nf.format(to ?? 0)} ${code}`
}

function stop(event: React.MouseEvent) {
  event.stopPropagation()
}

function getCardStatus(tab: Tab, item: AdminUser | AdminResume | AdminVacancy | AdminOpportunity | AdminCompany) {
  if (tab === 'users') return userStatusLabel[(item as AdminUser).status] ?? `Статус ${(item as AdminUser).status}`
  if (tab === 'resumes') return (item as AdminResume).isArchived ? 'В архиве' : 'Опубликовано'
  if (tab === 'companies') return companyStatusLabel[(item as AdminCompany).status] ?? `Статус ${(item as AdminCompany).status}`
  return moderationStatusLabel[(item as AdminVacancy | AdminOpportunity).status] ?? `Статус ${(item as AdminVacancy | AdminOpportunity).status}`
}

export function CuratorModerationPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usersSearch, setUsersSearch] = useState('')
  const [resumesSearch, setResumesSearch] = useState('')
  const [vacanciesSearch, setVacanciesSearch] = useState('')
  const [opportunitiesSearch, setOpportunitiesSearch] = useState('')
  const [companiesSearch, setCompaniesSearch] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [resumes, setResumes] = useState<AdminResume[]>([])
  const [vacancies, setVacancies] = useState<AdminVacancy[]>([])
  const [opportunities, setOpportunities] = useState<AdminOpportunity[]>([])
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [selectedType, setSelectedType] = useState<Tab | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [action, setAction] = useState<ActionState | null>(null)
  const [docReview, setDocReview] = useState<DocReview | null>(null)
  const [companyRejectReason, setCompanyRejectReason] = useState('Отсутствуют обязательные данные или документы.')
  const [docComment, setDocComment] = useState('')
  const [detail, setDetail] = useState<DetailState>({ user: null, resume: null, vacancy: null, opportunity: null, company: null })

  const loadUsers = async () => setUsers((await fetchAdminUsers({ page: 1, pageSize: 30, search: usersSearch })).items)
  const loadResumes = async () => setResumes((await fetchAdminResumes({ page: 1, pageSize: 30, search: resumesSearch })).items)
  const loadVacancies = async () => setVacancies((await fetchAdminVacancies({ page: 1, pageSize: 30, search: vacanciesSearch })).items)
  const loadOpportunities = async () => setOpportunities((await fetchAdminOpportunities({ page: 1, pageSize: 30, search: opportunitiesSearch })).items)
  const loadCompanies = async () => setCompanies((await fetchAdminCompanies({ page: 1, pageSize: 30, search: companiesSearch })).items)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([loadUsers(), loadResumes(), loadVacancies(), loadOpportunities(), loadCompanies()]).then((results) => {
      if (!active) return
      const failed = results.find((item) => item.status === 'rejected')
      if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Не удалось загрузить данные модерации.')
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  function clearMessages() { setError(''); setSuccess('') }
  function resetDetail() { setDetail({ user: null, resume: null, vacancy: null, opportunity: null, company: null }); setAction(null); setDocReview(null); setModalError(''); setDocComment('') }
  function closeModal() { setSelectedType(null); setSelectedId(null); setMode('view'); setModalLoading(false); setModalSubmitting(false); resetDetail() }

  async function openModal(type: Tab, id: number) {
    clearMessages()
    resetDetail()
    setSelectedType(type)
    setSelectedId(id)
    setMode('view')
    setModalLoading(true)
    try {
      if (type === 'users') {
        const user = await fetchAdminUserById(id)
        setDetail((prev) => ({ ...prev, user }))
      }
      if (type === 'resumes') {
        const resume = await fetchAdminResumeById(id)
        setDetail((prev) => ({ ...prev, resume }))
      }
      if (type === 'vacancies') {
        const vacancy = await fetchAdminVacancyById(id)
        setDetail((prev) => ({ ...prev, vacancy }))
      }
      if (type === 'opportunities') {
        const opportunity = await fetchAdminOpportunityById(id)
        setDetail((prev) => ({ ...prev, opportunity }))
      }
      if (type === 'companies') {
        const company = await fetchAdminCompanyVerification(id)
        setDetail((prev) => ({ ...prev, company }))
      }
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Не удалось загрузить карточку.')
    } finally {
      setModalLoading(false)
    }
  }

  async function reloadSelected() {
    if (selectedType && selectedId != null) await openModal(selectedType, selectedId)
  }

  async function reloadList(type: Tab) {
    if (type === 'users') await loadUsers()
    if (type === 'resumes') await loadResumes()
    if (type === 'vacancies') await loadVacancies()
    if (type === 'opportunities') await loadOpportunities()
    if (type === 'companies') await loadCompanies()
  }

  function confirmAction(next: ActionState) { setAction(next); setMode('confirm'); setModalError('') }
  function reviewDocument(next: DocReview) { setDocReview(next); setMode('document-review'); setModalError(''); setDocComment('') }

  async function runAction() {
    if (!action || !selectedType || selectedId == null) return
    if (action.id === 'company-reject' && !companyRejectReason.trim()) { setModalError('Укажите причину отклонения.'); return }
    setModalSubmitting(true)
    setModalError('')
    clearMessages()
    try {
      if (action.id === 'user-block') { await updateAdminUserStatus(selectedId, 2); setSuccess('Пользователь заблокирован.') }
      if (action.id === 'user-unblock') { await updateAdminUserStatus(selectedId, 1); setSuccess('Пользователь разблокирован.') }
      if (action.id === 'user-delete') { await deleteAdminUser(selectedId); setSuccess('Пользователь удалён.') }
      if (action.id === 'resume-archive') { await updateAdminResumeArchive(selectedId, true); setSuccess('Резюме отправлено в архив.') }
      if (action.id === 'resume-restore') { await updateAdminResumeArchive(selectedId, false); setSuccess('Резюме восстановлено.') }
      if (action.id === 'resume-ban') { await banAdminResumeAuthor(selectedId); setSuccess('Автор резюме заблокирован.') }
      if (action.id === 'resume-delete') { await deleteAdminResume(selectedId); setSuccess('Резюме удалено.') }
      if (action.id === 'vacancy-archive') { await updateAdminVacancyStatus(selectedId, 7); setSuccess('Вакансия отправлена в архив.') }
      if (action.id === 'vacancy-reject') { await updateAdminVacancyStatus(selectedId, 6); setSuccess('Вакансия отклонена.') }
      if (action.id === 'vacancy-delete') { await deleteAdminVacancy(selectedId); setSuccess('Вакансия удалена.') }
      if (action.id === 'opportunity-publish') { await updateAdminOpportunityStatus(selectedId, 3); setSuccess('Событие опубликовано.') }
      if (action.id === 'opportunity-return') { await updateAdminOpportunityStatus(selectedId, 2); setSuccess('Событие возвращено на модерацию.') }
      if (action.id === 'opportunity-archive') { await updateAdminOpportunityStatus(selectedId, 7); setSuccess('Событие отправлено в архив.') }
      if (action.id === 'opportunity-reject') { await updateAdminOpportunityStatus(selectedId, 6); setSuccess('Событие отклонено.') }
      if (action.id === 'opportunity-delete') { await deleteAdminOpportunity(selectedId); setSuccess('Событие удалено.') }
      if (action.id === 'company-approve') { await verifyAdminCompany(selectedId); setSuccess('Верификация компании одобрена.') }
      if (action.id === 'company-reject') { await rejectAdminCompany(selectedId, companyRejectReason.trim(), []); setSuccess('Верификация компании отклонена.') }
      if (action.id === 'company-block') { await updateAdminCompanyStatus(selectedId, 5); setSuccess('Компания заблокирована.') }
      if (action.id === 'company-delete') { await deleteAdminCompany(selectedId); setSuccess('Компания удалена.') }
      await reloadList(selectedType)
      if (action.id.endsWith('delete')) { closeModal(); return }
      setAction(null)
      setMode('view')
      await reloadSelected()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Не удалось выполнить действие.')
    } finally {
      setModalSubmitting(false)
    }
  }

  async function runDocReview() {
    if (!docReview) return
    setModalSubmitting(true)
    setModalError('')
    clearMessages()
    try {
      if (docReview.accept) {
        await acceptAdminCompanyVerificationDocument(docReview.companyId, docReview.documentId, docComment.trim())
        setSuccess('Документ принят.')
      } else {
        await rejectAdminCompanyVerificationDocument(docReview.companyId, docReview.documentId, docComment.trim())
        setSuccess('Документ отклонён.')
      }
      await loadCompanies()
      setDocReview(null)
      setMode('view')
      await reloadSelected()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Не удалось проверить документ.')
    } finally {
      setModalSubmitting(false)
    }
  }

  const modalTitle = useMemo(() => {
    if (selectedType === 'users') return 'Карточка пользователя'
    if (selectedType === 'resumes') return 'Карточка резюме'
    if (selectedType === 'vacancies') return 'Карточка вакансии'
    if (selectedType === 'opportunities') return 'Карточка события'
    if (selectedType === 'companies') return 'Карточка компании'
    return 'Карточка'
  }, [selectedType])

  const publicLink = selectedType === 'users' && detail.user ? `/dashboard/seeker/${encodeURIComponent(detail.user.username)}`
    : selectedType === 'resumes' && detail.resume ? `/dashboard/seeker/${encodeURIComponent(detail.resume.username)}`
    : selectedType === 'vacancies' && detail.vacancy ? `/dashboard/curator/vacancies/create?vacancyId=${detail.vacancy.id}`
    : selectedType === 'opportunities' && detail.opportunity ? `/opportunity/${detail.opportunity.id}`
    : selectedType === 'companies' && detail.company ? `/company/${detail.company.companyId}`
    : null

  const editLink = selectedType === 'users' && detail.user ? `/dashboard/curator/users/create?userId=${detail.user.id}`
    : selectedType === 'resumes' && detail.resume ? `/dashboard/seeker/${encodeURIComponent(detail.resume.username)}?mode=resume`
    : selectedType === 'vacancies' && detail.vacancy ? `/dashboard/curator/vacancies/create?vacancyId=${detail.vacancy.id}`
    : selectedType === 'opportunities' && detail.opportunity ? `/dashboard/curator/opportunities/create?opportunityId=${detail.opportunity.id}`
    : selectedType === 'companies' && detail.company ? `/dashboard/curator/companies/create?companyId=${detail.company.companyId}`
    : null

  function renderActions(currentTab: Tab, item: AdminUser | AdminResume | AdminVacancy | AdminOpportunity | AdminCompany) {
    if (currentTab === 'users') {
      const user = item as AdminUser
      return <>
        <button type="button" className="admin-icon-button admin-icon-button--info" aria-label="Открыть" title="Открыть" onClick={(event) => { stop(event); void openModal('users', user.id) }}><Eye size={18} /></button>
        <Link className="admin-icon-button admin-icon-button--primary" aria-label="Редактировать" title="Редактировать" to={`/dashboard/curator/users/create?userId=${user.id}`} onClick={stop}><Pencil size={18} /></Link>
        <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label="Заблокировать" title="Заблокировать" onClick={(event) => { stop(event); void openModal('users', user.id).then(() => confirmAction({ id: 'user-block', title: 'Заблокировать пользователя', text: `Пользователь ${user.email} потеряет доступ к платформе.`, confirm: 'Заблокировать', tone: 'warning' })) }}><Ban size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--success" aria-label="Разблокировать" title="Разблокировать" onClick={(event) => { stop(event); void openModal('users', user.id).then(() => confirmAction({ id: 'user-unblock', title: 'Разблокировать пользователя', text: `Пользователь ${user.email} снова получит доступ.`, confirm: 'Разблокировать', tone: 'success' })) }}><BadgeCheck size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Удалить" title="Удалить" onClick={(event) => { stop(event); void openModal('users', user.id).then(() => confirmAction({ id: 'user-delete', title: 'Удалить пользователя', text: `Пользователь ${user.email} будет удалён без возможности восстановления.`, confirm: 'Удалить', tone: 'danger' })) }}><Trash2 size={18} /></button>
      </>
    }
    if (currentTab === 'resumes') {
      const resume = item as AdminResume
      return <>
        <button type="button" className="admin-icon-button admin-icon-button--info" aria-label="Открыть" title="Открыть" onClick={(event) => { stop(event); void openModal('resumes', resume.userId) }}><Eye size={18} /></button>
        <Link className="admin-icon-button admin-icon-button--primary" aria-label="Редактировать" title="Редактировать" to={`/dashboard/seeker/${encodeURIComponent(resume.username)}?mode=resume`} onClick={stop}><Pencil size={18} /></Link>
        <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label={resume.isArchived ? 'Восстановить' : 'В архив'} title={resume.isArchived ? 'Восстановить резюме из архива' : 'Переместить резюме в архив'} onClick={(event) => { stop(event); void openModal('resumes', resume.userId).then(() => confirmAction({ id: resume.isArchived ? 'resume-restore' : 'resume-archive', title: resume.isArchived ? 'Восстановить резюме' : 'Архивировать резюме', text: resume.isArchived ? 'Резюме снова станет доступно.' : 'Резюме будет скрыто из активного списка.', confirm: resume.isArchived ? 'Восстановить' : 'В архив', tone: resume.isArchived ? 'success' : 'warning' })) }}><Archive size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Заблокировать автора" title="Заблокировать автора" onClick={(event) => { stop(event); void openModal('resumes', resume.userId).then(() => confirmAction({ id: 'resume-ban', title: 'Заблокировать автора', text: `Автор резюме @${resume.username} потеряет доступ к платформе.`, confirm: 'Заблокировать', tone: 'danger' })) }}><Ban size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Удалить" title="Удалить" onClick={(event) => { stop(event); void openModal('resumes', resume.userId).then(() => confirmAction({ id: 'resume-delete', title: 'Удалить резюме', text: `Резюме пользователя @${resume.username} будет удалено.`, confirm: 'Удалить', tone: 'danger' })) }}><Trash2 size={18} /></button>
      </>
    }
    if (currentTab === 'vacancies') {
      const vacancy = item as AdminVacancy
      return <>
        <button type="button" className="admin-icon-button admin-icon-button--info" aria-label="Открыть" title="Открыть" onClick={(event) => { stop(event); void openModal('vacancies', vacancy.id) }}><Eye size={18} /></button>
        <Link className="admin-icon-button admin-icon-button--primary" aria-label="Редактировать" title="Редактировать" to={`/dashboard/curator/vacancies/create?vacancyId=${vacancy.id}`} onClick={stop}><Pencil size={18} /></Link>
        <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label="В архив" title="В архив" onClick={(event) => { stop(event); void openModal('vacancies', vacancy.id).then(() => confirmAction({ id: 'vacancy-archive', title: 'Архивировать вакансию', text: `Вакансия "${vacancy.title}" будет перемещена в архив.`, confirm: 'В архив', tone: 'warning' })) }}><Archive size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Отклонить" title="Отклонить" onClick={(event) => { stop(event); void openModal('vacancies', vacancy.id).then(() => confirmAction({ id: 'vacancy-reject', title: 'Отклонить вакансию', text: `Статус вакансии "${vacancy.title}" будет изменён на отклонённую.`, confirm: 'Отклонить', tone: 'danger' })) }}><X size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Удалить" title="Удалить" onClick={(event) => { stop(event); void openModal('vacancies', vacancy.id).then(() => confirmAction({ id: 'vacancy-delete', title: 'Удалить вакансию', text: `Вакансия "${vacancy.title}" будет удалена без возможности восстановления.`, confirm: 'Удалить', tone: 'danger' })) }}><Trash2 size={18} /></button>
      </>
    }
    if (currentTab === 'opportunities') {
      const opportunity = item as AdminOpportunity
      return <>
        <button type="button" className="admin-icon-button admin-icon-button--info" aria-label="Открыть" title="Открыть" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id) }}><Eye size={18} /></button>
        <Link className="admin-icon-button admin-icon-button--primary" aria-label="Редактировать" title="Редактировать" to={`/dashboard/curator/opportunities/create?opportunityId=${opportunity.id}`} onClick={stop}><Pencil size={18} /></Link>
        <button type="button" className="admin-icon-button admin-icon-button--success" aria-label="Опубликовать" title="Опубликовать" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id).then(() => confirmAction({ id: 'opportunity-publish', title: 'Опубликовать событие', text: `Событие "${opportunity.title}" станет активным.`, confirm: 'Опубликовать', tone: 'success' })) }}><BadgeCheck size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label="На модерацию" title="На модерацию" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id).then(() => confirmAction({ id: 'opportunity-return', title: 'Вернуть на модерацию', text: `Событие "${opportunity.title}" снова перейдёт в статус модерации.`, confirm: 'Вернуть', tone: 'warning' })) }}><ShieldAlert size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label="В архив" title="В архив" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id).then(() => confirmAction({ id: 'opportunity-archive', title: 'Архивировать событие', text: `Событие "${opportunity.title}" будет перемещено в архив.`, confirm: 'В архив', tone: 'warning' })) }}><Archive size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Отклонить" title="Отклонить" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id).then(() => confirmAction({ id: 'opportunity-reject', title: 'Отклонить событие', text: `Событие "${opportunity.title}" получит статус отклонённого.`, confirm: 'Отклонить', tone: 'danger' })) }}><X size={18} /></button>
        <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Удалить" title="Удалить" onClick={(event) => { stop(event); void openModal('opportunities', opportunity.id).then(() => confirmAction({ id: 'opportunity-delete', title: 'Удалить событие', text: `Событие "${opportunity.title}" будет удалено без возможности восстановления.`, confirm: 'Удалить', tone: 'danger' })) }}><Trash2 size={18} /></button>
      </>
    }
    const company = item as AdminCompany
    return <>
      <button type="button" className="admin-icon-button admin-icon-button--info" aria-label="Открыть карточку компании" title="Открыть карточку компании" onClick={(event) => { stop(event); void openModal('companies', company.id) }}><Eye size={18} /></button>
      <Link className="admin-icon-button admin-icon-button--primary" aria-label="Редактировать данные компании" title="Редактировать данные компании" to={`/dashboard/curator/companies/create?companyId=${company.id}`} state={{ company }} onClick={stop}><Pencil size={18} /></Link>
      <button type="button" className="admin-icon-button admin-icon-button--success" aria-label="Одобрить верификацию компании" title="Одобрить верификацию компании" onClick={(event) => { stop(event); void openModal('companies', company.id).then(() => confirmAction({ id: 'company-approve', title: 'Одобрить верификацию', text: `Компания "${company.brandName || company.legalName}" будет подтверждена.`, confirm: 'Одобрить', tone: 'success' })) }}><BadgeCheck size={18} /></button>
      <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Отклонить верификацию компании" title="Отклонить верификацию компании" onClick={(event) => { stop(event); void openModal('companies', company.id).then(() => confirmAction({ id: 'company-reject', title: 'Отклонить верификацию', text: `Компания "${company.brandName || company.legalName}" будет отклонена.`, confirm: 'Отклонить', tone: 'danger' })) }}><X size={18} /></button>
      <button type="button" className="admin-icon-button admin-icon-button--warning" aria-label="Заблокировать компанию" title="Заблокировать компанию" onClick={(event) => { stop(event); void openModal('companies', company.id).then(() => confirmAction({ id: 'company-block', title: 'Заблокировать компанию', text: `Компания "${company.brandName || company.legalName}" будет заблокирована.`, confirm: 'Заблокировать', tone: 'warning' })) }}><Ban size={18} /></button>
      <button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Удалить компанию без восстановления" title="Удалить компанию без восстановления" onClick={(event) => { stop(event); void openModal('companies', company.id).then(() => confirmAction({ id: 'company-delete', title: 'Удалить компанию', text: `Компания "${company.brandName || company.legalName}" будет удалена без возможности восстановления.`, confirm: 'Удалить', tone: 'danger' })) }}><Trash2 size={18} /></button>
    </>
  }

  const items = tab === 'users' ? users : tab === 'resumes' ? resumes : tab === 'vacancies' ? vacancies : tab === 'opportunities' ? opportunities : companies

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-hero admin-profile-hero">
          <div className="seeker-profile-hero__avatar admin-profile-hero__avatar"><span>MOD</span></div>
          <div className="seeker-profile-hero__content">
            <div className="seeker-profile-panel__head">
              <div>
                <h1>Модерация</h1>
                <div className="admin-company-actions-help">
                  <span><Eye size={14} /> Открыть</span>
                  <span><Pencil size={14} /> Редактировать</span>
                  <span><BadgeCheck size={14} /> Одобрить</span>
                  <span><X size={14} /> Отклонить</span>
                  <span><Ban size={14} /> Заблокировать</span>
                  <span><Trash2 size={14} /> Удалить</span>
                </div>
              </div>
              <div className="admin-toolbar"><Link className="btn btn--ghost" to="/dashboard/curator">Назад в кабинет куратора</Link></div>
            </div>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{users.length} пользователей</span>
              <span><FileBadge2 size={14} />{resumes.length} резюме</span>
              <span><ShieldAlert size={14} />{vacancies.length + opportunities.length} карточек</span>
              <span><Building2 size={14} />{companies.length} компаний</span>
            </div>
          </div>
        </section>
        {loading ? <section className="dashboard-section card seeker-profile-panel"><p>Загрузка данных модерации...</p></section> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}
        <nav className="card seeker-profile-tabs">{tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
        <section className="dashboard-section card seeker-profile-panel">
          <div className="seeker-profile-panel__head">
            <h2>{tabs.find((item) => item.id === tab)?.label}</h2>
            <div className="admin-toolbar">
              {tab === 'users' ? <input value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="Поиск по email/логину/ФИО" /> : null}
              {tab === 'resumes' ? <input value={resumesSearch} onChange={(event) => setResumesSearch(event.target.value)} placeholder="Поиск по резюме/пользователю" /> : null}
              {tab === 'vacancies' ? <input value={vacanciesSearch} onChange={(event) => setVacanciesSearch(event.target.value)} placeholder="Поиск по названию" /> : null}
              {tab === 'opportunities' ? <input value={opportunitiesSearch} onChange={(event) => setOpportunitiesSearch(event.target.value)} placeholder="Поиск по названию" /> : null}
              {tab === 'companies' ? <input value={companiesSearch} onChange={(event) => setCompaniesSearch(event.target.value)} placeholder="Поиск по юр. названию/бренду/сфере" /> : null}
              <button type="button" className="btn btn--ghost" onClick={() => void (tab === 'users' ? loadUsers() : tab === 'resumes' ? loadResumes() : tab === 'vacancies' ? loadVacancies() : tab === 'opportunities' ? loadOpportunities() : loadCompanies())}>Найти</button>
            </div>
          </div>
          <div className="admin-list-grid">
            {items.map((item) => (
              <article key={tab === 'users' ? (item as AdminUser).id : tab === 'resumes' ? (item as AdminResume).userId : (item as AdminVacancy | AdminOpportunity | AdminCompany).id} className="favorite-card admin-list-card admin-list-card--interactive" role="button" tabIndex={0} onClick={() => void openModal(tab, tab === 'resumes' ? (item as AdminResume).userId : (item as AdminUser | AdminVacancy | AdminOpportunity | AdminCompany).id)}>
                <div className="favorite-card__head">
                  {tab === 'users' ? <div><h3>{(item as AdminUser).fio || (item as AdminUser).email}</h3><p>{(item as AdminUser).email}</p></div> : null}
                  {tab === 'resumes' ? <div><h3>{(item as AdminResume).headline || (item as AdminResume).desiredPosition || (item as AdminResume).fio}</h3><p>{(item as AdminResume).fio} (@{(item as AdminResume).username})</p></div> : null}
                  {tab === 'vacancies' ? <div><h3>{(item as AdminVacancy).title}</h3><p>Компания #{(item as AdminVacancy).companyId}</p></div> : null}
                  {tab === 'opportunities' ? <div><h3>{(item as AdminOpportunity).title}</h3><p>Компания #{(item as AdminOpportunity).companyId}</p></div> : null}
                  {tab === 'companies' ? <div><h3>{(item as AdminCompany).brandName || (item as AdminCompany).legalName}</h3><p>{(item as AdminCompany).legalName}</p></div> : null}
                  <span className="status-chip">{getCardStatus(tab, item as AdminUser & AdminResume & AdminVacancy & AdminOpportunity & AdminCompany)}</span>
                </div>
                {tab === 'users' ? <p>@{(item as AdminUser).username} | роли: {(item as AdminUser).roles.join(', ') || '-'}</p> : null}
                {tab === 'resumes' ? <p>Обновлено: {formatDate((item as AdminResume).updatedAt)}</p> : null}
                {tab === 'vacancies' ? <p>Публикация: {formatDate((item as AdminVacancy).publishAt)}</p> : null}
                {tab === 'opportunities' ? <p>Публикация: {formatDate((item as AdminOpportunity).publishAt)}</p> : null}
                {tab === 'companies' ? <p>{(item as AdminCompany).industry || '-'}</p> : null}
                <div className="admin-icon-actions">{renderActions(tab, item as AdminUser & AdminResume & AdminVacancy & AdminOpportunity & AdminCompany)}</div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {selectedType && selectedId != null ? (
        <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="curator-moderation-modal-title">
          <button type="button" className="profile-settings-modal__backdrop" aria-label="Закрыть" title="Закрыть" onClick={() => !modalSubmitting && closeModal()} />
          <section className="card profile-settings-modal__dialog moderation-modal">
            <div className="profile-settings-modal__head">
              <div><h2 id="curator-moderation-modal-title">{modalTitle}</h2><p className="moderation-modal__subtitle">{mode === 'view' ? 'Просмотр и действия по карточке' : mode === 'confirm' ? 'Подтверждение действия' : 'Проверка документа'}</p></div>
              <button type="button" className="btn btn--icon" onClick={() => !modalSubmitting && closeModal()} aria-label="Закрыть" title="Закрыть"><X size={18} /></button>
            </div>
            {modalError ? <div className="auth-feedback auth-feedback--error">{modalError}</div> : null}
            {modalLoading ? <p>Загрузка карточки...</p> : null}
            {!modalLoading && mode === 'view' ? <>
              {detail.user ? <div className="moderation-modal__grid"><article><strong>ФИО</strong><span>{detail.user.fio || 'Не указано'}</span></article><article><strong>Email</strong><span>{detail.user.email}</span></article><article><strong>Логин</strong><span>@{detail.user.username}</span></article><article><strong>Статус</strong><span>{userStatusLabel[detail.user.status] ?? detail.user.status}</span></article><article><strong>Роли</strong><span>{detail.user.roles.join(', ') || '-'}</span></article><article><strong>Создан</strong><span>{formatDate(detail.user.createdAt)}</span></article></div> : null}
              {detail.resume ? <><div className="moderation-modal__grid"><article><strong>ФИО</strong><span>{detail.resume.fio}</span></article><article><strong>Логин</strong><span>@{detail.resume.username}</span></article><article><strong>Заголовок</strong><span>{detail.resume.headline || 'Не указан'}</span></article><article><strong>Желаемая позиция</strong><span>{detail.resume.desiredPosition || 'Не указана'}</span></article><article><strong>Статус</strong><span>{detail.resume.isArchived ? 'В архиве' : 'Опубликовано'}</span></article><article><strong>Обновлено</strong><span>{formatDate(detail.resume.updatedAt)}</span></article></div><article className="moderation-modal__panel"><strong>О себе</strong><p>{detail.resume.summary || 'Описание не заполнено.'}</p></article></> : null}
              {detail.vacancy ? <><div className="moderation-modal__grid"><article><strong>Название</strong><span>{detail.vacancy.title}</span></article><article><strong>Компания</strong><span>#{detail.vacancy.companyId}</span></article><article><strong>Статус</strong><span>{moderationStatusLabel[detail.vacancy.status] ?? detail.vacancy.status}</span></article><article><strong>Публикация</strong><span>{formatDate(detail.vacancy.publishAt)}</span></article><article><strong>Дедлайн</strong><span>{formatDate(detail.vacancy.applicationDeadline)}</span></article><article><strong>Зарплата</strong><span>{formatMoney(detail.vacancy.salaryFrom, detail.vacancy.salaryTo, detail.vacancy.currencyCode)}</span></article></div><article className="moderation-modal__panel"><strong>Краткое описание</strong><p>{detail.vacancy.shortDescription || 'Не указано.'}</p></article><article className="moderation-modal__panel"><strong>Полное описание</strong><p>{detail.vacancy.fullDescription || 'Не указано.'}</p></article></> : null}
              {detail.opportunity ? <><div className="moderation-modal__grid"><article><strong>Название</strong><span>{detail.opportunity.title}</span></article><article><strong>Компания</strong><span>#{detail.opportunity.companyId}</span></article><article><strong>Статус</strong><span>{moderationStatusLabel[detail.opportunity.status] ?? detail.opportunity.status}</span></article><article><strong>Публикация</strong><span>{formatDate(detail.opportunity.publishAt)}</span></article><article><strong>Дата события</strong><span>{formatDate(detail.opportunity.eventDate)}</span></article><article><strong>Стоимость</strong><span>{detail.opportunity.priceAmount == null ? 'Не указана' : `${detail.opportunity.priceAmount} ${detail.opportunity.priceCurrencyCode || 'RUB'}`}</span></article></div><article className="moderation-modal__panel"><strong>Краткое описание</strong><p>{detail.opportunity.shortDescription || 'Не указано.'}</p></article><article className="moderation-modal__panel"><strong>Полное описание</strong><p>{detail.opportunity.fullDescription || 'Не указано.'}</p></article></> : null}
              {detail.company ? <><div className="moderation-modal__grid"><article><strong>Компания</strong><span>{detail.company.brandName || detail.company.legalName}</span></article><article><strong>Юр. имя</strong><span>{detail.company.legalName}</span></article><article><strong>Статус компании</strong><span>{companyStatusLabel[detail.company.companyStatus] ?? detail.company.companyStatus}</span></article><article><strong>Статус проверки</strong><span>{reviewStatusLabel[detail.company.reviewStatus] ?? detail.company.reviewStatus}</span></article><article><strong>ИНН</strong><span>{detail.company.inn || 'Не указан'}</span></article><article><strong>ОГРН / ОГРНИП</strong><span>{detail.company.ogrnOrOgrnip || 'Не указан'}</span></article><article><strong>Представитель</strong><span>{detail.company.representativeFullName || 'Не указан'}</span></article><article><strong>Позиция</strong><span>{detail.company.representativePosition || 'Не указана'}</span></article><article><strong>Сфера</strong><span>{detail.company.mainIndustryName || 'Не указана'}</span></article><article><strong>Email</strong><span>{detail.company.workEmail || 'Не указан'}</span></article><article><strong>Телефон</strong><span>{detail.company.workPhone || 'Не указан'}</span></article><article><strong>Отклонение</strong><span>{detail.company.rejectReason || 'Нет'}</span></article></div><article className="moderation-modal__panel"><strong>Адреса</strong><p>Юридический: {detail.company.legalAddress || 'Не указан'}</p><p>Фактический: {detail.company.actualAddress || 'Не указан'}</p></article><article className="moderation-modal__panel"><strong>Документы</strong>{detail.company.documents.length ? <div className="moderation-documents">{detail.company.documents.map((doc) => <article key={doc.id} className="moderation-documents__item"><div><strong>{doc.fileName}</strong><span>{docTypeLabel[doc.documentType] ?? `Тип ${doc.documentType}`}</span></div><div><span>{docStatusLabel[doc.status] ?? doc.status}</span><small>{doc.contentType} • {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB</small></div><p>{doc.moderatorComment || 'Без комментария.'}</p><div className="admin-icon-actions admin-icon-actions--inline"><button type="button" className="admin-icon-button admin-icon-button--success" aria-label="Принять документ" title="Принять документ" onClick={() => reviewDocument({ companyId: detail.company!.companyId, documentId: doc.id, accept: true, fileName: doc.fileName })}><FileCheck2 size={18} /></button><button type="button" className="admin-icon-button admin-icon-button--danger" aria-label="Отклонить документ" title="Отклонить документ" onClick={() => reviewDocument({ companyId: detail.company!.companyId, documentId: doc.id, accept: false, fileName: doc.fileName })}><FileX2 size={18} /></button></div></article>)}</div> : <p>Документы не загружены.</p>}</article></> : null}
              <div className="profile-settings-modal__actions">{publicLink ? <Link className="btn btn--ghost" to={publicLink}><ExternalLink size={16} />Открыть</Link> : null}{editLink ? <Link className="btn btn--secondary" to={editLink}><Pencil size={16} />Редактировать</Link> : null}<button type="button" className="btn btn--ghost" onClick={closeModal}>Закрыть</button></div>
            </> : null}
            {!modalLoading && mode === 'confirm' && action ? <><div className="moderation-confirm"><h3>{action.title}</h3><p>{action.text}</p>{action.id === 'company-reject' ? <label className="moderation-modal__field"><span>Причина отклонения</span><textarea value={companyRejectReason} onChange={(event) => setCompanyRejectReason(event.target.value)} rows={4} /></label> : null}</div><div className="profile-settings-modal__actions"><button type="button" className="btn btn--ghost" disabled={modalSubmitting} onClick={() => setMode('view')}>Отмена</button><button type="button" className={`btn ${action.tone === 'success' ? 'btn--primary' : action.tone === 'warning' ? 'btn--ghost' : 'btn--danger'}`} disabled={modalSubmitting} onClick={() => void runAction()}>{modalSubmitting ? 'Выполняем...' : action.confirm}</button></div></> : null}
            {!modalLoading && mode === 'document-review' && docReview ? <><div className="moderation-confirm"><h3>{docReview.accept ? 'Принять документ' : 'Отклонить документ'}</h3><p>Документ: {docReview.fileName}</p><label className="moderation-modal__field"><span>Комментарий модератора</span><textarea value={docComment} onChange={(event) => setDocComment(event.target.value)} rows={4} placeholder="Комментарий необязателен." /></label></div><div className="profile-settings-modal__actions"><button type="button" className="btn btn--ghost" disabled={modalSubmitting} onClick={() => setMode('view')}>Отмена</button><button type="button" className={`btn ${docReview.accept ? 'btn--primary' : 'btn--danger'}`} disabled={modalSubmitting} onClick={() => void runDocReview()}>{modalSubmitting ? 'Сохраняем...' : docReview.accept ? 'Принять' : 'Отклонить'}</button></div></> : null}
          </section>
        </div>
      ) : null}
      <Footer />
    </div>
  )
}

