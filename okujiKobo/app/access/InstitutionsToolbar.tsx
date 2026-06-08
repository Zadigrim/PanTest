'use client'

import { useState } from 'react'
import { CreateInstitutionModal } from './CreateInstitutionModal'

export type InstAccessFilter = 'all' | 'free-civic' | 'commercial'

export function InstitutionsToolbar({
  search,
  onSearch,
  category,
  onCategory,
  categoryOptions,
  access,
  onAccess,
  isAdmin,
}: {
  search: string
  onSearch: (v: string) => void
  category: string
  onCategory: (v: string) => void
  categoryOptions: string[]
  access: InstAccessFilter
  onAccess: (v: InstAccessFilter) => void
  isAdmin: boolean
}) {
  const [showCreate, setShowCreate] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Search institutions</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search institutions…"
            className="h-9 w-[280px] rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
        </label>

        <select
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
        >
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={access}
          onChange={(e) => onAccess(e.target.value as InstAccessFilter)}
          className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
        >
          <option value="all">All access</option>
          <option value="free-civic">Free · civic</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>

      {/* Admins get the live create modal; non-admins still see a
          disabled button with the explanation so the affordance is
          discoverable. /api/institutions enforces is_platform_admin
          server-side regardless. */}
      <button
        type="button"
        disabled={!isAdmin}
        onClick={isAdmin ? () => setShowCreate(true) : undefined}
        title={isAdmin ? 'Create a new institution' : 'Admins only.'}
        className={`inline-flex h-9 items-center rounded-[8px] border-[1.5px] px-3 text-sm font-semibold ${
          isAdmin
            ? 'cursor-pointer border-ink bg-white text-ink hover:bg-paper'
            : 'cursor-not-allowed border-hairline bg-white text-hairline'
        }`}
      >
        + Add institution
      </button>

      {showCreate && <CreateInstitutionModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
