import type { Opportunity } from '../types/opportunity'

export type OpportunitySocialEntityType = 'vacancy' | 'opportunity'

type OpportunitySocialStateSnapshot = {
  isFavoriteByMe: boolean
  friendFavoritesCount: number
  friendsAppliedCount: number
}

type OpportunitySocialStateRecord = OpportunitySocialStateSnapshot & {
  id: number
  entityType: OpportunitySocialEntityType
}

export type OpportunitySocialSnapshotPayload = {
  entityType: OpportunitySocialEntityType
  id: number
  isFavoriteByMe: boolean
  friendFavoritesCount?: number | null
  friendApplicationsCount?: number | null
}

export type OpportunitySocialStateSource = Pick<
  Opportunity,
  'id' | 'entityType' | 'type' | 'isFavoriteByMe' | 'friendFavoritesCount' | 'friendsAppliedCount'
> & {
  friendApplicationsCount?: number | null
  friendsResponsesCount?: number | null
  friendsRespondedCount?: number | null
}

const stateByKey = new Map<string, OpportunitySocialStateRecord>()
const listeners = new Set<() => void>()

function buildKey(entityType: OpportunitySocialEntityType, id: number) {
  return `${entityType}:${id}`
}

function normalizeCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.floor(value)
}

function normalizeFriendsAppliedCount(
  source: Pick<OpportunitySocialStateSource, 'friendsAppliedCount' | 'friendApplicationsCount' | 'friendsResponsesCount' | 'friendsRespondedCount'>,
) {
  const values = [source.friendsAppliedCount, source.friendApplicationsCount, source.friendsResponsesCount, source.friendsRespondedCount]

  for (const value of values) {
    const normalized = normalizeCount(value)
    if (normalized > 0) {
      return normalized
    }
  }

  return 0
}

export function resolveOpportunitySocialEntityType(opportunity: Pick<Opportunity, 'entityType' | 'type'>): OpportunitySocialEntityType {
  if (opportunity.entityType === 'vacancy' || opportunity.entityType === 'opportunity') {
    return opportunity.entityType
  }

  return opportunity.type === 'vacancy' || opportunity.type === 'internship' ? 'vacancy' : 'opportunity'
}

function toSnapshot(opportunity: OpportunitySocialStateSource): OpportunitySocialStateSnapshot {
  return {
    isFavoriteByMe: Boolean(opportunity.isFavoriteByMe),
    friendFavoritesCount: normalizeCount(opportunity.friendFavoritesCount),
    friendsAppliedCount: normalizeFriendsAppliedCount(opportunity),
  }
}

export function readOpportunitySocialState(opportunity: OpportunitySocialStateSource): OpportunitySocialStateSnapshot {
  const entityType = resolveOpportunitySocialEntityType(opportunity)
  const key = buildKey(entityType, opportunity.id)
  const existing = stateByKey.get(key)

  if (existing) {
    return {
      isFavoriteByMe: existing.isFavoriteByMe,
      friendFavoritesCount: existing.friendFavoritesCount,
      friendsAppliedCount: existing.friendsAppliedCount,
    }
  }

  return toSnapshot(opportunity)
}

function emitOpportunitySocialStateChange() {
  listeners.forEach((listener) => {
    listener()
  })
}

export function upsertOpportunitySocialState(opportunity: OpportunitySocialStateSource) {
  const entityType = resolveOpportunitySocialEntityType(opportunity)
  const key = buildKey(entityType, opportunity.id)
  const nextSnapshot = toSnapshot(opportunity)
  const currentSnapshot = stateByKey.get(key)

  if (
    currentSnapshot &&
    currentSnapshot.isFavoriteByMe === nextSnapshot.isFavoriteByMe &&
    currentSnapshot.friendFavoritesCount === nextSnapshot.friendFavoritesCount &&
    currentSnapshot.friendsAppliedCount === nextSnapshot.friendsAppliedCount
  ) {
    return
  }

  stateByKey.set(key, {
    id: opportunity.id,
    entityType,
    ...nextSnapshot,
  })
  emitOpportunitySocialStateChange()
}

export function upsertOpportunitySocialStates(opportunities: OpportunitySocialStateSource[]) {
  let hasChanges = false

  for (const opportunity of opportunities) {
    const entityType = resolveOpportunitySocialEntityType(opportunity)
    const key = buildKey(entityType, opportunity.id)
    const nextSnapshot = toSnapshot(opportunity)
    const currentSnapshot = stateByKey.get(key)

    if (
      currentSnapshot &&
      currentSnapshot.isFavoriteByMe === nextSnapshot.isFavoriteByMe &&
      currentSnapshot.friendFavoritesCount === nextSnapshot.friendFavoritesCount &&
      currentSnapshot.friendsAppliedCount === nextSnapshot.friendsAppliedCount
    ) {
      continue
    }

    stateByKey.set(key, {
      id: opportunity.id,
      entityType,
      ...nextSnapshot,
    })
    hasChanges = true
  }

  if (hasChanges) {
    emitOpportunitySocialStateChange()
  }
}

export function setOpportunityFavoriteState(entityType: OpportunitySocialEntityType, id: number, isFavoriteByMe: boolean) {
  const key = buildKey(entityType, id)
  const existing = stateByKey.get(key)
  const nextValue = Boolean(isFavoriteByMe)

  if (!existing) {
    stateByKey.set(key, {
      id,
      entityType,
      isFavoriteByMe: nextValue,
      friendFavoritesCount: 0,
      friendsAppliedCount: 0,
    })
    emitOpportunitySocialStateChange()
    return
  }

  if (existing.isFavoriteByMe === nextValue) {
    return
  }

  stateByKey.set(key, {
    ...existing,
    isFavoriteByMe: nextValue,
  })
  emitOpportunitySocialStateChange()
}

export function applyOpportunitySocialSnapshot(snapshot: OpportunitySocialSnapshotPayload) {
  const key = buildKey(snapshot.entityType, snapshot.id)
  const nextSnapshot: OpportunitySocialStateSnapshot = {
    isFavoriteByMe: Boolean(snapshot.isFavoriteByMe),
    friendFavoritesCount: normalizeCount(snapshot.friendFavoritesCount),
    friendsAppliedCount: normalizeCount(snapshot.friendApplicationsCount),
  }
  const existing = stateByKey.get(key)

  if (
    existing &&
    existing.isFavoriteByMe === nextSnapshot.isFavoriteByMe &&
    existing.friendFavoritesCount === nextSnapshot.friendFavoritesCount &&
    existing.friendsAppliedCount === nextSnapshot.friendsAppliedCount
  ) {
    return
  }

  stateByKey.set(key, {
    id: snapshot.id,
    entityType: snapshot.entityType,
    ...nextSnapshot,
  })
  emitOpportunitySocialStateChange()
}

export function subscribeToOpportunitySocialState(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
