'use client'

import { useEffect, useState, useTransition, useId, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeAuthorization, Profile } from '@/lib/supabase/types'
import { SectionLabel, Card, MicroNote, Note } from '@/components/program/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeRow {
  authzId: string
  userId: string
  displayName: string | null
  email: string | null
  role_label: string | null
  can_verify: boolean
  can_distribute_prizes: boolean
  // Provisioning-convenience flags (migration 033, Phase 1). These
  // exist as columns and are settable here, but are NOT yet enforced
  // anywhere in routes or RLS. SEC-02 / Phase 2 wires the gates.
  // Setting a flag records intent; it does not yet grant capability.
  can_design: boolean
  can_manage_employees: boolean
  can_view_analytics: boolean
  can_manage_billing: boolean
}

// Mirrors MemberFlagField in /access/institutions/[id]/page.tsx — the
// two roster UIs share the set of flag columns they edit.
type EmployeeFlagField =
  | 'can_verify'
  | 'can_distribute_prizes'
  | 'can_design'
  | 'can_manage_employees'
  | 'can_view_analytics'
  | 'can_manage_billing'

interface AddEmployeeFormState {
  email: string
  role_label: string
  can_verify: boolean
  can_distribute_prizes: boolean
  can_design: boolean
  can_manage_employees: boolean
  can_view_analytics: boolean
  can_manage_billing: boolean
}

// ---------------------------------------------------------------------------
// Permission toggle (accessible inline checkbox)
// ---------------------------------------------------------------------------

function PermissionToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 ${
        disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
      }`}
      title={disabled ? 'You do not have permission to change this' : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-green w-4 h-4"
        aria-label={label}
      />
    </label>
  )
}

// ---------------------------------------------------------------------------
// Employee table row
// ---------------------------------------------------------------------------

function EmployeeTableRow({
  employee,
  onPermissionChange,
  onRemove,
  permError,
}: {
  employee: EmployeeRow
  onPermissionChange: (
    authzId: string,
    field: EmployeeFlagField,
    value: boolean,
  ) => unknown
  onRemove: (authzId: string) => void
  permError: string | null
}) {
  const [removing, startRemoveTransition] = useTransition()
  const [removeError, setRemoveError] = useState<string | null>(null)

  function handleRemove() {
    setRemoveError(null)
    startRemoveTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('employee_authorizations')
        .delete()
        .eq('id', employee.authzId)
      if (error) {
        setRemoveError(error.message)
      } else {
        onRemove(employee.authzId)
      }
    })
  }

  return (
    <>
      <tr className="border-b border-hairline last:border-0 hover:bg-paper/40 transition-colors">
        {/* Name / email */}
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-navy leading-tight">
            {employee.displayName ?? (
              <span className="italic text-muted">No name set</span>
            )}
          </p>
          {employee.email && (
            <p className="text-xs text-muted truncate max-w-[200px]">
              {employee.email}
            </p>
          )}
        </td>

        {/* Role */}
        <td className="px-4 py-3 text-sm text-navy">
          {employee.role_label ?? <span className="text-muted">—</span>}
        </td>

        {/* can_verify */}
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_verify for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_verify}
            disabled={false}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_verify', v)}
          />
        </td>

        {/* can_distribute_prizes */}
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_distribute_prizes for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_distribute_prizes}
            disabled={false}
            onChange={(v) =>
              onPermissionChange(employee.authzId, 'can_distribute_prizes', v)
            }
          />
        </td>

        {/* Provisioning-convenience flags (migration 033). These
            checkboxes record intent for SEC-02 / Phase 2 enforcement;
            they do NOT yet grant capability in any route or RLS. */}
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_design (provisioning) for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_design}
            disabled={false}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_design', v)}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_manage_employees (provisioning) for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_manage_employees}
            disabled={false}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_manage_employees', v)}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_view_analytics (provisioning) for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_view_analytics}
            disabled={false}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_view_analytics', v)}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_manage_billing (provisioning) for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_manage_billing}
            disabled={false}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_manage_billing', v)}
          />
        </td>

        {/* Remove */}
        <td className="px-4 py-3 text-right">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-xs text-accent hover:underline disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </td>
      </tr>

      {/* Inline error rows */}
      {(removeError ?? permError) && (
        <tr className="border-b border-hairline">
          <td colSpan={9} className="px-4 pb-2">
            <span role="alert" className="text-xs text-accent">
              {removeError ?? permError}
            </span>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Add employee form
// ---------------------------------------------------------------------------

function AddEmployeeForm({
  institutionId,
  currentUserId,
  onAdded,
}: {
  institutionId: string
  currentUserId: string
  onAdded: (employee: EmployeeRow) => void
}) {
  const formId = useId()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [form, setForm] = useState<AddEmployeeFormState>({
    email: '',
    role_label: '',
    can_verify: false,
    can_distribute_prizes: false,
    can_design: false,
    can_manage_employees: false,
    can_view_analytics: false,
    can_manage_billing: false,
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedEmail = form.email.trim()
    if (!trimmedEmail) {
      setFormError('Email address is required.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()

      // Look up user by email via server API route (client can't call admin SDK).
      // institutionId scopes the route's can_manage_employees check (BLD-02).
      const lookupRes = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, institutionId }),
      })

      let targetUserId: string
      if (lookupRes.ok) {
        const json = (await lookupRes.json()) as { userId?: string; error?: string }
        if (!json.userId) {
          setFormError(json.error ?? `No account found for ${trimmedEmail}`)
          return
        }
        targetUserId = json.userId
      } else {
        const json = (await lookupRes.json()) as { error?: string }
        setFormError(json.error ?? `No account found for ${trimmedEmail}`)
        return
      }

      if (targetUserId === currentUserId) {
        setFormError('You cannot add yourself as an employee.')
        return
      }

      // Check if already authorized
      const { data: existing } = await supabase
        .from('employee_authorizations')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('institution_id', institutionId)
        .maybeSingle()

      if (existing) {
        setFormError('This person already has access to your institution.')
        return
      }

      // Insert authorization record
      const { data: inserted, error: insertErr } = await supabase
        .from('employee_authorizations')
        .insert({
          user_id: targetUserId,
          institution_id: institutionId,
          role_label: form.role_label.trim() || null,
          can_verify: form.can_verify,
          can_distribute_prizes: form.can_distribute_prizes,
          can_design: form.can_design,
          can_manage_employees: form.can_manage_employees,
          can_view_analytics: form.can_view_analytics,
          can_manage_billing: form.can_manage_billing,
          authorized_by: currentUserId,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) {
        setFormError(insertErr?.message ?? 'Failed to add employee — please try again.')
        return
      }

      // Fetch profile for display in table
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', targetUserId)
        .single()

      onAdded({
        authzId: inserted.id,
        userId: targetUserId,
        displayName: profile?.display_name ?? null,
        email: trimmedEmail,
        role_label: form.role_label.trim() || null,
        can_verify: form.can_verify,
        can_distribute_prizes: form.can_distribute_prizes,
        can_design: form.can_design,
        can_manage_employees: form.can_manage_employees,
        can_view_analytics: form.can_view_analytics,
        can_manage_billing: form.can_manage_billing,
      })

      // Reset form
      setForm({
        email: '',
        role_label: '',
        can_verify: false,
        can_distribute_prizes: false,
        can_design: false,
        can_manage_employees: false,
        can_view_analytics: false,
        can_manage_billing: false,
      })
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-program-card border-[1.5px] border-hairline bg-cream p-5 shadow-[0_1px_2px_rgba(31,29,26,0.04)]"
      aria-label="Add new employee"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-email`}
            className="text-sm font-medium text-ink"
          >
            Email address <span className="text-accent" aria-hidden="true">*</span>
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="off"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="employee@example.com"
            className="h-11 rounded-program-control border-[1.5px] border-hairline bg-field px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
          />
        </div>

        {/* Role label */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-role`}
            className="text-sm font-medium text-ink"
          >
            Role label{' '}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`${formId}-role`}
            type="text"
            value={form.role_label}
            onChange={(e) => setForm((p) => ({ ...p, role_label: e.target.value }))}
            placeholder="e.g. Barista, Receptionist"
            className="h-11 rounded-program-control border-[1.5px] border-hairline bg-field px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
          />
        </div>
      </div>

      {/* Permissions */}
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink mb-2">
          Permissions
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_verify}
              onChange={(e) => setForm((p) => ({ ...p, can_verify: e.target.checked }))}
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can verify stamps</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_distribute_prizes}
              onChange={(e) =>
                setForm((p) => ({ ...p, can_distribute_prizes: e.target.checked }))
              }
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can distribute prizes</span>
          </label>

          {/* Capability flags — enforced server-side as of Phase 2
              (lib/roles/require-flag.ts + per-route gates). Toggle
              records the change immediately; the next request from
              the affected employee sees the new authorization. */}
          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_design}
              onChange={(e) => setForm((p) => ({ ...p, can_design: e.target.checked }))}
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can design</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_manage_employees}
              onChange={(e) => setForm((p) => ({ ...p, can_manage_employees: e.target.checked }))}
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can manage employees</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_view_analytics}
              onChange={(e) => setForm((p) => ({ ...p, can_view_analytics: e.target.checked }))}
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can view analytics</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_manage_billing}
              onChange={(e) => setForm((p) => ({ ...p, can_manage_billing: e.target.checked }))}
              className="accent-green w-4 h-4"
            />
            <span className="text-sm text-ink">Can manage billing</span>
          </label>
        </div>
        <div className="mt-3">
          <MicroNote>
            The last four flags are provisioning-convenience only — Phase 2 will wire enforcement.
          </MicroNote>
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-red">
          {formError}
        </p>
      )}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-program-control text-sm font-semibold bg-green text-white hover:bg-green/90 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          {isPending ? 'Adding…' : 'Add employee'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function EmployeesPanel() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissionErrors, setPermissionErrors] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const supabase = createClient()

        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()
        if (authErr || !user) throw new Error('Not authenticated')

        setCurrentUserId(user.id)

        // Platform admins aren't in employee_authorizations — check first.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
        const isPlatformAdmin = isAdminRpc === true

        let instId: string

        if (isPlatformAdmin) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: firstInst } = await (supabase as any)
            .from('institutions')
            .select('id')
            .limit(1)
            .single()
          if (!firstInst?.id) throw new Error('No institutions found')
          instId = firstInst.id
        } else {
          // BLD-02 enforcement: the /manage/employees page now
          // requires can_manage_employees. Without it, a non-admin
          // employee shouldn't see (let alone edit) the roster.
          // Multi-institution callers land on whichever of their
          // can_manage_employees=true rows comes first (FIX-03 /
          // BLD-30 will add a proper institution switcher).
          const { data: myAuthz, error: myAuthzErr } = await supabase
            .from('employee_authorizations')
            .select('institution_id')
            .eq('user_id', user.id)
            .eq('can_manage_employees', true)
            .limit(1)
            .single()
          if (myAuthzErr || !myAuthz) {
            throw new Error('can_manage_employees required to access this page')
          }
          instId = myAuthz.institution_id
        }

        setInstitutionId(instId)

        // All employees for this institution. Includes the four
        // provisioning-convenience flags (migration 033) so the roster
        // reflects what's been recorded for SEC-02 / Phase 2.
        const { data: authzRows, error: authzFetchErr } = await supabase
          .from('employee_authorizations')
          .select(
            'id, user_id, role_label, can_verify, can_distribute_prizes,' +
            ' can_design, can_manage_employees, can_view_analytics, can_manage_billing',
          )
          .eq('institution_id', instId)
          .order('authorized_at', { ascending: true })
        if (authzFetchErr) throw new Error(authzFetchErr.message)

        // Concatenated select string types as GenericStringError; cast.
        const rows = (authzRows ?? []) as unknown as EmployeeAuthorization[]
        const userIds = rows.map((r) => r.user_id)

        // Bulk fetch profiles (display_name only — emails live in auth.users)
        const profileMap = new Map<string, Pick<Profile, 'id' | 'display_name'>>()
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds)
          for (const p of profiles ?? []) profileMap.set(p.id, p)
        }

        const assembled: EmployeeRow[] = rows.map(
          (
            r: Pick<
              EmployeeAuthorization,
              | 'id'
              | 'user_id'
              | 'role_label'
              | 'can_verify'
              | 'can_distribute_prizes'
              | 'can_design'
              | 'can_manage_employees'
              | 'can_view_analytics'
              | 'can_manage_billing'
            >,
          ) => ({
            authzId: r.id,
            userId: r.user_id,
            displayName: profileMap.get(r.user_id)?.display_name ?? null,
            // Email not available client-side without admin SDK; shown when added via form
            email: null,
            role_label: r.role_label,
            can_verify: r.can_verify ?? false,
            can_distribute_prizes: r.can_distribute_prizes ?? false,
            can_design: r.can_design ?? false,
            can_manage_employees: r.can_manage_employees ?? false,
            can_view_analytics: r.can_view_analytics ?? false,
            can_manage_billing: r.can_manage_billing ?? false,
          }),
        )

        setEmployees(assembled)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load employees')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Permission toggle — optimistic update, revert on error. Same
  // function handles all flag columns; the PostgREST UPDATE just sets
  // whichever key was passed in.
  async function handlePermissionChange(
    authzId: string,
    field: EmployeeFlagField,
    value: boolean,
  ) {
    // Optimistic
    setEmployees((prev) =>
      prev.map((emp) => (emp.authzId === authzId ? { ...emp, [field]: value } : emp)),
    )
    setPermissionErrors((prev) => {
      const next = new Map(prev)
      next.delete(authzId)
      return next
    })

    // Dynamic { [field]: value } can't be statically typed against the
    // Update shape; cast the client (the field is a known flag column).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase
      .from('employee_authorizations')
      .update({ [field]: value })
      .eq('id', authzId)

    if (error) {
      // Revert
      setEmployees((prev) =>
        prev.map((emp) => (emp.authzId === authzId ? { ...emp, [field]: !value } : emp)),
      )
      setPermissionErrors((prev) => new Map(prev).set(authzId, error.message))
    }
  }

  function handleRemove(authzId: string) {
    setEmployees((prev) => prev.filter((e) => e.authzId !== authzId))
  }

  function handleAdded(newEmployee: EmployeeRow) {
    setEmployees((prev) => [...prev, newEmployee])
  }

  return (
    <div className="space-y-8">
      {loading && (
        <p className="text-sm text-muted animate-pulse">Loading…</p>
      )}

      {loadError && (
        <Note className="border-l-red">
          {loadError}
        </Note>
      )}

      {!loading && !loadError && (
        <>
          {/* Employee table. The Program page already carries the
              H1 "Program" + description, so this section uses an
              eyebrow instead of a heading. */}
          <section>
            <SectionLabel>
              Current employees · <b>{employees.length}</b>
            </SectionLabel>

            {employees.length === 0 ? (
              <p className="text-sm text-muted">
                No employees yet. Add the first one below.
              </p>
            ) : (
              <Card padding="none" className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-[1.5px] border-hairline bg-field">
                      <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
                        Role
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can verify stamps">
                        Verify
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can distribute prizes">
                        Distribute
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can design (provisioning only — Phase 2)">
                        Design
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can manage employees (provisioning only — Phase 2)">
                        Manage
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can view analytics (provisioning only — Phase 2)">
                        Analytics
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10.5px] uppercase text-muted" style={{ letterSpacing: '1.5px' }} title="Can manage billing (provisioning only — Phase 2)">
                        Billing
                      </th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <EmployeeTableRow
                        key={emp.authzId}
                        employee={emp}
                        onPermissionChange={handlePermissionChange}
                        onRemove={handleRemove}
                        permError={permissionErrors.get(emp.authzId) ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            <div className="mt-3">
              <MicroNote>
                Capability flags enforced server-side: can_design (passport edits + create / unpublish / republish / delete),
                can_manage_employees (this roster + transfers + employee lookup), can_view_analytics (Program Overview &amp; Analytics),
                can_manage_billing (institution tier / pricing edits).
              </MicroNote>
            </div>
          </section>

          {/* Add employee form */}
          {institutionId && currentUserId && (
            <section>
              <SectionLabel>Add employee</SectionLabel>
              <AddEmployeeForm
                institutionId={institutionId}
                currentUserId={currentUserId}
                onAdded={handleAdded}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
