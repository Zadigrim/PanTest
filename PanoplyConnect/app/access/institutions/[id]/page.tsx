'use client'

import { useEffect, useState, useTransition, useId, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  INSTITUTION_TYPE_LABELS,
  FREE_INSTITUTION_TYPES,
  ADMISSION_CHARGING_TYPES,
  ADMISSION_QUESTION_TYPES,
} from '@/lib/supabase/types'
import type { Institution } from '@/lib/supabase/types'

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

function computePricingModel(type: string | null, chargesAdmission: boolean): string {
  if (!type) return 'community'
  if (FREE_INSTITUTION_TYPES.has(type)) return 'free'
  if (ADMISSION_CHARGING_TYPES.has(type) || chargesAdmission) return 'paid_passport'
  return 'community'
}

// ─── Properties section ───────────────────────────────────────────────────────

function PropertiesSection({
  institution,
  isAdmin,
  onSaved,
}: {
  institution: Institution
  isAdmin: boolean
  onSaved: (updated: Institution) => void
}) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ ...institution })

  const showAdmissionQuestion = form.institution_type
    ? ADMISSION_QUESTION_TYPES.has(form.institution_type)
    : false
  const pricingModel = computePricingModel(form.institution_type, form.charges_admission)

  function set<K extends keyof Institution>(k: K, v: Institution[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { data, error: updateErr } = await supabase
        .from('institutions')
        .update({
          name: form.name,
          institution_type: form.institution_type,
          charges_admission: form.charges_admission,
          pricing_model: pricingModel,
          tier: form.tier,
          catalog_url: form.catalog_url,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          address_line1: form.address_line1,
          address_city: form.address_city,
          address_state: form.address_state,
          address_zip: form.address_zip,
          website: form.website,
          internal_notes: form.internal_notes,
        })
        .eq('id', institution.id)
        .select('*')
        .single()

      if (updateErr || !data) {
        setError(updateErr?.message ?? 'Failed to save.')
        return
      }
      onSaved(data as unknown as Institution)
      setEditing(false)
    })
  }

  function handleCancel() {
    setForm({ ...institution })
    setEditing(false)
    setError(null)
  }

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
              value={form.institution_type ?? ''}
              onChange={(e) => set('institution_type', e.target.value as Institution['institution_type'])}
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
          ) : (
            <input
              className={INPUT_CLS}
              value={form.institution_type ? (INSTITUTION_TYPE_LABELS[form.institution_type] ?? form.institution_type) : '—'}
              disabled
            />
          )}
        </Field>

        {(editing && showAdmissionQuestion) && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-panoply-navy">
              <input
                type="checkbox"
                className="accent-panoply-teal h-4 w-4"
                checked={form.charges_admission}
                onChange={(e) => set('charges_admission', e.target.checked)}
              />
              Charges admission
            </label>
          </div>
        )}

        <Field label="Pricing model">
          <input className={INPUT_CLS} value={PRICING_MODEL_LABELS[editing ? pricingModel : (institution.pricing_model ?? '')] ?? institution.pricing_model ?? '—'} disabled />
        </Field>

        <Field label="Tier">
          {editing && isAdmin ? (
            <select
              className={INPUT_CLS}
              value={form.tier}
              onChange={(e) => set('tier', e.target.value as Institution['tier'])}
            >
              {Object.entries(TIER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          ) : (
            <input className={INPUT_CLS} value={TIER_LABELS[form.tier] ?? form.tier} disabled />
          )}
        </Field>

        <Field label="Catalog URL">
          <input
            className={INPUT_CLS}
            type="url"
            value={form.catalog_url ?? ''}
            onChange={(e) => set('catalog_url', e.target.value || null)}
            disabled={!editing}
          />
        </Field>

        <Field label="Website">
          <input
            className={INPUT_CLS}
            type="url"
            value={form.website ?? ''}
            onChange={(e) => set('website', e.target.value || null)}
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
            value={form.contact_name ?? ''}
            onChange={(e) => set('contact_name', e.target.value || null)}
            disabled={!editing}
          />
        </Field>
        <Field label="Contact email">
          <input
            className={INPUT_CLS}
            type="email"
            value={form.contact_email ?? ''}
            onChange={(e) => set('contact_email', e.target.value || null)}
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
              value={form.address_line1 ?? ''}
              onChange={(e) => set('address_line1', e.target.value || null)}
              disabled={!editing}
            />
          </Field>
        </div>
        <Field label="City">
          <input
            className={INPUT_CLS}
            value={form.address_city ?? ''}
            onChange={(e) => set('address_city', e.target.value || null)}
            disabled={!editing}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <input
              className={INPUT_CLS}
              value={form.address_state ?? ''}
              onChange={(e) => set('address_state', e.target.value || null)}
              disabled={!editing}
              maxLength={2}
            />
          </Field>
          <Field label="ZIP">
            <input
              className={INPUT_CLS}
              value={form.address_zip ?? ''}
              onChange={(e) => set('address_zip', e.target.value || null)}
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
                value={form.internal_notes ?? ''}
                onChange={(e) => set('internal_notes', e.target.value || null)}
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
