'use client'

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

      {/* TODO: needs an admin-only `+ Add institution` flow.
          /access/institutions/[id] is the deep editor for existing
          institutions; there's no create form yet. Button stays
          disabled with the explanation, never faked. */}
      <button
        type="button"
        disabled
        title={isAdmin
          ? 'Institution create flow is not built yet — admins seed institutions via SQL today.'
          : 'Admins only.'}
        className="inline-flex h-9 cursor-not-allowed items-center rounded-[8px] border-[1.5px] border-hairline bg-white px-3 text-sm font-semibold text-hairline"
      >
        + Add institution
      </button>
    </div>
  )
}
