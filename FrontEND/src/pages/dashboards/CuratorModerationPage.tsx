import { Building2, FileBadge2, ShieldAlert, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  banAdminResumeAuthor,
  deleteAdminCompany,
  deleteAdminOpportunity,
  deleteAdminResume,
  deleteAdminUser,
  deleteAdminVacancy,
  fetchAdminCompanies,
  fetchAdminOpportunities,
  fetchAdminResumes,
  fetchAdminUsers,
  fetchAdminVacancies,
  rejectAdminCompany,
  updateAdminCompanyStatus,
  updateAdminOpportunityStatus,
  updateAdminResumeArchive,
  updateAdminUserStatus,
  updateAdminVacancyStatus,
  verifyAdminCompany,
  type AdminCompany,
  type AdminOpportunity,
  type AdminResume,
  type AdminUser,
  type AdminVacancy,
} from '../../api/admin'
import { Footer } from '../../components/layout/Footer'
import { MainHeader } from '../../components/layout/MainHeader'
import { TopServiceBar } from '../../components/layout/TopServiceBar'

type ModerationTab = 'users' | 'resumes' | 'vacancies' | 'opportunities' | 'companies'

const tabs: Array<{ id: ModerationTab; label: string }> = [
  { id: 'users', label: 'Users' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'vacancies', label: 'Vacancies' },
  { id: 'opportunities', label: 'Events' },
  { id: 'companies', label: 'Companies' },
]

const userStatusLabel: Record<number, string> = {
  1: 'Active',
  2: 'Blocked',
  3: 'Deleted',
}

const companyStatusLabel: Record<number, string> = {
  1: 'Draft',
  2: 'Verification',
  3: 'Verified',
  4: 'Rejected',
  5: 'Blocked',
}

const moderationStatusLabel: Record<number, string> = {
  1: 'Draft',
  2: 'On moderation',
  3: 'Active',
  4: 'Finished',
  5: 'Canceled',
  6: 'Rejected',
  7: 'Archive',
}

export function CuratorModerationPage() {
  const [tab, setTab] = useState<ModerationTab>('users')
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

  async function loadUsers() {
    const response = await fetchAdminUsers({ page: 1, pageSize: 30, search: usersSearch })
    setUsers(response.items)
  }

  async function loadResumes() {
    const response = await fetchAdminResumes({ page: 1, pageSize: 30, search: resumesSearch })
    setResumes(response.items)
  }

  async function loadVacancies() {
    const response = await fetchAdminVacancies({ page: 1, pageSize: 30, search: vacanciesSearch })
    setVacancies(response.items)
  }

  async function loadOpportunities() {
    const response = await fetchAdminOpportunities({ page: 1, pageSize: 30, search: opportunitiesSearch })
    setOpportunities(response.items)
  }

  async function loadCompanies() {
    const response = await fetchAdminCompanies({ page: 1, pageSize: 30, search: companiesSearch })
    setCompanies(response.items)
  }

  useEffect(() => {
    let active = true

    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.allSettled([loadUsers(), loadResumes(), loadVacancies(), loadOpportunities(), loadCompanies()])
      .then((results) => {
        if (!active) return
        const failed = results.find((item) => item.status === 'rejected')
        if (failed?.status === 'rejected') {
          setError(failed.reason instanceof Error ? failed.reason.message : 'Cannot load moderation data.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  async function handleAction(action: () => Promise<unknown>, successMessage: string, reload: () => Promise<void>) {
    clearMessages()
    try {
      await action()
      await reload()
      setSuccess(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Moderation action failed.')
    }
  }

  return (
    <div>
      <TopServiceBar />
      <MainHeader />
      <main className="container seeker-profile-page">
        <section className="dashboard-section card seeker-profile-hero admin-profile-hero">
          <div className="seeker-profile-hero__avatar admin-profile-hero__avatar">
            <span>MOD</span>
          </div>
          <div className="seeker-profile-hero__content">
            <div className="seeker-profile-panel__head">
              <h1>Moderation Center</h1>
              <div className="admin-toolbar">
                <Link className="btn btn--ghost" to="/dashboard/curator">Back to curator</Link>
              </div>
            </div>
            <div className="seeker-profile-hero__meta">
              <span><Users size={14} />{users.length} users</span>
              <span><FileBadge2 size={14} />{resumes.length} resumes</span>
              <span><ShieldAlert size={14} />{vacancies.length + opportunities.length} cards</span>
              <span><Building2 size={14} />{companies.length} companies</span>
            </div>
          </div>
        </section>

        {loading ? <section className="dashboard-section card seeker-profile-panel"><p>Loading moderation data...</p></section> : null}
        {error ? <div className="auth-feedback auth-feedback--error">{error}</div> : null}
        {success ? <div className="auth-feedback">{success}</div> : null}

        <nav className="card seeker-profile-tabs">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {tab === 'users' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Users</h2>
              <div className="admin-toolbar">
                <input value={usersSearch} onChange={(event) => setUsersSearch(event.target.value)} placeholder="Search email/username/fio" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadUsers()}>Find</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {users.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.fio || item.email}</h3><p>{item.email}</p></div>
                    <span className="status-chip">{userStatusLabel[item.status] ?? `Status ${item.status}`}</span>
                  </div>
                  <p>@{item.username} | roles: {item.roles.join(', ') || '-'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}`}>Open card</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/users/create?userId=${item.id}`}>Edit</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminUserStatus(item.id, 2), 'User blocked.', loadUsers)}>Block</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminUserStatus(item.id, 1), 'User unblocked.', loadUsers)}>Unblock</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminUser(item.id), 'User deleted.', loadUsers)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'resumes' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Resumes</h2>
              <div className="admin-toolbar">
                <input value={resumesSearch} onChange={(event) => setResumesSearch(event.target.value)} placeholder="Search resume/user" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadResumes()}>Find</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {resumes.map((item) => (
                <article key={item.userId} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.headline || item.desiredPosition || item.fio}</h3><p>{item.fio} (@{item.username})</p></div>
                    <span className="status-chip">{item.isArchived ? 'Archived' : 'Published'}</span>
                  </div>
                  <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}`}>Open card</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/seeker/${encodeURIComponent(item.username)}?mode=resume`}>Edit</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminResumeArchive(item.userId, !item.isArchived), item.isArchived ? 'Resume restored.' : 'Resume archived.', loadResumes)}>
                      {item.isArchived ? 'Restore' : 'Archive'}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => banAdminResumeAuthor(item.userId), 'Resume author banned.', loadResumes)}>Ban author</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminResume(item.userId), 'Resume deleted.', loadResumes)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'vacancies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Vacancies</h2>
              <div className="admin-toolbar">
                <input value={vacanciesSearch} onChange={(event) => setVacanciesSearch(event.target.value)} placeholder="Search title" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadVacancies()}>Find</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {vacancies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>Company #{item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Status ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/dashboard/curator/vacancies/create?vacancyId=${item.id}`}>Open card</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/vacancies/create?vacancyId=${item.id}`}>Edit</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminVacancyStatus(item.id, 7), 'Vacancy archived.', loadVacancies)}>Archive</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminVacancyStatus(item.id, 6), 'Vacancy blocked/rejected.', loadVacancies)}>Block</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminVacancy(item.id), 'Vacancy deleted.', loadVacancies)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'opportunities' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Events / Opportunities</h2>
              <div className="admin-toolbar">
                <input value={opportunitiesSearch} onChange={(event) => setOpportunitiesSearch(event.target.value)} placeholder="Search title" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadOpportunities()}>Find</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {opportunities.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.title}</h3><p>Company #{item.companyId}</p></div>
                    <span className="status-chip">{moderationStatusLabel[item.status] ?? `Status ${item.status}`}</span>
                  </div>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/opportunity/${item.id}`}>Open card</Link>
                    <button type="button" className="btn btn--secondary" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, item.status === 2 ? 3 : 2), 'Event moderation status updated.', loadOpportunities)}>Edit</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, 7), 'Event archived.', loadOpportunities)}>Archive</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminOpportunityStatus(item.id, 6), 'Event blocked/rejected.', loadOpportunities)}>Block</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminOpportunity(item.id), 'Event deleted.', loadOpportunities)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'companies' ? (
          <section className="dashboard-section card seeker-profile-panel">
            <div className="seeker-profile-panel__head">
              <h2>Companies</h2>
              <div className="admin-toolbar">
                <input value={companiesSearch} onChange={(event) => setCompaniesSearch(event.target.value)} placeholder="Search legalName/brandName/industry" />
                <button type="button" className="btn btn--ghost" onClick={() => void loadCompanies()}>Find</button>
              </div>
            </div>
            <div className="admin-list-grid">
              {companies.map((item) => (
                <article key={item.id} className="favorite-card admin-list-card">
                  <div className="favorite-card__head">
                    <div><h3>{item.brandName || item.legalName}</h3><p>{item.legalName}</p></div>
                    <span className="status-chip">{companyStatusLabel[item.status] ?? `Status ${item.status}`}</span>
                  </div>
                  <p>{item.industry || '-'}</p>
                  <div className="favorite-card__actions">
                    <Link className="btn btn--secondary" to={`/company/${item.id}`}>Open card</Link>
                    <Link className="btn btn--secondary" to={`/dashboard/curator/companies/create?companyId=${item.id}`} state={{ company: item }}>Edit</Link>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => verifyAdminCompany(item.id), 'Company verified.', loadCompanies)}>Verify</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => rejectAdminCompany(item.id), 'Company rejected.', loadCompanies)}>Reject</button>
                    <button type="button" className="btn btn--ghost" onClick={() => void handleAction(() => updateAdminCompanyStatus(item.id, 5), 'Company blocked.', loadCompanies)}>Block</button>
                    <button type="button" className="btn btn--danger" onClick={() => void handleAction(() => deleteAdminCompany(item.id), 'Company deleted.', loadCompanies)}>Delete</button>
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
