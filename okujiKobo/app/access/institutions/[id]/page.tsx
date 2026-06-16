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

const INPUT_CLS = 'w-full rounded-panel border border-hairline px-3 py-1.5 text-sm text-navy focus:border-green focus:outline-none focus:ring-1 focus:ring-green disabled:bg-paper disabled:text-muted'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  )
}

function PricingBadge({ model, locked }: { model: string; locked?: boolean }) {
  const colorCls = PRICING_BADGE_COLORS[model as PricingModel] ?? 'bg-hairline text-muted'
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
  // tier is the org-category axis (Appendix L). A future pricing model
  // will consume tier as ONE input — tier AFFECTS pricing but does NOT
  // determine it. Civic ≈ free; Municipal pricing is a function of
  // municipality_population; Business pricing is a function of
  // annual_revenue and marketing_spend. The pricing model is
  // deliberately deferred until real deal data exists. tier is recorded
  // manually for now.
  tier: 'civic' | 'municipal' | 'business' | 'pending'
  // 1-6 chars, [A-Z0-9]. DB enforces via CHECK. UI normalizes input.
  token_prefix: string
  // Captured-only Business inputs (migration 041). Surfaced only when
  // tier === 'business' in the UI.
  annual_revenue: string
  marketing_spend: string
}

const TOKEN_PREFIX_RE = /^[A-Z0-9]{1,6}$/
const TIER_OPTIONS: { value: PropertiesForm['tier']; label: string }[] = [
  { value: 'pending', label: 'Pending (unclassified)' },
  { value: 'civic', label: 'Civic' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'business', label: 'Business' },
]

function formFromInstitution(inst: Institution): PropertiesForm {
  const raw = inst as unknown as {
    municipality_population?: number | null
    pricing_model_locked?: boolean
    pricing_model_override_by?: string | null
    tier?: PropertiesForm['tier']
    token_prefix?: string
    annual_revenue?: number | null
    marketing_spend?: number | null
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
    tier: raw.tier ?? 'pending',
    token_prefix: raw.token_prefix ?? 'OKJ',
    annual_revenue: raw.annual_revenue != null ? String(raw.annual_revenue) : '',
    marketing_spend: raw.marketing_spend != null ? String(raw.marketing_spend) : '',
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
    // token_prefix: client-side guard mirroring the DB CHECK
    // (1-6 chars, [A-Z0-9]). The CHECK is still the final guard.
    const trimmedPrefix = form.token_prefix.trim().toUpperCase()
    if (trimmedPrefix && !TOKEN_PREFIX_RE.test(trimmedPrefix)) {
      setError('Token prefix must be 1-6 uppercase letters or digits.')
      return
    }
    const annualRevParsed = form.annual_revenue.trim() === ''
      ? null
      : parseInt(form.annual_revenue, 10)
    const marketingParsed = form.marketing_spend.trim() === ''
      ? null
      : parseInt(form.marketing_spend, 10)
    if (annualRevParsed !== null && (!Number.isFinite(annualRevParsed) || annualRevParsed < 0)) {
      setError('Annual revenue must be a non-negative whole number.')
      return
    }
    if (marketingParsed !== null && (!Number.isFinite(marketingParsed) || marketingParsed < 0)) {
      setError('Marketing spend must be a non-negative whole number.')
      return
    }

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
          // tier, token_prefix, and the business inputs are independent
          // of pricing_model. See API route comments for the future-
          // pricing relationship.
          tier: form.tier,
          token_prefix: trimmedPrefix || null,
          // annual_revenue + marketing_spend are only meaningful for
          // Business; on other tiers we explicitly null them out so
          // stale data doesn't outlive a tier change.
          annual_revenue: form.tier === 'business' ? annualRevParsed : null,
          marketing_spend: form.tier === 'business' ? marketingParsed : null,
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
    <section className="rounded-panel border border-hairline bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-navy">Properties</h2>
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-green hover:underline"
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

        {/* Tier — Appendix L org-category axis. Set manually by an
            admin; not computed. See PropertiesForm comment for the
            future tier-affects-pricing relationship. */}
        <Field label="Tier (Appendix L)">
          {editing ? (
            <select
              className={INPUT_CLS}
              value={form.tier}
              onChange={(e) => set('tier', e.target.value as PropertiesForm['tier'])}
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          ) : (
            <input
              className={INPUT_CLS}
              value={TIER_OPTIONS.find((t) => t.value === form.tier)?.label ?? form.tier}
              disabled
            />
          )}
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
            <fieldset className="rounded-panel border border-hairline p-3">
              <legend className="px-1 text-xs font-medium text-muted">Admission</legend>
              <p className="mb-2 text-xs text-muted">Does this institution charge admission?</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="radio"
                    name={`${formId}-admission`}
                    checked={form.charges_admission}
                    onChange={() => set('charges_admission', true)}
                    className="accent-green"
                  />
                  Yes — paid admission
                </label>
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="radio"
                    name={`${formId}-admission`}
                    checked={!form.charges_admission}
                    onChange={() => set('charges_admission', false)}
                    className="accent-green"
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
                <p className="text-xs text-muted">Under 25,000 → free. Over 25,000 → Community tier.</p>
              )}
            </Field>
          </div>
        )}

        {/* Pricing model */}
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted">Pricing model</p>
          <div className={`rounded-panel border px-3 py-3 ${
            instLocked ? 'border-accent bg-accent/10' : 'border-hairline bg-paper'
          }`}>
            <div className="flex items-center gap-2">
              <PricingBadge model={currentModel} locked={instLocked} />
              {editing && computedModel !== effectiveModel && (
                <span className="text-xs text-accent">
                  (auto: {PRICING_MODEL_LABELS[computedModel as PricingModel] ?? computedModel})
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {PRICING_MODEL_DESCRIPTIONS[currentModel as PricingModel] ?? ''}
            </p>
          </div>
        </div>

        {/* Admin override */}
        {isAdmin && editing && (
          <div className="sm:col-span-2">
            <div className="rounded-panel border border-hairline p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
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
                <label className="flex items-center gap-2 text-xs text-navy pb-1.5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="accent-green h-3.5 w-3.5"
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

        {/* Token prefix — per-institution prefix on generated redemption
            codes (migration 032). 1-6 chars, uppercase letters / digits.
            DB CHECK enforces; UI normalizes to uppercase. */}
        <Field label="Token prefix">
          <input
            className={`${INPUT_CLS} font-mono tracking-wider uppercase`}
            value={form.token_prefix}
            onChange={(e) => set('token_prefix', e.target.value.toUpperCase().slice(0, 6))}
            disabled={!editing}
            placeholder="OKJ"
            maxLength={6}
          />
        </Field>

        {/* Business-tier inputs (migration 041). Captured-only — no
            computation. Surfaced only when tier === 'business' so they
            don't clutter Civic/Municipal forms. handleSave nulls these
            out on save for non-Business tiers to avoid stale data
            outliving a tier change. */}
        {form.tier === 'business' && (
          <>
            <Field label="Annual revenue (USD)">
              <input
                className={INPUT_CLS}
                type="number"
                min={0}
                step={1000}
                value={form.annual_revenue}
                onChange={(e) => set('annual_revenue', e.target.value)}
                disabled={!editing}
                placeholder="0"
              />
            </Field>
            <Field label="Marketing spend (USD/year)">
              <input
                className={INPUT_CLS}
                type="number"
                min={0}
                step={1000}
                value={form.marketing_spend}
                onChange={(e) => set('marketing_spend', e.target.value)}
                disabled={!editing}
                placeholder="0"
              />
            </Field>
          </>
        )}

        {/* Contact */}
        <div className="sm:col-span-2 border-t border-hairline pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Contact</p>
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
        <div className="sm:col-span-2 border-t border-hairline pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Address</p>
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
            <div className="sm:col-span-2 border-t border-hairline pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Internal notes</p>
            </div>
            <div className="sm:col-span-2">
              <textarea
                className={`${INPUT_CLS} min-h-[80px] resize-y`}
                value={form.internal_notes}
                onChange={(e) => set('internal_notes', e.target.value)}
                disabled={!editing}
                placeholder={editing ? 'Notes visible only to Okuji admins…' : ''}
              />
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-hairline pt-4">
          {error && <span role="alert" className="flex-1 text-sm text-red-600">{error}</span>}
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-panel border border-hairline px-4 py-2 text-sm font-medium text-muted hover:border-navy hover:text-navy transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-panel bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green disabled:opacity-50 transition-colors"
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
  // Provisioning-convenience flags (migration 033, Phase 1). These
  // exist as columns and are settable here, but are NOT yet enforced
  // anywhere in routes or RLS. SEC-02 / Phase 2 wires the gates.
  // Setting a flag records intent; it does not yet grant capability.
  can_design: boolean
  can_manage_employees: boolean
  can_view_analytics: boolean
  can_manage_billing: boolean
}

// The complete set of flag fields exposed by the row editor. Used as
// the union type for the onPermChange callback so both sites (this
// page's MembersSection and /manage/employees) can share the shape.
type MemberFlagField =
  | 'can_verify'
  | 'can_distribute_prizes'
  | 'can_design'
  | 'can_manage_employees'
  | 'can_view_analytics'
  | 'can_manage_billing'

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
  // Provisioning-convenience flags. See MemberRow type comment.
  const [canDesign, setCanDesign] = useState(false)
  const [canManageEmployees, setCanManageEmployees] = useState(false)
  const [canViewAnalytics, setCanViewAnalytics] = useState(false)
  const [canManageBilling, setCanManageBilling] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) { setError('Email is required.'); return }
    setError(null)

    startTransition(async () => {
      const lookupRes = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, institutionId }),
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
          can_design: canDesign,
          can_manage_employees: canManageEmployees,
          can_view_analytics: canViewAnalytics,
          can_manage_billing: canManageBilling,
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
        can_design: canDesign,
        can_manage_employees: canManageEmployees,
        can_view_analytics: canViewAnalytics,
        can_manage_billing: canManageBilling,
      })
      setEmail(''); setRoleLabel('')
      setCanVerify(false); setCanPrizes(false)
      setCanDesign(false); setCanManageEmployees(false)
      setCanViewAnalytics(false); setCanManageBilling(false)
    })
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="rounded-panel border border-hairline bg-paper p-4">
      <p className="mb-3 text-sm font-semibold text-navy">Add member</p>
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
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <PermCheck label="Can verify" checked={canVerify} onChange={setCanVerify} />
        <PermCheck label="Can distribute prizes" checked={canPrizes} onChange={setCanPrizes} />
        <PermCheck label="Can design" checked={canDesign} onChange={setCanDesign} />
        <PermCheck label="Can manage employees" checked={canManageEmployees} onChange={setCanManageEmployees} />
        <PermCheck label="Can view analytics" checked={canViewAnalytics} onChange={setCanViewAnalytics} />
        <PermCheck label="Can manage billing" checked={canManageBilling} onChange={setCanManageBilling} />
      </div>
      <p className="mt-2 text-xs italic text-muted">
        Provisioning-convenience flags. Recording intent only — Phase 2 will wire enforcement.
      </p>
      <div className="mt-3 flex">
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-panel bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-green disabled:opacity-50 transition-colors"
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
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-navy">
      <input
        type="checkbox"
        className="accent-green h-4 w-4"
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
          id, user_id, role_label,
          can_verify, can_distribute_prizes,
          can_design, can_manage_employees, can_view_analytics, can_manage_billing,
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
        can_design: boolean | null
        can_manage_employees: boolean | null
        can_view_analytics: boolean | null
        can_manage_billing: boolean | null
        profile: { display_name: string | null } | null
      }

      setMembers(((data ?? []) as unknown as RawRow[]).map((row) => ({
        authzId: row.id,
        userId: row.user_id,
        displayName: row.profile?.display_name ?? null,
        role_label: row.role_label,
        can_verify: row.can_verify ?? false,
        can_distribute_prizes: row.can_distribute_prizes ?? false,
        can_design: row.can_design ?? false,
        can_manage_employees: row.can_manage_employees ?? false,
        can_view_analytics: row.can_view_analytics ?? false,
        can_manage_billing: row.can_manage_billing ?? false,
      })))
      setLoading(false)
    })()
  }, [institutionId])

  async function handlePermChange(
    authzId: string,
    field: MemberFlagField,
    value: boolean
  ) {
    setPermErrors((e) => ({ ...e, [authzId]: '' }))
    // Dynamic { [field]: value } can't be statically typed against the
    // Update shape; cast the client (the field is a known flag column).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
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
    <section className="rounded-panel border border-hairline bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-navy">Members</h2>

      {error && (
        <div role="alert" className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-green" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      ) : (
        <>
          {members.length === 0 ? (
            <p className="text-sm italic text-muted">No members yet.</p>
          ) : (
            <div className="mb-4 overflow-x-auto rounded-panel border border-hairline">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-paper text-left">
                    <th className="px-4 py-2.5 font-medium text-muted">Name</th>
                    <th className="px-4 py-2.5 font-medium text-muted">Role</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can verify stamps">Verify</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can distribute prizes">Prizes</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can design (provisioning only)">Design</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can manage employees (provisioning only)">Manage</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can view analytics (provisioning only)">Analytics</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted" title="Can manage billing (provisioning only)">Billing</th>
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
  onPermChange: (id: string, field: MemberFlagField, value: boolean) => void
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
      <tr className="border-b border-hairline last:border-0 hover:bg-paper/40">
        <td className="px-4 py-3 font-medium text-navy">
          {member.displayName ?? <span className="italic text-muted">Unknown</span>}
        </td>
        <td className="px-4 py-3 text-muted">{member.role_label ?? '—'}</td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_verify}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_verify', e.target.checked)}
            aria-label={`Can verify: ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_distribute_prizes}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_distribute_prizes', e.target.checked)}
            aria-label={`Can distribute prizes: ${member.displayName}`}
          />
        </td>
        {/* Provisioning-convenience flag cells (migration 033). These
            checkboxes record intent for SEC-02 / Phase 2 enforcement;
            they do NOT yet grant capability in any route or RLS. */}
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_design}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_design', e.target.checked)}
            aria-label={`Can design (provisioning): ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_manage_employees}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_manage_employees', e.target.checked)}
            aria-label={`Can manage employees (provisioning): ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_view_analytics}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_view_analytics', e.target.checked)}
            aria-label={`Can view analytics (provisioning): ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <input
            type="checkbox"
            className="accent-green h-4 w-4"
            checked={member.can_manage_billing}
            disabled={!canManage}
            onChange={(e) => onPermChange(member.authzId, 'can_manage_billing', e.target.checked)}
            aria-label={`Can manage billing (provisioning): ${member.displayName}`}
          />
        </td>
        <td className="px-4 py-3 text-right">
          {canManage && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </td>
      </tr>
      {permError && (
        <tr className="border-b border-hairline">
          <td colSpan={9} className="px-4 pb-2">
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
    <section className="rounded-panel border border-hairline bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-navy">Passports</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-green" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        </div>
      ) : passports.length === 0 ? (
        <p className="text-sm italic text-muted">No passports linked to this institution yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {passports.map((p) => (
            <div
              key={p.id}
              className="rounded-panel border border-hairline bg-paper px-3 py-2.5"
            >
              <p className="text-sm font-medium text-navy">{p.title}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <span className={`rounded-full px-1.5 py-0.5 ${
                  p.status === 'published' ? 'bg-cream text-green'
                  : p.status === 'archived' ? 'bg-accent/15 text-accent'
                  : 'bg-hairline text-muted'
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
        <svg className="h-8 w-8 animate-spin text-green" viewBox="0 0 24 24" fill="none">
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
        <h2 className="mt-4 text-lg font-bold text-navy">Institution not found</h2>
        <Link
          href="/access"
          className="mt-4 text-sm text-green hover:underline"
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
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/access" className="hover:text-navy transition-colors">
          Access Management
        </Link>
        <span>›</span>
        <span className="font-medium text-navy">{institution.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">{institution.name}</h1>
        {institution.institution_type && (
          <p className="mt-1 text-sm text-muted">
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
