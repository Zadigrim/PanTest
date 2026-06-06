import { redirect } from 'next/navigation'

/**
 * /manage was the institutional dashboard. Its content moved to
 * /program (the unified institutional hub — Overview / Passports /
 * Employees / Prizes / Analytics / Terminal tabs). This redirect
 * keeps existing bookmarks + the manage-layout sidebar links
 * working. The Analytics tab on /program is the closest match for
 * the prior /manage dashboard's role.
 */
export default function ManageDashboardRedirect() {
  redirect('/program?tab=analytics')
}
