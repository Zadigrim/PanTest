import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { detectRoles, ROLE_LABELS } from '@/lib/roles'
import { ProfileForm } from './ProfileForm'

export const metadata = { title: 'My Profile — PanoplyConnect' }

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/profile')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name, avatar_url, bio, website_url, role, connect_roles')
    .eq('id', user.id)
    .single() as { data: {
      display_name: string; avatar_url: string | null;
      bio: string | null; website_url: string | null;
      role: string; connect_roles: string[] | null
    } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleContext = await detectRoles(supabase as any, user.id)

  // Fetch employee institution memberships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employeeRows } = await (supabase as any)
    .from('employee_authorizations')
    .select('institution_id, institutions(name, institution_type)')
    .eq('user_id', user.id) as { data: Array<{
      institution_id: string
      institutions: { name: string; institution_type: string | null } | null
    }> | null }

  const employeeInstitutions = (employeeRows ?? []).map((row) => ({
    id: row.institution_id,
    name: row.institutions?.name ?? 'Unknown',
    institution_type: row.institutions?.institution_type ?? null,
  }))

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      {/* Header */}
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-bold text-panoply-navy">My Profile</h1>
          <Link
            href="/"
            className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10 space-y-8">
        {/* Profile form */}
        <ProfileForm
          userId={user.id}
          email={user.email ?? ''}
          initialDisplayName={profile?.display_name ?? ''}
          initialBio={profile?.bio ?? ''}
          initialWebsiteUrl={profile?.website_url ?? ''}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />

        {/* Roles */}
        <section className="rounded-panel border border-panoply-gray-2 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-panoply-navy">Roles</h2>
          <div className="flex flex-wrap gap-2">
            {roleContext.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center rounded-card bg-panoply-teal-lt px-3 py-1 text-sm font-medium text-panoply-teal-dk"
              >
                {ROLE_LABELS[role]}
              </span>
            ))}
          </div>
        </section>

        {/* Institution memberships */}
        {(roleContext.institutions.length > 0 || employeeInstitutions.length > 0) && (
          <section className="rounded-panel border border-panoply-gray-2 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-panoply-navy">Institution Memberships</h2>
            <ul className="divide-y divide-panoply-gray-2">
              {[
                ...roleContext.institutions.map((i) => ({ id: i.id, name: i.name, institution_type: i.institution_type })),
                ...employeeInstitutions,
              ].map((inst) => (
                <li key={inst.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-panoply-navy font-medium">{inst.name}</span>
                  {inst.institution_type && (
                    <span className="text-xs text-panoply-gray-3 capitalize">
                      {inst.institution_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Account info */}
        <section className="rounded-panel border border-panoply-gray-2 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-panoply-navy">Account</h2>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-panoply-gray-3">Email</dt>
              <dd className="text-sm text-panoply-navy">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-panoply-gray-3">User ID</dt>
              <dd className="font-mono text-xs text-panoply-gray-3">{user.id}</dd>
            </div>
          </dl>
        </section>

        {/* Danger zone */}
        <section className="rounded-panel border border-panoply-coral/40 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold text-panoply-coral">Danger Zone</h2>
          <p className="mb-4 text-sm text-panoply-gray-3">
            Deleting your account is permanent and cannot be undone. All your passports and data
            will be removed.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex h-9 items-center px-4 rounded-panel border border-panoply-coral text-sm font-medium text-panoply-coral opacity-50 cursor-not-allowed"
            title="Contact support to delete your account"
          >
            Delete account
          </button>
          <p className="mt-2 text-xs text-panoply-gray-3">
            To delete your account, contact{' '}
            <span className="text-panoply-navy">support@panoply.app</span>.
          </p>
        </section>
      </main>
    </div>
  )
}
