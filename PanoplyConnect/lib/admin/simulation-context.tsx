'use client'

import { createContext, useContext, useState } from 'react'
import type { InstitutionType } from '@/lib/supabase/types'

export type SimulationRole =
  | 'real'
  | 'institutional_manager'
  | 'educational_user'
  | 'individual_creator'
  | 'employee'
  | 'free_user'
  | 'pro_subscriber'

export interface SimulationState {
  active: boolean
  role: SimulationRole
  institutionType: InstitutionType
}

interface SimulationContextValue {
  simulation: SimulationState
  setSimulation: (s: SimulationState) => void
  resetSimulation: () => void
}

const DEFAULT_SIMULATION: SimulationState = {
  active: false,
  role: 'real',
  institutionType: 'k12_school',
}

const SimulationContext = createContext<SimulationContextValue>({
  simulation: DEFAULT_SIMULATION,
  setSimulation: () => {},
  resetSimulation: () => {},
})

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulation, setSimulationState] = useState<SimulationState>(DEFAULT_SIMULATION)

  function setSimulation(s: SimulationState) {
    setSimulationState(s)
  }

  function resetSimulation() {
    setSimulationState(DEFAULT_SIMULATION)
  }

  return (
    <SimulationContext.Provider value={{ simulation, setSimulation, resetSimulation }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  return useContext(SimulationContext)
}

export const SIMULATION_ROLE_LABELS: Record<SimulationRole, string> = {
  real:                   'Real account',
  institutional_manager:  'Institutional manager',
  educational_user:       'Educational user',
  individual_creator:     'Individual creator',
  employee:               'Employee / verifier',
  free_user:              'Free tier user',
  pro_subscriber:         'Pro subscriber',
}
