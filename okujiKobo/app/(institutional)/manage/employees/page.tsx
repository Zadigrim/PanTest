import { redirect } from 'next/navigation'

/**
 * /manage/employees → /program?tab=employees. The roster body
 * itself lives at components/program/EmployeesPanel (lifted from
 * the original /manage/employees client component, unchanged), so
 * the new Program Employees tab renders the SAME roster UI — same
 * flag set, same add-employee flow, same authorization semantics.
 */
export default function ManageEmployeesRedirect() {
  redirect('/program?tab=employees')
}
