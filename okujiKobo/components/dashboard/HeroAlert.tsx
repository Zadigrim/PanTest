import Link from 'next/link'
import type { DashboardAudit } from '@/lib/dashboard/load'

/**
 * Single highest-priority system issue. Hidden entirely when none —
 * never renders an empty card. v1 source is the coordinate audit.
 */
export function HeroAlert({ audit }: { audit: DashboardAudit }) {
  const total = audit.gpsMissingCoords + audit.qrMissingAddress
  if (total === 0) return null

  // Priority: GPS-coords missing on a published passport > QR-address.
  // We pick the higher-impact framing for the headline.
  const lead = audit.gpsMissingCoords > 0 ? audit.gpsMissingCoords : audit.qrMissingAddress
  const kind = audit.gpsMissingCoords > 0 ? 'coordinates' : 'addresses'
  const verb = audit.gpsMissingCoords > 0 ? 'GPS-verify' : 'find'

  return (
    <section
      role="alert"
      className="mb-6 flex items-start gap-4 rounded-[10px] border-[1.5px] border-red bg-red/[0.06] p-4"
    >
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red text-[15px] font-bold text-white"
        aria-hidden="true"
      >
        !
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold text-red">
          {lead} stop{lead === 1 ? ' is' : 's are'} missing {kind} on published passports
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Collectors can&rsquo;t {verb} these stops until {kind} are set
          — affects {audit.affectedPassports} live passport{audit.affectedPassports === 1 ? '' : 's'}.
        </p>
      </div>
      <Link
        href="/dashboard/audit"
        className="ml-2 inline-flex h-9 shrink-0 items-center rounded-[8px] bg-red px-4 text-[12px] font-semibold text-white hover:opacity-90"
      >
        Review {total} stop{total === 1 ? '' : 's'} →
      </Link>
    </section>
  )
}
