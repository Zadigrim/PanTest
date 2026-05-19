'use client'

import { useSimulation, SIMULATION_ROLE_LABELS } from '@/lib/admin/simulation-context'

interface Props {
  userEmail: string
}

export function SimulationBanner({ userEmail }: Props) {
  const { simulation, resetSimulation } = useSimulation()

  if (!simulation.active) return null

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-4 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900">
      <span>
        ⚠ Admin simulation active — viewing as{' '}
        <strong>{SIMULATION_ROLE_LABELS[simulation.role]}</strong>.{' '}
        Your real account: <strong>{userEmail}</strong>.
      </span>
      <button
        onClick={resetSimulation}
        className="shrink-0 rounded border border-amber-700 bg-amber-500 px-3 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-600 transition-colors"
      >
        Reset to real account
      </button>
    </div>
  )
}
