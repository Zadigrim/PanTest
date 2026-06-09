import type { ReactNode } from 'react'

/**
 * moichido auth chrome — full-page Deep Teal canvas with the
 * sign-in / denied card centered. Distinct from /moichido/(authed)
 * (which is paper-bg + nav) so the surface signal is unambiguous
 * even before the user signs in.
 *
 * No top nav — the user isn't authenticated yet (or has been
 * denied), so the nav has nothing to authorize. The Wordmark +
 * Ring mark live INSIDE the centered card so brand chrome is
 * still present.
 */
export const metadata = {
  title: 'moichido · merchant sign-in',
}

export default function MoichidoAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-moichido-teal font-moichido flex items-center justify-center p-4">
      {children}
    </div>
  )
}
