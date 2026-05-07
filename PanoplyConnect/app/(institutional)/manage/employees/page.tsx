'use client'

import { useEffect, useState, useTransition, useId, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeAuthorization, Profile } from '@/lib/supabase/types'

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
  can_add_extras: boolean
}

interface AddEmployeeFormState {
  email: string
  role_label: string
  can_verify: boolean
  can_distribute_prizes: boolean
  can_add_extras: boolean
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
      className={`flex items-center justify-center gap-1.5 ${
        disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
      }`}
      title={disabled ? 'You do not have permission to change this' : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-panoply-teal w-4 h-4"
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
  currentCanAddExtras,
  onPermissionChange,
  onRemove,
  permError,
}: {
  employee: EmployeeRow
  currentCanAddExtras: boolean
  onPermissionChange: (
    authzId: string,
    field: 'can_verify' | 'can_distribute_prizes' | 'can_add_extras',
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
      <tr className="border-b border-panoply-gray-2 last:border-0 hover:bg-panoply-gray-1/40 transition-colors">
        {/* Name / email */}
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-panoply-navy leading-tight">
            {employee.displayName ?? (
              <span className="italic text-panoply-gray-3">No name set</span>
            )}
          </p>
          {employee.email && (
            <p className="text-xs text-panoply-gray-3 truncate max-w-[200px]">
              {employee.email}
            </p>
          )}
        </td>

        {/* Role */}
        <td className="px-4 py-3 text-sm text-panoply-navy">
          {employee.role_label ?? <span className="text-panoply-gray-3">—</span>}
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

        {/* can_add_extras — only editable if current user has can_add_extras */}
        <td className="px-4 py-3 text-center">
          <PermissionToggle
            label={`can_add_extras for ${employee.displayName ?? employee.userId}`}
            checked={employee.can_add_extras}
            disabled={!currentCanAddExtras}
            onChange={(v) => onPermissionChange(employee.authzId, 'can_add_extras', v)}
          />
        </td>

        {/* Remove */}
        <td className="px-4 py-3 text-right">
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-panoply-coral hover:underline disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-coral rounded-sm"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </td>
      </tr>

      {/* Inline error rows */}
      {(removeError ?? permError) && (
        <tr className="border-b border-panoply-gray-2">
          <td colSpan={6} className="px-4 pb-2">
            <span role="alert" className="text-xs text-panoply-coral">
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
  currentCanAddExtras,
  onAdded,
}: {
  institutionId: string
  currentUserId: string
  currentCanAddExtras: boolean
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
    can_add_extras: false,
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

      // Look up user by email via server API route (client can't call admin SDK)
      const lookupRes = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
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
          can_add_extras: currentCanAddExtras ? form.can_add_extras : false,
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
        can_add_extras: currentCanAddExtras ? form.can_add_extras : false,
      })

      // Reset form
      setForm({
        email: '',
        role_label: '',
        can_verify: false,
        can_distribute_prizes: false,
        can_add_extras: false,
      })
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-panel border border-panoply-gray-2 p-5"
      aria-label="Add new employee"
      noValidate
    >
      <h2 className="text-base font-semibold text-panoply-navy mb-4">Add employee</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-email`}
            className="text-sm font-medium text-panoply-navy"
          >
            Email address <span className="text-panoply-coral" aria-hidden="true">*</span>
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="off"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="employee@example.com"
            className="h-9 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal transition-colors"
          />
        </div>

        {/* Role label */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-role`}
            className="text-sm font-medium text-panoply-navy"
          >
            Role label{' '}
            <span className="font-normal text-panoply-gray-3">(optional)</span>
          </label>
          <input
            id={`${formId}-role`}
            type="text"
            value={form.role_label}
            onChange={(e) => setForm((p) => ({ ...p, role_label: e.target.value }))}
            placeholder="e.g. Barista, Receptionist"
            className="h-9 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal transition-colors"
          />
        </div>
      </div>

      {/* Permissions */}
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-panoply-navy mb-2">
          Permissions
        </legend>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_verify}
              onChange={(e) => setForm((p) => ({ ...p, can_verify: e.target.checked }))}
              className="accent-panoply-teal w-4 h-4"
            />
            <span className="text-sm text-panoply-navy">Can verify stamps</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.can_distribute_prizes}
              onChange={(e) =>
                setForm((p) => ({ ...p, can_distribute_prizes: e.target.checked }))
              }
              className="accent-panoply-teal w-4 h-4"
            />
            <span className="text-sm text-panoply-navy">Can distribute prizes</span>
          </label>

          <label
            className={`flex items-center gap-2 ${
              !currentCanAddExtras ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
            }`}
            title={
              !currentCanAddExtras
                ? 'You need can_add_extras permission to grant this'
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={form.can_add_extras}
              disabled={!currentCanAddExtras}
              onChange={(e) =>
                setForm((p) => ({ ...p, can_add_extras: e.target.checked }))
              }
              className="accent-panoply-teal w-4 h-4"
            />
            <span className="text-sm text-panoply-navy">Can add extras</span>
          </label>
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="mt-3 text-sm text-panoply-coral">
          {formError}
        </p>
      )}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-panel text-sm font-medium bg-panoply-teal text-white hover:bg-[#0F6E56] disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
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

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentCanAddExtras, setCurrentCanAddExtras] = useState(false)
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
        let canAddExtras: boolean

        if (isPlatformAdmin) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: firstInst } = await (supabase as any)
            .from('institutions')
            .select('id')
            .limit(1)
            .single()
          if (!firstInst?.id) throw new Error('No institutions found')
          instId = firstInst.id
          canAddExtras = true
        } else {
          const { data: myAuthz, error: myAuthzErr } = await supabase
            .from('employee_authorizations')
            .select('institution_id, can_add_extras')
            .eq('user_id', user.id)
            .limit(1)
            .single()
          if (myAuthzErr || !myAuthz) throw new Error('No institutional authorization found')
          instId = myAuthz.institution_id
          canAddExtras = myAuthz.can_add_extras ?? false
        }

        setInstitutionId(instId)
        setCurrentCanAddExtras(canAddExtras)

        // All employees for this institution
        const { data: authzRows, error: authzFetchErr } = await supabase
          .from('employee_authorizations')
          .select('id, user_id, role_label, can_verify, can_distribute_prizes, can_add_extras')
          .eq('institution_id', instId)
          .order('authorized_at', { ascending: true })
        if (authzFetchErr) throw new Error(authzFetchErr.message)

        const rows = authzRows ?? []
        const userIds = rows.map(
          (r: Pick<EmployeeAuthorization, 'user_id'>) => r.user_id,
        )

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
              'id' | 'user_id' | 'role_label' | 'can_verify' | 'can_distribute_prizes' | 'can_add_extras'
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
            can_add_extras: r.can_add_extras ?? false,
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

  // Permission toggle — optimistic update, revert on error
  async function handlePermissionChange(
    authzId: string,
    field: 'can_verify' | 'can_distribute_prizes' | 'can_add_extras',
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

    const supabase = createClient()
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
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-panoply-navy">Employees</h1>
        <p className="text-sm text-panoply-gray-3 mt-1">
          Manage employee access and permissions for your institution.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-panoply-gray-3 animate-pulse">Loading…</p>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-6 bg-panoply-coral/10 border border-panoply-coral rounded-panel p-4 text-panoply-coral text-sm"
        >
          {loadError}
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Employee table */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-panoply-navy mb-3">
              Current employees{' '}
              <span className="text-sm font-normal text-panoply-gray-3">
                ({employees.length})
              </span>
            </h2>

            {employees.length === 0 ? (
              <p className="text-sm text-panoply-gray-3">
                No employees yet. Add the first one below.
              </p>
            ) : (
              <div className="bg-white rounded-panel border border-panoply-gray-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-panoply-gray-2 bg-panoply-gray-1">
                      <th className="px-4 py-3 text-left font-medium text-panoply-gray-3">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-panoply-gray-3">
                        Role
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-panoply-gray-3">
                        Verify
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-panoply-gray-3">
                        Distribute
                      </th>
                      <th
                        className={`px-4 py-3 text-center font-medium ${
                          currentCanAddExtras
                            ? 'text-panoply-gray-3'
                            : 'text-panoply-gray-2'
                        }`}
                        title={
                          !currentCanAddExtras
                            ? 'You cannot manage this permission'
                            : undefined
                        }
                      >
                        Extras
                      </th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <EmployeeTableRow
                        key={emp.authzId}
                        employee={emp}
                        currentCanAddExtras={currentCanAddExtras}
                        onPermissionChange={handlePermissionChange}
                        onRemove={handleRemove}
                        permError={permissionErrors.get(emp.authzId) ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Add employee form */}
          {institutionId && currentUserId && (
            <AddEmployeeForm
              institutionId={institutionId}
              currentUserId={currentUserId}
              currentCanAddExtras={currentCanAddExtras}
              onAdded={handleAdded}
            />
          )}
        </>
      )}
    </div>
  )
}
