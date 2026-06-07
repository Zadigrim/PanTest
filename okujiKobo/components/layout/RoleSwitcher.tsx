'use client'

import { useTransition } from 'react'
import { setActiveRole, setActiveInstitution } from '@/app/actions/role'
import type { OkujiKoboRole } from '@/lib/roles'
import { ROLE_LABELS } from '@/lib/roles'

interface InstitutionRef {
  id:   string
  name: string
}

interface RoleSwitcherProps {
  roles: OkujiKoboRole[]
  activeRole: OkujiKoboRole
  /** Institutions the caller belongs to (employee_authorizations).
   *  When length > 1, the institution dropdown renders next to the
   *  role dropdown. When length ≤ 1, no institution control shows —
   *  flag checks fall through to the sole institution (single-
   *  institution employees never need the picker). */
  institutions: InstitutionRef[]
  /** Currently-pinned institution id (from okuji_active_institution
   *  cookie). null when unset — flag checks fall back to whatever
   *  the caller passes explicitly, or refuse for non-admins. */
  activeInstitutionId: string | null
}

export function RoleSwitcher({
  roles,
  activeRole,
  institutions,
  activeInstitutionId,
}: RoleSwitcherProps) {
  const [isPending, startTransition] = useTransition()

  const hasRolePicker        = roles.length > 1
  const hasInstitutionPicker = institutions.length > 1
  if (!hasRolePicker && !hasInstitutionPicker) return null

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as OkujiKoboRole
    startTransition(() => { void setActiveRole(next) })
  }

  function handleInstitutionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null
    startTransition(() => { void setActiveInstitution(next) })
  }

  // Resolve the picker's default — if no cookie yet, fall back to
  // the first institution in the list so the dropdown reads
  // sensibly even before the user has explicitly chosen.
  const institutionValue = activeInstitutionId
    ?? (institutions[0]?.id ?? '')

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="hidden sm:inline text-[#A8C0CE] font-medium">Viewing as:</span>

      {hasRolePicker && (
        <Dropdown
          value={activeRole}
          onChange={handleRoleChange}
          ariaLabel="Switch active role"
          disabled={isPending}
        >
          {roles.map((r) => (
            <option key={r} value={r} className="bg-navy text-white">
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Dropdown>
      )}

      {hasInstitutionPicker && (
        <>
          <span className="text-[#A8C0CE]/60">@</span>
          <Dropdown
            value={institutionValue}
            onChange={handleInstitutionChange}
            ariaLabel="Switch active institution"
            disabled={isPending}
          >
            {institutions.map((i) => (
              <option key={i.id} value={i.id} className="bg-navy text-white">
                {i.name}
              </option>
            ))}
          </Dropdown>
        </>
      )}
    </div>
  )
}

function Dropdown({
  value, onChange, ariaLabel, disabled, children,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  ariaLabel: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="
          h-7 cursor-pointer appearance-none rounded-card
          border border-white/20 bg-white/10
          pl-2 pr-6 text-xs text-white
          hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-green
          disabled:opacity-50 transition-colors
        "
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-white/70"
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
}
