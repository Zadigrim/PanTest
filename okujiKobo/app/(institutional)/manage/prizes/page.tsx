import { redirect } from 'next/navigation'

/**
 * /manage/prizes → /program?tab=prizes. The configuration body
 * itself lives at components/program/PrizesPanel (lifted from the
 * original /manage/prizes client component, unchanged), so the new
 * Program Prizes tab renders the SAME configuration UI.
 */
export default function ManagePrizesRedirect() {
  redirect('/program?tab=prizes')
}
