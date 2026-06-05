'use client'

import Link from 'next/link'

export type UsersRoleFilter = 'all' | 'admin' | 'creator' | 'collector'
export type UsersPlanFilter = 'all' | 'free' | 'pro' | 'studio' | 'paid' | 'comp'

export function UsersToolbar({
  search,
  onSearch,
  role,
  onRole,
  plan,
  onPlan,
}: {
  search: string
  onSearch: (v: string) => void
  role: UsersRoleFilter
  onRole: (v: UsersRoleFilter) => void
  plan: UsersPlanFilter
  onPlan: (v: UsersPlanFilter) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Search users</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search users…"
            className="h-9 w-[280px] rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
        </label>

        <Select
          label="Role"
          value={role}
          onChange={(v) => onRole(v as UsersRoleFilter)}
          options={[
            { value: 'all',       label: 'All roles' },
            { value: 'admin',     label: 'Platform admin' },
            { value: 'creator',   label: 'Creator (legacy)' },
            { value: 'collector', label: 'Collector (legacy)' },
          ]}
        />

        <Select
          label="Plan"
          value={plan}
          onChange={(v) => onPlan(v as UsersPlanFilter)}
          options={[
            { value: 'all',    label: 'All plans' },
            { value: 'free',   label: 'Free' },
            { value: 'pro',    label: 'Pro' },
            { value: 'studio', label: 'Studio' },
            { value: 'comp',   label: 'Comp grants' },
            { value: 'paid',   label: 'Paid (billing)' },
          ]}
        />
      </div>

      <Link
        href="/access/comp-subscriptions"
        className="text-[13px] font-semibold text-blue underline-offset-2 hover:underline"
      >
        View comp grants →
      </Link>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
