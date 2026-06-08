'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const [institutionType, setInstitutionType] = useState('')
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
          institution_type: institutionType.trim() || undefined,
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
            <input
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value)}
              placeholder="museum, library, brewery, …"
              className="mt-1 w-full rounded-[8px] border-[1.5px] border-hairline bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Free text — drives pricing-model computation when paired with the admission flag.
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
