import { useEffect, useState } from 'react'
import type { AuthSession } from '../types/auth'
import {
  clearAuthSession,
  hasActiveSession,
  loadAuthSession,
  saveAuthSession,
  subscribeToAuthSession,
} from '../utils/auth'

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  useEffect(() => {
    const unsubscribe = subscribeToAuthSession(() => {
      setSession(loadAuthSession())
    })

    return unsubscribe
  }, [])

  return {
    session,
    isAuthenticated: hasActiveSession(session),
    signIn(sessionToSave: AuthSession) {
      saveAuthSession(sessionToSave)
    },
    signOut() {
      clearAuthSession()
    },
  }
}
