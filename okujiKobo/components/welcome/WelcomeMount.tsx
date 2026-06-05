'use client'

import { useCallback, useEffect, useState } from 'react'
import { WelcomeModal } from './WelcomeModal'
import type { AudienceKey } from '@/lib/welcome/copy'

/**
 * Mount/controller for the welcome modal.
 *
 * Responsibilities:
 *   - On mount, opens the modal iff `initiallyOpen` is true (server
 *     decided this from profiles.welcome_seen_at).
 *   - Persists dismissal server-side via POST /api/welcome/dismiss
 *     ONCE — re-opens via the footer link do NOT re-persist (the
 *     server-side state has already been written).
 *   - Listens for a synthetic `okuji:welcome:open` window event so
 *     the footer "About okujiKōbō" link in the dashboard can re-open
 *     it without prop-drilling.
 *
 * The dismiss request is fire-and-forget. The modal closes
 * optimistically on click; a failed write means the modal will
 * re-appear on the next dashboard mount — acceptable, since the
 * user can dismiss it again. Showing a blocking error here would
 * be worse than the silent retry.
 */
export function WelcomeMount({
  audience,
  institutionName,
  initiallyOpen,
}: {
  audience: AudienceKey
  institutionName: string | null
  initiallyOpen: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  // Tracks whether the persist call has already fired this session
  // so re-opens via the footer don't double-write.
  const [persisted, setPersisted] = useState(!initiallyOpen)

  // Re-open trigger from anywhere on the page (footer link).
  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener('okuji:welcome:open', onOpen)
    return () => window.removeEventListener('okuji:welcome:open', onOpen)
  }, [])

  const handleDismiss = useCallback(() => {
    setOpen(false)
    if (persisted) return
    setPersisted(true)
    // Fire-and-forget. We don't await — closing the modal is the
    // user-visible feedback; the server update is bookkeeping.
    void fetch('/api/welcome/dismiss', { method: 'POST' }).catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[welcome] dismiss persist failed:', e)
    })
  }, [persisted])

  if (!open) return null
  return (
    <WelcomeModal
      audience={audience}
      institutionName={institutionName}
      onDismiss={handleDismiss}
    />
  )
}
