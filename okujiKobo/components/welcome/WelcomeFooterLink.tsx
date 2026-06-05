'use client'

import { WELCOME_COPY } from '@/lib/welcome/copy'

/**
 * Dashboard-footer "About okujiKōbō" link that re-opens the welcome
 * modal. Decoupled from `WelcomeMount` via a window event so the
 * footer can sit anywhere in the page tree without lifting state.
 *
 * The link is text-only, muted, and lives at the bottom of the
 * dashboard — discoverability is fine because the modal already
 * explains the surface, so re-opens are rare.
 */
export function WelcomeFooterLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('okuji:welcome:open'))}
      className="text-[11.5px] text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      {WELCOME_COPY.reopenLabel}
    </button>
  )
}
