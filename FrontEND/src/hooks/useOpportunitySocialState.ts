import { useEffect, useMemo, useState } from 'react'
import type { Opportunity } from '../types/opportunity'
import { readOpportunitySocialState, subscribeToOpportunitySocialState } from '../utils/opportunity-social-state'

export function useOpportunitySocialState(opportunity: Opportunity) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return subscribeToOpportunitySocialState(() => {
      setVersion((current) => current + 1)
    })
  }, [])

  return useMemo(() => readOpportunitySocialState(opportunity), [opportunity, version])
}
