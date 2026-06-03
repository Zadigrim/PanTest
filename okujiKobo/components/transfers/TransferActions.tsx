'use client'

// Accept / Decline (recipient) and Cancel (admin/initiator) buttons
// for a single transfer row. Server enforces the appropriate
// authority — these buttons are UX, not gates.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/design/ui/Button'

interface Props {
  transferId: string
  mode:       'recipient' | 'admin-cancel'
}

export function TransferActions({ transferId, mode }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(action: 'accept' | 'decline' | 'cancel') {
    setBusy(action)
    setError(null)
    const res = await fetch(`/api/transfers/${transferId}/${action}`, { method: 'POST' })
    const json = (await res.json()) as { ok?: boolean; error?: string }
    setBusy(null)
    if (!res.ok || !json.ok) {
      setError(json.error ?? `${action} failed`)
      return
    }
    router.refresh()
  }

  if (mode === 'recipient') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => void call('accept')}
        >
          {busy === 'accept' ? 'Accepting…' : 'Accept transfer'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => void call('decline')}
        >
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </Button>
        {error && <span role="alert" className="text-xs text-accent">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() => {
          if (!confirm('Cancel this pending transfer?')) return
          void call('cancel')
        }}
      >
        {busy === 'cancel' ? 'Canceling…' : 'Cancel'}
      </Button>
      {error && <span role="alert" className="text-xs text-accent">{error}</span>}
    </div>
  )
}
