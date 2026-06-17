import { headers } from 'next/headers'
import { UpdatePasswordClient } from './UpdatePasswordClient'

/**
 * Shared password-reset landing page (both surfaces).
 *
 * Lives at the real /auth/ path segment, which middleware.ts excludes
 * from the moichido→/moichido rewrite, the /api host gate, and the auth
 * gate (isPublic) — so it is reachable from BOTH the kobo host and the
 * moichido host without any middleware change, exactly like /auth/callback.
 * It is NOT host-gated out of either surface (that would break the one
 * that legitimately needs it).
 *
 * Surface isolation is preserved by chrome, not by routing: each surface's
 * reset email links to its OWN host (resetPasswordForEmail redirectTo is
 * window.location.origin), so this page renders host-correct branding —
 * kobo navy card vs moichido teal card. Because it sits outside both the
 * (auth) and moichido/auth route-group layouts, it carries its own chrome.
 *
 * The recovery session is established by /auth/callback (the email link
 * points at /auth/callback?next=/auth/update-password), so by the time
 * this page renders the session is already in cookies; the client just
 * reads it and calls updateUser({ password }).
 */
export const metadata = { title: 'Reset your password' }

export default async function UpdatePasswordPage() {
  const h = await headers()
  const host = (h.get('host') ?? '').toLowerCase()
  const moichidoHost = process.env.MOICHIDO_HOST?.toLowerCase() ?? null
  const isMoichido = !!moichidoHost && host === moichidoHost

  return <UpdatePasswordClient isMoichido={isMoichido} />
}
