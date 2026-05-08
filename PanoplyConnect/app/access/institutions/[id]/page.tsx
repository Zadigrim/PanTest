'use client'

import { useEffect, useState, useTransition, useId, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-panel border border-panoply-gray-2 px-3 py-1.5 text-sm text-panoply-navy focus:border-panoply-teal focus:outline-none focus:ring-1 focus:ring-panoply-teal disabled:bg-panoply-gray-1 disabled:text-panoply-gray-3'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-panoply-gray-3">{label}</label>
      {children}
    </div>
  )
}

function PricingBadge({ model, locked }: { model: string; locked?: boolean }) {
  const colorCls = PRICING_BADGE_COLORS[model as PricingModel] ?? 'bg-panoply-gray-2 text-panoply-gray-3'
  const label = PRICING_MODEL_LABELS[model as PricingModel] ?? model
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorCls}`}>
      {label}
      {locked && <span title="Admin override" className="opacity-70">🔒</span>}
    </span>
  )
}

const PRICING_MODELS = ['free', 'paid_passport', 'community', 'regional', 'enterprise', 'patron'] as const

// ─── Properties section ───────────────────────────────────────────────────────

interface PropertiesForm {
  name: string
  institution_type: string
  charges_admission: boolean
  municipality_population: string
  pricing_model_override: string
  pricing_model_locked: boolean
  catalog_url: string
  website: string
  contact_name: string
  contact_email: string
  address_line1: string
  address_city: string
  address_state: string
  address_zip: string
  internal_notes: string
}

function formFromInstitution(inst: Institution): PropertiesForm {
  const raw = inst as unknown as {
    municipality_population?: number | null
    pricing_model_locked?: boolean
    pricing_model_override_by?: string | null
  }
  return {
    name: inst.name,
    institution_type: inst.institution_type ?? '',
    charges_admission: inst.charges_admission,
    municipality_population: raw.municipality_population != null ? String(raw.municipality_population) : '',
    pricing_model_override: raw.pricing_model_locked ? inst.pricing_model : '',
    pricing_model_locked: raw.pricing_model_locked ?? false,
    catalog_url: inst.catalog_url ?? '',
    website: inst.website ?? '',
    contact_name: inst.contact_name ?? '',
    contact_email: inst.contact_email ?? '',
    address_line1: inst.address_line1 ?? '',
    address_city: inst.address_city ?? '',
    address_state: inst.address_state ?? '',
    address_zip: inst.address_zip ?? '',
    internal_notes: inst.internal_notes ?? '',
  }
}

function PropertiesSection({
  institution,
  isAdmin,
  onSaved,
}: {
  institution: Institution
  isAdmin: boolean
  onSaved: (updated: Institution) => void
}) {
  const formId = useId()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PropertiesForm>(() => formFromInstitution(institution))

  const pop = form.municipality_population ? parseInt(form.municipality_population, 10) : undefined
  const computedModel = computePricingModel(
    form.institution_type || '',
    form.charges_admission,
    Number.isFinite(pop) ? pop : undefined,
  )
  const effectiveModel = (form.pricing_model_locked && form.pricing_model_override)
    ? form.pricing_model_override as PricingModel
    : computedModel

  const showAdmission = isAdmissionDependent(form.institution_type)
  const showPopulation = form.institution_type === 'municipality'
  const instLocked = (institution as unknown as { pricing_model_locked?: boolean }).pricing_model_locked

  function set<K extends keyof PropertiesForm>(k: K, v: PropertiesForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/institutions/${institution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || institution.name,
          institution_type: form.institution_type || null,
          charges_admission: form.charges_admission,
          municipality_population: showPopulation && form.municipality_population
            ? parseInt(form.municipality_population, 10)
            : null,
          pricing_model_override: form.pricing_model_locked ? form.pricing_model_override || null : null,
          pricing_model_locked: form.pricing_model_locked,
          catalog_url: form.catalog_url.trim() || null,
          website: form.website.trim() || null,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          address_line1: form.address_line1.trim() || null,
          address_city: form.address_city.trim() || null,
          address_state: form.address_state.trim() || null,
          address_zip: form.address_zip.trim() || null,
          internal_notes: form.internal_notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to save.')
        return
      }

      const { institution: updated } = await res.json()
      onSaved(updated as Institution)
      setEditing(false)
    })
  }

  function handleCancel() {
    setForm(formFromInstitution(institution))
    setEditing(false)
    setError(null)
  }

  const currentModel = editing ? effectiveModel : institution.pricing_model

  return (
    <section className="rounded-panel border border-panoply-gray-2 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-panoply-navy">Properties</h2>
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-panoply-teal-dk hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={INPUT_CLS}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!editing}
          />
        </Field>

        <Field label="Type">
          {editing ? (
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
          ) : (
            <input
              className={INPUT_CLS}
              value={form.institution_type ? (INSTITUTION_TYPE_LABELS[form.institution_type] ?? form.institution_type) : '—'}
              disabled
            />
          )}
        </Field>

        {/* Admission radio (nature/science types) */}
        {(editing && showAdmission) && (
          <div className="sm:col-span-2">
            <fieldset className="rounded-panel border border-panoply-gray-2 p-3">
              <legend className="px-1 text-xs font-medium text-panoply-gray-3">Admission</legend>
              <p className="mb-2 text-xs text-panoply-gray-3">Does this institution charge admission?</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-panoply-navy">
                  <input
                    type="radio"
                    name={`${formId}-admission`}
                    checked={form.charges_admission}
                    onChange={() => set('charges_admission', true)}
                    className="accent-panoply-teal"
                  />
                  Yes — paid admission
                </label>
                <label className="flex items-center gap-2 text-sm text-panoply-navy">
                  <input
                    type="radio"
                    name={`${formId}-admission`}
                    checked={!form.charges_admission}
                    onChange={() => set('charges_admission', false)}
                    className="accent-panoply-teal"
                  />
                  No — free admission
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {/* Municipality population */}
        {showPopulation && (
          <div className="sm:col-span-2">
            <Field label="Approximate population">
              <input
                className={INPUT_CLS}
                type="number"
                min={0}
                value={form.municipality_population}
                onChange={(e) => set('municipality_population', e.target.value)}
                disabled={!editing}
                placeholder="e.g. 12000"
              />
              {editing && (
                <p className="text-xs text-panoply-gray-3">Under 25,000 → free. Over 25,000 → Community tier.</p>
              )}
            </Field>
          </div>
        )}

        {/* Pricing model */}
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-panoply-gray-3">Pricing model</p>
          <div className={`rounded-panel border px-3 py-3 ${
            instLocked ? 'border-panoply-amber bg-panoply-amber/10' : 'border-panoply-gray-2 bg-panoply-gray-1'
          }`}>
            <div className="flex items-center gap-2">
              <PricingBadge model={currentModel} locked={instLocked} />
              {editing && computedModel !== effectiveModel && (
                <span className="text-xs text-panoply-amber">
                  (auto: {PRICING_MODEL_LABELS[computedModel as PricingModel] ?? computedModel})
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-panoply-gray-3">
              {PRICING_MODEL_DESCRIPTIONS[currentModel as PricingModel] ?? ''}
            </p>
          </div>
        </div>

        {/* Admin override */}
        {isAdmin && editing && (
          <div className="sm:col-span-2">
            <div className="rounded-panel border border-panoply-gray-2 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
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
                <label className="flex items-center gap-2 text-xs text-panoply-navy pb-1.5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="accent-panoply-teal h-3.5 w-3.5"
                    checked={form.pricing_model_locked}
                    onChange={(e) => set('pricing_model_locked', e.target.checked)}
                    disabled={!form.pricing_model_override}
                  />
                  Lock override
                </label>
              </div>
            </div>
          </div>
        )}

        <Field label="Catalog URL">
          <input
            className={INPUT_CLS}
            type="url"
            value={form.catalog_url}
            onChange={(e) => set('catalog_url', e.target.value)}
            disabled={!editing}
          />
        </Field>

        <Field label="Website">
          <input
            className={INPUT_CLS}
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            disabled={!editing}
          />
        </Field>

        {/* Contact */}
        <div className="sm:col-span-2 border-t border-panoply-gray-2 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">Contact</p>
        </div>
        <Field label="Contact name">
          <input
            className={INPUT_CLS}
            value={form.contact_name}
            onChange={(e) => set('contact_name', e.target.value)}
            disabled={!editing}
          />
        </Field>
        <Field label="Contact email">
          <input
            className={INPUT_CLS}
            type="email"
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
            disabled={!editing}
          />
        </Field>

        {/* Address */}
        <div className="sm:col-span-2 border-t border-panoply-gray-2 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">Address</p>
        </div>
        <div className="sm:col-span-2">
          <Field label="Street">
            <input
              className={INPUT_CLS}
              value={form.address_line1}
              onChange={(e) => set('address_line1', e.target.value)}
              disabled={!editing}
            />
          </Field>
        </div>
        <Field label="City">
          <input
            className={INPUT_CLS}
            value={form.address_city}
            onChange={(e) => set('address_city', e.target.value)}
            disabled={!editing}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <input
              className={INPUT_CLS}
              value={form.address_state}
              onChange={(e) => set('address_state', e.target.value)}
              disabled={!editing}
              maxLength={2}
            />
          </Field>
          <Field label="ZIP">
            <input
              className={INPUT_CLS}
              value={form.address_zip}
              onChange={(e) => set('address_zip', e.target.value)}
              disabled={!editing}
            />
          </Field>
        </div>

        {/* Internal notes (admin only) */}
        {isAdmin && (
          <>
            <div className="sm:col-span-2 border-t border-panoply-gray-2 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">Internal notes</p>
            </div>
            <div className="sm:col-span-2">
              <textarea
                className={`${INPUT_CLS} min-h-[80px] resize-y`}
                value={form.internal_notes}
                onChange={(e) => set('internal_notes', e.target.value)}
                disabled={!editing}
                placeholder={editing ? 'Notes visible only to Panoply admins…' : ''}
              />
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-panoply-gray-2 pt-4">
          {error && <span role="alert" className="flex-1 text-sm text-red-600">{error}</span>}
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-panel border border-panoply-gray-2 px-4 py-2 text-sm font-medium text-panoply-gray-3 hover:border-panoply-navy hover:text-panoply-navy transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-panel bg-panoply-teal px-4 py-2 text-sm font-medium text-white hover:bg-panoply-teal-dk disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Members section ──────────────────────────────────────────────────────────

interface MemberRow {
  authzId: string
  userId: string
  displayName: string | null
  role_label: string | null
  can_verify: boolean
  can_distribute_prizes: boolean
  can_add_extras: boolean
}

function AddMemberForm({
  institutionId,
  currentUserId,
  onAdded,
}: {
  institutionId: string
  currentUserId: string
  onAdded: (m: MemberRow) => void
}) {
  const formId = useId()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [canVerify, setCanVerify] = useState(false)
  const [canPrizes, setCanPrizes] = useState(false)
  const [canExtras, setCanExtras] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) { setError('Email is required.'); return }
    setError(null)

    startTransition(async () => {
      const lookupRes = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      let targetUserId: string
      if (lookupRes.ok) {
        const json = (await lookupRes.json()) as { userId?: string; error?: string }
        if (!json.userId) { setError(json.error ?? `No account found for ${trimmed}`); return }
        targetUserId = json.userId
      } else {
        const json = (await lookupRes.json()) as { error?: string }
        setError(json.error ?? `No account found for ${trimmed}`)
        return
      }

      if (targetUserId === currentUserId) { setError('You cannot add yourself.'); return }

      const supabase = createClient()

      const { data: existing } = await supabase
        .from('employee_authorizations')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('institution_id', institutionId)
        .maybeSingle()

      if (existing) { setError('This person is already a member.'); return }

      const { data: inserted, error: insertErr } = await supabase
        .from('employee_authorizations')
        .insert({
          user_id: targetUserId,
          institution_id: institutionId,
          role_label: roleLabel.trim() || null,
          can_verify: canVerify,
          can_distribute_prizes: canPrizes,
          can_add_extras: canExtras,
          authorized_by: currentUserId,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) { setError(insertErr?.message ?? 'Failed to add member.'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', targetUserId)
        .single()

      onAdded({
        authzId: inserted.id,
        userId: targetUserId,
        displayName: (profile as { display_name: string | null } | null)?.display_name ?? null,
        role_label: roleLabel.trim() || null,
        can_verify: canVerify,
        can_distribute_prizes: canPrizes,
        can_add_extras: canExtras,
      })
      setEmail(''); setRoleLabel('')
      setCanVerify(false); setCanPrizes(false); setCanExtras(false)
    })
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 p-4">
      <p className="mb-3 text-sm font-semibold text-panoply-navy">Add member</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Email *">
          <input
            className={INPUT_CLS}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </Field>
        <Field label="Role label">
          <input
            className={INPUT_CLS}
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="Educator, Manager, Staff…"
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <PermCheck label="Can verify" checked={canVerify} onChange={setCanVerify} />
        <PermCheck label="Can distribute prizes" checked={canPrizes} onChange={setCanPrizes} />
        <PermCheck label="Can add extras" checked={canExtras} onChange={setCanExtras} />
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-panel bg-panoply-navy px-4 py-2 text-sm font-medium text-white hover:bg-panoply-teal-dk disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding…' : 'Add member'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  )
}

function PermCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-panoply-navy">
      <input
        type="checkbox"
        className="accent-panoply-teal h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

function MembersSection({
  institutionId,
  currentUserId,
  canManage,
}: {
  institutionId: string
  currentUserId: string
  canManage: boolean
}) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permErrors, setPermErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from('employee_authorizations')
        .select(`
          id, user_id, role_label, can_verify, can_distribute_prizes, can_add_extras,
          profile:profiles!user_id(display_name)
        `)
        .eq('institution_id', institutionId)
        .order('authorized_at', { ascending: true })

      if (fetchErr) {
        setError(fetchErr.message)
        setLoading(false)
        return
      }

      type RawRow = {
        id: string
        user_id: string
        role_label: string | null
        can_verify: boolean | null
        can_distribute_prizes: boolean | null
        can_add_extras: boolean | null
        profile: { display_name: string | null } | null
      }

      setMembers(((data ?? []) as unknown as RawRow[]).map((row) => ({
        authzId: row.id,
        userId: row.user_id,
        displayName: row.profile?.display_name ?? null,
        role_label: row.role_label,
        can_verify: row.can_verify ?? false,
        can_distribute_prizes: row.can_distribute_prizes ?? false,
        can_add_extras: row.can_add_extras ?? false,
      })))
      setLoading(false)
    })()
  }, [institutionId])

  async function handlePermChange(
    authzId: string,
    field: 'can_verify' | 'can_distribute_prizes' | 'can_add_extras',
    value: boolean
  ) {
    setPermErrors((e) => ({ ...e, [authzId]: '' }))
    const supabase = createClient()
    const { error: updateErr } = await supabase
      .from('employee_authorizations')
      .update({ [field]: value })
      .eq('id', authzId)

    if (updateErr) {
      setPermErrors((e) => ({ ...e, [authzId]: updateErr.message }))
      return
    }
    setMembers((prev) => prev.map((m) => m.authzId === authzId ? { ...m, [field]: value } : m))
  }

  function handleRemoveMember(authzId: string) {
    setMembers((prev) => prev.filter((m) => m.authzId !== authzId))
  }

  return (
    <section className="rounded-panel border border-panoply-gray-2 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-panoply-navy">Members</h2>

      {error && (
        <div role="alert" className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      ) : (
        <>
          {members.length === 0 ? (
            <p className="text-sm italic text-panoply-gray-3">No members yet.</p>
          ) : (
            <div className="mb-4 overflow-x-auto rounded-panel border border-panoply-gray-2">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-panoply-gray-2 bg-panoply-gray-1 text-left">
                    <th className="px-4 py-2.5 font-medium text-panoply-gray-3">Name</th>
                    <th className="px-4 py-2.5 font-medium text-panoply-gray-3">Role</th>
                    <th className="px-4 py-2.5 text-center font-medium text-panoply-gray-3">Verify</th>
                    <th className="px-4 py-2.5 text-center font-medium text-panoply-gray-3">Prizes</th>
                    <th className="px-4 py-2.5 text-center font-medium text-panoply-gray-3">Extras</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <MemberRow
                      key={m.authzId}
                      member={m}
                      canManage={canManage}
                      onPermChange={handlePermChange}
                      onRemove={handleRemoveMember}
                      permError={permErrors[m.authzId] ?? null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <AddMemberForm
              institutionId={institutionId}
              currentUserId={currentUserId}
              onAdded={(m) => setMembers((prev) => [...prev, m])}
            />
          )}
        </>
      )}
    </section>
  )
}

function MemberRow({
  member,
  canManage,
  onPermChange,
  onRemove,
  permError,
}: {
  member: MemberRow
  canManage: boolean
  onPermChange: (id: string, field: 'can_verify' | 'can_distribute_prizes' | 'can_add_extras', value: boolean) => void
  onRemove: (id: string) => void
  permError: string | null
}) {
  const [removing, startRemove] = useTransition()

  function handleRemove() {
    startRemove(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('employee_authorizations')
        .delete()
        .eq('id', member.authzId)
      if (!error) onRemove(member.authzId)
    })
  }

  return (
    <>
      <tr className="border-b border-panoply-gray-2 last:border-0 hover:bg-panoply-gray-1/40">
        <td className="px-4 py-3 font-medium text-panoply-navy">
          {member.displayName ?? <span className="italic text-panoply-gray-3">Unknown</span>}
        </td>
        <td className="px-4 py-3 text-panoply-gray-3">{member.role_label ?? '—'}</td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-panoply-teal h-4 w-4"
            checked={member.can_verify}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_verify', e.target.checked)}
            aria-label={`Can verify: ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-panoply-teal h-4 w-4"
            checked={member.can_distribute_prizes}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_distribute_prizes', e.target.checked)}
            aria-label={`Can distribute prizes: ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-panoply-teal h-4 w-4"
            checked={member.can_add_extras}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_add_extras', e.target.checked)}
            aria-label={`Can add extras: ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-right">
          {canManage && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-panoply-coral hover:underline disabled:opacity-50"
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </td>
      </tr>
      {permError && (
        <tr className="border-b border-panoply-gray-2">
          <td colSpan={6} className="px-4 pb-2">
            <span role="alert" className="text-xs text-red-600">{permError}</span>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Passports section ────────────────────────────────────────────────────────

interface PassportRow {
  id: string
  title: string
  status: string | null
  updated_at: string
}

function PassportsSection({ institutionId }: { institutionId: string }) {
  const [passports, setPassports] = useState<PassportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('passports')
        .select('id, title, status, updated_at')
        .eq('proprietor_id', institutionId)
        .order('updated_at', { ascending: false })
      setPassports(
        ((data ?? []) as unknown as PassportRow[])
      )
      setLoading(false)
    })()
  }, [institutionId])

  return (
    <section className="rounded-panel border border-panoply-gray-2 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-panoply-navy">Passports</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      ) : passports.length === 0 ? (
        <p className="text-sm italic text-panoply-gray-3">No passports linked to this institution yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {passports.map((p) => (
            <div
              key={p.id}
              className="rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 py-2.5"
            >
              <p className="text-sm font-medium text-panoply-navy">{p.title}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-panoply-gray-3">
                <span className={`rounded-full px-1.5 py-0.5 ${
                  p.status === 'published' ? 'bg-panoply-teal-lt text-panoply-teal-dk'
                  : p.status === 'archived' ? 'bg-panoply-amber/15 text-panoply-amber'
                  : 'bg-panoply-gray-2 text-panoply-gray-3'
                }`}>
                  {p.status ?? 'draft'}
                </span>
                <span>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstitutionDetailPage() {
  const params = useParams()
  const institutionId = params.id as string

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setNotFound(true); setLoading(false); return }
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin, connect_roles')
        .eq('id', user.id)
        .single()

      const admin =
        (profile as unknown as { is_platform_admin?: boolean } | null)?.is_platform_admin === true ||
        ((profile as unknown as { connect_roles?: string[] } | null)?.connect_roles ?? []).includes('platform_admin')
      setIsAdmin(admin)

      const { data: inst, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single()

      if (error || !inst) { setNotFound(true); setLoading(false); return }
      setInstitution(inst as unknown as Institution)
      setLoading(false)
    })()
  }, [institutionId])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-panoply-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      </div>
    )
  }

  if (notFound || !institution) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <span className="text-5xl">🏛</span>
        <h2 className="mt-4 text-lg font-bold text-panoply-navy">Institution not found</h2>
        <Link
          href="/access"
          className="mt-4 text-sm text-panoply-teal-dk hover:underline"
        >
          ← Back to Access Management
        </Link>
      </div>
    )
  }

  const canManage = isAdmin || institution.id === currentUserId

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-panoply-gray-3">
        <Link href="/access" className="hover:text-panoply-navy transition-colors">
          Access Management
        </Link>
        <span>›</span>
        <span className="font-medium text-panoply-navy">{institution.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-panoply-navy">{institution.name}</h1>
        {institution.institution_type && (
          <p className="mt-1 text-sm text-panoply-gray-3">
            {INSTITUTION_TYPE_LABELS[institution.institution_type] ?? institution.institution_type}
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-6">
        <PropertiesSection
          institution={institution}
          isAdmin={isAdmin}
          onSaved={setInstitution}
        />
        <MembersSection
          institutionId={institutionId}
          currentUserId={currentUserId ?? ''}
          canManage={canManage}
        />
        <PassportsSection institutionId={institutionId} />
      </div>
    </div>
  )
}
