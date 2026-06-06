import Link from 'next/link'
import type { DashboardAudit } from '@/lib/dashboard/load'

/**
 * Single highest-priority system issue. Hidden entirely when none —
 * never renders an empty card. v1 source is the coordinate audit.
 */
export function HeroAlert({ audit }: { audit: DashboardAudit }) {
  const total = audit.gpsMissingCoords + audit.qrMissingAddress
  if (total === 0) return null

  // Headline + button + meta must all agree on the count.
  // Three framings:
  //   - GPS-only: "N stop(s) is/are missing coordinates …"
  //   - QR-only:  "N stop(s) is/are missing addresses …"
  //   - Mixed:    "N stop(s) on published passports need location data"
  //               + sub-line breakdown by category.
  // Previous bug: headline used the per-category count (e.g. 1 GPS)
  // while the button used the combined total (e.g. 2). Single
  // collector + 1 missing GPS + 1 missing address rendered as
  // "1 stop is missing coordinates" alongside "Review 2 stops →" —
  // visually contradictory even though both numbers were technically
  // accurate in isolation.
  const onlyGps = audit.gpsMissingCoords > 0 && audit.qrMissingAddress === 0
  const onlyQr  = audit.qrMissingAddress > 0 && audit.gpsMissingCoords === 0

  let headline: string
  let meta: string
  if (onlyGps) {
    headline = `${total} stop${total === 1 ? ' is' : 's are'} missing coordinates on published passports`
    meta = `Collectors can’t GPS-verify these stops until coordinates are set`
  } else if (onlyQr) {
    headline = `${total} stop${total === 1 ? ' is' : 's are'} missing addresses on published passports`
    meta = `Collectors can’t find these stops until addresses are set`
  } else {
    // Mixed — name BOTH so the count breakdown is honest.
    headline = `${total} stops on published passports need location data`
    meta =
      `${audit.gpsMissingCoords} missing GPS coordinates`
      + `, ${audit.qrMissingAddress} missing addresses`
  }

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
        <h2 className="text-[15px] font-bold text-red">{headline}</h2>
        <p className="mt-1 text-[12px] text-muted">
          {meta}
          {' — affects '}
          {audit.affectedPassports} live passport{audit.affectedPassports === 1 ? '' : 's'}.
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
