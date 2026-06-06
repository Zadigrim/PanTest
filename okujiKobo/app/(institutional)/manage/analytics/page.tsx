import { redirect } from 'next/navigation'

/**
 * /manage/analytics → /program?tab=analytics. The old surface here
 * was a "coming soon" stub; the new Program Analytics tab carries
 * real institution-rollup numbers + per-passport drill-in. No
 * redirect target ambiguity — there's exactly one analytics surface
 * now.
 */
export default function ManageAnalyticsRedirect() {
  redirect('/program?tab=analytics')
}
