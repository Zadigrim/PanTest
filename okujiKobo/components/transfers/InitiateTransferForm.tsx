'use client'

// Admin-only initiate form. Lives on /transfers; the server page
// already verified is_platform_admin before rendering. The SECURITY
// DEFINER function on the server side enforces the same gate, so this
// form is UX, not auth.
//
// v1 inputs are intentionally raw UUIDs — admin tooling, paste from
// Studio / from a passport URL. Future polish: combobox / search by
// title or display_name. Out of scope for now.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/design/ui/Button'
import { Input } from '@/components/design/ui/Input'
import { Label } from '@/components/design/ui/Label'

export function InitiateTransferForm() {
  const router = useRouter()
  const [passportId, setPassportId] = useState('')
  const [recipientType, setRecipientType] = useState<'user' | 'institution'>('institution')
  const [recipientId, setRecipientId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const body = {
      passport_id: passportId.trim(),
      to_user_id: recipientType === 'user' ? recipientId.trim() : null,
      to_institution_id: recipientType === 'institution' ? recipientId.trim() : null,
      note: note.trim() || undefined,
    }
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok?: boolean; transfer_id?: string; error?: string }
    setBusy(false)
    if (!res.ok || !json.ok) {
      setError(json.error ?? 'Initiation failed')
      return
    }
    // Refresh server data so the new row shows up.
    router.refresh()
    setPassportId('')
    setRecipientId('')
    setNote('')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted">Passport ID</Label>
        <Input
          required
          value={passportId}
          onChange={(e) => setPassportId(e.target.value)}
          className="h-8 font-mono text-xs"
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted">Recipient type</Label>
        <div className="flex gap-2">
          {(['institution', 'user'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRecipientType(t)}
              className={`flex-1 rounded-card border py-1.5 text-xs capitalize transition-colors ${
                recipientType === t
                  ? 'border-green bg-cream font-medium text-green'
                  : 'border-hairline text-muted hover:border-green/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted">
          Recipient {recipientType === 'institution' ? 'institution ID' : 'user ID'}
        </Label>
        <Input
          required
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="h-8 font-mono text-xs"
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted">Note (optional)</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-none rounded-panel border border-hairline px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-2 focus:ring-green"
          rows={2}
          placeholder="Context for the recipient — what this is, why you're offering it."
        />
      </div>

      {error && <p role="alert" className="text-xs text-accent">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Initiating…' : 'Initiate transfer'}
        </Button>
      </div>
    </form>
  )
}
