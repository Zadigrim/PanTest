'use client'

import { useTransition } from 'react'
import { setActiveRole } from '@/app/actions/role'
import type { OkujiConnectRole } from '@/lib/roles'
import { ROLE_LABELS } from '@/lib/roles'

interface RoleSwitcherProps {
  roles: OkujiConnectRole[]
  activeRole: OkujiConnectRole
}

export function RoleSwitcher({ roles, activeRole }: RoleSwitcherProps) {
  const [isPending, startTransition] = useTransition()

  if (roles.length <= 1) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as OkujiConnectRole
    startTransition(() => {
      void setActiveRole(next)
    })
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="hidden sm:inline text-[#A8C0CE] font-medium">Viewing as:</span>
      <div className="relative">
        <select
          value={activeRole}
          onChange={handleChange}
          disabled={isPending}
          aria-label="Switch active role"
          className="
            h-7 cursor-pointer appearance-none rounded-card
            border border-white/20 bg-white/10
            pl-2 pr-6 text-xs text-white
            hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-green
            disabled:opacity-50 transition-colors
          "
        >
          {roles.map((r) => (
            <option key={r} value={r} className="bg-navy text-white">
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span
          className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-white/70"
          aria-hidden="true"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  )
}
