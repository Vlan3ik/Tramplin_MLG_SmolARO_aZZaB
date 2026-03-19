import { useEffect, useState } from 'react'
import { logoutUser } from '../api/auth'
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
    async signOut() {
      const refreshToken = session?.refreshToken ?? null

      if (refreshToken) {
        try {
          await logoutUser({ refreshToken })
        } catch {
          // If the session is already invalid on backend, local cleanup still must happen.
        }
      }

      clearAuthSession()
    },
  }
}
