/**
 * Eyebrow section label — the ONLY section header style for the
 * Program hub. Replaces the ad-hoc h2's that used to wrap each
 * subsection (Overview / Analytics had ~6 each with identical
 * inline styles). JetBrains Mono, 11px, uppercase, 2px tracking,
 * muted; an optional emphasized segment renders inside.
 *
 * Why a single style: the Program page already carries the H1
 * "Program" + description; per-tab h1's and per-section h2's are
 * redundant. Eyebrows are scannable section dividers without the
 * heading weight.
 *
 * The `<b>` segment is muted (not ink) so the count / suffix reads
 * as supplementary, not as a number to grab. e.g.:
 *   <SectionLabel>Current employees <b>3</b></SectionLabel>
 */

import type { ReactNode } from 'react'

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-3 font-mono text-[11px] uppercase text-muted [&_b]:font-semibold [&_b]:text-muted"
      style={{ letterSpacing: '2px' }}
    >
      {children}
    </p>
  )
}
