'use client'

export interface ActiveFilters {
  themes:   Set<string>
  grades:   Set<string>
  subjects: Set<string>
}

/**
 * Themes — the subset of the 30 classifier values most relevant
 * to educational stops. Underlying field stays `classifiers`;
 * this is a UI label.
 */
const THEMES: { value: string; label: string }[] = [
  { value: 'educational',  label: 'Educational' },
  { value: 'heritage',     label: 'Heritage' },
  { value: 'nature',       label: 'Nature' },
  { value: 'arts_culture', label: 'Arts & culture' },
  { value: 'family',       label: 'Family' },
  { value: 'accessible',   label: 'Accessible' },
  { value: 'challenge',    label: 'Challenge' },
  { value: 'hidden_gem',   label: 'Hidden gem' },
  { value: 'food_drink',   label: 'Food & drink' },
  { value: 'outdoor',      label: 'Outdoor' },
  { value: 'wildlife',     label: 'Wildlife' },
  { value: 'science',      label: 'Science' },
]

/** Grade levels — schema vocab is K-2 / 3-5 / 6-8 / 9-12. */
const GRADES: { value: string; label: string }[] = [
  { value: 'K-2',  label: 'K–2' },
  { value: '3-5',  label: '3–5' },
  { value: '6-8',  label: '6–8' },
  { value: '9-12', label: '9–12' },
]

/** Subject areas — schema vocabulary as-is (Phase-0 decision).
 *  Friendlier rebranding deferred until either a migration adds
 *  Math / STEM / Environment, or the brief's authors confirm
 *  the schema vocabulary IS the user-facing vocabulary. */
const SUBJECTS: { value: string; label: string }[] = [
  { value: 'life_science',    label: 'Life science' },
  { value: 'earth_science',   label: 'Earth science' },
  { value: 'history',         label: 'History' },
  { value: 'social_studies',  label: 'Social studies' },
  { value: 'arts',            label: 'Arts' },
  { value: 'literature',      label: 'Literature' },
]

export function FilterRail({
  search,
  onSearch,
  filters,
  onChange,
}: {
  search: string
  onSearch: (v: string) => void
  filters: ActiveFilters
  onChange: (next: ActiveFilters) => void
}) {
  function toggle(kind: keyof ActiveFilters, value: string) {
    const next = new Set(filters[kind])
    if (next.has(value)) next.delete(value); else next.add(value)
    onChange({ ...filters, [kind]: next })
  }

  return (
    <aside className="space-y-5">
      {/* Search */}
      <label className="relative block">
        <span className="sr-only">Search stops</span>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search stops…"
          className="h-9 w-full rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>

      <Group title="Themes">
        {THEMES.map((t) => (
          <CheckRow
            key={t.value}
            label={t.label}
            checked={filters.themes.has(t.value)}
            onChange={() => toggle('themes', t.value)}
          />
        ))}
      </Group>

      <Group title="Grade level">
        {GRADES.map((g) => (
          <CheckRow
            key={g.value}
            label={g.label}
            checked={filters.grades.has(g.value)}
            onChange={() => toggle('grades', g.value)}
          />
        ))}
      </Group>

      <Group title="Subject area">
        {SUBJECTS.map((s) => (
          <CheckRow
            key={s.value}
            label={s.label}
            checked={filters.subjects.has(s.value)}
            onChange={() => toggle('subjects', s.value)}
          />
        ))}
      </Group>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p
        className="mb-2 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function CheckRow({
  label, checked, onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded accent-green"
      />
      <span>{label}</span>
    </label>
  )
}

// Label-to-display helpers for the toolbar's removable chips.
export function labelForFilter(kind: keyof ActiveFilters, value: string): string {
  const src =
    kind === 'themes'   ? THEMES
    : kind === 'grades'  ? GRADES
    : SUBJECTS
  return src.find((e) => e.value === value)?.label ?? value
}
