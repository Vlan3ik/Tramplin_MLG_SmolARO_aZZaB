import { useEffect, useMemo, useState } from 'react'
import { getSeekerPrivacySettingsSnapshot, subscribeToSeekerPrivacySettings } from '../utils/seeker-privacy-settings'

export function useSeekerPrivacySettings() {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return subscribeToSeekerPrivacySettings(() => {
      setVersion((current) => current + 1)
    })
  }, [])

  return useMemo(() => getSeekerPrivacySettingsSnapshot(), [version])
}
