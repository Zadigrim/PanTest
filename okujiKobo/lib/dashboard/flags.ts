/**
 * Dormant-slot feature flags for the operator dashboard.
 *
 * Every dormant KPI / queue row in the dashboard exists in code (so
 * the layout is proven and the activation path is a one-line flip)
 * but is HIDDEN in production until the underlying feature lands.
 *
 * Flipping a flag is necessary but not sufficient — each dormant
 * component carries a `// TODO(activate-when-…)` at the call site
 * naming the mechanism it waits on (payment system, prize-distribution
 * pipeline, role-switching primitives). See docs/DASHBOARD_REVIEW.md
 * for the full inventory.
 *
 * Defaults: ALL dormant flags off in production. Flip individually
 * via NEXT_PUBLIC_DASHBOARD_FLAG_<NAME>=1 if you want to preview a
 * slot locally without a code change.
 */

function envOn(name: string): boolean {
  // process.env reads at build time on the server. For preview-only
  // toggles we read the public NEXT_PUBLIC_* mirror so client +
  // server agree.
  if (typeof process === 'undefined') return false
  const v = process.env[name]
  return v === '1' || v === 'true'
}

export interface DashboardFlags {
  /** KPI: SOLD · 90D — gates the CARD itself. Hidden in v1 until
   *  paid-acquisition framing is canonical (data already exists;
   *  see DASHBOARD_REVIEW.md review item 1). */
  showSoldKpi: boolean
  /** KPI: PRIZES GIVEN — gates the DATA HOOK, not the card. The
   *  card always renders; flipping this swaps the loader's
   *  honest-zero stub for a real redemption-tracking query when
   *  that source exists. */
  showPrizesKpi: boolean
  /** KPI: PENDING DISTRIBUTION — gates the DATA HOOK, not the card.
   *  The card always renders; flipping this swaps the loader's
   *  honest-zero stub for a real query
   *  (completion_tokens.distribution_pending = true AND
   *  prize_distributed = false) once the employee-terminal
   *  resolves the count. The accent "needs-action" top border
   *  is gated separately on value > 0 in the page render. */
  showPendingDistributionKpi: boolean
  /** Header role-switcher pills — needs a real "viewing as"
   *  mechanism. Gates the CARD. */
  showRoleSwitcherPills: boolean
  /** Activity-feed event types "prize given" / "gift card added"
   *  — gates the rows. */
  showPrizeActivity: boolean
}

export function getDashboardFlags(): DashboardFlags {
  return {
    showSoldKpi:                envOn('NEXT_PUBLIC_DASHBOARD_FLAG_SOLD'),
    showPrizesKpi:              envOn('NEXT_PUBLIC_DASHBOARD_FLAG_PRIZES'),
    showPendingDistributionKpi: envOn('NEXT_PUBLIC_DASHBOARD_FLAG_PENDING_DIST'),
    showRoleSwitcherPills:      envOn('NEXT_PUBLIC_DASHBOARD_FLAG_ROLE_PILLS'),
    showPrizeActivity:          envOn('NEXT_PUBLIC_DASHBOARD_FLAG_PRIZE_ACTIVITY'),
  }
}
