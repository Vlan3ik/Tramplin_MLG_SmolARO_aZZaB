import type { SeekerSettings } from '../types/me'

export type SeekerPrivacySettingsSnapshot = {
  showLinksInResume: boolean
  showSocialProofs: boolean
}

const defaultSnapshot: SeekerPrivacySettingsSnapshot = {
  showLinksInResume: true,
  showSocialProofs: true,
}

let snapshot: SeekerPrivacySettingsSnapshot = { ...defaultSnapshot }
const listeners = new Set<() => void>()

export function getSeekerPrivacySettingsSnapshot() {
  return snapshot
}

export function applySeekerPrivacySettings(settings: Pick<SeekerSettings, 'showLinksInResume' | 'showSocialProofs'>) {
  const nextSnapshot: SeekerPrivacySettingsSnapshot = {
    showLinksInResume: Boolean(settings.showLinksInResume),
    showSocialProofs: Boolean(settings.showSocialProofs),
  }

  if (
    snapshot.showLinksInResume === nextSnapshot.showLinksInResume &&
    snapshot.showSocialProofs === nextSnapshot.showSocialProofs
  ) {
    return
  }

  snapshot = nextSnapshot
  listeners.forEach((listener) => listener())
}

export function resetSeekerPrivacySettings() {
  if (
    snapshot.showLinksInResume === defaultSnapshot.showLinksInResume &&
    snapshot.showSocialProofs === defaultSnapshot.showSocialProofs
  ) {
    return
  }

  snapshot = { ...defaultSnapshot }
  listeners.forEach((listener) => listener())
}

export function subscribeToSeekerPrivacySettings(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
