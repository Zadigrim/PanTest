import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Institution, EmployeeAuthorization } from '@/lib/supabase/types'
import AppNav from '@/components/layout/AppNav'

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-panel text-sm font-medium text-cream/90 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Logout form (server action)
// ---------------------------------------------------------------------------

async function LogoutButton() {
  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-panel text-sm font-medium text-cream/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green text-left"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?next=/manage')
  }

  // Check if platform admin via SECURITY DEFINER RPC — unaffected by PostgREST schema cache.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  const isPlatformAdmin = isAdminRpc === true

  let authorization: Pick<EmployeeAuthorization, 'id' | 'institution_id' | 'role_label'> | null = null

  if (isPlatformAdmin) {
    // Admins pick the first institution (or any they manage); use /access for full control
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: firstInst } = await (supabase as any)
      .from('institutions')
      .select('id')
      .limit(1)
      .single()
    if (firstInst?.id) {
      authorization = { id: 'admin', institution_id: firstInst.id, role_label: 'Platform Admin' }
    }
  }

  if (!authorization) {
    // Check employee_authorizations — any record for this user is sufficient for access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: empAuth } = await (supabase as any)
      .from('employee_authorizations')
      .select('id, institution_id, role_label')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    authorization = empAuth ?? null
  }

  // Fetch institution data to display in the sidebar (only when authorized)
  let institutionName = 'Institution'
  let logoUrl: string | null = null

  if (authorization) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: institution } = await (supabase as any)
      .from('institutions')
      .select('id, name, slug, logo_url')
      .eq('id', authorization.institution_id)
      .single()
    institutionName = (institution as Pick<Institution, 'name'> | null)?.name ?? 'Institution'
    logoUrl = (institution as Pick<Institution, 'logo_url'> | null)?.logo_url ?? null
  }

  const sidebarHeader = (
    <div className="px-4 py-5 border-b border-white/10">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${institutionName} logo`}
            className="h-9 w-9 rounded-card object-cover shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-card bg-green flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm select-none">
              {authorization ? (institutionName[0]?.toUpperCase() ?? 'I') : 'P'}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-tight">
            {authorization ? institutionName : 'Okuji'}
          </p>
          <p className="text-cream/60 text-xs truncate">Manage</p>
        </div>
      </div>
    </div>
  )

  if (!authorization) {
    return (
      <>
        <AppNav />
        <div className="flex min-h-[calc(100vh-3.5rem)] bg-paper">
        <aside className="w-60 shrink-0 bg-navy flex flex-col">
          {sidebarHeader}
          <div className="flex-1" />
          <div className="px-3 py-4 border-t border-white/10">
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 min-w-0 overflow-auto flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-modal shadow-sm border border-hairline p-8 text-center">
            <div className="text-4xl mb-4" aria-hidden="true">🔒</div>
            <h1 className="text-xl font-semibold text-navy mb-2">Access denied</h1>
            <p className="text-muted text-sm leading-relaxed">
              You need institutional access to view this page. Contact your institution
              administrator to be added as an employee.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center h-9 px-4 rounded-panel bg-green text-white text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              Back to home
            </Link>
          </div>
        </main>
        </div>
      </>
    )
  }

  return (
    <>
      <AppNav />
      <div className="flex min-h-[calc(100vh-3.5rem)] bg-paper">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-navy flex flex-col">
        {sidebarHeader}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Management navigation">
          <NavLink href="/manage">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </NavLink>

          <NavLink href="/manage/analytics">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </NavLink>

          <NavLink href="/manage/prizes">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="6" />
              <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
            </svg>
            Prizes
          </NavLink>

          <NavLink href="/manage/employees">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Employees
          </NavLink>

          <NavLink href="/terminal">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Terminal
          </NavLink>
        </nav>

        {/* Bottom: employee role + sign out */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {authorization.role_label && (
            <p className="px-3 text-xs text-cream/50 truncate">
              {authorization.role_label}
            </p>
          )}
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
      </div>
    </>
  )
}
