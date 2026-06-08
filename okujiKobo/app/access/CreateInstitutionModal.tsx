'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Canonical institution_type values — matches the
 * institutions_institution_type_check CHECK constraint (migration
 * 015_pricing_model, the most-recently-replaced version). If you
 * add a new value to the constraint, add it here too — free text
 * is rejected by the DB.
 */
const INSTITUTION_TYPE_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  { label: 'Educational', options: [
    { value: 'k12_school',              label: 'K-12 school' },
    { value: 'public_library',          label: 'Public library' },
    { value: 'museum',                  label: 'Museum' },
    { value: 'educational_nonprofit',   label: 'Educational nonprofit' },
    { value: 'after_school_program',    label: 'After-school program' },
    { value: 'literacy_organization',   label: 'Literacy organization' },
    { value: 'youth_development',       label: 'Youth development' },
    { value: 'homeschool_cooperative',  label: 'Homeschool cooperative' },
  ] },
  { label: 'Cultural preservation', options: [
    { value: 'historical_society',      label: 'Historical society' },
    { value: 'heritage_organization',   label: 'Heritage organization' },
    { value: 'cultural_center',         label: 'Cultural center' },
    { value: 'oral_history_project',    label: 'Oral history project' },
  ] },
  { label: 'Community arts', options: [
    { value: 'community_theater',         label: 'Community theater' },
    { value: 'public_art_organization',   label: 'Public art organization' },
    { value: 'community_arts_center',     label: 'Community arts center' },
    { value: 'community_music_program',   label: 'Community music program' },
    { value: 'writing_center',            label: 'Writing center' },
  ] },
  { label: 'Social services', options: [
    { value: 'food_bank',                  label: 'Food bank' },
    { value: 'homeless_shelter',           label: 'Homeless shelter' },
    { value: 'refugee_immigrant_services', label: 'Refugee / immigrant services' },
    { value: 'free_health_clinic',         label: 'Free health clinic' },
    { value: 'adult_literacy',             label: 'Adult literacy' },
  ] },
  { label: 'Environmental / conservation', options: [
    { value: 'parks_department',         label: 'Parks department' },
    { value: 'nature_conservatory',      label: 'Nature conservatory' },
    { value: 'land_trust',               label: 'Land trust' },
    { value: 'watershed_council',        label: 'Watershed council' },
    { value: 'native_plant_society',     label: 'Native plant society' },
    { value: 'wildlife_rehabilitation',  label: 'Wildlife rehabilitation' },
    { value: 'environmental_education',  label: 'Environmental education' },
  ] },
  { label: 'Nature & science (admission determines pricing)', options: [
    { value: 'zoo',                label: 'Zoo' },
    { value: 'aquarium',           label: 'Aquarium' },
    { value: 'botanical_garden',   label: 'Botanical garden' },
    { value: 'science_museum',     label: 'Science museum' },
    { value: 'childrens_museum',   label: "Children's museum" },
    { value: 'nature_center',      label: 'Nature center' },
  ] },
  { label: 'Community access', options: [
    { value: 'community_garden',       label: 'Community garden' },
    { value: 'maker_space',            label: 'Maker space' },
    { value: 'tool_lending_library',   label: 'Tool lending library' },
    { value: 'seed_library',           label: 'Seed library' },
  ] },
  { label: 'Municipal', options: [
    { value: 'municipality',           label: 'Municipality' },
  ] },
  { label: 'Commercial', options: [
    { value: 'chamber_of_commerce',    label: 'Chamber of commerce' },
    { value: 'local_tourism_board',    label: 'Local tourism board' },
    { value: 'state_tourism_board',    label: 'State tourism board' },
    { value: 'convention_bureau',      label: 'Convention bureau' },
    { value: 'proprietor',             label: 'Proprietor (single-operator business)' },
    { value: 'hotel_group_small',      label: 'Hotel group — small' },
    { value: 'hotel_chain',            label: 'Hotel chain' },
    { value: 'airline',                label: 'Airline' },
    { value: 'expo_organizer',         label: 'Expo organizer' },
    { value: 'national_tourism_org',   label: 'National tourism organization' },
    { value: 'theme_park',             label: 'Theme park' },
    { value: 'cruise_line',            label: 'Cruise line' },
  ] },
  { label: 'Patron', options: [
    { value: 'corporate_sponsor',      label: 'Corporate sponsor' },
    { value: 'foundation',             label: 'Foundation' },
  ] },
  { label: 'Other', options: [
    { value: 'general',                label: 'General (catch-all)' },
    { value: 'nonprofit',              label: 'Nonprofit (legacy)' },
    { value: 'other',                  label: 'Other' },
  ] },
]

/**
 * Minimal admin-only "create institution" modal. The toolbar button
 * opens this when isAdmin; the form POSTs to /api/institutions
 * (which already enforces is_platform_admin server-side) and
 * refreshes the route so the new row appears.
 *
 * Required field: name. Everything else is optional — pricing-model
 * override, contact details, address, employee roster all live in
 * the institution detail editor at /access/institutions/[id] and
 * can be filled in after create. This form is the smallest thing
 * that produces a valid row.
 */
export function CreateInstitutionModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [institutionType, setInstitutionType] = useState('general')
  const [tier, setTier] = useState('pending')
  const [chargesAdmission, setChargesAdmission] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          institution_type: institutionType,
          charges_admission: chargesAdmission,
          contact_email: contactEmail.trim() || undefined,
          tier,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-[480px] max-w-[92vw] rounded-[12px] border border-hairline bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="create-inst-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="create-inst-title" className="text-base font-semibold text-ink">
              Add institution
            </h2>
            <p className="mt-1 text-xs text-muted">
              Fill in the contact + pricing details later from the institution editor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-ink">
              Name <span className="text-accent">*</span>
            </span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bainbridge Island Museum of Art"
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-ink">Institution type</span>
            <select
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value)}
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
            >
              {INSTITUTION_TYPE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">
              Pairs with the admission flag to compute pricing model. Pick &quot;General&quot; if unsure.
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chargesAdmission}
              onChange={(e) => setChargesAdmission(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-xs text-ink">Charges admission</span>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-ink">Contact email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.org"
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-ink">Tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
            >
              <option value="pending">pending</option>
              <option value="free">free</option>
              <option value="paid">paid</option>
              <option value="strategic">strategic</option>
            </select>
          </label>

          {error && (
            <p role="alert" className="rounded-[8px] border border-accent bg-accent/5 px-3 py-2 text-xs text-accent">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-[8px] bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {submitting ? 'Creating…' : 'Create institution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
