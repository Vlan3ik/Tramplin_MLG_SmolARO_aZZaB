import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acceptEmployerCompanyInvite } from '../api/employer'
import { Footer } from '../components/layout/Footer'
import { MainHeader } from '../components/layout/MainHeader'
import { TopServiceBar } from '../components/layout/TopServiceBar'

type InviteAcceptStatus = 'pending' | 'success' | 'expired' | 'used' | 'forbidden' | 'notfound' | 'error'

function normalizeInviteStatus(error: unknown): InviteAcceptStatus {
  if (!(error instanceof Error)) {
    return 'error'
  }

  const normalized = error.message.toLowerCase()
  if (normalized.includes('companies.invites.expired') || normalized.includes('expired')) return 'expired'
  if (normalized.includes('companies.invites.already_accepted') || normalized.includes('companies.membership.exists') || normalized.includes('already') || normalized.includes('used')) return 'used'
  if (normalized.includes('forbidden') || normalized.includes('insufficient permissions')) return 'forbidden'
  if (normalized.includes('not found') || normalized.includes('companies.invites.not_found')) return 'notfound'
  return 'error'
}

export function CompanyInviteAcceptPage() {
  const { token = '' } = useParams<{ token?: string }>()
  const [status, setStatus] = useState<InviteAcceptStatus>('pending')

  useEffect(() => {
    const normalizedToken = token.trim()
    if (!normalizedToken) {
      setStatus('notfound')
      return
    }

    let active = true
    setStatus('pending')

    void acceptEmployerCompanyInvite(normalizedToken)
      .then(() => {
        if (active) {
          setStatus('success')
        }
      })
      .catch((error) => {
        if (active) {
          setStatus(normalizeInviteStatus(error))
        }
      })

    return () => {
      active = false
    }
  }, [token])

  const content = useMemo(() => {
    if (status === 'pending') {
      return {
        title: 'Проверяем приглашение',
        text: 'Подождите, выполняем вход в компанию по ссылке.',
      }
    }

    if (status === 'success') {
      return {
        title: 'Приглашение принято',
        text: 'Вы успешно добавлены в компанию.',
      }
    }

    if (status === 'expired') {
      return {
        title: 'Ссылка истекла',
        text: 'Срок действия приглашения закончился. Запросите новую ссылку у владельца компании.',
      }
    }

    if (status === 'used') {
      return {
        title: 'Ссылка уже использована',
        text: 'Этот токен уже применен или вы уже состоите в компании.',
      }
    }

    if (status === 'forbidden') {
      return {
        title: 'Недостаточно прав',
        text: 'Ваш аккаунт не может принять это приглашение.',
      }
    }

    if (status === 'notfound') {
      return {
        title: 'Приглашение не найдено',
        text: 'Проверьте корректность ссылки или запросите новую.',
      }
    }

    return {
      title: 'Не удалось принять приглашение',
      text: 'Произошла ошибка при обработке ссылки. Попробуйте позже.',
    }
  }, [status])

  return (
    <div className="page-shell">
      <TopServiceBar />
      <MainHeader />
      <main>
        <section className="container seeker-profile-page">
          <section className="dashboard-section card seeker-profile-panel">
            <h2>{content.title}</h2>
            <p>{content.text}</p>
            <div className="favorite-card__actions">
              <Link className="btn btn--primary" to="/dashboard/employer">
                Перейти в кабинет работодателя
              </Link>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  )
}
