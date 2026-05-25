'use client'

import { useState } from 'react'
import {
  useSimulation,
  SIMULATION_ROLE_LABELS,
  type SimulationRole,
} from '@/lib/admin/simulation-context'
import { INSTITUTION_TYPE_LABELS } from '@/lib/supabase/types'
import type { InstitutionType } from '@/lib/supabase/types'

// Institution types that make sense for simulation
const INST_TYPE_OPTIONS: Array<{ value: InstitutionType; label: string }> = [
  'k12_school', 'public_library', 'museum', 'parks_department',
  'zoo', 'aquarium', 'chamber_of_commerce', 'tourism_board', 'proprietor',
].map((v) => ({ value: v as InstitutionType, label: INSTITUTION_TYPE_LABELS[v] ?? v }))

const ROLES: SimulationRole[] = [
  'real',
  'institutional_manager',
  'educational_user',
  'individual_creator',
  'employee',
  'free_user',
  'pro_subscriber',
]

interface Props {
  userEmail: string
}

export function AdminPanel({ userEmail }: Props) {
  const { simulation, setSimulation, resetSimulation } = useSimulation()
  const [open, setOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState<SimulationRole>(simulation.role)
  const [pendingInstType, setPendingInstType] = useState<InstitutionType>(
    simulation.institutionType,
  )

  const isInstitutional = pendingRole === 'institutional_manager' || pendingRole === 'employee'

  function handleApply() {
    if (pendingRole === 'real') {
      resetSimulation()
    } else {
      setSimulation({
        active: true,
        role: pendingRole,
        institutionType: pendingInstType,
      })
    }
  }

  function handleReset() {
    setPendingRole('real')
    resetSimulation()
  }

  return (
    <div className="fixed bottom-4 left-4 z-[200] flex flex-col items-start">
      {/* Floating panel */}
      {open && (
        <div className="mb-2 w-72 rounded-modal border border-hairline bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-navy">⚙ Admin Panel</p>
            <p className="mt-0.5 text-xs text-muted truncate">
              Logged in as: {userEmail}
            </p>
          </div>

          <div className="space-y-4 px-4 py-3">
            {/* Simulate role */}
            <div>
              <p className="mb-2 text-xs font-semibold text-navy">Simulate role</p>
              <div className="space-y-1.5">
                {ROLES.map((role) => (
                  <label key={role} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="sim-role"
                      value={role}
                      checked={pendingRole === role}
                      onChange={() => setPendingRole(role)}
                      className="accent-green"
                    />
                    <span className="text-sm text-navy">
                      {SIMULATION_ROLE_LABELS[role]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Institution type (only when institutional role selected) */}
            {isInstitutional && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-navy">
                  Institution type
                </p>
                <select
                  value={pendingInstType}
                  onChange={(e) => setPendingInstType(e.target.value as InstitutionType)}
                  className="w-full rounded-panel border border-hairline px-2 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-green"
                >
                  {INST_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 border-t border-hairline pt-3">
              <button
                onClick={handleApply}
                className="flex-1 rounded-panel bg-green px-3 py-1.5 text-sm font-medium text-white hover:bg-green transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleReset}
                className="flex-1 rounded-panel border border-hairline px-3 py-1.5 text-sm font-medium text-navy hover:border-green transition-colors"
              >
                Reset
              </button>
            </div>

            {simulation.active && (
              <p className="text-center text-xs font-medium text-accent">
                Simulation active: {SIMULATION_ROLE_LABELS[simulation.role]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Admin panel"
        className={`flex h-9 w-9 items-center justify-center rounded-full text-base shadow-md transition-colors ${
          simulation.active
            ? 'bg-amber-400 text-amber-900 hover:bg-amber-500'
            : 'bg-navy text-white hover:bg-green'
        }`}
      >
        ⚙
      </button>
    </div>
  )
}
