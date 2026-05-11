'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { OkujiConnectRole } from '@/lib/roles'

const COOKIE_NAME = 'okuji_active_role'

export async function setActiveRole(role: OkujiConnectRole) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, role, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    httpOnly: false, // needs to be readable by client for optimistic updates
  })
  revalidatePath('/', 'layout')
}

export async function getActiveRoleCookie(): Promise<OkujiConnectRole | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(COOKIE_NAME)?.value
  return (value as OkujiConnectRole | undefined) ?? null
}
