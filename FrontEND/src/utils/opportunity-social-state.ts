import type { Opportunity } from '../types/opportunity'

type OpportunitySocialEntityType = 'vacancy' | 'opportunity'

type OpportunitySocialStateSnapshot = {
  isFavoriteByMe: boolean
  friendFavoritesCount: number
  friendsAppliedCount: number
}

type OpportunitySocialStateRecord = OpportunitySocialStateSnapshot & {
  id: number
  entityType: OpportunitySocialEntityType
}

type OpportunityLike = Pick<
  Opportunity,
  'id' | 'entityType' | 'type' | 'isFavoriteByMe' | 'friendFavoritesCount' | 'friendsAppliedCount'
>

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

export function resolveOpportunitySocialEntityType(opportunity: Pick<Opportunity, 'entityType' | 'type'>): OpportunitySocialEntityType {
  if (opportunity.entityType === 'vacancy' || opportunity.entityType === 'opportunity') {
    return opportunity.entityType
  }

  return opportunity.type === 'vacancy' || opportunity.type === 'internship' ? 'vacancy' : 'opportunity'
}

function toSnapshot(opportunity: OpportunityLike): OpportunitySocialStateSnapshot {
  return {
    isFavoriteByMe: Boolean(opportunity.isFavoriteByMe),
    friendFavoritesCount: normalizeCount(opportunity.friendFavoritesCount),
    friendsAppliedCount: normalizeCount(opportunity.friendsAppliedCount),
  }
}

export function readOpportunitySocialState(opportunity: OpportunityLike): OpportunitySocialStateSnapshot {
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

export function upsertOpportunitySocialState(opportunity: OpportunityLike) {
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

export function upsertOpportunitySocialStates(opportunities: OpportunityLike[]) {
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

export function subscribeToOpportunitySocialState(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
