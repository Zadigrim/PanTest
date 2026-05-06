'use client'

import { useState, useEffect, useCallback, useTransition, useId } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASSIFIERS = [
  { value: 'educational', label: 'Educational' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'nature', label: 'Nature' },
  { value: 'arts_culture', label: 'Arts & culture' },
  { value: 'family', label: 'Family' },
  { value: 'accessible', label: 'Accessible' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'hidden_gem', label: 'Hidden gem' },
  { value: 'food_drink', label: 'Food & drink' },
] as const

const GRADE_LEVELS = [
  { value: 'K-2', label: 'K–2' },
  { value: '3-5', label: '3–5' },
  { value: '6-8', label: '6–8' },
  { value: '9-12', label: '9–12' },
] as const

const SUBJECT_AREAS = [
  { value: 'life_science', label: 'Life science' },
  { value: 'earth_science', label: 'Earth science' },
  { value: 'history', label: 'History' },
  { value: 'social_studies', label: 'Social studies' },
  { value: 'arts', label: 'Arts' },
  { value: 'literature', label: 'Literature' },
] as const

const INSTITUTION_TYPES = [
  { value: 'k12_school',         label: 'K–12 School' },
  { value: 'school',             label: 'School' },
  { value: 'public_library',     label: 'Public Library' },
  { value: 'library',            label: 'Library' },
  { value: 'museum',             label: 'Museum' },
  { value: 'parks_department',   label: 'Parks Department' },
  { value: 'park',               label: 'Park' },
  { value: 'aquarium',           label: 'Aquarium' },
  { value: 'zoo',                label: 'Zoo' },
  { value: 'nature_conservatory', label: 'Nature Conservatory' },
  { value: 'nonprofit',          label: 'Nonprofit' },
] as const

type SortOption = 'acknowledged' | 'newest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StopCard {
  id: string
  name: string
  stamp_icon: string | null
  address_city: string | null
  address_state: string | null
  classifiers: string[]
  learning_objective: string | null
  acknowledgment_count: number
  creator_name: string | null
  institution_name: string | null
}

interface ImportModalState {
  stopId: string
  stopName: string
}

interface DraftPassport {
  id: string
  title: string
}

// ---------------------------------------------------------------------------
// Checkbox filter group
// ---------------------------------------------------------------------------

function CheckboxGroup<T extends string>({
  items,
  selected,
  onChange,
}: {
  items: readonly { value: T; label: string }[]
  selected: Set<T>
  onChange: (value: T, checked: boolean) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <label key={item.value} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(item.value)}
            onChange={(e) => onChange(item.value, e.target.checked)}
            className="accent-panoply-teal w-4 h-4 shrink-0"
          />
          <span className="text-sm text-panoply-navy">{item.label}</span>
        </label>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter panel
// ---------------------------------------------------------------------------

function FilterPanel({
  searchQuery,
  onSearchChange,
  onSearch,
  selectedClassifiers,
  onClassifierChange,
  selectedGrades,
  onGradeChange,
  selectedSubjects,
  onSubjectChange,
  selectedInstitutionTypes,
  onInstitutionTypeChange,
  sortBy,
  onSortChange,
}: {
  searchQuery: string
  onSearchChange: (v: string) => void
  onSearch: () => void
  selectedClassifiers: Set<string>
  onClassifierChange: (value: string, checked: boolean) => void
  selectedGrades: Set<string>
  onGradeChange: (value: string, checked: boolean) => void
  selectedSubjects: Set<string>
  onSubjectChange: (value: string, checked: boolean) => void
  selectedInstitutionTypes: Set<string>
  onInstitutionTypeChange: (value: string, checked: boolean) => void
  sortBy: SortOption
  onSortChange: (v: SortOption) => void
}) {
  const educationalChecked = selectedClassifiers.has('educational')
  const searchId = useId()
  const sortId = useId()

  return (
    <aside
      className="w-full lg:w-[280px] shrink-0 bg-white rounded-panel border border-panoply-gray-2 p-5 self-start sticky top-4"
      aria-label="Stop filters"
    >
      {/* Search */}
      <div className="flex gap-2 mb-5">
        <input
          id={searchId}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="Search stops…"
          className="flex-1 h-9 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal transition-colors"
          aria-label="Search stops"
        />
        <button
          type="button"
          onClick={onSearch}
          className="h-9 px-3 rounded-panel bg-panoply-teal text-white text-sm font-medium hover:bg-[#0F6E56] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
        >
          Search
        </button>
      </div>

      {/* Classifiers */}
      <section className="mb-5">
        <h3 className="text-xs font-semibold text-panoply-gray-3 uppercase tracking-wide mb-3">
          Classifiers
        </h3>
        <CheckboxGroup
          items={CLASSIFIERS}
          selected={selectedClassifiers}
          onChange={onClassifierChange}
        />
      </section>

      {/* Grade level — shown when Educational is checked */}
      {educationalChecked && (
        <section className="mb-5 pl-3 border-l-2 border-panoply-teal-lt">
          <h3 className="text-xs font-semibold text-panoply-gray-3 uppercase tracking-wide mb-3">
            Grade level
          </h3>
          <CheckboxGroup
            items={GRADE_LEVELS}
            selected={selectedGrades}
            onChange={onGradeChange}
          />
        </section>
      )}

      {/* Subject area — shown when Educational is checked */}
      {educationalChecked && (
        <section className="mb-5 pl-3 border-l-2 border-panoply-teal-lt">
          <h3 className="text-xs font-semibold text-panoply-gray-3 uppercase tracking-wide mb-3">
            Subject area
          </h3>
          <CheckboxGroup
            items={SUBJECT_AREAS}
            selected={selectedSubjects}
            onChange={onSubjectChange}
          />
        </section>
      )}

      {/* Institution type */}
      <section className="mb-5">
        <h3 className="text-xs font-semibold text-panoply-gray-3 uppercase tracking-wide mb-3">
          Institution type
        </h3>
        <CheckboxGroup
          items={INSTITUTION_TYPES}
          selected={selectedInstitutionTypes}
          onChange={onInstitutionTypeChange}
        />
      </section>

      {/* Sort */}
      <section>
        <h3
          id={sortId}
          className="text-xs font-semibold text-panoply-gray-3 uppercase tracking-wide mb-3"
        >
          Sort by
        </h3>
        <div className="space-y-2" role="radiogroup" aria-labelledby={sortId}>
          {(
            [
              { value: 'acknowledged', label: 'Most acknowledged' },
              { value: 'newest', label: 'Newest' },
            ] as { value: SortOption; label: string }[]
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="stops-sort"
                value={opt.value}
                checked={sortBy === opt.value}
                onChange={() => onSortChange(opt.value)}
                className="accent-panoply-teal w-4 h-4 shrink-0"
              />
              <span className="text-sm text-panoply-navy">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Stop result card
// ---------------------------------------------------------------------------

function StopResultCard({
  stop,
  onImport,
}: {
  stop: StopCard
  onImport: (stopId: string, stopName: string) => void
}) {
  const location = [stop.address_city, stop.address_state].filter(Boolean).join(', ')
  const truncatedObjective = stop.learning_objective
    ? stop.learning_objective.length > 120
      ? stop.learning_objective.slice(0, 120) + '…'
      : stop.learning_objective
    : null

  return (
    <article className="bg-white rounded-panel border border-panoply-gray-2 p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-panoply-gray-1 text-xl"
          aria-hidden="true"
        >
          {stop.stamp_icon ?? '📍'}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-panoply-navy leading-tight truncate">
            {stop.name}
          </h3>
          {location && (
            <p className="text-xs text-panoply-gray-3 mt-0.5">{location}</p>
          )}
        </div>
      </div>

      {/* Classifiers */}
      {stop.classifiers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stop.classifiers.slice(0, 4).map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-card bg-panoply-teal-lt px-2 py-0.5 text-xs font-medium text-panoply-teal-dk capitalize"
            >
              {c.replace(/_/g, ' ')}
            </span>
          ))}
          {stop.classifiers.length > 4 && (
            <span className="inline-flex items-center rounded-card bg-panoply-gray-2 px-2 py-0.5 text-xs font-medium text-panoply-gray-3">
              +{stop.classifiers.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Learning objective */}
      {truncatedObjective && (
        <p className="text-sm text-panoply-gray-3 leading-relaxed">{truncatedObjective}</p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-1 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-panoply-gray-3 space-y-0.5">
          <p>
            <span className="tabular-nums font-medium text-panoply-navy">
              {stop.acknowledgment_count}
            </span>{' '}
            acknowledgments
          </p>
          {(stop.creator_name ?? stop.institution_name) && (
            <p>
              Built by{stop.creator_name ? ` ${stop.creator_name}` : ''}
              {stop.institution_name ? ` at ${stop.institution_name}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/stops/${stop.id}`}
            className="inline-flex items-center h-8 px-3 rounded-panel border border-panoply-gray-2 text-xs font-medium text-panoply-navy hover:bg-panoply-gray-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
          >
            Preview
          </Link>
          <button
            type="button"
            onClick={() => onImport(stop.id, stop.name)}
            className="inline-flex items-center h-8 px-3 rounded-panel bg-panoply-teal text-white text-xs font-medium hover:bg-[#0F6E56] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
          >
            Import
          </button>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------

function ImportModal({
  state,
  onClose,
}: {
  state: ImportModalState
  onClose: () => void
}) {
  const [passports, setPassports] = useState<DraftPassport[]>([])
  const [selectedPassportId, setSelectedPassportId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [importing, startImportTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const selectId = useId()

  useEffect(() => {
    async function loadPassports() {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be signed in to import stops.')
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('passports')
        .select('id, title')
        .eq('creator_id', user.id)
        .eq('is_published', false)
        .order('updated_at', { ascending: false })

      setPassports((data ?? []) as DraftPassport[])
      if ((data ?? []).length > 0) {
        setSelectedPassportId((data as DraftPassport[])[0].id)
      }
      setLoading(false)
    }
    loadPassports()
  }, [])

  function handleImport() {
    setError(null)

    if (!selectedPassportId && selectedPassportId !== '__new') {
      setError('Select a passport or choose "Create new passport".')
      return
    }

    startImportTransition(async () => {
      try {
        let passportId = selectedPassportId

        // Create new passport if requested
        if (selectedPassportId === '__new') {
          const res = await fetch('/api/design/create', { method: 'POST' })
          if (!res.ok) throw new Error('Failed to create passport')
          const json = (await res.json()) as { id: string }
          passportId = json.id
        }

        const res = await fetch('/api/stops/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stopId: state.stopId, passportId }),
        })

        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error ?? 'Import failed')
        }

        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-modal shadow-xl border border-panoply-gray-2 p-6">
        {success ? (
          <>
            <h2 id="import-modal-title" className="text-lg font-semibold text-panoply-navy mb-2">
              Stop imported
            </h2>
            <p className="text-sm text-panoply-gray-3 mb-5">
              &ldquo;{state.stopName}&rdquo; has been added to your passport.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-panel bg-panoply-teal text-white text-sm font-medium hover:bg-[#0F6E56] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
              >
                Done
              </button>
              <Link
                href="/design"
                className="h-9 px-4 rounded-panel border border-panoply-gray-2 text-sm font-medium text-panoply-navy hover:bg-panoply-gray-1 transition-colors inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
              >
                Go to designer
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="import-modal-title" className="text-lg font-semibold text-panoply-navy mb-1">
              Import this stop
            </h2>
            <p className="text-sm text-panoply-gray-3 mb-5">
              Import &ldquo;{state.stopName}&rdquo; into which passport?
            </p>

            {loading ? (
              <p className="text-sm text-panoply-gray-3 animate-pulse mb-5">
                Loading your passports…
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-5">
                <label htmlFor={selectId} className="text-sm font-medium text-panoply-navy">
                  Passport
                </label>
                <select
                  id={selectId}
                  value={selectedPassportId}
                  onChange={(e) => setSelectedPassportId(e.target.value)}
                  className="h-9 rounded-panel border border-panoply-gray-2 bg-white px-3 text-sm text-panoply-navy focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal"
                >
                  {passports.length === 0 && (
                    <option value="" disabled>
                      No draft passports yet
                    </option>
                  )}
                  {passports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                  <option value="__new">+ Create new passport</option>
                </select>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-panoply-coral mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || loading}
                className="h-9 px-4 rounded-panel bg-panoply-teal text-white text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
              >
                {importing ? 'Importing…' : 'Import stop'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="h-9 px-4 rounded-panel border border-panoply-gray-2 text-sm font-medium text-panoply-navy hover:bg-panoply-gray-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StopsLibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassifiers, setSelectedClassifiers] = useState<Set<string>>(
    new Set(['educational']),
  )
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set())
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [selectedInstitutionTypes, setSelectedInstitutionTypes] = useState<Set<string>>(
    new Set(),
  )
  const [sortBy, setSortBy] = useState<SortOption>('acknowledged')

  const [stops, setStops] = useState<StopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [importModal, setImportModal] = useState<ImportModalState | null>(null)

  const fetchStops = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const supabase = createClient()

      let query = supabase
        .from('stops')
        .select(
          `
          id,
          name,
          stamp_icon,
          address_city,
          address_state,
          classifiers,
          learning_objective,
          created_at,
          passport_pages!inner (
            passports!inner (
              creator_id,
              profiles!creator_id ( display_name ),
              institutions!institution_id ( name )
            )
          )
        `,
        )
        .eq('is_shared', true)

      // Apply classifier filter
      if (selectedClassifiers.size > 0) {
        query = query.overlaps('classifiers', Array.from(selectedClassifiers))
      }

      // Apply search
      const trimmed = searchQuery.trim()
      if (trimmed) {
        query = query.ilike('name', `%${trimmed}%`)
      }

      // Sort
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false })
      }

      // Fetch presence_sessions count separately (aggregates in select aren't always supported)
      const { data: rawStops, error: stopsErr } = await query.limit(60)
      if (stopsErr) throw new Error(stopsErr.message)

      const stopIds = (rawStops ?? []).map((s: { id: string }) => s.id)

      // Count acknowledgments per stop
      const ackMap = new Map<string, number>()
      if (stopIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sessions } = await (supabase as any)
          .from('presence_sessions')
          .select('stop_id')
          .in('stop_id', stopIds) as { data: Array<{ stop_id: string }> | null }

        for (const session of sessions ?? []) {
          ackMap.set(session.stop_id, (ackMap.get(session.stop_id) ?? 0) + 1)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let assembled: StopCard[] = (rawStops ?? []).map((s: any) => {
        const passport = s.passport_pages?.passports
        const institutionName = passport?.institutions?.name ?? null
        const creatorName = passport?.profiles?.display_name ?? null
        return {
          id: s.id,
          name: s.name,
          stamp_icon: s.stamp_icon ?? null,
          address_city: s.address_city ?? null,
          address_state: s.address_state ?? null,
          classifiers: Array.isArray(s.classifiers) ? s.classifiers : [],
          learning_objective: s.learning_objective ?? null,
          acknowledgment_count: ackMap.get(s.id) ?? 0,
          creator_name: creatorName,
          institution_name: institutionName,
        }
      })

      // Sort by acknowledgments client-side (Supabase aggregates are complex)
      if (sortBy === 'acknowledged') {
        assembled = assembled.sort((a, b) => b.acknowledgment_count - a.acknowledgment_count)
      }

      setStops(assembled)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load stops')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedClassifiers, selectedGrades, selectedSubjects, selectedInstitutionTypes, sortBy])

  // Initial load and when filters change
  useEffect(() => {
    fetchStops()
  }, [fetchStops])

  function toggleSet<T extends string>(
    set: Set<T>,
    setFn: (s: Set<T>) => void,
    value: T,
    checked: boolean,
  ) {
    const next = new Set(set)
    if (checked) next.add(value)
    else next.delete(value)
    setFn(next)
  }

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      {/* Header */}
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-panoply-navy">Stop Library</h1>
            <p className="text-xs text-panoply-gray-3 mt-0.5">
              Browse and import educational stops shared by the Panoply community.
            </p>
          </div>
          <Link
            href="/design"
            className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            ← Back to designer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8">
        <div className="flex gap-8 items-start">
          {/* Filter panel */}
          <FilterPanel
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={fetchStops}
            selectedClassifiers={selectedClassifiers}
            onClassifierChange={(v, c) =>
              toggleSet(selectedClassifiers, setSelectedClassifiers, v, c)
            }
            selectedGrades={selectedGrades}
            onGradeChange={(v, c) => toggleSet(selectedGrades, setSelectedGrades, v, c)}
            selectedSubjects={selectedSubjects}
            onSubjectChange={(v, c) => toggleSet(selectedSubjects, setSelectedSubjects, v, c)}
            selectedInstitutionTypes={selectedInstitutionTypes}
            onInstitutionTypeChange={(v, c) =>
              toggleSet(selectedInstitutionTypes, setSelectedInstitutionTypes, v, c)
            }
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {/* Results */}
          <div className="flex-1 min-w-0">
            {loading && (
              <div className="py-20 text-center">
                <p className="text-sm text-panoply-gray-3 animate-pulse">Loading stops…</p>
              </div>
            )}

            {loadError && (
              <div
                role="alert"
                className="bg-panoply-coral/10 border border-panoply-coral rounded-panel p-4 text-panoply-coral text-sm"
              >
                {loadError}
              </div>
            )}

            {!loading && !loadError && stops.length === 0 && (
              <div className="py-20 text-center rounded-modal border-2 border-dashed border-panoply-gray-2">
                <p className="text-base font-semibold text-panoply-navy mb-2">
                  No stops found
                </p>
                <p className="text-sm text-panoply-gray-3">
                  Try adjusting your filters or search query.
                </p>
              </div>
            )}

            {!loading && !loadError && stops.length > 0 && (
              <>
                <p className="text-xs text-panoply-gray-3 mb-4">
                  {stops.length} stop{stops.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {stops.map((stop) => (
                    <StopResultCard
                      key={stop.id}
                      stop={stop}
                      onImport={(id, name) => setImportModal({ stopId: id, stopName: name })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Import modal */}
      {importModal && (
        <ImportModal
          state={importModal}
          onClose={() => setImportModal(null)}
        />
      )}
    </div>
  )
}
