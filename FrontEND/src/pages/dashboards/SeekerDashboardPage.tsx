
import {
  Building2,
  CalendarClock,
  Check,
  CircleOff,
  Github,
  Globe,
  Link as LinkIcon,
  Linkedin,
  MapPin,
  Send,
  UploadCloud,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { createApplication } from '../../api/applications'
import { fetchTags } from '../../api/catalog'
import { fetchCompanies } from '../../api/companies'
import {
  fetchMe,
  fetchSeekerProfile,
  fetchSeekerResume,
  fetchSeekerSettings,
  updateSeekerProfile,
  updateSeekerResume,
  updateSeekerSettings,
} from '../../api/me'
import { uploadMyAvatar, uploadMyProfileBanner } from '../../api/media'
import { fetchOpportunityById, fetchOpportunityDetailById, participateInOpportunity } from '../../api/opportunities'
import {
  createMyPortfolioProject,
  deleteMyPortfolioProjectPhoto,
  deleteMyPortfolioProject,
  fetchPublicPortfolioProjectDetail,
  fetchPublicPortfolioProjects,
  updateMyPortfolioProjectPhoto,
  updateMyPortfolioProject,
  uploadMyPortfolioProjectPhoto,
} from '../../api/portfolio'
import { fetchPublicProfileByUsername } from '../../api/profiles'
import { fetchOpportunityCollaborationSuggestions, fetchProfileCollaborationSuggestions, fetchVacancyCollaborationSuggestions } from '../../api/search'
import { fetchMyFollowerSubscriptions, fetchMyFollowingSubscriptions, followUser, type SubscriptionUser, unfollowUser } from '../../api/subscriptions'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'
import { API_ORIGIN } from '../../config/api'
import { useCity } from '../../contexts/CityContext'
import { useApplications } from '../../hooks/useApplications'
import { useAuth } from '../../hooks/useAuth'
import type { TagListItem } from '../../types/catalog'
import type { Company } from '../../types/company'
import type { CandidateGender, SeekerProfile, SeekerSettings } from '../../types/me'
import type { Opportunity } from '../../types/opportunity'
import type { PublicPortfolioProjectDetail, PublicPortfolioProjectCard } from '../../types/portfolio'
import type { PublicProfile } from '../../types/public-profile'
import type { SeekerResume } from '../../types/resume'
import { getFavoriteOpportunityIds, subscribeToFavoriteOpportunities } from '../../utils/favorites'
import { formatSkillLevelDisplay, SKILL_LEVEL_OPTIONS } from '../../utils/skill-levels'

type TabId = 'responses' | 'favorites' | 'resume' | 'profile'
type SubscriptionTabId = 'seekers' | 'employers'
type ProfilePanelId = 'portfolio' | 'info' | 'subscriptions'
type FollowMode = 'subscriptions' | 'subscribers'
type ProfileGenderValue = '' | '0' | '1' | '2'

type ProfileFormState = {
  firstName: string
  lastName: string
  middleName: string
  birthDate: string
  gender: ProfileGenderValue
  phone: string
  about: string
  avatarUrl: string
}

type SubscriptionProjectPreview = {
  projectId: number
  title: string
  imageUrl: string | null
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'profile', label: 'Профиль' },
  { id: 'resume', label: 'Резюме' },
  { id: 'responses', label: 'Отклики' },
  { id: 'favorites', label: 'Избранное' },
]

const resumeSteps = ['Основная информация', 'Скиллы', 'Опыт работы', 'Портфолио', 'Образование', 'Ссылки на соцсети']
const subscriptionTabs: Array<{ id: SubscriptionTabId; label: string }> = [
  { id: 'seekers', label: 'Соискатели' },
  { id: 'employers', label: 'Работодатели' },
]
const profilePanels: Array<{ id: ProfilePanelId; label: string }> = [
  { id: 'portfolio', label: 'Портфолио' },
  { id: 'info', label: 'Информация' },
  { id: 'subscriptions', label: 'Подписки' },
]

const profileGenderOptions: Array<{ value: ProfileGenderValue; label: string }> = [
  { value: '', label: 'Не указан' },
  { value: '1', label: 'Мужской' },
  { value: '2', label: 'Женский' },
]

const portfolioMockPhotos = [
  'https://placehold.co/300x300?text=Work+1',
  'https://placehold.co/300x300?text=Work+2',
  'https://placehold.co/300x300?text=Work+3',
  'https://placehold.co/300x300?text=Work+4',
  'https://placehold.co/300x300?text=Work+5',
  'https://placehold.co/300x300?text=Work+6',
  'https://placehold.co/300x300?text=Work+7',
  'https://placehold.co/300x300?text=Work+8',
  'https://placehold.co/300x300?text=Work+9',
  'https://placehold.co/300x300?text=Work+10',
]

const initialResume = (userId = 0): SeekerResume => ({
  userId,
  headline: '',
  desiredPosition: '',
  summary: '',
  salaryFrom: null,
  salaryTo: null,
  currencyCode: 'RUB',
  skills: [],
  experiences: [],
  projects: [],
  education: [],
  links: [],
})

const initialProject = {
  title: '',
  role: '',
  description: '',
  startDate: '',
  endDate: '',
  repoUrl: '',
  demoUrl: '',
  isPrivate: false,
}

type ProjectPhotoDraft = {
  id: string
  file: File
  previewUrl: string
  isMain: boolean
}

type ProjectParticipantDraft = {
  id: string
  userId: number
  username: string
  role: string
}

type CollaborationType = 'vacancy' | 'opportunity'

type ProjectCollaborationDraft = {
  id: string
  type: CollaborationType
  itemId: number
  title: string
}

const initialEducation = {
  university: '',
  faculty: '',
  specialty: '',
  course: '',
  graduationYear: '',
}

const initialLink = {
  kind: 'github',
  url: '',
  label: '',
}

const initialExperience = {
  companyId: '',
  companyName: '',
  position: '',
  description: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
}

type ProfileVisibilityMode = 'public' | 'private'

const PRIVACY_SCOPE_PRIVATE = 1
const PRIVACY_SCOPE_AUTHORIZED_USERS = 3
const PORTFOLIO_COLLABORATION_VACANCY = 2
const PORTFOLIO_COLLABORATION_OPPORTUNITY = 3
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024
const DEFAULT_PROFILE_CITY = 'Нижний Тагил'
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])
const SOCIAL_ICON_SRC: Record<string, string> = {
  vk: '/social-icons/vk.svg',
  ok: '/social-icons/odnoklassniki.svg',
  telegram: '/social-icons/telegram.svg',
  rutube: '/social-icons/rutube.svg',
  max: '/social-icons/max.svg',
  dzen: '/social-icons/dzen.svg',
  youtube: '/social-icons/youtube.svg',
  github: '/social-icons/github.svg',
  gitlab: '/social-icons/gitlab.svg',
  instagram: '/social-icons/instagram.svg',
  linkedin: '/social-icons/linkedin.svg',
  x: '/social-icons/x.svg',
  facebook: '/social-icons/facebook.svg',
  tiktok: '/social-icons/tiktok.svg',
  twitch: '/social-icons/twitch.svg',
  behance: '/social-icons/behance.svg',
  dribbble: '/social-icons/dribbble.svg',
  hh: '/social-icons/hh.png',
  habr: '/social-icons/habr.svg',
}

type SpecializationRule = {
  label: string
  patterns: RegExp[]
}

const SPECIALIZATION_RULES: SpecializationRule[] = [
  {
    label: 'Frontend',
    patterns: [
      /\bfront[\s-]?end\b/i, /\breact\b/i, /\bvue\b/i, /\bangular\b/i, /\bjavascript\b/i, /\btypescript\b/i,
      /\bhtml\b/i, /\bcss\b/i, /\bsass\b/i, /\bscss\b/i, /\bnext\b/i, /\bnuxt\b/i, /\bredux\b/i, /\bweb\b/i,
      /фронт/i, /вёрстк/i,
    ],
  },
  {
    label: 'Backend',
    patterns: [
      /\bback[\s-]?end\b/i, /\bnode\b/i, /\bnest\b/i, /\bexpress\b/i, /\bjava\b/i, /\bspring\b/i, /\bphp\b/i,
      /\blaravel\b/i, /\bpython\b/i, /\bdjango\b/i, /\bflask\b/i, /\bgo\b/i, /\bgolang\b/i, /\bc#\b/i,
      /\basp\.?net\b/i, /\bpostgres/i, /\bmysql\b/i, /\bsql\b/i, /бэкенд/i,
    ],
  },
  {
    label: 'DevOps',
    patterns: [
      /\bdevops\b/i, /\bkubernetes\b/i, /\bk8s\b/i, /\bdocker\b/i, /\bterraform\b/i, /\bansible\b/i,
      /\bjenkins\b/i, /\bci\/cd\b/i, /\bgitlab ci\b/i, /\bprometheus\b/i, /\bgrafana\b/i, /\bnginx\b/i, /девопс/i,
    ],
  },
  {
    label: 'Mobile',
    patterns: [/\bmobile\b/i, /\bandroid\b/i, /\bios\b/i, /\bflutter\b/i, /\breact native\b/i, /\bkotlin\b/i, /\bswift\b/i, /мобил/i],
  },
  {
    label: 'Data Science',
    patterns: [
      /\bdata science\b/i, /\bmachine learning\b/i, /\bml\b/i, /\bai\b/i, /\bpytorch\b/i, /\btensorflow\b/i,
      /\bpandas\b/i, /\bnumpy\b/i, /\banalytics?\b/i, /данн/i, /аналитик/i,
    ],
  },
  {
    label: 'QA',
    patterns: [/\bqa\b/i, /\btest(ing)?\b/i, /\bselenium\b/i, /\bcypress\b/i, /\bplaywright\b/i, /тестир/i, /автотест/i],
  },
  {
    label: 'Design',
    patterns: [/\bui\b/i, /\bux\b/i, /\bfigma\b/i, /\bphotoshop\b/i, /\billustrator\b/i, /\bdesign\b/i, /дизайн/i],
  },
]

function resolveProfileVisibilityMode(settings: Pick<SeekerSettings, 'profileVisibility' | 'resumeVisibility'>): ProfileVisibilityMode {
  return settings.profileVisibility === PRIVACY_SCOPE_PRIVATE || settings.resumeVisibility === PRIVACY_SCOPE_PRIVATE
    ? 'private'
    : 'public'
}

function toResumeAndProfileScope(mode: ProfileVisibilityMode) {
  return mode === 'private' ? PRIVACY_SCOPE_PRIVATE : PRIVACY_SCOPE_AUTHORIZED_USERS
}

function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return value.startsWith('/') ? `${API_ORIGIN}${value}` : `${API_ORIGIN}/${value}`
}

function normalizeUsernameKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function formatPhone(rawValue: string) {
  let digits = rawValue.replace(/\D/g, '')
  if (!digits) return ''
  if (digits[0] === '8') digits = `7${digits.slice(1)}`
  if (digits[0] !== '7') digits = `7${digits}`
  digits = digits.slice(0, 11)
  const code = digits.slice(1, 4)
  const p1 = digits.slice(4, 7)
  const p2 = digits.slice(7, 9)
  const p3 = digits.slice(9, 11)
  return `+7${code ? ` (${code}` : ''}${code.length === 3 ? ')' : ''}${p1 ? ` ${p1}` : ''}${p2 ? `-${p2}` : ''}${p3 ? `-${p3}` : ''}`
}

function toNullable(value: string) {
  const normalized = value.trim()
  return normalized ? normalized : null
}

function getTodayDateInputValue() {
  const now = new Date()
  const offsetMinutes = now.getTimezoneOffset()
  return new Date(now.getTime() - offsetMinutes * 60000).toISOString().slice(0, 10)
}

function normalizeProfileGender(value: CandidateGender | null | undefined): ProfileGenderValue {
  if (value === 1 || value === 2) {
    return String(value) as ProfileGenderValue
  }

  return ''
}

function createProfileForm(profile: SeekerProfile): ProfileFormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName ?? '',
    birthDate: profile.birthDate ?? '',
    gender: normalizeProfileGender(profile.gender),
    phone: profile.phone ? formatPhone(profile.phone) : '',
    about: profile.about ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  }
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function validateProfileImageFile(file: File) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return 'Допустимы только JPG, PNG, WEBP, GIF или SVG.'
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return 'Размер файла не должен превышать 10 МБ.'
  }

  return null
}

function normalizeSkillLevel(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.round(parsed)))
}

function normalizeYearsExperience(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.round(parsed))
}

function resolveSocialLinkKind(kind: string | null | undefined, url: string) {
  const normalizedKind = kind?.trim().toLowerCase() ?? ''
  let hostname = ''
  let pathname = ''

  try {
    const parsed = new URL(normalizeUrl(url))
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    pathname = parsed.pathname.toLowerCase()
  } catch {
    hostname = ''
    pathname = ''
  }

  const source = `${normalizedKind} ${hostname} ${pathname}`

  if (source.includes('telegram') || source.includes('t.me') || source.includes('tg://')) {
    return 'telegram'
  }

  if (source.includes('vk.com') || source.includes('vk.ru') || source.includes('vkontakte') || source.includes(' вк')) {
    return 'vk'
  }

  if (source.includes('odnoklass') || source.includes('ok.ru') || source.includes('однокласс')) {
    return 'ok'
  }

  if (source.includes('rutube') || source.includes('rutube.ru') || source.includes('рутуб')) {
    return 'rutube'
  }

  if (
    source.includes('max.ru') ||
    normalizedKind === 'max' ||
    normalizedKind.startsWith('max ') ||
    normalizedKind.includes('макс')
  ) {
    return 'max'
  }

  if (source.includes('dzen.ru') || source.includes('zen.yandex.ru') || source.includes('dzen') || source.includes('дзен')) {
    return 'dzen'
  }

  if (source.includes('youtube.com') || source.includes('youtu.be')) {
    return 'youtube'
  }

  if (source.includes('github.com')) {
    return 'github'
  }

  if (source.includes('gitlab.com')) {
    return 'gitlab'
  }

  if (source.includes('instagram.com')) {
    return 'instagram'
  }

  if (source.includes('linkedin.com') || source.includes('linked.in') || source.includes('linkedin')) {
    return 'linkedin'
  }

  if (source.includes('twitter.com') || source.includes('x.com') || source.includes(' twitter') || source.includes(' x ')) {
    return 'x'
  }

  if (source.includes('facebook.com') || source.includes('fb.com')) {
    return 'facebook'
  }

  if (source.includes('tiktok.com') || source.includes('tiktok')) {
    return 'tiktok'
  }

  if (source.includes('twitch.tv') || source.includes('twitch')) {
    return 'twitch'
  }

  if (source.includes('behance.net') || source.includes('behance')) {
    return 'behance'
  }

  if (source.includes('dribbble.com') || source.includes('dribbble')) {
    return 'dribbble'
  }

  if (source.includes('hh.ru') || source.includes('headhunter') || source.includes('хх')) {
    return 'hh'
  }

  if (source.includes('habr.com') || source.includes('habr.ru') || source.includes('habr')) {
    return 'habr'
  }

  if (normalizedKind.includes('site') || normalizedKind.includes('website') || normalizedKind.includes('portfolio') || normalizedKind.includes('сайт')) {
    return 'website'
  }

  return 'other'
}

function renderSocialLinkIcon(kind: string, label: string) {
  const src = SOCIAL_ICON_SRC[kind]
  if (src) {
    return <img src={src} alt={label} loading="lazy" />
  }

  if (kind === 'telegram') {
    return <Send size={18} />
  }

  if (kind === 'github') {
    return <Github size={18} />
  }

  if (kind === 'linkedin') {
    return <Linkedin size={18} />
  }

  if (kind === 'website') {
    return <Globe size={18} />
  }

  if (kind === 'vk') {
    return <Users size={18} />
  }

  return <LinkIcon size={18} />
}

function detectSpecialization(resume: SeekerResume) {
  const scores = new Map<string, number>()

  for (const skill of resume.skills) {
    const skillName = skill.tagName?.trim()
    if (!skillName) {
      continue
    }

    const level = Number.isFinite(skill.level) ? Math.max(skill.level, 1) : 1
    const years = Number.isFinite(skill.yearsExperience) ? Math.max(skill.yearsExperience, 0) : 0
    const weight = level + Math.min(years, 10) * 0.5

    for (const rule of SPECIALIZATION_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(skillName))) {
        scores.set(rule.label, (scores.get(rule.label) ?? 0) + weight)
      }
    }
  }

  const headlineSource = `${resume.desiredPosition} ${resume.headline}`.trim()
  if (headlineSource) {
    for (const rule of SPECIALIZATION_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(headlineSource))) {
        scores.set(rule.label, (scores.get(rule.label) ?? 0) + 2)
      }
    }
  }

  const frontendScore = scores.get('Frontend') ?? 0
  const backendScore = scores.get('Backend') ?? 0
  if (frontendScore >= 4 && backendScore >= 4) {
    const diff = Math.abs(frontendScore - backendScore)
    if (diff <= Math.max(frontendScore, backendScore) * 0.35) {
      return 'Fullstack'
    }
  }

  let winner = ''
  let bestScore = 0
  for (const [label, score] of scores.entries()) {
    if (score > bestScore) {
      winner = label
      bestScore = score
    }
  }

  return winner || 'Frontend'
}

function mergeProjectPhotos(
  projects: SeekerResume['projects'],
  photoItems: Array<{ projectId: number; mainPhotoUrl: string | null }>,
) {
  const photoMap = new Map(photoItems.map((item) => [item.projectId, item.mainPhotoUrl] as const))

  return projects.map((project) => ({
    ...project,
    mainPhotoUrl: photoMap.get(project.id) ?? project.mainPhotoUrl ?? null,
  }))
}

function normalizeProjectPayload(
  project: typeof initialProject,
  participants: ProjectParticipantDraft[],
  collaborations: ProjectCollaborationDraft[],
) {
  const normalizedParticipants = participants
    .map((participant) => ({
      userId: participant.userId,
      role: participant.role.trim(),
    }))
    .filter((participant) => Number.isFinite(participant.userId) && participant.userId > 0)

  const normalizedCollaborations = collaborations.map((collaboration, index) => ({
    type: collaboration.type === 'vacancy' ? PORTFOLIO_COLLABORATION_VACANCY : PORTFOLIO_COLLABORATION_OPPORTUNITY,
    userId: null,
    vacancyId: collaboration.type === 'vacancy' ? collaboration.itemId : null,
    opportunityId: collaboration.type === 'opportunity' ? collaboration.itemId : null,
    label: collaboration.title,
    sortOrder: index,
  }))

  return {
    title: project.title.trim(),
    role: project.role.trim() || null,
    description: project.description.trim() || null,
    startDate: project.startDate || null,
    endDate: project.endDate || null,
    repoUrl: normalizeUrl(project.repoUrl) || null,
    demoUrl: normalizeUrl(project.demoUrl) || null,
    isPrivate: Boolean(project.isPrivate),
    participants: normalizedParticipants,
    collaborations: normalizedCollaborations,
  }
}

function mapPublicProfileToSeekerProfile(publicProfile: PublicProfile): SeekerProfile {
  return {
    userId: publicProfile.userId,
    username: publicProfile.username,
    firstName: publicProfile.firstName || '',
    lastName: publicProfile.lastName || '',
    middleName: publicProfile.middleName,
    birthDate: publicProfile.birthDate,
    gender: publicProfile.gender === 1 || publicProfile.gender === 2 ? publicProfile.gender : 0,
    phone: publicProfile.phone,
    about: publicProfile.about,
    avatarUrl: publicProfile.avatarUrl,
  }
}

function mapPublicProfileToSeekerResume(publicProfile: PublicProfile): SeekerResume {
  const resume = publicProfile.resume
  return {
    ...initialResume(publicProfile.userId),
    headline: resume?.headline ?? '',
    desiredPosition: resume?.desiredPosition ?? '',
    summary: resume?.summary ?? '',
    salaryFrom: resume?.salaryFrom ?? null,
    salaryTo: resume?.salaryTo ?? null,
    currencyCode: resume?.currencyCode || 'RUB',
    projects: (resume?.projects ?? []).map((project) => ({
      id: project.id,
      title: project.title || 'Проект без названия',
      role: project.role || '',
      description: project.description || '',
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      repoUrl: project.repoUrl || '',
      demoUrl: project.demoUrl || '',
      mainPhotoUrl: null,
      isPrivate: false,
    })),
  }
}

function mergePublicProjects(
  projects: SeekerResume['projects'],
  publicProjects: PublicPortfolioProjectCard[],
) {
  const map = new Map<number, SeekerResume['projects'][number]>()

  for (const project of projects) {
    map.set(project.id, project)
  }

  for (const project of publicProjects) {
    const current = map.get(project.projectId)
    if (current) {
      map.set(project.projectId, {
        ...current,
        title: current.title || project.title || 'Проект без названия',
        role: current.role || project.primaryRole || '',
        description: current.description || project.shortDescription || '',
        mainPhotoUrl: project.mainPhotoUrl ?? current.mainPhotoUrl ?? null,
      })
      continue
    }

    map.set(project.projectId, {
      id: project.projectId,
      title: project.title || 'Проект без названия',
      role: project.primaryRole || '',
      description: project.shortDescription || '',
      startDate: '',
      endDate: '',
      repoUrl: '',
      demoUrl: '',
      mainPhotoUrl: project.mainPhotoUrl ?? null,
      isPrivate: false,
    })
  }

  return Array.from(map.values())
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('aborted') || message.includes('aborterror') || message.includes('signal is aborted')
  }

  return false
}

type SuggestOption = {
  id: number
  title: string
  subtitle?: string
}

type SuggestListProps = {
  items: SuggestOption[]
  onSelect: (item: SuggestOption) => void
}

function SuggestList({ items, onSelect }: SuggestListProps) {
  if (!items.length) {
    return null
  }

  return (
    <div className="resume-suggest-list">
      {items.map((item) => (
        <button key={`suggest-${item.id}-${item.title}`} type="button" className="btn btn--ghost" onClick={() => onSelect(item)}>
          <strong>{item.title}</strong>
          {item.subtitle ? <span>{item.subtitle}</span> : null}
        </button>
      ))}
    </div>
  )
}

type PortfolioProjectModalProps = {
  open: boolean
  savingPortfolio: boolean
  projectForm: typeof initialProject
  projectPhotoFiles: ProjectPhotoDraft[]
  participantUsernameQuery: string
  participantRole: string
  projectParticipants: ProjectParticipantDraft[]
  vacancyQuery: string
  opportunityQuery: string
  projectCollaborations: ProjectCollaborationDraft[]
  profileSuggestions: SuggestOption[]
  vacancySuggestions: SuggestOption[]
  opportunitySuggestions: SuggestOption[]
  onClose: () => void
  onProjectFormChange: (next: typeof initialProject) => void
  onProjectPhotosSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onSetMainProjectPhotoDraft: (id: string) => void
  onRemoveProjectPhotoDraft: (id: string) => void
  onParticipantUsernameQueryChange: (value: string) => void
  onParticipantRoleChange: (value: string) => void
  onParticipantSelect: (item: SuggestOption) => void
  onAddProjectParticipant: () => void
  onRemoveParticipant: (id: string) => void
  onVacancyQueryChange: (value: string) => void
  onOpportunityQueryChange: (value: string) => void
  onVacancySelect: (item: SuggestOption) => void
  onOpportunitySelect: (item: SuggestOption) => void
  onRemoveCollaboration: (id: string) => void
  onCreatePortfolioProject: () => void
}

function PortfolioProjectModal({
  open,
  savingPortfolio,
  projectForm,
  projectPhotoFiles,
  participantUsernameQuery,
  participantRole,
  projectParticipants,
  vacancyQuery,
  opportunityQuery,
  projectCollaborations,
  profileSuggestions,
  vacancySuggestions,
  opportunitySuggestions,
  onClose,
  onProjectFormChange,
  onProjectPhotosSelected,
  onSetMainProjectPhotoDraft,
  onRemoveProjectPhotoDraft,
  onParticipantUsernameQueryChange,
  onParticipantRoleChange,
  onParticipantSelect,
  onAddProjectParticipant,
  onRemoveParticipant,
  onVacancyQueryChange,
  onOpportunityQueryChange,
  onVacancySelect,
  onOpportunitySelect,
  onRemoveCollaboration,
  onCreatePortfolioProject,
}: PortfolioProjectModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-project-modal-title">
      <div className="profile-settings-modal__backdrop" onClick={() => !savingPortfolio && onClose()} />
      <div className="card profile-settings-modal__dialog">
        <div className="profile-settings-modal__head">
          <h2 id="portfolio-project-modal-title">Добавить проект</h2>
          <button type="button" className="btn btn--icon" onClick={() => !savingPortfolio && onClose()} aria-label="Закрыть"><X size={16} /></button>
        </div>

        <div className="resume-step-body">
          <div className="form-grid form-grid--two">
            <label>Название проекта<input value={projectForm.title} onChange={(e) => onProjectFormChange({ ...projectForm, title: e.target.value })} /></label>
            <label>Роль<input value={projectForm.role} onChange={(e) => onProjectFormChange({ ...projectForm, role: e.target.value })} /></label>
            <label>Дата начала<input type="date" value={projectForm.startDate} onChange={(e) => onProjectFormChange({ ...projectForm, startDate: e.target.value })} /></label>
            <label>Дата окончания<input type="date" value={projectForm.endDate} onChange={(e) => onProjectFormChange({ ...projectForm, endDate: e.target.value })} /></label>
            <label>Repo URL<input value={projectForm.repoUrl} onChange={(e) => onProjectFormChange({ ...projectForm, repoUrl: e.target.value })} /></label>
            <label>Demo URL<input value={projectForm.demoUrl} onChange={(e) => onProjectFormChange({ ...projectForm, demoUrl: e.target.value })} /></label>
            <label className="full-width resume-privacy-toggle">
              <input
                type="checkbox"
                checked={projectForm.isPrivate}
                onChange={(e) => onProjectFormChange({ ...projectForm, isPrivate: e.target.checked })}
              />
              Скрыть проект из публичного портфолио
            </label>
            <label className="full-width">Описание<textarea rows={3} value={projectForm.description} onChange={(e) => onProjectFormChange({ ...projectForm, description: e.target.value })} /></label>
            <label className="full-width portfolio-upload">
              Фото проекта
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                multiple
                onChange={onProjectPhotosSelected}
              />
              <span className="portfolio-upload__hint">Можно выбрать несколько фото. Выберите главное. JPG, PNG, WEBP, GIF или SVG (до 10 МБ каждое).</span>
            </label>
          </div>

          {projectPhotoFiles.length ? (
            <div className="portfolio-photo-drafts">
              {projectPhotoFiles.map((draft) => (
                <article key={draft.id} className="portfolio-photo-draft-card">
                  <img src={draft.previewUrl} alt={draft.file.name} />
                  <div className="portfolio-photo-draft-card__controls">
                    <label>
                      <input type="radio" name="project-main-photo" checked={draft.isMain} onChange={() => onSetMainProjectPhotoDraft(draft.id)} />
                      Главное фото
                    </label>
                    <button type="button" className="btn btn--ghost" onClick={() => onRemoveProjectPhotoDraft(draft.id)}>Удалить</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="form-grid form-grid--two">
            <label>Username участника<input value={participantUsernameQuery} onChange={(e) => onParticipantUsernameQueryChange(e.target.value)} placeholder="@username" /></label>
            <label>Роль участника<input value={participantRole} onChange={(e) => onParticipantRoleChange(e.target.value)} /></label>
          </div>
          <SuggestList items={profileSuggestions} onSelect={onParticipantSelect} />
          <button type="button" className="btn btn--ghost" onClick={onAddProjectParticipant}>Добавить участника</button>

          {projectParticipants.length ? (
            <div className="resume-collection">
              {projectParticipants.map((participant) => (
                <article key={participant.id} className="resume-collection-card">
                  <div>
                    <strong>@{participant.username}</strong>
                    <p>{participant.role || 'Роль не указана'}</p>
                  </div>
                  <button type="button" className="btn btn--ghost" onClick={() => onRemoveParticipant(participant.id)}>
                    Удалить
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          <div className="form-grid form-grid--two">
            <label className="full-width">
              Коллаборация с компанией/вакансией
              <input value={vacancyQuery} onChange={(e) => onVacancyQueryChange(e.target.value)} placeholder="Начните вводить вакансию..." />
            </label>
            <label className="full-width">
              Коллаборация с мероприятием
              <input value={opportunityQuery} onChange={(e) => onOpportunityQueryChange(e.target.value)} placeholder="Начните вводить мероприятие..." />
            </label>
          </div>
          <SuggestList items={vacancySuggestions} onSelect={onVacancySelect} />
          <SuggestList items={opportunitySuggestions} onSelect={onOpportunitySelect} />

          {projectCollaborations.length ? (
            <div className="resume-collection">
              {projectCollaborations.map((item) => (
                <article key={item.id} className="resume-collection-card">
                  <div>
                    <strong>{item.type === 'vacancy' ? 'Vacancy' : 'Opportunity'} #{item.itemId}</strong>
                    <p>{item.title}</p>
                  </div>
                  <button type="button" className="btn btn--ghost" onClick={() => onRemoveCollaboration(item.id)}>
                    Удалить
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          <div className="resume-step-actions resume-step-actions--start">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={savingPortfolio}>
              Отмена
            </button>
            <button type="button" className="btn btn--primary" disabled={savingPortfolio} onClick={onCreatePortfolioProject}>
              {savingPortfolio ? 'Сохраняем...' : 'Сохранить проект'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function storageKey(userId: number) {
  return `tramplin.resume.extended.${userId}`
}

function saveResumeLocal(resume: SeekerResume) {
  if (typeof window === 'undefined' || !resume.userId) return
  window.localStorage.setItem(storageKey(resume.userId), JSON.stringify(resume))
}

function loadResumeLocal(userId: number) {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SeekerResume
  } catch {
    window.localStorage.removeItem(storageKey(userId))
    return null
  }
}

export function SeekerDashboardPage() {
  const location = useLocation()
  const { username: routeUsername } = useParams<{ username?: string }>()
  const publicUsername = routeUsername?.trim() ?? ''
  const isPublicReadOnlyMode = Boolean(publicUsername)
  const { session, signIn } = useAuth()
  const { selectedCity } = useCity()
  const { applications, hasApplied, isLoading: loadingApplications, error: applicationsError } = useApplications(!isPublicReadOnlyMode)
  const [tab, setTab] = useState<TabId>('profile')
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<SeekerProfile | null>(null)
  const [resume, setResume] = useState<SeekerResume>(initialResume())
  const [resumeCompanies, setResumeCompanies] = useState<Company[]>([])
  const [tags, setTags] = useState<TagListItem[]>([])
  const [favoriteOpportunities, setFavoriteOpportunities] = useState<Opportunity[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => getFavoriteOpportunityIds())
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})
  const [followingUsers, setFollowingUsers] = useState<SubscriptionUser[]>([])
  const [followerUsers, setFollowerUsers] = useState<SubscriptionUser[]>([])
  const [subscriptionsTab, setSubscriptionsTab] = useState<SubscriptionTabId>('seekers')
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState<Record<number, boolean>>({})
  const [subscriptionProjectsByUser, setSubscriptionProjectsByUser] = useState<Record<string, SubscriptionProjectPreview[]>>({})
  const [portfolioProjectCards, setPortfolioProjectCards] = useState<PublicPortfolioProjectCard[]>([])
  const [profilePanel, setProfilePanel] = useState<ProfilePanelId>('portfolio')
  const [followMode, setFollowMode] = useState<FollowMode>('subscriptions')

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    middleName: '',
    birthDate: '',
    gender: '',
    phone: '',
    about: '',
    avatarUrl: '',
  })
  const [projectForm, setProjectForm] = useState(initialProject)
  const [projectPhotoFiles, setProjectPhotoFiles] = useState<ProjectPhotoDraft[]>([])
  const projectPhotoFilesRef = useRef<ProjectPhotoDraft[]>([])
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipantDraft[]>([])
  const [projectCollaborations, setProjectCollaborations] = useState<ProjectCollaborationDraft[]>([])
  const [participantUsernameQuery, setParticipantUsernameQuery] = useState('')
  const [participantSuggestions, setParticipantSuggestions] = useState<SuggestOption[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState<{ userId: number; username: string } | null>(null)
  const [participantRole, setParticipantRole] = useState('')
  const [vacancyQuery, setVacancyQuery] = useState('')
  const [opportunityQuery, setOpportunityQuery] = useState('')
  const [vacancySuggestions, setVacancySuggestions] = useState<SuggestOption[]>([])
  const [opportunitySuggestions, setOpportunitySuggestions] = useState<SuggestOption[]>([])
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [experienceForm, setExperienceForm] = useState(initialExperience)
  const [educationForm, setEducationForm] = useState(initialEducation)
  const [linkForm, setLinkForm] = useState(initialLink)
  const [skillTagId, setSkillTagId] = useState<number | null>(null)
  const [skillLevel, setSkillLevel] = useState('3')
  const [skillYears, setSkillYears] = useState('1')

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingResume, setLoadingResume] = useState(true)
  const [loadingFavorites, setLoadingFavorites] = useState(true)
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingResume, setSavingResume] = useState(false)
  const [savingPortfolio, setSavingPortfolio] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibilityMode>('public')
  const [seekerSettings, setSeekerSettings] = useState<SeekerSettings | null>(null)
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(null)

  const [profileError, setProfileError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [portfolioError, setPortfolioError] = useState('')
  const [favoritesError, setFavoritesError] = useState('')
  const [subscriptionsError, setSubscriptionsError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeProjectPhotoManagerId, setActiveProjectPhotoManagerId] = useState<number | null>(null)
  const [activeProjectPhotos, setActiveProjectPhotos] = useState<PublicPortfolioProjectDetail['photos']>([])
  const [loadingActiveProjectPhotos, setLoadingActiveProjectPhotos] = useState(false)
  const [updatingProjectPhotos, setUpdatingProjectPhotos] = useState(false)
  const [isPublicProfileHidden, setIsPublicProfileHidden] = useState(false)

  const isResumeEditMode = location.pathname.startsWith('/dashboard/seeker/resume/edit')

  useEffect(() => {
    if (isResumeEditMode || isPublicReadOnlyMode) {
      return
    }

    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    if (tabParam === 'responses' || tabParam === 'favorites' || tabParam === 'resume' || tabParam === 'profile') {
      setTab(tabParam)
    }
  }, [isPublicReadOnlyMode, isResumeEditMode, location.search])

  useEffect(() => {
    if (!isPublicReadOnlyMode) {
      return
    }

    setTab('profile')
    if (profilePanel === 'subscriptions') {
      setProfilePanel('portfolio')
    }
  }, [isPublicReadOnlyMode, profilePanel])

  useEffect(() => {
    const controller = new AbortController()

    async function loadPublicData() {
      setProfileError('')
      setResumeError('')
      setPortfolioError('')
      setSubscriptionsError('')
      setLoadingProfile(true)
      setLoadingResume(true)
      setLoadingSubscriptions(false)
      setLoadingFavorites(false)
      setFavoriteOpportunities([])
      setFollowingUsers([])
      setFollowerUsers([])
      setSubscriptionProjectsByUser({})
      setPortfolioProjectCards([])
      setSeekerSettings(null)
      setProfileVisibility('public')
      setProfileBannerUrl(null)
      setIsPublicProfileHidden(false)

      const [profileResult, portfolioResult] = await Promise.allSettled([
        fetchPublicProfileByUsername(publicUsername, controller.signal),
        fetchPublicPortfolioProjects(publicUsername, controller.signal),
      ])

      if (controller.signal.aborted) {
        return
      }

      if (profileResult.status === 'fulfilled') {
        const publicProfile = profileResult.value
        const hiddenProfile = publicProfile.visibilityMode === 'hidden' || publicProfile.resume == null
        setIsPublicProfileHidden(hiddenProfile)
        setProfileBannerUrl(publicProfile.profileBannerUrl ?? null)

        const mappedProfile = mapPublicProfileToSeekerProfile(profileResult.value)
        const mappedResume = mapPublicProfileToSeekerResume(profileResult.value)
        const portfolioProjects = portfolioResult.status === 'fulfilled' ? portfolioResult.value : []
        setPortfolioProjectCards(portfolioProjects)
        const mergedResume = {
          ...mappedResume,
          projects: mergePublicProjects(mappedResume.projects, portfolioProjects),
        }

        setProfile(mappedProfile)
        setProfileForm(createProfileForm(mappedProfile))
        setResume(mergedResume)
      } else if (!isAbortError(profileResult.reason)) {
        setProfile(null)
        setResume(initialResume())
        setPortfolioProjectCards([])
        setIsPublicProfileHidden(false)
        setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Профиль не найден.')
      }

      if (portfolioResult.status === 'rejected' && !isAbortError(portfolioResult.reason)) {
        setPortfolioError(portfolioResult.reason instanceof Error ? portfolioResult.reason.message : 'Не удалось загрузить портфолио.')
      }

      if (!controller.signal.aborted) {
        setLoadingProfile(false)
        setLoadingResume(false)
      }
    }

    async function loadOwnerData() {
      setProfileError('')
      setResumeError('')
      setPortfolioError('')
      setSubscriptionsError('')
      setPortfolioProjectCards([])
      setLoadingProfile(true)
      setLoadingResume(true)
      setLoadingSubscriptions(true)

      const portfolioPromise = session?.user?.username
        ? fetchPublicPortfolioProjects(session.user.username, controller.signal)
        : Promise.resolve([] as PublicPortfolioProjectCard[])

      const [meResult, profileResult, resumeResult, settingsResult, tagsResult, companiesResult, followingResult, followersResult, portfolioResult] = await Promise.allSettled([
        fetchMe(controller.signal),
        fetchSeekerProfile(controller.signal),
        fetchSeekerResume(controller.signal),
        fetchSeekerSettings(controller.signal),
        fetchTags(controller.signal),
        fetchCompanies({ page: 1, pageSize: 100, verifiedOnly: true }, controller.signal),
        fetchMyFollowingSubscriptions(controller.signal),
        fetchMyFollowerSubscriptions(controller.signal),
        portfolioPromise,
      ])

      if (controller.signal.aborted) {
        return
      }

      if (meResult.status === 'fulfilled') {
        setProfileBannerUrl(meResult.value.profileBannerUrl ?? null)
      }

      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value
        setProfile(p)
        setProfileForm(createProfileForm(p))

      } else if (!isAbortError(profileResult.reason)) {
        setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Ошибка загрузки профиля.')
      }

      if (resumeResult.status === 'fulfilled') {
        const apiResume = resumeResult.value
        const local = loadResumeLocal(apiResume.userId)
        const sourceResume = local
          ? {
              ...apiResume,
              headline: apiResume.headline || local.headline,
              desiredPosition: apiResume.desiredPosition || local.desiredPosition,
              summary: apiResume.summary || local.summary,
              salaryFrom: apiResume.salaryFrom ?? local.salaryFrom,
              salaryTo: apiResume.salaryTo ?? local.salaryTo,
              currencyCode: apiResume.currencyCode || local.currencyCode,
              skills: apiResume.skills.length ? apiResume.skills : local.skills,
              experiences: apiResume.experiences.length ? apiResume.experiences : Array.isArray(local.experiences) ? local.experiences : [],
              projects: apiResume.projects,
              education: apiResume.education.length ? apiResume.education : local.education,
              links: apiResume.links.length ? apiResume.links : local.links,
            }
          : apiResume
        const portfolioProjects = portfolioResult.status === 'fulfilled' ? portfolioResult.value : []
        setPortfolioProjectCards(portfolioProjects)
        const mergedResume = sourceResume.projects.length
          ? {
              ...sourceResume,
              projects: mergeProjectPhotos(sourceResume.projects, portfolioProjects),
            }
          : sourceResume

        setResume(mergedResume)
      } else if (!isAbortError(resumeResult.reason)) {
        setResumeError(resumeResult.reason instanceof Error ? resumeResult.reason.message : 'Ошибка загрузки резюме.')
      }

      if (settingsResult.status === 'fulfilled') {
        setSeekerSettings(settingsResult.value)
        setProfileVisibility(resolveProfileVisibilityMode(settingsResult.value))
      } else if (!isAbortError(settingsResult.reason)) {
        setProfileError((current) => current || (settingsResult.reason instanceof Error ? settingsResult.reason.message : 'Ошибка загрузки настроек приватности.'))
      }

      if (portfolioResult.status === 'rejected' && !isAbortError(portfolioResult.reason)) {
        setPortfolioProjectCards([])
        setPortfolioError(portfolioResult.reason instanceof Error ? portfolioResult.reason.message : 'Не удалось загрузить портфолио.')
      }

      if (tagsResult.status === 'fulfilled') {
        setTags(tagsResult.value)
      }

      if (companiesResult.status === 'fulfilled') {
        setResumeCompanies(companiesResult.value.items)
      }

      if (followingResult.status === 'fulfilled') {
        setFollowingUsers(followingResult.value)
      } else if (!isAbortError(followingResult.reason)) {
        setSubscriptionsError(followingResult.reason instanceof Error ? followingResult.reason.message : 'Ошибка загрузки подписок.')
      }

      if (followersResult.status === 'fulfilled') {
        setFollowerUsers(followersResult.value)
      }

      if (!controller.signal.aborted) {
        setLoadingProfile(false)
        setLoadingResume(false)
        setLoadingSubscriptions(false)
      }
    }

    if (isPublicReadOnlyMode) {
      void loadPublicData()
      return () => controller.abort()
    }

    if (!session?.accessToken) {
      setLoadingProfile(false)
      setLoadingResume(false)
      setLoadingSubscriptions(false)
      setProfileError('Не удалось получить токен авторизации.')
      return
    }

    void loadOwnerData()

    return () => controller.abort()
  }, [isPublicReadOnlyMode, publicUsername, session?.accessToken, session?.user?.username])

  useEffect(() => {
    if (isPublicReadOnlyMode) {
      return
    }
    saveResumeLocal(resume)
  }, [isPublicReadOnlyMode, resume])

  useEffect(() => {
    const unsubscribe = subscribeToFavoriteOpportunities(() => {
      setFavoriteIds(getFavoriteOpportunityIds())
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (isPublicReadOnlyMode) {
      setSubscriptionProjectsByUser({})
      return
    }

    const usernames = Array.from(
      new Set(
        [...followingUsers, ...followerUsers]
          .map((user) => user.username.trim())
          .filter(Boolean),
      ),
    )

    if (!usernames.length) {
      setSubscriptionProjectsByUser({})
      return
    }

    const controller = new AbortController()

    async function loadSubscriptionProjects() {
      const results = await Promise.allSettled(
        usernames.map(async (username) => {
          const projects = await fetchPublicPortfolioProjects(username, controller.signal)
          return {
            usernameKey: normalizeUsernameKey(username),
            projects: projects
              .map((project) => ({
                projectId: project.projectId,
                title: project.title?.trim() || 'Проект без названия',
                imageUrl: resolveAvatarUrl(project.mainPhotoUrl),
              })),
          }
        }),
      )

      if (controller.signal.aborted) {
        return
      }

      const nextMap: Record<string, SubscriptionProjectPreview[]> = {}

      for (const result of results) {
        if (result.status !== 'fulfilled') {
          continue
        }

        nextMap[result.value.usernameKey] = result.value.projects.slice(0, 3)
      }

      setSubscriptionProjectsByUser(nextMap)
    }

    void loadSubscriptionProjects()

    return () => controller.abort()
  }, [followerUsers, followingUsers, isPublicReadOnlyMode])

  useEffect(() => {
    if (isPublicReadOnlyMode) {
      setFavoriteOpportunities([])
      setFavoritesError('')
      setLoadingFavorites(false)
      return
    }

    const controller = new AbortController()

    async function loadFavorites() {
      setLoadingFavorites(true)
      setFavoritesError('')

      if (!favoriteIds.length) {
        setFavoriteOpportunities([])
        setLoadingFavorites(false)
        return
      }

      const results = await Promise.allSettled(favoriteIds.map((id) => fetchOpportunityById(id, controller.signal)))

      if (controller.signal.aborted) {
        return
      }

      const resolved = results
        .filter((result): result is PromiseFulfilledResult<Opportunity> => result.status === 'fulfilled')
        .map((result) => result.value)

      setFavoriteOpportunities(resolved)

      if (!resolved.length && favoriteIds.length) {
        setFavoritesError('Не удалось загрузить избранные вакансии.')
      }

      setLoadingFavorites(false)
    }

    void loadFavorites()

    return () => controller.abort()
  }, [favoriteIds, isPublicReadOnlyMode])

  useEffect(() => {
    projectPhotoFilesRef.current = projectPhotoFiles
  }, [projectPhotoFiles])

  useEffect(() => {
    return () => {
      for (const draft of projectPhotoFilesRef.current) {
        URL.revokeObjectURL(draft.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    const query = participantUsernameQuery.trim().replace(/^@+/, '')
    if (query.length < 1) {
      setParticipantSuggestions([])
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetchProfileCollaborationSuggestions(query, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        const items = response.items
          .filter((item) => item.username)
          .map((item) => ({
            id: item.id,
            title: `@${item.username}`,
            subtitle: item.title && item.title !== item.username ? item.title : undefined,
          }))

        setParticipantSuggestions(items)
      } catch {
        if (!controller.signal.aborted) {
          setParticipantSuggestions([])
        }
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [participantUsernameQuery])

  useEffect(() => {
    const query = vacancyQuery.trim()
    if (query.length < 2) {
      setVacancySuggestions([])
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetchVacancyCollaborationSuggestions(query, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setVacancySuggestions(
          response.items.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: [item.companyName, item.locationName].filter(Boolean).join(' · ') || undefined,
          })),
        )
      } catch {
        if (!controller.signal.aborted) {
          setVacancySuggestions([])
        }
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [vacancyQuery])

  useEffect(() => {
    const query = opportunityQuery.trim()
    if (query.length < 2) {
      setOpportunitySuggestions([])
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetchOpportunityCollaborationSuggestions(query, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setOpportunitySuggestions(
          response.items.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: [item.companyName, item.locationName].filter(Boolean).join(' · ') || undefined,
          })),
        )
      } catch {
        if (!controller.signal.aborted) {
          setOpportunitySuggestions([])
        }
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [opportunityQuery])

  const avatarUrl = useMemo(() => resolveAvatarUrl(profile?.avatarUrl), [profile?.avatarUrl])
  const avatarFormUrl = useMemo(() => resolveAvatarUrl(profileForm.avatarUrl), [profileForm.avatarUrl])
  const bannerUrl = useMemo(() => resolveAvatarUrl(profileBannerUrl), [profileBannerUrl])
  const displayName = useMemo(() => [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Профиль соискателя', [profile])
  const profileCityName = useMemo(() => selectedCity?.name?.trim() || DEFAULT_PROFILE_CITY, [selectedCity?.name])
  const profileSpecialization = useMemo(() => detectSpecialization(resume), [resume])
  const profileRoleTitle = useMemo(() => `${profileSpecialization} ${profileCityName}`.trim(), [profileSpecialization, profileCityName])
  const avatarFallback = useMemo(() => (profile?.firstName?.charAt(0) || profile?.lastName?.charAt(0) || 'P').toUpperCase(), [profile])
  const followingUserIds = useMemo(() => new Set(followingUsers.map((item) => item.userId)), [followingUsers])
  const subscriptionsCount = followingUsers.length
  const subscribersCount = followerUsers.length
  const isForeignProfile = useMemo(() => {
    const currentUsername = session?.user?.username?.trim().toLowerCase()
    const profileUsername = profile?.username?.trim().toLowerCase()

    if (!currentUsername || !profileUsername) {
      return false
    }

    return currentUsername !== profileUsername
  }, [profile?.username, session?.user?.username])
  const availableProfilePanels = useMemo(
    () => (isPublicReadOnlyMode ? profilePanels.filter((item) => item.id !== 'subscriptions') : profilePanels),
    [isPublicReadOnlyMode],
  )
  const projectDetailsBasePath = useMemo(() => {
    if (isPublicReadOnlyMode) {
      return `/dashboard/seeker/${encodeURIComponent(publicUsername)}`
    }
    return '/dashboard/seeker'
  }, [isPublicReadOnlyMode, publicUsername])

  const responsesStats = useMemo(
    () => ({
      total: applications.length,
      success: applications.filter((item) => item.tone === 'success').length,
      warning: applications.filter((item) => item.tone === 'warning').length,
      danger: applications.filter((item) => item.tone === 'danger').length,
    }),
    [applications],
  )

  const seekerSubscriptions = useMemo(() => {
    const source = (followMode === 'subscriptions' ? followingUsers : followerUsers).filter((user) => user.accountType !== 2)
    return source.map((user) => ({
      id: `${followMode}-seeker-${user.userId}`,
      userId: user.userId,
      title: user.displayName?.trim() || user.username?.trim() || `Пользователь #${user.userId}`,
      subtitle: 'Соискатель',
      description: followMode === 'subscriptions' ? 'Вы подписаны на этого пользователя.' : 'Подписан на вас.',
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      previews: subscriptionProjectsByUser[normalizeUsernameKey(user.username)] ?? [],
    }))
  }, [followMode, followerUsers, followingUsers, subscriptionProjectsByUser])

  const employerSubscriptions = useMemo(() => {
    const source = (followMode === 'subscriptions' ? followingUsers : followerUsers).filter((user) => user.accountType === 2)
    return source.map((user) => ({
      id: `${followMode}-employer-${user.userId}`,
      userId: user.userId,
      title: user.organizationName?.trim() || user.displayName?.trim() || user.username?.trim() || `Компания #${user.userId}`,
      subtitle: 'Работодатель',
      description: followMode === 'subscriptions' ? 'Вы подписаны на эту организацию.' : 'Организация подписана на вас.',
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      previews: subscriptionProjectsByUser[normalizeUsernameKey(user.username)] ?? [],
    }))
  }, [followMode, followerUsers, followingUsers, subscriptionProjectsByUser])

  const visiblePortfolioProjects = useMemo(
    () => (isPublicReadOnlyMode ? resume.projects.filter((project) => !project.isPrivate) : resume.projects),
    [isPublicReadOnlyMode, resume.projects],
  )

  const portfolioProjectCardMap = useMemo(
    () => new Map(portfolioProjectCards.map((project) => [project.projectId, project] as const)),
    [portfolioProjectCards],
  )

  const portfolioItems = useMemo(() => {
    return visiblePortfolioProjects.map((project, index) => {
      const card = portfolioProjectCardMap.get(project.id)
      const author = card?.authorFio?.trim() || displayName
      const authorAvatarUrl = resolveAvatarUrl(card?.authorAvatarUrl ?? null)
      return {
        id: `resume-${project.id}`,
        projectId: project.id,
        image: resolveAvatarUrl(project.mainPhotoUrl) ?? portfolioMockPhotos[index % portfolioMockPhotos.length],
        title: project.title || 'Проект без названия',
        author,
        authorAvatarUrl,
        authorFallback: (author.charAt(0) || 'P').toUpperCase(),
        role: card?.primaryRole || project.role || resume.desiredPosition || profileRoleTitle,
        description: project.description || resume.summary || 'Описание проекта пока не добавлено.',
      }
    })
  }, [displayName, portfolioProjectCardMap, profileRoleTitle, resume.desiredPosition, resume.summary, visiblePortfolioProjects])
  const heroSkills = useMemo(() => resume.skills.slice(0, 10), [resume.skills])
  const socialLinks = useMemo(
    () =>
      resume.links
        .filter((link) => Boolean(link.url?.trim()))
        .map((link) => {
          const href = normalizeUrl(link.url)
          const kind = resolveSocialLinkKind(link.kind, href)
          return {
            id: link.id,
            href,
            kind,
            label: link.label?.trim() || link.kind?.trim() || 'Ссылка',
          }
        }),
    [resume.links],
  )
  const heroStyle = useMemo(
    () =>
      bannerUrl
        ? {
            backgroundImage: `linear-gradient(0deg, rgba(24, 24, 29, 0.64) 0%, rgba(37, 34, 42, 0.58) 100%), url("${bannerUrl}")`,
          }
        : undefined,
    [bannerUrl],
  )
  const profileInfoPanelStyle = useMemo(
    () =>
      bannerUrl
        ? {
            backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(247, 251, 255, 0.94) 100%), url("${bannerUrl}")`,
          }
        : undefined,
    [bannerUrl],
  )
  const salaryRangeLabel = useMemo(() => {
    const formatter = new Intl.NumberFormat('ru-RU')
    if (resume.salaryFrom == null && resume.salaryTo == null) {
      return 'Не указана'
    }
    if (resume.salaryFrom != null && resume.salaryTo != null) {
      return `${formatter.format(resume.salaryFrom)} - ${formatter.format(resume.salaryTo)} ₽`
    }
    if (resume.salaryFrom != null) {
      return `От ${formatter.format(resume.salaryFrom)} ₽`
    }
    return `До ${formatter.format(resume.salaryTo ?? 0)} ₽`
  }, [resume.salaryFrom, resume.salaryTo])

  async function onApplyFromFavorites(opportunityId: number) {
    if (!session?.accessToken || !session.user?.id) {
      setProfileError('Для отклика нужно войти как соискатель.')
      return
    }

    if (hasApplied(opportunityId)) {
      setSuccess('Вы уже откликались на эту вакансию.')
      return
    }

    setApplyingIds((current) => ({
      ...current,
      [opportunityId]: true,
    }))

    try {
      const detail = await fetchOpportunityDetailById(opportunityId)

      if (detail.type !== 'vacancy' && detail.type !== 'internship') {
        await participateInOpportunity(detail.id)
        setSuccess('Вы успешно записались на мероприятие.')
        return
      }

      if (!detail.companyId) {
        throw new Error('У вакансии не указан идентификатор компании.')
      }

      await createApplication({
        companyId: detail.companyId,
        candidateUserId: session.user.id,
        vacancyId: detail.id,
        initiatorRole: 1,
      })

      setSuccess('Отклик отправлен.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось отправить отклик.')
    } finally {
      setApplyingIds((current) => {
        const next = { ...current }
        delete next[opportunityId]
        return next
      })
    }
  }

  async function onProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (typeof session?.accessToken !== 'string' || !session.accessToken) return
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setProfileError('Заполните имя и фамилию.')
      return
    }
    if (profileForm.birthDate && profileForm.birthDate > getTodayDateInputValue()) {
      setProfileError('Дата рождения не может быть в будущем.')
      return
    }

    setSavingProfile(true)
    setProfileError('')

    try {
      const payload = {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        middleName: toNullable(profileForm.middleName),
        birthDate: toNullable(profileForm.birthDate),
        gender: profileForm.gender ? (Number(profileForm.gender) as CandidateGender) : null,
        phone: toNullable(profileForm.phone),
        about: toNullable(profileForm.about),
        avatarUrl: toNullable(profileForm.avatarUrl),
      }
      const updated = await updateSeekerProfile(payload)
      setProfile(updated)
      setProfileForm(createProfileForm(updated))

      const nextScope = toResumeAndProfileScope(profileVisibility)
      const settingsToSave = seekerSettings ?? {
        userId: updated.userId,
        profileVisibility: PRIVACY_SCOPE_AUTHORIZED_USERS,
        resumeVisibility: PRIVACY_SCOPE_AUTHORIZED_USERS,
        openToWork: true,
        showContactsInResume: false,
      }

      const updatedSettings = await updateSeekerSettings({
        profileVisibility: nextScope,
        resumeVisibility: nextScope,
        openToWork: settingsToSave.openToWork,
        showContactsInResume: settingsToSave.showContactsInResume,
      })

      setSeekerSettings(updatedSettings)
      setSuccess('Профиль сохранен.')
      setIsSettingsOpen(false)
      if (session.user) {
        const username = updated.username || session.user.username
        signIn({ ...session, user: { ...session.user, username, avatarUrl: updated.avatarUrl } })
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file || typeof session?.accessToken !== 'string' || !session.accessToken) return
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      setProfileError(validationError)
      return
    }

    setUploadingAvatar(true)
    setProfileError('')

    try {
      const response = await uploadMyAvatar(file)
      setProfileForm((state) => ({ ...state, avatarUrl: response.url }))
      setProfile((current) => (current ? { ...current, avatarUrl: response.url } : current))
      setSuccess('Аватарка загружена.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось загрузить аватарку.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file || typeof session?.accessToken !== 'string' || !session.accessToken) return
    const validationError = validateProfileImageFile(file)
    if (validationError) {
      setProfileError(validationError)
      return
    }

    setUploadingBanner(true)
    setProfileError('')

    try {
      const response = await uploadMyProfileBanner(file)
      setProfileBannerUrl(response.url)
      setSuccess('Баннер загружен.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось загрузить баннер.')
    } finally {
      setUploadingBanner(false)
    }
  }

  function onProjectPhotosSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) {
      return
    }

    const validDrafts: ProjectPhotoDraft[] = []
    for (const file of files) {
      const validationError = validateProfileImageFile(file)
      if (validationError) {
        setPortfolioError(validationError)
        continue
      }

      validDrafts.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        isMain: false,
      })
    }

    if (!validDrafts.length) {
      return
    }

    setPortfolioError('')
    setProjectPhotoFiles((current) => {
      const next = [...current, ...validDrafts]
      if (!next.some((item) => item.isMain)) {
        return next.map((item, index) => ({ ...item, isMain: index === 0 }))
      }
      return next
    })
  }

  function onRemoveProjectPhotoDraft(id: string) {
    setProjectPhotoFiles((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }

      const next = current.filter((item) => item.id !== id)
      if (!next.length) {
        return next
      }

      if (!next.some((item) => item.isMain)) {
        return next.map((item, index) => ({ ...item, isMain: index === 0 }))
      }

      return next
    })
  }

  function onSetMainProjectPhotoDraft(id: string) {
    setProjectPhotoFiles((current) =>
      current.map((item) => ({
        ...item,
        isMain: item.id === id,
      })),
    )
  }

  function onAddProjectParticipant() {
    if (!selectedParticipant) {
      setPortfolioError('Выберите участника из подсказок по username.')
      return
    }

    if (projectParticipants.some((item) => item.userId === selectedParticipant.userId)) {
      setPortfolioError('Этот пользователь уже добавлен.')
      return
    }

    setProjectParticipants((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId: selectedParticipant.userId,
        username: selectedParticipant.username,
        role: participantRole.trim(),
      },
    ])
    setParticipantUsernameQuery('')
    setParticipantSuggestions([])
    setSelectedParticipant(null)
    setParticipantRole('')
    setPortfolioError('')
  }

  function onAddProjectCollaboration(type: CollaborationType, itemId: number, title: string) {
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return
    }

    setProjectCollaborations((current) => {
      if (current.some((item) => item.type === type && item.itemId === itemId)) {
        return current
      }

      return [
        ...current,
        {
          id: `${type}-${itemId}`,
          type,
          itemId,
          title,
        },
      ]
    })
  }

  async function onOpenProjectPhotoManager(projectId: number) {
    setActiveProjectPhotoManagerId(projectId)
    setLoadingActiveProjectPhotos(true)
    setPortfolioError('')

    try {
      const detail = await fetchPublicPortfolioProjectDetail(projectId, { withAuth: true })
      const photos = Array.isArray(detail.photos) ? [...detail.photos].sort((a, b) => a.sortOrder - b.sortOrder) : []
      setActiveProjectPhotos(photos)
    } catch (error) {
      setActiveProjectPhotos([])
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось загрузить фото проекта.')
    } finally {
      setLoadingActiveProjectPhotos(false)
    }
  }

  async function onMakeProjectPhotoMain(photoId: number) {
    if (!activeProjectPhotoManagerId) return
    const targetPhoto = activeProjectPhotos.find((photo) => photo.id === photoId)
    if (!targetPhoto) return

    setUpdatingProjectPhotos(true)
    setPortfolioError('')

    try {
      await updateMyPortfolioProjectPhoto(activeProjectPhotoManagerId, photoId, {
        sortOrder: targetPhoto.sortOrder,
        isMain: true,
      })
      setActiveProjectPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          isMain: photo.id === photoId,
        })),
      )
      setSuccess('Главное фото обновлено.')
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось обновить главное фото.')
    } finally {
      setUpdatingProjectPhotos(false)
    }
  }

  async function onDeleteProjectPhoto(photoId: number) {
    if (!activeProjectPhotoManagerId) return

    setUpdatingProjectPhotos(true)
    setPortfolioError('')

    try {
      await deleteMyPortfolioProjectPhoto(activeProjectPhotoManagerId, photoId)
      setActiveProjectPhotos((current) => current.filter((photo) => photo.id !== photoId))
      setSuccess('Фото проекта удалено.')
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось удалить фото проекта.')
    } finally {
      setUpdatingProjectPhotos(false)
    }
  }

  async function onCreatePortfolioProject() {
    const payload = normalizeProjectPayload(projectForm, projectParticipants, projectCollaborations)
    if (!payload.title) {
      setPortfolioError('Укажите название проекта.')
      return
    }

    if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
      setPortfolioError('Дата окончания проекта не может быть раньше даты начала.')
      return
    }

    if (typeof session?.accessToken !== 'string' || !session.accessToken) return

    setSavingPortfolio(true)
    setPortfolioError('')

    try {
      const created = await createMyPortfolioProject(payload)
      let uploadedPhotoUrl: string | null = null

      if (projectPhotoFiles.length > 0) {
        for (let index = 0; index < projectPhotoFiles.length; index += 1) {
          const draft = projectPhotoFiles[index]
          try {
            const photo = await uploadMyPortfolioProjectPhoto(created.projectId, draft.file, {
              isMain: draft.isMain,
              sortOrder: index,
            })
            if (draft.isMain) {
              uploadedPhotoUrl = photo.url
            }
          } catch (photoError) {
            setPortfolioError(photoError instanceof Error ? photoError.message : 'Проект сохранен, но часть фото не удалось загрузить.')
            break
          }
        }
      }

      const nextProject = {
        id: created.projectId,
        title: payload.title,
        role: payload.role ?? '',
        description: payload.description ?? '',
        startDate: payload.startDate ?? '',
        endDate: payload.endDate ?? '',
        repoUrl: payload.repoUrl ?? '',
        demoUrl: payload.demoUrl ?? '',
        mainPhotoUrl: uploadedPhotoUrl,
        isPrivate: projectForm.isPrivate,
      }

      setResume((state) => ({
        ...state,
        projects: [...state.projects, nextProject],
      }))
      setProjectForm(initialProject)
      for (const draft of projectPhotoFiles) {
        URL.revokeObjectURL(draft.previewUrl)
      }
      setProjectPhotoFiles([])
      setProjectParticipants([])
      setProjectCollaborations([])
      setParticipantUsernameQuery('')
      setParticipantSuggestions([])
      setSelectedParticipant(null)
      setVacancyQuery('')
      setOpportunityQuery('')
      setVacancySuggestions([])
      setOpportunitySuggestions([])
      setIsProjectModalOpen(false)
      setSuccess('Проект портфолио сохранен.')
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось сохранить проект портфолио.')
    } finally {
      setSavingPortfolio(false)
    }
  }

  async function onDeletePortfolioProject(projectId: number) {
    if (typeof session?.accessToken !== 'string' || !session.accessToken) return

    setSavingPortfolio(true)
    setPortfolioError('')

    try {
      await deleteMyPortfolioProject(projectId)
      setResume((state) => ({
        ...state,
        projects: state.projects.filter((project) => project.id !== projectId),
      }))
      if (activeProjectPhotoManagerId === projectId) {
        setActiveProjectPhotoManagerId(null)
        setActiveProjectPhotos([])
      }
      setSuccess('Проект удалён.')
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось удалить проект.')
    } finally {
      setSavingPortfolio(false)
    }
  }

  async function onToggleProjectVisibility(projectId: number) {
    if (typeof session?.accessToken !== 'string' || !session.accessToken) {
      return
    }

    const project = resume.projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    const nextIsPrivate = !project.isPrivate
    setSavingPortfolio(true)
    setPortfolioError('')

    try {
      await updateMyPortfolioProject(projectId, {
        title: project.title.trim(),
        role: project.role.trim() || null,
        description: project.description.trim() || null,
        startDate: project.startDate || null,
        endDate: project.endDate || null,
        repoUrl: normalizeUrl(project.repoUrl) || null,
        demoUrl: normalizeUrl(project.demoUrl) || null,
        isPrivate: nextIsPrivate,
        participants: [],
        collaborations: [],
      })

      setResume((state) => ({
        ...state,
        projects: state.projects.map((item) =>
          item.id === projectId
            ? {
                ...item,
                isPrivate: nextIsPrivate,
              }
            : item,
        ),
      }))
      setSuccess(nextIsPrivate ? 'Проект скрыт из публичного портфолио.' : 'Проект снова виден в публичном портфолио.')
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Не удалось обновить приватность проекта.')
    } finally {
      setSavingPortfolio(false)
    }
  }

  async function onResumeStepAction() {
    if (step === 0 && (!resume.desiredPosition.trim() || !resume.summary.trim())) {
      setResumeError('Заполните базовую информацию резюме.')
      return
    }
    setResumeError('')
    if (step < resumeSteps.length - 1) {
      setStep((value) => value + 1)
      return
    }

    if (typeof session?.accessToken !== 'string' || !session.accessToken) return

    setSavingResume(true)

    try {
      const response = await updateSeekerResume(resume)
      setResume((state) => ({
        ...state,
        userId: response.userId,
        headline: '',
        desiredPosition: response.desiredPosition ?? state.desiredPosition,
        summary: response.summary ?? state.summary,
        salaryFrom: response.salaryFrom ?? state.salaryFrom,
        salaryTo: response.salaryTo ?? state.salaryTo,
        currencyCode: 'RUB',
      }))
      setSuccess('Резюме сохранено.')
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Не удалось сохранить резюме.')
    } finally {
      setSavingResume(false)
    }
  }

  async function onToggleSubscription(userId: number | null) {
    if (!userId) {
      return
    }

    setSubscriptionsError('')
    setSubscriptionActionLoading((current) => ({ ...current, [userId]: true }))

    try {
      const isFollowing = followingUserIds.has(userId)

      if (isFollowing) {
        await unfollowUser(userId)
      } else {
        await followUser(userId)
      }

      const [followingList, followersList] = await Promise.all([
        fetchMyFollowingSubscriptions(),
        fetchMyFollowerSubscriptions(),
      ])
      setFollowingUsers(followingList)
      setFollowerUsers(followersList)
    } catch (error) {
      setSubscriptionsError(error instanceof Error ? error.message : 'Не удалось обновить подписку.')
    } finally {
      setSubscriptionActionLoading((current) => ({ ...current, [userId]: false }))
    }
  }

  if (isResumeEditMode) {
    return (
      <div className="app-shell">
        <TopServiceBar />
        <MainHeader />
        <main>
          <section className="container seeker-profile-page seeker-resume-edit-page">
            <section className="card seeker-profile-panel seeker-profile-panel--resume">
              <div className="seeker-profile-panel__head">
                <h2>Редактирование резюме</h2>
                <div className="resume-view-actions">
                  <Link className="btn btn--ghost" to="/dashboard/seeker?tab=resume">
                    Назад в профиль
                  </Link>
                  <Link className="btn btn--primary" to="/dashboard/seeker/resume/print" target="_blank" rel="noreferrer">
                    Печать / PDF
                  </Link>
                </div>
              </div>

              {success ? <div className="auth-feedback seeker-profile-feedback">{success}</div> : null}
              {resumeError ? <div className="auth-feedback auth-feedback--error">{resumeError}</div> : null}
              {portfolioError ? <div className="auth-feedback auth-feedback--error">{portfolioError}</div> : null}
              {loadingResume ? <p>Загружаем резюме...</p> : null}

              {!loadingResume ? (
                <>
                  <div className="resume-stepper">
                    {resumeSteps.map((label, index) => (
                      <button key={label} type="button" className={step === index ? 'is-active' : ''} onClick={() => setStep(index)}>
                        <span>{index + 1}</span>{label}
                      </button>
                    ))}
                  </div>

                  <div className="resume-step-form">
                    {step === 0 ? (
                      <div className="form-grid form-grid--two">
                        <label>Желаемая позиция<input value={resume.desiredPosition} onChange={(e) => setResume((s) => ({ ...s, desiredPosition: e.target.value }))} /></label>
                        <label>Зарплата от<input type="number" value={resume.salaryFrom ?? ''} onChange={(e) => setResume((s) => ({ ...s, salaryFrom: e.target.value ? Number(e.target.value) : null }))} /></label>
                        <label>Зарплата до<input type="number" value={resume.salaryTo ?? ''} onChange={(e) => setResume((s) => ({ ...s, salaryTo: e.target.value ? Number(e.target.value) : null }))} /></label>
                        <label className="full-width">Описание<textarea rows={4} value={resume.summary} onChange={(e) => setResume((s) => ({ ...s, summary: e.target.value }))} /></label>
                      </div>
                    ) : null}

                    {step === 1 ? (
                      <div className="resume-step-body">
                        <div className="form-grid form-grid--two">
                          <label>Скилл<select value={skillTagId ?? ''} onChange={(e) => setSkillTagId(e.target.value ? Number(e.target.value) : null)}><option value="">Выберите скилл</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
                          <label>
                            Уровень
                            <select value={normalizeSkillLevel(skillLevel)} onChange={(e) => setSkillLevel(e.target.value)}>
                              {SKILL_LEVEL_OPTIONS.map((item) => (
                                <option key={`skill-level-${item.value}`} value={item.value}>
                                  {formatSkillLevelDisplay(item.value)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>Опыт (лет)<input type="number" min={0} max={50} value={skillYears} onChange={(e) => setSkillYears(e.target.value)} /></label>
                        </div>
                        <button type="button" className="btn btn--ghost" onClick={() => {
                          if (!skillTagId) return
                          const tag = tags.find((x) => x.id === skillTagId)
                          if (!tag || resume.skills.some((x) => x.tagId === skillTagId)) return
                          setResume((s) => ({ ...s, skills: [...s.skills, { tagId: tag.id, tagName: tag.name, level: normalizeSkillLevel(skillLevel), yearsExperience: normalizeYearsExperience(skillYears) }] }))
                          setSkillTagId(null)
                          setSkillLevel('3')
                          setSkillYears('1')
                        }}>Добавить скилл</button>
                        <div className="resume-collection">{resume.skills.length ? resume.skills.map((skill) => <article key={skill.tagId} className="resume-collection-card"><div><strong>{skill.tagName}</strong><p>{formatSkillLevelDisplay(skill.level)}, опыт {skill.yearsExperience} лет</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, skills: s.skills.filter((x) => x.tagId !== skill.tagId) }))}>Удалить</button></article>) : <p>Скиллы пока не добавлены.</p>}</div>
                      </div>
                    ) : null}

                    {step === 2 ? (
                      <div className="resume-step-body">
                        <div className="form-grid form-grid--two">
                          <label>
                            Компания на платформе
                            <select
                              value={experienceForm.companyId}
                              onChange={(e) => setExperienceForm((s) => ({ ...s, companyId: e.target.value }))}
                            >
                              <option value="">Не выбрана</option>
                              {resumeCompanies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name || `Компания #${company.id}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Название компании (если нет в списке)
                            <input
                              value={experienceForm.companyName}
                              onChange={(e) => setExperienceForm((s) => ({ ...s, companyName: e.target.value }))}
                            />
                          </label>
                          <label>Должность<input value={experienceForm.position} onChange={(e) => setExperienceForm((s) => ({ ...s, position: e.target.value }))} /></label>
                          <label>
                            Сейчас работаю
                            <select
                              value={experienceForm.isCurrent ? 'yes' : 'no'}
                              onChange={(e) => setExperienceForm((s) => ({ ...s, isCurrent: e.target.value === 'yes' }))}
                            >
                              <option value="no">Нет</option>
                              <option value="yes">Да</option>
                            </select>
                          </label>
                          <label>Дата начала<input type="date" value={experienceForm.startDate} onChange={(e) => setExperienceForm((s) => ({ ...s, startDate: e.target.value }))} /></label>
                          <label>
                            Дата окончания
                            <input
                              type="date"
                              value={experienceForm.endDate}
                              disabled={experienceForm.isCurrent}
                              onChange={(e) => setExperienceForm((s) => ({ ...s, endDate: e.target.value }))}
                            />
                          </label>
                          <label className="full-width">Описание<textarea rows={3} value={experienceForm.description} onChange={(e) => setExperienceForm((s) => ({ ...s, description: e.target.value }))} /></label>
                        </div>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            const selectedCompanyId = experienceForm.companyId ? Number(experienceForm.companyId) : null
                            const selectedCompany = selectedCompanyId ? resumeCompanies.find((x) => x.id === selectedCompanyId) : null
                            const companyName = selectedCompany?.name || experienceForm.companyName.trim()
                            if (!companyName || !experienceForm.position.trim()) return
                            setResume((s) => ({
                              ...s,
                              experiences: [
                                ...s.experiences,
                                {
                                  id: Date.now(),
                                  companyId: selectedCompanyId,
                                  companyName,
                                  position: experienceForm.position.trim(),
                                  description: experienceForm.description.trim(),
                                  startDate: experienceForm.startDate,
                                  endDate: experienceForm.isCurrent ? '' : experienceForm.endDate,
                                  isCurrent: experienceForm.isCurrent,
                                },
                              ],
                            }))
                            setExperienceForm(initialExperience)
                          }}
                        >
                          Добавить опыт
                        </button>
                        <div className="resume-collection">
                          {resume.experiences.length ? (
                            resume.experiences.map((experience) => (
                              <article key={experience.id} className="resume-collection-card">
                                <div>
                                  <strong>{experience.position}</strong>
                                  <p>{experience.companyName}</p>
                                  <p>
                                    {experience.startDate || 'Дата начала не указана'} - {experience.isCurrent ? 'по настоящее время' : experience.endDate || 'Дата окончания не указана'}
                                  </p>
                                  {experience.description ? <p>{experience.description}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => setResume((s) => ({ ...s, experiences: s.experiences.filter((x) => x.id !== experience.id) }))}
                                >
                                  Удалить
                                </button>
                              </article>
                            ))
                          ) : (
                            <p>Опыт работы пока не добавлен.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {step === 3 ? (
                      <div className="resume-step-body">
                        <div className="resume-step-actions resume-step-actions--start">
                          <button type="button" className="btn btn--primary" disabled={savingPortfolio} onClick={() => setIsProjectModalOpen(true)}>
                            Добавить проект
                          </button>
                        </div>

                        <div className="resume-collection">
                          {resume.projects.length ? (
                            resume.projects.map((project) => (
                              <article key={project.id} className="resume-collection-card">
                                <div>
                                  <strong>{project.title}</strong>
                                  <p>{project.isPrivate ? 'Приватный проект' : 'Публичный проект'}</p>
                                  <p>{project.role || 'Роль не указана'}</p>
                                  <p>{project.description || 'Описание не заполнено'}</p>
                                </div>
                                <div className="resume-collection-card__actions">
                                  <button type="button" className="btn btn--ghost" onClick={() => void onToggleProjectVisibility(project.id)} disabled={savingPortfolio}>
                                    {project.isPrivate ? 'Сделать публичным' : 'Скрыть проект'}
                                  </button>
                                  <button type="button" className="btn btn--ghost" onClick={() => void onOpenProjectPhotoManager(project.id)} disabled={savingPortfolio || loadingActiveProjectPhotos}>
                                    Управлять фото
                                  </button>
                                  <button type="button" className="btn btn--ghost" onClick={() => void onDeletePortfolioProject(project.id)} disabled={savingPortfolio}>
                                    Удалить
                                  </button>
                                </div>
                              </article>
                            ))
                          ) : (
                            <p>Проекты пока не добавлены.</p>
                          )}
                        </div>

                        {activeProjectPhotoManagerId ? (
                          <section className="resume-project-photo-manager">
                            <h3>Фото проекта #{activeProjectPhotoManagerId}</h3>
                            {loadingActiveProjectPhotos ? <p>Загружаем фото...</p> : null}
                            {!loadingActiveProjectPhotos && !activeProjectPhotos.length ? <p>Фото в проекте пока нет.</p> : null}
                            {!loadingActiveProjectPhotos && activeProjectPhotos.length ? (
                              <div className="portfolio-photo-drafts">
                                {activeProjectPhotos.map((photo) => (
                                  <article key={photo.id} className="portfolio-photo-draft-card">
                                    <img src={resolveAvatarUrl(photo.url) ?? photo.url} alt={`Фото ${photo.id}`} />
                                    <div className="portfolio-photo-draft-card__controls">
                                      <button type="button" className="btn btn--ghost" disabled={updatingProjectPhotos || photo.isMain} onClick={() => void onMakeProjectPhotoMain(photo.id)}>
                                        {photo.isMain ? 'Главное фото' : 'Сделать главным'}
                                      </button>
                                      <button type="button" className="btn btn--ghost" disabled={updatingProjectPhotos} onClick={() => void onDeleteProjectPhoto(photo.id)}>
                                        Удалить
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {step === 4 ? (
                      <div className="resume-step-body">
                        <div className="form-grid form-grid--two">
                          <label>ВУЗ<input value={educationForm.university} onChange={(e) => setEducationForm((s) => ({ ...s, university: e.target.value }))} /></label>
                          <label>Факультет<input value={educationForm.faculty} onChange={(e) => setEducationForm((s) => ({ ...s, faculty: e.target.value }))} /></label>
                          <label>Специальность<input value={educationForm.specialty} onChange={(e) => setEducationForm((s) => ({ ...s, specialty: e.target.value }))} /></label>
                          <label>Курс<input type="number" min={1} max={7} value={educationForm.course} onChange={(e) => setEducationForm((s) => ({ ...s, course: e.target.value }))} /></label>
                          <label>Год выпуска<input type="number" min={2000} max={2100} value={educationForm.graduationYear} onChange={(e) => setEducationForm((s) => ({ ...s, graduationYear: e.target.value }))} /></label>
                        </div>
                        <button type="button" className="btn btn--ghost" onClick={() => {
                          if (!educationForm.university.trim() || !educationForm.specialty.trim()) return
                          setResume((s) => ({ ...s, education: [...s.education, { id: Date.now(), university: educationForm.university.trim(), faculty: educationForm.faculty.trim(), specialty: educationForm.specialty.trim(), course: Number(educationForm.course) || 0, graduationYear: Number(educationForm.graduationYear) || 0 }] }))
                          setEducationForm(initialEducation)
                        }}>Добавить образование</button>
                        <div className="resume-collection">{resume.education.length ? resume.education.map((edu) => <article key={edu.id} className="resume-collection-card"><div><strong>{edu.university}</strong><p>{edu.specialty}</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, education: s.education.filter((x) => x.id !== edu.id) }))}>Удалить</button></article>) : <p>Образование пока не добавлено.</p>}</div>
                      </div>
                    ) : null}

                    {step === 5 ? (
                      <div className="resume-step-body">
                        <div className="form-grid form-grid--two">
                          <label>Тип<select value={linkForm.kind} onChange={(e) => setLinkForm((s) => ({ ...s, kind: e.target.value }))}><option value="github">GitHub</option><option value="linkedin">LinkedIn</option><option value="telegram">Telegram</option><option value="portfolio">Portfolio</option><option value="other">Другое</option></select></label>
                          <label>URL<input value={linkForm.url} onChange={(e) => setLinkForm((s) => ({ ...s, url: e.target.value }))} /></label>
                          <label>Подпись<input value={linkForm.label} onChange={(e) => setLinkForm((s) => ({ ...s, label: e.target.value }))} /></label>
                        </div>
                        <button type="button" className="btn btn--ghost" onClick={() => {
                          if (!linkForm.url.trim()) return
                          setResume((s) => ({ ...s, links: [...s.links, { id: Date.now(), kind: linkForm.kind.trim(), label: linkForm.label.trim(), url: normalizeUrl(linkForm.url) }] }))
                          setLinkForm(initialLink)
                        }}>Добавить ссылку</button>
                        <div className="resume-collection">{resume.links.length ? resume.links.map((link) => <article key={link.id} className="resume-collection-card"><div><strong>{link.label || link.kind}</strong><p>{link.url}</p></div><button type="button" className="btn btn--ghost" onClick={() => setResume((s) => ({ ...s, links: s.links.filter((x) => x.id !== link.id) }))}>Удалить</button></article>) : <p>Ссылки пока не добавлены.</p>}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="resume-step-actions">
                    <button type="button" className="btn btn--ghost" disabled={step === 0 || savingResume} onClick={() => setStep((v) => Math.max(0, v - 1))}>Назад</button>
                    <button type="button" className="btn btn--primary" disabled={savingResume} onClick={() => void onResumeStepAction()}>{step === resumeSteps.length - 1 ? (savingResume ? 'Сохраняем...' : 'Сохранить резюме') : 'Далее'}</button>
                  </div>
                </>
              ) : null}
            </section>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <section className="container seeker-profile-page">
          {!isPublicReadOnlyMode || loadingProfile || (profile && !isPublicProfileHidden) ? (
            <header className="seeker-profile-hero-exact" style={heroStyle}>
              <p className="seeker-profile-hero-exact__position">{profileRoleTitle}</p>
              <div className="seeker-profile-hero-exact__left">
                <div className="seeker-profile-hero-exact__skills">
                  {heroSkills.length ? (
                    heroSkills.map((skill) => <span key={`hero-skill-${skill.tagId}`}>{skill.tagName}</span>)
                  ) : (
                    <span className="is-empty">Скиллы не заполнены</span>
                  )}
                </div>
                <div className="seeker-profile-hero-exact__socials">
                  {socialLinks.length ? (
                    socialLinks.map((link) => (
                      <a
                        key={`hero-link-${link.id}`}
                        className="seeker-profile-hero-exact__social-link"
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        title={link.label}
                        aria-label={link.label}
                      >
                        {renderSocialLinkIcon(link.kind, link.label)}
                      </a>
                    ))
                  ) : (
                    <span className="seeker-profile-hero-exact__social-empty">Ссылок пока нет</span>
                  )}
                </div>
              </div>
              <div className="seeker-profile-hero-exact__avatar">{avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{avatarFallback}</span>}</div>
              <h1 className="seeker-profile-hero-exact__name">{displayName}</h1>

              {isForeignProfile && !isPublicReadOnlyMode ? <button type="button" className="seeker-profile-hero-exact__subscribe">Подписаться</button> : null}
            </header>
          ) : null}

          {success ? <div className="auth-feedback seeker-profile-feedback">{success}</div> : null}
          {!isPublicReadOnlyMode && profileError ? <div className="auth-feedback auth-feedback--error">{profileError}</div> : null}
          {subscriptionsError ? <div className="auth-feedback auth-feedback--error">{subscriptionsError}</div> : null}
          {portfolioError ? <div className="auth-feedback auth-feedback--error">{portfolioError}</div> : null}
          {!isPublicReadOnlyMode && applicationsError ? <div className="auth-feedback auth-feedback--error">{applicationsError}</div> : null}
          {isPublicReadOnlyMode && !loadingProfile && !profile ? (
            <section className="card seeker-profile-state">
              <p>{profileError || 'Профиль не найден.'}</p>
            </section>
          ) : null}
          {isPublicReadOnlyMode && !loadingProfile && profile && isPublicProfileHidden ? (
            <section className="card seeker-profile-state">
              <p>Этот профиль скрыт владельцем и недоступен в публичном списке.</p>
            </section>
          ) : null}

          {!isPublicReadOnlyMode || (profile && !isPublicProfileHidden) ? (
            <>
              <div className="seeker-profile-mode-toolbar">
                <nav className="seeker-profile-mode-switch">
                  {availableProfilePanels.map((item) => (
                    <button key={item.id} type="button" className={profilePanel === item.id ? 'is-active' : ''} onClick={() => setProfilePanel(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </nav>
                {!isPublicReadOnlyMode ? (
                  <button type="button" className="btn btn--primary" onClick={() => setIsProjectModalOpen(true)}>
                    Добавить проект
                  </button>
                ) : null}
              </div>

          {profilePanel === 'portfolio' ? (
            <section className="portfolio-panel">
              <div className="portfolio-grid">
                {!portfolioItems.length ? (
                  <p>{isPublicReadOnlyMode ? 'Портфолио пока пусто.' : 'Портфолио пока пусто. Добавьте проект в шаге «Портфолио» резюме.'}</p>
                ) : null}
                {portfolioItems.map((item) => (
                  <Link
                    key={item.id}
                    className="portfolio-card-link"
                    to={`${projectDetailsBasePath}/project/${item.projectId}`}
                  >
                    <article className="portfolio-card">
                      <img src={item.image} alt={item.title} />
                      <p className="portfolio-card__description">{item.title}</p>
                      <div className="portfolio-card__author">
                        <div className="portfolio-card__avatar">{item.authorAvatarUrl ? <img src={item.authorAvatarUrl} alt={item.author} /> : <span>{item.authorFallback}</span>}</div>
                        <div>
                          <strong>{item.author}</strong>
                          <span>{item.role}</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!isPublicReadOnlyMode && profilePanel === 'subscriptions' ? (
          <section className="subscriptions-block">
            <div className="subscriptions-block__toolbar">
              <div className="subscriptions-block__counters">
                <button
                  type="button"
                  className={followMode === 'subscriptions' ? 'subscriptions-pill subscriptions-pill--active' : 'subscriptions-pill'}
                  onClick={() => setFollowMode('subscriptions')}
                >
                  {subscriptionsCount} подписок
                </button>
                <button
                  type="button"
                  className={followMode === 'subscribers' ? 'subscriptions-pill subscriptions-pill--active' : 'subscriptions-pill'}
                  onClick={() => setFollowMode('subscribers')}
                >
                  {subscribersCount} подписчиков
                </button>
              </div>
              <div className="subscriptions-block__type-tabs">
                {subscriptionTabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={subscriptionsTab === item.id ? 'subscriptions-pill subscriptions-pill--active' : 'subscriptions-pill'}
                    onClick={() => setSubscriptionsTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingSubscriptions ? <p>Загружаем подписки...</p> : null}

            {!loadingSubscriptions ? (
                <div className="subscriptions-list">
                  {(subscriptionsTab === 'seekers' ? seekerSubscriptions : employerSubscriptions).map((item) => (
                    <article key={item.id} className="subscriptions-row">
                      <div className="subscriptions-row__profile">
                        <div className="subscriptions-row__avatar">
                          {item.avatarUrl ? <img src={item.avatarUrl} alt={item.title} /> : <span>{item.title.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div className="subscriptions-row__content">
                        <h3>{item.title}</h3>
                        <p className="subscriptions-row__subtitle">
                          {subscriptionsTab === 'seekers' ? <Users size={14} /> : <Building2 size={14} />}
                          {item.subtitle}
                        </p>
                        <p>{item.description}</p>
                      </div>
                      </div>
                      <div className="subscriptions-row__previews">
                        {item.previews.length ? (
                          item.previews.map((preview) => (
                            <article key={`${item.id}-${preview.projectId}`} className="subscriptions-preview-card">
                              {preview.imageUrl ? (
                                <img src={preview.imageUrl} alt={preview.title} />
                              ) : (
                                <div className="subscriptions-preview-card__logo">
                                  <img src="/logo.svg" alt="Логотип сайта" />
                                </div>
                              )}
                              <p>{preview.title}</p>
                            </article>
                          ))
                        ) : (
                          <article className="subscriptions-preview-card subscriptions-preview-card--empty">
                            <div className="subscriptions-preview-card__logo">
                              <img src="/logo.svg" alt="Логотип сайта" />
                            </div>
                            <p>Пока нет проектов</p>
                          </article>
                        )}
                      </div>
                      <div className="subscriptions-row__actions">
                        {(() => {
                          const userId = item.userId
                          const isFollowing = typeof userId === 'number' ? followingUserIds.has(userId) : false
                          const isLoading = typeof userId === 'number' ? Boolean(subscriptionActionLoading[userId]) : false
                          const isDisabled = userId == null || isLoading

                          const label = isLoading
                            ? 'Обновляем...'
                            : isFollowing
                              ? 'Вы подписаны'
                              : 'Подписаться'

                          return (
                            <button type="button" className="subscription-follow-btn" disabled={isDisabled} onClick={() => void onToggleSubscription(userId)}>
                              {label}
                            </button>
                          )
                        })()}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

            {!loadingSubscriptions && !(subscriptionsTab === 'seekers' ? seekerSubscriptions.length : employerSubscriptions.length) ? (
              <p>В этом разделе пока нет данных.</p>
            ) : null}
          </section>
          ) : null}

          {profilePanel === 'info' && loadingProfile ? (
            <section className="card seeker-profile-state"><p>Загружаем профиль...</p></section>
          ) : null}
          {profilePanel === 'info' ? (
            <>
              {!isPublicReadOnlyMode ? (
                <nav className="card seeker-profile-tabs">
                  {tabs.map((item) => (
                    <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
                  ))}
                </nav>
              ) : null}

              {!isPublicReadOnlyMode && tab === 'responses' ? (
                <section className="card seeker-profile-panel">
                  <h2>Мои отклики</h2>
                  <div className="application-stats">
                    <article><strong>{responsesStats.total}</strong><span>Всего откликов</span></article>
                    <article><strong>{responsesStats.success}</strong><span>Активные</span></article>
                    <article><strong>{responsesStats.warning}</strong><span>На рассмотрении</span></article>
                    <article><strong>{responsesStats.danger}</strong><span>Закрытые</span></article>
                  </div>
                  {loadingApplications ? <p>Загружаем отклики...</p> : null}
                  {!loadingApplications && !applications.length ? <p>Вы еще не отправляли отклики.</p> : null}
                  {!loadingApplications && applications.length ? (
                    <div className="application-list">
                      {applications.map((item) => (
                        <article key={item.id} className="application-card">
                          <div className="application-card__top">
                            <div><h3>{item.title}</h3><p>{item.company}</p></div>
                            <span className={`status-chip status-chip--${item.tone}`}>{item.status}</span>
                          </div>
                          <div className="application-card__meta">
                            <span><MapPin size={14} />{item.location}</span>
                            <span><CalendarClock size={14} />Отклик: {item.date}</span>
                          </div>
                          <p className="application-card__next">Следующий шаг: {item.next}</p>
                          <p>{item.note}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {!isPublicReadOnlyMode && tab === 'favorites' ? (
                <section className="card seeker-profile-panel">
                  <h2>Избранное</h2>
                  {loadingFavorites ? <p>Загружаем избранные вакансии...</p> : null}
                  {favoritesError ? <div className="auth-feedback auth-feedback--error">{favoritesError}</div> : null}
                  {!loadingFavorites && !favoriteOpportunities.length ? (
                    <p>В избранном пока пусто. Добавьте вакансии с главной страницы.</p>
                  ) : null}
                  {!loadingFavorites && favoriteOpportunities.length ? (
                    <div className="favorite-list">
                      {favoriteOpportunities.map((item) => (
                        <article key={item.id} className="favorite-card">
                          <div className="favorite-card__head">
                            <div>
                              <h3>{item.title}</h3>
                              <p>{item.company}</p>
                            </div>
                            <span className="favorite-card__salary">{item.compensation}</span>
                          </div>
                          <div className="favorite-card__meta">
                            <span>{item.location}</span>
                            <span>{item.workFormat}</span>
                          </div>
                          <p>{item.description}</p>
                          <div className="favorite-card__actions">
                            <Link className="btn btn--ghost" to={`/opportunity/${item.id}`}>
                              Подробнее
                            </Link>
                            <button type="button" className="btn btn--primary" disabled={Boolean(applyingIds[item.id]) || hasApplied(item.id)} onClick={() => void onApplyFromFavorites(item.id)}>
                              {applyingIds[item.id] ? 'Отправляем...' : hasApplied(item.id) ? 'Отклик отправлен' : 'Откликнуться'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {(tab === 'profile' || isPublicReadOnlyMode) ? (
                <section className="card seeker-profile-panel seeker-profile-panel--profile" style={profileInfoPanelStyle}>
                  <div className="seeker-profile-panel__head seeker-profile-panel__head--compact">
                    <h2>Профиль</h2>
                    {!isPublicReadOnlyMode && !isForeignProfile ? (
                      <button type="button" className="btn btn--ghost" onClick={() => setIsSettingsOpen(true)} disabled={loadingProfile || !profile}>
                        Редактировать профиль
                      </button>
                    ) : null}
                  </div>
                  <div className="seeker-profile-info-grid">
                    <article className="seeker-profile-info-card">
                      <h3>Инфо</h3>
                      <div className="seeker-profile-info-list">
                        <p><UserRound size={16} /><span>ФИО</span><strong>{displayName}</strong></p>
                        <p><MapPin size={16} /><span>Логин</span><strong>{profile?.username || 'Не указан'}</strong></p>
                        <p><Building2 size={16} /><span>Позиция</span><strong>{profileRoleTitle}</strong></p>
                        <p><CalendarClock size={16} /><span>Дата рождения</span><strong>{profile?.birthDate || 'Не указана'}</strong></p>
                        <p>
                          {seekerSettings?.openToWork ? <Check size={16} /> : <CircleOff size={16} />}
                          <span>Открыт к предложениям</span>
                          <strong>{seekerSettings?.openToWork ? 'Да' : 'Нет'}</strong>
                        </p>
                        <p>
                          <LinkIcon size={16} />
                          <span>Видимость</span>
                          <strong>{profileVisibility === 'private' ? 'Скрытый' : 'Публичный'}</strong>
                        </p>
                      </div>
                    </article>
                    <article className="seeker-profile-info-card">
                      <h3>Контакты</h3>
                      <div className="seeker-profile-info-list">
                        <p><Send size={16} /><span>Телефон</span><strong>{profile?.phone || 'Не указан'}</strong></p>
                        <p>
                          {seekerSettings?.showContactsInResume ? <Check size={16} /> : <CircleOff size={16} />}
                          <span>Контакты в резюме</span>
                          <strong>{seekerSettings?.showContactsInResume ? 'Показываются' : 'Скрыты'}</strong>
                        </p>
                      </div>
                      <div className="seeker-profile-info-links">
                        {socialLinks.length ? (
                          socialLinks.map((link) => (
                            <a key={`profile-link-${link.id}`} href={link.href} target="_blank" rel="noreferrer">
                              {renderSocialLinkIcon(link.kind, link.label)}
                              <span>{link.label}</span>
                            </a>
                          ))
                        ) : (
                          <p>Ссылки из резюме пока не добавлены.</p>
                        )}
                      </div>
                    </article>
                    <article className="seeker-profile-info-card seeker-profile-info-card--about">
                      <h3>О себе</h3>
                      <p>{profile?.about || 'Описание профиля пока не заполнено.'}</p>
                      <h4>Резюме</h4>
                      <p>{resume.summary || 'Краткое описание из резюме пока не заполнено.'}</p>
                    </article>
                  </div>
                </section>
              ) : null}

              {!isPublicReadOnlyMode && tab === 'resume' ? (
                <section className="card seeker-profile-panel seeker-profile-panel--resume">
                  <div className="seeker-profile-panel__head">
                    <h2>Резюме</h2>
                    {!isForeignProfile ? (
                      <div className="resume-view-actions">
                        <Link className="btn btn--ghost" to="/dashboard/seeker/resume/edit">
                          Редактировать резюме
                        </Link>
                        <Link className="btn btn--primary" to="/dashboard/seeker/resume/print" target="_blank" rel="noreferrer">
                          Печать / PDF
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  {loadingResume ? <p>Загружаем резюме...</p> : null}
                  {!loadingResume ? (
                    <div className="resume-output-grid">
                      <article className="resume-output-block">
                        <h3>Основная информация</h3>
                        <p><strong>{resume.desiredPosition || 'Позиция не указана'}</strong></p>
                        <p>{resume.summary || 'Описание отсутствует'}</p>
                        <p>{salaryRangeLabel}</p>
                      </article>
                      <article className="resume-output-block">
                        <h3>Скиллы</h3>
                        {resume.skills.length ? resume.skills.map((skill) => <p key={skill.tagId}>{skill.tagName}: {formatSkillLevelDisplay(skill.level)}, {skill.yearsExperience} лет</p>) : <p>Скиллы не заполнены.</p>}
                      </article>
                      <article className="resume-output-block">
                        <h3>Опыт работы</h3>
                        {resume.experiences.length ? resume.experiences.map((experience) => <p key={experience.id}><strong>{experience.position}</strong>{` — ${experience.companyName}`}</p>) : <p>Опыт работы не добавлен.</p>}
                      </article>
                      <article className="resume-output-block">
                        <h3>Портфолио</h3>
                        {resume.projects.length ? resume.projects.map((project) => <p key={project.id}><strong>{project.title}</strong>{` — ${project.role || 'Роль не указана'}`}</p>) : <p>Проекты не добавлены.</p>}
                      </article>
                      <article className="resume-output-block">
                        <h3>Образование</h3>
                        {resume.education.length ? resume.education.map((edu) => <p key={edu.id}><strong>{edu.university}</strong>{` — ${edu.specialty}`}</p>) : <p>Образование не добавлено.</p>}
                      </article>
                      <article className="resume-output-block">
                        <h3>Ссылки на соцсети</h3>
                        {resume.links.length ? resume.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label || link.kind}</a>) : <p>Ссылки не добавлены.</p>}
                      </article>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
            </>
          ) : null}
        </section>
      </main>
      <Footer />

      <PortfolioProjectModal
        open={isProjectModalOpen}
        savingPortfolio={savingPortfolio}
        projectForm={projectForm}
        projectPhotoFiles={projectPhotoFiles}
        participantUsernameQuery={participantUsernameQuery}
        participantRole={participantRole}
        projectParticipants={projectParticipants}
        vacancyQuery={vacancyQuery}
        opportunityQuery={opportunityQuery}
        projectCollaborations={projectCollaborations}
        profileSuggestions={participantSuggestions}
        vacancySuggestions={vacancySuggestions}
        opportunitySuggestions={opportunitySuggestions}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectFormChange={setProjectForm}
        onProjectPhotosSelected={onProjectPhotosSelected}
        onSetMainProjectPhotoDraft={onSetMainProjectPhotoDraft}
        onRemoveProjectPhotoDraft={onRemoveProjectPhotoDraft}
        onParticipantUsernameQueryChange={(value) => {
          setParticipantUsernameQuery(value)
          setSelectedParticipant(null)
        }}
        onParticipantRoleChange={setParticipantRole}
        onParticipantSelect={(item) => {
          const username = item.title.replace(/^@/, '').trim()
          setSelectedParticipant({ userId: item.id, username })
          setParticipantUsernameQuery(`@${username}`)
          setParticipantSuggestions([])
        }}
        onAddProjectParticipant={onAddProjectParticipant}
        onRemoveParticipant={(id) => setProjectParticipants((current) => current.filter((item) => item.id !== id))}
        onVacancyQueryChange={setVacancyQuery}
        onOpportunityQueryChange={setOpportunityQuery}
        onVacancySelect={(item) => {
          onAddProjectCollaboration('vacancy', item.id, item.title)
          setVacancyQuery('')
          setVacancySuggestions([])
        }}
        onOpportunitySelect={(item) => {
          onAddProjectCollaboration('opportunity', item.id, item.title)
          setOpportunityQuery('')
          setOpportunitySuggestions([])
        }}
        onRemoveCollaboration={(id) => setProjectCollaborations((current) => current.filter((collaboration) => collaboration.id !== id))}
        onCreatePortfolioProject={() => void onCreatePortfolioProject()}
      />

      {isSettingsOpen && !isPublicReadOnlyMode ? (
        <div className="profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title">
          <div className="profile-settings-modal__backdrop" onClick={() => !savingProfile && !uploadingAvatar && !uploadingBanner && setIsSettingsOpen(false)} />
          <div className="card profile-settings-modal__dialog">
            <div className="profile-settings-modal__head">
              <h2 id="profile-settings-title">Редактирование профиля</h2>
              <button type="button" className="btn btn--icon" onClick={() => !savingProfile && !uploadingAvatar && !uploadingBanner && setIsSettingsOpen(false)} aria-label="Закрыть"><X size={16} /></button>
            </div>
            <form className="profile-settings-modal__form form-grid" onSubmit={onProfileSave}>
              <div className="profile-settings-modal__media-upload" style={heroStyle}>
                <label className={`profile-settings-modal__file-button ${uploadingBanner ? 'is-loading' : ''}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={(event) => void onBannerChange(event)} disabled={uploadingBanner || uploadingAvatar || savingProfile} />
                  <UploadCloud size={16} />
                  {uploadingBanner ? 'Загружаем баннер...' : 'Загрузить баннер'}
                </label>
                <div className="profile-settings-modal__avatar-preview profile-settings-modal__avatar-preview--center">{avatarFormUrl ? <img src={avatarFormUrl} alt="Аватар профиля" /> : <span>{avatarFallback}</span>}</div>
                <label className={`profile-settings-modal__file-button ${uploadingAvatar ? 'is-loading' : ''}`}>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={(event) => void onAvatarChange(event)} disabled={uploadingAvatar || uploadingBanner || savingProfile} />
                  <UploadCloud size={16} />
                  {uploadingAvatar ? 'Загружаем аватар...' : 'Загрузить аватар'}
                </label>
                <p>JPG, PNG, WEBP, GIF или SVG. Размер до 10 МБ.</p>
              </div>
              <div className="form-grid form-grid--two">
                <label>Имя *<input value={profileForm.firstName} onChange={(e) => setProfileForm((s) => ({ ...s, firstName: e.target.value }))} /></label>
                <label>Фамилия *<input value={profileForm.lastName} onChange={(e) => setProfileForm((s) => ({ ...s, lastName: e.target.value }))} /></label>
                <label>Отчество<input value={profileForm.middleName} onChange={(e) => setProfileForm((s) => ({ ...s, middleName: e.target.value }))} /></label>
                <label>Дата рождения<input type="date" value={profileForm.birthDate} onChange={(e) => setProfileForm((s) => ({ ...s, birthDate: e.target.value }))} max={getTodayDateInputValue()} /></label>
                <label>Пол<select value={profileForm.gender} onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value as ProfileGenderValue }))}>{profileGenderOptions.map((option) => <option key={option.value || 'unknown'} value={option.value}>{option.label}</option>)}</select></label>
                <label>Телефон<input value={profileForm.phone} onChange={(e) => setProfileForm((s) => ({ ...s, phone: formatPhone(e.target.value) }))} placeholder="+7 (___) ___-__-__" maxLength={18} /></label>
                <label className="full-width">О себе<textarea rows={4} value={profileForm.about} onChange={(e) => setProfileForm((s) => ({ ...s, about: e.target.value }))} /></label>
              </div>
              <section className="profile-settings-modal__privacy">
                <h3>Приватность</h3>
                <label className="full-width">
                  Видимость профиля в списке резюме
                  <select value={profileVisibility} onChange={(e) => setProfileVisibility(e.target.value as ProfileVisibilityMode)}>
                    <option value="public">Публичный</option>
                    <option value="private">Скрытый</option>
                  </select>
                </label>
                <label className="profile-settings-modal__toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(seekerSettings?.openToWork)}
                    onChange={(event) =>
                      setSeekerSettings((current) => ({
                        userId: current?.userId ?? profile?.userId ?? 0,
                        profileVisibility: current?.profileVisibility ?? PRIVACY_SCOPE_AUTHORIZED_USERS,
                        resumeVisibility: current?.resumeVisibility ?? PRIVACY_SCOPE_AUTHORIZED_USERS,
                        openToWork: event.target.checked,
                        showContactsInResume: current?.showContactsInResume ?? false,
                      }))
                    }
                  />
                  <span>Открыт к предложениям</span>
                </label>
                <label className="profile-settings-modal__toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(seekerSettings?.showContactsInResume)}
                    onChange={(event) =>
                      setSeekerSettings((current) => ({
                        userId: current?.userId ?? profile?.userId ?? 0,
                        profileVisibility: current?.profileVisibility ?? PRIVACY_SCOPE_AUTHORIZED_USERS,
                        resumeVisibility: current?.resumeVisibility ?? PRIVACY_SCOPE_AUTHORIZED_USERS,
                        openToWork: current?.openToWork ?? true,
                        showContactsInResume: event.target.checked,
                      }))
                    }
                  />
                  <span>Показывать контакты в резюме</span>
                </label>
                <p>Скрытый профиль не отображается в разделе «Резюме».</p>
              </section>
              <div className="profile-settings-modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setIsSettingsOpen(false)} disabled={savingProfile || uploadingAvatar || uploadingBanner}>Отмена</button>
                <button type="submit" className="btn btn--primary" disabled={savingProfile || uploadingAvatar || uploadingBanner}>{savingProfile ? 'Сохраняем...' : 'Сохранить'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
