'use client'

import { useEffect, useState, useTransition, useCallback, useId, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import * as Dialog from '@radix-ui/react-dialog'
import {
  INSTITUTION_TYPE_LABELS,
  FREE_INSTITUTION_TYPES,
  ADMISSION_CHARGING_TYPES,
  ADMISSION_QUESTION_TYPES,
} from '@/lib/supabase/types'
import type { Institution, InstitutionType } from '@/lib/supabase/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePricingModel(type: string | null, chargesAdmission: boolean): string {
  if (!type) return 'community'
  if (FREE_INSTITUTION_TYPES.has(type)) return 'free'
  if (ADMISSION_CHARGING_TYPES.has(type) || chargesAdmission) return 'paid_passport'
  return 'community'
}

const PRICING_MODEL_LABELS: Record<string, string> = {
  free:         'Free forever',
  paid_passport:'Paid passport (70/30)',
  community:    'Community subscription',
  regional:     'Regional subscription',
  enterprise:   'Enterprise subscription',
}

const TIER_LABELS: Record<string, string> = {
  community:  'Community',
  commercial: 'Commercial',
  enterprise: 'Enterprise',
}

const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Educational',    types: ['k12_school','public_library','museum','educational_nonprofit','after_school_program','literacy_organization','youth_development','homeschool_cooperative'] },
  { label: 'Environmental',  types: ['parks_department','nature_conservatory','land_trust','watershed_council','native_plant_society','wildlife_rehabilitation','environmental_education'] },
  { label: 'Cultural',       types: ['historical_society','heritage_organization','cultural_center','oral_history_project'] },
  { label: 'Community Arts', types: ['community_theater','public_art_organization','community_arts_center','community_music_program','writing_center'] },
  { label: 'Social Services',types: ['food_bank','homeless_shelter','refugee_immigrant_services','free_health_clinic','adult_literacy'] },
  { label: 'Community Access',types: ['community_garden','maker_space','tool_lending_library','seed_library','municipality'] },
  { label: 'Paid Admission', types: ['zoo','aquarium','botanical_garden','science_museum','childrens_museum','nature_center_paid'] },
  { label: 'Commercial',     types: ['chamber_of_commerce','tourism_board','proprietor','hotel_chain','expo_organizer'] },
  { label: 'Other',          types: ['general','library','school','park','historic_site','nonprofit','other'] },
]

// ─── Add Institution Dialog ───────────────────────────────────────────────────

interface AddInstitutionForm {
  name: string
  institution_type: string
  charges_admission: boolean
  contact_name: string
  contact_email: string
  address_line1: string
  address_city: string
  address_state: string
  address_zip: string
  website: string
  internal_notes: string
}

const EMPTY_FORM: AddInstitutionForm = {
  name: '',
  institution_type: '',
  charges_admission: false,
  contact_name: '',
  contact_email: '',
  address_line1: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  website: '',
  internal_notes: '',
}

function AddInstitutionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (inst: Institution) => void
}) {
  const formId = useId()
  const [form, setForm] = useState<AddInstitutionForm>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pricingModel = computePricingModel(form.institution_type, form.charges_admission)
  const showAdmissionQuestion = form.institution_type
    ? ADMISSION_QUESTION_TYPES.has(form.institution_type)
    : false

  function set<K extends keyof AddInstitutionForm>(k: K, v: AddInstitutionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.institution_type) { setError('Type is required.'); return }
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const tier: string =
        FREE_INSTITUTION_TYPES.has(form.institution_type) ? 'community'
        : ADMISSION_CHARGING_TYPES.has(form.institution_type) ? 'commercial'
        : 'community'

      const baseName = form.name.trim()
      const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        + '-' + Math.random().toString(36).slice(2, 7)

      const { data, error: insertErr } = await supabase
        .from('institutions')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          name: baseName,
          slug,
          type: form.institution_type,   // legacy NOT NULL column in production DB
          institution_type: form.institution_type,
          charges_admission: form.charges_admission,
          pricing_model: pricingModel,
          tier,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          address_line1: form.address_line1.trim() || null,
          address_city: form.address_city.trim() || null,
          address_state: form.address_state.trim() || null,
          address_zip: form.address_zip.trim() || null,
          website: form.website.trim() || null,
          internal_notes: form.internal_notes.trim() || null,
        } as any)
        .select('*')
        .single()

      if (insertErr || !data) {
        setError(insertErr?.message ?? 'Failed to create institution.')
        return
      }
      onCreated(data as unknown as Institution)
      setForm(EMPTY_FORM)
      onOpenChange(false)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-modal bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="mb-4 text-lg font-bold text-panoply-navy">
            Add Institution
          </Dialog.Title>

          <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <Field label="Name *">
              <input
                className={INPUT_CLS}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Portland Art Museum"
                autoFocus
              />
            </Field>

            {/* Type */}
            <Field label="Type *">
              <select
                className={INPUT_CLS}
                value={form.institution_type}
                onChange={(e) => set('institution_type', e.target.value)}
              >
                <option value="">Select type…</option>
                {TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((t) => (
                      <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t] ?? t}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* Charges admission — only for nature/science types */}
            {showAdmissionQuestion && (
              <label className="flex items-center gap-2 text-sm text-panoply-navy">
                <input
                  type="checkbox"
                  className="accent-panoply-teal h-4 w-4"
                  checked={form.charges_admission}
                  onChange={(e) => set('charges_admission', e.target.checked)}
                />
                Charges admission
              </label>
            )}

            {/* Pricing model — auto-computed */}
            {form.institution_type && (
              <div className="rounded-panel bg-panoply-gray-1 px-3 py-2 text-sm text-panoply-gray-3">
                Pricing model:{' '}
                <span className="font-medium text-panoply-navy">
                  {PRICING_MODEL_LABELS[pricingModel] ?? pricingModel}
                </span>
              </div>
            )}

            {/* Contact info */}
            <div className="border-t border-panoply-gray-2 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
                Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact name">
                  <input className={INPUT_CLS} value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Jane Smith" />
                </Field>
                <Field label="Contact email">
                  <input className={INPUT_CLS} type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="jane@example.org" />
                </Field>
              </div>
            </div>

            {/* Address */}
            <div className="border-t border-panoply-gray-2 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
                Address
              </p>
              <Field label="Street">
                <input className={INPUT_CLS} value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} placeholder="123 Main St" />
              </Field>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Field label="City">
                    <input className={INPUT_CLS} value={form.address_city} onChange={(e) => set('address_city', e.target.value)} placeholder="Portland" />
                  </Field>
                </div>
                <Field label="State">
                  <input className={INPUT_CLS} value={form.address_state} onChange={(e) => set('address_state', e.target.value)} placeholder="OR" maxLength={2} />
                </Field>
                <Field label="ZIP">
                  <input className={INPUT_CLS} value={form.address_zip} onChange={(e) => set('address_zip', e.target.value)} placeholder="97201" />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Website">
                  <input className={INPUT_CLS} type="url" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://example.org" />
                </Field>
              </div>
            </div>

            {/* Internal notes */}
            <div className="border-t border-panoply-gray-2 pt-3">
              <Field label="Internal notes">
                <textarea
                  className={`${INPUT_CLS} min-h-[72px] resize-y`}
                  value={form.internal_notes}
                  onChange={(e) => set('internal_notes', e.target.value)}
                  placeholder="Notes visible only to Panoply admins…"
                />
              </Field>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-3 border-t border-panoply-gray-2 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-panel border border-panoply-gray-2 px-4 py-2 text-sm font-medium text-panoply-gray-3 hover:border-panoply-navy hover:text-panoply-navy transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-panel bg-panoply-teal px-4 py-2 text-sm font-medium text-white hover:bg-panoply-teal-dk disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Creating…' : 'Create institution'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-panel border border-panoply-gray-2 px-3 py-1.5 text-sm text-panoply-navy focus:border-panoply-teal focus:outline-none focus:ring-1 focus:ring-panoply-teal'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-panoply-gray-3">{label}</label>
      {children}
    </div>
  )
}

// ─── Institutions tab ─────────────────────────────────────────────────────────

function InstitutionsTab({
  institutions,
  loading,
  fetchError,
  isAdmin,
  onRefresh,
}: {
  institutions: Institution[]
  loading: boolean
  fetchError: string | null
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [list, setList] = useState<Institution[]>(institutions)

  // Sync when parent list refreshes
  useEffect(() => { setList(institutions) }, [institutions])

  const filtered = list
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => !typeFilter || i.institution_type === typeFilter)
    .filter((i) => !tierFilter || i.tier === tierFilter)

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={`${INPUT_CLS} max-w-xs`}
          placeholder="Search institutions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${INPUT_CLS} w-48`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {TYPE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map((t) => (
                <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t] ?? t}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={`${INPUT_CLS} w-36`}
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
        >
          <option value="">All tiers</option>
          {Object.entries(TIER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="flex-1" />
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-panel bg-panoply-teal px-4 py-2 text-sm font-medium text-white hover:bg-panoply-teal-dk transition-colors"
          >
            + Add institution
          </button>
        )}
      </div>

      {/* Error */}
      {fetchError && (
        <div role="alert" className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg className="h-7 w-7 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <>
          <p className="mb-2 text-xs text-panoply-gray-3">
            {filtered.length} {filtered.length === 1 ? 'institution' : 'institutions'}
          </p>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-lg font-semibold text-panoply-navy">No institutions found</p>
              <p className="mt-1 text-sm text-panoply-gray-3">Try adjusting the search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-panel border border-panoply-gray-2">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-panoply-gray-2 bg-panoply-gray-1 text-left">
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Name</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Type</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Tier</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Pricing</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">City</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b border-panoply-gray-2 last:border-0 transition-colors hover:bg-panoply-teal-lt/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/access/institutions/${inst.id}`}
                          className="font-medium text-panoply-navy hover:text-panoply-teal-dk hover:underline"
                        >
                          {inst.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-panoply-gray-3">
                        {inst.institution_type
                          ? (INSTITUTION_TYPE_LABELS[inst.institution_type] ?? inst.institution_type)
                          : <span className="italic">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inst.tier === 'enterprise' ? 'bg-panoply-teal-lt text-panoply-teal-dk'
                          : inst.tier === 'commercial' ? 'bg-panoply-amber/15 text-panoply-amber'
                          : 'bg-panoply-gray-2 text-panoply-gray-3'
                        }`}>
                          {TIER_LABELS[inst.tier] ?? inst.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-panoply-gray-3">
                        {PRICING_MODEL_LABELS[inst.pricing_model] ?? inst.pricing_model}
                      </td>
                      <td className="px-4 py-3 text-panoply-gray-3">
                        {inst.address_city ?? <span className="italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <AddInstitutionDialog
          open={showAdd}
          onOpenChange={setShowAdd}
          onCreated={(inst) => {
            setList((prev) => [inst, ...prev])
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  display_name: string | null
  email: string | null
  role: string | null
  created_at: string
  institutions: { id: string; name: string }[]
}

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const supabase = createClient()

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        setFetchError(error.message)
        setLoading(false)
        return
      }

      // Fetch employee_authorizations to map users → institutions
      const { data: authzRows } = await supabase
        .from('employee_authorizations')
        .select('user_id, institution:institutions(id, name)')

      const instMap = new Map<string, { id: string; name: string }[]>()
      for (const row of (authzRows ?? []) as unknown as { user_id: string; institution: { id: string; name: string } | null }[]) {
        if (!row.institution) continue
        if (!instMap.has(row.user_id)) instMap.set(row.user_id, [])
        instMap.get(row.user_id)!.push(row.institution)
      }

      const rows: UserRow[] = ((profiles ?? []) as unknown as { id: string; display_name: string | null; role: string | null; created_at: string }[]).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: null,
        role: p.role,
        created_at: p.created_at,
        institutions: instMap.get(p.id) ?? [],
      }))

      setUsers(rows)
      setLoading(false)
    })()
  }, [])

  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex gap-4">
      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <input
            className={`${INPUT_CLS} max-w-xs`}
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {fetchError && (
          <div role="alert" className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-7 w-7 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-panoply-gray-3">
              {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            </p>
            <div className="overflow-x-auto rounded-panel border border-panoply-gray-2">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-panoply-gray-2 bg-panoply-gray-1 text-left">
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Name</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Role</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Institutions</th>
                    <th className="px-4 py-3 font-medium text-panoply-gray-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className={`cursor-pointer border-b border-panoply-gray-2 last:border-0 transition-colors hover:bg-panoply-teal-lt/30 ${
                        selected?.id === u.id ? 'bg-panoply-teal-lt/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-panoply-navy">
                        {u.display_name ?? <span className="italic text-panoply-gray-3">No name</span>}
                      </td>
                      <td className="px-4 py-3 text-panoply-gray-3 capitalize">{u.role ?? '—'}</td>
                      <td className="px-4 py-3 text-panoply-gray-3">
                        {u.institutions.length === 0
                          ? <span className="italic">—</span>
                          : u.institutions.map((i) => i.name).join(', ')
                        }
                      </td>
                      <td className="px-4 py-3 text-panoply-gray-3">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 rounded-panel border border-panoply-gray-2 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-panoply-navy">User detail</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-panoply-gray-3 hover:text-panoply-navy text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-lg font-bold text-panoply-navy">
            {selected.display_name ?? <span className="italic text-panoply-gray-3">No name</span>}
          </p>
          <p className="mt-0.5 text-xs text-panoply-gray-3 capitalize">{selected.role ?? '—'}</p>
          <p className="mt-0.5 text-xs text-panoply-gray-3">
            Joined {new Date(selected.created_at).toLocaleDateString()}
          </p>

          <div className="mt-4 border-t border-panoply-gray-2 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
              Institutions
            </p>
            {selected.institutions.length === 0 ? (
              <p className="text-sm italic text-panoply-gray-3">No institution memberships</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {selected.institutions.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/access/institutions/${i.id}`}
                      className="text-sm text-panoply-teal-dk hover:underline"
                    >
                      {i.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AccessMode = 'loading' | 'admin' | 'manager' | 'unauthorized'

export default function AccessPage() {
  const [mode, setMode] = useState<AccessMode>('loading')
  const [activeTab, setActiveTab] = useState<'institutions' | 'users'>('institutions')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [instLoading, setInstLoading] = useState(true)
  const [instError, setInstError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchInstitutions = useCallback(async () => {
    setInstLoading(true)
    setInstError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setInstError(error.message)
    } else {
      setInstitutions((data ?? []) as unknown as Institution[])
    }
    setInstLoading(false)
  }, [])

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setMode('unauthorized'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin, connect_roles')
        .eq('id', user.id)
        .single()

      const isPlatformAdmin =
        (profile as unknown as { is_platform_admin?: boolean } | null)?.is_platform_admin === true ||
        ((profile as unknown as { connect_roles?: string[] } | null)?.connect_roles ?? []).includes('platform_admin')

      if (isPlatformAdmin) {
        setMode('admin')
        await fetchInstitutions()
        return
      }

      // Check institutional manager (institution where id = user.id)
      const { data: ownInst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', user.id)

      if (ownInst && ownInst.length > 0) {
        setMode('manager')
        setInstitutions(ownInst as unknown as Institution[])
        setInstLoading(false)
        return
      }

      // Check employee
      const { data: authz } = await supabase
        .from('employee_authorizations')
        .select('institution:institutions(*)')
        .eq('user_id', user.id)

      if (authz && authz.length > 0) {
        setMode('manager')
        const insts = (authz as unknown as { institution: Institution | null }[])
          .map((a) => a.institution)
          .filter(Boolean) as Institution[]
        setInstitutions(insts)
        setInstLoading(false)
        return
      }

      setMode('unauthorized')
      setInstLoading(false)
    })()
  }, [fetchInstitutions])

  const isAdmin = mode === 'admin'

  if (mode === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      </div>
    )
  }

  if (mode === 'unauthorized') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="text-5xl">🔒</span>
        <h2 className="mt-4 text-lg font-bold text-panoply-navy">Access restricted</h2>
        <p className="mt-2 text-sm text-panoply-gray-3">
          Access Management is available to institution managers and Panoply admins.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-panel bg-panoply-teal px-4 py-2 text-sm font-medium text-white hover:bg-panoply-teal-dk transition-colors"
        >
          Back to Panoply
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-panoply-navy">Access Management</h1>
        <p className="mt-1 text-sm text-panoply-gray-3">
          {isAdmin
            ? 'Manage all institutions and users on the platform.'
            : 'Manage your institution members and access.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-0 border-b border-panoply-gray-2">
        <button
          onClick={() => setActiveTab('institutions')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'institutions'
              ? 'border-panoply-teal text-panoply-teal-dk'
              : 'border-transparent text-panoply-gray-3 hover:text-panoply-navy'
          }`}
        >
          Institutions
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'border-panoply-teal text-panoply-teal-dk'
                : 'border-transparent text-panoply-gray-3 hover:text-panoply-navy'
            }`}
          >
            Users
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'institutions' && (
        <InstitutionsTab
          institutions={institutions}
          loading={instLoading}
          fetchError={instError}
          isAdmin={isAdmin}
          onRefresh={fetchInstitutions}
        />
      )}
      {activeTab === 'users' && isAdmin && (
        <UsersTab isAdmin={isAdmin} />
      )}
    </div>
  )
}
