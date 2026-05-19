'use client'

import { useEffect, useState, useTransition, useCallback, useId, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import * as Dialog from '@radix-ui/react-dialog'
import { INSTITUTION_TYPE_LABELS } from '@/lib/supabase/types'
import type { Institution } from '@/lib/supabase/types'
import {
  computePricingModel,
  isAdmissionDependent,
  PRICING_MODEL_LABELS,
  PRICING_MODEL_DESCRIPTIONS,
  PRICING_BADGE_COLORS,
  INSTITUTION_TYPE_GROUPS,
  type PricingModel,
} from '@/lib/pricing'

// ─── Pricing badge ────────────────────────────────────────────────────────────

function PricingBadge({ model, locked }: { model: string; locked?: boolean }) {
  const colorCls = PRICING_BADGE_COLORS[model as PricingModel] ?? 'bg-okuji-gray-2 text-okuji-gray-3'
  const label = PRICING_MODEL_LABELS[model as PricingModel] ?? model
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorCls}`}>
      {label}
      {locked && <span title="Admin override" className="opacity-70">🔒</span>}
    </span>
  )
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-panel border border-okuji-gray-2 px-3 py-1.5 text-sm text-okuji-navy focus:border-okuji-teal focus:outline-none focus:ring-1 focus:ring-okuji-teal'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-okuji-gray-3">{label}</label>
      {children}
    </div>
  )
}

// ─── Add Institution Dialog ───────────────────────────────────────────────────

interface AddInstitutionForm {
  name: string
  institution_type: string
  charges_admission: boolean
  municipality_population: string
  pricing_model_override: string
  pricing_model_locked: boolean
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
  municipality_population: '',
  pricing_model_override: '',
  pricing_model_locked: false,
  contact_name: '',
  contact_email: '',
  address_line1: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  website: '',
  internal_notes: '',
}

const PRICING_MODELS = ['free', 'paid_passport', 'community', 'regional', 'enterprise', 'patron'] as const

function AddInstitutionDialog({
  open,
  onOpenChange,
  onCreated,
  isAdmin,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (inst: Institution) => void
  isAdmin: boolean
}) {
  const formId = useId()
  const [form, setForm] = useState<AddInstitutionForm>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pop = form.municipality_population ? parseInt(form.municipality_population, 10) : undefined
  const computedModel = computePricingModel(
    form.institution_type,
    form.charges_admission,
    Number.isFinite(pop) ? pop : undefined,
  )
  const effectiveModel = (form.pricing_model_locked && form.pricing_model_override)
    ? form.pricing_model_override as PricingModel
    : computedModel

  const showAdmission = isAdmissionDependent(form.institution_type)
  const showPopulation = form.institution_type === 'municipality'

  function set<K extends keyof AddInstitutionForm>(k: K, v: AddInstitutionForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.institution_type) { setError('Type is required.'); return }
    setError(null)

    startTransition(async () => {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          institution_type: form.institution_type || null,
          charges_admission: form.charges_admission,
          municipality_population: showPopulation && form.municipality_population
            ? parseInt(form.municipality_population, 10)
            : null,
          pricing_model_override: form.pricing_model_locked ? form.pricing_model_override || null : null,
          pricing_model_locked: form.pricing_model_locked,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          address_line1: form.address_line1.trim() || null,
          address_city: form.address_city.trim() || null,
          address_state: form.address_state.trim() || null,
          address_zip: form.address_zip.trim() || null,
          website: form.website.trim() || null,
          internal_notes: form.internal_notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to create institution.')
        return
      }

      const { institution } = await res.json()
      onCreated(institution as Institution)
      setForm(EMPTY_FORM)
      onOpenChange(false)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-modal bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="mb-4 text-lg font-bold text-okuji-navy">
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
                onChange={(e) => {
                  set('institution_type', e.target.value)
                  set('charges_admission', false)
                }}
              >
                <option value="">Select type…</option>
                {INSTITUTION_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((t) => (
                      <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t] ?? t}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* Admission question for nature/science types */}
            {showAdmission && (
              <fieldset className="rounded-panel border border-okuji-gray-2 p-3">
                <legend className="px-1 text-xs font-medium text-okuji-gray-3">Admission</legend>
                <p className="mb-2 text-xs text-okuji-gray-3">Does this institution charge admission?</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-okuji-navy">
                    <input
                      type="radio"
                      name={`${formId}-admission`}
                      checked={form.charges_admission}
                      onChange={() => set('charges_admission', true)}
                      className="accent-okuji-teal"
                    />
                    Yes — paid admission
                  </label>
                  <label className="flex items-center gap-2 text-sm text-okuji-navy">
                    <input
                      type="radio"
                      name={`${formId}-admission`}
                      checked={!form.charges_admission}
                      onChange={() => set('charges_admission', false)}
                      className="accent-okuji-teal"
                    />
                    No — free admission
                  </label>
                </div>
              </fieldset>
            )}

            {/* Municipality population */}
            {showPopulation && (
              <Field label="Approximate population">
                <input
                  className={INPUT_CLS}
                  type="number"
                  min={0}
                  value={form.municipality_population}
                  onChange={(e) => set('municipality_population', e.target.value)}
                  placeholder="e.g. 12000"
                />
                <p className="text-xs text-okuji-gray-3">Under 25,000 → free. Over 25,000 → Community tier.</p>
              </Field>
            )}

            {/* Pricing model card */}
            {form.institution_type && (
              <div className={`rounded-panel px-3 py-3 border ${
                form.pricing_model_locked ? 'border-okuji-amber bg-okuji-amber/10' : 'border-okuji-gray-2 bg-okuji-gray-1'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-okuji-gray-3">Pricing model</p>
                  <PricingBadge model={effectiveModel} locked={form.pricing_model_locked} />
                </div>
                <p className="mt-1 text-xs text-okuji-gray-3">
                  {PRICING_MODEL_DESCRIPTIONS[effectiveModel as PricingModel] ?? ''}
                </p>
                {form.pricing_model_locked && computedModel !== effectiveModel && (
                  <p className="mt-1 text-xs text-okuji-amber font-medium">
                    Auto-computed would be: {PRICING_MODEL_LABELS[computedModel]}
                  </p>
                )}
              </div>
            )}

            {/* Admin override */}
            {isAdmin && form.institution_type && (
              <div className="rounded-panel border border-okuji-gray-2 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-okuji-gray-3">
                  Admin override
                </p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Field label="Override pricing model">
                      <select
                        className={INPUT_CLS}
                        value={form.pricing_model_override}
                        onChange={(e) => set('pricing_model_override', e.target.value)}
                      >
                        <option value="">— use auto-computed —</option>
                        {PRICING_MODELS.map((m) => (
                          <option key={m} value={m}>{PRICING_MODEL_LABELS[m]}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-okuji-navy pb-1.5 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="accent-okuji-teal h-3.5 w-3.5"
                      checked={form.pricing_model_locked}
                      onChange={(e) => set('pricing_model_locked', e.target.checked)}
                      disabled={!form.pricing_model_override}
                    />
                    Lock override
                  </label>
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="border-t border-okuji-gray-2 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-okuji-gray-3">Contact</p>
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
            <div className="border-t border-okuji-gray-2 pt-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-okuji-gray-3">Address</p>
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
            <div className="border-t border-okuji-gray-2 pt-3">
              <Field label="Internal notes">
                <textarea
                  className={`${INPUT_CLS} min-h-[72px] resize-y`}
                  value={form.internal_notes}
                  onChange={(e) => set('internal_notes', e.target.value)}
                  placeholder="Notes visible only to Okuji admins…"
                />
              </Field>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 border-t border-okuji-gray-2 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-panel border border-okuji-gray-2 px-4 py-2 text-sm font-medium text-okuji-gray-3 hover:border-okuji-navy hover:text-okuji-navy transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-panel bg-okuji-teal px-4 py-2 text-sm font-medium text-white hover:bg-okuji-teal-dk disabled:opacity-50 transition-colors"
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
  const [modelFilter, setModelFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [list, setList] = useState<Institution[]>(institutions)

  useEffect(() => { setList(institutions) }, [institutions])

  const filtered = list
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => !typeFilter || i.institution_type === typeFilter)
    .filter((i) => !modelFilter || i.pricing_model === modelFilter)

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
          {INSTITUTION_TYPE_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.types.map((t) => (
                <option key={t} value={t}>{INSTITUTION_TYPE_LABELS[t] ?? t}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={`${INPUT_CLS} w-44`}
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="">All pricing models</option>
          {(['free','paid_passport','community','regional','enterprise','patron'] as const).map((m) => (
            <option key={m} value={m}>{PRICING_MODEL_LABELS[m]}</option>
          ))}
        </select>
        <div className="flex-1" />
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-panel bg-okuji-teal px-4 py-2 text-sm font-medium text-white hover:bg-okuji-teal-dk transition-colors"
          >
            + Add institution
          </button>
        )}
      </div>

      {fetchError && (
        <div role="alert" className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="h-7 w-7 animate-spin text-okuji-teal" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-okuji-gray-3">
            {filtered.length} {filtered.length === 1 ? 'institution' : 'institutions'}
          </p>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-lg font-semibold text-okuji-navy">No institutions found</p>
              <p className="mt-1 text-sm text-okuji-gray-3">Try adjusting the search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-panel border border-okuji-gray-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-okuji-gray-2 bg-okuji-gray-1 text-left">
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Name</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Type</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Pricing</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">City</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b border-okuji-gray-2 last:border-0 transition-colors hover:bg-okuji-teal-lt/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/access/institutions/${inst.id}`}
                          className="font-medium text-okuji-navy hover:text-okuji-teal-dk hover:underline"
                        >
                          {inst.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-okuji-gray-3">
                        {inst.institution_type
                          ? (INSTITUTION_TYPE_LABELS[inst.institution_type] ?? inst.institution_type)
                          : <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <PricingBadge
                          model={inst.pricing_model}
                          locked={(inst as unknown as { pricing_model_locked?: boolean }).pricing_model_locked}
                        />
                      </td>
                      <td className="px-4 py-3 text-okuji-gray-3">
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
          isAdmin={isAdmin}
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
            <svg className="h-7 w-7 animate-spin text-okuji-teal" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-okuji-gray-3">
              {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            </p>
            <div className="overflow-x-auto rounded-panel border border-okuji-gray-2">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-okuji-gray-2 bg-okuji-gray-1 text-left">
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Name</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Role</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Institutions</th>
                    <th className="px-4 py-3 font-medium text-okuji-gray-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className={`cursor-pointer border-b border-okuji-gray-2 last:border-0 transition-colors hover:bg-okuji-teal-lt/30 ${
                        selected?.id === u.id ? 'bg-okuji-teal-lt/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-okuji-navy">
                        {u.display_name ?? <span className="italic text-okuji-gray-3">No name</span>}
                      </td>
                      <td className="px-4 py-3 text-okuji-gray-3 capitalize">{u.role ?? '—'}</td>
                      <td className="px-4 py-3 text-okuji-gray-3">
                        {u.institutions.length === 0
                          ? <span className="italic">—</span>
                          : u.institutions.map((i) => i.name).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-okuji-gray-3">
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

      {selected && (
        <div className="w-72 shrink-0 rounded-panel border border-okuji-gray-2 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-okuji-navy">User detail</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-okuji-gray-3 hover:text-okuji-navy text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-lg font-bold text-okuji-navy">
            {selected.display_name ?? <span className="italic text-okuji-gray-3">No name</span>}
          </p>
          <p className="mt-0.5 text-xs text-okuji-gray-3 capitalize">{selected.role ?? '—'}</p>
          <p className="mt-0.5 text-xs text-okuji-gray-3">
            Joined {new Date(selected.created_at).toLocaleDateString()}
          </p>

          <div className="mt-4 border-t border-okuji-gray-2 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-okuji-gray-3">
              Institutions
            </p>
            {selected.institutions.length === 0 ? (
              <p className="text-sm italic text-okuji-gray-3">No institution memberships</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {selected.institutions.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/access/institutions/${i.id}`}
                      className="text-sm text-okuji-teal-dk hover:underline"
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
        <svg className="h-8 w-8 animate-spin text-okuji-teal" viewBox="0 0 24 24" fill="none">
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
        <h2 className="mt-4 text-lg font-bold text-okuji-navy">Access restricted</h2>
        <p className="mt-2 text-sm text-okuji-gray-3">
          Access Management is available to institution managers and Okuji admins.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-panel bg-okuji-teal px-4 py-2 text-sm font-medium text-white hover:bg-okuji-teal-dk transition-colors"
        >
          Back to Okuji
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-okuji-navy">Access Management</h1>
        <p className="mt-1 text-sm text-okuji-gray-3">
          {isAdmin
            ? 'Manage all institutions and users on the platform.'
            : 'Manage your institution members and access.'}
        </p>
      </div>

      <div className="mb-6 flex items-center gap-0 border-b border-okuji-gray-2">
        <button
          onClick={() => setActiveTab('institutions')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'institutions'
              ? 'border-okuji-teal text-okuji-teal-dk'
              : 'border-transparent text-okuji-gray-3 hover:text-okuji-navy'
          }`}
        >
          Institutions
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'border-okuji-teal text-okuji-teal-dk'
                : 'border-transparent text-okuji-gray-3 hover:text-okuji-navy'
            }`}
          >
            Users
          </button>
        )}
      </div>

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
