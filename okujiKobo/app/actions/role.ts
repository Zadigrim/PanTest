'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { OkujiKoboRole } from '@/lib/roles'

const ROLE_COOKIE          = 'okuji_active_role'
const INSTITUTION_COOKIE   = 'okuji_active_institution'
const COOKIE_OPTS = {
  path:     '/',
  maxAge:   60 * 60 * 24 * 30, // 30 days
  sameSite: 'lax' as const,
  httpOnly: false, // needs to be readable by client for optimistic updates
}

export async function setActiveRole(role: OkujiKoboRole) {
  const cookieStore = await cookies()
  cookieStore.set(ROLE_COOKIE, role, COOKIE_OPTS)
  revalidatePath('/', 'layout')
}

export async function getActiveRoleCookie(): Promise<OkujiKoboRole | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(ROLE_COOKIE)?.value
  return (value as OkujiKoboRole | undefined) ?? null
}

/**
 * Active-institution cookie. Used by multi-institution employees to
 * pin which institution their flag checks evaluate against. Single-
 * institution employees can ignore this — the flag helpers fall back
 * to the sole institution when the cookie is unset (Phase 1 builds
 * the explicit-set path; the fall-back-to-sole-institution shortcut
 * is implemented in lib/roles/require-flag.ts callers, not here).
 *
 * Setting the cookie does NOT validate that the caller belongs to
 * the institution — the read side (callerHasFlag) does the
 * employee_authorizations lookup with the cookie value, so an
 * unauthorized cookie value simply doesn't pass the flag check.
 */
export async function setActiveInstitution(institutionId: string | null) {
  const cookieStore = await cookies()
  if (institutionId == null) {
    cookieStore.delete(INSTITUTION_COOKIE)
  } else {
    cookieStore.set(INSTITUTION_COOKIE, institutionId, COOKIE_OPTS)
  }
  revalidatePath('/', 'layout')
}

export async function getActiveInstitutionCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(INSTITUTION_COOKIE)?.value ?? null
}
